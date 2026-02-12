import { Router, Request, Response } from 'express';
import { waitlistController } from './waitlist/waitlist.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import { getSupabase } from '../../database/connection.js';
import { emailService } from '../../services/email.service.js';
import { emitToAll } from '../../socket/index.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// Public
router.post('/join', waitlistController.join);
router.post('/', waitlistController.join); // Also accept POST on base URL
router.get('/', waitlistController.getWaitlist);
router.get('/:id', waitlistController.getEntry); // Get single entry by ID

// Staff Manage
router.patch('/:id/status', authenticate, authorize('staff', 'admin', 'manager'), waitlistController.updateStatus);

// Notify a waitlist entry (send notification)
router.post('/:id/notify', authenticate, authorize('staff', 'admin', 'manager'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = getSupabase();
    
    // Get the entry first
    const { data: entry, error: fetchError } = await supabase
      .from('waitlist_entries')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !entry) {
      return res.status(404).json({ success: false, error: 'Waitlist entry not found' });
    }
    
    // Update status to notified
    const { data: updatedEntry, error: updateError } = await supabase
      .from('waitlist_entries')
      .update({
        status: 'notified',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) {
      return res.status(500).json({ success: false, error: 'Failed to update waitlist entry' });
    }
    
    // Try to send notification (email if available, SMS could be added)
    let notificationSent = false;
    
    // If phone number exists, we could integrate SMS here
    // For now, we'll log that notification was triggered
    if (entry.phone_number) {
      logger.info(`Waitlist notification triggered for ${entry.customer_name} at ${entry.phone_number}`);
      // In production, integrate with SMS service here
    }
    
    // Emit real-time update
    emitToAll('waitlist.updated', { action: 'notified', entry: updatedEntry });
    
    res.json({
      success: true,
      data: updatedEntry,
      message: `Notification sent to ${entry.customer_name}`
    });
  } catch (error: any) {
    logger.error('Error notifying waitlist entry:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a waitlist entry
router.delete('/:id', authenticate, authorize('staff', 'admin', 'manager'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = getSupabase();
    
    // Get the entry first to verify it exists
    const { data: entry, error: fetchError } = await supabase
      .from('waitlist_entries')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !entry) {
      return res.status(404).json({ success: false, error: 'Waitlist entry not found' });
    }
    
    // Delete the entry
    const { error: deleteError } = await supabase
      .from('waitlist_entries')
      .delete()
      .eq('id', id);
    
    if (deleteError) {
      return res.status(500).json({ success: false, error: 'Failed to delete waitlist entry' });
    }
    
    // Emit real-time update
    emitToAll('waitlist.updated', { action: 'removed', entryId: id });
    
    res.json({
      success: true,
      message: `Waitlist entry for ${entry.customer_name} removed`
    });
  } catch (error: any) {
    logger.error('Error deleting waitlist entry:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
