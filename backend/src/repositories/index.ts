// Barrel export — all repository classes and their associated types.

export { BaseRepository, type FindManyOptions, type Row } from './BaseRepository.js';

export {
  MenuRepository,
  MenuCategoryRepository,
  MenuItemRepository,
  type MenuCategory,
  type MenuItem,
} from './MenuRepository.js';

export {
  OrderRepository,
  RestaurantOrderRepository,
  OrderItemRepository,
  type RestaurantOrder,
  type RestaurantOrderItem,
} from './OrderRepository.js';

export {
  ChaletRepository,
  ChaletUnitRepository,
  ChaletBookingRepository,
  ChaletAddOnRepository,
  type Chalet,
  type ChaletBooking,
  type ChaletAddOn,
} from './ChaletRepository.js';

export {
  PoolRepository,
  PoolSessionRepository,
  PoolTicketRepository,
  type PoolSession,
  type PoolTicket,
} from './PoolRepository.js';

export {
  PaymentRepository,
  type Payment,
} from './PaymentRepository.js';

export {
  LoyaltyRepository,
  LoyaltyMemberRepository,
  LoyaltyTransactionRepository,
  LoyaltyRewardRepository,
  type LoyaltyMember,
  type LoyaltyTransaction,
  type LoyaltyReward,
} from './LoyaltyRepository.js';

export {
  InventoryRepository,
  InventoryItemRepository,
  InventoryTransactionRepository,
  type InventoryItem,
  type InventoryTransaction,
} from './InventoryRepository.js';

export {
  UserRepository,
  UserAccountRepository,
  RoleRepository,
  UserRoleRepository,
  type User,
  type Role,
  type UserRole,
} from './UserRepository.js';

export {
  ModuleRepository,
  ModuleItemRepository,
  EmailTemplateRepository,
  type Module,
  type EmailTemplate,
} from './ModuleRepository.js';
