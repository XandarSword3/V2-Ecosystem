import { create } from 'zustand';
import { UIBlock, UIComponentType, AlignmentDirection, BlockPosition } from '@/types/module-builder';

// ─── Helper ──────────────────────────────────────────────────────────────────

const findNode = (nodes: UIBlock[], id: string): UIBlock | undefined => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
};

/** Parse a position dimension (e.g. '400px', '50%', 400) into a pixel number. Falls back to `fallback`. */
const parsePx = (val: string | number | undefined, fallback = 200): number => {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'number') return val;
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModuleBuilderStore {
  // ── Existing state ──────────────────────────────────────────────────────────
  activeModuleId: string | null;
  layout: UIBlock[];
  selectedBlockId: string | null;
  isPreview: boolean;
  previewDevice: 'desktop' | 'mobile';
  zoom: number;
  history: UIBlock[][];
  _futureStates: UIBlock[][];

  // ── Phase 1: multi-select, inline edit, lock ─────────────────────────────
  /** All currently selected block IDs. Kept in sync with selectedBlockId. */
  selectedBlockIds: string[];
  /** Block currently being inline-edited (Phase 3). */
  inlineEditingBlockId: string | null;
  /** Blocks locked from canvas interaction. Stored as IDs for O(1) lookup. */
  lockedBlockIds: string[];

  // ── Existing actions ─────────────────────────────────────────────────────
  setActiveModuleId: (id: string) => void;
  setLayout: (layout: UIBlock[], skipHistory?: boolean) => void;
  selectBlock: (id: string | null) => void;
  togglePreview: () => void;
  setPreviewDevice: (device: 'desktop' | 'mobile') => void;
  setZoom: (zoom: number) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  addBlock: (type: UIComponentType, position?: Partial<BlockPosition>) => void;
  updateBlock: (id: string, updates: Partial<UIBlock>) => void;
  removeBlock: (id: string) => void;
  moveBlock: (activeId: string, overId: string) => void;
  duplicateBlock: (id: string) => void;

  // ── Phase 1 actions ──────────────────────────────────────────────────────
  /** Replace the entire selection set. Also sets selectedBlockId to ids[0]. */
  selectMultiple: (ids: string[]) => void;
  /** Add one block to the current selection. */
  addToSelection: (id: string) => void;
  /** Remove one block from the current selection. */
  removeFromSelection: (id: string) => void;
  /** Clear all selections. */
  clearSelection: () => void;
  /** Enter inline-edit mode for a block (Phase 3). */
  setInlineEditing: (id: string | null) => void;
  /** Toggle locked state for a block. */
  toggleLock: (id: string) => void;
  /** Align selected blocks along an axis. Requires ≥2 selected blocks. */
  alignBlocks: (ids: string[], alignment: AlignmentDirection) => void;
  /** Distribute selected blocks evenly. Requires ≥3 selected blocks. */
  distributeBlocks: (ids: string[], direction: 'horizontal' | 'vertical') => void;
}

// ─── Default props per block type ────────────────────────────────────────────

function buildDefaultProps(type: UIComponentType): Record<string, any> {
  switch (type) {
    case 'hero':
      return { title: 'Welcome', subtitle: 'Discover our services' };
    case 'hero_v2':
      return { eyebrow: 'Welcome', title: 'Hero Title', subtitle: 'Discover our services', primaryButton: 'Get Started', align: 'center' };
    case 'grid':
      return { columns: '3', dataSource: 'menu' };
    case 'button':
      return { text: 'Click me', backgroundColor: '#6366f1', variant: 'solid', size: 'md' };
    case 'form_container':
      return { formAction: 'contact', submitText: 'Submit' };
    case 'text_block':
      return { content: 'Enter your text here...', fontSize: 'base' };
    case 'image':
      return { alt: 'Image', objectFit: 'cover' };
    case 'testimonials':
      return { source: 'static', count: 3, showRatings: true };
    case 'pricing_table':
      return {
        title: 'Our Pricing',
        plans: [
          { name: 'Basic', price: '$10', features: ['Feature 1', 'Feature 2'] },
          { name: 'Pro', price: '$20', features: ['Feature 1', 'Feature 2', 'Feature 3'], popular: true },
        ],
      };
    case 'features':
      return {
        title: 'Our Features',
        features: [
          { icon: 'Star', title: 'Feature 1', description: 'Description here' },
          { icon: 'Heart', title: 'Feature 2', description: 'Description here' },
          { icon: 'Zap', title: 'Feature 3', description: 'Description here' },
        ],
      };
    case 'cta':
      return { title: 'Ready to get started?', buttonText: 'Get Started', align: 'center' };
    case 'class_schedule':
      return {
        title: 'Next Classes',
        subtitle: 'UPCOMING SESSIONS',
        classes: [
          { id: '1', name: 'Class 1', time: '09:00 AM', trainer: 'Trainer', category: 'Category', icon: 'Dumbbell' },
          { id: '2', name: 'Class 2', time: '11:00 AM', trainer: 'Trainer', category: 'Category', icon: 'Heart' },
        ],
      };
    case 'calendar':
      return { title: 'Schedule' };
    case 'testimonials_carousel':
      return {
        title: 'Testimonials',
        subtitle: 'WHAT PEOPLE SAY',
        testimonials: [
          { id: '1', text: 'Great experience!', name: 'John D.', role: 'Member', rating: 5, avatar: 'JD' },
          { id: '2', text: 'Highly recommended!', name: 'Jane S.', role: 'Member', rating: 5, avatar: 'JS' },
          { id: '3', text: 'Amazing service!', name: 'Bob M.', role: 'Member', rating: 5, avatar: 'BM' },
        ],
      };
    case 'stats':
      return {
        title: 'Our Impact',
        stats: [
          { value: '10K+', label: 'Happy Guests', icon: 'Users' },
          { value: '50+', label: 'Activities', icon: 'Zap' },
          { value: '99%', label: 'Satisfaction', icon: 'Heart' },
        ],
      };
    case 'card_grid':
      return {
        title: 'Our Services',
        cards: [
          { title: 'Service 1', description: 'Description', icon: 'Star' },
          { title: 'Service 2', description: 'Description', icon: 'Heart' },
          { title: 'Service 3', description: 'Description', icon: 'Zap' },
        ],
      };
    case 'divider':
      return { accentColor: '#6366f1' };
    case 'spacer':
      return { height: 40 };
    default:
      return {};
  }
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useModuleBuilderStore = create<ModuleBuilderStore>((set, get) => ({
  // ── Existing state ──────────────────────────────────────────────────────────
  activeModuleId: null,
  layout: [],
  selectedBlockId: null,
  isPreview: false,
  previewDevice: 'desktop',
  zoom: 100,
  history: [],
  _futureStates: [],

  // ── Phase 1 state ────────────────────────────────────────────────────────
  selectedBlockIds: [],
  inlineEditingBlockId: null,
  lockedBlockIds: [],

  // ── Existing actions ──────────────────────────────────────────────────────

  setActiveModuleId: (id) => set({ activeModuleId: id }),

  setLayout: (layout, skipHistory = false) =>
    set((state) => {
      if (skipHistory) return { layout };
      const newHistory = [...state.history, [...state.layout]].slice(-50);
      return { layout, history: newHistory, _futureStates: [] };
    }),

  selectBlock: (id) =>
    set({
      selectedBlockId: id,
      selectedBlockIds: id ? [id] : [],
      inlineEditingBlockId: null,
    }),

  togglePreview: () =>
    set((state) => ({
      isPreview: !state.isPreview,
      selectedBlockId: null,
      selectedBlockIds: [],
      inlineEditingBlockId: null,
    })),

  setPreviewDevice: (previewDevice) => set({ previewDevice }),
  setZoom: (zoom) => set({ zoom: Math.max(50, Math.min(150, zoom)) }),

  undo: () =>
    set((state) => {
      if (state.history.length === 0) return state;
      const newHistory = [...state.history];
      const previousLayout = newHistory.pop()!;
      const newFuture = [...state._futureStates, [...state.layout]];
      return { layout: [...previousLayout], history: newHistory, _futureStates: newFuture };
    }),

  redo: () =>
    set((state) => {
      if (!state._futureStates.length) return state;
      const newFuture = [...state._futureStates];
      const nextLayout = newFuture.pop()!;
      const newHistory = [...state.history, [...state.layout]];
      return { layout: [...nextLayout], history: newHistory, _futureStates: newFuture };
    }),

  canUndo: () => get().history.length > 0,
  canRedo: () => get()._futureStates.length > 0,

  addBlock: (type, position) =>
    set((state) => {
      const n = state.layout.length;
      const newBlock: UIBlock = {
        id: crypto.randomUUID(),
        type,
        label: `New ${type.replace(/_/g, ' ')}`,
        props: buildDefaultProps(type),
        style: { width: '100%' },
        position: {
          x: position?.x ?? 100 + (n % 10) * 30,
          y: position?.y ?? 100 + (n % 10) * 30,
          width: position?.width ?? '400px',
          height: position?.height ?? 'auto',
          z: n + 1,
        },
        children:
          type === 'container' || type === 'grid' || type === 'form_container'
            ? []
            : undefined,
      };
      const newLayout = [...state.layout, newBlock];
      const newHistory = [...state.history, [...state.layout]].slice(-50);
      return { layout: newLayout, history: newHistory, _futureStates: [] };
    }),

  updateBlock: (id, updates) =>
    set((state) => {
      const updateRecursive = (nodes: UIBlock[]): UIBlock[] =>
        nodes.map((node) => {
          if (node.id === id) return { ...node, ...updates };
          if (node.children) return { ...node, children: updateRecursive(node.children) };
          return node;
        });
      const newLayout = updateRecursive(state.layout);
      const newHistory = [...state.history, [...state.layout]].slice(-50);
      return { layout: newLayout, history: newHistory, _futureStates: [] };
    }),

  removeBlock: (id) =>
    set((state) => {
      const removeRecursive = (nodes: UIBlock[]): UIBlock[] =>
        nodes
          .filter((n) => n.id !== id)
          .map((n) => ({ ...n, children: n.children ? removeRecursive(n.children) : undefined }));
      const newLayout = removeRecursive(state.layout);
      const newHistory = [...state.history, [...state.layout]].slice(-50);
      return {
        layout: newLayout,
        selectedBlockId: state.selectedBlockId === id ? null : state.selectedBlockId,
        selectedBlockIds: state.selectedBlockIds.filter((i) => i !== id),
        inlineEditingBlockId: state.inlineEditingBlockId === id ? null : state.inlineEditingBlockId,
        history: newHistory,
        _futureStates: [],
      };
    }),

  moveBlock: (activeId, overId) =>
    set((state) => {
      const oldIndex = state.layout.findIndex((x) => x.id === activeId);
      const newIndex = state.layout.findIndex((x) => x.id === overId);
      if (oldIndex === -1 || newIndex === -1) return state;
      const newLayout = [...state.layout];
      const [moved] = newLayout.splice(oldIndex, 1);
      newLayout.splice(newIndex, 0, moved);
      const newHistory = [...state.history, [...state.layout]].slice(-50);
      return { layout: newLayout, history: newHistory, _futureStates: [] };
    }),

  duplicateBlock: (id) =>
    set((state) => {
      const src = state.layout.find((b) => b.id === id);
      if (!src) return state;
      const dup: UIBlock = {
        ...src,
        id: crypto.randomUUID(),
        label: `${src.label ?? src.type} (copy)`,
        position: src.position
          ? { ...src.position, x: (src.position.x ?? 100) + 24, y: (src.position.y ?? 100) + 24 }
          : src.position,
      };
      const index = state.layout.findIndex((b) => b.id === id);
      const newLayout = [...state.layout];
      newLayout.splice(index + 1, 0, dup);
      const newHistory = [...state.history, [...state.layout]].slice(-50);
      return { layout: newLayout, history: newHistory, _futureStates: [] };
    }),

  // ── Phase 1 actions ────────────────────────────────────────────────────────

  selectMultiple: (ids) =>
    set({ selectedBlockIds: ids, selectedBlockId: ids[0] ?? null, inlineEditingBlockId: null }),

  addToSelection: (id) =>
    set((state) => {
      if (state.selectedBlockIds.includes(id)) return state;
      const ids = [...state.selectedBlockIds, id];
      return { selectedBlockIds: ids, selectedBlockId: state.selectedBlockId ?? id, inlineEditingBlockId: null };
    }),

  removeFromSelection: (id) =>
    set((state) => {
      const ids = state.selectedBlockIds.filter((i) => i !== id);
      return {
        selectedBlockIds: ids,
        selectedBlockId: ids.length > 0 ? ids[ids.length - 1] : null,
        inlineEditingBlockId: null,
      };
    }),

  clearSelection: () =>
    set({ selectedBlockId: null, selectedBlockIds: [], inlineEditingBlockId: null }),

  setInlineEditing: (id) => set({ inlineEditingBlockId: id }),

  toggleLock: (id) =>
    set((state) => {
      const isLocked = state.lockedBlockIds.includes(id);
      const lockedBlockIds = isLocked
        ? state.lockedBlockIds.filter((i) => i !== id)
        : [...state.lockedBlockIds, id];
      const layout = state.layout.map((b) =>
        b.id === id ? { ...b, locked: !isLocked } : b
      );
      return { lockedBlockIds, layout };
    }),

  alignBlocks: (ids, alignment) =>
    set((state) => {
      if (ids.length < 2) return state;
      const blocks = ids
        .map((id) => state.layout.find((b) => b.id === id))
        .filter((b): b is UIBlock => b !== undefined && b.position !== undefined);
      if (blocks.length < 2) return state;

      const bounds = blocks.map((b) => ({
        id: b.id,
        x: b.position!.x ?? 0,
        y: b.position!.y ?? 0,
        w: parsePx(b.position!.width, 400),
        h: parsePx(b.position!.height, 200),
      }));

      const newLayout = state.layout.map((block) => {
        if (!ids.includes(block.id) || !block.position) return block;
        const b = bounds.find((bd) => bd.id === block.id)!;
        let x = b.x;
        let y = b.y;

        switch (alignment) {
          case 'left':   x = Math.min(...bounds.map((bd) => bd.x)); break;
          case 'right':  x = Math.max(...bounds.map((bd) => bd.x + bd.w)) - b.w; break;
          case 'center': x = (Math.min(...bounds.map((bd) => bd.x)) + Math.max(...bounds.map((bd) => bd.x + bd.w))) / 2 - b.w / 2; break;
          case 'top':    y = Math.min(...bounds.map((bd) => bd.y)); break;
          case 'bottom': y = Math.max(...bounds.map((bd) => bd.y + bd.h)) - b.h; break;
          case 'middle': y = (Math.min(...bounds.map((bd) => bd.y)) + Math.max(...bounds.map((bd) => bd.y + bd.h))) / 2 - b.h / 2; break;
        }

        return { ...block, position: { ...block.position, x, y } };
      });

      const newHistory = [...state.history, [...state.layout]].slice(-50);
      return { layout: newLayout, history: newHistory, _futureStates: [] };
    }),

  distributeBlocks: (ids, direction) =>
    set((state) => {
      if (ids.length < 3) return state;
      const blocks = ids
        .map((id) => state.layout.find((b) => b.id === id))
        .filter((b): b is UIBlock => b !== undefined && b.position !== undefined);
      if (blocks.length < 3) return state;

      const bounds = blocks.map((b) => ({
        id: b.id,
        x: b.position!.x ?? 0,
        y: b.position!.y ?? 0,
        w: parsePx(b.position!.width, 400),
        h: parsePx(b.position!.height, 200),
      }));

      let newLayout = [...state.layout];

      if (direction === 'horizontal') {
        const sorted = [...bounds].sort((a, b) => a.x - b.x);
        const totalWidth = sorted.reduce((s, b) => s + b.w, 0);
        const span = sorted[sorted.length - 1].x + sorted[sorted.length - 1].w - sorted[0].x;
        const gap = (span - totalWidth) / (sorted.length - 1);
        let cursor = sorted[0].x;
        sorted.forEach((b) => {
          const nx = cursor;
          newLayout = newLayout.map((block) =>
            block.id === b.id ? { ...block, position: { ...block.position, x: nx } } : block
          );
          cursor += b.w + gap;
        });
      } else {
        const sorted = [...bounds].sort((a, b) => a.y - b.y);
        const totalHeight = sorted.reduce((s, b) => s + b.h, 0);
        const span = sorted[sorted.length - 1].y + sorted[sorted.length - 1].h - sorted[0].y;
        const gap = (span - totalHeight) / (sorted.length - 1);
        let cursor = sorted[0].y;
        sorted.forEach((b) => {
          const ny = cursor;
          newLayout = newLayout.map((block) =>
            block.id === b.id ? { ...block, position: { ...block.position, y: ny } } : block
          );
          cursor += b.h + gap;
        });
      }

      const newHistory = [...state.history, [...state.layout]].slice(-50);
      return { layout: newLayout, history: newHistory, _futureStates: [] };
    }),
}));
