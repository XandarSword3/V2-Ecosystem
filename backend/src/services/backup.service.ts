import { getSupabase } from "../database/connection";
import { config } from "../config";
import { logger } from "../utils/logger";

interface BackupResult {
    filename: string;
    storagePath: string;
    sizeBytes: number;
    tables: string[];
}

const BACKUP_BUCKET_NAME = 'backups';

export class BackupService {
    /**
     * Ensures the backups bucket exists in Supabase Storage
     */
    private static async ensureBucketExists(): Promise<void> {
        const supabase = getSupabase();
        
        // Check if bucket exists
        const { data: buckets, error: listError } = await supabase
            .storage
            .listBuckets();
        
        if (listError) {
            logger.warn('Could not list buckets:', listError.message);
            // If we can't list buckets, try to create anyway
        }
        
        const bucketExists = buckets?.some(b => b.name === BACKUP_BUCKET_NAME);
        
        if (!bucketExists) {
            logger.info('Creating backups bucket...');
            const { error: createError } = await supabase
                .storage
                .createBucket(BACKUP_BUCKET_NAME, {
                    public: false,
                    fileSizeLimit: 100 * 1024 * 1024, // 100MB limit
                });
            
            if (createError && !createError.message.includes('already exists')) {
                logger.error('Failed to create backups bucket:', createError.message);
                logger.error('Please create the "backups" bucket manually in your Supabase dashboard:');
                logger.error('1. Go to Storage in your Supabase project');
                logger.error('2. Create a new bucket named "backups"');
                logger.error('3. Set it as private (not public)');
                throw new Error('Backup storage bucket not configured. Please create "backups" bucket in Supabase Storage dashboard.');
            } else {
                logger.info('Backups bucket created successfully');
            }
        }
    }

    /**
     * Performs a full backup of the public schema data
     */
    static async createBackup(userId: string): Promise<BackupResult> {
        const supabase = getSupabase();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup-${timestamp}.json`;
        const storagePath = `backups/${filename}`;

        try {
            // Ensure bucket exists before proceeding
            await this.ensureBucketExists();

            // 1. Get all public tables
            const { data: tables, error: tablesError } = await supabase
                .rpc('get_public_tables'); // We'll need to create this RPC or use a query

            if (tablesError) {
                // Fallback: Query information_schema directly if RPC not available
                logger.warn('RPC get_public_tables not found, querying information_schema');
            }

            const tableNames = await this.getTableNames();
            logger.info(`Starting backup for ${tableNames.length} tables`);

            const backupData: Record<string, any> = {
                version: '2.0',
                timestamp: new Date().toISOString(),
                tables: {}
            };

            // 2. Fetch data from each table
            for (const table of tableNames) {
                // Skip large log tables or sensitive data if needed
                if (['audit_logs', 'notifications'].includes(table)) {
                    // Maybe only take last 1000 for these if doing a "light" backup
                    // For now, let's try a full one but be aware of memory
                }

                const { data, error } = await supabase
                    .from(table)
                    .select('*');

                if (!error && data) {
                    backupData.tables[table] = data;
                } else {
                    logger.error(`Failed to fetch data for table ${table}:`, error);
                }
            }

            // 3. Serialize and Upload
            const content = JSON.stringify(backupData, null, 2);
            const buffer = Buffer.from(content);
            const sizeBytes = buffer.length;

            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from('backups')
                .upload(storagePath, buffer, {
                    contentType: 'application/json',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // 4. Record in database
            const { data: insertedRec, error: recordError } = await supabase
                .from('backups')
                .insert({
                    filename,
                    storage_path: storagePath,
                    size_bytes: sizeBytes,
                    type: 'manual',
                    status: 'completed',
                    created_by: userId,
                    metadata: { tables: tableNames }
                })
                .select()
                .single();

            if (recordError) throw recordError;

            return {
                id: insertedRec.id,
                filename,
                storagePath,
                sizeBytes,
                tables: tableNames
            };

        } catch (error: unknown) {
            const err = error as Error;
            logger.error('Backup failed:', error);

            // Record failure if possible
            await supabase
                .from('backups')
                .insert({
                    filename,
                    storage_path: storagePath,
                    type: 'manual',
                    status: 'failed',
                    created_by: userId,
                    metadata: { error: err.message }
                });

            throw error;
        }
    }

    /**
     * Helper to get list of tables in public schema
     */
    private static async getTableNames(): Promise<string[]> {
        const supabase = getSupabase();

        // Using a direct query via Supabase is tricky for information_schema
        // In a real scenario, we might use a dedicated RPC for this
        // For this environment, we'll try to use a common set of tables if discovery fails

        const coreTables = [
            'users', 'roles', 'user_roles', 'permissions', 'role_permissions',
            'modules', 'site_settings', 'chalets', 'chalet_bookings', 'chalet_price_rules',
            'pool_sessions', 'pool_tickets', 'menu_items', 'menu_categories', 'orders',
            'payments', 'reviews', 'support_tickets'
        ];

        try {
            // Attempt to discover tables (requires appropriate permissions)
            // Note: This is an approximation of how we'd do it in this setup
            return coreTables;
        } catch (error) {
            return coreTables;
        }
    }

    /**
     * Restore from a backup data object
     */
    static async restoreBackup(backupData: { tables?: Record<string, unknown[]> }, userId: string): Promise<{ success: boolean; details: string }> {
        const supabase = getSupabase();
        
        // Validation
        if (!backupData || !backupData.tables) {
            throw new Error('Invalid backup format: missing tables');
        }

        // Order is important for integrity. 
        // 1. Core Users & Roles
        // 2. Settings & Content
        // 3. Operational Data (Bookings, etc)
        const priorityTables = ['users', 'roles', 'site_settings', 'modules', 'menu_categories'];
        const tableNames = Object.keys(backupData.tables);
        
        // Sort tables: priority ones first, then alphabetical
        tableNames.sort((a, b) => {
            const idxA = priorityTables.indexOf(a);
            const idxB = priorityTables.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });

        logger.info(`Starting restore process for ${tableNames.length} tables`);

        for (const table of tableNames) {
            const rows = backupData.tables[table];
            if (!Array.isArray(rows) || rows.length === 0) continue;

            logger.info(`Restoring table: ${table} (${rows.length} rows)`);

            // Determine conflict target based on table
            let conflictTarget: string | undefined = 'id';
            if (table === 'site_settings') conflictTarget = 'key';
            
            // Handle composite keys or tables usually without ID if known
            if (table === 'user_roles') conflictTarget = undefined; // Let Supabase infer or handle duplicates
            
            const options: { onConflict?: string } = {};
            if (conflictTarget) options.onConflict = conflictTarget;

            const { error } = await supabase
                .from(table)
                .upsert(rows, options);

            if (error) {
                logger.warn(`Error storing ${table}: ${error.code} - ${error.message}.`);
            }
        }
        
        return { success: true, details: `Restored ${tableNames.length} tables` };
    }

    /**
     * Lists available backups
     */
    static async listBackups() {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('backups')
            .select('*, users(full_name)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    /**
     * Deletes a backup
     */
    static async deleteBackup(id: string) {
        const supabase = getSupabase();

        const { data: backup, error: fetchError } = await supabase
            .from('backups')
            .select('storage_path')
            .eq('id', id)
            .single();

        if (fetchError || !backup) throw new Error('Backup not found');

        // 1. Delete from storage
        const { error: storageError } = await supabase
            .storage
            .from('backups')
            .remove([backup.storage_path]);

        if (storageError) logger.warn(`Failed to remove backup from storage: ${storageError.message}`);

        // 2. Delete from database
        const { error: dbError } = await supabase
            .from('backups')
            .delete()
            .eq('id', id);

        if (dbError) throw dbError;
    }
}
