import { Request, Response, NextFunction } from 'express';
import * as tableService from "../services/table.service";

export async function getTables(req: Request, res: Response, next: NextFunction) {
  try {
    const tables = await tableService.getAllTables();
    res.json({ success: true, data: tables });
  } catch (error) {
    next(error);
  }
}

export async function createTable(req: Request, res: Response, next: NextFunction) {
  try {
    const { tableNumber, capacity } = req.body;
    
    // Validate required fields
    if (!tableNumber || capacity === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: tableNumber and capacity are required' 
      });
    }
    
    const table = await tableService.createTable(req.body);
    res.status(201).json({ success: true, data: table });
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

export async function updateTable(req: Request, res: Response, next: NextFunction) {
  try {
    const table = await tableService.updateTable(req.params.id, req.body);
    res.json({ success: true, data: table });
  } catch (error) {
    next(error);
  }
}

export async function deleteTable(req: Request, res: Response, next: NextFunction) {
  try {
    await tableService.deleteTable(req.params.id);
    res.json({ success: true, message: 'Table deleted' });
  } catch (error) {
    next(error);
  }
}
