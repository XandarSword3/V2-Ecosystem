import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { economicsService, DateRangeParams } from './economics.service.js';

const router = Router();

// Middleware to parse and validate common params
const parseParams = (req: Request): DateRangeParams => {
  const { from, to, propertyId, moduleId, engineType } = req.query;
  
  if (!from || !to) {
    throw new Error('Both "from" and "to" parameters are required.');
  }

  return {
    from: String(from),
    to: String(to),
    propertyId: propertyId ? String(propertyId) : undefined,
    moduleId: moduleId ? String(moduleId) : undefined,
    engineType: engineType ? String(engineType) : undefined,
  };
};

router.use(authenticate);
router.use(authorize('admin', 'manager'));

router.get('/revenue', asyncHandler(async (req: Request, res: Response) => {
  const params = parseParams(req);
  const interval = (req.query.interval as 'hour' | 'day' | 'week' | 'month') || 'day';
  const data = await economicsService.getRevenueOverTime({ ...params, interval });
  res.json({ success: true, data });
}));

router.get('/volume', asyncHandler(async (req: Request, res: Response) => {
  const params = parseParams(req);
  const interval = (req.query.interval as 'hour' | 'day' | 'week' | 'month') || 'day';
  const data = await economicsService.getTransactionVolume({ ...params, interval });
  res.json({ success: true, data });
}));

router.get('/peak-hours', asyncHandler(async (req: Request, res: Response) => {
  const params = parseParams(req);
  const data = await economicsService.getPeakHours(params);
  res.json({ success: true, data });
}));

router.get('/by-module', asyncHandler(async (req: Request, res: Response) => {
  const params = parseParams(req);
  const data = await economicsService.getRevenueByModule(params);
  res.json({ success: true, data });
}));

router.get('/by-engine', asyncHandler(async (req: Request, res: Response) => {
  const params = parseParams(req);
  const data = await economicsService.getRevenueByEngineType(params);
  res.json({ success: true, data });
}));

router.get('/gross-vs-net', asyncHandler(async (req: Request, res: Response) => {
  const params = parseParams(req);
  const data = await economicsService.getGrossVsNet(params);
  res.json({ success: true, data });
}));

router.get('/average-transaction-value', asyncHandler(async (req: Request, res: Response) => {
  const params = parseParams(req);
  const data = await economicsService.getAverageTransactionValue(params);
  res.json({ success: true, data });
}));

router.get('/top-customers', asyncHandler(async (req: Request, res: Response) => {
  const params = parseParams(req);
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
  const data = await economicsService.getTopCustomers({ ...params, limit });
  res.json({ success: true, data });
}));

router.get('/retention', asyncHandler(async (req: Request, res: Response) => {
  const params = parseParams(req);
  const data = await economicsService.getCustomerRetentionRate(params);
  res.json({ success: true, data });
}));

router.get('/repeat-vs-new', asyncHandler(async (req: Request, res: Response) => {
  const params = parseParams(req);
  const data = await economicsService.getRepeatVsNew(params);
  res.json({ success: true, data });
}));

router.get('/staff-performance', asyncHandler(async (req: Request, res: Response) => {
  const params = parseParams(req);
  
  const [performance, cancellations] = await Promise.all([
    economicsService.getStaffPerformance(params),
    economicsService.getCancellationsByStaff(params)
  ]);
  
  // Merge performance and cancellations
  const data = performance.map((p: any) => {
    const cancelData = cancellations.find((c: any) => c.staff_id === p.staff_id);
    return {
      ...p,
      cancellationRate: cancelData ? cancelData.cancellationRate : 0,
    };
  });
  
  res.json({ success: true, data });
}));

router.get('/cross-module-patterns', asyncHandler(async (req: Request, res: Response) => {
  const params = parseParams(req);
  const data = await economicsService.getCrossModulePatterns(params);
  res.json({ success: true, data });
}));

router.get('/slow-periods', asyncHandler(async (req: Request, res: Response) => {
  const params = parseParams(req);
  const data = await economicsService.getSlowPeriods(params);
  res.json({ success: true, data });
}));

router.get('/promo-effectiveness', asyncHandler(async (req: Request, res: Response) => {
  const params = parseParams(req);
  const data = await economicsService.getPromoEffectiveness(params);
  res.json({ success: true, data });
}));

router.get('/cancellation-patterns', asyncHandler(async (req: Request, res: Response) => {
  const params = parseParams(req);
  const data = await economicsService.getCancellationPatterns(params);
  res.json({ success: true, data });
}));

export const economicsRoutes = router;
export default router;
