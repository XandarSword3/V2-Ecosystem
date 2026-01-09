import { Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';

export const getThemeSettings = async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM theme_settings LIMIT 1');
    if (result.rows.length > 0) {
      res.json(result.rows);
    } else {
      res.status(404).json({ message: 'Theme settings not found' });
    }
  } catch (error) {
    logger.error('Error fetching theme settings:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateThemeSettings = async (req: Request, res: Response) => {
  const { primary_color, secondary_color, font_family, weather_widget_enabled, weather_widget_location } = req.body;
  try {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE theme_settings
       SET primary_color = $1, secondary_color = $2, font_family = $3, weather_widget_enabled = $4, weather_widget_location = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = (SELECT id FROM theme_settings LIMIT 1)
       RETURNING *`,
      [primary_color, secondary_color, font_family, weather_widget_enabled, weather_widget_location]
    );

    if (result.rows.length > 0) {
      res.json(result.rows);
    } else {
      res.status(404).json({ message: 'Theme settings not found for update' });
    }
  } catch (error) {
    logger.error('Error updating theme settings:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};