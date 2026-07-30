import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSimulationStore } from '../simulationStore';
import { Check } from 'lucide-react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
}

export default function SceneBoot() {
  const setScene = useSimulationStore((state) => state.setScene);
  const addLog = useSimulationStore((state) => state.addLog);

  const [displayText, setDisplayText] = useState('');
  const [activeStep, setActiveStep] = useState(-1);
  const [shake, setShake] = useState(false);
  const [shockwaveActive, setShockwaveActive] = useState(false);
  const [shockwaveScale, setShockwaveScale] = useState(1);
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameId = useRef<number | null>(null);

  const fullDomainText = 'abccorp.v2platform.com/beach-bar';

  const checks = [
    { label: 'IDENTITY VALIDATION', desc: 'JWT signature verified, claims extracted', color: '#00E5FF' },
    { label: 'TENANT ISOLATION CHECK', desc: 'Tenant ID abccorp-923f resolved & bounded', color: '#10B981' },
    { label: 'PROPERTY SCHEMA RESOLUTION', desc: 'Resource path /beach-bar mapped to Sunset Villas', color: '#8B5CF6' },
    { label: 'ENGINE DISPATCH ALLOCATION', desc: 'Request routed to Engine A (instant_transaction)', color: '#F59E0B' },
    { label: 'SECURITY PERMISSION AUDIT', desc: 'Role customer: RLS constraints verified. Access Granted', color: '#EF4444' }
  ];

  // 1. Typewriter animation for main signal
  useEffect(() => {
    let currentIdx = 0;
    addLog('middleware', `SIGNAL CAPTURED: Host incoming request init.`);

    const interval = setInterval(() => {
      setDisplayText((prev) => prev + fullDomainText[currentIdx]);
      currentIdx++;
      if (currentIdx === fullDomainText.length) {
        clearInterval(interval);
        // Start check sequence
        setTimeout(() => setActiveStep(0), 600);
      }
    }, 45);

    return () => clearInterval(interval);
  }, []);

  // 2. Loop for check steps with shake/laser beams
  useEffect(() => {
    if (activeStep < 0 || activeStep >= checks.length) return;

    // Trigger visual camera shake
    setShake(true);
    addLog('middleware', `BOOT: Evaluating check ${activeStep + 1}/5 - ${checks[activeStep].label}`);
    
    // Spawn laser particle beams on canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const width = canvas.width;
      const height = canvas.height;
      const stepColor = checks[activeStep].color;

      // Spawn 150 particles flowing from edges toward center card
      const stepParticles: Particle[] = [];
      const edges = [
        { x: 0, y: height / 2 },
        { x: width, y: height / 2 },
        { x: width / 2, y: 0 },
        { x: width / 2, y: height }
      ];

      edges.forEach((start) => {
        for (let i = 0; i < 40; i++) {
          const dx = width / 2 - start.x;
          const dy = height / 2 - start.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.2;
          const speed = Math.random() * 8 + 4;

          stepParticles.push({
            x: start.x,
            y: start.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: stepColor,
            alpha: 1.0
          });
        }
      });

      particlesRef.current = [...particlesRef.current, ...stepParticles];
    }

    const shakeTimer = setTimeout(() => setShake(false), 150);

    const stepTimer = setTimeout(() => {
      if (activeStep === checks.length - 1) {
        // Complete! Activate shockwave
        setShockwaveActive(true);
        addLog('system', `BOOT SUCCESSFUL. ALL SECURITY CONTROLS VERIFIED.`);
        
        let scale = 1;
        const interval = setInterval(() => {
          scale += 0.45;
          setShockwaveScale(scale);
          if (scale > 15) {
            clearInterval(interval);
            setScene('galaxy');
          }
        }, 30);
      } else {
        setActiveStep((prev) => prev + 1);
      }
    }, 1500);

    return () => {
      clearTimeout(shakeTimer);
      clearTimeout(stepTimer);
    };
  }, [activeStep]);

  // 3. Canvas rendering loop for particle lasers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Render flowing lasers
      particlesRef.current.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.015;

        if (p.alpha > 0) {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.random() * 2 + 1, 0, Math.PI * 2);
          ctx.shadowBlur = 10;
          ctx.shadowColor = p.color;
          ctx.fill();
          ctx.restore();
        }
      });

      // Filter dead particles
      particlesRef.current = particlesRef.current.filter((p) => p.alpha > 0);

      // Draw target focus box overlay in center
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.strokeRect(width / 2 - 250, height / 2 - 180, 500, 360);

      animationFrameId.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, []);

  return (
    <div 
      className={`absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-40 overflow-hidden ${
        shake ? 'animate-shake' : ''
      }`}
      style={{
        transition: 'transform 0.15s ease-out',
        transform: shake ? 'translate(2px, -3px)' : 'none'
      }}
    >
      {/* Background Laser Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />

      {/* Main Signal Display */}
      <div className="z-10 flex flex-col items-center max-w-4xl px-6 text-center select-none mb-10">
        <span className="font-mono text-[10px] text-cyan-400 tracking-[0.3em] font-extrabold uppercase animate-pulse mb-3">
          CAPTURING INCOMING SIGNAL SEGMENT
        </span>
        <h1 className="font-display font-black text-white text-3xl md:text-5xl tracking-tight leading-tight filter drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
          {displayText}
          <span className="animate-pulse duration-700 text-cyan-400">|</span>
        </h1>
      </div>

      {/* Verification Checks (60px high progress bars) */}
      <div className="z-10 w-full max-w-2xl flex flex-col gap-3 px-6 select-none">
        {checks.map((check, idx) => {
          const isPassed = activeStep >= idx;
          const isActive = activeStep === idx;

          return (
            <div
              key={idx}
              className="relative w-full h-[64px] rounded-lg overflow-hidden border transition-all duration-300 flex items-center justify-between px-6"
              style={{
                background: isActive 
                  ? 'rgba(255, 255, 255, 0.03)' 
                  : isPassed 
                  ? `${check.color}06` 
                  : 'rgba(255, 255, 255, 0.005)',
                borderColor: isActive 
                  ? check.color 
                  : isPassed 
                  ? `${check.color}40` 
                  : 'rgba(255, 255, 255, 0.03)',
                boxShadow: isActive ? `0 0 20px ${check.color}25` : 'none'
              }}
            >
              {/* Sliding progress loader bar */}
              {isActive && (
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1.4, ease: 'easeInOut' }}
                  className="absolute inset-y-0 left-0 z-0 opacity-15"
                  style={{ background: check.color }}
                />
              )}

              <div className="flex flex-col relative z-10 text-left">
                <span className="font-mono text-[9px] uppercase tracking-widest font-extrabold text-slate-500">
                  Step 0{idx + 1}
                </span>
                <span 
                  className="font-display font-black text-sm tracking-wide mt-0.5"
                  style={{ color: isActive || isPassed ? '#ffffff' : '#334155' }}
                >
                  {check.label}
                </span>
              </div>

              {/* Check details readout */}
              {isPassed && (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-3 relative z-10"
                >
                  <span className="font-mono text-[9px] text-slate-400 hidden md:block">
                    {check.desc}
                  </span>
                  <div 
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: `${check.color}20`, border: `1px solid ${check.color}` }}
                  >
                    <Check className="w-4.5 h-4.5" style={{ color: check.color }} />
                  </div>
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      {/* Exploding Shockwave concentric rings */}
      {shockwaveActive && (
        <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center bg-black/20">
          <div 
            className="rounded-full border-[8px] border-cyan-400 filter blur-xs transition-all duration-300"
            style={{
              width: `${shockwaveScale * 60}px`,
              height: `${shockwaveScale * 60}px`,
              boxShadow: '0 0 100px #00e5ff, inset 0 0 100px #00e5ff',
              transform: `scale(${shockwaveScale * 0.15})`
            }}
          />
        </div>
      )}

      {/* Skip Intro */}
      <div className="z-10 mt-10 font-mono text-[9px] text-slate-600 hover:text-slate-400 transition cursor-pointer">
        <button onClick={() => setScene('galaxy')} className="border border-white/5 bg-white/[0.01] hover:border-cyan-400/25 px-4 py-1.5 rounded">
          SKIP BOOT SEQUENCE &rarr;
        </button>
      </div>
    </div>
  );
}
