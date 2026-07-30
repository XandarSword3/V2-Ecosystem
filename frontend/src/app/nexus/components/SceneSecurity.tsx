import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSimulationStore } from '../simulationStore';
import { Shield, ShieldAlert, ShieldX, Play, RotateCcw } from 'lucide-react';

interface SecurityGate {
  num: number;
  name: string;
  x: number;
  y: number;
}

export default function SceneSecurity() {
  const { hackerAlert, triggerHackerAttack, resetHacker } = useSimulationStore();
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; vx: number; vy: number; color: string }[]>([]);

  const gates: SecurityGate[] = [
    { num: 1, name: 'Rate Limit', x: 50, y: 30 },
    { num: 2, name: 'CSRF Token', x: 130, y: 30 },
    { num: 3, name: 'OAuth Signature', x: 210, y: 30 },
    { num: 4, name: 'Cookie Handshake', x: 290, y: 30 },
    { num: 5, name: 'JWT Decrypt', x: 370, y: 30 },
    { num: 6, name: 'Row-Level Security', x: 370, y: 110 },
    { num: 7, name: 'Tenant Scope', x: 290, y: 110 },
    { num: 8, name: 'Property Switch', x: 210, y: 110 },
    { num: 9, name: 'Staff Assigned', x: 130, y: 110 },
    { num: 10, name: 'API Key Scope', x: 50, y: 110 },
    { num: 11, name: 'Token Blacklist', x: 130, y: 170 },
    { num: 12, name: 'Token Version', x: 250, y: 170 }
  ];

  // Spawn explosion sparks when blocked
  useEffect(() => {
    if (hackerAlert.status === 'blocked') {
      const sparks = [];
      const gate6 = gates.find(g => g.num === 6)!;
      for (let i = 0; i < 30; i++) {
        sparks.push({
          id: Math.random(),
          x: gate6.x,
          y: gate6.y,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          color: i % 2 === 0 ? '#ef4444' : '#f59e0b'
        });
      }
      setParticles(sparks);

      const interval = setInterval(() => {
        setParticles((prev) => 
          prev.map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vx: p.vx * 0.92,
            vy: p.vy * 0.92
          })).filter(p => Math.abs(p.vx) > 0.1)
        );
      }, 30);

      return () => clearInterval(interval);
    } else {
      setParticles([]);
    }
  }, [hackerAlert.status]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 z-10 overflow-hidden">
      
      {/* Red flash ambient siren glow on breach */}
      <AnimatePresence>
        {hackerAlert.status === 'blocked' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.12, 0, 0.12] }}
            exit={{ opacity: 0 }}
            transition={{ repeat: Infinity, duration: 1.2 }}
            className="absolute inset-0 bg-red-600 pointer-events-none z-0"
          />
        )}
      </AnimatePresence>

      <div className="w-full max-w-4xl z-10 flex flex-col gap-6">
        
        {/* Header Title */}
        <div className="flex justify-between items-center border-b border-white/5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg border ${hackerAlert.status === 'blocked' ? 'border-red-500 bg-red-950/20 text-red-500' : 'border-cyan-500 bg-cyan-950/20 text-cyan-400'}`}>
              {hackerAlert.status === 'blocked' ? <ShieldX className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
            </div>
            <div>
              <span className="font-mono text-[8px] text-slate-500 font-bold tracking-wider block">CYBERSECURITY COMMAND</span>
              <h1 className="font-display font-extrabold text-white text-sm">12-GATE MIDDLEWARE THRILLER</h1>
            </div>
          </div>

          <div className="flex gap-2">
            {hackerAlert.status === 'idle' ? (
              <button
                onClick={triggerHackerAttack}
                className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 transition"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Simulate Hacker
              </button>
            ) : (
              <button
                onClick={resetHacker}
                className="px-3 py-1.5 rounded border border-white/10 hover:border-white/20 text-slate-300 font-mono font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Firewall
              </button>
            )}
          </div>
        </div>

        {/* Defense Gateway Path View */}
        <div className="relative border border-white/5 rounded-xl bg-black/40 h-[220px] flex items-center justify-center p-4">
          <svg className="w-full h-full max-w-2xl" viewBox="0 0 450 200">
            {/* Draw circuit connection lines */}
            <path
              d="M 50 30 L 370 30 L 370 110 L 50 110 L 130 170 L 250 170"
              fill="none"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth="2"
            />

            {/* Traversed paths line indicator */}
            {hackerAlert.status === 'hacking' && (
              <motion.path
                d="M 50 30 L 370 30 L 370 110"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
                strokeDasharray="400"
                initial={{ strokeDashoffset: 400 }}
                animate={{ strokeDashoffset: 400 - (hackerAlert.currentGate / 6) * 180 }}
                transition={{ duration: 0.2 }}
                style={{ filter: 'drop-shadow(0 0 5px #ef4444)' }}
              />
            )}

            {/* RLS Gold Shield Protection Shield */}
            {hackerAlert.status === 'blocked' && (
              <motion.circle
                cx="370"
                cy="110"
                r="22"
                fill="none"
                stroke="#eab308"
                strokeWidth="2.5"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [1, 1.3, 1], opacity: 1 }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                style={{ filter: 'drop-shadow(0 0 8px #eab308)' }}
              />
            )}

            {/* Emitters Nodes */}
            {gates.map((g) => {
              const isHacking = hackerAlert.status === 'hacking';
              const isBlocked = hackerAlert.status === 'blocked';
              const isPassed = isBlocked ? g.num < 6 : isHacking ? g.num < hackerAlert.currentGate : false;
              const isCurrent = isBlocked ? g.num === 6 : isHacking && g.num === hackerAlert.currentGate;

              return (
                <g key={g.num}>
                  <circle
                    cx={g.x}
                    cy={g.y}
                    r="8"
                    fill={isCurrent ? '#ef444415' : isPassed ? '#10b98115' : '#000'}
                    stroke={isCurrent ? '#ef4444' : isPassed ? '#10b981' : 'rgba(255,255,255,0.1)'}
                    strokeWidth="1.5"
                    style={{ filter: isCurrent ? 'drop-shadow(0 0 6px #ef4444)' : 'none' }}
                  />
                  {/* Gate number labels */}
                  <text x={g.x} y={g.y + 2.5} textAnchor="middle" fill="#fff" fontSize="6" fontFamily="monospace">
                    {g.num}
                  </text>

                  {/* Turret Scanner Beams */}
                  {isCurrent && isHacking && (
                    <line
                      x1={g.x}
                      y1="0"
                      x2={g.x}
                      y2={g.y}
                      stroke="#00e5ff"
                      strokeWidth="1"
                      strokeDasharray="4 2"
                      className="animate-pulse"
                    />
                  )}
                </g>
              );
            })}

            {/* Hacker skull payload node */}
            {hackerAlert.status === 'hacking' && (
              <motion.g
                animate={{
                  x: gates[hackerAlert.currentGate - 1]?.x || 50,
                  y: gates[hackerAlert.currentGate - 1]?.y || 30
                }}
                transition={{ type: 'spring', stiffness: 80 }}
              >
                <circle r="7" fill="#ef4444" style={{ filter: 'drop-shadow(0 0 8px #ef4444)' }} />
                <circle r="3" fill="#fff" />
              </motion.g>
            )}

            {/* Spark debris particles */}
            {particles.map((p, idx) => (
              <circle cx={p.x} cy={p.y} r="1.5" fill={p.color} key={idx} />
            ))}
          </svg>
        </div>

        {/* Readout logs */}
        <div className={`p-3 rounded-lg border font-mono text-[9.5px] bg-black/60 ${
          hackerAlert.status === 'blocked' ? 'border-red-500/20' : 'border-white/5'
        }`}>
          <div className="flex justify-between items-center border-b border-white/5 pb-1 mb-1.5 text-slate-500">
            <span>MIDDLEWARE FIREWALL CONSOLE</span>
            {hackerAlert.status === 'blocked' && <span className="text-red-400 font-bold">RLS BLOCK</span>}
          </div>
          <span className={hackerAlert.status === 'blocked' ? 'text-red-400' : 'text-slate-300'}>
            &gt; {hackerAlert.log}
          </span>
        </div>

      </div>
    </div>
  );
}
