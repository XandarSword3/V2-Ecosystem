import { Request, Response, NextFunction } from 'express';
import { BackupService } from '../../services/backup.service';
import { getSupabase } from '../../database/connection';
import { logActivity } from '../../utils/activityLogger';

export async function createBackup(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.user!.userId;
        const result = await BackupService.createBackup(userId);

        await logActivity({
            user_id: userId,
            action: 'CREATE_BACKUP',
            resource: 'backups',
            new_value: { filename: result.filename }
        });

        res.status(201).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}

export async function getBackups(req: Request, res: Response, next: NextFunction) {
    try {
        const backups = await BackupService.listBackups();
        res.json({ success: true, data: backups });
    } catch (error) {
        next(error);
    }
}

export async function deleteBackup(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;
        await BackupService.deleteBackup(id);

        await logActivity({
            user_id: req.user!.userId,
            action: 'DELETE_BACKUP',
            resource: 'backups',
            resource_id: id
        });

        res.json({ success: true, message: 'Backup deleted successfully' });
    } catch (error) {
        next(error);
    }
}

export async function getDownloadUrl(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;
        const supabase = getSupabase();

        const { data: backup, error: fetchError } = await supabase
            .from('backups')
            .select('storage_path')
            .eq('id', id)
            .single();

        if (fetchError || !backup) {
            return res.status(404).json({ success: false, error: 'Backup not found' });
        }

        const { data, error } = await supabase
            .storage
            .from('backups')
            .createSignedUrl(backup.storage_path, 3600); // 1 hour link

        if (error) throw error;

        res.json({ success: true, data: { downloadUrl: data.signedUrl } });
    } catch (error) {
        next(error);
    }
}
