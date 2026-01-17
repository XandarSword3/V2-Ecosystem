import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createChainableMock, createMockReqRes } from '../utils';

// Mock dependencies
vi.mock('../../../src/database/connection', () => ({
  getSupabase: vi.fn()
}));

vi.mock('../../../src/utils/activityLogger.js', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../src/socket/index.js', () => ({
  emitToAll: vi.fn()
}));

import { getSupabase } from '../../../src/database/connection';
import {
  uploadFile,
  deleteFile,
  listFiles,
  getBranding
} from '../../../src/modules/admin/controllers/upload.controller';

describe('UploadController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('should require file in request body', async () => {
      const { req, res, next } = createMockReqRes({
        body: { type: 'image' }
      });

      await uploadFile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No file provided'
      });
    });

    it('should reject invalid upload type', async () => {
      const { req, res, next } = createMockReqRes({
        body: { 
          file: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          type: 'invalid',
          filename: 'test.png'
        }
      });

      await uploadFile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('Invalid upload type')
      }));
    });

    it('should reject invalid base64 format', async () => {
      const { req, res, next } = createMockReqRes({
        body: { 
          file: 'not-valid-base64',
          type: 'image',
          filename: 'test.png'
        }
      });

      await uploadFile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid base64 file format'
      });
    });

    it('should reject invalid mime type for logo', async () => {
      const { req, res, next } = createMockReqRes({
        body: { 
          file: 'data:text/plain;base64,SGVsbG8gV29ybGQ=',
          type: 'logo',
          filename: 'test.txt'
        }
      });

      await uploadFile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('Invalid file type')
      }));
    });

    it('should reject file that exceeds size limit', async () => {
      // Create a large base64 string (simulate 3MB file for logo which has 2MB limit)
      const largeData = 'A'.repeat(3 * 1024 * 1024);
      const largeBase64 = Buffer.from(largeData).toString('base64');

      const { req, res, next } = createMockReqRes({
        body: { 
          file: `data:image/png;base64,${largeBase64}`,
          type: 'logo',
          filename: 'large.png'
        }
      });

      await uploadFile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('File too large')
      }));
    });

    it('should upload file successfully', async () => {
      const mockStorage = {
        listBuckets: vi.fn().mockResolvedValue({ data: [{ name: 'assets' }] }),
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ data: { path: 'image/test.png' }, error: null }),
          getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/image/test.png' } })
        })
      };

      vi.mocked(getSupabase).mockReturnValue({
        storage: mockStorage
      } as any);

      const { req, res, next } = createMockReqRes({
        body: { 
          file: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          type: 'image',
          filename: 'test.png'
        },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await uploadFile(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          url: 'https://cdn.example.com/image/test.png',
          type: 'image'
        })
      });
    });

    it('should create bucket if it does not exist', async () => {
      const mockCreateBucket = vi.fn().mockResolvedValue({ error: null });
      const mockStorage = {
        listBuckets: vi.fn().mockResolvedValue({ data: [] }),
        createBucket: mockCreateBucket,
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ data: { path: 'image/test.png' }, error: null }),
          getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/image/test.png' } })
        })
      };

      vi.mocked(getSupabase).mockReturnValue({
        storage: mockStorage
      } as any);

      const { req, res, next } = createMockReqRes({
        body: { 
          file: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          type: 'image',
          filename: 'test.png'
        },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await uploadFile(req, res, next);

      expect(mockCreateBucket).toHaveBeenCalledWith('assets', expect.any(Object));
    });

    it('should update branding settings for logo uploads', async () => {
      const mockFrom = vi.fn();
      const mockStorage = {
        listBuckets: vi.fn().mockResolvedValue({ data: [{ name: 'assets' }] }),
        from: mockFrom.mockReturnValue({
          upload: vi.fn().mockResolvedValue({ data: { path: 'logo/test.png' }, error: null }),
          getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/logo/test.png' } })
        })
      };

      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(getSupabase).mockReturnValue({
        storage: mockStorage,
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { value: {} }, error: null })
            })
          }),
          upsert: mockUpsert
        })
      } as any);

      const { req, res, next } = createMockReqRes({
        body: { 
          file: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          type: 'logo',
          filename: 'logo.png'
        },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await uploadFile(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });

    it('should handle upload errors', async () => {
      const mockStorage = {
        listBuckets: vi.fn().mockResolvedValue({ data: [{ name: 'assets' }] }),
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ data: null, error: { message: 'Upload failed' } })
        })
      };

      vi.mocked(getSupabase).mockReturnValue({
        storage: mockStorage
      } as any);

      const { req, res, next } = createMockReqRes({
        body: { 
          file: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          type: 'image',
          filename: 'test.png'
        },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await uploadFile(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Upload failed'
      }));
    });
  });

  describe('deleteFile', () => {
    it('should require file path', async () => {
      const { req, res, next } = createMockReqRes({
        params: {}
      });

      await deleteFile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'File path required'
      });
    });

    it('should delete file successfully', async () => {
      const mockRemove = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(getSupabase).mockReturnValue({
        storage: {
          from: vi.fn().mockReturnValue({
            remove: mockRemove
          })
        }
      } as any);

      const { req, res, next } = createMockReqRes({
        params: { path: 'image/test.png' },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await deleteFile(req, res, next);

      expect(mockRemove).toHaveBeenCalledWith(['image/test.png']);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'File deleted successfully'
      });
    });

    it('should handle delete errors', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        storage: {
          from: vi.fn().mockReturnValue({
            remove: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } })
          })
        }
      } as any);

      const { req, res, next } = createMockReqRes({
        params: { path: 'image/test.png' },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await deleteFile(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Delete failed'
      }));
    });
  });

  describe('listFiles', () => {
    it('should list files successfully', async () => {
      const mockFiles = [
        { name: 'test1.png', metadata: { size: 1024 }, created_at: '2024-01-01' },
        { name: 'test2.jpg', metadata: { size: 2048 }, created_at: '2024-01-02' }
      ];

      vi.mocked(getSupabase).mockReturnValue({
        storage: {
          from: vi.fn().mockReturnValue({
            list: vi.fn().mockResolvedValue({ data: mockFiles, error: null }),
            getPublicUrl: vi.fn().mockImplementation((path: string) => ({
              data: { publicUrl: `https://cdn.example.com/${path}` }
            }))
          })
        }
      } as any);

      const { req, res, next } = createMockReqRes({
        query: { type: 'image' }
      });

      await listFiles(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ name: 'test1.png' }),
          expect.objectContaining({ name: 'test2.jpg' })
        ])
      });
    });

    it('should list files without type filter', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        storage: {
          from: vi.fn().mockReturnValue({
            list: vi.fn().mockResolvedValue({ data: [], error: null }),
            getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: '' } })
          })
        }
      } as any);

      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await listFiles(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: []
      });
    });

    it('should handle list errors', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        storage: {
          from: vi.fn().mockReturnValue({
            list: vi.fn().mockResolvedValue({ data: null, error: { message: 'List failed' } })
          })
        }
      } as any);

      const { req, res, next } = createMockReqRes({
        query: { type: 'image' }
      });

      await listFiles(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        message: 'List failed'
      }));
    });
  });

  describe('getBranding', () => {
    it('should return branding settings', async () => {
      const mockBranding = { logoUrl: 'https://cdn.example.com/logo.png', faviconUrl: 'https://cdn.example.com/favicon.ico' };

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { value: mockBranding }, error: null })
            })
          })
        })
      } as any);

      const { req, res, next } = createMockReqRes();
      await getBranding(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockBranding
      });
    });

    it('should return default branding when none exists', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
            })
          })
        })
      } as any);

      const { req, res, next } = createMockReqRes();
      await getBranding(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { logoUrl: null, faviconUrl: null }
      });
    });

    it('should handle branding fetch errors', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: 'OTHER', message: 'DB error' } })
            })
          })
        })
      } as any);

      const { req, res, next } = createMockReqRes();
      await getBranding(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        message: 'DB error'
      }));
    });
  });
});
