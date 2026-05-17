/**
 * Module Templates Routes
 * GET /templates — list all (optionally filter by engine_type)
 * GET /templates/:id — get single template
 * POST /templates — create custom template (admin)
 * POST /templates/:id/apply — apply template to create module (admin)
 * DELETE /templates/:id — soft-delete custom template (admin)
 */

import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import * as templatesService from './templates.service.js';

const router = Router();

router.use(authenticate);

// List templates (any authenticated user)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const engineType = req.query.engine_type ? String(req.query.engine_type) : undefined;
  const templates = await templatesService.listTemplates(engineType);
  res.json({ success: true, data: templates });
}));

// Get single template
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const template = await templatesService.getTemplate(req.params.id);
  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  res.json({ success: true, data: template });
}));

// Create custom template (admin only)
router.post('/', authorize('admin', 'super_admin'), asyncHandler(async (req: Request, res: Response) => {
  const { name, description, engine_type, category, layout, default_settings, seed_data } = req.body;

  if (!name || !engine_type || !layout) {
    res.status(400).json({ error: 'name, engine_type, and layout are required' });
    return;
  }

  const template = await templatesService.createTemplate({
    name,
    description,
    engine_type,
    category,
    layout,
    default_settings,
    seed_data,
    created_by: req.user?.id,
  });

  res.status(201).json({ success: true, data: template });
}));

// Apply template to create a new module
router.post('/:id/apply', authorize('admin', 'super_admin'), asyncHandler(async (req: Request, res: Response) => {
  const { property_id, module_name, settings_overrides } = req.body;

  if (!property_id || !module_name) {
    res.status(400).json({ error: 'property_id and module_name are required' });
    return;
  }

  const result = await templatesService.applyTemplate(
    req.params.id,
    property_id,
    module_name,
    settings_overrides
  );

  res.status(201).json({ success: true, data: result, message: 'Module created from template' });
}));

// Soft-delete custom template (admin only)
router.delete('/:id', authorize('admin', 'super_admin'), asyncHandler(async (req: Request, res: Response) => {
  await templatesService.deleteTemplate(req.params.id);
  res.json({ success: true, message: 'Template deleted' });
}));

export default router;
