# V2 Builder — Design System Contract
> Ground truth spec. Every agent, every PR references this.
> Updated: 2026-05-25

---

## Three Surfaces (Never Cross Them)

| Surface | Routes | Theming |
|---------|--------|---------|
| Platform Shell | `/admin/**`, `/staff/**` | Fixed neutral: slate-50 / slate-900 / indigo-600. ThemeInjector NEVER runs here. |
| Builder Chrome | `/admin/modules/builder/[id]` | Platform shell colors around the canvas. Canvas preview area injects guest theme. |
| Guest Output | `/[slug]/**`, `/`, `/cart`, `/reserve` | Fully operator-branded. ThemeInjector runs here ONLY. |

---

## Canvas Coordinate System

- **Width:** 1440 px (not 1920 — hospitality pages are scrollable web, not kiosk fullscreen)
- **Height:** Infinite scroll (min 800px, grows with content)
- **Grid unit:** 8 px
- **Grid visual:** 1 px radial-gradient dots at every 8 px
- **Column overlay:** 12 columns × 120px each, toggled with `G` key
- **Snap threshold:** 8 px (edges + centers of other blocks)
- **Zoom range:** 25 % – 200 %

---

## Interaction Model (Canon)

| Gesture | Result |
|---------|--------|
| Click on block | Select (single). Clears multi-select. |
| Click on canvas bg | Deselect all. |
| Double-click on block | Enter inline edit mode (text-bearing blocks only). |
| Escape | Exit inline edit → then deselect. |
| Shift+click | Toggle block in/out of multi-select set. |
| Drag on canvas bg | Rubber-band: draw selection rect, collect intersecting blocks. |
| Drag on block grip | Move block. Snap fires during drag. |
| Drag on resize handle | Resize block. |
| Drag from toolbar | Ghost preview follows cursor, snaps to grid, drops at exact position. |
| Right-click on block | Context menu: duplicate / delete / lock / bring forward / send back. |
| `G` key | Toggle 12-column overlay. |
| `Ctrl+Z` | Undo. |
| `Ctrl+Y` or `Ctrl+Shift+Z` | Redo. |
| `Delete` or `Backspace` | Delete selected block(s). |

---

## Property Panel — Four Tabs (Phase 4)

| Tab | Contents |
|-----|----------|
| Style | Background (Layer 1: color/gradient/image/video + overlay), border-radius, shadow, opacity, blend mode |
| Typography | Font family (20 curated pairs, live "Aa" preview), size, weight, style, alignment, line-height, letter-spacing, color |
| Layout | Section layout (Layer 2), height mode (Layer 5), padding, gap |
| Position | X, Y, width, height, rotation, scale. Z-index is implicit from LayersPanel order — no slider. Quick-position presets computed against 1440px canvas. |

---

## Inline Editing Scope (Phase 3)

Blocks that support double-click inline editing:

| Block | Editable fields |
|-------|----------------|
| `text_block` | `content` |
| `hero` | `title`, `subtitle`, `buttonText` |
| `hero_v2` | `eyebrow`, `title`, `subtitle`, `primaryButton`, `secondaryButton` |
| `button` | `text` |
| `cta` | `title`, `subtitle`, `buttonText` |
| `features` | Per-item: `title`, `description`. Add/remove items. |
| `stats` | Per-item: `value`, `label`. Add/remove items. |
| `card_grid` | Per-card: `title`, `description`. Add/remove cards. |
| `testimonials_carousel` | Per-item: `text`, `name`, `role`. Add/remove. |
| `pricing_table` | Per-plan: `name`, `price`, feature list items. |

Data-bound blocks (`menu_list`, `session_list`, `booking_calendar`) do NOT get inline editing — they pull live data.

---

## Guest Token Contract (Phase 6)

Brand config flow produces these CSS vars, injected by ThemeInjector on `[slug]/layout.tsx` ONLY:

```
--color-primary-{50..950}   11 shades from brand primary
--color-accent-{50..950}    11 shades from brand accent
--font-heading              heading font (Google Fonts)
--font-body                 body font (Google Fonts)
--radius-base               from feel: minimal=2px warm=8px bold=4px elegant=12px
--shadow-base               from feel preset
--space-scale               from feel preset (tight/normal/loose)
```

---

## What Is Never Touched

```
src/app/admin/**          (except builder page chrome layout)
src/app/staff/**
All backend files
All mobile files
All supabase migrations
DynamicModuleRenderer — data-bound component logic (MenuListComponent, SessionListComponent,
  BookingCalendarComponent, PricingTableComponent, SectionWrapper)
types/module-builder.ts   — EXTEND ONLY
stores/module-builder-store.ts — EXTEND ONLY (history stack, addBlock, updateBlock, removeBlock)
```

---

## Phase Sequence

```
Phase 0  Spec lock (this document) ✅
Phase 1  LayersPanel + BuilderCanvasV2 ✅
Phase 2  ComponentToolbarV2 drag-to-place ✅
Phase 3  Inline editing ✅
Phase 4  PropertyPanelV2 ✅
Phase 5  Template system ✅
Phase 6  ThemeInjector scope cut + Brand Config page ✅
Phase 7  Archive effects/, old builder components, dead store code ✅
```

> **Builder UI/UX plan complete.** All phases shipped. Old V1 builder files
> (BuilderCanvas, ComponentToolbar, PropertyPanel, SortableBlock) are archived
> at `C:\Alessandro\Work\Attempts to Code\V2 Ecosystem\archive\` and can be
> deleted from `src/components/module-builder/` at your discretion.
