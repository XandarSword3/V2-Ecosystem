import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useSimulationStore } from '../simulationStore';

export default function Timeline() {
  const { timelineStep, maxSteps, isPlaying, stepForward, resetAll } = useSimulationStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const pipeline = [
    { label: 'Incoming Request', code: 'GET /' },
    { label: 'Host Resolving', code: 'Host DNS' },
    { label: 'Platform Gate (E)', code: 'Engine E' },
    { label: 'Property Mapping', code: 'Headers' },
    { label: 'Security Handshake', code: 'validate()' },
    { label: 'Engine Exec (A-D)', code: 'definitions/' },
    { label: 'Postgres (RLS)', code: 'tenant_id' },
    { label: 'Realtime Hub', code: 'Socket.IO' },
    { label: 'Finished', code: 'HTTP 200' }
  ];

  // Draw high-tech oscilloscope wave
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 300);
    let height = (canvas.height = 36);

    const handleResize = () => {
      width = canvas.width = canvas.parentElement?.clientWidth || 300;
      height = canvas.height = 36;
    };
    window.addEventListener('resize', handleResize);

    let angle = 0;
    let animationId: number;

    const drawWave = () => {
      ctx.clearRect(0, 0, width, height);
      
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
      
      // Calculate amplitude based on play status
      const amplitude = isPlaying ? 10 : 3;
      const speed = isPlaying ? 0.08 : 0.02;

      for (let x = 0; x < width; x++) {
        // Build sine wave
        const y = height / 2 + Math.sin(x * 0.02 + angle) * amplitude;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      angle += speed;
      animationId = requestAnimationFrame(drawWave);
    };

    drawWave();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, [isPlaying]);

  return (
    <div className="w-full border border-white/10 glass bg-black/60 rounded-xl p-4 flex flex-col gap-3 relative z-20 backdrop-blur-xl">
      
      {/* Wave oscilloscope background */}
      <div className="absolute inset-x-8 top-1.5 h-9 opacity-25 pointer-events-none overflow-hidden z-0">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 z-10 relative">
        
        {/* Play/Pause controls */}
        <div className="flex gap-2">
          <button
            onClick={stepForward}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-black font-mono font-bold text-[10px] uppercase rounded tracking-wider transition"
          >
            Advance Step
          </button>
          <button
            onClick={resetAll}
            className="px-3 py-1.5 border border-white/10 hover:border-white/20 text-slate-300 font-mono text-[10px] uppercase rounded tracking-wider transition"
          >
            Reset
          </button>
        </div>

        {/* Timeline dots mapping */}
        <div className="flex-1 w-full flex justify-between items-center px-4 relative">
          <div className="absolute inset-x-12 top-1.5 h-0.5 bg-white/5 z-0" />
          
          {pipeline.map((stage, idx) => {
            const isCompleted = idx <= timelineStep;
            const isCurrent = idx === timelineStep;

            return (
              <div key={idx} className="flex flex-col items-center gap-1.5 z-10">
                <motion.div
                  animate={{
                    scale: isCurrent ? 1.2 : 1,
                    backgroundColor: isCurrent ? '#00e5ff' : isCompleted ? '#3b82f6' : 'rgba(2,2,18,0.9)',
                    borderColor: isCompleted ? '#00e5ff' : 'rgba(255,255,255,0.1)'
                  }}
                  style={{
                    boxShadow: isCurrent ? '0 0 10px #00e5ff' : 'none'
                  }}
                  className="w-3.5 h-3.5 rounded-full border flex-none"
                />
                <span className={`font-mono text-[7.5px] uppercase tracking-wider hidden sm:block ${isCurrent ? 'text-cyan-400 font-bold' : isCompleted ? 'text-slate-300' : 'text-slate-600'}`}>
                  {stage.code}
                </span>
              </div>
            );
          })}
        </div>

        {/* Readout label */}
        <div className="font-mono text-[10px] text-slate-400 flex items-center gap-2">
          <span>Active Pipeline:</span>
          <span className="text-cyan-400 font-bold uppercase tracking-wider">
            {pipeline[timelineStep].label}
          </span>
        </div>

      </div>
    </div>
  );
}
