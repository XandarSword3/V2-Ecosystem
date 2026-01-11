import { useModuleBuilderStore } from '@/store/module-builder-store';
import { X } from 'lucide-react';

export function PropertyPanel() {
  const { selectedBlockId, layout, updateBlock, selectBlock } = useModuleBuilderStore();

  const selectedBlock = selectedBlockId 
    ? layout.find(b => b.id === selectedBlockId) 
    : null;

  if (!selectedBlock) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500">
        Select a component on the canvas to edit its properties
      </div>
    );
  }

  const handleChange = (key: string, value: any) => {
    updateBlock(selectedBlock.id, {
        props: { ...selectedBlock.props, [key]: value }
    });
  };

  return (
    <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="font-semibold text-slate-900 dark:text-white">Properties</h3>
            <button onClick={() => selectBlock(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            
            {/* Common Props */}
            <div className="space-y-3">
                <label className="text-xs font-semibold uppercase text-slate-500">General</label>
                <div>
                    <label className="mb-1 block text-sm">Label</label>
                    <input 
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700" 
                        value={selectedBlock.label || ''}
                        onChange={(e) => updateBlock(selectedBlock.id, { label: e.target.value })}
                    />
                </div>
                
                <div>
                    <label className="mb-1 block text-sm">Width</label>
                    <select
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                        value={selectedBlock.style?.width || '100%'}
                        onChange={(e) => updateBlock(selectedBlock.id, { 
                            style: { ...selectedBlock.style, width: e.target.value } 
                        })}
                    >
                        <option value="100%">Full Width (100%)</option>
                        <option value="75%">3/4 Width</option>
                        <option value="66%">2/3 Width</option>
                        <option value="50%">1/2 Width</option>
                        <option value="33%">1/3 Width</option>
                        <option value="25%">1/4 Width</option>
                    </select>
                </div>
            </div>

            <hr className="border-slate-100 dark:border-slate-700" />

            {/* Type Specific Props */}
            <div className="space-y-3">
                <label className="text-xs font-semibold uppercase text-slate-500">
                    {selectedBlock.type} Configuration
                </label>

                {selectedBlock.type === 'hero' && (
                    <>
                        <div>
                            <label className="mb-1 block text-sm">Title</label>
                            <input 
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                value={selectedBlock.props.title || ''}
                                onChange={(e) => handleChange('title', e.target.value)}
                                placeholder="Enter hero title..."
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm">Subtitle</label>
                            <input 
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                value={selectedBlock.props.subtitle || ''}
                                onChange={(e) => handleChange('subtitle', e.target.value)}
                                placeholder="Enter subtitle..."
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm">Background Image URL</label>
                            <input 
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                value={selectedBlock.props.backgroundImage || ''}
                                onChange={(e) => handleChange('backgroundImage', e.target.value)}
                            />
                        </div>
                    </>
                )}

                {selectedBlock.type === 'grid' && (
                    <>
                         <div>
                            <label className="mb-1 block text-sm">Data Source</label>
                            <select 
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                value={selectedBlock.props.dataSource || 'menu'}
                                onChange={(e) => handleChange('dataSource', e.target.value)}
                            >
                                <option value="menu">Menu Items</option>
                                <option value="chalets">Chalets</option>
                                <option value="events">Events</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm">Columns</label>
                            <select 
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                value={selectedBlock.props.columns || '3'}
                                onChange={(e) => handleChange('columns', e.target.value)}
                            >
                                <option value="1">1 Column</option>
                                <option value="2">2 Columns</option>
                                <option value="3">3 Columns</option>
                                <option value="4">4 Columns</option>
                            </select>
                        </div>
                    </>
                )}

                 {selectedBlock.type === 'text_block' && (
                    <div>
                         <label className="mb-1 block text-sm">Content</label>
                         <textarea 
                            className="w-full h-32 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                            value={selectedBlock.props.content || ''}
                            onChange={(e) => handleChange('content', e.target.value)}
                         />
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}
