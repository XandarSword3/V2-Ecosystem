import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useModuleBuilderStore } from '@/store/module-builder-store';
import { SortableBlock } from './SortableBlock';

export function BuilderCanvas() {
  const { layout, setLayout, moveBlock } = useModuleBuilderStore();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
        moveBlock(active.id as string, over.id as string);
    }
  }

  return (
    <div className="min-h-full w-full p-8">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={layout.map(b => b.id)}
          strategy={verticalListSortingStrategy}
        >
          {layout.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl dark:border-slate-800">
                <p>Drag components from the toolbar or click to add</p>
                <div className="mt-4 text-xs">Start by adding a Hero Section or Grid</div>
            </div>
          ) : (
             <div className="space-y-4">
               {layout.map((block) => (
                 <SortableBlock key={block.id} block={block} />
               ))}
             </div>
          )}
        </SortableContext>
      </DndContext>
    </div>
  );
}
