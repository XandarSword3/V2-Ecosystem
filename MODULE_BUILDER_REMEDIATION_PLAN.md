# Module Builder System - Full Remediation Plan

## Executive Summary

The module builder system has **critical gaps** between the visual components available in the toolbar and the actual rendering/preview/editing capabilities. The Gym Module was built via API injection (hardcoded script), not through the visual builder UI, exposing significant usability issues.

---

## Critical Issues Identified

### 1. DUPLICATE & CONFUSING BUTTONS (ComponentToolbar.tsx)

| Current Buttons | Problem | Solution |
|-----------------|---------|----------|
| `grid` + `card_grid` | Both create card layouts, confusing users | **Consolidate** - Keep `card_grid`, remove `grid` |
| `booking_calendar` + `calendar` | "Calendar" and "Calendar V2" - unclear distinction | **Rename** - `booking_calendar` → "Booking Calendar", `calendar` → "Mini Calendar" |
| `testimonials` + `testimonials_carousel` | Duplicate functionality | **Consolidate** - Keep `testimonials_carousel`, remove old `testimonials` |
| `hero` + `hero_v2` | Both exist but hero_v2 has glassmorphic design | **Keep both** - `hero` = simple, `hero_v2` = advanced with image support |

### 2. MISSING CANVAS PREVIEWS (SortableBlock.tsx)

The builder canvas shows **blank placeholders** for these components:

```typescript
// MISSING PREVIEW RENDERERS in SortableBlock.tsx:
- hero_v2 (shows empty box)
- features (shows empty box)  
- stats (shows empty box)
- class_schedule (shows empty box)
- calendar (shows empty box)
- testimonials_carousel (shows empty box)
- pricing_table (shows empty box)
- cta (shows empty box)
- divider (shows empty box)
- spacer (shows empty box)
```

**Current only has previews for:**
- hero, grid, image, text_block, menu_list, session_list, booking_calendar, button, container, form_container

### 3. PROPERTY PANEL - MISSING COMPONENT-SPECIFIC CONTROLS (PropertyPanel.tsx)

The PropertyPanel only shows:
- Label (generic)
- Dimensions & Spacing (generic)
- Background (Layer 1)

**MISSING:** Component-specific property editors for:

| Component | Missing Props |
|-----------|---------------|
| `hero_v2` | eyebrow, title, subtitle, highlight, primaryButton, secondaryButton, primaryUrl, secondaryUrl, align |
| `features` | title, features[] (array editor with icon/title/description) |
| `stats` | title, stats[] (array editor with value/label/icon) |
| `class_schedule` | title, subtitle, classes[] (array editor) |
| `calendar` | title |
| `testimonials_carousel` | title, subtitle, testimonials[] (array editor) |
| `pricing_table` | title, subtitle, plans[] (array editor with price/features/popular) |
| `cta` | title, subtitle, buttonText, buttonUrl |
| `button` | text, href, variant, size, backgroundColor |
| `text_block` | content, fontSize |
| `image` | src, alt |

### 4. DYNAMIC MODULE RENDERER ISSUES (DynamicModuleRenderer.tsx)

#### Hero_v2 Component Problems:
```tsx
// CURRENT (broken - ignores image background):
case 'hero_v2':
  style={{
    background: `linear-gradient(135deg, ${props.headerColor || '#0ea5e9'} 0%, ...)`  // ALWAYS gradient!
  }}

// SHOULD BE (respect background setting):
- If background.type === 'image': Use image with overlay
- If background.type === 'gradient': Use gradient
- If background.type === 'color': Use solid color
```

**The hero_v2 component IGNORES the SectionWrapper background system!**

#### Missing SectionLayout Support:
Components like `class_schedule` and `calendar` don't respect `sectionLayout: 'split-50-50'`

### 5. BLANK STATE ON MODULE BUILDER LOAD

**Root Cause Analysis:**

Looking at `page.tsx` in builder:
```typescript
useEffect(() => {
  if (data?.data) {
    setActiveModuleId(id);
    const savedLayout = data.data.settings?.layout || [];
    console.log('[ModuleBuilder] Loading layout from API:', savedLayout);
    setLayout(savedLayout, true); // Skip history for initial load
  }
}, [data, id, setActiveModuleId, setLayout]);
```

The code **DOES load the layout** - but the canvas shows blank because:
1. The `SortableBlock` previews are missing (show empty boxes)
2. The `hero_v2` preview is not implemented, so hero sections appear blank
3. All glassmorphic components appear as empty boxes

---

## Full Remediation Implementation Plan

### PHASE 1: Fix Component Previews (SortableBlock.tsx)

**File:** `frontend/src/components/module-builder/SortableBlock.tsx`

Add preview renderers for missing components:

```typescript
// Add to the preview rendering section (~line 160):
{block.type === 'hero_v2' && (
    <div className="h-32 rounded bg-gradient-to-r from-slate-800 to-slate-900 flex flex-col items-center justify-center text-white relative overflow-hidden">
        {block.background?.image?.url && (
            <img src={block.background.image.url} className="absolute inset-0 w-full h-full object-cover opacity-50" />
        )}
        <div className="relative z-10 text-center">
            <span className="text-xs text-amber-400">{block.props.eyebrow || 'Eyebrow'}</span>
            <span className="text-lg font-bold block">{block.props.title || 'Hero Title'}</span>
        </div>
    </div>
)}

{block.type === 'features' && (
    <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 rounded">
        {(block.props.features || []).slice(0, 4).map((f: any, i: number) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-white rounded shadow-sm">
                <div className="w-6 h-6 bg-indigo-100 rounded flex items-center justify-center text-xs">✓</div>
                <span className="text-xs truncate">{f.title || 'Feature'}</span>
            </div>
        ))}
    </div>
)}

{block.type === 'stats' && (
    <div className="flex justify-around p-2 bg-slate-50 rounded">
        {(block.props.stats || []).slice(0, 3).map((s: any, i: number) => (
            <div key={i} className="text-center">
                <div className="text-lg font-bold text-indigo-600">{s.value || '0'}</div>
                <div className="text-[10px] text-slate-500">{s.label || 'Label'}</div>
            </div>
        ))}
    </div>
)}

{block.type === 'class_schedule' && (
    <div className="space-y-1 p-2 bg-slate-800 rounded">
        {(block.props.classes || []).slice(0, 3).map((c: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs text-white p-1 bg-slate-700 rounded">
                <span>{c.icon || '•'}</span>
                <span className="flex-1 truncate">{c.name || 'Class'}</span>
                <span className="text-amber-400">{c.time?.split(' ')[0] || '9:00'}</span>
            </div>
        ))}
    </div>
)}

{block.type === 'calendar' && (
    <div className="p-2 bg-slate-800 rounded text-center">
        <div className="text-xs text-slate-400 mb-1">{block.props.title || 'Calendar'}</div>
        <div className="grid grid-cols-7 gap-1">
            {Array.from({length: 7}).map((_, i) => (
                <div key={i} className="w-5 h-5 bg-slate-700 rounded text-[8px] text-white flex items-center justify-center">{i+1}</div>
            ))}
        </div>
    </div>
)}

{block.type === 'testimonials_carousel' && (
    <div className="flex gap-2 p-2 bg-slate-50 rounded">
        {(block.props.testimonials || []).slice(0, 2).map((t: any, i: number) => (
            <div key={i} className="flex-1 p-2 bg-white rounded shadow-sm text-xs">
                <div className="text-amber-500 mb-1">{'★'.repeat(t.rating || 5)}</div>
                <div className="text-slate-600 truncate">"{t.text || 'Review'}"</div>
                <div className="text-slate-400 mt-1">— {t.name || 'User'}</div>
            </div>
        ))}
    </div>
)}

{block.type === 'pricing_table' && (
    <div className="flex gap-2 p-2 bg-slate-50 rounded">
        {(JSON.parse(block.props.plans || '[]') || []).slice(0, 2).map((p: any, i: number) => (
            <div key={i} className={`flex-1 p-2 rounded text-center text-xs ${p.popular ? 'bg-indigo-100 border border-indigo-300' : 'bg-white'}`}>
                <div className="font-semibold">{p.name || 'Plan'}</div>
                <div className="text-indigo-600 font-bold">{p.price || '$0'}</div>
            </div>
        ))}
    </div>
)}

{block.type === 'cta' && (
    <div className="p-4 rounded bg-gradient-to-r from-blue-500 to-purple-500 text-center text-white">
        <div className="text-sm font-bold">{block.props.title || 'CTA Title'}</div>
        <div className="text-xs opacity-80 mt-1">{block.props.description || 'Description'}</div>
        <div className="mt-2 px-3 py-1 bg-white text-slate-900 rounded inline-block text-xs">
            {block.props.buttonText || 'Button'}
        </div>
    </div>
)}

{block.type === 'divider' && (
    <div className="py-4 flex items-center justify-center">
        <div className="w-1/2 h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>
    </div>
)}

{block.type === 'spacer' && (
    <div className="flex items-center justify-center text-slate-400 text-xs" style={{height: block.props.height || 40}}>
        Spacer ({block.props.height || 40}px)
    </div>
)}
```

### PHASE 2: Add Component-Specific Property Editors (PropertyPanel.tsx)

**File:** `frontend/src/components/module-builder/PropertyPanel.tsx`

Add component-specific sections after the "Background" section (~line 500):

```typescript
{/* COMPONENT-SPECIFIC PROPERTIES */}
<div className="space-y-3">
    <SectionHeader title="Component Content" section="content" />
    {expandedSections.content && (
        <div className="space-y-4 pt-2">
            
            {/* HERO_V2 PROPS */}
            {selectedBlock.type === 'hero_v2' && (
                <>
                    <div>
                        <label className="mb-1 block text-sm">Eyebrow Text</label>
                        <input
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            value={selectedBlock.props.eyebrow || ''}
                            onChange={(e) => handleChange('eyebrow', e.target.value)}
                            placeholder="Strength. Wellness. You."
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm">Title</label>
                        <input
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            value={selectedBlock.props.title || ''}
                            onChange={(e) => handleChange('title', e.target.value)}
                            placeholder="Gym Module"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm">Highlight Word (colored)</label>
                        <input
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            value={selectedBlock.props.highlight || ''}
                            onChange={(e) => handleChange('highlight', e.target.value)}
                            placeholder="Module"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm">Subtitle</label>
                        <input
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            value={selectedBlock.props.subtitle || ''}
                            onChange={(e) => handleChange('subtitle', e.target.value)}
                            placeholder="Elevate your stay..."
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm">Description</label>
                        <textarea
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            value={selectedBlock.props.description || ''}
                            onChange={(e) => handleChange('description', e.target.value)}
                            rows={3}
                            placeholder="State-of-the-art equipment..."
                        />
                    </div>
                    <hr className="border-slate-200" />
                    <div>
                        <label className="mb-1 block text-sm">Primary Button Text</label>
                        <input
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            value={selectedBlock.props.primaryButton || ''}
                            onChange={(e) => handleChange('primaryButton', e.target.value)}
                            placeholder="Explore Schedule"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm">Primary Button URL</label>
                        <input
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            value={selectedBlock.props.primaryUrl || ''}
                            onChange={(e) => handleChange('primaryUrl', e.target.value)}
                            placeholder="#schedule"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm">Secondary Button Text</label>
                        <input
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            value={selectedBlock.props.secondaryButton || ''}
                            onChange={(e) => handleChange('secondaryButton', e.target.value)}
                            placeholder="Membership Plans"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm">Alignment</label>
                        <select
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            value={selectedBlock.props.align || 'center'}
                            onChange={(e) => handleChange('align', e.target.value)}
                        >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                        </select>
                    </div>
                </>
            )}
            
            {/* FEATURES PROPS */}
            {selectedBlock.type === 'features' && (
                <>
                    <div>
                        <label className="mb-1 block text-sm">Section Title</label>
                        <input
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            value={selectedBlock.props.title || ''}
                            onChange={(e) => handleChange('title', e.target.value)}
                            placeholder="Why Choose Our Gym"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm">Features (JSON)</label>
                        <textarea
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono text-xs"
                            value={typeof selectedBlock.props.features === 'string' 
                                ? selectedBlock.props.features 
                                : JSON.stringify(selectedBlock.props.features || [], null, 2)}
                            onChange={(e) => handleChange('features', e.target.value)}
                            rows={10}
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                            Format: [{"icon": "Dumbbell", "title": "...", "description": "..."}]
                        </p>
                    </div>
                </>
            )}
            
            {/* PRICING TABLE PROPS */}
            {selectedBlock.type === 'pricing_table' && (
                <>
                    <div>
                        <label className="mb-1 block text-sm">Title</label>
                        <input
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            value={selectedBlock.props.title || ''}
                            onChange={(e) => handleChange('title', e.target.value)}
                            placeholder="Choose Your Plan"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm">Subtitle</label>
                        <input
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            value={selectedBlock.props.subtitle || ''}
                            onChange={(e) => handleChange('subtitle', e.target.value)}
                            placeholder="MEMBERSHIP PLANS"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm">Plans (JSON)</label>
                        <textarea
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono text-xs"
                            value={selectedBlock.props.plans || '[]'}
                            onChange={(e) => handleChange('plans', e.target.value)}
                            rows={15}
                        />
                    </div>
                </>
            )}
            
            {/* Similar patterns for: stats, class_schedule, testimonials_carousel, cta, button, text_block, image */}
            
        </div>
    )}
</div>
```

### PHASE 3: Fix Hero_v2 to Support Image Backgrounds (DynamicModuleRenderer.tsx)

**File:** `frontend/src/components/module-builder/DynamicModuleRenderer.tsx`

The hero_v2 component must respect the background system. Current code (~line 477-540) hardcodes a gradient. Replace with:

```typescript
case 'hero_v2':
  // hero_v2 now uses SectionWrapper for background
  content = (
    <div className="relative z-10 w-full h-full flex items-center justify-center">
      <div className={`container px-4 py-20 text-${props.align || 'center'}`}>
        {/* Badge */}
        {props.eyebrow && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-sm font-medium mb-4"
            style={{
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.3)',
            }}
          >
            <Sparkles className="w-4 h-4" />
            {props.eyebrow}
          </motion.div>
        )}
        
        {/* Title with highlight */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 drop-shadow-lg"
        >
          {props.title || module.name}
          {props.highlight && (
            <span className="text-amber-400"> {props.highlight}</span>
          )}
        </motion.h1>
        
        {/* Subtitle */}
        {props.subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-white/90 mb-2"
          >
            {props.subtitle}
          </motion.p>
        )}
        
        {/* Description */}
        {props.description && (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg text-white/80 max-w-2xl mx-auto mb-8"
          >
            {props.description}
          </motion.p>
        )}
        
        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex gap-4 justify-center"
        >
          {props.primaryButton && (
            <a
              href={props.primaryUrl || '#'}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold rounded-lg transition-colors"
            >
              {props.primaryButton}
            </a>
          )}
          {props.secondaryButton && (
            <a
              href={props.secondaryUrl || '#'}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg border border-white/30 transition-colors"
            >
              {props.secondaryButton}
            </a>
          )}
        </motion.div>
      </div>
    </div>
  );
  break;
```

The key change: Remove the gradient background from hero_v2 and let SectionWrapper handle it via the `background` prop.

### PHASE 4: Clean Up Component Toolbar

**File:** `frontend/src/components/module-builder/ComponentToolbar.tsx`

```typescript
// Consolidated, non-duplicate component list:
const COMPONENTS: { type: UIComponentType; label: string; icon: LucideIcon; category: 'layout' | 'content' | 'gym' | 'utility' }[] = [
  // LAYOUT
  { type: 'hero', label: 'Hero (Simple)', icon: Layout, category: 'layout' },
  { type: 'hero_v2', label: 'Hero (Advanced)', icon: Sparkles, category: 'layout' },
  { type: 'container', label: 'Container', icon: Box, category: 'layout' },
  { type: 'card_grid', label: 'Card Grid', icon: Grid, category: 'layout' },
  
  // CONTENT
  { type: 'text_block', label: 'Text Block', icon: Type, category: 'content' },
  { type: 'image', label: 'Image', icon: ImageIcon, category: 'content' },
  { type: 'button', label: 'Button', icon: MousePointer2, category: 'content' },
  { type: 'features', label: 'Features', icon: Star, category: 'content' },
  { type: 'stats', label: 'Stats', icon: BarChart3, category: 'content' },
  { type: 'testimonials_carousel', label: 'Testimonials', icon: Users, category: 'content' },
  { type: 'pricing_table', label: 'Pricing Table', icon: CreditCard, category: 'content' },
  { type: 'cta', label: 'CTA Section', icon: ArrowRight, category: 'content' },
  
  // GYM/SPECIFIC
  { type: 'menu_list', label: 'Menu List', icon: List, category: 'gym' },
  { type: 'session_list', label: 'Sessions', icon: Clock, category: 'gym' },
  { type: 'class_schedule', label: 'Class Schedule', icon: Dumbbell, category: 'gym' },
  { type: 'calendar', label: 'Calendar', icon: Calendar, category: 'gym' },
  { type: 'booking_calendar', label: 'Booking Calendar', icon: CalendarDays, category: 'gym' },
  { type: 'form_container', label: 'Form', icon: FormInput, category: 'gym' },
  
  // UTILITY
  { type: 'divider', label: 'Divider', icon: Divide, category: 'utility' },
  { type: 'spacer', label: 'Spacer', icon: Minus, category: 'utility' },
];

// REMOVED (duplicates):
// - 'grid' (duplicate of card_grid)
// - 'testimonials' (old version, testimonials_carousel is better)
```

### PHASE 5: Fix Module Builder State Persistence

**Issue:** When navigating to the builder, sometimes the layout appears blank even though it exists in the database.

**Root Cause:** React Query caching or state initialization race condition.

**Fix in page.tsx:**

```typescript
// Add explicit loading state and error boundary
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['module', id],
  queryFn: () => modulesApi.getById(id),
  staleTime: 0,
  refetchOnMount: 'always', // Force refetch on navigation
});

// Add error display
if (error) {
  return (
    <div className="flex h-screen items-center justify-center text-red-500">
      <div className="text-center">
        <p className="font-bold">Failed to load module</p>
        <p className="text-sm">{error.message}</p>
        <button 
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
```

---

## Priority Order for Fixes

### P0 (Critical - Blocks Usage)
1. **Fix SortableBlock previews** - Users can't see what they're editing
2. **Add component-specific property editors** - Users can't edit content
3. **Fix hero_v2 background** - Renders incorrectly

### P1 (High - Poor UX)
4. **Consolidate ComponentToolbar** - Remove duplicates, organize by category
5. **Add state persistence error handling** - Blank state recovery

### P2 (Medium - Nice to Have)
6. Add visual category grouping in toolbar
7. Add component preview tooltips
8. Add undo/redo keyboard shortcuts (Ctrl+Z, Ctrl+Y)

---

## Verification Checklist

After implementing fixes, verify:

- [ ] Open Gym Module in builder → Shows all 6 sections with previews
- [ ] Click Hero section → Can edit eyebrow, title, highlight, buttons
- [ ] Click Features section → Can edit features array via JSON
- [ ] Click Pricing section → Can edit plans array via JSON
- [ ] Add new component from toolbar → Appears immediately with preview
- [ ] Drag to reorder → Works smoothly
- [ ] Save → Persists to database
- [ ] Refresh page → Layout reloads correctly
- [ ] Preview mode → Renders identical to public view
- [ ] Public Gym Module → Matches the reference screenshot

---

## Effort Estimate

| Phase | Files | Estimated Time |
|-------|-------|----------------|
| Phase 1: Previews | SortableBlock.tsx | 2-3 hours |
| Phase 2: Property Panel | PropertyPanel.tsx | 4-6 hours |
| Phase 3: Hero_v2 Fix | DynamicModuleRenderer.tsx | 1-2 hours |
| Phase 4: Toolbar Cleanup | ComponentToolbar.tsx | 1 hour |
| Phase 5: State Fixes | page.tsx | 1 hour |
| Testing & Polish | - | 2-3 hours |
| **TOTAL** | **5 files** | **11-16 hours** |
