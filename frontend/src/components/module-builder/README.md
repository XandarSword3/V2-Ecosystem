# Module Builder

Visual drag-and-drop UI builder for creating dynamic module layouts.

## Overview

The Module Builder allows administrators to create custom UI layouts for modules (restaurants, pools, chalets) without writing code.

## Components

```
module-builder/
├── index.tsx                   # Main builder interface
├── ComponentPalette.tsx        # Draggable component library
├── Canvas.tsx                  # Drop zone for layout
├── PropertyPanel.tsx           # Component property editor
├── BlockRenderer.tsx           # Individual block renderer
├── DynamicModuleRenderer.tsx   # Runtime renderer for customers
└── README.md                   # This file
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Module Builder Page                      │
├─────────────┬───────────────────────────────────────┬───────┤
│  Component  │                                       │ Prop  │
│  Palette    │              Canvas                   │ Panel │
│             │                                       │       │
│  ┌───────┐  │  ┌─────────────────────────────────┐ │       │
│  │ Hero  │  │  │         Hero Block              │ │ Title │
│  └───────┘  │  └─────────────────────────────────┘ │ [___] │
│  ┌───────┐  │  ┌─────────────────────────────────┐ │       │
│  │ Grid  │  │  │         Grid Block              │ │ Cols  │
│  └───────┘  │  │  ┌─────┐ ┌─────┐ ┌─────┐       │ │ [___] │
│  ┌───────┐  │  │  │Card │ │Card │ │Card │       │ │       │
│  │ Menu  │  │  │  └─────┘ └─────┘ └─────┘       │ │       │
│  └───────┘  │  └─────────────────────────────────┘ │       │
│             │                                       │       │
└─────────────┴───────────────────────────────────────┴───────┘
```

## Block Types

### Layout Blocks

| Type | Description | Properties |
|------|-------------|------------|
| `container` | Flex container | direction, gap, padding |
| `grid` | CSS Grid layout | columns, gap |

### Content Blocks

| Type | Description | Properties |
|------|-------------|------------|
| `hero` | Hero banner | title, subtitle, backgroundImage |
| `text_block` | Rich text | content |
| `image` | Image display | src, alt |

### Dynamic Blocks

| Type | Description | Data Source |
|------|-------------|-------------|
| `menu_list` | Menu items grid | Restaurant API |
| `session_list` | Session booking | Pool API |
| `booking_calendar` | Date picker | Chalet API |

## State Management

Uses Zustand for builder state:

```typescript
// store/module-builder-store.ts
interface ModuleBuilderStore {
  layout: UIBlock[];
  selectedBlockId: string | null;
  history: UIBlock[][];
  _futureStates: UIBlock[][];
  
  addBlock: (type: UIComponentType) => void;
  updateBlock: (id: string, updates: Partial<UIBlock>) => void;
  removeBlock: (id: string) => void;
  moveBlock: (activeId: string, overId: string) => void;
  undo: () => void;
  redo: () => void;
}
```

## Drag and Drop

Uses @dnd-kit for drag operations:

```tsx
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';

function Canvas() {
  return (
    <DndContext onDragEnd={handleDragEnd}>
      <SortableContext items={layout.map(b => b.id)}>
        {layout.map(block => (
          <SortableBlock key={block.id} block={block} />
        ))}
      </SortableContext>
    </DndContext>
  );
}
```

## Block Schema

```typescript
interface UIBlock {
  id: string;          // Unique identifier
  type: UIComponentType;
  label: string;       // Display name
  props: Record<string, unknown>;
  style?: CSSProperties;
  children?: UIBlock[];
}

type UIComponentType = 
  | 'hero'
  | 'container'
  | 'grid'
  | 'text_block'
  | 'image'
  | 'menu_list'
  | 'session_list'
  | 'booking_calendar';
```

## Property Editor

Property panel updates selected block:

```tsx
function PropertyPanel({ block }) {
  const updateBlock = useModuleBuilderStore(s => s.updateBlock);
  
  return (
    <div>
      <Input
        label="Title"
        value={block.props.title}
        onChange={(e) => updateBlock(block.id, {
          props: { ...block.props, title: e.target.value }
        })}
      />
    </div>
  );
}
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+S` | Save layout |
| `Delete` | Remove selected block |
| `Escape` | Deselect |

## Saving Layouts

Layouts are saved to module settings:

```typescript
const saveMutation = useMutation({
  mutationFn: (layout: UIBlock[]) => 
    modulesApi.updateModule(moduleId, {
      settings: { layout }
    }),
  onSuccess: () => toast.success('Layout saved!')
});
```

## Runtime Rendering

`DynamicModuleRenderer` renders saved layouts for customers:

```tsx
// In customer-facing module page
import { DynamicModuleRenderer } from '@/components/module-builder';

function ModulePage({ module }) {
  const layout = module.settings?.layout || [];
  
  return (
    <DynamicModuleRenderer 
      layout={layout} 
      module={module} 
    />
  );
}
```

The renderer:
1. Parses the layout JSON
2. Renders each block recursively
3. Fetches data for dynamic blocks (menu, sessions)
4. Applies styles and responsive behavior

## Adding New Block Types

1. Add type to `UIComponentType` union
2. Add default props in `addBlock` action
3. Add rendering case in `BlockRenderer`
4. Add property fields in `PropertyPanel`
5. Add runtime rendering in `DynamicModuleRenderer`

Example:

```typescript
// 1. Add type
type UIComponentType = ... | 'testimonials';

// 2. Default props
case 'testimonials':
  defaultProps.count = 3;
  break;

// 3. BlockRenderer
case 'testimonials':
  return <TestimonialsPreview {...props} />;

// 4. PropertyPanel
{block.type === 'testimonials' && (
  <Input label="Count" type="number" ... />
)}

// 5. DynamicModuleRenderer
case 'testimonials':
  return <TestimonialsCarousel count={props.count} />;
```

---

The module builder enables non-technical users to customize module UIs while maintaining consistent styling and functionality.
