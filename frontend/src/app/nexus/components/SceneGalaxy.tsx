import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSimulationStore, ComplexityMode } from '../simulationStore';
import { Shield, Layers, HardDrive, Cpu, Home, Globe, Server, ArrowRight, X } from 'lucide-react';

interface Layer {
  id: string;
  name: string;
  color: string;
  accent: string;
  icon: React.ComponentType<any>;
  heightOffset: number;
  details: Record<ComplexityMode, string>;
  metrics: Record<ComplexityMode, string>;
  technicalNotes: string[];
}

export default function SceneGalaxy() {
  const activeMode = useSimulationStore((state) => state.activeMode);
  const addLog = useSimulationStore((state) => state.addLog);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [hoveredLayer, setHoveredLayer] = useState<string | null>(null);
  const [mouseParallax, setMouseParallax] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement | null>(null);

  const layers: Layer[] = [
    {
      id: 'platform',
      name: 'Platform Layer (Engine E)',
      color: 'rgba(234, 179, 8, 0.12)',
      accent: '#EAB308',
      icon: Globe,
      heightOffset: 250,
      details: {
        visitor: 'The platform roof where businesses sign up. It controls subscription status and gates access.',
        founder: 'Central cockpit controlling company MRR, tenant allocations, and signup provisioning loops.',
        engineer: 'Enforces entitlements at apiGate level. Subscribed to Stripe webhook actions.',
        investor: 'Platform consolidation layer servicing 10,000+ businesses with near-zero variable cost.',
      },
      metrics: {
        visitor: '100% cloud automated setup.',
        founder: 'MRR: $128,450 / Churn: 0.8%',
        engineer: 'API Gates: 0.12ms check latency',
        investor: 'Scalable billing loops.',
      },
      technicalNotes: [
        'Domain: v2platform.com',
        'Scope: super_admin access gate',
        'Stripe webhooks invoke provision_tenant()'
      ]
    },
    {
      id: 'tenant',
      name: 'Tenant Layer (Isolation)',
      color: 'rgba(59, 130, 246, 0.12)',
      accent: '#3B82F6',
      icon: Server,
      heightOffset: 190,
      details: {
        visitor: 'Strict isolation sandbox. Every company gets a subdomain and isolated dataset.',
        founder: 'Company management layer. Scopes regional sub-resorts and administrative personnel.',
        engineer: 'Next.js proxy extracts X-Tenant-Slug header to lock DB tenantGate context.',
        investor: 'Guarantees GDPR compliance. Multi-tenant isolation increases platform security value.',
      },
      metrics: {
        visitor: 'Zero cross-talk security guarantee.',
        founder: 'Active Tenants: 42 Resort Groups',
        engineer: 'Proxy routing context injected',
        investor: 'SaaS Multi-tenancy isolation',
      },
      technicalNotes: [
        'Domain: [tenant].v2platform.com',
        'Injected via host request headers',
        'Forced tenant_id RLS filters on DB queries'
      ]
    },
    {
      id: 'property',
      name: 'Property Layer (Context)',
      color: 'rgba(16, 185, 129, 0.12)',
      accent: '#10B981',
      icon: Home,
      heightOffset: 130,
      details: {
        visitor: 'Individual locations (e.g. Beach Bar, Gym). Staff and assets are property-scoped.',
        founder: 'Property switcher controls, inventory pooling, and regional metrics.',
        engineer: 'Path routing /[property] mapped to physical tables via property_id filter checks.',
        investor: 'Saves operational costs by multiplexing properties into a single cloud cluster.',
      },
      metrics: {
        visitor: 'Physical locations mapped dynamically.',
        founder: 'Resorts: 128 physical properties',
        engineer: 'Property scoping context active',
        investor: 'Connection pool efficiency',
      },
      technicalNotes: [
        'Resolved path: /[property]/admin',
        'Header: X-Property-Slug',
        'Property-level config profiles applied'
      ]
    },
    {
      id: 'module',
      name: 'Module Layer (Engines A-D)',
      color: 'rgba(139, 92, 246, 0.12)',
      accent: '#8B5CF6',
      icon: Layers,
      heightOffset: 70,
      details: {
        visitor: 'Toggled features representing physical spaces (POS menus, hotel rooms, spa scanners).',
        founder: 'App catalog where features are toggled on/off to charge extra MRR per activation.',
        engineer: 'Dynamic [slug] dispatchers load UI components matching engine_type config.',
        investor: 'Our core expansion vector. Feature activation boosts per-resort MRR without dev costs.',
      },
      metrics: {
        visitor: 'One-click feature activation.',
        founder: 'Active Modules: 450+ live templates',
        engineer: 'engine_type dispatcher resolved',
        investor: 'Modular Upsell multipliers',
      },
      technicalNotes: [
        'Endpoint: /[property]/admin/[slug]',
        'Templates map to Engine A, B, C, or D configurations',
        'Validates custom scopes: module:{slug}:admin'
      ]
    },
    {
      id: 'engine',
      name: 'Engine Layer (Execution)',
      color: 'rgba(245, 158, 11, 0.12)',
      accent: '#F59E0B',
      icon: Cpu,
      heightOffset: 10,
      details: {
        visitor: 'The operational brains. Processes instant orders, reservations, scanner keys, and billing cycles.',
        founder: 'State machines keep room sales, restaurant receipts, and member cards in sync.',
        engineer: 'definitions/ state engines process request mutations through strict validation trees.',
        investor: 'Our product moat. 5 highly optimized engines cover 99% of resort business operations.',
      },
      metrics: {
        visitor: 'Real-time order and reservation tracking.',
        founder: 'Checkout latency: <80ms globally',
        engineer: 'State engine schema matching',
        investor: 'Standardized core product scaling',
      },
      technicalNotes: [
        'Engine A (Instant), B (Booking), C (Capacity), D (Members)',
        'State definitions run via transaction queues',
        'Strict schema validation checks before DB write'
      ]
    },
    {
      id: 'database',
      name: 'Database Layer (Row-Level Security)',
      color: 'rgba(251, 113, 133, 0.12)',
      accent: '#FB7185',
      icon: HardDrive,
      heightOffset: -50,
      details: {
        visitor: 'Secure cloud vault holding orders, memberships, and logs behind database isolation.',
        founder: 'Single, optimized Postgres database cluster on Supabase protecting customer data.',
        engineer: 'PostgreSQL Row Level Security (RLS) policies enforce tenant_id constraints.',
        investor: 'High margins. RLS allows a shared DB pool without crossing corporate datasets.',
      },
      metrics: {
        visitor: 'Supabase secure cloud vault.',
        founder: 'DB load: 12% average cpu',
        engineer: 'Row Level Security active',
        investor: 'Shared pool operational safety',
      },
      technicalNotes: [
        'Hosted on Supabase/PostgreSQL instance',
        'Unified transactions table tracks entries',
        'Auditing enabled via security_audit_log'
      ]
    }
  ];

  // Mouse Parallax trigger for layers shift
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMouseParallax({ x: x * 40, y: y * 40 });
  };

  const handleMouseLeave = () => {
    setMouseParallax({ x: 0, y: 0 });
  };

  const handleSelectLayer = (id: string) => {
    setSelectedLayer(id === selectedLayer ? null : id);
    addLog('system', `Cinematic stack camera focused: ${id.toUpperCase()}`);
  };

  return (
   <div 
  ref={containerRef}
  onMouseMove={handleMouseMove}
  onMouseLeave={handleMouseLeave}
  className="absolute h-[90vh] inset-0 flex items-center justify-center p-6 z-10 select-none overflow-hidden"
>
      {/* HUD background spinning ring */}
      <div className="absolute w-[600px] h-[600px] rounded-full border border-dashed border-white/[0.02] animate-spin pointer-events-none z-0" style={{ animationDuration: '80s' }} />

      {/* Main Full-scene centered content */}
      <div className="w-full h-full max-w-6xl flex items-center justify-center relative z-10">
        
        {/* Layer stack box (Centered, Large) */}
        <motion.div 
          animate={{
            x: selectedLayer ? -160 : 0,
            scale: selectedLayer ? 0.9 : 1.0,
            rotateX: 48 - mouseParallax.y * 0.2,
            rotateY: mouseParallax.x * 0.2,
          }}
          transition={{ type: 'spring', stiffness: 80, damping: 15 }}
          className="w-[480px] h-[400px] relative flex flex-col justify-center items-center pointer-events-auto"
          style={{ 
            transformStyle: 'preserve-3d',
            perspective: '1200px'
          }}
        >
          {layers.map((layer, index) => {
            const Icon = layer.icon;
            const isHovered = hoveredLayer === layer.id;
            const isSelected = selectedLayer === layer.id;
            const anySelected = selectedLayer !== null;

            let zTranslate = layer.heightOffset;
            if (anySelected) {
              if (isSelected) zTranslate += 80;
              else zTranslate -= 40;
            } else if (isHovered) {
              zTranslate += 30;
            }

            return (
              <div
                key={layer.id}
                onClick={() => handleSelectLayer(layer.id)}
                onMouseEnter={() => setHoveredLayer(layer.id)}
                onMouseLeave={() => setHoveredLayer(null)}
                className={`absolute w-full h-[72px] cursor-pointer transition-all duration-300 ${
                  anySelected && !isSelected ? 'opacity-20 filter blur-xs' : 'opacity-100'
                }`}
                style={{
                  transform: `translateZ(${zTranslate}px)`,
                  transformStyle: 'preserve-3d',
                  zIndex: index * 10
                }}
              >
                {/* 80px tall layer card */}
                <div 
                  className="absolute inset-0 rounded-xl border flex items-center justify-between px-6 transition-all duration-300"
                  style={{
                    background: isSelected 
                      ? `linear-gradient(135deg, ${layer.accent}30 0%, rgba(2,2,18,0.95) 100%)`
                      : 'rgba(255, 255, 255, 0.01)',
                    borderColor: isSelected || isHovered ? layer.accent : 'rgba(255, 255, 255, 0.05)',
                    boxShadow: isSelected || isHovered 
                      ? `0 0 40px ${layer.accent}35, inset 0 0 20px ${layer.accent}20` 
                      : 'none',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <div className="flex items-center gap-5">
                    {/* 24px icon container */}
                    <div 
                      className="w-11 h-11 rounded-lg flex items-center justify-center border"
                      style={{
                        background: isSelected || isHovered ? `${layer.accent}20` : 'rgba(255, 255, 255, 0.02)',
                        borderColor: isSelected || isHovered ? layer.accent : 'rgba(255, 255, 255, 0.06)'
                      }}
                    >
                      <Icon className="w-6 h-6 text-white" style={{ color: isSelected || isHovered ? '#fff' : layer.accent }} />
                    </div>
                    
                    <div className="text-left">
                      <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: layer.accent }}>
                        Tier 0{6 - index}
                      </span>
                      <h3 className="font-display font-black text-sm md:text-base text-white tracking-wide mt-0.5">
                        {layer.name.split(' (')[0]}
                      </h3>
                    </div>
                  </div>

                  <ArrowRight className={`w-5 h-5 text-slate-600 transition-transform duration-300 ${isHovered ? 'translate-x-1.5 text-white' : ''}`} />
                </div>
              </div>
            );
          })}
        </motion.div>

        {/* Detailed Slide Panel (Slides in from the right) */}
        <AnimatePresence>
          {selectedLayer && (
            <motion.div
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 100, damping: 18 }}
              className="absolute right-0 top-0 bottom-0 w-[420px] rounded-xl border border-white/5 bg-[#050518]/90 backdrop-blur-2xl p-8 flex flex-col justify-between shadow-2xl relative z-30 overflow-y-auto"
              style={{
                boxShadow: `0 0 50px ${layers.find(l => l.id === selectedLayer)?.accent}15`
              }}
            >
              {/* Close Button */}
              <button 
                onClick={() => setSelectedLayer(null)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white p-1 rounded-full hover:bg-white/5 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col gap-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center border"
                    style={{
                      background: `${layers.find(l => l.id === selectedLayer)?.accent}20`,
                      borderColor: layers.find(l => l.id === selectedLayer)?.accent
                    }}
                  >
                    {React.createElement(layers.find(l => l.id === selectedLayer)!.icon, {
                      className: 'w-6 h-6',
                      style: { color: layers.find(l => l.id === selectedLayer)?.accent }
                    })}
                  </div>
                  <div className="text-left">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500 font-extrabold">
                      PLATFORM ARCHITECTURE COMPONENT
                    </span>
                    {/* Giant heading */}
                    <h2 className="font-display font-black text-xl md:text-2xl text-white leading-tight mt-0.5">
                      {layers.find(l => l.id === selectedLayer)?.name}
                    </h2>
                  </div>
                </div>

                {/* Main description details */}
                <div className="space-y-2">
                  <span className="font-mono text-[8px] uppercase tracking-widest text-slate-500 font-bold block">
                    Mode description: {activeMode.toUpperCase()}
                  </span>
                  <p className="text-slate-300 text-sm leading-relaxed text-left min-h-[90px]">
                    {layers.find(l => l.id === selectedLayer)?.details[activeMode]}
                  </p>
                </div>

                {/* Target Metric */}
                <div className="p-4 rounded-lg bg-white/[0.01] border border-white/5 flex flex-col gap-1 text-left">
                  <span className="font-mono text-[8px] text-slate-500 uppercase tracking-widest font-extrabold block">
                    DYNAMIC READOUT METRIC
                  </span>
                  <span className="text-sm font-black text-white tracking-wide">
                    {layers.find(l => l.id === selectedLayer)?.metrics[activeMode]}
                  </span>
                </div>

                {/* Tech variables stack */}
                {(activeMode === 'engineer' || activeMode === 'founder') && (
                  <div className="flex flex-col gap-2.5 text-left">
                    <span className="font-mono text-[8px] text-slate-500 uppercase tracking-widest font-extrabold">
                      SPECIFICATION CODE BLOCK
                    </span>
                    <div className="space-y-1.5">
                      {layers.find(l => l.id === selectedLayer)?.technicalNotes.map((note, idx) => (
                        <div key={idx} className="font-mono text-[10px] text-slate-400 bg-black/50 border border-white/5 px-3 py-1.5 rounded flex items-center gap-2">
                          <span className="text-cyan-400 font-bold">&gt;</span>
                          <span>{note}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setSelectedLayer(null)}
                className="w-full mt-6 py-2.5 rounded-lg border border-white/10 hover:border-white/20 text-slate-300 hover:text-white font-mono text-[10px] uppercase tracking-widest transition"
              >
                Close Specification
              </button>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
