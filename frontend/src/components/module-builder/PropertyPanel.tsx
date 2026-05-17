import { useModuleBuilderStore } from '@/stores/module-builder-store';
import { X, ChevronDown, ChevronUp, Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';
import { useState } from 'react';

export function PropertyPanel() {
    const { selectedBlockId, layout, updateBlock, selectBlock } = useModuleBuilderStore();
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        general: true,
        textFormat: true,
        style: true,
        position: false,
        border: true,
        effects: true,
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

    const handlePositionChange = (key: string, value: number | string) => {
        updateBlock(selectedBlock.id, {
            position: { ...selectedBlock.position, [key]: value }
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

                {/* Text Formatting - PowerPoint Style */}
                <div className="space-y-3">
                    <SectionHeader title="Font" section="textFormat" />
                    {expandedSections.textFormat && (
                        <div className="space-y-3 pt-2">
                            {/* Font Family */}
                            <div>
                                <label className="mb-1 block text-sm">Font Family</label>
                                <input
                                    list="fontFamilyOptions"
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                    value={selectedBlock.style?.fontFamily || ''}
                                    onChange={(e) => handleStyleChange('fontFamily', e.target.value)}
                                    placeholder="inherit"
                                />
                                <datalist id="fontFamilyOptions">
                                    <option value="inherit">Default</option>
                                    <option value="Arial, sans-serif">Arial</option>
                                    <option value="Georgia, serif">Georgia</option>
                                    <option value="Times New Roman, serif">Times New Roman</option>
                                    <option value="Helvetica, sans-serif">Helvetica</option>
                                    <option value="Verdana, sans-serif">Verdana</option>
                                    <option value="Courier New, monospace">Courier New</option>
                                    <option value="Impact, sans-serif">Impact</option>
                                    <option value="Comic Sans MS, cursive">Comic Sans MS</option>
                                </datalist>
                            </div>

                            {/* Font Size */}
                            <div>
                                <label className="mb-1 block text-sm">Size</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range"
                                        min="10"
                                        max="120"
                                        step="1"
                                        className="flex-1"
                                        value={parseInt(String(selectedBlock.style?.fontSize || '16').replace('px', '')) || 16}
                                        onChange={(e) => handleStyleChange('fontSize', e.target.value + 'px')}
                                    />
                                    <input
                                        type="text"
                                        className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm text-right focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                        value={selectedBlock.style?.fontSize || ''}
                                        onChange={(e) => handleStyleChange('fontSize', e.target.value)}
                                        placeholder="16px"
                                    />
                                </div>
                            </div>

                            {/* Font Style Toolbar */}
                            <div>
                                <label className="mb-1 block text-sm">Format</label>
                                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg dark:bg-slate-800">
                                    <button
                                        onClick={() => handleStyleChange('fontWeight', selectedBlock.style?.fontWeight === 'bold' ? 'normal' : 'bold')}
                                        className={`p-2 rounded ${selectedBlock.style?.fontWeight === 'bold' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                                        title="Bold"
                                    >
                                        <Bold className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleStyleChange('fontStyle', selectedBlock.style?.fontStyle === 'italic' ? 'normal' : 'italic')}
                                        className={`p-2 rounded ${selectedBlock.style?.fontStyle === 'italic' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                                        title="Italic"
                                    >
                                        <Italic className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleStyleChange('textDecoration', selectedBlock.style?.textDecoration === 'underline' ? 'none' : 'underline')}
                                        className={`p-2 rounded ${selectedBlock.style?.textDecoration === 'underline' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                                        title="Underline"
                                    >
                                        <Underline className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleStyleChange('textDecoration', selectedBlock.style?.textDecoration === 'line-through' ? 'none' : 'line-through')}
                                        className={`p-2 rounded ${selectedBlock.style?.textDecoration === 'line-through' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                                        title="Strikethrough"
                                    >
                                        <Strikethrough className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Font Color */}
                            <div>
                                <label className="mb-1 block text-sm">Font Color</label>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {['#000000', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#94a3b8'].map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => handleStyleChange('color', color)}
                                            className={`w-6 h-6 rounded border-2 ${(selectedBlock.style?.color || '#000000') === color ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-slate-300 dark:border-slate-600'}`}
                                            style={{ backgroundColor: color }}
                                            title={color}
                                        />
                                    ))}
                                    <div className="flex items-center gap-2 ml-2">
                                        <input
                                            type="color"
                                            className="w-8 h-8 rounded cursor-pointer"
                                            value={selectedBlock.style?.color || '#000000'}
                                            onChange={(e) => handleStyleChange('color', e.target.value)}
                                        />
                                        <input
                                            type="text"
                                            className="w-20 rounded border border-slate-300 px-2 py-1 text-sm dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.style?.color || ''}
                                            onChange={(e) => handleStyleChange('color', e.target.value)}
                                            placeholder="#000000"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Text Alignment */}
                            <div>
                                <label className="mb-1 block text-sm">Alignment</label>
                                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg dark:bg-slate-800">
                                    <button
                                        onClick={() => handleStyleChange('textAlign', 'left')}
                                        className={`p-2 rounded ${(selectedBlock.style?.textAlign || 'left') === 'left' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                                        title="Align Left"
                                    >
                                        <AlignLeft className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleStyleChange('textAlign', 'center')}
                                        className={`p-2 rounded ${selectedBlock.style?.textAlign === 'center' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                                        title="Center"
                                    >
                                        <AlignCenter className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleStyleChange('textAlign', 'right')}
                                        className={`p-2 rounded ${selectedBlock.style?.textAlign === 'right' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                                        title="Align Right"
                                    >
                                        <AlignRight className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleStyleChange('textAlign', 'justify')}
                                        className={`p-2 rounded ${selectedBlock.style?.textAlign === 'justify' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                                        title="Justify"
                                    >
                                        <AlignJustify className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Line Height */}
                            <div>
                                <label className="mb-1 block text-sm">Line Height</label>
                                <input
                                    list="lineHeightOptions"
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                    value={selectedBlock.style?.lineHeight || ''}
                                    onChange={(e) => handleStyleChange('lineHeight', e.target.value)}
                                    placeholder="1.5"
                                />
                                <datalist id="lineHeightOptions">
                                    <option value="1">Single (1.0)</option>
                                    <option value="1.25">Tight (1.25)</option>
                                    <option value="1.5">Normal (1.5)</option>
                                    <option value="1.75">Relaxed (1.75)</option>
                                    <option value="2">Double (2.0)</option>
                                </datalist>
                            </div>

                            {/* Letter Spacing */}
                            <div>
                                <label className="mb-1 block text-sm">Letter Spacing</label>
                                <input
                                    list="letterSpacingOptions"
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                    value={selectedBlock.style?.letterSpacing || ''}
                                    onChange={(e) => handleStyleChange('letterSpacing', e.target.value)}
                                    placeholder="normal"
                                />
                                <datalist id="letterSpacingOptions">
                                    <option value="-0.05em">Tight (-0.05em)</option>
                                    <option value="normal">Normal</option>
                                    <option value="0.05em">Wide (0.05em)</option>
                                    <option value="0.1em">Wider (0.1em)</option>
                                </datalist>
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
                                <input
                                    list="widthOptions"
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                    value={selectedBlock.style?.width || ''}
                                    onChange={(e) => handleStyleChange('width', e.target.value)}
                                    placeholder="100%"
                                />
                                <datalist id="widthOptions">
                                    <option value="100%">Full Width (100%)</option>
                                    <option value="75%">3/4 Width (75%)</option>
                                    <option value="66%">2/3 Width (66%)</option>
                                    <option value="50%">1/2 Width (50%)</option>
                                    <option value="33%">1/3 Width (33%)</option>
                                    <option value="25%">1/4 Width (25%)</option>
                                </datalist>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm">Height</label>
                                <input
                                    list="heightOptions"
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                    value={selectedBlock.style?.height || ''}
                                    onChange={(e) => handleStyleChange('height', e.target.value)}
                                    placeholder="auto"
                                />
                                <datalist id="heightOptions">
                                    <option value="auto">Auto</option>
                                    <option value="100px">Small (100px)</option>
                                    <option value="200px">Medium (200px)</option>
                                    <option value="300px">Large (300px)</option>
                                    <option value="400px">Extra Large (400px)</option>
                                    <option value="500px">XXL (500px)</option>
                                    <option value="100vh">Full Screen</option>
                                </datalist>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm">Padding</label>
                                <input
                                    list="paddingOptions"
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                    value={selectedBlock.style?.padding || ''}
                                    onChange={(e) => handleStyleChange('padding', e.target.value)}
                                    placeholder="0"
                                />
                                <datalist id="paddingOptions">
                                    <option value="0">None</option>
                                    <option value="8px">Small (8px)</option>
                                    <option value="16px">Medium (16px)</option>
                                    <option value="24px">Large (24px)</option>
                                    <option value="32px">Extra Large (32px)</option>
                                    <option value="48px">XXL (48px)</option>
                                </datalist>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm">Border Radius</label>
                                <input
                                    list="borderRadiusOptions"
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                    value={selectedBlock.style?.borderRadius || ''}
                                    onChange={(e) => handleStyleChange('borderRadius', e.target.value)}
                                    placeholder="0"
                                />
                                <datalist id="borderRadiusOptions">
                                    <option value="0">None</option>
                                    <option value="4px">Small (4px)</option>
                                    <option value="8px">Medium (8px)</option>
                                    <option value="12px">Large (12px)</option>
                                    <option value="16px">Extra Large (16px)</option>
                                    <option value="9999px">Pill</option>
                                </datalist>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm">Background Color</label>
                                <div className="flex gap-2 flex-wrap">
                                    {['transparent', '#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#1e293b', '#0f172a', '#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#22c55e', '#06b6d4'].map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => handleStyleChange('backgroundColor', color)}
                                            className={`w-7 h-7 rounded border-2 ${(selectedBlock.style?.backgroundColor || 'transparent') === color ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-slate-300 dark:border-slate-600'}`}
                                            style={{ backgroundColor: color === 'transparent' ? 'transparent' : color, backgroundImage: color === 'transparent' ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)' : 'none', backgroundSize: '8px 8px', backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px' }}
                                            title={color}
                                        />
                                    ))}
                                </div>
                                <input
                                    type="text"
                                    className="w-full mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                    value={selectedBlock.style?.backgroundColor || ''}
                                    onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                                    placeholder="Custom: #hex or rgb()"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm">Text Color</label>
                                <div className="flex gap-2 flex-wrap">
                                    {['#0f172a', '#1e293b', '#334155', '#64748b', '#94a3b8', '#ffffff', '#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#22c55e', '#ef4444'].map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => handleStyleChange('color', color)}
                                            className={`w-7 h-7 rounded border-2 flex items-center justify-center ${(selectedBlock.style?.color || '#0f172a') === color ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-slate-300 dark:border-slate-600'}`}
                                            style={{ backgroundColor: '#f8fafc' }}
                                            title={color}
                                        >
                                            <span style={{ color, fontWeight: 'bold' }}>A</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <hr className="border-slate-100 dark:border-slate-700" />

                {/* Position - PowerPoint-style freeform canvas */}
                <div className="space-y-3">
                    <SectionHeader title="Position (Canvas)" section="position" />
                    {expandedSections.position && (
                        <div className="space-y-3 pt-2">
                            <p className="text-xs text-slate-400">Set X/Y to place this element freely on the canvas, like PowerPoint.</p>

                            {/* X Position */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="mb-1 block text-sm">X (left)</label>
                                    <input
                                        type="number"
                                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                        value={selectedBlock.position?.x ?? ''}
                                        onChange={(e) => handlePositionChange('x', e.target.value ? Number(e.target.value) : undefined as any)}
                                        placeholder="auto"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm">Y (top)</label>
                                    <input
                                        type="number"
                                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                        value={selectedBlock.position?.y ?? ''}
                                        onChange={(e) => handlePositionChange('y', e.target.value ? Number(e.target.value) : undefined as any)}
                                        placeholder="auto"
                                    />
                                </div>
                            </div>

                            {/* Z-Index */}
                            <div>
                                <label className="mb-1 block text-sm">Z-Index (stacking)</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="1"
                                        className="flex-1"
                                        value={selectedBlock.position?.z ?? 1}
                                        onChange={(e) => handlePositionChange('z', Number(e.target.value))}
                                    />
                                    <span className="text-sm text-slate-500 w-8 text-right">
                                        {selectedBlock.position?.z ?? 1}
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Higher = on top of other elements</p>
                            </div>

                            {/* Width / Height for positioned elements */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="mb-1 block text-sm">Width</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                        value={selectedBlock.position?.width || ''}
                                        onChange={(e) => handlePositionChange('width', e.target.value)}
                                        placeholder="auto"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm">Height</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                        value={selectedBlock.position?.height || ''}
                                        onChange={(e) => handlePositionChange('height', e.target.value)}
                                        placeholder="auto"
                                    />
                                </div>
                            </div>

                            {/* Rotation */}
                            <div>
                                <label className="mb-1 block text-sm">Rotation</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range"
                                        min="-180"
                                        max="180"
                                        step="1"
                                        className="flex-1"
                                        value={selectedBlock.position?.rotation ?? 0}
                                        onChange={(e) => handlePositionChange('rotation', Number(e.target.value))}
                                    />
                                    <span className="text-sm text-slate-500 w-12 text-right">
                                        {selectedBlock.position?.rotation ?? 0}°
                                    </span>
                                </div>
                            </div>

                            {/* Scale */}
                            <div>
                                <label className="mb-1 block text-sm">Scale</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range"
                                        min="0.25"
                                        max="3"
                                        step="0.05"
                                        className="flex-1"
                                        value={selectedBlock.position?.scale ?? 1}
                                        onChange={(e) => handlePositionChange('scale', Number(e.target.value))}
                                    />
                                    <span className="text-sm text-slate-500 w-12 text-right">
                                        {Math.round((selectedBlock.position?.scale ?? 1) * 100)}%
                                    </span>
                                </div>
                            </div>

                            {/* Quick position presets */}
                            <div>
                                <label className="mb-1 block text-sm">Quick Position</label>
                                <div className="grid grid-cols-3 gap-1">
                                    <button
                                        onClick={() => updateBlock(selectedBlock.id, { position: { ...selectedBlock.position, x: 0, y: 0 } })}
                                        className="text-xs px-2 py-1.5 bg-slate-100 dark:bg-slate-800 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                                    >↖ Top-Left</button>
                                    <button
                                        onClick={() => updateBlock(selectedBlock.id, { position: { ...selectedBlock.position, x: 960 - (parseInt(String(selectedBlock.position?.width || '200')) / 2 || 100), y: 0 } })}
                                        className="text-xs px-2 py-1.5 bg-slate-100 dark:bg-slate-800 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                                    >↑ Top-Center</button>
                                    <button
                                        onClick={() => updateBlock(selectedBlock.id, { position: { ...selectedBlock.position, x: 1920 - (parseInt(String(selectedBlock.position?.width || '200')) || 200), y: 0 } })}
                                        className="text-xs px-2 py-1.5 bg-slate-100 dark:bg-slate-800 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                                    >↗ Top-Right</button>
                                    <button
                                        onClick={() => updateBlock(selectedBlock.id, { position: { ...selectedBlock.position, x: 0, y: 540 - (parseInt(String(selectedBlock.position?.height || '100')) / 2 || 50) } })}
                                        className="text-xs px-2 py-1.5 bg-slate-100 dark:bg-slate-800 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                                    >← Center-L</button>
                                    <button
                                        onClick={() => updateBlock(selectedBlock.id, { position: { ...selectedBlock.position, x: 960 - (parseInt(String(selectedBlock.position?.width || '200')) / 2 || 100), y: 540 - (parseInt(String(selectedBlock.position?.height || '100')) / 2 || 50) } })}
                                        className="text-xs px-2 py-1.5 bg-slate-100 dark:bg-slate-800 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                                    >● Center</button>
                                    <button
                                        onClick={() => updateBlock(selectedBlock.id, { position: { ...selectedBlock.position, x: 1920 - (parseInt(String(selectedBlock.position?.width || '200')) || 200), y: 540 - (parseInt(String(selectedBlock.position?.height || '100')) / 2 || 50) } })}
                                        className="text-xs px-2 py-1.5 bg-slate-100 dark:bg-slate-800 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                                    >→ Center-R</button>

                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <hr className="border-slate-100 dark:border-slate-700" />

                {/* LAYER 1: Background Section */}
                <div className="space-y-3">
                    <SectionHeader title="Background" section="background" />
                    {expandedSections.background && (
                        <div className="space-y-4 pt-2">
                            {/* Background Type */}
                            <div>
                                <label className="mb-1 block text-sm">Background Type</label>
                                <select
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                    value={selectedBlock.background?.type || 'none'}
                                    onChange={(e) => {
                                        const type = e.target.value as 'none' | 'color' | 'gradient' | 'image' | 'video';
                                        if (type === 'none') {
                                            updateBlock(selectedBlock.id, { background: undefined });
                                        } else {
                                            updateBlock(selectedBlock.id, {
                                                background: {
                                                    type,
                                                    ...(type === 'color' && { color: '#6366f1' }),
                                                    ...(type === 'gradient' && { gradient: { direction: '135deg', stops: ['#0ea5e9', '#6366f1'] } }),
                                                    ...(type === 'image' && { image: { url: '', position: 'center', size: 'cover', repeat: 'no-repeat', attachment: 'scroll' } }),
                                                    ...(type === 'video' && { video: { url: '', muted: true, loop: true, autoplay: true } }),
                                                }
                                            });
                                        }
                                    }}
                                >
                                    <option value="none">None</option>
                                    <option value="color">Solid Color</option>
                                    <option value="gradient">Gradient</option>
                                    <option value="image">Image</option>
                                    <option value="video">Video</option>
                                </select>
                            </div>

                            {/* Color Background */}
                            {selectedBlock.background?.type === 'color' && (
                                <div>
                                    <label className="mb-1 block text-sm">Color</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {['transparent', '#ffffff', '#f8fafc', '#e2e8f0', '#1e293b', '#0f172a', '#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#22c55e', '#06b6d4'].map((color) => (
                                            <button
                                                key={color}
                                                onClick={() => updateBlock(selectedBlock.id, {
                                                    background: { ...selectedBlock.background!, color }
                                                })}
                                                className={`w-7 h-7 rounded border-2 ${selectedBlock.background?.color === color ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-slate-300 dark:border-slate-600'}`}
                                                style={{ backgroundColor: color === 'transparent' ? 'transparent' : color }}
                                                title={color}
                                            />
                                        ))}
                                    </div>
                                    <input
                                        type="text"
                                        className="w-full mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                        value={selectedBlock.background?.color || ''}
                                        onChange={(e) => updateBlock(selectedBlock.id, {
                                            background: { ...selectedBlock.background!, color: e.target.value }
                                        })}
                                        placeholder="Custom color: #hex or rgb()"
                                    />
                                </div>
                            )}

                            {/* Gradient Background */}
                            {selectedBlock.background?.type === 'gradient' && (
                                <>
                                    <div>
                                        <label className="mb-1 block text-sm">Direction</label>
                                        <select
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.background?.gradient?.direction || '135deg'}
                                            onChange={(e) => updateBlock(selectedBlock.id, {
                                                background: {
                                                    ...selectedBlock.background!,
                                                    gradient: { ...selectedBlock.background!.gradient!, direction: e.target.value }
                                                }
                                            })}
                                        >
                                            <option value="to right">Left to Right</option>
                                            <option value="to left">Right to Left</option>
                                            <option value="to bottom">Top to Bottom</option>
                                            <option value="to top">Bottom to Top</option>
                                            <option value="135deg">Diagonal (135°)</option>
                                            <option value="45deg">Diagonal (45°)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Start Color</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                className="h-9 w-14 rounded border border-slate-300"
                                                value={selectedBlock.background?.gradient?.stops?.[0] || '#0ea5e9'}
                                                onChange={(e) => {
                                                    const stops = [...(selectedBlock.background?.gradient?.stops || ['#0ea5e9', '#6366f1'])];
                                                    stops[0] = e.target.value;
                                                    updateBlock(selectedBlock.id, {
                                                        background: {
                                                            ...selectedBlock.background!,
                                                            gradient: { ...selectedBlock.background!.gradient!, stops }
                                                        }
                                                    });
                                                }}
                                            />
                                            <input
                                                type="text"
                                                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                                value={selectedBlock.background?.gradient?.stops?.[0] || ''}
                                                onChange={(e) => {
                                                    const stops = [...(selectedBlock.background?.gradient?.stops || ['#0ea5e9', '#6366f1'])];
                                                    stops[0] = e.target.value;
                                                    updateBlock(selectedBlock.id, {
                                                        background: {
                                                            ...selectedBlock.background!,
                                                            gradient: { ...selectedBlock.background!.gradient!, stops }
                                                        }
                                                    });
                                                }}
                                                placeholder="#0ea5e9"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">End Color</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                className="h-9 w-14 rounded border border-slate-300"
                                                value={selectedBlock.background?.gradient?.stops?.[1] || '#6366f1'}
                                                onChange={(e) => {
                                                    const stops = [...(selectedBlock.background?.gradient?.stops || ['#0ea5e9', '#6366f1'])];
                                                    stops[1] = e.target.value;
                                                    updateBlock(selectedBlock.id, {
                                                        background: {
                                                            ...selectedBlock.background!,
                                                            gradient: { ...selectedBlock.background!.gradient!, stops }
                                                        }
                                                    });
                                                }}
                                            />
                                            <input
                                                type="text"
                                                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                                value={selectedBlock.background?.gradient?.stops?.[1] || ''}
                                                onChange={(e) => {
                                                    const stops = [...(selectedBlock.background?.gradient?.stops || ['#0ea5e9', '#6366f1'])];
                                                    stops[1] = e.target.value;
                                                    updateBlock(selectedBlock.id, {
                                                        background: {
                                                            ...selectedBlock.background!,
                                                            gradient: { ...selectedBlock.background!.gradient!, stops }
                                                        }
                                                    });
                                                }}
                                                placeholder="#6366f1"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Image Background */}
                            {selectedBlock.background?.type === 'image' && (
                                <>
                                    <div>
                                        <label className="mb-1 block text-sm">Image URL</label>
                                        <input
                                            type="text"
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.background?.image?.url || ''}
                                            onChange={(e) => updateBlock(selectedBlock.id, {
                                                background: {
                                                    ...selectedBlock.background!,
                                                    image: { ...selectedBlock.background!.image!, url: e.target.value }
                                                }
                                            })}
                                            placeholder="https://example.com/image.jpg"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="mb-1 block text-sm">Position</label>
                                            <select
                                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                                value={selectedBlock.background?.image?.position || 'center'}
                                                onChange={(e) => updateBlock(selectedBlock.id, {
                                                    background: {
                                                        ...selectedBlock.background!,
                                                        image: { ...selectedBlock.background!.image!, position: e.target.value }
                                                    }
                                                })}
                                            >
                                                <option value="center">Center</option>
                                                <option value="top">Top</option>
                                                <option value="bottom">Bottom</option>
                                                <option value="left">Left</option>
                                                <option value="right">Right</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-sm">Size</label>
                                            <select
                                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                                value={selectedBlock.background?.image?.size || 'cover'}
                                                onChange={(e) => updateBlock(selectedBlock.id, {
                                                    background: {
                                                        ...selectedBlock.background!,
                                                        image: { ...selectedBlock.background!.image!, size: e.target.value }
                                                    }
                                                })}
                                            >
                                                <option value="cover">Cover</option>
                                                <option value="contain">Contain</option>
                                                <option value="auto">Auto</option>
                                            </select>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Video Background */}
                            {selectedBlock.background?.type === 'video' && (
                                <>
                                    <div>
                                        <label className="mb-1 block text-sm">Video URL</label>
                                        <input
                                            type="text"
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.background?.video?.url || ''}
                                            onChange={(e) => updateBlock(selectedBlock.id, {
                                                background: {
                                                    ...selectedBlock.background!,
                                                    video: { ...selectedBlock.background!.video!, url: e.target.value }
                                                }
                                            })}
                                            placeholder="https://example.com/video.mp4"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={selectedBlock.background?.video?.autoplay !== false}
                                                onChange={(e) => updateBlock(selectedBlock.id, {
                                                    background: {
                                                        ...selectedBlock.background!,
                                                        video: { ...selectedBlock.background!.video!, autoplay: e.target.checked }
                                                    }
                                                })}
                                            />
                                            <span className="text-sm">Autoplay</span>
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={selectedBlock.background?.video?.loop !== false}
                                                onChange={(e) => updateBlock(selectedBlock.id, {
                                                    background: {
                                                        ...selectedBlock.background!,
                                                        video: { ...selectedBlock.background!.video!, loop: e.target.checked }
                                                    }
                                                })}
                                            />
                                            <span className="text-sm">Loop</span>
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={selectedBlock.background?.video?.muted !== false}
                                                onChange={(e) => updateBlock(selectedBlock.id, {
                                                    background: {
                                                        ...selectedBlock.background!,
                                                        video: { ...selectedBlock.background!.video!, muted: e.target.checked }
                                                    }
                                                })}
                                            />
                                            <span className="text-sm">Muted</span>
                                        </label>
                                    </div>
                                </>
                            )}

                            {/* Overlay (for image/video backgrounds) */}
                            {(selectedBlock.background?.type === 'image' || selectedBlock.background?.type === 'video') && (
                                <>
                                    <hr className="border-slate-200 dark:border-slate-700" />
                                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Overlay</div>
                                    <div>
                                        <label className="mb-1 block text-sm">Overlay Color</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                className="h-9 w-14 rounded border border-slate-300"
                                                value={selectedBlock.background?.overlay?.color || '#000000'}
                                                onChange={(e) => updateBlock(selectedBlock.id, {
                                                    background: {
                                                        ...selectedBlock.background!,
                                                        overlay: { ...selectedBlock.background!.overlay!, color: e.target.value }
                                                    }
                                                })}
                                            />
                                            <input
                                                type="text"
                                                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                                value={selectedBlock.background?.overlay?.color || ''}
                                                onChange={(e) => updateBlock(selectedBlock.id, {
                                                    background: {
                                                        ...selectedBlock.background!,
                                                        overlay: { ...selectedBlock.background!.overlay!, color: e.target.value }
                                                    }
                                                })}
                                                placeholder="#000000 or rgba(0,0,0,0.5)"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Overlay Opacity: {Math.round((selectedBlock.background?.overlay?.opacity || 0.5) * 100)}%</label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            className="w-full"
                                            value={selectedBlock.background?.overlay?.opacity || 0.5}
                                            onChange={(e) => updateBlock(selectedBlock.id, {
                                                background: {
                                                    ...selectedBlock.background!,
                                                    overlay: { ...selectedBlock.background!.overlay!, opacity: parseFloat(e.target.value) }
                                                }
                                            })}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <hr className="border-slate-100 dark:border-slate-700" />

                {/* LAYER 2: Section Layout Mode */}
                <div className="space-y-3">
                    <SectionHeader title="Layout" section="layout" />
                    {expandedSections.layout && (
                        <div className="space-y-4 pt-2">
                            <div>
                                <label className="mb-1 block text-sm">Section Layout</label>
                                <select
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                    value={selectedBlock.sectionLayout || 'full-width'}
                                    onChange={(e) => updateBlock(selectedBlock.id, {
                                        sectionLayout: e.target.value as any
                                    })}
                                >
                                    <option value="full-width">Full Width (edge to edge)</option>
                                    <option value="contained">Contained (max-width container)</option>
                                    <option value="split-50-50">Split 50/50 (two columns)</option>
                                    <option value="split-60-40">Split 60/40 (two columns)</option>
                                    <option value="split-40-60">Split 40/60 (two columns)</option>
                                    <option value="centered-narrow">Centered Narrow (max-w-4xl)</option>
                                </select>
                            </div>

                            {(selectedBlock.sectionLayout?.startsWith('split')) && (
                                <div className="text-sm text-slate-500">
                                    Split layouts work best with two child blocks inside this section.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <hr className="border-slate-100 dark:border-slate-700" />

                {/* LAYER 5: Section Height Control */}
                <div className="space-y-3">
                    <SectionHeader title="Height" section="height" />
                    {expandedSections.height && (
                        <div className="space-y-4 pt-2">
                            <div>
                                <label className="mb-1 block text-sm">Height Mode</label>
                                <select
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                    value={selectedBlock.sectionHeight?.mode || 'auto'}
                                    onChange={(e) => {
                                        const mode = e.target.value as 'auto' | 'fixed' | 'min-height' | 'full-screen' | 'viewport';
                                        let value = '';
                                        if (mode === 'fixed') value = '500px';
                                        if (mode === 'min-height') value = '400px';
                                        updateBlock(selectedBlock.id, {
                                            sectionHeight: { mode, value }
                                        });
                                    }}
                                >
                                    <option value="auto">Auto (content height)</option>
                                    <option value="fixed">Fixed Height</option>
                                    <option value="min-height">Minimum Height</option>
                                    <option value="full-screen">Full Screen (100vh)</option>
                                    <option value="viewport">Viewport Relative</option>
                                </select>
                            </div>

                            {(selectedBlock.sectionHeight?.mode === 'fixed' || selectedBlock.sectionHeight?.mode === 'min-height') && (
                                <div>
                                    <label className="mb-1 block text-sm">Height Value (px or %)</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                        value={selectedBlock.sectionHeight?.value || ''}
                                        onChange={(e) => updateBlock(selectedBlock.id, {
                                            sectionHeight: { ...selectedBlock.sectionHeight!, value: e.target.value }
                                        })}
                                        placeholder="e.g., 500px, 60vh"
                                    />
                                </div>
                            )}

                            {selectedBlock.sectionHeight?.mode === 'full-screen' && (
                                <div className="text-sm text-slate-500">
                                    Section will be exactly 100% of the viewport height
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <hr className="border-slate-100 dark:border-slate-700" />

                {/* LAYER 3: Element Layers (for absolute positioning) */}
                <div className="space-y-3">
                    <SectionHeader title="Layers (Positioned Elements)" section="layers" />
                    {expandedSections.layers && (
                        <div className="space-y-3 pt-2">
                            {/* List existing layers */}
                            {(selectedBlock.layers || []).map((layer, index) => (
                                <div key={layer.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">{layer.type} {index + 1}</span>
                                        <button
                                            onClick={() => {
                                                const newLayers = selectedBlock.layers?.filter(l => l.id !== layer.id) || [];
                                                updateBlock(selectedBlock.id, { layers: newLayers });
                                            }}
                                            className="text-xs text-red-500 hover:text-red-600"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-xs text-slate-500">Top</label>
                                            <input
                                                type="text"
                                                className="w-full rounded border border-slate-200 px-2 py-1 text-xs dark:bg-slate-900 dark:border-slate-700"
                                                value={layer.position.top || ''}
                                                onChange={(e) => {
                                                    const newLayers = selectedBlock.layers?.map(l =>
                                                        l.id === layer.id ? { ...l, position: { ...l.position, top: e.target.value } } : l
                                                    ) || [];
                                                    updateBlock(selectedBlock.id, { layers: newLayers });
                                                }}
                                                placeholder="e.g., 20px"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500">Left</label>
                                            <input
                                                type="text"
                                                className="w-full rounded border border-slate-200 px-2 py-1 text-xs dark:bg-slate-900 dark:border-slate-700"
                                                value={layer.position.left || ''}
                                                onChange={(e) => {
                                                    const newLayers = selectedBlock.layers?.map(l =>
                                                        l.id === layer.id ? { ...l, position: { ...l.position, left: e.target.value } } : l
                                                    ) || [];
                                                    updateBlock(selectedBlock.id, { layers: newLayers });
                                                }}
                                                placeholder="e.g., 20px"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500">Z-Index</label>
                                            <input
                                                type="number"
                                                className="w-full rounded border border-slate-200 px-2 py-1 text-xs dark:bg-slate-900 dark:border-slate-700"
                                                value={layer.position.zIndex || 1}
                                                onChange={(e) => {
                                                    const newLayers = selectedBlock.layers?.map(l =>
                                                        l.id === layer.id ? { ...l, position: { ...l.position, zIndex: parseInt(e.target.value) || 1 } } : l
                                                    ) || [];
                                                    updateBlock(selectedBlock.id, { layers: newLayers });
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500">Width</label>
                                            <input
                                                type="text"
                                                className="w-full rounded border border-slate-200 px-2 py-1 text-xs dark:bg-slate-900 dark:border-slate-700"
                                                value={layer.size?.width || ''}
                                                onChange={(e) => {
                                                    const newLayers = selectedBlock.layers?.map(l =>
                                                        l.id === layer.id ? { ...l, size: { ...l.size, width: e.target.value } } : l
                                                    ) || [];
                                                    updateBlock(selectedBlock.id, { layers: newLayers });
                                                }}
                                                placeholder="e.g., 200px"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Add new layer button */}
                            <div className="flex gap-2">
                                {['text', 'image', 'button'].map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => {
                                            const newLayer = {
                                                id: crypto.randomUUID(),
                                                type: type as 'text' | 'image' | 'button',
                                                position: { type: 'absolute' as const, top: '20px', left: '20px', zIndex: 10 },
                                                size: { width: '200px', height: 'auto' },
                                                content: type === 'text' ? { text: 'New Text' } : type === 'image' ? { src: '', alt: '' } : { text: 'Button', url: '#' }
                                            };
                                            updateBlock(selectedBlock.id, {
                                                layers: [...(selectedBlock.layers || []), newLayer]
                                            });
                                        }}
                                        className="flex-1 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 rounded text-xs font-medium text-indigo-700 dark:text-indigo-300 transition-colors"
                                    >
                                        + {type.charAt(0).toUpperCase() + type.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <hr className="border-slate-100 dark:border-slate-700" />

                {/* LAYER 4: Advanced Visual Controls */}
                <div className="space-y-3">
                    <SectionHeader title="Visual Effects" section="visual" />
                    {expandedSections.visual && (
                        <div className="space-y-4 pt-2">
                            {/* Opacity */}
                            <div>
                                <label className="mb-1 block text-sm">Opacity: {Math.round((selectedBlock.style?.opacity || 1) * 100)}%</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    className="w-full"
                                    value={selectedBlock.style?.opacity || 1}
                                    onChange={(e) => handleStyleChange('opacity', parseFloat(e.target.value))}
                                />
                            </div>

                            {/* Backdrop Filter (Blur) */}
                            <div>
                                <label className="mb-1 block text-sm">Backdrop Blur</label>
                                <select
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                    value={selectedBlock.style?.backdropFilter || 'none'}
                                    onChange={(e) => handleStyleChange('backdropFilter', e.target.value === 'none' ? '' : e.target.value)}
                                >
                                    <option value="none">None</option>
                                    <option value="blur(4px)">Light (4px)</option>
                                    <option value="blur(8px)">Medium (8px)</option>
                                    <option value="blur(12px)">Heavy (12px)</option>
                                    <option value="blur(20px)">Extra (20px)</option>
                                </select>
                            </div>

                            {/* Box Shadow */}
                            <div>
                                <label className="mb-1 block text-sm">Shadow</label>
                                <select
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                    value={selectedBlock.style?.boxShadow || 'none'}
                                    onChange={(e) => handleStyleChange('boxShadow', e.target.value === 'none' ? '' : e.target.value)}
                                >
                                    <option value="none">None</option>
                                    <option value="0 1px 3px rgba(0,0,0,0.1)">Small</option>
                                    <option value="0 4px 6px -1px rgba(0,0,0,0.1)">Medium</option>
                                    <option value="0 10px 15px -3px rgba(0,0,0,0.1)">Large</option>
                                    <option value="0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)">Extra Large</option>
                                    <option value="0 0 0 1px rgba(0,0,0,0.05), 0 25px 50px -12px rgba(0,0,0,0.25)">Giant</option>
                                </select>
                            </div>

                            {/* Border Width */}
                            <div>
                                <label className="mb-1 block text-sm">Border Width</label>
                                <select
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                    value={selectedBlock.style?.borderWidth || '0'}
                                    onChange={(e) => handleStyleChange('borderWidth', e.target.value)}
                                >
                                    <option value="0">None</option>
                                    <option value="1px">Thin (1px)</option>
                                    <option value="2px">Medium (2px)</option>
                                    <option value="4px">Thick (4px)</option>
                                    <option value="8px">Extra Thick (8px)</option>
                                </select>
                            </div>

                            {/* Border Style */}
                            {selectedBlock.style?.borderWidth && selectedBlock.style?.borderWidth !== '0' && (
                                <div>
                                    <label className="mb-1 block text-sm">Border Style</label>
                                    <select
                                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                        value={selectedBlock.style?.borderStyle || 'solid'}
                                        onChange={(e) => handleStyleChange('borderStyle', e.target.value)}
                                    >
                                        <option value="solid">Solid</option>
                                        <option value="dashed">Dashed</option>
                                        <option value="dotted">Dotted</option>
                                    </select>
                                </div>
                            )}

                            {/* Border Color */}
                            {selectedBlock.style?.borderWidth && selectedBlock.style?.borderWidth !== '0' && (
                                <div>
                                    <label className="mb-1 block text-sm">Border Color</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            className="h-9 w-14 rounded border border-slate-300"
                                            value={selectedBlock.style?.borderColor || '#e2e8f0'}
                                            onChange={(e) => handleStyleChange('borderColor', e.target.value)}
                                        />
                                        <input
                                            type="text"
                                            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.style?.borderColor || ''}
                                            onChange={(e) => handleStyleChange('borderColor', e.target.value)}
                                            placeholder="#e2e8f0"
                                        />
                                    </div>
                                </div>
                            )}
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

                            {selectedBlock.type === 'button' && (
                                <>
                                    <div>
                                        <label className="mb-1 block text-sm">Button Text</label>
                                        <input
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.text || ''}
                                            onChange={(e) => handleChange('text', e.target.value)}
                                            placeholder="Click me"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Link URL</label>
                                        <input
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.href || ''}
                                            onChange={(e) => handleChange('href', e.target.value)}
                                            placeholder="/path or https://..."
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Button Color</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#22c55e', '#06b6d4', '#3b82f6', '#ef4444', '#1e293b', '#ffffff'].map((color) => (
                                                <button
                                                    key={color}
                                                    onClick={() => handleChange('backgroundColor', color)}
                                                    className={`w-7 h-7 rounded border-2 ${(selectedBlock.props.backgroundColor || '#6366f1') === color ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-slate-300 dark:border-slate-600'}`}
                                                    style={{ backgroundColor: color }}
                                                    title={color}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Button Style</label>
                                        <select
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.variant || 'solid'}
                                            onChange={(e) => handleChange('variant', e.target.value)}
                                        >
                                            <option value="solid">Solid</option>
                                            <option value="outline">Outline</option>
                                            <option value="ghost">Ghost</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Size</label>
                                        <select
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.size || 'md'}
                                            onChange={(e) => handleChange('size', e.target.value)}
                                        >
                                            <option value="sm">Small</option>
                                            <option value="md">Medium</option>
                                            <option value="lg">Large</option>
                                        </select>
                                    </div>
                                </>
                            )}

                            {selectedBlock.type === 'testimonials' && (
                                <>
                                    <div>
                                        <label className="mb-1 block text-sm">Source</label>
                                        <select
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.source || 'static'}
                                            onChange={(e) => handleChange('source', e.target.value)}
                                        >
                                            <option value="static">Manual Entry</option>
                                            <option value="dynamic">Customer Reviews</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Review Count</label>
                                        <input
                                            type="number"
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.count || 3}
                                            onChange={(e) => handleChange('count', parseInt(e.target.value))}
                                        />
                                    </div>
                                </>
                            )}


                            {selectedBlock.type === 'form_container' && (
                                <>
                                    <div className="p-3 bg-purple-50 rounded text-sm text-purple-700 dark:bg-purple-900/20 dark:text-purple-400">
                                        <p className="font-medium">Form Container</p>
                                        <p className="mt-1 text-xs">Configure form submission settings below. Add form fields as children.</p>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Form Action</label>
                                        <select
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.formAction || 'contact'}
                                            onChange={(e) => handleChange('formAction', e.target.value)}
                                        >
                                            <option value="contact">Contact Form</option>
                                            <option value="reservation">Reservation Request</option>
                                            <option value="feedback">Feedback Form</option>
                                            <option value="custom">Custom Endpoint</option>
                                        </select>
                                    </div>
                                    {selectedBlock.props.formAction === 'custom' && (
                                        <div>
                                            <label className="mb-1 block text-sm">Custom Endpoint URL</label>
                                            <input
                                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                                value={selectedBlock.props.customEndpoint || ''}
                                                onChange={(e) => handleChange('customEndpoint', e.target.value)}
                                                placeholder="/api/..."
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <label className="mb-1 block text-sm">Submit Button Text</label>
                                        <input
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.submitText || ''}
                                            onChange={(e) => handleChange('submitText', e.target.value)}
                                            placeholder="Submit"
                                        />
                                    </div>
                                </>
                            )}

                            {selectedBlock.type === 'container' && (
                                <div className="p-3 bg-slate-50 rounded text-sm text-slate-600 dark:bg-slate-700/50 dark:text-slate-400">
                                    <p className="font-medium">Container Block</p>
                                    <p className="mt-1 text-xs">A container for grouping other components. Set layout options in the style section above.</p>
                                </div>
                            )}

                            {/* ===== HERO V2 ===== */}
                            {selectedBlock.type === 'hero_v2' && (
                                <>
                                    <div>
                                        <label className="mb-1 block text-sm">Eyebrow Text</label>
                                        <input
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.eyebrow || ''}
                                            onChange={(e) => handleChange('eyebrow', e.target.value)}
                                            placeholder="Strength. Wellness. You."
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Title</label>
                                        <input
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.title || ''}
                                            onChange={(e) => handleChange('title', e.target.value)}
                                            placeholder="Gym Module"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Highlight Word (colored)</label>
                                        <input
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.highlight || ''}
                                            onChange={(e) => handleChange('highlight', e.target.value)}
                                            placeholder="Module"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Subtitle</label>
                                        <input
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.subtitle || ''}
                                            onChange={(e) => handleChange('subtitle', e.target.value)}
                                            placeholder="Elevate your stay."
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Description</label>
                                        <textarea
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.description || ''}
                                            onChange={(e) => handleChange('description', e.target.value)}
                                            rows={3}
                                            placeholder="State-of-the-art equipment..."
                                        />
                                    </div>
                                    <hr className="border-slate-200 dark:border-slate-700" />
                                    <div className="text-xs font-semibold text-slate-500 uppercase">Buttons</div>
                                    <div>
                                        <label className="mb-1 block text-sm">Primary Button Text</label>
                                        <input
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.primaryButton || ''}
                                            onChange={(e) => handleChange('primaryButton', e.target.value)}
                                            placeholder="Explore Schedule"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Primary Button URL</label>
                                        <input
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.primaryUrl || ''}
                                            onChange={(e) => handleChange('primaryUrl', e.target.value)}
                                            placeholder="#schedule"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Secondary Button Text</label>
                                        <input
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.secondaryButton || ''}
                                            onChange={(e) => handleChange('secondaryButton', e.target.value)}
                                            placeholder="Membership Plans"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Secondary Button URL</label>
                                        <input
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.secondaryUrl || ''}
                                            onChange={(e) => handleChange('secondaryUrl', e.target.value)}
                                            placeholder="#pricing"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Alignment</label>
                                        <select
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
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

                            {/* ===== FEATURES ===== */}
                            {selectedBlock.type === 'features' && (
                                <>
                                    <div>
                                        <label className="mb-1 block text-sm">Section Title</label>
                                        <input
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.title || ''}
                                            onChange={(e) => handleChange('title', e.target.value)}
                                            placeholder="Why Choose Our Gym"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Features (JSON)</label>
                                        <textarea
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono text-xs focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={(() => {
                                                const f = selectedBlock.props.features;
                                                return typeof f === 'string' ? f : JSON.stringify(f || [], null, 2);
                                            })()}
                                            onChange={(e) => handleChange('features', e.target.value)}
                                            rows={10}
                                        />
                                        <p className="text-[10px] text-slate-500 mt-1">
                                            {'Format: [{"icon": "Dumbbell", "title": "...", "description": "..."}]'}
                                        </p>
                                    </div>
                                </>
                            )}

                            {/* ===== STATS ===== */}
                            {selectedBlock.type === 'stats' && (
                                <>
                                    <div>
                                        <label className="mb-1 block text-sm">Section Title</label>
                                        <input
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.title || ''}
                                            onChange={(e) => handleChange('title', e.target.value)}
                                            placeholder="Our Impact"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Stats (JSON)</label>
                                        <textarea
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono text-xs focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={(() => {
                                                const s = selectedBlock.props.stats;
                                                return typeof s === 'string' ? s : JSON.stringify(s || [], null, 2);
                                            })()}
                                            onChange={(e) => handleChange('stats', e.target.value)}
                                            rows={10}
                                        />
                                        <p className="text-[10px] text-slate-500 mt-1">
                                            {'Format: [{"value": "10K+", "label": "...", "icon": "Users"}]'}
                                        </p>
                                    </div>
                                </>
                            )}

                            {/* ===== CARD GRID ===== */}
                            {selectedBlock.type === 'card_grid' && (
                                <>
                                    <div>
                                        <label className="mb-1 block text-sm">Section Title</label>
                                        <input
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.title || ''}
                                            onChange={(e) => handleChange('title', e.target.value)}
                                            placeholder="Our Services"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Columns</label>
                                        <select
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.columns || 3}
                                            onChange={(e) => handleChange('columns', parseInt(e.target.value))}
                                        >
                                            <option value={1}>1 Column</option>
                                            <option value={2}>2 Columns</option>
                                            <option value={3}>3 Columns</option>
                                            <option value={4}>4 Columns</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Cards (JSON)</label>
                                        <textarea
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono text-xs focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={(() => {
                                                const c = selectedBlock.props.cards;
                                                return typeof c === 'string' ? c : JSON.stringify(c || [], null, 2);
                                            })()}
                                            onChange={(e) => handleChange('cards', e.target.value)}
                                            rows={10}
                                        />
                                        <p className="text-[10px] text-slate-500 mt-1">
                                            {'Format: [{"title": "...", "description": "...", "icon": "Star"}]'}
                                        </p>
                                    </div>
                                </>
                            )}

                            {/* ===== CLASS SCHEDULE ===== */}
                            {selectedBlock.type === 'class_schedule' && (
                                <>
                                    <div>
                                        <label className="mb-1 block text-sm">Title</label>
                                        <input
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.title || ''}
                                            onChange={(e) => handleChange('title', e.target.value)}
                                            placeholder="Next Classes"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Subtitle</label>
                                        <input
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.subtitle || ''}
                                            onChange={(e) => handleChange('subtitle', e.target.value)}
                                            placeholder="UPCOMING SESSIONS"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Classes (JSON)</label>
                                        <textarea
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono text-xs focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={(() => {
                                                const c = selectedBlock.props.classes;
                                                return typeof c === 'string' ? c : JSON.stringify(c || [], null, 2);
                                            })()}
                                            onChange={(e) => handleChange('classes', e.target.value)}
                                            rows={12}
                                        />
                                        <p className="text-[10px] text-slate-500 mt-1">
                                            {'Format: [{"id": "1", "name": "...", "time": "09:00 AM", "trainer": "...", "category": "...", "icon": "Dumbbell"}]'}
                                        </p>
                                    </div>
                                </>
                            )}

                            {/* ===== CALENDAR ===== */}
                            {selectedBlock.type === 'calendar' && (
                                <div>
                                    <label className="mb-1 block text-sm">Title</label>
                                    <input
                                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                        value={selectedBlock.props.title || ''}
                                        onChange={(e) => handleChange('title', e.target.value)}
                                        placeholder="Weekly Schedule"
                                    />
                                </div>
                            )}

                            {/* ===== TESTIMONIALS CAROUSEL ===== */}
                            {selectedBlock.type === 'testimonials_carousel' && (
                                <>
                                    <div>
                                        <label className="mb-1 block text-sm">Title</label>
                                        <input
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.title || ''}
                                            onChange={(e) => handleChange('title', e.target.value)}
                                            placeholder="Stronger Together"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Subtitle</label>
                                        <input
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.subtitle || ''}
                                            onChange={(e) => handleChange('subtitle', e.target.value)}
                                            placeholder="WHAT OUR MEMBERS SAY"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Testimonials (JSON)</label>
                                        <textarea
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono text-xs focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={(() => {
                                                const t = selectedBlock.props.testimonials;
                                                return typeof t === 'string' ? t : JSON.stringify(t || [], null, 2);
                                            })()}
                                            onChange={(e) => handleChange('testimonials', e.target.value)}
                                            rows={12}
                                        />
                                        <p className="text-[10px] text-slate-500 mt-1">
                                            {'Format: [{"id": "1", "text": "...", "name": "...", "role": "...", "rating": 5, "avatar": "JM"}]'}
                                        </p>
                                    </div>
                                </>
                            )}

                            {/* ===== CTA ===== */}
                            {selectedBlock.type === 'cta' && (
                                <>
                                    <div>
                                        <label className="mb-1 block text-sm">Title</label>
                                        <input
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.title || ''}
                                            onChange={(e) => handleChange('title', e.target.value)}
                                            placeholder="Ready to get started?"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Description</label>
                                        <textarea
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.description || ''}
                                            onChange={(e) => handleChange('description', e.target.value)}
                                            rows={2}
                                            placeholder="Join us today and experience the difference."
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Button Text</label>
                                        <input
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.buttonText || ''}
                                            onChange={(e) => handleChange('buttonText', e.target.value)}
                                            placeholder="Get Started"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Button URL</label>
                                        <input
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.buttonUrl || ''}
                                            onChange={(e) => handleChange('buttonUrl', e.target.value)}
                                            placeholder="#contact"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Alignment</label>
                                        <select
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
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

                            {/* ===== DIVIDER ===== */}
                            {selectedBlock.type === 'divider' && (
                                <div>
                                    <label className="mb-1 block text-sm">Accent Color</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            className="h-9 w-14 rounded border border-slate-300"
                                            value={selectedBlock.props.accentColor || '#6366f1'}
                                            onChange={(e) => handleChange('accentColor', e.target.value)}
                                        />
                                        <input
                                            type="text"
                                            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.accentColor || ''}
                                            onChange={(e) => handleChange('accentColor', e.target.value)}
                                            placeholder="#6366f1"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* ===== SPACER ===== */}
                            {selectedBlock.type === 'spacer' && (
                                <div>
                                    <label className="mb-1 block text-sm">Height (px)</label>
                                    <input
                                        type="number"
                                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                        value={selectedBlock.props.height || 40}
                                        onChange={(e) => handleChange('height', parseInt(e.target.value) || 40)}
                                        min={10}
                                        max={200}
                                    />
                                </div>
                            )}

                            {/* ===== IMPROVED PRICING TABLE ===== */}
                            {selectedBlock.type === 'pricing_table' && (
                                <>
                                    <div>
                                        <label className="mb-1 block text-sm">Section Title</label>
                                        <input
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.title || ''}
                                            onChange={(e) => handleChange('title', e.target.value)}
                                            placeholder="Choose Your Plan"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Subtitle</label>
                                        <input
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={selectedBlock.props.subtitle || ''}
                                            onChange={(e) => handleChange('subtitle', e.target.value)}
                                            placeholder="MEMBERSHIP PLANS"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">Plans (JSON)</label>
                                        <textarea
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono text-xs focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700"
                                            value={(() => {
                                                const p = selectedBlock.props.plans;
                                                return typeof p === 'string' ? p : JSON.stringify(p || [], null, 2);
                                            })()}
                                            onChange={(e) => handleChange('plans', e.target.value)}
                                            rows={15}
                                        />
                                        <p className="text-[10px] text-slate-500 mt-1">
                                            {'Format: [{"name": "...", "price": "$15/day", "description": "...", "features": ["..."], "popular": false, "buttonText": "Get Started"}]'}
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
