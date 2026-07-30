import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSimulationStore, ActiveScene } from '../simulationStore';
import { Search, Compass, Shield, Database, Cpu, Command } from 'lucide-react';

interface Concept {
  name: string;
  category: string;
  scene: ActiveScene;
  engine?: 'A' | 'B' | 'C' | 'D' | 'E';
  icon: React.ComponentType<any>;
}

export default function CommandPalette() {
  const setScene = useSimulationStore((state) => state.setScene);
  const addLog = useSimulationStore((state) => state.addLog);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const concepts: Concept[] = [
    { name: 'Ecosystem Galaxy Wireframe Stack', category: 'Scene Graph', scene: 'galaxy', icon: Compass },
    { name: 'Engine A: Instant Transaction POS', category: 'Execution Core', scene: 'engines', engine: 'A', icon: Cpu },
    { name: 'Engine B: Time-Exclusive Reservation Calendar', category: 'Execution Core', scene: 'engines', engine: 'B', icon: Cpu },
    { name: 'Engine C: Shared Capacity Gate Pool', category: 'Execution Core', scene: 'engines', engine: 'C', icon: Cpu },
    { name: 'Engine D: Ongoing Entitlement Membership', category: 'Execution Core', scene: 'engines', engine: 'D', icon: Cpu },
    { name: 'Engine E: Platform SaaS Onboarding Billing', category: 'Execution Core', scene: 'engines', engine: 'E', icon: Cpu },
    { name: '12-Gate Security Middleware Firewall', category: 'Access Control', scene: 'security', icon: Shield },
    { name: 'Database Atlas Schema Mappings', category: 'Data Schema', scene: 'atlas', icon: Database },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
    }
  }, [isOpen]);

  const handleSelect = (concept: Concept) => {
    setScene(concept.scene);
    if (concept.engine) {
      // Direct update of react state in parent component is usually done via events.
      // We can also trigger log message that the parent state handles.
      // We write to logs, and we switch active scene.
      addLog('system', `Command palette jump: Selected Engine ${concept.engine}`);
    }
    setIsOpen(false);
  };

  const filtered = concepts.filter(c => 
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      {/* Floating command helper tip */}
      <div 
        onClick={() => setIsOpen(true)}
        className="fixed top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-black/40 hover:border-white/20 text-[10px] font-mono text-slate-400 cursor-pointer select-none transition"
      >
        <Command className="w-3.5 h-3.5" />
        <span>PRESS <kbd className="bg-white/10 px-1 rounded text-white text-[9px]">CTRL + K</kbd> TO NAVIGATE</span>
      </div>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/60 backdrop-blur-sm">
            
            {/* Modal backdrop click closer */}
            <div className="absolute inset-0 z-0" onClick={() => setIsOpen(false)} />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-lg border border-white/10 rounded-xl bg-[#090918] shadow-2xl overflow-hidden z-10 flex flex-col"
            >
              {/* Search Bar Input */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5">
                <Search className="w-4.5 h-4.5 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search architecture concepts..."
                  className="flex-1 bg-transparent border-none outline-none font-mono text-xs text-white placeholder-slate-500"
                />
              </div>

              {/* Filtering results */}
              <div className="max-h-64 overflow-y-auto p-2 flex flex-col gap-1">
                {filtered.length > 0 ? (
                  filtered.map((concept, idx) => {
                    const Icon = concept.icon;
                    return (
                      <div
                        key={idx}
                        onClick={() => handleSelect(concept)}
                        className="flex items-center justify-between p-3 rounded-lg border border-transparent hover:border-white/10 hover:bg-white/[0.02] cursor-pointer transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center flex-none">
                            <Icon className="w-4 h-4 text-cyan-400" />
                          </div>
                          <span className="font-mono text-xs text-slate-200 truncate">{concept.name}</span>
                        </div>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500 bg-white/[0.03] px-2 py-0.5 rounded border border-white/5 flex-none">
                          {concept.category}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 font-mono text-[10px] text-slate-500">
                    No matching concepts found
                  </div>
                )}
              </div>
            </motion.div>

          </div>
        )}
      </AnimatePresence>
    </>
  );
}
