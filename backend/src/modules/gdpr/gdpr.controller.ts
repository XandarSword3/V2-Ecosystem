import { Request, Response } from 'express';
import * as gdprService from './gdpr.service.js';

// ==================== DATA EXPORT ====================

export async function requestExport(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const email = req.user?.email;

    if (!userId || !email) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const exportRequest = await gdprService.requestDataExport(
      userId,
      email,
      req.ip,
      req.headers['user-agent']
    );

    // Queue processing (in production, use a job queue like Bull)
    setImmediate(() => {
      gdprService.processExportRequest(exportRequest.id).catch(console.error);
    });

    res.status(202).json({
      success: true,
      message: 'Export request submitted. You will receive a notification when ready.',
      request_id: exportRequest.id,
      status: exportRequest.status
    });
  } catch (error: any) {
    console.error('GDPR export error detail:', error);
    const message = error?.message || (typeof error === 'string' ? error : 'Failed to request export');
    res.status(400).json({ error: message, details: error?.details || error?.hint || undefined });
  }
}

export async function getExportStatus(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const requests = await gdprService.getExportRequests(userId);

    res.json({
      success: true,
      requests
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get export status';
    res.status(500).json({ error: message });
  }
}

export async function downloadExport(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const { requestId } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const fileContent = await gdprService.getExportFile(requestId, userId);

    if (!fileContent) {
      res.status(404).json({ error: 'Export not found or expired' });
      return;
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="gdpr-export-${requestId}.zip"`);
    res.send(fileContent);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to download export';
    res.status(500).json({ error: message });
  }
}

// ==================== DATA DELETION ====================

export async function requestDeletion(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const email = req.user?.email;
    const { reason, categories } = req.body;

    if (!userId || !email) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!reason) {
      res.status(400).json({ error: 'Reason is required for deletion request' });
      return;
    }

    const deletionRequest = await gdprService.requestDataDeletion(
      userId,
      email,
      reason,
      categories || ['all'],
      req.ip,
      req.headers['user-agent']
    );

    res.status(202).json({
      success: true,
      message: 'Deletion request submitted. It will be reviewed by our team.',
      request_id: deletionRequest.id,
      status: deletionRequest.status,
      retention_exceptions: deletionRequest.retention_exceptions
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to request deletion';
    res.status(400).json({ error: message });
  }
}

export async function getDeletionStatus(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const requests = await gdprService.getDeletionRequests(userId);

    res.json({
      success: true,
      requests
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get deletion status';
    res.status(500).json({ error: message });
  }
}

// Admin: Approve deletion request
export async function approveDeletion(req: Request, res: Response): Promise<void> {
  try {
    const adminId = req.user?.id;
    const { requestId } = req.params;

    if (!adminId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const request = await gdprService.approveDeletionRequest(requestId, adminId);

    // Queue processing
    setImmediate(() => {
      gdprService.processApprovedDeletions().catch(console.error);
    });

    res.json({
      success: true,
      message: 'Deletion request approved and queued for processing',
      request
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to approve deletion';
    res.status(400).json({ error: message });
  }
}

// Admin: Reject deletion request
export async function rejectDeletion(req: Request, res: Response): Promise<void> {
  try {
    const adminId = req.user?.id;
    const { requestId } = req.params;
    const { rejection_reason } = req.body;

    if (!adminId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!rejection_reason) {
      res.status(400).json({ error: 'Rejection reason is required' });
      return;
    }

    const request = await gdprService.rejectDeletionRequest(requestId, adminId, rejection_reason);

    res.json({
      success: true,
      message: 'Deletion request rejected',
      request
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reject deletion';
    res.status(400).json({ error: message });
  }
}

// Admin: List all deletion requests
export async function listDeletionRequests(req: Request, res: Response): Promise<void> {
  try {
    const requests = await gdprService.getDeletionRequests();

    res.json({
      success: true,
      requests
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list deletion requests';
    res.status(500).json({ error: message });
  }
}

// ==================== CONSENT MANAGEMENT ====================

export async function getConsents(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const consents = await gdprService.getConsents(userId);

    // Return structured consent object
    const consentMap: Record<string, boolean> = {};
    for (const consent of consents) {
      consentMap[consent.consent_type] = consent.granted;
    }

    res.json({
      success: true,
      consents: consentMap,
      details: consents
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get consents';
    res.status(500).json({ error: message });
  }
}

export async function updateConsent(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const { consent_type, granted } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!consent_type || typeof granted !== 'boolean') {
      res.status(400).json({ error: 'consent_type and granted (boolean) are required' });
      return;
    }

    const consent = await gdprService.updateConsent(
      userId,
      consent_type,
      granted,
      'settings',
      req.ip,
      req.headers['user-agent']
    );

    res.json({
      success: true,
      message: `Consent ${granted ? 'granted' : 'withdrawn'} successfully`,
      consent
    });
  } catch (error: any) {
    console.error('GDPR consent error detail:', error);
    const message = error?.message || (typeof error === 'string' ? error : 'Failed to update consent');
    res.status(400).json({ error: message, details: error?.details || error?.hint || undefined });
  }
}

export async function updateMultipleConsents(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const { consents } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!Array.isArray(consents)) {
      res.status(400).json({ error: 'consents array is required' });
      return;
    }

    const results = await gdprService.updateMultipleConsents(
      userId,
      consents,
      'settings',
      req.ip,
      req.headers['user-agent']
    );

    res.json({
      success: true,
      message: 'Consents updated successfully',
      consents: results
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update consents';
    res.status(400).json({ error: message });
  }
}

// ==================== RETENTION POLICIES ====================

export async function getRetentionPolicies(req: Request, res: Response): Promise<void> {
  try {
    const policies = await gdprService.getRetentionPolicies();

    res.json({
      success: true,
      policies
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get retention policies';
    res.status(500).json({ error: message });
  }
}

export async function updateRetentionPolicy(req: Request, res: Response): Promise<void> {
  try {
    const { policyId } = req.params;
    const updates = req.body;

    const policy = await gdprService.updateRetentionPolicy(policyId, updates);

    res.json({
      success: true,
      policy
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update retention policy';
    res.status(400).json({ error: message });
  }
}

// ==================== PROCESSING LOG ====================

export async function getProcessingLog(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.roles?.includes('admin') || req.user?.roles?.includes('super_admin');
    const { user_id, limit } = req.query;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Non-admins can only see their own log
    const targetUserId = isAdmin && user_id ? String(user_id) : userId;
    const logLimit = limit ? parseInt(String(limit), 10) : 100;

    const log = await gdprService.getProcessingLog(targetUserId, logLimit);

    res.json({
      success: true,
      log
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get processing log';
    res.status(500).json({ error: message });
  }
}

// ==================== DATA SHARING ====================

export async function getDataSharingLog(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const log = await gdprService.getDataSharingLog(userId);

    res.json({
      success: true,
      log
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get data sharing log';
    res.status(500).json({ error: message });
  }
}

// ==================== ADMIN CLEANUP ====================

export async function triggerRetentionCleanup(req: Request, res: Response): Promise<void> {
  try {
    const result = await gdprService.runRetentionCleanup();

    res.json({
      success: true,
      message: 'Retention cleanup completed',
      result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to run retention cleanup';
    res.status(500).json({ error: message });
  }
}

export async function cleanupExpiredExports(req: Request, res: Response): Promise<void> {
  try {
    const cleaned = await gdprService.cleanupExpiredExports();

    res.json({
      success: true,
      message: `Cleaned up ${cleaned} expired exports`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to cleanup exports';
    res.status(500).json({ error: message });
  }
}

// ==================== PRIVACY DASHBOARD ====================

export async function getPrivacyDashboard(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Get all privacy-related data for the user
    const [consents, exportRequests, deletionRequests, dataSharing, processingLog] = await Promise.all([
      gdprService.getConsents(userId),
      gdprService.getExportRequests(userId),
      gdprService.getDeletionRequests(userId),
      gdprService.getDataSharingLog(userId),
      gdprService.getProcessingLog(userId, 20)
    ]);

    const retentionPolicies = await gdprService.getRetentionPolicies();

    res.json({
      success: true,
      dashboard: {
        consents,
        export_requests: exportRequests,
        deletion_requests: deletionRequests,
        data_sharing: dataSharing,
        recent_activity: processingLog,
        retention_policies: retentionPolicies
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get privacy dashboard';
    res.status(500).json({ error: message });
  }
}
