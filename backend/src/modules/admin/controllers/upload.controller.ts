/**
 * File Upload Controller
 * Handles logo, favicon, and image uploads to Supabase Storage
 */

import { Request, Response, NextFunction } from 'express';
import { getSupabase } from '../../../database/connection.js';
import { logActivity } from '../../../utils/activityLogger.js';
import { logger } from '../../../utils/logger.js';
import { emitToAll } from '../../../socket/index.js';

// Allowed file types for different upload categories
const ALLOWED_TYPES: Record<string, string[]> = {
  logo: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'],
  favicon: ['image/png', 'image/x-icon', 'image/svg+xml', 'image/vnd.microsoft.icon'],
  image: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
};

// Max file sizes in bytes
const MAX_SIZES: Record<string, number> = {
  logo: 2 * 1024 * 1024, // 2MB
  favicon: 512 * 1024, // 512KB
  image: 5 * 1024 * 1024, // 5MB
};

// Storage bucket name
const BUCKET_NAME = 'assets';

/**
 * Ensure the assets bucket exists
 */
async function ensureBucket() {
  const supabase = getSupabase();
  
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);
  
  if (!bucketExists) {
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024, // 10MB max
      allowedMimeTypes: [
        'image/png',
        'image/jpeg',
        'image/svg+xml',
        'image/webp',
        'image/gif',
        'image/x-icon',
        'image/vnd.microsoft.icon',
      ],
    });
    
    if (error && !error.message.includes('already exists')) {
      throw error;
    }
  }
}

/**
 * Upload a file (logo, favicon, or general image)
 * Expects multipart/form-data with:
 * - file: The file buffer
 * - type: 'logo' | 'favicon' | 'image'
 * - filename: Original filename
 */
export async function uploadFile(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const userId = req.user?.userId;
    
    // Check if we have file data in body (from middleware)
    const { file, type = 'image', filename } = req.body;
    
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided',
      });
    }
    
    // Validate type
    const uploadType = type as string;
    if (!ALLOWED_TYPES[uploadType]) {
      return res.status(400).json({
        success: false,
        error: `Invalid upload type. Must be one of: ${Object.keys(ALLOWED_TYPES).join(', ')}`,
      });
    }
    
    // Convert base64 to buffer if needed
    let fileBuffer: Buffer;
    let mimeType: string;
    
    if (typeof file === 'string' && file.includes('base64')) {
      // Extract base64 data and mime type
      const matches = file.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({
          success: false,
          error: 'Invalid base64 file format',
        });
      }
      mimeType = matches[1];
      fileBuffer = Buffer.from(matches[2], 'base64');
    } else if (Buffer.isBuffer(file)) {
      fileBuffer = file;
      mimeType = req.headers['content-type'] || 'application/octet-stream';
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid file format. Send base64 encoded data.',
      });
    }
    
    // Validate mime type
    if (!ALLOWED_TYPES[uploadType].includes(mimeType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid file type for ${uploadType}. Allowed: ${ALLOWED_TYPES[uploadType].join(', ')}`,
      });
    }
    
    // Validate file size
    if (fileBuffer.length > MAX_SIZES[uploadType]) {
      return res.status(400).json({
        success: false,
        error: `File too large. Max size for ${uploadType}: ${MAX_SIZES[uploadType] / 1024 / 1024}MB`,
      });
    }
    
    // Ensure bucket exists
    await ensureBucket();
    
    // Generate unique filename
    const ext = mimeType.split('/')[1]?.replace('svg+xml', 'svg').replace('x-icon', 'ico').replace('vnd.microsoft.icon', 'ico') || 'png';
    const timestamp = Date.now();
    const safeName = (filename || 'file').replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 50);
    const storagePath = `${uploadType}/${timestamp}-${safeName}.${ext}`;
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });
    
    if (error) {
      logger.error('File upload failed', { error: error.message, path: storagePath });
      throw error;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);
    
    const publicUrl = urlData.publicUrl;
    
    // If this is a logo or favicon, update site settings
    if (uploadType === 'logo' || uploadType === 'favicon') {
      const settingKey = uploadType === 'logo' ? 'logoUrl' : 'faviconUrl';
      
      // Get existing branding settings
      const { data: existing } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'branding')
        .single();
      
      const brandingSettings = (existing?.value as Record<string, unknown>) || {};
      brandingSettings[settingKey] = publicUrl;
      
      // Update settings
      const { error: updateError } = await supabase
        .from('site_settings')
        .upsert({
          key: 'branding',
          value: brandingSettings,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'key',
        });
      
      if (updateError) {
        logger.error('Failed to update branding settings', { error: updateError.message });
      }
      
      // Emit real-time update
      emitToAll('settings:updated', { key: 'branding', value: brandingSettings });
    }
    
    // Log activity
    await logActivity({
      user_id: userId || 'system',
      action: 'UPLOAD',
      resource: 'file',
      resource_id: storagePath,
    });
    
    logger.info(`File uploaded successfully: ${storagePath}`);
    
    res.json({
      success: true,
      data: {
        url: publicUrl,
        path: storagePath,
        type: uploadType,
        size: fileBuffer.length,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete an uploaded file
 */
export async function deleteFile(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const userId = req.user?.userId;
    const { path } = req.params;
    
    if (!path) {
      return res.status(400).json({
        success: false,
        error: 'File path required',
      });
    }
    
    // Delete from storage
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);
    
    if (error) {
      logger.error('File deletion failed', { error: error.message, path });
      throw error;
    }
    
    // Log activity
    await logActivity({
      user_id: userId || 'system',
      action: 'DELETE',
      resource: 'file',
      resource_id: path,
    });
    
    logger.info(`File deleted: ${path}`);
    
    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List uploaded files by type
 */
export async function listFiles(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { type } = req.query;
    
    const folder = (type as string) || '';
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(folder, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });
    
    if (error) {
      throw error;
    }
    
    // Get public URLs for all files
    const files = (data || []).map(file => {
      const path = folder ? `${folder}/${file.name}` : file.name;
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(path);
      
      return {
        name: file.name,
        path,
        url: urlData.publicUrl,
        size: file.metadata?.size,
        createdAt: file.created_at,
      };
    });
    
    res.json({
      success: true,
      data: files,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current branding (logo/favicon URLs)
 */
export async function getBranding(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'branding')
      .single();
    
    if (error && error.code !== 'PGRST116') { // Not found is OK
      throw error;
    }
    
    const branding = (data?.value as Record<string, unknown>) || {
      logoUrl: null,
      faviconUrl: null,
    };
    
    res.json({
      success: true,
      data: branding,
    });
  } catch (error) {
    next(error);
  }
}
