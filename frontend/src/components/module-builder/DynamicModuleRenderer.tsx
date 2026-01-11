'use client';

import { UIBlock } from '@/types/module-builder';
import { Module } from '@/lib/settings-context';
import { motion } from 'framer-motion';

interface RendererProps {
  layout: UIBlock[];
  module: Module;
}

export function DynamicModuleRenderer({ layout, module }: RendererProps) {
  if (!layout || layout.length === 0) {
    return <div className="p-10 text-center">No layout defined for this module.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-wrap content-start">
      {layout.map((block) => (
        <BlockRenderer key={block.id} block={block} module={module} />
      ))}
    </div>
  );
}

function BlockRenderer({ block, module }: { block: UIBlock; module: Module }) {
  const { type, props, style } = block;

  // style object conversion if needed
  const inlineStyle = {
    ...style,
    // ensure background image works if provided in props or style
    backgroundImage: props.backgroundImage ? `url(${props.backgroundImage})` : style?.backgroundImage,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  } as React.CSSProperties;

  switch (type) {
    case 'hero':
      return (
        <section 
            style={inlineStyle}
            className="w-full flex items-center justify-center relative overflow-hidden text-white" 
        >
          {/* Overlay if image exists */}
          {props.backgroundImage && <div className="absolute inset-0 bg-black/40 z-0" />}
          
          <div className="container relative z-10 px-4 py-20 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{props.title}</h1>
            <p className="text-xl md:text-2xl opacity-90">{props.subtitle}</p>
          </div>
        </section>
      );

    case 'container':
      return (
        <div style={inlineStyle} className="container mx-auto px-4 py-8">
            {block.children?.map(child => (
                <BlockRenderer key={child.id} block={child} module={module} />
            ))}
        </div>
      );

    case 'grid':
        const gridCols = props.columns || 3;
        // Placeholder for data fetching - in real implementation this would query 'dataSource'
        return (
            <div className={`grid grid-cols-1 md:grid-cols-${gridCols} gap-6`} style={inlineStyle}>
                 {/* Should render children or data items */}
                 {block.children && block.children.length > 0 
                    ? block.children.map(child => <BlockRenderer key={child.id} block={child} module={module}/>)
                    : <div className="col-span-full text-center p-8 bg-slate-100 rounded text-slate-500">Dynamic Grid Data: {props.dataSource}</div>
                 }
            </div>
        );

    case 'text_block':
        return (
            <div style={inlineStyle} className="prose dark:prose-invert max-w-none">
                {props.content || 'Empty Text Block'}
            </div>
        );
    
    case 'image':
        return (
            <div style={inlineStyle} className="w-full">
                <img 
                    src={props.src || '/placeholder-image.jpg'} 
                    alt={props.alt || 'Module Image'}
                    className="w-full h-auto rounded-lg shadow-md"
                />
            </div>
        );

    default:
      return <div className="p-4 border border-red-200 bg-red-50 text-red-600">Unknown component: {type}</div>;
  }
}
