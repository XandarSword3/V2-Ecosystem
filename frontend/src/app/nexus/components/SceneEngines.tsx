import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSimulationStore, POSItem, KDSTicket, BookingBlock, BillingStatus } from '../simulationStore';
import { 
  ShoppingCart, Calendar, Users, Award, Globe, 
  Play, Pause, RefreshCw, AlertTriangle, CheckCircle, 
  Settings, UserCheck, Flame, CreditCard, Trash2, X, Sparkles
} from 'lucide-react';

interface GoldCoin {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
}

export default function SceneEngines() {
  const store = useSimulationStore();
  const [activeEngine, setActiveEngine] = useState<'A' | 'B' | 'C' | 'D' | 'E'>('A');

  const handleEngineSwitch = (eng: 'A' | 'B' | 'C' | 'D' | 'E') => {
    setActiveEngine(eng);
    store.addLog('system', `Focused Engine ${eng} simulator interface.`);
  };

  return (
    <div className="absolute inset-0 flex flex-col p-6 z-10 select-none overflow-hidden bg-[#02020e]/95">
      
      {/* 1. Large Header Switches */}
      <div className="flex border-b border-white/5 pb-3 mb-4 gap-3 shrink-0 overflow-x-auto">
        {(['A', 'B', 'C', 'D', 'E'] as const).map((eng) => {
          const isActive = activeEngine === eng;
          const label = {
            A: { name: 'Engine A', type: 'POS Instant Checkout' },
            B: { name: 'Engine B', type: 'Exclusive Reservations' },
            C: { name: 'Engine C', type: 'Capacity Pool Physics' },
            D: { name: 'Engine D', type: 'Stripe VIP Shatter' },
            E: { name: 'Engine E', type: 'SaaS Platform Solar' }
          }[eng];

          return (
            <button
              key={eng}
              onClick={() => handleEngineSwitch(eng)}
              className={`px-4 py-2.5 rounded-xl border text-left flex flex-col gap-0.5 transition-all duration-300 min-w-[170px] ${
                isActive
                  ? 'border-cyan-500 bg-cyan-500/10 shadow-[0_0_20px_rgba(0,229,255,0.15)] text-white'
                  : 'border-white/5 bg-transparent text-slate-500 hover:border-white/10'
              }`}
            >
              <span className="font-display font-black text-xs tracking-wider">{label.name}</span>
              <span className="font-mono text-[8px] uppercase tracking-wider text-slate-500">{label.type}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Content Layout (Full-scene Viewport + Right Side Cockpit controls) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        
        {/* Immersive Cinematic Screen (8 columns) */}
        <div className="lg:col-span-8 rounded-xl border border-white/5 bg-black/50 p-6 flex flex-col justify-center relative overflow-hidden min-h-[400px] lg:min-h-0">
          <AnimatePresence mode="wait">
            {activeEngine === 'A' && <EngineAMovie key="ea" />}
            {activeEngine === 'B' && <EngineBMovie key="eb" />}
            {activeEngine === 'C' && <EngineCMovie key="ec" />}
            {activeEngine === 'D' && <EngineDMovie key="ed" />}
            {activeEngine === 'E' && <EngineEMovie key="ee" />}
          </AnimatePresence>
        </div>

        {/* Dashboard Controller (4 columns) */}
        <div className="lg:col-span-4 rounded-xl border border-white/5 bg-[#05051a]/90 p-6 flex flex-col justify-between backdrop-blur-xl relative shadow-2xl">
          <AnimatePresence mode="wait">
            {activeEngine === 'A' && <EngineAControls key="ca" />}
            {activeEngine === 'B' && <EngineBControls key="cb" />}
            {activeEngine === 'C' && <EngineCControls key="cc" />}
            {activeEngine === 'D' && <EngineDControls key="cd" />}
            {activeEngine === 'E' && <EngineEControls key="ce" />}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}

// ==========================================
// ENGINE A: INSTANT TRANSACTION POS
// ==========================================
function EngineAMovie() {
  const { engineA } = useSimulationStore();
  const [coins, setCoins] = useState<GoldCoin[]>([]);
  const [swipeActive, setSwipeActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Trigger swipe card + gold coin checkout explosion
  useEffect(() => {
    // Watch for ticket changes (checkout completed)
    if (engineA.kdsTickets.length > 0) {
      setSwipeActive(true);
      
      // Spawn 35 golden coins
      const canvas = canvasRef.current;
      if (canvas) {
        const width = canvas.width = canvas.clientWidth || 400;
        const height = canvas.height = canvas.clientHeight || 300;
        
        const newCoins: GoldCoin[] = [];
        for (let i = 0; i < 35; i++) {
          newCoins.push({
            id: Math.random(),
            x: width / 2,
            y: height / 2,
            vx: (Math.random() - 0.5) * 12,
            vy: -Math.random() * 10 - 4,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.3
          });
        }
        setCoins(newCoins);
      }

      const timer = setTimeout(() => setSwipeActive(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [engineA.kdsTickets.length]);

  // Render gold coins canvas animation loop
  useEffect(() => {
    if (coins.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const update = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      setCoins((prev) => {
        const next = prev.map((c) => {
          c.x += c.vx;
          c.y += c.vy;
          c.vy += 0.35; // Gravity
          c.rotation += c.rotSpeed;
          return c;
        }).filter((c) => c.y < canvas.height + 20);

        // Draw gold circles
        next.forEach((c) => {
          ctx.save();
          ctx.translate(c.x, c.y);
          ctx.rotate(c.rotation);
          
          // Shiny gold coin
          ctx.fillStyle = '#f59e0b';
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Inner gold ring
          ctx.strokeStyle = '#ffffff50';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.arc(0, 0, 5, 0, Math.PI * 2);
          ctx.stroke();
          
          ctx.restore();
        });

        if (next.length === 0) cancelAnimationFrame(animId);
        return next;
      });

      animId = requestAnimationFrame(update);
    };

    update();
    return () => cancelAnimationFrame(animId);
  }, [coins.length]);

  const colors = {
    pending: '#6366f1',
    preparing: '#8b5cf6',
    ready: '#10b981',
    delivered: '#f59e0b',
    completed: '#eab308',
    cancelled: '#ef4444'
  };

  return (
    <div className="w-full h-full flex flex-col justify-between relative">
      <canvas ref={canvasRef} className="absolute inset-0 z-10 pointer-events-none w-full h-full" />

      {/* Swipe Overlay banner */}
      <AnimatePresence>
        {swipeActive && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.0, ease: 'easeInOut' }}
            className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent pointer-events-none z-20"
            style={{ filter: 'blur(8px)' }}
          />
        )}
      </AnimatePresence>

      <div className="font-mono text-[9px] text-slate-500 uppercase tracking-widest text-left mb-4">
        Engine A Active Kitchen KDS Board (200px Cards)
      </div>

      <div className="flex-1 flex gap-5 overflow-x-auto min-h-0 items-center justify-start py-4 px-2">
        {engineA.kdsTickets.length === 0 ? (
          <div className="text-center w-full flex flex-col items-center justify-center">
            <ShoppingCart className="w-16 h-16 text-slate-700 mb-3 animate-pulse" />
            <h3 className="font-display font-black text-white text-base">POS Order Queue Empty</h3>
            <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
              Drag food items into the basket on the right and swipe check out to populate the kitchen display cards.
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {engineA.kdsTickets.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 100, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                className="w-[200px] p-4 rounded-xl border border-white/5 bg-[#03030d] shrink-0 flex flex-col justify-between h-[210px] shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 inset-x-0 h-1.5" style={{ background: colors[t.status] || '#64748b' }} />

                <div className="flex justify-between items-center border-b border-white/5 pb-2 mt-1">
                  <span className="font-mono text-xs text-white font-black">#{t.id}</span>
                  <span 
                    className="font-mono text-[8px] uppercase tracking-widest px-2 py-0.5 rounded font-black"
                    style={{ background: `${colors[t.status]}15`, color: colors[t.status] }}
                  >
                    {t.status}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto py-3 flex flex-col gap-1.5 text-left">
                  {t.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between font-mono text-[10px] text-slate-300">
                      <span>{item.icon} {item.name}</span>
                      <span className="text-slate-500">${item.price}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/5 pt-2 flex justify-between items-center shrink-0">
                  <span className="font-mono text-[8.5px] text-slate-600">{t.timestamp}</span>
                  {t.status !== 'completed' && (
                    <button
                      onClick={() => useSimulationStore.getState().advanceKDSTicket(t.id)}
                      className="px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:border-white/20 font-mono text-[9px] text-white uppercase transition font-black"
                    >
                      Advance &rarr;
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 border-t border-white/5 pt-4 shrink-0">
        <div className="p-3 rounded-lg bg-white/[0.01] border border-white/5 text-left">
          <span className="font-mono text-[8px] text-slate-500 block font-bold uppercase">Kitchen Workload</span>
          <span className="font-mono text-sm font-black text-white">{engineA.kitchenLoad}% capacity</span>
        </div>
        <div className="p-3 rounded-lg bg-white/[0.01] border border-white/5 text-left">
          <span className="font-mono text-[8px] text-slate-500 block font-bold uppercase">Stock Count</span>
          <span className="font-mono text-sm font-black text-white">{engineA.inventoryLevel} items left</span>
        </div>
        <div className="p-3 rounded-lg bg-white/[0.01] border border-white/5 text-left">
          <span className="font-mono text-[8px] text-slate-500 block font-bold uppercase">Channels status</span>
          <span className="font-mono text-sm font-black text-cyan-400">WebSocket Connected</span>
        </div>
      </div>
    </div>
  );
}

function EngineAControls() {
  const store = useSimulationStore();
  const [draggedItem, setDraggedItem] = useState<POSItem | null>(null);

  const foodCatalog: POSItem[] = [
    { id: 'f1', name: 'Beach Burger', price: 16, icon: '🍔' },
    { id: 'f2', name: 'VIP Sushi Plate', price: 28, icon: '🍣' },
    { id: 'f3', name: 'Infinity Ale', price: 9, icon: '🍺' },
    { id: 'f4', name: 'Frozen Mojito', price: 12, icon: '🍹' },
  ];

  const total = store.engineA.cart.reduce((s, i) => s + i.price, 0);

  // Drag handers
  const handleDragStart = (item: POSItem) => {
    setDraggedItem(item);
  };

  const handleDropBasket = () => {
    if (draggedItem) {
      store.addCartItem(draggedItem);
      setDraggedItem(null);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4 text-left">
        <div className="flex items-center gap-2 border-b border-white/5 pb-2">
          <ShoppingCart className="w-5 h-5 text-amber-500" />
          <h2 className="font-display font-black text-white text-sm uppercase">Engine A POS Cockpit</h2>
        </div>

        {/* 120x120 Food item cards */}
        <div className="grid grid-cols-2 gap-3">
          {foodCatalog.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => handleDragStart(item)}
              onClick={() => store.addCartItem(item)}
              className="p-3 h-[110px] rounded-xl border border-white/5 bg-[#02020e]/60 hover:border-amber-500/30 flex flex-col justify-between cursor-grab active:cursor-grabbing transition group select-none relative overflow-hidden"
            >
              <div className="text-left">
                <span className="text-3xl block group-hover:scale-110 transition">{item.icon}</span>
                <h4 className="font-display font-black text-[12px] text-white mt-1.5">{item.name}</h4>
              </div>
              <div className="flex justify-between items-center border-t border-white/5 pt-1.5">
                <span className="font-mono text-[10px] text-slate-500">${item.price}</span>
                <span className="font-mono text-[9px] text-amber-400 font-bold opacity-0 group-hover:opacity-100 transition">DRAG</span>
              </div>
            </div>
          ))}
        </div>

        {/* Drag Drop Basket collector area */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropBasket}
          className="border-2 border-dashed border-white/10 rounded-xl p-4 bg-black/40 text-center flex flex-col items-center justify-center gap-1.5 min-h-[90px] hover:border-amber-500/40 hover:bg-amber-500/[0.02] transition"
        >
          <span className="font-mono text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            Drag items or click to add
          </span>
          <div className="font-mono text-[9px] text-slate-600">
            {store.engineA.cart.length} items in current basket
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center font-mono text-[11px] text-slate-400 border-t border-white/5 pt-3">
          <span>Checkout Total:</span>
          <span className="text-white font-extrabold text-sm">${total}.00</span>
        </div>

        <button
          onClick={() => store.checkoutPOS('takeaway')}
          disabled={store.engineA.cart.length === 0}
          className="w-full py-3 bg-amber-500 text-black font-mono font-black text-[11px] uppercase tracking-widest hover:bg-amber-400 transition disabled:opacity-30 rounded-xl shadow-lg shadow-amber-500/10"
        >
          Swipe & Checkout
        </button>

        <button
          onClick={store.triggerRushHour}
          className="w-full py-2 border border-white/10 hover:border-white/20 text-slate-300 font-mono text-[9px] uppercase tracking-widest transition flex items-center justify-center gap-2 rounded-lg"
        >
          <Flame className="w-4 h-4 text-amber-500 animate-pulse" />
          Simulate KDS Rush Hour
        </button>
      </div>
    </>
  );
}

// ==========================================
// ENGINE B: TIME-EXCLUSIVE RESERVATION
// ==========================================
function EngineBMovie() {
  const { engineB } = useSimulationStore();
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const handleDayClick = (blockId: string, currentDay: number) => {
    const nextDay = (currentDay + 1) % 7;
    useSimulationStore.getState().updateBookingBlock(blockId, nextDay);
  };

  return (
    <div className="w-full h-full flex flex-col justify-between gap-4 relative">
      <div className="absolute top-0 left-0 font-mono text-[9px] text-slate-500 uppercase tracking-widest">
        Engine B Booking Grid (Collision Shake Alerts)
      </div>

      <AnimatePresence>
        {engineB.collisionMessage && (
          <motion.div
            initial={{ opacity: 0, y: -15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15 }}
            className="absolute top-6 inset-x-0 mx-auto max-w-md p-3.5 rounded-xl border border-red-500 bg-red-950/90 text-red-400 font-mono text-[10px] flex items-center gap-3 z-30 shadow-2xl"
          >
            <AlertTriangle className="w-5 h-5 text-red-500 flex-none" />
            <div className="text-left">
              <span className="font-extrabold uppercase">UNIQUE INDEX CONSTRAINT TRIGGERED</span>
              <p className="text-[9px] text-slate-400 mt-0.5">{engineB.collisionMessage}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col justify-center gap-4 mt-8">
        <div className="grid grid-cols-7 gap-2 border-b border-white/5 pb-2">
          {days.map((day) => (
            <div key={day} className="text-center font-mono text-[10px] text-slate-400 font-bold uppercase tracking-wider">{day}</div>
          ))}
        </div>

        {['Ocean Villa 101', 'Beach Cabana A'].map((unit) => {
          const unitBookings = engineB.bookings.filter(b => b.unit === unit);
          
          return (
            <div className="flex flex-col gap-1.5 border border-white/5 p-3 rounded-xl bg-black/30" key={unit}>
              <span className="font-mono text-[9px] text-slate-500 block mb-1 uppercase text-left font-bold">{unit}</span>
              
              <div className="grid grid-cols-7 gap-2 relative h-12 items-center">
                {Array.from({ length: 7 }).map((_, dIdx) => (
                  <div className="h-9 rounded-lg border border-dashed border-white/[0.04] bg-white/[0.005]" key={dIdx} />
                ))}

                {unitBookings.map((b) => {
                  const dayWidth = `calc(${b.duration} * 100% / 7 - 4px)`;
                  const dayLeft = `calc(${b.startDay} * 100% / 7 + 2px)`;
                  const isColliding = engineB.collisionMessage !== null;

                  return (
                    <motion.div
                      key={b.id}
                      onClick={() => handleDayClick(b.id, b.startDay)}
                      style={{
                        position: 'absolute',
                        left: dayLeft,
                        width: dayWidth,
                        zIndex: 10,
                      }}
                      animate={isColliding ? { x: [0, -4, 4, -4, 4, 0] } : {}}
                      transition={{ duration: 0.4 }}
                      whileHover={{ scale: 1.03 }}
                      className={`h-8 rounded-lg flex items-center justify-between px-3 font-mono text-[9px] font-black cursor-pointer transition border shadow-md ${
                        b.status === 'dirty'
                          ? 'border-red-500/40 bg-red-950/20 text-red-400'
                          : b.status === 'cleaning'
                          ? 'border-yellow-500/40 bg-yellow-950/20 text-yellow-400 animate-pulse'
                          : 'border-blue-500/40 bg-blue-950/20 text-blue-400'
                      }`}
                    >
                      <span className="truncate">{b.id.toUpperCase()}</span>
                      <span className="text-[7.5px] uppercase opacity-80 shrink-0">
                        {b.status === 'dirty' ? '🧹 Dirty' : b.status === 'cleaning' ? '⚡ cleaning' : 'OK'}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
        <div className="p-3 rounded-lg bg-white/[0.01] border border-white/5 text-left">
          <span className="font-mono text-[8px] text-slate-500 block uppercase">Calendar Occupancy</span>
          <span className="font-mono text-sm font-black text-white">{engineB.occupancyRate}% allocation rate</span>
        </div>
        <div className="p-3 rounded-lg bg-white/[0.01] border border-white/5 text-left">
          <span className="font-mono text-[8px] text-slate-500 block uppercase">Aggregate Booked Forecast</span>
          <span className="font-mono text-sm font-black text-yellow-400">${engineB.revenueForecast}.00</span>
        </div>
      </div>
    </div>
  );
}

function EngineBControls() {
  const store = useSimulationStore();

  return (
    <>
      <div className="flex flex-col gap-3 text-left">
        <div className="flex items-center gap-2 border-b border-white/5 pb-2">
          <Calendar className="w-5 h-5 text-blue-500" />
          <h2 className="font-display font-black text-white text-sm uppercase">Engine B Reservator</h2>
        </div>

        <p className="text-[11.5px] text-slate-400 leading-relaxed">
          Provides time-slice locking filters. Move reservation blocks inside the grid on the left by clicking them to test overbooking collisions.
        </p>

        {/* Cleaning drone trigger list */}
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[8px] text-slate-500 uppercase tracking-widest block font-bold">Housekeeping control</span>
          <div className="flex flex-col gap-1.5">
            {store.engineB.bookings.map((b) => (
              <div className="flex justify-between items-center p-2.5 rounded-lg border border-white/5 bg-black/45" key={b.id}>
                <span className="font-mono text-[10px] text-slate-300 font-bold">{b.id.toUpperCase()} ({b.unit.split(' ')[0]})</span>
                <button
                  onClick={() => store.triggerHousekeeping(b.id)}
                  disabled={b.status === 'cleaning'}
                  className="px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:border-white/20 font-mono text-[8.5px] text-white uppercase transition disabled:opacity-30"
                >
                  {b.status === 'clean' ? 'Dirty' : b.status === 'dirty' ? 'Sweep Clean' : 'Sweeping...'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/5 pt-3">
        <div className="p-3 rounded-lg bg-blue-950/20 border border-blue-500/20 font-mono text-[9px] text-slate-400 text-left">
          <span className="text-white block font-bold mb-1">CONCURRENT MUTATION SAFETY</span>
          Locks calendar dates via serializable transaction layers, ensuring zero double bookings.
        </div>
      </div>
    </>
  );
}

// ==========================================
// ENGINE C: SHARED CAPACITY ACCESS
// ==========================================
function EngineCMovie() {
  const { engineC } = useSimulationStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sweepY, setSweepY] = useState(0);

  // Trigger laser scan sweeper movement
  useEffect(() => {
    if (engineC.qrState !== 'idle') {
      setSweepY(0);
      const interval = setInterval(() => {
        setSweepY((y) => {
          if (y > 100) {
            clearInterval(interval);
            return 100;
          }
          return y + 6;
        });
      }, 30);
      return () => clearInterval(interval);
    }
  }, [engineC.qrState]);

  // Canvas Vector Elastic Collision Physics Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 450);
    let height = (canvas.height = 180);

    let animationId: number;

    const updatePhysics = () => {
      ctx.clearRect(0, 0, width, height);

      // Water height background
      const fillHeight = height * (engineC.waterLevel / 100);
      ctx.fillStyle = 'rgba(0, 229, 255, 0.12)';
      ctx.fillRect(0, height - fillHeight, width, fillHeight);

      // Wave vector lines
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, height - fillHeight);
      for (let x = 0; x < width; x++) {
        const wave = Math.sin(x * 0.04 + Date.now() * 0.006) * 4;
        ctx.lineTo(x, height - fillHeight + wave);
      }
      ctx.stroke();

      // Guest circles physics
      engineC.guestBubbles.forEach((bubble) => {
        bubble.x += bubble.vx;
        bubble.y += bubble.vy;

        // Wall collisions
        if (bubble.x - bubble.size < 0) {
          bubble.x = bubble.size;
          bubble.vx *= -0.9;
        }
        if (bubble.x + bubble.size > width) {
          bubble.x = width - bubble.size;
          bubble.vx *= -0.9;
        }
        if (bubble.y - bubble.size < 0) {
          bubble.y = bubble.size;
          bubble.vy *= -0.9;
        }
        if (bubble.y + bubble.size > height) {
          bubble.y = height - bubble.size;
          bubble.vy *= -0.9;
        }

        // Particle circles rendering
        ctx.save();
        ctx.beginPath();
        ctx.arc(bubble.x, bubble.y, bubble.size, 0, Math.PI * 2);
        ctx.fillStyle = bubble.type === 'member' ? '#8b5cf6' : '#10b981';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });

      animationId = requestAnimationFrame(updatePhysics);
    };

    updatePhysics();

    return () => cancelAnimationFrame(animationId);
  }, [engineC.guestBubbles, engineC.waterLevel]);

  return (
    <div className="w-full h-full flex flex-col justify-between gap-4 relative">
      <div className="absolute top-0 left-0 font-mono text-[9px] text-slate-500 uppercase tracking-widest">
        Engine C Capacity Pool (Canvas Fluid Physics)
      </div>

      <div className="flex-1 border border-white/5 rounded-xl bg-black/40 mt-6 relative overflow-hidden flex items-center justify-center min-h-[180px]">
        <canvas ref={canvasRef} className="w-full h-full" />
        
        {/* Centered Large HUD Counter */}
        <div className="absolute z-10 text-center pointer-events-none">
          <span className="font-display font-black text-4xl text-cyan-400 drop-shadow-[0_0_12px_#00e5ff]">
            {engineC.guestBubbles.length}
          </span>
          <span className="font-mono text-[8px] text-slate-500 block uppercase font-bold tracking-widest">/ {engineC.capacityLimit} POOL CAPACITY</span>
        </div>

        {/* Capacity alarm alert box */}
        {engineC.guestBubbles.length >= engineC.capacityLimit && (
          <div className="absolute inset-0 bg-red-950/85 border border-red-500 flex flex-col items-center justify-center p-4 text-center z-20 animate-pulse">
            <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
            <span className="font-mono text-[10px] text-red-400 font-black uppercase tracking-widest">CAPACITY BURST THRESHOLD MET</span>
            <span className="text-[8px] text-slate-400 mt-1 uppercase">Gate admission blocked</span>
          </div>
        )}

        {/* Laser scanner overlay sweep */}
        {engineC.qrState !== 'idle' && (
          <div 
            className="absolute inset-x-0 h-1 bg-cyan-400 shadow-[0_0_10px_#00e5ff] z-20 pointer-events-none"
            style={{ top: `${sweepY}%` }}
          />
        )}
      </div>

      {/* Result strip alerts */}
      <AnimatePresence>
        {engineC.qrState !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={`p-3 rounded-lg border font-mono text-[10px] flex items-center gap-2.5 text-left z-20 shadow-md ${
              engineC.qrState === 'success' ? 'border-emerald-500 bg-emerald-950/20 text-emerald-400' : 'border-red-500 bg-red-950/20 text-red-400'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: engineC.qrState === 'success' ? '#10b981' : '#ef4444' }} />
            <div>
              <span className="font-bold">{engineC.qrState === 'success' ? 'ACCESS CONFIRMED' : 'VALIDATION BLOCK'}</span>
              <p className="text-[8px] text-slate-400 mt-0.5">
                {engineC.qrState === 'success' ? 'Bracelet active, connection established' : 'Ticket check rejected: Code invalid/expired'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EngineCControls() {
  const store = useSimulationStore();

  return (
    <>
      <div className="flex flex-col gap-3 text-left">
        <div className="flex items-center gap-2 border-b border-white/5 pb-2">
          <Users className="w-5 h-5 text-emerald-500" />
          <h2 className="font-display font-black text-white text-sm uppercase">Engine C Gate controller</h2>
        </div>

        <p className="text-[11.5px] text-slate-400 leading-relaxed">
          Verifies shared capacity allocations. Uses barcode scanner paths to check wristband IDs before dropping guest coordinate spheres into pool.
        </p>

        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[8.5px] text-slate-500 uppercase tracking-widest block font-bold">Category Colors</span>
          <div className="flex gap-4">
            <span className="flex items-center gap-2 font-mono text-[10px] text-slate-300">
              <span className="w-3 h-3 rounded bg-emerald-500"></span>Guest Tier
            </span>
            <span className="flex items-center gap-2 font-mono text-[10px] text-slate-300">
              <span className="w-3 h-3 rounded bg-purple-500"></span>Member Tier
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => store.scanTicketBubble('guest')}
            className="py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-black text-[9.5px] uppercase tracking-widest transition"
          >
            Scan Guest
          </button>
          <button
            onClick={() => store.scanTicketBubble('member')}
            className="py-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-mono font-black text-[9.5px] uppercase tracking-widest transition"
          >
            Scan Member
          </button>
        </div>

        <button
          onClick={() => store.scanTicketBubble('intruder')}
          className="w-full py-2 border border-red-500/20 hover:border-red-500/40 text-red-400 font-mono text-[9px] uppercase tracking-widest transition rounded-lg"
        >
          Scan Suspended (Intruder)
        </button>

        <button
          onClick={store.clearPool}
          className="w-full py-1.5 border border-white/5 hover:border-white/10 text-slate-500 font-mono text-[9px] uppercase tracking-widest transition rounded"
        >
          Flush pool variables
        </button>
      </div>
    </>
  );
}

// ==========================================
// ENGINE D: ONGOING ENTITLEMENT (VIP CARDS)
// ==========================================
function EngineDMovie() {
  const { engineD } = useSimulationStore();
  const [shatters, setShatters] = useState<number[]>([]);

  // Card shatters logic
  useEffect(() => {
    if (engineD.membershipStatus === 'shattered') {
      setShatters(Array.from({ length: 24 }).map((_, i) => i));
    } else {
      setShatters([]);
    }
  }, [engineD.membershipStatus]);

  return (
    <div className="w-full h-full flex flex-col justify-between gap-4 relative" style={{ perspective: '1000px' }}>
      <div className="absolute top-0 left-0 font-mono text-[9px] text-slate-500 uppercase tracking-widest">
        Engine D VIP Credit Card (320px 3D Shell)
      </div>

      <div className="flex-1 flex flex-col items-center justify-center mt-6">
        <AnimatePresence>
          {engineD.membershipStatus !== 'shattered' ? (
            <motion.div
              animate={{ 
                rotateY: engineD.isFlipped ? 180 : 0,
                y: engineD.membershipStatus === 'dunning' ? [0, -3, 3, -3, 3, 0] : 0
              }}
              transition={{ rotateY: { duration: 0.6 } }}
              className="w-[320px] h-[180px] relative cursor-pointer"
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Card Front face */}
              <div
                className="absolute inset-0 rounded-2xl border p-6 flex flex-col justify-between bg-gradient-to-br from-[#120024] via-[#050014] to-black shadow-2xl overflow-hidden text-left"
                style={{
                  borderColor: engineD.membershipStatus === 'dunning' ? '#f59e0b' : '#8b5cf6',
                  backfaceVisibility: 'hidden',
                  boxShadow: engineD.membershipStatus === 'dunning' ? '0 0 30px rgba(245,158,11,0.2)' : '0 0 30px rgba(139,92,246,0.15)'
                }}
              >
                {/* Embedded Chip Visual */}
                <div className="w-10 h-8 rounded bg-gradient-to-r from-amber-400 to-amber-200 opacity-60 border border-amber-600/30" />

                <div className="flex justify-between items-end border-t border-white/5 pt-3">
                  <div className="flex flex-col">
                    <span className="font-mono text-[8px] text-purple-400 font-bold uppercase tracking-wider">PLATINUM CLUB</span>
                    <h3 className="font-display font-black text-white text-base mt-0.5">V2 RESORT SUITE</h3>
                  </div>
                  <Award className="w-7 h-7 text-purple-400" />
                </div>

                {/* Orange dunning cracks lines */}
                {engineD.membershipStatus === 'dunning' && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
                    <motion.path
                      d="M 40 40 L 140 70 L 220 130"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeDasharray="300"
                      initial={{ strokeDashoffset: 300 }}
                      animate={{ strokeDashoffset: 0 }}
                      transition={{ duration: 1.0 }}
                    />
                    <motion.path
                      d="M 280 20 L 180 80 L 110 160"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="1.5"
                      strokeDasharray="200"
                      initial={{ strokeDashoffset: 200 }}
                      animate={{ strokeDashoffset: 0 }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                    />
                  </svg>
                )}
              </div>

              {/* Card Back face */}
              <div
                className="absolute inset-0 rounded-2xl border border-purple-500 p-6 flex flex-col justify-between bg-[#03030d] text-left"
                style={{
                  transform: 'rotateY(180deg)',
                  backfaceVisibility: 'hidden'
                }}
              >
                <div className="flex flex-col gap-3">
                  <span className="font-mono text-[9px] text-slate-500 uppercase tracking-widest">Stripe billing meter</span>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-purple-500 h-full transition-all duration-300" style={{ width: `${engineD.billingCycleProgress}%` }} />
                  </div>
                </div>

                <div className="font-mono text-[10px] text-slate-400">
                  <div>Next cycle invoice: August 2026</div>
                  <div>Account Scope: global_resort_member</div>
                </div>
              </div>
            </motion.div>
          ) : (
            // Shattered debris fragments falling
            <div className="relative w-[320px] h-[180px] flex items-center justify-center">
              {shatters.map((s, idx) => {
                const angle = (idx / shatters.length) * Math.PI * 2;
                const fx = Math.cos(angle) * (60 + Math.random() * 40);
                const fy = Math.sin(angle) * (60 + Math.random() * 40) + 40;

                return (
                  <motion.div
                    key={s}
                    initial={{ x: 0, y: 0, scale: 1.0, rotate: 0 }}
                    animate={{ x: fx, y: fy, scale: 0.2, rotate: Math.random() * 360 }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                    className="absolute w-8 h-8 bg-red-900 border border-red-500 opacity-80"
                    style={{
                      clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)'
                    }}
                  />
                );
              })}
              <div className="font-mono text-xs text-red-500 font-black animate-pulse uppercase">VIP CARD DELETED</div>
            </div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-3 rounded-lg bg-white/[0.01] border border-white/5 text-left">
        <span className="font-mono text-[8px] text-slate-500 block uppercase font-bold">Billing Health status</span>
        <div className="flex items-center gap-3 mt-1.5">
          <div className="flex-1 bg-slate-800 h-2 rounded-full overflow-hidden">
            <div className="bg-purple-500 h-full transition-all duration-300" style={{ width: `${engineD.cardHealth}%` }} />
          </div>
          <span className="font-mono text-[10px] text-slate-300 font-bold">{engineD.cardHealth}%</span>
        </div>
      </div>
    </div>
  );
}

function EngineDControls() {
  const store = useSimulationStore();

  return (
    <>
      <div className="flex flex-col gap-3 text-left">
        <div className="flex items-center gap-2 border-b border-white/5 pb-2">
          <Award className="w-5 h-5 text-purple-500" />
          <h2 className="font-display font-black text-white text-sm uppercase">Engine D ongoing state</h2>
        </div>

        <p className="text-[11.5px] text-slate-400 leading-relaxed">
          Stripe recurring engine check. Tick Stripe cycles to bill customers. If credit card payment bounces, RLS schedules warnings before card shatters.
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        <button
          onClick={store.toggleCardFlip}
          className="w-full py-2 border border-white/10 hover:border-white/20 text-slate-300 font-mono text-[9px] uppercase tracking-widest transition rounded-lg"
        >
          Flip Card Details
        </button>

        <button
          onClick={store.advanceBillingCycle}
          className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-mono font-black text-[9.5px] uppercase tracking-widest transition rounded-lg shadow-lg"
        >
          Tick Stripe Cycle
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={store.triggerGracePeriod}
            disabled={store.engineD.isGracePeriod}
            className="py-2 border border-red-500/20 hover:border-red-500/40 text-red-400 font-mono text-[9px] uppercase tracking-widest transition disabled:opacity-40 rounded-lg"
          >
            Fail payment
          </button>
          <button
            onClick={store.healCard}
            disabled={!store.engineD.isGracePeriod && store.engineD.membershipStatus === 'active'}
            className="py-2 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 font-mono text-[9px] uppercase tracking-widest transition disabled:opacity-40 rounded-lg"
          >
            Heal Card
          </button>
        </div>
      </div>
    </>
  );
}

// ==========================================
// ENGINE E: PLATFORM SaaS SYSTEM (SOLAR)
// ==========================================
function EngineEMovie() {
  const { engineE } = useSimulationStore();

  return (
    <div className="w-full h-full flex flex-col justify-between gap-4 relative">
      <div className="absolute top-0 left-0 font-mono text-[9px] text-slate-500 uppercase tracking-widest">
        Engine E platform solar orbits (Provisioning solar)
      </div>

      <div className="flex-1 flex items-center justify-center mt-6 relative overflow-hidden min-h-[190px]">
        {/* Orbit tracks rings */}
        <div className="absolute w-[120px] h-[120px] rounded-full border border-white/[0.03] pointer-events-none" />
        <div className="absolute w-[210px] h-[210px] rounded-full border border-white/[0.03] pointer-events-none" />

        {/* Central platform Sun */}
        <div className="w-12 h-12 rounded-full border border-yellow-500 bg-yellow-500/10 flex items-center justify-center z-10 shadow-[0_0_25px_rgba(234,179,8,0.25)]">
          <Globe className="w-5 h-5 text-yellow-500 animate-spin" style={{ animationDuration: '30s' }} />
        </div>

        {/* Orbiting planets */}
        {engineE.tenantsList.map((tenant, idx) => {
          const isSuspended = tenant.status === 'suspended';
          const isPastDue = tenant.status === 'past_due';

          return (
            <motion.div
              key={tenant.id}
              animate={isSuspended ? {} : { rotate: 360 }}
              transition={{
                repeat: Infinity,
                duration: 15 + idx * 8,
                ease: 'linear'
              }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div
                style={{
                  transform: `translateX(${70 + idx * 45}px)`,
                  borderColor: isSuspended ? '#ef4444' : isPastDue ? '#f59e0b' : tenant.color,
                  background: isSuspended ? 'rgba(239, 68, 68, 0.2)' : 'rgba(2,2,18,0.95)',
                  boxShadow: isSuspended ? '0 0 15px #ef4444' : `0 0 10px ${tenant.color}35`
                }}
                className="w-8 h-8 rounded-full border flex items-center justify-center pointer-events-auto cursor-pointer relative"
              >
                <span className="text-[10px]">🏢</span>
                <div className="absolute -top-6 px-1.5 py-0.5 rounded bg-black/95 border border-white/10 text-[7px] font-mono text-white opacity-85 whitespace-nowrap">
                  {tenant.name.split('.')[0]}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="p-3 rounded-lg bg-white/[0.01] border border-white/5 flex justify-between items-center font-mono text-[10px] text-left">
        <div>
          <span className="text-slate-500 block text-[8px] uppercase font-bold">Onboarding State</span>
          <span className="text-white font-black">{engineE.provisioningStep}</span>
        </div>
        <div className="text-right">
          <span className="text-slate-500 block text-[8px] uppercase font-bold">Unified MRR Total</span>
          <span className="text-yellow-400 font-black text-sm">${engineE.mrrTotal}</span>
        </div>
      </div>
    </div>
  );
}

function EngineEControls() {
  const store = useSimulationStore();
  const [tenantName, setTenantName] = useState('quantum');
  const [targetId, setTargetId] = useState('1');
  const [status, setStatus] = useState<BillingStatus>('active');

  const handleIgnite = () => {
    store.igniteTenant(tenantName);
    setTenantName('');
  };

  const handleUpdateStatus = () => {
    store.setTenantBillingStatus(targetId, status);
  };

  return (
    <>
      <div className="flex flex-col gap-3 text-left">
        <div className="flex items-center gap-2 border-b border-white/5 pb-2">
          <Globe className="w-5 h-5 text-yellow-500" />
          <h2 className="font-display font-black text-white text-sm uppercase">Engine E control</h2>
        </div>

        <div className="flex flex-col gap-1">
          <span className="font-mono text-[8px] text-slate-500 uppercase tracking-widest font-bold">Onboard New Tenant</span>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={tenantName} 
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="e.g. quantum"
              className="flex-1 p-1 bg-black border border-white/10 rounded font-mono text-xs text-white"
            />
            <button 
              onClick={handleIgnite}
              disabled={!tenantName}
              className="px-3 bg-yellow-500 hover:bg-yellow-400 text-black font-mono font-bold text-[9px] uppercase rounded transition disabled:opacity-40"
            >
              Sign Up
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 mt-2">
          <span className="font-mono text-[8px] text-slate-500 uppercase tracking-widest block font-bold">Update Tenant status</span>
          <div className="grid grid-cols-2 gap-2">
            <select 
              value={targetId} 
              onChange={(e) => setTargetId(e.target.value)}
              className="p-1 bg-black border border-white/10 rounded font-mono text-[10px] text-white"
            >
              {store.engineE.tenantsList.map(t => (
                <option key={t.id} value={t.id}>{t.name.split('.')[0]}</option>
              ))}
            </select>

            <select 
              value={status} 
              onChange={(e) => setStatus(e.target.value as BillingStatus)}
              className="p-1 bg-black border border-white/10 rounded font-mono text-[10px] text-white"
            >
              <option value="active">Active</option>
              <option value="past_due">Past Due</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <button
            onClick={handleUpdateStatus}
            className="w-full py-1.5 rounded border border-yellow-500/20 hover:border-yellow-500/40 text-yellow-500 font-mono text-[8.5px] uppercase tracking-widest transition"
          >
            Apply Tenant Status
          </button>
        </div>
      </div>

      <div className="border-t border-white/5 pt-3">
        <button
          onClick={() => {
            const nextStatus = store.billingStatus === 'suspended' ? 'active' : 'suspended';
            store.setBillingStatus(nextStatus);
          }}
          className={`w-full py-2.5 rounded border font-mono font-black text-[9.5px] uppercase tracking-widest transition ${
            store.billingStatus === 'suspended'
              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
              : 'border-red-500 bg-red-500/10 text-red-400'
          }`}
        >
          {store.billingStatus === 'suspended' ? 'Resume Platform' : 'Suspend Platform (Freeze)'}
        </button>
      </div>
    </>
  );
}
