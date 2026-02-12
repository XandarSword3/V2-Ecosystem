# Unified Customization System

## Overview

The Unified Customization System is a module-agnostic engine that provides customization capabilities for **ALL** modules in the V2 Resort platform. This includes current modules (Restaurant, Snack Bar, Chalets, Pool) and any future modules (Spa, Activities, Rentals, Events, etc.).

## Architecture

### Core Principles

1. **Module-Agnostic**: The system is not tied to any specific module. It works identically across all entity types.
2. **Extensible**: New entity types can be added without changing the core system.
3. **Inventory-Integrated**: Full integration with the inventory system for accurate stock tracking.
4. **Immutable Order Records**: All customization selections are stored as snapshots for audit and dispute resolution.
5. **Multi-language**: Full Arabic, French, and English support.

### Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CUSTOMIZATION SYSTEM                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────────┐    ┌─────────────────┐    ┌────────────────┐ │
│   │  Customization  │    │  Customization  │    │    Entity      │ │
│   │     Groups      │───▶│    Options      │    │ Customizations │ │
│   └─────────────────┘    └─────────────────┘    └────────────────┘ │
│          │                       │                      │           │
│          │                       ▼                      │           │
│          │              ┌─────────────────┐             │           │
│          └─────────────▶│    Order        │◀────────────┘           │
│                         │ Customizations  │                         │
│                         └─────────────────┘                         │
│                                  │                                   │
│                                  ▼                                   │
│                         ┌─────────────────┐                         │
│                         │   Inventory     │                         │
│                         │   Integration   │                         │
│                         └─────────────────┘                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Database Schema

### Tables

#### `customization_groups`
Stores customization groups (e.g., "Toppings", "Room Add-ons", "Pool Extras").

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Group name (English) |
| name_ar | TEXT | Group name (Arabic) |
| name_fr | TEXT | Group name (French) |
| description | TEXT | Description |
| display_name | TEXT | Customer-facing name |
| selection_mode | TEXT | 'single', 'multiple', or 'quantity' |
| min_selections | INTEGER | Minimum required selections |
| max_selections | INTEGER | Maximum allowed selections |
| is_required | BOOLEAN | Whether selection is required |
| applicable_entity_types | ARRAY | Which entity types can use this group |
| is_global | BOOLEAN | If true, applies to all entities of applicable types |
| is_available | BOOLEAN | Current availability |
| available_from | TIME | Time-based availability start |
| available_until | TIME | Time-based availability end |
| available_days | INTEGER[] | Day-based availability (0=Sunday) |
| display_conditions | JSONB | Conditional display rules |
| sort_order | INTEGER | Display order |

#### `customization_options`
Individual options within groups.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| group_id | UUID | Parent group reference |
| name | TEXT | Option name |
| customization_type | ENUM | 'add', 'remove', 'swap', 'upgrade', 'replace' |
| price_adjustment | DECIMAL | Price change when selected |
| price_type | TEXT | 'fixed', 'percentage', 'per_unit', 'per_night', 'per_person' |
| inventory_item_id | UUID | Linked inventory item |
| quantity_per_selection | DECIMAL | Inventory quantity per selection |
| replaces_inventory_item_id | UUID | For swap type: item to NOT deduct |
| max_quantity | INTEGER | Maximum quantity selectable |
| is_default | BOOLEAN | Pre-selected by default |
| is_popular | BOOLEAN | Shows "Popular" badge |
| badge_text | TEXT | Custom badge text |
| is_available | BOOLEAN | Current availability |
| available_stock | INTEGER | NULL = unlimited |

#### `entity_customizations`
Links groups to specific entities (many-to-many).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| entity_type | ENUM | Type of entity |
| entity_id | UUID | Entity's primary key |
| customization_group_id | UUID | Linked group |
| is_required_override | BOOLEAN | Override group's is_required |
| min_selections_override | INTEGER | Override min_selections |
| max_selections_override | INTEGER | Override max_selections |
| price_multiplier | DECIMAL | Scale prices for this entity |
| is_enabled | BOOLEAN | Enable/disable for this entity |
| sort_order | INTEGER | Display order for this entity |

#### `order_customizations`
Immutable snapshot of selections made in orders.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| order_type | TEXT | 'restaurant_order', 'chalet_booking', etc. |
| order_id | UUID | Order's primary key |
| order_item_id | UUID | Order item's primary key (nullable) |
| customization_group_id | UUID | Group reference |
| customization_option_id | UUID | Option reference |
| group_name | TEXT | Snapshot of group name |
| option_name | TEXT | Snapshot of option name |
| customization_type | TEXT | Snapshot of type |
| quantity | INTEGER | Selected quantity |
| unit_price_adjustment | DECIMAL | Price per unit at order time |
| total_price_adjustment | DECIMAL | Total price at order time |
| inventory_item_id | UUID | Inventory item deducted |
| inventory_quantity_used | DECIMAL | Amount deducted |
| inventory_deducted | BOOLEAN | Whether deduction was made |

### Entity Types

The system supports these entity types:

| Entity Type | Module | Description |
|-------------|--------|-------------|
| `menu_item` | Restaurant | Restaurant menu items |
| `snack_bar_item` | Snack Bar | Snack bar items |
| `chalet` | Chalets | Chalet/accommodation units |
| `pool_session` | Pool | Pool booking sessions |
| `spa_service` | Spa | Spa services (future) |
| `activity` | Activities | Excursions/activities (future) |
| `rental_item` | Rentals | Equipment rentals (future) |
| `event_ticket` | Events | Shows/events (future) |
| `room` | Hotel | Hotel rooms (future) |
| `package` | Packages | Bundled packages (future) |

To add a new entity type:
```sql
SELECT add_customizable_entity_type('new_entity_type');
```

## Customization Types

| Type | Description | Inventory Action | Price Action |
|------|-------------|------------------|--------------|
| `add` | Add extra item/ingredient | Deduct | Add to price |
| `remove` | Remove from recipe/package | Skip deduction | Optional discount |
| `swap` | Replace one item with another | Deduct new, skip old | Price of new item |
| `upgrade` | Premium version | Deduct upgrade item | Add upgrade price |
| `replace` | Full replacement | Deduct replacement | Replacement price |

## API Reference

### Customer-Facing Endpoints

#### Get Customizations for Entity
```
GET /api/v1/customizations/for-entity/:entityType/:entityId
```

Response:
```json
[
  {
    "groupId": "uuid",
    "groupName": "Toppings",
    "groupNameAr": "الإضافات",
    "displayName": "Choose your toppings",
    "selectionMode": "multiple",
    "minSelections": 0,
    "maxSelections": 5,
    "isRequired": false,
    "options": [
      {
        "id": "uuid",
        "name": "Extra Cheese",
        "customizationType": "add",
        "priceAdjustment": 2.00,
        "priceType": "fixed",
        "maxQuantity": 2,
        "isDefault": false,
        "isPopular": true,
        "isAvailable": true
      }
    ]
  }
]
```

#### Validate Selections
```
POST /api/v1/customizations/validate
```

Request:
```json
{
  "entityType": "menu_item",
  "entityId": "uuid",
  "selections": [
    { "groupId": "uuid", "optionId": "uuid", "quantity": 1 }
  ]
}
```

Response:
```json
{
  "isValid": true,
  "totalPriceAdjustment": 2.00,
  "validatedSelections": [...],
  "validationErrors": []
}
```

#### Get Order Customizations
```
GET /api/v1/customizations/orders/:orderType/:orderId
```

### Admin Endpoints

All admin endpoints require authentication with `admin` or `manager` role.

#### Groups CRUD
- `POST /api/v1/customizations/groups` - Create group
- `GET /api/v1/customizations/groups` - List groups
- `GET /api/v1/customizations/groups/:id` - Get group
- `PUT /api/v1/customizations/groups/:id` - Update group
- `DELETE /api/v1/customizations/groups/:id` - Delete group

#### Options CRUD
- `POST /api/v1/customizations/options` - Create option
- `GET /api/v1/customizations/groups/:groupId/options` - List options
- `PUT /api/v1/customizations/options/:id` - Update option
- `DELETE /api/v1/customizations/options/:id` - Delete option

#### Entity Linking
- `POST /api/v1/customizations/entity-links` - Link group to entity
- `GET /api/v1/customizations/entity-links?entityType=...&entityId=...` - Get links
- `PUT /api/v1/customizations/entity-links/:id` - Update link
- `DELETE /api/v1/customizations/entity-links/:id` - Remove link

#### Migration
- `POST /api/v1/customizations/migrate` - Migrate old menu modifiers

## Frontend Usage

### Basic Usage

```tsx
import { CustomizationSelector } from '@/components/customization';

function MenuItemCard({ item }) {
  const [showCustomizations, setShowCustomizations] = useState(false);
  
  return (
    <>
      <button onClick={() => setShowCustomizations(true)}>
        Add to Cart
      </button>
      
      <CustomizationSelector
        entityType="menu_item"
        entityId={item.id}
        entity={{
          name: item.name,
          nameAr: item.name_ar,
          basePrice: item.price,
          imageUrl: item.image_url,
        }}
        isOpen={showCustomizations}
        onClose={() => setShowCustomizations(false)}
        onConfirm={(data) => {
          // data.selections: ValidatedSelection[]
          // data.totalPriceAdjustment: number
          // data.lineTotal: number
          // data.quantity: number
          addToCart({
            itemId: item.id,
            quantity: data.quantity,
            customizations: data.selections,
            total: data.lineTotal,
          });
          setShowCustomizations(false);
        }}
      />
    </>
  );
}
```

### For Accommodations (Per-Night Pricing)

```tsx
<CustomizationSelector
  entityType="chalet"
  entityId={chalet.id}
  entity={{
    name: chalet.name,
    basePrice: chalet.price_per_night * numberOfNights,
  }}
  isOpen={isOpen}
  onClose={onClose}
  onConfirm={handleConfirm}
  priceContext="per_night"
  contextMultiplier={numberOfNights}
  showQuantitySelector={false}
/>
```

### Using Hooks

```tsx
import { 
  useEntityCustomizations, 
  useValidateCustomizations 
} from '@/components/customization';

function MyComponent({ entityType, entityId }) {
  const { data: groups, isLoading } = useEntityCustomizations(entityType, entityId);
  const validateMutation = useValidateCustomizations();
  
  const handleValidate = async (selections) => {
    const result = await validateMutation.mutateAsync({
      entityType,
      entityId,
      selections,
    });
    
    if (result.isValid) {
      // Proceed with order
    } else {
      // Show errors
    }
  };
  
  // ...
}
```

## Inventory Integration

### How Inventory Deduction Works

1. **Add Type**: Deducts `quantity_per_selection * selected_quantity * order_quantity` from inventory
2. **Remove Type**: Marks the item as "removed" - the base recipe will NOT deduct this ingredient
3. **Swap Type**: Deducts the new item, does NOT deduct the replaced item
4. **Upgrade Type**: Same as Add
5. **Replace Type**: Same as Add

### Example: Burger with No Cheese

Base recipe:
- 1x Bun
- 1x Patty
- 1x Cheese
- 1x Lettuce

Customer orders with "No Cheese" modifier:

Inventory deduction:
- ✅ Deduct 1x Bun
- ✅ Deduct 1x Patty
- ❌ Skip 1x Cheese (remove modifier)
- ✅ Deduct 1x Lettuce

### Example: Pizza with Extra Cheese

Base recipe:
- 1x Dough
- 1x Sauce
- 1x Cheese

Customer orders with "Extra Cheese" (add modifier, qty=2):

Inventory deduction:
- ✅ Deduct 1x Dough
- ✅ Deduct 1x Sauce
- ✅ Deduct 1x Cheese (base)
- ✅ Deduct 2x Cheese (modifier)

## Migration from Old System

To migrate existing menu modifiers to the unified system:

```bash
# Via API
curl -X POST http://localhost:3001/api/v1/customizations/migrate \
  -H "Authorization: Bearer <admin_token>"

# Or via SQL
SELECT * FROM migrate_menu_modifiers_to_unified();
```

This will:
1. Copy all `menu_modifier_groups` → `customization_groups`
2. Copy all `menu_modifier_options` → `customization_options`
3. Copy all `menu_item_modifiers` → `entity_customizations`

The old tables remain intact for backward compatibility.

## Best Practices

### Creating Groups

1. **Use descriptive display names**: "How would you like your steak cooked?" instead of "Doneness"
2. **Set appropriate min/max selections**: For required single-choice, use min=1, max=1
3. **Use is_global sparingly**: Only for truly universal options like "Special Instructions"

### Creating Options

1. **Always link to inventory**: Even if just for tracking
2. **Use appropriate types**: Don't use "add" for removals
3. **Set realistic max_quantity**: Consider inventory constraints

### Linking to Entities

1. **Use price multipliers for premium items**: e.g., 1.5x for premium chalets
2. **Override is_required thoughtfully**: Some items might not need certain customizations

## Troubleshooting

### Customizations Not Showing

1. Check `is_available` on both group and options
2. Verify `applicable_entity_types` includes your entity type
3. Check time-based availability (`available_from`, `available_until`)
4. Verify entity link exists in `entity_customizations`

### Inventory Not Deducting

1. Verify `inventory_item_id` is set on the option
2. Check `customization_type` - "remove" type doesn't deduct
3. Verify sufficient stock exists

### Validation Failing

1. Check selection counts against min/max
2. Verify all required groups have selections
3. Check option availability

## Future Enhancements

- [ ] Conditional options (show option B only if option A is selected)
- [ ] Time-limited promotions on customizations
- [ ] Customization bundles/combos
- [ ] AI-powered customization suggestions
- [ ] Customer preference learning
