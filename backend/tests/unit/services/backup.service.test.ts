import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createChainableMock } from '../utils';

// Mock dependencies
vi.mock('../../../src/database/connection', () => ({
  getSupabase: vi.fn()
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../src/config', () => ({
  config: {
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'test-key'
  }
}));

import { getSupabase } from '../../../src/database/connection';
import { BackupService } from '../../../src/services/backup.service';

describe('BackupService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listBackups', () => {
    it('should return list of backups with creator info', async () => {
      const mockBackups = [
        {
          id: 'backup-1',
          filename: 'backup-2024-01-01.json',
          storage_path: 'backups/backup-2024-01-01.json',
          size_bytes: 1024,
          status: 'completed',
          created_at: '2024-01-01T00:00:00Z',
          users: { full_name: 'Admin User' }
        },
        {
          id: 'backup-2',
          filename: 'backup-2024-01-02.json',
          storage_path: 'backups/backup-2024-01-02.json',
          size_bytes: 2048,
          status: 'completed',
          created_at: '2024-01-02T00:00:00Z',
          users: { full_name: 'Admin User' }
        }
      ];

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockBackups, error: null })
        })
      } as any);

      const result = await BackupService.listBackups();

      expect(result).toHaveLength(2);
      expect(result[0].filename).toBe('backup-2024-01-01.json');
      expect(result[0].users.full_name).toBe('Admin User');
    });

    it('should throw error on database failure', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ 
            data: null, 
            error: { message: 'Database error' } 
          })
        })
      } as any);

      await expect(BackupService.listBackups()).rejects.toThrow();
    });

    it('should return empty array when no backups exist', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      } as any);

      const result = await BackupService.listBackups();

      expect(result).toHaveLength(0);
    });
  });

  describe('deleteBackup', () => {
    it('should delete backup from storage and database', async () => {
      const mockRemove = vi.fn().mockResolvedValue({ error: null });
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      });

      let fromCallCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          fromCallCount++;
          if (fromCallCount === 1) {
            // First call: fetch backup info
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { storage_path: 'backups/backup-test.json' },
                  error: null
                })
              })
            };
          }
          // Second call: delete from database
          return {
            delete: mockDelete
          };
        }),
        storage: {
          from: vi.fn().mockReturnValue({
            remove: mockRemove
          })
        }
      } as any);

      await BackupService.deleteBackup('backup-1');

      expect(mockRemove).toHaveBeenCalledWith(['backups/backup-test.json']);
    });

    it('should throw error when backup not found', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' }
            })
          })
        })
      } as any);

      await expect(BackupService.deleteBackup('non-existent')).rejects.toThrow('Backup not found');
    });
  });

  describe('restoreBackup', () => {
    it('should restore data from backup', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue({
          upsert: mockUpsert
        })
      } as any);

      const backupData = {
        tables: {
          users: [{ id: 'user-1', email: 'test@test.com' }],
          roles: [{ id: 'role-1', name: 'admin' }]
        }
      };

      const result = await BackupService.restoreBackup(backupData, 'admin-user');

      expect(result.success).toBe(true);
      expect(result.details).toContain('2 tables');
    });

    it('should throw error for invalid backup format', async () => {
      await expect(
        BackupService.restoreBackup({} as any, 'admin-user')
      ).rejects.toThrow('Invalid backup format: missing tables');
    });

    it('should handle empty tables gracefully', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue({
          upsert: vi.fn().mockResolvedValue({ error: null })
        })
      } as any);

      const backupData = {
        tables: {
          users: [],
          roles: []
        }
      };

      const result = await BackupService.restoreBackup(backupData, 'admin-user');

      expect(result.success).toBe(true);
    });

    it('should restore priority tables first', async () => {
      const restoreOrder: string[] = [];
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          restoreOrder.push(table);
          return {
            upsert: vi.fn().mockResolvedValue({ error: null })
          };
        })
      } as any);

      const backupData = {
        tables: {
          orders: [{ id: 'order-1' }],
          users: [{ id: 'user-1' }],
          roles: [{ id: 'role-1' }],
          site_settings: [{ key: 'setting-1' }]
        }
      };

      await BackupService.restoreBackup(backupData, 'admin-user');

      // Priority tables should come first
      const usersIndex = restoreOrder.indexOf('users');
      const rolesIndex = restoreOrder.indexOf('roles');
      const ordersIndex = restoreOrder.indexOf('orders');

      expect(usersIndex).toBeLessThan(ordersIndex);
      expect(rolesIndex).toBeLessThan(ordersIndex);
    });

    it('should continue on upsert errors with warning', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue({
          upsert: vi.fn().mockResolvedValue({ 
            error: { code: 'CONSTRAINT_ERROR', message: 'Constraint violation' } 
          })
        })
      } as any);

      const backupData = {
        tables: {
          users: [{ id: 'user-1' }]
        }
      };

      // Should not throw, just warn
      const result = await BackupService.restoreBackup(backupData, 'admin-user');
      
      expect(result.success).toBe(true);
    });
  });

  describe('createBackup', () => {
    it('should create backup and upload to storage', async () => {
      const mockUpload = vi.fn().mockResolvedValue({ data: { path: 'backups/test.json' }, error: null });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'backup-new' }, error: null }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: 'backup-new', filename: 'backup-test.json' },
                error: null
              })
            })
          };
        }),
        rpc: vi.fn().mockResolvedValue({ data: ['users', 'roles'], error: null }),
        storage: {
          listBuckets: vi.fn().mockResolvedValue({ 
            data: [{ name: 'backups' }], 
            error: null 
          }),
          from: vi.fn().mockReturnValue({
            upload: mockUpload
          })
        }
      } as any);

      const result = await BackupService.createBackup('user-123');

      expect(result).toBeDefined();
      expect(result.filename).toContain('backup-');
    });
  });
});
