# Legacy Modifier System Deprecation Strategy

## Overview

This document outlines the plan for deprecating the legacy modifier system in favor of the Unified Customization System introduced in Phase 1-5 of the customization unification project.

## Current State (Post Phase 5)

### Dual Runtime Architecture
The system now supports **both** customization systems simultaneously:

1. **Unified Customization System** (NEW)
   - Uses `customization_groups`, `customization_options`, `entity_customizations` tables
   - Frontend: `CustomizationSelector` component
   - Supports: add, remove, swap, upgrade, replace, select types
   - Inventory-integrated with `order_customizations` snapshots

2. **Legacy Modifier System** (DEPRECATING)
   - Uses `modifier_groups`, `modifier_options`, `menu_item_modifier_groups` tables
   - Frontend: `ModifierSelectionModal` component
   - Supports: add, remove, swap types only
   - No inventory integration

### Flow Decision Logic
```
User clicks menu item
    │
    ▼
Check unified customizations via /customizations/for-entity/menu_item/:id
    │
    ├─► Has unified groups? → Show CustomizationSelector
    │
    └─► No unified groups? → Check legacy modifiers → Show ModifierSelectionModal
```

## Migration Phases

### Phase A: Inventory Migration (Current)
**Status: ✅ READY**
- Unified system is active for items with assigned customization groups
- Staff view supports both formats seamlessly
- Order data compatible with both systems

### Phase B: Admin Migration Tool
**Status: ⏳ TODO**
Create an admin tool to:
1. **Analyze existing modifier groups** per menu item
2. **Generate equivalent customization groups** with proper types:
   - Legacy `add` → Unified `add`
   - Legacy `remove` → Unified `remove`  
   - Legacy `swap` → Unified `swap` or `replace`
3. **Create entity links** to menu items
4. **Validate migration** before committing

**Implementation:**
```typescript
// Admin endpoint: POST /api/admin/migrate-modifiers
interface MigrationRequest {
  menuItemId: string;
  dryRun?: boolean; // Preview without saving
}

interface MigrationResult {
  menuItemId: string;
  menuItemName: string;
  legacyGroups: number;
  unifiedGroupsCreated: number;
  optionsMigrated: number;
  warnings: string[];
}
```

### Phase C: Gradual Rollout (1-2 months)
**Strategy:**
1. Migrate high-traffic items first
2. Monitor order success rates
3. A/B test unified vs legacy for conversion
4. Staff feedback collection

**Rollout Checklist:**
- [ ] Migrate appetizers category
- [ ] Migrate main courses category
- [ ] Migrate beverages category
- [ ] Migrate desserts category
- [ ] Validate all categories in staging
- [ ] Production deployment per category

### Phase D: Feature Freeze on Legacy
**Status: ⏳ AFTER Phase C**
- No new features added to `ModifierSelectionModal`
- No new modifier groups created (admin UI warning)
- All new menu items must use unified system

### Phase E: Legacy Removal
**Status: ⏳ 3-6 months post Phase C**

**Prerequisites:**
- [ ] 100% menu items migrated
- [ ] No orders in last 30 days using legacy modifiers
- [ ] All historical data preserved in `order_customizations`
- [ ] Audit trail documented

**Removal Steps:**
1. **Frontend removal:**
   - Remove `ModifierSelectionModal` component
   - Remove legacy checks in `handleItemClick`
   - Remove `modifier_groups` API calls
   
2. **Backend removal:**
   - Archive legacy endpoints (return 410 Gone)
   - Remove `modifier.*` service methods
   - Drop legacy tables (after backup):
     - `modifier_groups`
     - `modifier_options`
     - `menu_item_modifier_groups`

3. **Type cleanup:**
   - Remove `modifierType` field from interfaces
   - Simplify `SelectedModifier` to unified format

## Data Preservation

### Order History
All historical orders store modifiers in `selected_modifiers` JSONB column.
This data is **immutable** and will continue to work regardless of system changes.

### Snapshot Approach
Future orders use `order_customizations` table for:
- Audit trail
- Inventory tracking
- Refund handling
- Analytics

### Migration SQL (for reference)
```sql
-- Migrate modifier groups to customization groups
INSERT INTO customization_groups (
  name, name_ar, description,
  selection_mode, min_selections, max_selections,
  is_required, sort_order, is_active
)
SELECT 
  name, name_ar, description,
  CASE 
    WHEN selection_type = 'single' THEN 'single'
    WHEN selection_type = 'multiple' THEN 'multiple'
    ELSE 'single'
  END,
  COALESCE(min_selections, 0),
  COALESCE(max_selections, 10),
  is_required,
  sort_order,
  is_active
FROM modifier_groups
WHERE is_active = true;

-- Migrate modifier options
INSERT INTO customization_options (
  group_id, name, name_ar, description,
  customization_type, price_adjustment, price_type,
  max_quantity, is_default, is_popular, is_available,
  sort_order
)
SELECT 
  cg.id,
  mo.name, mo.name_ar, mo.description,
  mo.modifier_type::text::customization_type,
  COALESCE(mo.price_adjustment, 0),
  'fixed'::price_type,
  1,
  mo.is_default,
  false,
  mo.is_available,
  mo.sort_order
FROM modifier_options mo
JOIN modifier_groups mg ON mo.group_id = mg.id
JOIN customization_groups cg ON cg.name = mg.name;

-- Create entity links
INSERT INTO entity_customizations (entity_type, entity_id, group_id, sort_order)
SELECT 
  'menu_item',
  mimg.catalog_item_id,
  cg.id,
  mimg.sort_order
FROM menu_item_modifier_groups mimg
JOIN modifier_groups mg ON mimg.group_id = mg.id
JOIN customization_groups cg ON cg.name = mg.name;
```

## Monitoring & Alerts

### Key Metrics to Track
1. **Conversion Rate** - Unified vs Legacy checkout completion
2. **Order Errors** - Failed orders by customization type
3. **Staff Feedback** - Kitchen readability scores
4. **Load Times** - CustomizationSelector vs ModifierSelectionModal

### Alert Thresholds
- Order error rate > 2% → Investigate immediately
- Conversion drop > 5% → Pause rollout
- Load time > 500ms → Performance review

## Rollback Plan

If issues arise during migration:

1. **Frontend Toggle:**
   ```typescript
   // In restaurant/page.tsx
   const USE_UNIFIED_CUSTOMIZATIONS = process.env.NEXT_PUBLIC_UNIFIED_CUSTOMIZATIONS === 'true';
   ```

2. **Database Preservation:**
   - Never drop legacy tables until Phase E complete
   - Keep migration scripts idempotent

3. **Order Compatibility:**
   - Both systems write to `selected_modifiers` in same format
   - No customer-facing changes if rollback needed

## Timeline

| Phase | Duration | Start Condition |
|-------|----------|-----------------|
| A (Current) | Complete | ✅ Done |
| B | 1-2 weeks | Admin approval |
| C | 4-8 weeks | Phase B complete |
| D | Immediate | Phase C 80% complete |
| E | 2 weeks | Phase C 100%, 30-day soak |

## Contacts

- **Tech Lead:** [Your Name]
- **Product Owner:** [PM Name]
- **Database Admin:** [DBA Name]

---

*Last Updated: [Current Date]*
*Document Version: 1.0*
