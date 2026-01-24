import { create } from 'zustand';
import { UIBlock, UIComponentType } from '@/types/module-builder';

interface ModuleBuilderStore {
  activeModuleId: string | null;
  layout: UIBlock[];
  selectedBlockId: string | null;
  isPreview: boolean;
  zoom: number;
  history: UIBlock[][];
  historyIndex: number;
  _futureStates: UIBlock[][];
  
  // Actions
  setActiveModuleId: (id: string) => void;
  setLayout: (layout: UIBlock[], skipHistory?: boolean) => void;
  selectBlock: (id: string | null) => void;
  togglePreview: () => void;
  setZoom: (zoom: number) => void;
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
    const defaultProps: Record<string, string | number | boolean> = {};
    
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
    }
    
    const newBlock: UIBlock = {
      id: crypto.randomUUID(),
      type,
      label: `New ${type}`,
      props: defaultProps,
      style: { width: '100%' },
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
