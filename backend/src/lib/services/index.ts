/**
 * Services Index
 * 
 * Export all injectable services from a single location.
 */

export { PoolServiceError, createPoolService } from './pool.service.js';
export type { PoolService, PoolServiceDeps, PurchaseTicketInput, PurchaseTicketResult } from './pool.service.js';

export { AuthServiceError, createAuthService } from './auth.service.js';
export type { AuthService, AuthServiceDependencies, RegisterData, LoginData, AuthResult, TokenPayload } from './auth.service.js';

export { OrderServiceError, createOrderService } from './order.service.js';
export type { OrderService, OrderServiceDependencies, CreateOrderInput, OrderResult } from './order.service.js';

export { BookingServiceError, createBookingService } from './booking.service.js';
export type { BookingService, BookingServiceDeps, CreateBookingInput, BookingResult } from './booking.service.js';

export { MenuServiceError, createMenuService } from './menu.service.js';
export type { MenuService, MenuServiceDeps, CreateCategoryInput, UpdateCategoryInput, CreateMenuItemInput, UpdateMenuItemInput } from './menu.service.js';

export { ReviewServiceError, createReviewService } from './review.service.js';
export type { ReviewService, ReviewServiceDeps, CreateReviewInput } from './review.service.js';

export { SnackServiceError, createSnackService } from './snack.service.js';
export type { SnackService, SnackServiceDeps, CreateSnackItemInput, UpdateSnackItemInput, CreateSnackOrderInput } from './snack.service.js';

export { EmailServiceError, createEmailService, createMockEmailTransporter, createInMemoryTemplateRepository } from './email.service.js';
export type { EmailTransporter, EmailTemplate, SiteSettings, EmailTemplateRepository, EmailServiceDependencies, OrderConfirmationData, BookingConfirmationData, SentEmail } from './email.service.js';

export { SupportServiceError, createSupportService } from './support.service.js';
export type { SupportService, SupportServiceDeps, ContactFormInput, CreateFAQInput, UpdateFAQInput } from './support.service.js';

export { UserServiceError, createUserService } from './user.service.js';
export type { UserService, UserServiceDeps, UpdateProfileInput, PaginationParams } from './user.service.js';

export { SettingsServiceError, createSettingsService } from './settings.service.js';

export { AuditServiceError, createAuditService } from './audit.service.js';
export type { AuditService, AuditServiceDependencies, LogActivityInput, GetLogsParams } from './audit.service.js';

export { NotificationServiceError, createNotificationService } from './notification.service.js';
export type { NotificationService, NotificationServiceDependencies, CreateNotificationInput, BroadcastInput, CreateTemplateInput } from './notification.service.js';

export { createPaymentService } from './payment.service.js';
export type { PaymentService, CreatePaymentInput, ProcessPaymentInput, RefundInput, PaymentListOptions, PaymentStats } from './payment.service.js';

export { ReportingServiceError, createReportingService } from './reporting.service.js';
export type { ReportingService, DashboardSummary, ReportExportOptions, GeneratedReport } from './reporting.service.js';

export { InventoryServiceError, createInventoryService } from './inventory.service.js';
export type { InventoryService, CreateItemInput, UpdateItemInput, StockAdjustmentInput, InventoryValuation } from './inventory.service.js';

export { CouponServiceError, createCouponService } from './coupon.service.js';
export type { CouponService, CreateCouponInput, UpdateCouponInput, ApplyCouponInput, CouponStats } from './coupon.service.js';

export { LoyaltyServiceError, createLoyaltyService } from './loyalty.service.js';
export type { LoyaltyService, EarnPointsInput, RedeemPointsInput, BonusPointsInput, LoyaltyStats } from './loyalty.service.js';

export { WaitlistServiceError, createWaitlistService } from './waitlist.service.js';
export type { WaitlistService, AddToWaitlistInput, UpdateWaitlistInput, SeatGuestInput, WaitlistPosition } from './waitlist.service.js';

export { ShiftServiceError, createShiftService } from './shift.service.js';
export type { ShiftService, CreateShiftInput, UpdateShiftInput, SwapRequestInput, StaffSchedule, ShiftStats } from './shift.service.js';

export { TaskServiceError, createTaskService } from './task.service.js';
export type { TaskService, CreateTaskInput, UpdateTaskInput, AssignTaskInput, CompleteTaskInput, AddCommentInput, TaskStats } from './task.service.js';

export { GuestServiceError, createGuestService } from './guest.service.js';
export type { GuestService, CreateGuestInput, UpdateGuestInput, RecordVisitInput, GuestStats } from './guest.service.js';

export { RateServiceError, createRateService } from './rate.service.js';
export type { RateService, CreateRateInput, UpdateRateInput, AddModifierInput, CalculatePriceInput, RateStats } from './rate.service.js';

export { EventServiceError, createEventService } from './event.service.js';
export type { EventService, CreateVenueInput, UpdateVenueInput, CreateEventInput, UpdateEventInput, EventStats } from './event.service.js';

export { MaintenanceServiceError, createMaintenanceService } from './maintenance.service.js';
export type { MaintenanceService, CreateWorkOrderInput, UpdateWorkOrderInput, AddPartInput, CompleteWorkOrderInput, MaintenanceStats } from './maintenance.service.js';

export { HousekeepingServiceError, createHousekeepingService } from './housekeeping.service.js';
export type { 
  HousekeepingService, 
  CreateTaskInput as CreateHousekeepingTaskInput, 
  UpdateTaskInput as UpdateHousekeepingTaskInput, 
  CreateSupplyInput, 
  HousekeepingStats 
} from './housekeeping.service.js';

export { ChannelServiceError, createChannelService } from './channel.service.js';
export type { 
  ChannelService, 
  CreateChannelInput, 
  UpdateChannelInput, 
  CreateRateInput as CreateChannelRateInput, 
  CreateReservationInput as CreateChannelReservationInput, 
  ChannelStats 
} from './channel.service.js';

export { FeedbackServiceError, createFeedbackService } from './feedback.service.js';
export type { FeedbackService, SubmitFeedbackInput, RespondToFeedbackInput, CreateQuestionInput, SubmitResponseInput, FeedbackStats } from './feedback.service.js';

export { PackageServiceError, createPackageService } from './package.service.js';
export type { PackageService, CreatePackageInput, UpdatePackageInput, RedeemPackageInput, PackageStats } from './package.service.js';

export { DocumentServiceError, createDocumentService } from './document.service.js';
export type { DocumentService, UploadDocumentInput, UpdateDocumentInput, CreateVersionInput, DocumentStats } from './document.service.js';

export { AnalyticsServiceError, createAnalyticsService } from './analytics.service.js';
export type { AnalyticsService, RecordMetricInput, CreateDashboardInput, UpdateDashboardInput, CreateWidgetInput, PerformanceSummary } from './analytics.service.js';

export { createWeatherService } from './weather.service.js';
export type { RecordWeatherInput, UpdateWeatherInput, CreateAlertInput, CreateActivityInput, UpdateActivityInput, WeatherServiceResult } from './weather.service.js';

export { createCurrencyService } from './currency.service.js';
export type { CreateCurrencyInput, UpdateCurrencyInput, SetExchangeRateInput, ConvertCurrencyInput, ConversionResult, CurrencyServiceResult } from './currency.service.js';

export { createGiftCardService } from './giftcard.service.js';
export type { PurchaseGiftCardInput, RedeemGiftCardInput, RefundGiftCardInput, AdjustBalanceInput, GiftCardServiceResult } from './giftcard.service.js';

export { createMembershipService } from './membership.service.js';
export type { CreatePlanInput, UpdatePlanInput, EnrollMemberInput, RenewMembershipInput, MembershipServiceResult } from './membership.service.js';

export { createPromotionService } from './promotion.service.js';
export type { CreatePromotionInput, UpdatePromotionInput, ApplyPromotionInput, DiscountResult, PromotionServiceResult } from './promotion.service.js';

export { createReservationService } from './reservation.service.js';
export type { CreateReservationInput, UpdateReservationInput, ReservationService } from './reservation.service.js';

export { createInvoiceService } from './invoice.service.js';
export type { CreateInvoiceInput, AddLineItemInput, RecordPaymentInput, InvoiceService } from './invoice.service.js';
export { createAmenityService } from './amenity.service.js';
export type { 
  CreateAmenityInput, 
  UpdateAmenityInput, 
  CreateReservationInput as CreateAmenityReservationInput, 
  AmenityService 
} from './amenity.service.js';