/**
 * Tests for module-builder-store (Zustand) — undo/redo, layout management
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useModuleBuilderStore } from '@/stores/module-builder-store';

describe('module-builder-store', () => {
  beforeEach(() => {
    useModuleBuilderStore.setState({
      activeModuleId: null,
      layout: [],
      selectedBlockId: null,
      isPreview: false,
      zoom: 100,
      history: [],
      historyIndex: -1,
      _futureStates: [],
    });
  });

  describe('basic state', () => {
    it('starts with empty layout', () => {
      expect(useModuleBuilderStore.getState().layout).toEqual([]);
    });

    it('starts with zoom at 100', () => {
      expect(useModuleBuilderStore.getState().zoom).toBe(100);
    });

    it('starts not in preview mode', () => {
      expect(useModuleBuilderStore.getState().isPreview).toBe(false);
    });
  });

  describe('setActiveModuleId', () => {
    it('sets the active module ID', () => {
      useModuleBuilderStore.getState().setActiveModuleId('module-1');
      expect(useModuleBuilderStore.getState().activeModuleId).toBe('module-1');
    });
  });

  describe('selectBlock', () => {
    it('selects a block by id', () => {
      useModuleBuilderStore.getState().selectBlock('block-1');
      expect(useModuleBuilderStore.getState().selectedBlockId).toBe('block-1');
    });

    it('deselects with null', () => {
      useModuleBuilderStore.getState().selectBlock('block-1');
      useModuleBuilderStore.getState().selectBlock(null);
      expect(useModuleBuilderStore.getState().selectedBlockId).toBeNull();
    });
  });

  describe('togglePreview', () => {
    it('toggles preview mode on', () => {
      useModuleBuilderStore.getState().togglePreview();
      expect(useModuleBuilderStore.getState().isPreview).toBe(true);
    });

    it('clears selection when entering preview', () => {
      useModuleBuilderStore.getState().selectBlock('block-1');
      useModuleBuilderStore.getState().togglePreview();
      expect(useModuleBuilderStore.getState().selectedBlockId).toBeNull();
    });

    it('toggles back off', () => {
      useModuleBuilderStore.getState().togglePreview();
      useModuleBuilderStore.getState().togglePreview();
      expect(useModuleBuilderStore.getState().isPreview).toBe(false);
    });
  });

  describe('setZoom', () => {
    it('sets zoom level', () => {
      useModuleBuilderStore.getState().setZoom(120);
      expect(useModuleBuilderStore.getState().zoom).toBe(120);
    });

    it('clamps zoom to minimum of 50', () => {
      useModuleBuilderStore.getState().setZoom(10);
      expect(useModuleBuilderStore.getState().zoom).toBe(50);
    });

    it('clamps zoom to maximum of 150', () => {
      useModuleBuilderStore.getState().setZoom(200);
      expect(useModuleBuilderStore.getState().zoom).toBe(150);
    });
  });

  describe('setLayout with history', () => {
    it('sets the layout', () => {
      const layout = [{ id: 'b1', type: 'hero' as any, props: {}, children: [] }];
      useModuleBuilderStore.getState().setLayout(layout);
      expect(useModuleBuilderStore.getState().layout).toEqual(layout);
    });

    it('pushes previous layout to history', () => {
      const layout1 = [{ id: 'b1', type: 'hero' as any, props: {}, children: [] }];
      const layout2 = [{ id: 'b2', type: 'text' as any, props: {}, children: [] }];
      
      useModuleBuilderStore.getState().setLayout(layout1);
      useModuleBuilderStore.getState().setLayout(layout2);
      
      expect(useModuleBuilderStore.getState().history).toHaveLength(2);
    });

    it('caps history at 50 entries', () => {
      for (let i = 0; i < 55; i++) {
        useModuleBuilderStore.getState().setLayout([
          { id: `b-${i}`, type: 'hero' as any, props: {}, children: [] },
        ]);
      }

      expect(useModuleBuilderStore.getState().history).toHaveLength(50);
    });

    it('skips history when skipHistory=true', () => {
      const layout = [{ id: 'b1', type: 'hero' as any, props: {}, children: [] }];
      useModuleBuilderStore.getState().setLayout(layout, true);
      expect(useModuleBuilderStore.getState().history).toHaveLength(0);
    });

    it('clears future states on new change', () => {
      const layout1 = [{ id: 'b1', type: 'hero' as any, props: {}, children: [] }];
      const layout2 = [{ id: 'b2', type: 'text' as any, props: {}, children: [] }];
      const layout3 = [{ id: 'b3', type: 'image' as any, props: {}, children: [] }];

      useModuleBuilderStore.getState().setLayout(layout1);
      useModuleBuilderStore.getState().setLayout(layout2);
      useModuleBuilderStore.getState().undo();
      // Now future has layout2
      useModuleBuilderStore.getState().setLayout(layout3);
      // Future should be cleared
      expect(useModuleBuilderStore.getState()._futureStates).toHaveLength(0);
    });
  });

  describe('undo/redo', () => {
    it('canUndo returns false for empty history', () => {
      expect(useModuleBuilderStore.getState().canUndo()).toBe(false);
    });

    it('canUndo returns true after layout change', () => {
      useModuleBuilderStore.getState().setLayout([{ id: 'b1', type: 'hero' as any, props: {}, children: [] }]);
      expect(useModuleBuilderStore.getState().canUndo()).toBe(true);
    });

    it('undo restores previous layout', () => {
      const layout1 = [{ id: 'b1', type: 'hero' as any, props: {}, children: [] }];
      const layout2 = [{ id: 'b2', type: 'text' as any, props: {}, children: [] }];

      useModuleBuilderStore.getState().setLayout(layout1);
      useModuleBuilderStore.getState().setLayout(layout2);
      useModuleBuilderStore.getState().undo();

      // After undo, layout should be layout1
      expect(useModuleBuilderStore.getState().layout[0].id).toBe('b1');
    });

    it('canRedo returns false initially', () => {
      expect(useModuleBuilderStore.getState().canRedo()).toBe(false);
    });

    it('canRedo returns true after undo', () => {
      useModuleBuilderStore.getState().setLayout([{ id: 'b1', type: 'hero' as any, props: {}, children: [] }]);
      useModuleBuilderStore.getState().undo();
      expect(useModuleBuilderStore.getState().canRedo()).toBe(true);
    });

    it('redo restores undone layout', () => {
      const layout1 = [{ id: 'b1', type: 'hero' as any, props: {}, children: [] }];
      useModuleBuilderStore.getState().setLayout(layout1);
      useModuleBuilderStore.getState().undo();
      useModuleBuilderStore.getState().redo();

      expect(useModuleBuilderStore.getState().layout[0].id).toBe('b1');
    });

    it('undo on empty history does nothing', () => {
      useModuleBuilderStore.getState().undo();
      expect(useModuleBuilderStore.getState().layout).toEqual([]);
    });

    it('redo on empty future does nothing', () => {
      useModuleBuilderStore.getState().redo();
      expect(useModuleBuilderStore.getState().layout).toEqual([]);
    });
  });

  describe('addBlock', () => {
    it('adds a block to layout', () => {
      useModuleBuilderStore.getState().addBlock('hero');
      expect(useModuleBuilderStore.getState().layout).toHaveLength(1);
      expect(useModuleBuilderStore.getState().layout[0].type).toBe('hero');
    });

    it('adds multiple blocks', () => {
      useModuleBuilderStore.getState().addBlock('hero');
      useModuleBuilderStore.getState().addBlock('text');
      expect(useModuleBuilderStore.getState().layout).toHaveLength(2);
    });

    it('generates unique IDs', () => {
      useModuleBuilderStore.getState().addBlock('hero');
      useModuleBuilderStore.getState().addBlock('hero');
      const ids = useModuleBuilderStore.getState().layout.map(b => b.id);
      expect(new Set(ids).size).toBe(2);
    });

    it('adds type-specific default props for testimonials', () => {
      useModuleBuilderStore.getState().addBlock('testimonials');
      const added = useModuleBuilderStore.getState().layout[0];

      expect(added.props.source).toBe('static');
      expect(added.props.count).toBe(3);
      expect(added.props.showRatings).toBe(true);
    });

    it('adds nested children container for form_container', () => {
      useModuleBuilderStore.getState().addBlock('form_container');
      const added = useModuleBuilderStore.getState().layout[0];

      expect(Array.isArray(added.children)).toBe(true);
      expect(added.children).toEqual([]);
      expect(added.props.formAction).toBe('contact');
      expect(added.props.submitText).toBe('Submit');
    });
  });

  describe('removeBlock', () => {
    it('removes a block by id', () => {
      useModuleBuilderStore.getState().addBlock('hero');
      const blockId = useModuleBuilderStore.getState().layout[0].id;
      useModuleBuilderStore.getState().removeBlock(blockId);
      expect(useModuleBuilderStore.getState().layout).toHaveLength(0);
    });

    it('clears selectedBlockId when removing selected block', () => {
      useModuleBuilderStore.getState().setLayout([
        { id: 'hero-1', type: 'hero' as any, props: {}, children: [] },
      ]);
      useModuleBuilderStore.getState().selectBlock('hero-1');

      useModuleBuilderStore.getState().removeBlock('hero-1');

      expect(useModuleBuilderStore.getState().selectedBlockId).toBeNull();
    });
  });

  describe('updateBlock', () => {
    it('updates root block fields', () => {
      useModuleBuilderStore.getState().setLayout([
        { id: 'root-1', type: 'hero' as any, label: 'Old', props: {}, children: [] },
      ]);

      useModuleBuilderStore.getState().updateBlock('root-1', {
        label: 'Updated label',
        props: { title: 'Updated title' },
      });

      const updated = useModuleBuilderStore.getState().layout[0];
      expect(updated.label).toBe('Updated label');
      expect(updated.props.title).toBe('Updated title');
    });

    it('updates nested child block by id', () => {
      useModuleBuilderStore.getState().setLayout([
        {
          id: 'parent',
          type: 'container' as any,
          props: {},
          children: [
            { id: 'child', type: 'text_block' as any, label: 'Child', props: { content: 'old' }, children: [] },
          ],
        },
      ]);

      useModuleBuilderStore.getState().updateBlock('child', {
        label: 'Child updated',
      });

      const child = useModuleBuilderStore.getState().layout[0].children?.[0];
      expect(child?.label).toBe('Child updated');
      expect(child?.props.content).toBe('old');
    });
  });

  describe('moveBlock', () => {
    it('reorders blocks when both IDs exist', () => {
      useModuleBuilderStore.getState().setLayout([
        { id: 'a', type: 'hero' as any, props: {}, children: [] },
        { id: 'b', type: 'text_block' as any, props: {}, children: [] },
        { id: 'c', type: 'button' as any, props: {}, children: [] },
      ]);

      useModuleBuilderStore.getState().moveBlock('a', 'c');

      expect(useModuleBuilderStore.getState().layout.map((b) => b.id)).toEqual(['b', 'c', 'a']);
    });

    it('does nothing when active or over IDs are not found', () => {
      useModuleBuilderStore.getState().setLayout([
        { id: 'a', type: 'hero' as any, props: {}, children: [] },
        { id: 'b', type: 'text_block' as any, props: {}, children: [] },
      ]);

      useModuleBuilderStore.getState().moveBlock('missing', 'b');

      expect(useModuleBuilderStore.getState().layout.map((b) => b.id)).toEqual(['a', 'b']);
    });
  });

  describe('duplicateBlock', () => {
    it('duplicates a block after its original', () => {
      useModuleBuilderStore.getState().setLayout([
        { id: 'first', type: 'hero' as any, label: 'Hero', props: { title: 'Welcome' }, children: [] },
      ]);

      useModuleBuilderStore.getState().duplicateBlock('first');

      const layout = useModuleBuilderStore.getState().layout;
      expect(layout).toHaveLength(2);
      expect(layout[0].id).toBe('first');
      expect(layout[1].id).not.toBe('first');
      expect(layout[1].label).toBe('Hero (copy)');
      expect(layout[1].props.title).toBe('Welcome');
    });

    it('does nothing when target block does not exist', () => {
      useModuleBuilderStore.getState().setLayout([
        { id: 'first', type: 'hero' as any, props: {}, children: [] },
      ]);

      useModuleBuilderStore.getState().duplicateBlock('missing');

      expect(useModuleBuilderStore.getState().layout).toHaveLength(1);
    });
  });
});
