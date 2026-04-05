import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import * as tableService from "../services/table.service";

// Helper to map DB response to Frontend model
const mapTableToResponse = (table: any) => ({
  ...table,
  is_available: table.is_active
});

export const getTables = asyncHandler(async (req: Request, res: Response) => {
  const tables = await tableService.getAllTables();
  const mappedTables = tables.map(mapTableToResponse);
  res.json({ success: true, data: mappedTables });
});

export async function createTable(req: Request, res: Response, next: NextFunction) {
  try {
    console.log('[Table Controller] Request body:', JSON.stringify(req.body));

    // Handle both camelCase and snake_case from frontend
    const tableNumber = req.body.tableNumber ?? req.body.table_number;
    const capacity = req.body.capacity;
    const location = req.body.location;

    console.log('[Table Controller] Parsed values:', { tableNumber, capacity, location });

    // Validate required fields
    if (!tableNumber || capacity === undefined) {
      console.log('[Table Controller] Validation failed - missing fields');
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: tableNumber and capacity are required'
      });
    }

    // Normalize to what service expects
    const normalizedData = {
      tableNumber: String(tableNumber),
      capacity: parseInt(String(capacity)),
      location: location || null,
    };

    console.log('[Table Controller] Normalized data:', normalizedData);

    const table = await tableService.createTable(normalizedData);
    console.log('[Table Controller] Table created:', table);
    res.status(201).json({ success: true, data: mapTableToResponse(table) });
  } catch (error: unknown) {
    const err = error as Error & { code?: string };
    // Handle duplicate table number
    if (err.code === '23505' || err.message?.includes('duplicate')) {
      return res.status(400).json({
        success: false,
        message: 'Table number already exists'
      });
    }
    next(error);
  }
}

export const updateTable = asyncHandler(async (req: Request, res: Response) => {
  const updateData = {
    ...req.body,
    // Map frontend is_available to backend isActive if present
    isActive: req.body.is_available !== undefined ? req.body.is_available : req.body.isActive
  };

  const table = await tableService.updateTable(req.params.id, updateData);
  res.json({ success: true, data: mapTableToResponse(table) });
});

export const deleteTable = asyncHandler(async (req: Request, res: Response) => {
  await tableService.deleteTable(req.params.id);
  res.json({ success: true, message: 'Table deleted' });
});

export const getTableQRCode = asyncHandler(async (req: Request, res: Response) => {
  const result = await tableService.getTableQRCode(req.params.id);
  if (!result) {
    return res.status(404).json({ success: false, error: 'Table not found' });
  }
  res.json({ success: true, data: result });
});
