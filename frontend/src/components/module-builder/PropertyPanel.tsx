import { useModuleBuilderStore } from '@/store/module-builder-store';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

export function PropertyPanel() {
  const { selectedBlockId, layout, updateBlock, selectBlock } = useModuleBuilderStore();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    general: true,
    style: true,
    config: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const selectedBlock = selectedBlockId 
    ? layout.find(b => b.id === selectedBlockId) 
    : null;

  if (!selectedBlock) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-sm text-slate-500">
        <div className="mb-4 text-4xl">🎨</div>
        <p className="font-medium">No component selected</p>
        <p className="mt-1 text-xs">Click a component on the canvas to edit its properties</p>
      </div>
    );
  }

  const handleChange = (key: string, value: string | number | boolean) => {
    updateBlock(selectedBlock.id, {
        props: { ...selectedBlock.props, [key]: value }
    });
  };

  const handleStyleChange = (key: string, value: string | number) => {
    updateBlock(selectedBlock.id, {
        style: { ...selectedBlock.style, [key]: value }
    });
  };

  const SectionHeader = ({ title, section }: { title: string; section: string }) => (
    <button
      onClick={() => toggleSection(section)}
      className="flex w-full items-center justify-between text-xs font-semibold uppercase text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
    >
      {title}
      {expandedSections[section] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
    </button>
  );

  return (
    <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Properties</h3>
              <p className="text-xs text-slate-500 capitalize">{selectedBlock.type.replace('_', ' ')}</p>
            </div>
            <button onClick={() => selectBlock(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
            
            {/* General Props */}
            <div className="space-y-3">
                <SectionHeader title="General" section="general" />
                {expandedSections.general && (
                  <div className="space-y-3 pt-2">
                    <div>
                        <label className="mb-1 block text-sm">Label</label>
                        <input 
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700" 
                            value={selectedBlock.label || ''}
                            onChange={(e) => updateBlock(selectedBlock.id, { label: e.target.value })}
                        />
                    </div>
                  </div>
                )}
            </div>

            <hr className="border-slate-100 dark:border-slate-700" />

            {/* Style Props */}
            <div className="space-y-3">
                <SectionHeader title="Dimensions & Spacing" section="style" />
                {expandedSections.style && (
                  <div className="space-y-3 pt-2">
                    <div>
                        <label className="mb-1 block text-sm">Width</label>
                        <select
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                            value={selectedBlock.style?.width || '100%'}
                            onChange={(e) => handleStyleChange('width', e.target.value)}
                        >
                            <option value="100%">Full Width (100%)</option>
                            <option value="75%">3/4 Width (75%)</option>
                            <option value="66%">2/3 Width (66%)</option>
                            <option value="50%">1/2 Width (50%)</option>
                            <option value="33%">1/3 Width (33%)</option>
                            <option value="25%">1/4 Width (25%)</option>
                        </select>
                    </div>
                    
                    <div>
                        <label className="mb-1 block text-sm">Height</label>
                        <select
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                            value={selectedBlock.style?.height || 'auto'}
                            onChange={(e) => handleStyleChange('height', e.target.value)}
                        >
                            <option value="auto">Auto</option>
                            <option value="100px">Small (100px)</option>
                            <option value="200px">Medium (200px)</option>
                            <option value="300px">Large (300px)</option>
                            <option value="400px">Extra Large (400px)</option>
                            <option value="500px">XXL (500px)</option>
                            <option value="100vh">Full Screen</option>
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm">Padding</label>
                        <select
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                            value={selectedBlock.style?.padding || '0'}
                            onChange={(e) => handleStyleChange('padding', e.target.value)}
                        >
                            <option value="0">None</option>
                            <option value="8px">Small (8px)</option>
                            <option value="16px">Medium (16px)</option>
                            <option value="24px">Large (24px)</option>
                            <option value="32px">Extra Large (32px)</option>
                            <option value="48px">XXL (48px)</option>
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm">Border Radius</label>
                        <select
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                            value={selectedBlock.style?.borderRadius || '0'}
                            onChange={(e) => handleStyleChange('borderRadius', e.target.value)}
                        >
                            <option value="0">None</option>
                            <option value="4px">Small (4px)</option>
                            <option value="8px">Medium (8px)</option>
                            <option value="12px">Large (12px)</option>
                            <option value="16px">Extra Large (16px)</option>
                            <option value="9999px">Pill</option>
                        </select>
                    </div>
                  </div>
                )}
            </div>

            <hr className="border-slate-100 dark:border-slate-700" />

            {/* Type Specific Props */}
            <div className="space-y-3">
                <SectionHeader title={`${selectedBlock.type.replace('_', ' ')} Settings`} section="config" />
                {expandedSections.config && (
                  <div className="space-y-3 pt-2">
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
                                    placeholder="https://..."
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm">Text Alignment</label>
                                <select
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                    value={selectedBlock.props.textAlign || 'center'}
                                    onChange={(e) => handleChange('textAlign', e.target.value)}
                                >
                                    <option value="left">Left</option>
                                    <option value="center">Center</option>
                                    <option value="right">Right</option>
                                </select>
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
                            <div>
                                <label className="mb-1 block text-sm">Gap</label>
                                <select 
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                    value={selectedBlock.style?.gap || '16px'}
                                    onChange={(e) => handleStyleChange('gap', e.target.value)}
                                >
                                    <option value="8px">Small (8px)</option>
                                    <option value="16px">Medium (16px)</option>
                                    <option value="24px">Large (24px)</option>
                                    <option value="32px">Extra Large (32px)</option>
                                </select>
                            </div>
                        </>
                    )}

                     {selectedBlock.type === 'text_block' && (
                        <>
                            <div>
                                 <label className="mb-1 block text-sm">Content</label>
                                 <textarea 
                                    className="w-full h-32 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                    value={selectedBlock.props.content || ''}
                                    onChange={(e) => handleChange('content', e.target.value)}
                                    placeholder="Enter your text content..."
                                 />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm">Font Size</label>
                                <select 
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                    value={selectedBlock.props.fontSize || 'base'}
                                    onChange={(e) => handleChange('fontSize', e.target.value)}
                                >
                                    <option value="sm">Small</option>
                                    <option value="base">Normal</option>
                                    <option value="lg">Large</option>
                                    <option value="xl">Extra Large</option>
                                    <option value="2xl">2X Large</option>
                                </select>
                            </div>
                        </>
                    )}

                    {selectedBlock.type === 'image' && (
                        <>
                            <div>
                                <label className="mb-1 block text-sm">Image URL</label>
                                <input 
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                    value={selectedBlock.props.src || ''}
                                    onChange={(e) => handleChange('src', e.target.value)}
                                    placeholder="https://..."
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm">Alt Text</label>
                                <input 
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                    value={selectedBlock.props.alt || ''}
                                    onChange={(e) => handleChange('alt', e.target.value)}
                                    placeholder="Image description..."
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm">Object Fit</label>
                                <select 
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                    value={selectedBlock.props.objectFit || 'cover'}
                                    onChange={(e) => handleChange('objectFit', e.target.value)}
                                >
                                    <option value="cover">Cover</option>
                                    <option value="contain">Contain</option>
                                    <option value="fill">Fill</option>
                                    <option value="none">None</option>
                                </select>
                            </div>
                        </>
                    )}

                    {selectedBlock.type === 'menu_list' && (
                        <div className="p-3 bg-amber-50 rounded text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                            <p className="font-medium">Menu List Component</p>
                            <p className="mt-1 text-xs">This component automatically displays menu items from the current module.</p>
                        </div>
                    )}

                    {selectedBlock.type === 'session_list' && (
                        <div className="p-3 bg-blue-50 rounded text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                            <p className="font-medium">Session List Component</p>
                            <p className="mt-1 text-xs">This component automatically displays bookable sessions with a date picker.</p>
                        </div>
                    )}

                    {selectedBlock.type === 'booking_calendar' && (
                        <div className="p-3 bg-green-50 rounded text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
                            <p className="font-medium">Booking Calendar Component</p>
                            <p className="mt-1 text-xs">This component displays check-in/check-out date pickers for multi-day bookings.</p>
                        </div>
                    )}
                  </div>
                )}
            </div>
        </div>
    </div>
  );
}
