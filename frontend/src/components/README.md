# Frontend Components Library

Reusable React components for the V2 Resort Management Platform.

## Directory Structure

```
components/
├── admin/              # Admin dashboard components
├── effects/            # Visual effects and animations
├── layout/             # Page layout components
├── module-builder/     # Visual module builder
├── modules/            # Business module components
├── settings/           # Settings panels
└── ui/                 # Base UI components
```

## Base UI Components (`ui/`)

Foundational components built with Tailwind CSS:

| Component | Description |
|-----------|-------------|
| `Button` | Primary, secondary, danger, ghost variants |
| `Input` | Text input with validation states |
| `Select` | Dropdown select with search |
| `Modal` | Dialog/popup with backdrop |
| `Card` | Content container with shadow |
| `Badge` | Status indicators |
| `Tabs` | Tab navigation |
| `Table` | Data table with sorting |
| `Skeleton` | Loading placeholders |
| `Toast` | Notification toasts (via Sonner) |

### Usage Example

```tsx
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

function MyComponent() {
  return (
    <Modal open={isOpen} onClose={handleClose}>
      <Input label="Name" value={name} onChange={setName} />
      <Button variant="primary" onClick={handleSubmit}>
        Save
      </Button>
    </Modal>
  );
}
```

## Layout Components (`layout/`)

Page structure components:

| Component | Description |
|-----------|-------------|
| `Header` | Main navigation header |
| `Footer` | Site footer |
| `Sidebar` | Admin/staff sidebar navigation |
| `MainLayout` | Customer page wrapper |
| `AdminLayout` | Admin dashboard wrapper |
| `StaffLayout` | Staff interface wrapper |

## Admin Components (`admin/`)

Admin dashboard specific:

| Component | Description |
|-----------|-------------|
| `DashboardStats` | KPI cards |
| `UserTable` | User management table |
| `ModuleCard` | Module configuration card |
| `AuditLog` | Activity log viewer |
| `SettingsForm` | System settings form |
| `LiveUsersPanel` | Real-time user tracking |

## Module Builder (`module-builder/`)

Visual UI builder for dynamic modules:

| Component | Description |
|-----------|-------------|
| `ModuleBuilder` | Main builder interface |
| `ComponentPalette` | Draggable component library |
| `Canvas` | Drop zone for components |
| `PropertyPanel` | Component property editor |
| `DynamicModuleRenderer` | Runtime module renderer |
| `BlockRenderer` | Individual block renderer |

### Block Types

The module builder supports these block types:

- `hero` - Hero banner with background image
- `container` - Flex container for layout
- `grid` - CSS grid layout
- `text_block` - Rich text content
- `image` - Image display
- `menu_list` - Dynamic menu items (for restaurants)
- `session_list` - Session booking (for pools)
- `booking_calendar` - Date range picker (for chalets)

## Effects Components (`effects/`)

Visual enhancements:

| Component | Description |
|-----------|-------------|
| `ParallaxHero` | Parallax scrolling hero |
| `DepthElements` | 3D depth effects |
| `Particles` | Animated particle background |

## Settings Components (`settings/`)

User preference controls:

| Component | Description |
|-----------|-------------|
| `ThemeToggle` | Dark/light mode switch |
| `LanguageSwitcher` | EN/AR/FR selector |
| `CurrencySwitcher` | Currency selector |

## Global Components

Site-wide components:

| Component | Description |
|-----------|-------------|
| `ThemeProvider` | Theme context provider |
| `ThemeInjector` | CSS variable injector |
| `DirectionSync` | RTL/LTR direction handler |
| `PageTracker` | Analytics page tracking |
| `LiveChatWidget` | Customer support chat |
| `Wishlist` | Saved items drawer |

## Component Best Practices

### 1. TypeScript Props

Always define prop interfaces:

```tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

export function Button({ variant = 'primary', ...props }: ButtonProps) {
  // ...
}
```

### 2. Forward Refs

For form components:

```tsx
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, ...props }, ref) => (
    <input ref={ref} {...props} />
  )
);
```

### 3. Composition

Prefer composition over configuration:

```tsx
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Body>Content</Card.Body>
  <Card.Footer>Actions</Card.Footer>
</Card>
```

### 4. Accessibility

Include ARIA attributes:

```tsx
<button
  aria-label="Close modal"
  aria-pressed={isPressed}
  role="button"
>
```

---

See individual component files for detailed prop documentation.
