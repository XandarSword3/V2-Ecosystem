import { create } from 'zustand';
import { UIBlock, UIComponentType } from '@/types/module-builder';

interface ModuleBuilderStore {
  activeModuleId: string | null;
  layout: UIBlock[];
  selectedBlockId: string | null;
  isPreview: boolean;
  
  // Actions
  setActiveModuleId: (id: string) => void;
  setLayout: (layout: UIBlock[]) => void;
  selectBlock: (id: string | null) => void;
  togglePreview: () => void;
  
  addBlock: (type: UIComponentType, parentId?: string) => void;
  updateBlock: (id: string, updates: Partial<UIBlock>) => void;
  removeBlock: (id: string) => void;
  moveBlock: (activeId: string, overId: string) => void; // Simplified for flat list initially
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

export const useModuleBuilderStore = create<ModuleBuilderStore>((set) => ({
  activeModuleId: null,
  layout: [],
  selectedBlockId: null,
  isPreview: false,

  setActiveModuleId: (id) => set({ activeModuleId: id }),
  setLayout: (layout) => set({ layout }),
  selectBlock: (id) => set({ selectedBlockId: id }),
  togglePreview: () => set((state) => ({ isPreview: !state.isPreview, selectedBlockId: null })),

  addBlock: (type, parentId) => set((state) => {
    const newBlock: UIBlock = {
      id: crypto.randomUUID(),
      type,
      label: `New ${type}`,
      props: {},
      children: type === 'container' || type === 'grid' || type === 'form_container' ? [] : undefined
    };

    if (!parentId) {
      return { layout: [...state.layout, newBlock] };
    }

    const newLayout = [...state.layout];
    // Deep update logic would go here for nested blocks
    return { layout: newLayout }; 
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
    return { layout: updateRecursive(state.layout) };
  }),

  removeBlock: (id) => set((state) => {
    const removeRecursive = (nodes: UIBlock[]): UIBlock[] => {
      return nodes.filter(node => node.id !== id).map(node => ({
        ...node,
        children: node.children ? removeRecursive(node.children) : undefined
      }));
    };
    return { 
      layout: removeRecursive(state.layout),
      selectedBlockId: state.selectedBlockId === id ? null : state.selectedBlockId
    };
  }),

  moveBlock: (activeId, overId) => set((state) => {
    // Basic reordering implementation for root level
    const oldIndex = state.layout.findIndex(x => x.id === activeId);
    const newIndex = state.layout.findIndex(x => x.id === overId);
    
    if (oldIndex === -1 || newIndex === -1) return state;

    const newLayout = [...state.layout];
    const [movedItem] = newLayout.splice(oldIndex, 1);
    newLayout.splice(newIndex, 0, movedItem);
    
    return { layout: newLayout };
  }),
}));
