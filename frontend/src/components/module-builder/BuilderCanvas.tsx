import { useModuleBuilderStore } from '@/stores/module-builder-store';
import { SortableBlock } from './SortableBlock';
import { Rnd } from 'react-rnd';
import { UIBlock } from '@/types/module-builder';
import { Module } from '@/lib/settings-context';

interface BuilderCanvasProps {
  module: Module;
}

export function BuilderCanvas({ module }: BuilderCanvasProps) {
  const { layout, updateBlock, zoom } = useModuleBuilderStore();

  const scaleStyle = {
    transform: `scale(${zoom / 100})`,
    transformOrigin: 'top left',
    transition: 'transform 0.2s ease-out',
    width: '1920px', // Fixed canvas width for PowerPoint style
    height: '1080px', // Fixed canvas height
    position: 'relative' as const,
    backgroundColor: '#ffffff',
    backgroundImage: `linear-gradient(to right, #f1f5f9 1px, transparent 1px), linear-gradient(to bottom, #f1f5f9 1px, transparent 1px)`,
    backgroundSize: '20px 20px',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    overflow: 'hidden',
  };

  const handleDragStop = (block: UIBlock, e: any, d: any) => {
    updateBlock(block.id, {
      position: {
        ...(block.position || {}),
        x: d.x,
        y: d.y,
      }
    });
  };

  const handleResizeStop = (block: UIBlock, e: any, direction: any, ref: any, delta: any, position: any) => {
    updateBlock(block.id, {
      position: {
        ...(block.position || {}),
        x: position.x,
        y: position.y,
        width: ref.style.width,
        height: ref.style.height,
      }
    });
  };

  return (
    <div className="h-full w-full overflow-auto bg-slate-200 dark:bg-slate-900 p-8 flex justify-center items-start">
      <div style={scaleStyle}>
        {layout.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 m-8 rounded-xl dark:border-slate-800">
              <p>Drag components from the toolbar or click to add</p>
              <div className="mt-4 text-xs">Start by adding a Hero Section or Grid</div>
          </div>
        ) : (
          layout.map((block) => (
            <Rnd
              key={block.id}
              default={{
                x: block.position?.x || 100,
                y: block.position?.y || 100,
                width: block.position?.width || '400px',
                height: block.position?.height || 'auto',
              }}
              position={{
                x: block.position?.x || 100,
                y: block.position?.y || 100,
              }}
              size={{
                width: block.position?.width || '400px',
                height: block.position?.height || 'auto',
              }}
              onDragStop={(e, d) => handleDragStop(block, e, d)}
              onResizeStop={(e, direction, ref, delta, position) => handleResizeStop(block, e, direction, ref, delta, position)}
              bounds="parent"
              dragGrid={[20, 20]}
              resizeGrid={[20, 20]}
              style={{ zIndex: block.position?.z || 1 }}
              dragHandleClassName="drag-handle"
            >
              <SortableBlock block={block} module={module} />
            </Rnd>
          ))
        )}
      </div>
    </div>
  );
}
