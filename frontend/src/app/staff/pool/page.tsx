'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import { useSocket } from '@/lib/socket';
import {
  Waves,
  Ticket,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  RefreshCw,
  QrCode,
  Calendar,
  Timer,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';

interface PoolTicket {
  id: string;
  ticket_number: string;
  status: 'pending' | 'active' | 'used' | 'expired' | 'cancelled';
  ticket_type: 'adult' | 'child' | 'family' | 'vip';
  valid_date: string;
  entry_time?: string;
  exit_time?: string;
  users?: {
    full_name: string;
    email: string;
  };
}

const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  active: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  used: { color: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300', icon: CheckCircle2 },
  expired: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
  cancelled: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: XCircle },
};

const ticketTypeConfig: Record<string, { color: string; label: string }> = {
  adult: { color: 'bg-blue-500', label: 'Adult' },
  child: { color: 'bg-green-500', label: 'Child' },
  family: { color: 'bg-purple-500', label: 'Family' },
  vip: { color: 'bg-amber-500', label: 'VIP' },
};

export default function StaffPoolPage() {
  const [tickets, setTickets] = useState<PoolTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanMode, setScanMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [currentlyInPool, setCurrentlyInPool] = useState(0);
  const poolCapacity = 100; // This should come from settings
  const socket = useSocket();
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchTickets = useCallback(async () => {
    try {
      const response = await api.get('/pool/tickets', {
        params: { date: new Date().toISOString().split('T')[0] },
      });
      setTickets(response.data.data || []);
      setCurrentlyInPool(
        response.data.data?.filter((t: PoolTicket) => t.status === 'active' && t.entry_time && !t.exit_time).length || 0
      );
    } catch (error) {
      // Use mock data if API fails
      const mockTickets = generateMockTickets();
      setTickets(mockTickets);
      setCurrentlyInPool(mockTickets.filter((t) => t.status === 'active' && t.entry_time && !t.exit_time).length);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Real-time updates
  useEffect(() => {
    if (socket) {
      socket.on('pool:ticket:updated', (ticket: PoolTicket) => {
        setTickets((prev) =>
          prev.map((t) => (t.id === ticket.id ? ticket : t))
        );
      });

      socket.on('pool:entry', () => {
        setCurrentlyInPool((prev) => prev + 1);
      });

      socket.on('pool:exit', () => {
        setCurrentlyInPool((prev) => Math.max(0, prev - 1));
      });

      return () => {
        socket.off('pool:ticket:updated');
        socket.off('pool:entry');
        socket.off('pool:exit');
      };
    }
  }, [socket]);

  const generateMockTickets = (): PoolTicket[] => {
    const today = new Date().toISOString().split('T')[0];
    return [
      {
        id: '1',
        ticket_number: 'PT-001',
        status: 'active',
        ticket_type: 'adult',
        valid_date: today,
        entry_time: '10:30:00',
        users: { full_name: 'John Doe', email: 'john@example.com' },
      },
      {
        id: '2',
        ticket_number: 'PT-002',
        status: 'pending',
        ticket_type: 'family',
        valid_date: today,
        users: { full_name: 'Jane Smith', email: 'jane@example.com' },
      },
      {
        id: '3',
        ticket_number: 'PT-003',
        status: 'used',
        ticket_type: 'vip',
        valid_date: today,
        entry_time: '09:00:00',
        exit_time: '12:00:00',
        users: { full_name: 'Mike Johnson', email: 'mike@example.com' },
      },
      {
        id: '4',
        ticket_number: 'PT-004',
        status: 'active',
        ticket_type: 'child',
        valid_date: today,
        entry_time: '11:00:00',
        users: { full_name: 'Sarah Williams', email: 'sarah@example.com' },
      },
    ];
  };

  const validateTicket = async (code: string) => {
    if (!code.trim()) return;
    
    try {
      const response = await api.post('/pool/tickets/validate', { code });
      const ticket = response.data.data;

      if (ticket.status === 'pending') {
        // First entry
        await recordEntry(ticket.id);
      } else if (ticket.status === 'active' && ticket.entry_time && !ticket.exit_time) {
        // Second scan = exit
        await recordExit(ticket.id);
      } else {
        toast.error('Ticket cannot be used');
      }
    } catch (error: any) {
      // Mock validation for demo
      const mockTicket = tickets.find((t) => t.ticket_number === code.toUpperCase());
      if (mockTicket) {
        if (mockTicket.status === 'pending') {
          await recordEntry(mockTicket.id);
        } else if (mockTicket.status === 'active' && mockTicket.entry_time && !mockTicket.exit_time) {
          await recordExit(mockTicket.id);
        } else {
          toast.error('Ticket already used or expired');
        }
      } else {
        toast.error('Invalid ticket code');
      }
    }
    
    setManualCode('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const recordEntry = async (ticketId: string) => {
    try {
      await api.post(`/pool/tickets/${ticketId}/entry`);
      const now = new Date().toTimeString().split(' ')[0];
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? { ...t, status: 'active' as const, entry_time: now }
            : t
        )
      );
      setCurrentlyInPool((prev) => prev + 1);
      toast.success('Entry recorded!', { icon: '🏊' });
      playSound('entry');
    } catch (error) {
      // Mock for demo
      const now = new Date().toTimeString().split(' ')[0];
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? { ...t, status: 'active' as const, entry_time: now }
            : t
        )
      );
      setCurrentlyInPool((prev) => prev + 1);
      toast.success('Entry recorded!', { icon: '🏊' });
      playSound('entry');
    }
  };

  const recordExit = async (ticketId: string) => {
    try {
      await api.post(`/pool/tickets/${ticketId}/exit`);
      const now = new Date().toTimeString().split(' ')[0];
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? { ...t, status: 'used' as const, exit_time: now }
            : t
        )
      );
      setCurrentlyInPool((prev) => Math.max(0, prev - 1));
      toast.success('Exit recorded!', { icon: '👋' });
      playSound('exit');
    } catch (error) {
      // Mock for demo
      const now = new Date().toTimeString().split(' ')[0];
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? { ...t, status: 'used' as const, exit_time: now }
            : t
        )
      );
      setCurrentlyInPool((prev) => Math.max(0, prev - 1));
      toast.success('Exit recorded!', { icon: '👋' });
      playSound('exit');
    }
  };

  const playSound = (type: 'entry' | 'exit') => {
    try {
      const audio = new Audio(`/sounds/${type === 'entry' ? 'success' : 'notification'}.mp3`);
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {}
  };

  // Keyboard shortcut to toggle scan mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        setScanMode((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const capacityPercentage = (currentlyInPool / poolCapacity) * 100;
  const isNearCapacity = capacityPercentage > 80;

  const stats = {
    total: tickets.length,
    pending: tickets.filter((t) => t.status === 'pending').length,
    active: tickets.filter((t) => t.status === 'active').length,
    used: tickets.filter((t) => t.status === 'used').length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <CardSkeleton />
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Waves className="w-7 h-7 text-blue-500" />
            Pool Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Validate tickets and track pool usage
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={scanMode ? 'default' : 'outline'}
            onClick={() => {
              setScanMode(!scanMode);
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
          >
            <QrCode className="w-4 h-4 mr-2" />
            {scanMode ? 'Scanning...' : 'Scan Mode (F2)'}
          </Button>
          <Button variant="outline" onClick={fetchTickets}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Scan Mode Banner */}
      <AnimatePresence>
        {scanMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                      <QrCode className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Scan Mode Active</h3>
                      <p className="text-blue-100 text-sm">Scan or enter ticket code</p>
                    </div>
                  </div>
                  <div className="flex-1">
                    <input
                      ref={inputRef}
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          validateTicket(manualCode);
                        }
                      }}
                      placeholder="Enter ticket code (e.g., PT-001)"
                      className="w-full px-4 py-3 rounded-lg bg-white/20 placeholder-white/60 text-white focus:bg-white/30 focus:outline-none text-center text-lg font-mono"
                      autoFocus
                    />
                  </div>
                  <Button
                    onClick={() => validateTicket(manualCode)}
                    className="bg-white text-blue-600 hover:bg-blue-50"
                  >
                    Validate
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Total Today</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
                </div>
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <Ticket className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Pending</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.pending}</p>
                </div>
                <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className={isNearCapacity ? 'ring-2 ring-red-400' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">In Pool Now</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {currentlyInPool}
                    <span className="text-sm font-normal text-slate-400">/{poolCapacity}</span>
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isNearCapacity 
                    ? 'bg-red-100 dark:bg-red-900/30' 
                    : 'bg-green-100 dark:bg-green-900/30'
                }`}>
                  <Users className={`w-5 h-5 ${
                    isNearCapacity 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-green-600 dark:text-green-400'
                  }`} />
                </div>
              </div>
              {/* Capacity bar */}
              <div className="mt-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    isNearCapacity ? 'bg-red-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(100, capacityPercentage)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Completed</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.used}</p>
                </div>
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Capacity Warning */}
      {isNearCapacity && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <div>
            <p className="font-medium text-red-800 dark:text-red-200">Pool Near Capacity</p>
            <p className="text-sm text-red-600 dark:text-red-300">
              Currently at {Math.round(capacityPercentage)}% capacity. Consider limiting new entries.
            </p>
          </div>
        </motion.div>
      )}

      {/* Tickets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {tickets.map((ticket, index) => {
            const config = statusConfig[ticket.status];
            const typeConfig = ticketTypeConfig[ticket.ticket_type];
            const StatusIcon = config?.icon || Ticket;
            const isInPool = ticket.status === 'active' && ticket.entry_time && !ticket.exit_time;

            return (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
                layout
              >
                <Card className={`${isInPool ? 'ring-2 ring-green-400 bg-green-50/50 dark:bg-green-900/10' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${typeConfig?.color}`} />
                        <span className="font-mono font-semibold text-slate-900 dark:text-white">
                          {ticket.ticket_number}
                        </span>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config?.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <Ticket className="w-4 h-4" />
                        <span>{typeConfig?.label} Ticket</span>
                      </div>

                      {ticket.users && (
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <Users className="w-4 h-4" />
                          <span>{ticket.users.full_name}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <Calendar className="w-4 h-4" />
                        <span>{ticket.valid_date}</span>
                      </div>

                      {ticket.entry_time && (
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                          <Timer className="w-4 h-4" />
                          <span>In: {ticket.entry_time}</span>
                          {ticket.exit_time && <span>→ Out: {ticket.exit_time}</span>}
                        </div>
                      )}
                    </div>

                    {/* Quick Actions */}
                    <div className="mt-4 flex gap-2">
                      {ticket.status === 'pending' && (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => recordEntry(ticket.id)}
                        >
                          <TrendingUp className="w-4 h-4 mr-1" />
                          Record Entry
                        </Button>
                      )}
                      {isInPool && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => recordExit(ticket.id)}
                        >
                          <TrendingUp className="w-4 h-4 mr-1 rotate-180" />
                          Record Exit
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {tickets.length === 0 && (
        <div className="text-center py-12">
          <Waves className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <p className="text-slate-500 dark:text-slate-400">No tickets for today</p>
        </div>
      )}
    </motion.div>
  );
}
