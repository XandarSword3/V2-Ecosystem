
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { promisify } from 'util';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const execAsync = promisify(exec);

const DB_URL = process.env.DATABASE_URL; // Should be the full connection string
const BACKUP_DIR = path.resolve(__dirname, '../../backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const ENCRYPTION_KEY = process.env.BACKUP_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  console.error('Error: BACKUP_ENCRYPTION_KEY is not defined in .env');
  process.exit(1);
}

async function backupDatabase() {
  if (!DB_URL) {
    console.error('Error: DATABASE_URL is not defined in .env');
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${timestamp}.sql.enc`;
  const filePath = path.join(BACKUP_DIR, filename);

  console.log(`Starting encrypted backup to ${filePath}...`);

  try {
    // Pipeline: pg_dump -> openssl enc -> file
    // Using aes-256-cbc. Note: In production, consider using a proper KMS.
    // We pass the password via environment variable to openssl to avoid command line logging.
    
    // Construct command. 
    // We need to ensure environment variables are passed correctly to the child process.
    
    const command = `pg_dump "${DB_URL}" -F p | openssl enc -aes-256-cbc -salt -pbkdf2 -out "${filePath}" -pass env:BACKUP_ENCRYPTION_KEY`;
    
    const { stdout, stderr } = await execAsync(command, {
        env: { ...process.env, BACKUP_ENCRYPTION_KEY: ENCRYPTION_KEY }
    });

    if (stderr) {
      // openssl might print to stderr even on success, or pg_dump warnings
      if (stderr.toLowerCase().includes('error')) {
         console.warn('Backup warning (stderr):', stderr);
      }
    }
    
    console.log(`Backup completed successfully: ${filePath}`);
    
    // Logic to retain only last N backups could go here
    cleanupOldBackups();

  } catch (error) {
    console.error('Backup failed:', error);
    process.exit(1);
  }
}

function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.sql.enc'))
      .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time); // Newest first

    const KEEP_COUNT = 5;
    if (files.length > KEEP_COUNT) {
      const toDelete = files.slice(KEEP_COUNT);
      toDelete.forEach(f => {
        fs.unlinkSync(path.join(BACKUP_DIR, f.name));
        console.log(`Deleted old backup: ${f.name}`);
      });
    }
  } catch (err) {
    console.error('Error cleaning up old backups:', err);
  }
}

backupDatabase();
