/**
 * Pool Sessions Import Controller
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import * as parser from '../services/pool-import.parser.js';
import { getSupabase } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { ImportedPoolSession, PoolCommitImportRequest } from '../types/pool-import.types.js';

/**
 * Parse pool sessions import data
 */
export const parseImport = asyncHandler(async (req: Request, res: Response) => {
  let result: { items: unknown[]; warnings: string[]; errors: string[]; totalParsed: number; successful: number } | null = null;

  try {
    if (req.file) {
      const buffer = req.file.buffer;
      const mimeType = req.file.mimetype;

      if (mimeType === 'application/json' || req.file.originalname.endsWith('.json')) {
        result = parser.parseJsonImport(JSON.parse(buffer.toString()));
      } else {
        return res.status(400).json({ success: false, errors: ['Unsupported file type. Use JSON.'] });
      }
    } else if (req.body.text) {
      result = await parser.parseLlmImport(req.body.text);
    } else if (req.body.json) {
      result = parser.parseJsonImport(req.body.json);
    } else {
      return res.status(400).json({ success: false, errors: ['No data provided for parsing.'] });
    }

    if (result.successful === 0 && result.errors.length > 0) {
      return res.status(422).json({ success: false, ...result });
    }

    res.json({ success: true, data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Pool Import Parse Error:', err);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * Check for time overlaps between sessions
 */
function checkTimeOverlap(
  newSession: ImportedPoolSession,
  existingSessions: { name: string; start_time: string; end_time: string }[]
): string | null {
  for (const existing of existingSessions) {
    // Simple overlap check - if sessions share any time
    const newStart = newSession.startTime;
    const newEnd = newSession.endTime;
    const existStart = existing.start_time;
    const existEnd = existing.end_time;

    if ((newStart >= existStart && newStart < existEnd) ||
        (newEnd > existStart && newEnd <= existEnd) ||
        (newStart <= existStart && newEnd >= existEnd)) {
      return `Overlaps with "${existing.name}" (${existStart}-${existEnd})`;
    }
  }
  return null;
}

/**
 * Commit pool sessions to database
 */
export const commitImport = asyncHandler(async (req: Request, res: Response) => {
  const { items, moduleId } = req.body as PoolCommitImportRequest;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ success: false, error: 'Missing required items array' });
  }

  const supabase = getSupabase();

  const results = {
    created: 0,
    failed: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  // Get existing sessions for overlap checking
  const { data: existingSessions } = await supabase
    .from('pool_sessions')
    .select('name, start_time, end_time');

  const importPromises = items.map(async (item: ImportedPoolSession) => {
    // Validate time format
    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(item.startTime) || !timeRegex.test(item.endTime)) {
      throw new Error('Invalid time format. Use HH:MM (24-hour format)');
    }

    // Check for overlaps
    if (existingSessions) {
      const overlap = checkTimeOverlap(item, existingSessions);
      if (overlap) {
        results.warnings.push(`${item.name}: ${overlap}`);
      }
    }

    // Use RPC function insert_pool_session if available, otherwise direct insert
    const { data, error } = await supabase
      .from('pool_sessions')
      .insert({
        name: item.name,
        start_time: item.startTime,
        end_time: item.endTime,
        price: String(item.adultPrice),
        adult_price: String(item.adultPrice),
        child_price: item.childPrice ? String(item.childPrice) : null,
        max_capacity: item.capacity,
        gender_restriction: item.genderRestriction,
        is_active: item.isActive !== undefined ? item.isActive : true,
        module_id: moduleId || null,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to create pool session');
    }

    return data;
  });

  const settleResults = await Promise.allSettled(importPromises);

  settleResults.forEach((res, idx) => {
    if (res.status === 'fulfilled') {
      results.created++;
    } else {
      results.failed++;
      const reason = res.reason instanceof Error ? res.reason.message : String(res.reason);
      results.errors.push(`${items[idx]?.name || `Session ${idx + 1}`}: ${reason}`);
    }
  });

  res.json({ success: true, data: results });
});
