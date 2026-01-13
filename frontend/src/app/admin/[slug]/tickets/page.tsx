'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { useSiteSettings } from '@/lib/settings-context';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  RefreshCw,
  Ticket,
  Clock,
  Calendar,
  CheckCircle2,
  Eye,
  X,
} from 'lucide-react';

interface TicketItem {
  id: string;
  ticket_number: string;
  ticket_type?: 'adult' | 'child' | 'family' | 'vip';
  price?: number;
  total_amount?: number | string;
  status: 'pending' | 'active' | 'used' | 'expired' | 'cancelled' | 'valid';
  valid_date?: string;
  ticket_date?: string;
  created_at: string;
  payment_status?: string;
  payment_method?: string;
  number_of_guests?: number;
  customer_name?: string;
  customer_phone?: string;
  session_id?: string;
  qr_code?: string;
  users?: {
    full_name: string;
    email: string;
    phone?: string;
  };
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  valid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  used: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
  expired: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
};

const ticketTypeColors: Record<string, string> = {
  adult: 'bg-blue-500',
  child: 'bg-green-500',
  family: 'bg-purple-500',
  vip: 'bg-amber-500',
};

export default function DynamicTicketsPage() {
  const params = useParams();
  const { modules } = useSiteSettings();
  const tc = useTranslations('adminCommon');
  const slug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const currentModule = modules.find(m => m.slug === slug);

  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);

  const fetchTickets = useCallback(async () => {
    if (!currentModule) return;
    try {
      const response = await api.get('/pool/staff/tickets/today', { params: { moduleId: currentModule.id } });
      setTickets(response.data.data || []);
    } catch (error) {
      toast.error(tc('errors.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [currentModule]);

  useEffect(() => {
    if (currentModule) {
      fetchTickets();
    }
  }, [currentModule, fetchTickets]);

  const cancelTicket = async (id: string) => {
    if (!confirm(tc('tickets.confirmCancel'))) return;
    try {
      await api.put(`/pool/tickets/${id}/cancel`);
      toast.success(tc('tickets.ticketCancelled'));
      fetchTickets();
    } catch (error) {
      toast.error(tc('errors.failedToSave'));
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (typeFilter !== 'all' && t.ticket_type !== typeFilter) return false;
    return true;
  });

  const getTicketPrice = (t: TicketItem): number => {
    if (t.price) return typeof t.price === 'number' ? t.price : parseFloat(String(t.price));
    if (t.total_amount) return typeof t.total_amount === 'number' ? t.total_amount : parseFloat(String(t.total_amount));
    return 0;
  };

  const stats = {
    total: tickets.length,
    active: tickets.filter((t) => t.status === 'active' || t.status === 'valid').length,
    pending: tickets.filter((t) => t.status === 'pending').length,
    todayRevenue: tickets.reduce((sum, t) => sum + getTicketPrice(t), 0),
  };

  if (!currentModule) return null;

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
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{currentModule.name} {tc('tickets.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400">{tc('tickets.manageEntryTickets')}</p>
        </div>
        <Button variant="outline" onClick={fetchTickets}>
          <RefreshCw className="w-4 h-4 mr-2" />
          {tc('refresh')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">{tc('tickets.totalTickets')}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
                </div>
                <Ticket className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">{tc('tickets.active')}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.active}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">{tc('orders.pending')}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.pending}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">{tc('tickets.todaysRevenue')}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(stats.todayRevenue)}</p>
                </div>
                <Calendar className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
            >
              <option value="all">{tc('filters.allStatus')}</option>
              <option value="pending">{tc('orders.pending')}</option>
              <option value="active">{tc('tickets.active')}</option>
              <option value="valid">{tc('tickets.valid')}</option>
              <option value="used">{tc('tickets.used')}</option>
              <option value="expired">{tc('tickets.expired')}</option>
              <option value="cancelled">{tc('orders.cancelled')}</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
            >
              <option value="all">{tc('filters.allTypes')}</option>
              <option value="adult">{tc('sessions.adult')}</option>
              <option value="child">{tc('sessions.child')}</option>
              <option value="family">{tc('tickets.family')}</option>
              <option value="vip">{tc('tickets.vip')}</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{tc('tickets.ticketNumber')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{tc('tickets.type')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{tc('tickets.customer')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{tc('tickets.price')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{tc('tables.status')}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">{tc('tables.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">{tc('tickets.noTicketsFound')}</td>
                  </tr>
                ) : (
                  filteredTickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">{ticket.ticket_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs text-white ${ticketTypeColors[ticket.ticket_type || 'adult']}`}>
                          {ticket.ticket_type || 'adult'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900 dark:text-white">{ticket.customer_name || ticket.users?.full_name || 'Guest'}</div>
                        <div className="text-xs text-slate-500">{ticket.customer_phone || ticket.users?.phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">{formatCurrency(getTicketPrice(ticket))}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[ticket.status]}`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button onClick={() => setSelectedTicket(ticket)} className="text-blue-600 hover:text-blue-800 mr-3">
                          <Eye className="w-4 h-4" />
                        </button>
                        {ticket.status === 'active' && (
                          <button onClick={() => cancelTicket(ticket.id)} className="text-red-600 hover:text-red-800">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Ticket Detail Modal */}
      <AnimatePresence>
        {selectedTicket && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedTicket(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{tc('tickets.ticketDetails')}</h3>
                <button onClick={() => setSelectedTicket(null)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500">{tc('tickets.ticketNumber')}</p>
                  <p className="font-mono font-bold text-lg">{selectedTicket.ticket_number}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">{tc('tickets.type')}</p>
                    <p className="font-medium capitalize">{selectedTicket.ticket_type || 'Adult'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{tc('tables.status')}</p>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[selectedTicket.status]}`}>
                      {selectedTicket.status}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{tc('tickets.customer')}</p>
                  <p className="font-medium">{selectedTicket.customer_name || selectedTicket.users?.full_name || 'Guest'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{tc('tickets.price')}</p>
                  <p className="font-bold text-lg text-green-600">{formatCurrency(getTicketPrice(selectedTicket))}</p>
                </div>
                {selectedTicket.qr_code && (
                  <div className="flex justify-center">
                    <img src={selectedTicket.qr_code} alt="QR Code" className="w-32 h-32" />
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
