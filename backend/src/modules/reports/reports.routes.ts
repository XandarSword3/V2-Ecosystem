import { Router } from 'express';
import { reportsController } from './reports.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

const adminAuth = [authenticate, authorize('admin', 'super_admin', 'manager')];

// ============================================
// 1. EXECUTIVE OVERVIEW (Landing Dashboard)
// ============================================
router.get('/executive-overview', ...adminAuth, reportsController.getExecutiveOverview.bind(reportsController));

// ============================================
// 2. SALES & REVENUE ANALYTICS
// ============================================
router.get('/daily-sales', ...adminAuth, reportsController.getDailySalesReport.bind(reportsController));
router.get('/hourly-metrics', ...adminAuth, reportsController.getHourlyMetrics.bind(reportsController));
router.get('/cash-card-variance', ...adminAuth, reportsController.getCashCardVariance.bind(reportsController));

// ============================================
// 3. ORDER FLOW & OPERATIONS
// ============================================
router.get('/order-flow', ...adminAuth, reportsController.getOrderFlow.bind(reportsController));

// ============================================
// 4. CUSTOMER INTELLIGENCE
// ============================================
router.get('/customer-intelligence', ...adminAuth, reportsController.getCustomerIntelligence.bind(reportsController));
router.get('/cohort-analysis', ...adminAuth, reportsController.getCohortAnalysis.bind(reportsController));

// ============================================
// 5. PRODUCT & MENU PERFORMANCE
// ============================================
router.get('/product-performance', ...adminAuth, reportsController.getProductPerformance.bind(reportsController));
router.get('/menu-performance', ...adminAuth, reportsController.getMenuPerformance.bind(reportsController));

// ============================================
// 6. PAYMENTS & FINANCE
// ============================================
router.get('/payments-finance', ...adminAuth, reportsController.getPaymentsFinance.bind(reportsController));
router.get('/stripe-reconciliation', ...adminAuth, reportsController.getStripeReconciliation.bind(reportsController));

// ============================================
// 7. CAPACITY & UTILIZATION
// ============================================
router.get('/capacity-utilization', ...adminAuth, reportsController.getCapacityUtilization.bind(reportsController));

// ============================================
// 8. STAFF & SYSTEM PERFORMANCE
// ============================================
router.get('/staff-performance', ...adminAuth, reportsController.getStaffPerformance.bind(reportsController));

// ============================================
// 9. COMPARATIVE & TREND ANALYSIS
// ============================================
router.get('/comparative-analysis', ...adminAuth, reportsController.getComparativeAnalysis.bind(reportsController));
router.get('/time-series', ...adminAuth, reportsController.getTimeSeries.bind(reportsController));

// ============================================
// 10. EXPORT & AUDIT
// ============================================
router.get('/audit', ...adminAuth, reportsController.getAuditReport.bind(reportsController));
router.get('/export', ...adminAuth, reportsController.exportReport.bind(reportsController));
router.get('/export-comprehensive', ...adminAuth, reportsController.exportComprehensiveReport.bind(reportsController));

// ============================================
// Aggregation & Maintenance
// ============================================
router.post('/trigger-aggregation', ...adminAuth, reportsController.triggerDailyAggregation.bind(reportsController));

export default router;
