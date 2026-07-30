'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSimulationStore, ActiveScene, ScenarioType } from './simulationStore';

// Component imports
import StarfieldBackground from './components/StarfieldBackground';
import SceneBoot from './components/SceneBoot';
import SceneGalaxy from './components/SceneGalaxy';
import SceneEngines from './components/SceneEngines';
import SceneSecurity from './components/SceneSecurity';
import SceneAtlas from './components/SceneAtlas';
import Timeline from './components/Timeline';
import CommandPalette from './components/CommandPalette';

import {
  Terminal as TerminalIcon,
  Cpu,
  Compass,
  Shield,
  Database,
  Layout,
  ChevronUp,
  ChevronDown,
  Zap,
} from 'lucide-react';

const SCENES: { id: ActiveScene; label: string; short: string; icon: React.ComponentType<any>; color: string }[] = [
  { id: 'boot',     label: 'Boot Sequence',   short: 'BOOT',     icon: Cpu,      color: '#00E5FF' },
  { id: 'galaxy',   label: 'Galaxy Stack',    short: 'GALAXY',   icon: Compass,  color: '#8B5CF6' },
  { id: 'engines',  label: 'Engine Command',  short: 'ENGINES',  icon: Layout,   color: '#F59E0B' },
  { id: 'security', label: 'Security Shield', short: 'SECURITY', icon: Shield,   color: '#EF4444' },
  { id: 'atlas',    label: 'Database Atlas',  short: 'ATLAS',    icon: Database, color: '#10B981' },
];

const LOG_COLORS: Record<string, string> = {
  middleware: 'text-cyan-400',
  engine:     'text-amber-400',
  security:   'text-red-400',
  db:         'text-pink-400',
  realtime:   'text-purple-400',
  system:     'text-slate-500',
};

export default function NexusPage() {
  const store = useSimulationStore();
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const [logsOpen, setLogsOpen] = useState(true);

  // Auto-scroll logs
  useEffect(() => {
    if (logsOpen) logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [store.logs, logsOpen]);

  const renderScene = () => {
    switch (store.activeScene) {
      case 'boot':     return <SceneBoot />;
      case 'galaxy':   return <SceneGalaxy />;
      case 'engines':  return <SceneEngines />;
      case 'security': return <SceneSecurity />;
      case 'atlas':    return <SceneAtlas />;
      default:         return <SceneGalaxy />;
    }
  };

  const activeSceneMeta = SCENES.find(s => s.id === store.activeScene)!;

  return (
    // fixed inset-0 ensures we sit on top of the Next.js layout entirely
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#020212] text-slate-100"
      style={{ fontFamily: "'Inter', 'Outfit', sans-serif" }}>

      {/* ── STARFIELD BACKGROUND ───────────────────────────────────── */}
      <StarfieldBackground />

      {/* ── HEADER BAR ─────────────────────────────────────────────── */}
      <header className="relative z-20 h-12 shrink-0 flex items-center justify-between px-5 border-b border-white/[0.07]"
        style={{ background: 'rgba(2,2,18,0.85)', backdropFilter: 'blur(20px)' }}>

        {/* Logo + divider + scene label */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span className="font-black text-xs tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              V2_NEXUS
            </span>
          </div>
          <div className="h-3.5 w-px bg-white/10" />
          <span className="font-mono text-[9px] tracking-[0.15em] uppercase"
            style={{ color: activeSceneMeta.color }}>
            {activeSceneMeta.short}
          </span>
        </div>

        {/* Centre: Scenario selector */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 rounded-lg border border-white/[0.08] bg-white/[0.03]">
          <span className="font-mono text-[8px] text-slate-500 tracking-widest uppercase">Scenario</span>
          <select
            value={store.activeScenario}
            onChange={e => store.setScenario(e.target.value as ScenarioType)}
            className="bg-transparent border-none outline-none font-mono text-[9px] text-white cursor-pointer uppercase font-bold tracking-wider"
          >
            <option value="idle" className="bg-[#020212]">Idle State</option>
            <option value="friday_night" className="bg-[#020212]">Friday Night Rush</option>
            <option value="beach_club" className="bg-[#020212]">Beach Club Live</option>
          </select>
        </div>

        {/* Right: Mode pills */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg border border-white/[0.08] bg-white/[0.02]">
          {(['visitor', 'founder', 'engineer', 'investor'] as const).map(mode => {
            const active = store.activeMode === mode;
            return (
              <button
                key={mode}
                onClick={() => store.setMode(mode)}
                className="px-2.5 py-1 rounded-md font-mono text-[8px] uppercase tracking-widest font-bold transition-all duration-200"
                style={active ? {
                  background: 'rgba(0,229,255,0.15)',
                  color: '#00E5FF',
                  boxShadow: '0 0 8px rgba(0,229,255,0.2)',
                  border: '1px solid rgba(0,229,255,0.3)'
                } : {
                  color: 'rgba(255,255,255,0.3)',
                  border: '1px solid transparent'
                }}
              >
                {mode}
              </button>
            );
          })}
        </div>
      </header>

      {/* ── MAIN BODY (sidebar + content) ──────────────────────────── */}
      {/* CRITICAL: flex-1 + min-h-0 + overflow-hidden keeps this contained */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative z-10">

        {/* ── SIDEBAR ──────────────────────────────────────────────── */}
        {store.activeScene !== 'boot' && (
          <aside className="w-52 shrink-0 flex flex-col border-r border-white/[0.06] overflow-hidden bg-black/45 backdrop-blur-md"
            style={{ background: 'rgba(2,2,18,0.7)', backdropFilter: 'blur(16px)' }}>

            <div className="px-4 pt-4 pb-2">
              <span className="font-mono text-[7.5px] tracking-[0.25em] text-slate-600 uppercase">Navigation</span>
            </div>

            <nav className="flex-1 flex flex-col gap-0.5 px-2 overflow-y-auto">
              {SCENES.map((scene, idx) => {
                const active = store.activeScene === scene.id;
                const Icon = scene.icon;
                return (
                  <motion.button
                    key={scene.id}
                    onClick={() => store.setScene(scene.id)}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 relative group"
                    style={{
                      background: active ? `${scene.color}12` : 'transparent',
                      border: active ? `1px solid ${scene.color}25` : '1px solid transparent',
                    }}
                  >
                    {/* Active left accent bar */}
                    {active && (
                      <motion.div
                        layoutId="sidebar-accent"
                        className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full"
                        style={{ background: scene.color }}
                      />
                    )}

                    {/* Icon */}
                    <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-all"
                      style={{
                        background: active ? `${scene.color}20` : 'rgba(255,255,255,0.04)',
                        border: active ? `1px solid ${scene.color}40` : '1px solid rgba(255,255,255,0.06)',
                      }}>
                      <Icon className="w-3.5 h-3.5" style={{ color: active ? scene.color : '#64748b' }} />
                    </div>

                    {/* Label */}
                    <div>
                      <span className="font-mono text-[8px] text-slate-600 block tracking-widest">0{idx + 1}</span>
                      <span className={`text-[10px] font-semibold tracking-wide ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                        {scene.label}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </nav>

            {/* Sidebar footer */}
            <div className="shrink-0 border-t border-white/[0.06] px-4 py-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-[8px] text-slate-500 tracking-wider">DISPATCHER ONLINE</span>
              </div>
              <div className="font-mono text-[8px] text-slate-600">
                STATUS: <span className={store.billingStatus === 'active' ? 'text-emerald-400' : 'text-red-400'}>{store.billingStatus.toUpperCase()}</span>
              </div>
            </div>
          </aside>
        )}

        {/* ── CONTENT AREA ─────────────────────────────────────────── */}
        {/* CRITICAL: flex-1 + min-h-0 + overflow-hidden is essential */}
        <main className="flex-1 flex flex-col overflow-hidden min-h-0">

          {/* Scene viewport — takes all remaining space */}
          <div className="flex-1 relative min-h-0 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={store.activeScene}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0"
              >
                {renderScene()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── BOTTOM HUD ─────────────────────────────────────────── */}
          {/* shrink-0 ensures it NEVER grows to push scene content up */}
          {store.activeScene !== 'boot' && (
            <div className="shrink-0 border-t border-white/[0.06]"
              style={{ background: 'rgba(2,2,18,0.9)', backdropFilter: 'blur(20px)' }}>

              {/* Toggle bar */}
              <div className="flex items-center justify-between px-4 pt-2 pb-1">
                <div className="flex items-center gap-2">
                  <TerminalIcon className="w-3 h-3 text-slate-500" />
                  <span className="font-mono text-[8px] text-slate-500 tracking-widest uppercase">Event Log</span>
                  <span className="font-mono text-[7px] text-slate-700 bg-white/5 px-1.5 py-0.5 rounded">
                    {store.logs.length} entries
                  </span>
                </div>
                <button
                  onClick={() => setLogsOpen(v => !v)}
                  className="flex items-center gap-1 font-mono text-[8px] text-slate-500 hover:text-slate-300 transition"
                >
                  {logsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                  {logsOpen ? 'Collapse' : 'Expand'}
                </button>
              </div>

              {/* Collapsible log pane — fixed height, internal scroll only */}
              <AnimatePresence initial={false}>
                {logsOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 96, opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="h-24 overflow-y-auto px-4 pb-2 font-mono text-[9px] flex flex-col-reverse">
                      <div ref={logEndRef} />
                      {[...store.logs].reverse().map((log, idx) => (
                        <div key={idx} className="flex items-start gap-2 py-0.5 border-b border-white/[0.03] last:border-0">
                          <span suppressHydrationWarning className="text-slate-600 shrink-0 select-none tabular-nums">{log.timestamp}</span>
                          <span className={`shrink-0 w-14 text-[8px] uppercase font-bold ${LOG_COLORS[log.source] || 'text-slate-400'}`}>
                            {log.source}
                          </span>
                          <span className="text-slate-300 leading-relaxed">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Timeline progress strip */}
              <div className="px-4 pb-3">
                <Timeline />
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── FLOATING OVERLAYS ──────────────────────────────────────── */}
      <CommandPalette />
    </div>
  );
}
