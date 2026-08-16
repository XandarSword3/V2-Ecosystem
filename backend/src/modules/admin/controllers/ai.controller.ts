import { Request, Response } from 'express';
import crypto from 'crypto';
import { asyncHandler } from '../../../middleware/async-handler';
import { getSupabase } from '../../../database/connection';
import { getAIProvider } from '../../../ai/ai-provider.factory';
import { AIFeatureNotConfiguredError } from '../../../ai/providers/disabled-ai-provider';

function hashPrompt(prompt: string): string {
  return crypto.createHash('sha256').update(prompt).digest('hex');
}

/**
 * POST /admin/ai/generate-layout
 */
export const generateLayout = asyncHandler(async (req: Request, res: Response) => {
  const { prompt, context } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Prompt parameter is required and must be a string',
    });
  }

  const tenantId = (req as any).tenantId || context?.tenantId || 'default';
  const propertyId = (req as any).propertyId || context?.propertyId || 'default';
  const promptHash = hashPrompt(prompt);
  const promptLength = prompt.length;

  // Log privacy audit entry (raw prompt is NEVER stored)
  try {
    const supabase = getSupabase();
    await supabase.from('ai_generation_requests').insert({
      tenant_id: tenantId,
      property_id: propertyId,
      request_type: 'layout_draft',
      prompt_hash: promptHash,
      prompt_length: promptLength,
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (err) {
    // Audit table insertion failure should not hard-block request execution
    console.warn('[AIController] Audit log insertion skipped:', (err as Error).message);
  }

  try {
    const provider = getAIProvider();
    const result = await provider.generateLayoutDraft(prompt, {
      tenantId,
      propertyId,
      brandTokens: context?.brandTokens,
      engineType: context?.engineType,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof AIFeatureNotConfiguredError) {
      return res.status(503).json({
        success: false,
        code: 'AI_FEATURE_DISABLED',
        message: error.message,
      });
    }
    throw error;
  }
});

/**
 * POST /admin/ai/generate-alt-text
 */
export const generateAltText = asyncHandler(async (req: Request, res: Response) => {
  const { imageUrl } = req.body;

  if (!imageUrl || typeof imageUrl !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'imageUrl parameter is required and must be a string',
    });
  }

  const tenantId = (req as any).tenantId || 'default';
  const propertyId = (req as any).propertyId || 'default';

  // Audit log entry
  try {
    const supabase = getSupabase();
    await supabase.from('ai_generation_requests').insert({
      tenant_id: tenantId,
      property_id: propertyId,
      request_type: 'alt_text',
      prompt_hash: hashPrompt(imageUrl),
      prompt_length: imageUrl.length,
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (err) {
    console.warn('[AIController] Audit log insertion skipped:', (err as Error).message);
  }

  try {
    const provider = getAIProvider();
    const altText = await provider.generateAltText(imageUrl);

    return res.json({
      success: true,
      data: { altText },
    });
  } catch (error) {
    if (error instanceof AIFeatureNotConfiguredError) {
      return res.status(503).json({
        success: false,
        code: 'AI_FEATURE_DISABLED',
        message: error.message,
      });
    }
    throw error;
  }
});
