import { create } from 'zustand';
import { UIBlock, UIComponentType, CanvasMode } from '@/types/module-builder';

interface ModuleBuilderStore {
  activeModuleId: string | null;
  layout: UIBlock[];
  selectedBlockId: string | null;
  isPreview: boolean;
  zoom: number;
  canvasMode: CanvasMode;
  history: UIBlock[][];
  historyIndex: number;
  _futureStates: UIBlock[][];

  // Actions
  setActiveModuleId: (id: string) => void;
  setLayout: (layout: UIBlock[], skipHistory?: boolean) => void;
  selectBlock: (id: string | null) => void;
  togglePreview: () => void;
  setZoom: (zoom: number) => void;
  setCanvasMode: (mode: CanvasMode) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  addBlock: (type: UIComponentType, parentId?: string) => void;
  updateBlock: (id: string, updates: Partial<UIBlock>) => void;
  removeBlock: (id: string) => void;
  moveBlock: (activeId: string, overId: string) => void;
  duplicateBlock: (id: string) => void;
}

// Helper to find path to node
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

// Simple history management: past holds previous states, future holds undone states
// When we make a change, we push current to past and clear future
// When we undo, we push current to future and pop from past
// When we redo, we push current to past and pop from future

export const useModuleBuilderStore = create<ModuleBuilderStore>((set, get) => ({
  activeModuleId: null,
  layout: [],
  selectedBlockId: null,
  isPreview: false,
  zoom: 100,
  canvasMode: 'stack',
  history: [], // past states
  historyIndex: -1, // not used in new approach, keeping for compatibility
  _futureStates: [],

  setActiveModuleId: (id) => set({ activeModuleId: id }),
  setLayout: (layout, skipHistory = false) => set((state) => {
    if (skipHistory) return { layout };
    const newHistory = [...state.history, [...state.layout]].slice(-50);
    return { layout, history: newHistory, _futureStates: [] };
  }),
  selectBlock: (id) => set({ selectedBlockId: id }),
  togglePreview: () => set((state) => ({ isPreview: !state.isPreview, selectedBlockId: null })),
  setZoom: (zoom) => set({ zoom: Math.max(50, Math.min(150, zoom)) }),
  setCanvasMode: (mode) => set({ canvasMode: mode }),

  undo: () => set((state) => {
    if (state.history.length === 0) return state;
    const newHistory = [...state.history];
    const previousLayout = newHistory.pop()!;
    const newFuture = [...state._futureStates, [...state.layout]];
    return {
      layout: [...previousLayout],
      history: newHistory,
      _futureStates: newFuture
    };
  }),

  redo: () => set((state) => {
    if (!state._futureStates.length) return state;
    const newFuture = [...state._futureStates];
    const nextLayout = newFuture.pop()!;
    const newHistory = [...state.history, [...state.layout]];
    return {
      layout: [...nextLayout],
      history: newHistory,
      _futureStates: newFuture
    };
  }),

  canUndo: () => get().history.length > 0,
  canRedo: () => get()._futureStates.length > 0,

  addBlock: (type, parentId) => set((state) => {
    const defaultProps: Record<string, any> = {};

    // Set default props based on type
    if (type === 'hero') {
      defaultProps.title = 'Welcome';
      defaultProps.subtitle = 'Discover our services';
    } else if (type === 'grid') {
      defaultProps.columns = '3';
      defaultProps.dataSource = 'menu';
    } else if (type === 'button') {
      defaultProps.text = 'Click me';
      defaultProps.backgroundColor = '#6366f1';
      defaultProps.variant = 'solid';
      defaultProps.size = 'md';
    } else if (type === 'form_container') {
      defaultProps.formAction = 'contact';
      defaultProps.submitText = 'Submit';
    } else if (type === 'text_block') {
      defaultProps.content = 'Enter your text here...';
      defaultProps.fontSize = 'base';
    } else if (type === 'image') {
      defaultProps.alt = 'Image';
      defaultProps.objectFit = 'cover';
    } else if (type === 'testimonials') {
      defaultProps.source = 'static'; // or 'dynamic'
      defaultProps.count = 3;
      defaultProps.showRatings = true;
    } else if (type === 'pricing_table') {
      defaultProps.title = 'Our Pricing';
      defaultProps.plans = JSON.stringify([
        { name: 'Basic', price: '$10', features: ['Feature 1', 'Feature 2'] },
        { name: 'Pro', price: '$20', features: ['Feature 1', 'Feature 2', 'Feature 3'], popular: true }
      ]);
    } else if (type === 'hero_v2') {
      defaultProps.eyebrow = 'Welcome';
      defaultProps.title = 'Hero Title';
      defaultProps.subtitle = 'Discover our services';
      defaultProps.primaryButton = 'Get Started';
      defaultProps.align = 'center';
    } else if (type === 'features') {
      defaultProps.title = 'Our Features';
      defaultProps.features = [
        { icon: 'Star', title: 'Feature 1', description: 'Description here' },
        { icon: 'Heart', title: 'Feature 2', description: 'Description here' },
        { icon: 'Zap', title: 'Feature 3', description: 'Description here' }
      ];
    } else if (type === 'cta') {
      defaultProps.title = 'Ready to get started?';
      defaultProps.buttonText = 'Get Started';
      defaultProps.align = 'center';
    } else if (type === 'class_schedule') {
      defaultProps.title = 'Next Classes';
      defaultProps.subtitle = 'UPCOMING SESSIONS';
      defaultProps.classes = [
        { id: '1', name: 'Class 1', time: '09:00 AM', trainer: 'Trainer', category: 'Category', icon: 'Dumbbell' },
        { id: '2', name: 'Class 2', time: '11:00 AM', trainer: 'Trainer', category: 'Category', icon: 'Heart' }
      ];
    } else if (type === 'calendar') {
      defaultProps.title = 'Schedule';
    } else if (type === 'testimonials_carousel') {
      defaultProps.title = 'Testimonials';
      defaultProps.subtitle = 'WHAT PEOPLE SAY';
      defaultProps.testimonials = [
        { id: '1', text: 'Great experience!', name: 'John D.', role: 'Member', rating: 5, avatar: 'JD' },
        { id: '2', text: 'Highly recommended!', name: 'Jane S.', role: 'Member', rating: 5, avatar: 'JS' },
        { id: '3', text: 'Amazing service!', name: 'Bob M.', role: 'Member', rating: 5, avatar: 'BM' }
      ];
    } else if (type === 'stats') {
      defaultProps.title = 'Our Impact';
      defaultProps.stats = [
        { value: '10K+', label: 'Happy Guests', icon: 'Users' },
        { value: '50+', label: 'Activities', icon: 'Zap' },
        { value: '99%', label: 'Satisfaction', icon: 'Heart' }
      ];
    } else if (type === 'card_grid') {
      defaultProps.title = 'Our Services';
      defaultProps.cards = [
        { title: 'Service 1', description: 'Description', icon: 'Star' },
        { title: 'Service 2', description: 'Description', icon: 'Heart' },
        { title: 'Service 3', description: 'Description', icon: 'Zap' }
      ];
    } else if (type === 'divider') {
      defaultProps.accentColor = '#6366f1';
    } else if (type === 'spacer') {
      defaultProps.height = 40;
    }

    const newBlock: UIBlock = {
      id: crypto.randomUUID(),
      type,
      label: `New ${type}`,
      props: defaultProps,
      style: { width: '100%' },
      position: { x: 100 + (state.layout.length % 10) * 30, y: 100 + (state.layout.length % 10) * 30, width: '400px', height: 'auto', z: state.layout.length + 1 },
      children: type === 'container' || type === 'grid' || type === 'form_container' ? [] : undefined
    };

    const newLayout = [...state.layout, newBlock];
    const newHistory = [...state.history, [...state.layout]].slice(-50);
    return { layout: newLayout, history: newHistory, _futureStates: [] };
  }),

  updateBlock: (id, updates) => set((state) => {
    const updateRecursive = (nodes: UIBlock[]): UIBlock[] => {
      return nodes.map(node => {
        if (node.id === id) {
          return { ...node, ...updates };
        }
        if (node.children) {
          return { ...node, children: updateRecursive(node.children) };
        }
        return node;
      });
    };
    const newLayout = updateRecursive(state.layout);
    const newHistory = [...state.history, [...state.layout]].slice(-50);
    return { layout: newLayout, history: newHistory, _futureStates: [] };
  }),

  removeBlock: (id) => set((state) => {
    const removeRecursive = (nodes: UIBlock[]): UIBlock[] => {
      return nodes.filter(node => node.id !== id).map(node => ({
        ...node,
        children: node.children ? removeRecursive(node.children) : undefined
      }));
    };
    const newLayout = removeRecursive(state.layout);
    const newHistory = [...state.history, [...state.layout]].slice(-50);
    return {
      layout: newLayout,
      selectedBlockId: state.selectedBlockId === id ? null : state.selectedBlockId,
      history: newHistory,
      _futureStates: []
    };
  }),

  moveBlock: (activeId, overId) => set((state) => {
    const oldIndex = state.layout.findIndex((x) => x.id === activeId);
    const newIndex = state.layout.findIndex((x) => x.id === overId);

    if (oldIndex === -1 || newIndex === -1) return state;

    const newLayout = [...state.layout];
    const [movedItem] = newLayout.splice(oldIndex, 1);
    newLayout.splice(newIndex, 0, movedItem);

    const newHistory = [...state.history, [...state.layout]].slice(-50);
    return { layout: newLayout, history: newHistory, _futureStates: [] };
  }),

  duplicateBlock: (id) => set((state) => {
    const blockToDuplicate = state.layout.find((b) => b.id === id);
    if (!blockToDuplicate) return state;

    const duplicatedBlock: UIBlock = {
      ...blockToDuplicate,
      id: crypto.randomUUID(),
      label: `${blockToDuplicate.label} (copy)`,
    };

    const index = state.layout.findIndex((b) => b.id === id);
    const newLayout = [...state.layout];
    newLayout.splice(index + 1, 0, duplicatedBlock);

    const newHistory = [...state.history, [...state.layout]].slice(-50);
    return { layout: newLayout, history: newHistory, _futureStates: [] };
  }),
}));
