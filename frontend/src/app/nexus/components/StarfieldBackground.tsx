import React, { useEffect, useRef } from 'react';
import { useSimulationStore, ActiveScene } from '../simulationStore';

interface Star {
  x: number;
  y: number;
  z: number;
  color: string;
  size: number;
}

export default function StarfieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const isPlaying = useSimulationStore((state) => state.isPlaying);
  const activeScene = useSimulationStore((state) => state.activeScene);

  // Scene-reactive color map for the spotlight nebula glow
  const sceneColors: Record<ActiveScene, { core: string; glow: string; dust: string }> = {
    boot: {
      core: 'rgba(0, 229, 255, 0.08)',
      glow: 'rgba(0, 140, 255, 0.04)',
      dust: 'rgba(0, 229, 255, 0.01)',
    },
    galaxy: {
      core: 'rgba(139, 92, 246, 0.08)',
      glow: 'rgba(99, 102, 241, 0.04)',
      dust: 'rgba(139, 92, 246, 0.01)',
    },
    engines: {
      core: 'rgba(245, 158, 11, 0.08)',
      glow: 'rgba(217, 119, 6, 0.04)',
      dust: 'rgba(245, 158, 11, 0.01)',
    },
    security: {
      core: 'rgba(239, 68, 68, 0.1)',
      glow: 'rgba(185, 28, 28, 0.05)',
      dust: 'rgba(239, 68, 68, 0.01)',
    },
    atlas: {
      core: 'rgba(16, 185, 129, 0.08)',
      glow: 'rgba(5, 150, 105, 0.04)',
      dust: 'rgba(16, 185, 129, 0.01)',
    },
  };

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

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.tx = (e.clientX - width / 2) / (width / 2);
      mouseRef.current.ty = (e.clientY - height / 2) / (height / 2);
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Initialise stars
    const starCount = 200;
    const stars: Star[] = [];
    const colors = ['#ffffff', '#00e5ff', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];

    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: (Math.random() - 0.5) * width * 2,
        y: (Math.random() - 0.5) * height * 2,
        z: Math.random() * width,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 1.5 + 0.6,
      });
    }

    let angle = 0;
    let animationFrameId: number;

    const drawGrid = (mx: number, my: number) => {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.012)';
      ctx.lineWidth = 1;

      const centerX = width / 2 + mx * -40;
      const centerY = height / 2 + my * -40;
      const divisions = 24;

      // Draw perspective radial lines converging to center point
      for (let i = 0; i < divisions; i++) {
        const theta = (i / divisions) * Math.PI * 2 + angle * 0.03;
        const targetX = centerX + Math.cos(theta) * width * 1.5;
        const targetY = centerY + Math.sin(theta) * height * 1.5;
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
      }

      // Draw concentric depth circles
      const circleCount = 8;
      for (let i = 1; i <= circleCount; i++) {
        const radius = (i / circleCount) * width * 0.8;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.015 * (i / circleCount)})`;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    };

    const animate = () => {
      // Create slight motion blur tail
      ctx.fillStyle = 'rgba(2, 2, 18, 0.15)';
      ctx.fillRect(0, 0, width, height);

      // Smooth mouse interpolation
      const mouse = mouseRef.current;
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;

      // Fetch dynamic colors based on active scene
      const activeColor = sceneColors[activeScene] || sceneColors.galaxy;

      // Render nebulous background glows ( spot-light )
      const gradient = ctx.createRadialGradient(
        width / 2 + mouse.x * -70,
        height / 2 + mouse.y * -70,
        50,
        width / 2 + mouse.x * -70,
        height / 2 + mouse.y * -70,
        width * 0.7
      );
      gradient.addColorStop(0, activeColor.core);
      gradient.addColorStop(0.4, activeColor.glow);
      gradient.addColorStop(0.8, activeColor.dust);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Render perspective grid chamber
      drawGrid(mouse.x, mouse.y);

      // Accelerated speeds for boot hyperdrive sequences
      const speedMultiplier = activeScene === 'boot' ? 4.5 : isPlaying ? 2.5 : 1.0;
      const starSpeed = 1.8 * speedMultiplier;

      // Update stars
      stars.forEach((star) => {
        star.z -= starSpeed;

        if (star.z <= 0) {
          star.z = width;
          star.x = (Math.random() - 0.5) * width * 2;
          star.y = (Math.random() - 0.5) * height * 2;
        }

        // 3D coordinate viewport projection
        const k = 400 / star.z;
        const px = star.x * k + width / 2;
        const py = star.y * k + height / 2;

        // Mouse-parallax shifts
        const finalX = px + mouse.x * -star.size * 35;
        const finalY = py + mouse.y * -star.size * 35;

        // Render if visible
        if (finalX >= 0 && finalX <= width && finalY >= 0 && finalY <= height) {
          const finalSize = star.size * k * 0.6;
          ctx.beginPath();
          ctx.arc(finalX, finalY, finalSize, 0, Math.PI * 2);
          ctx.fillStyle = star.color;
          ctx.fill();

          // Outer glows for high-velocity stars
          if (star.size > 1.2 && k > 1.5) {
            ctx.shadowBlur = 12;
            ctx.shadowColor = star.color;
            ctx.beginPath();
            ctx.arc(finalX, finalY, finalSize * 1.6, 0, Math.PI * 2);
            ctx.fillStyle = `${star.color}15`;
            ctx.fill();
            ctx.shadowBlur = 0; // reset
          }
        }
      });

      angle += 0.01;
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, activeScene]);

  return <canvas ref={canvasRef} className="fixed inset-0 z-0 bg-[#020212] pointer-events-none" />;
}
