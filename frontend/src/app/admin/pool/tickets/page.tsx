'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Ticket,
  Users,
  Clock,
  Calendar,
  CheckCircle2,
  Eye,
  X,
  QrCode,
  Search,
  LogOut,
} from 'lucide-react';

interface PoolTicket {
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
  entry_time?: string;
  exit_time?: string;
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

export default function AdminPoolTicketsPage() {
  const t = useTranslations('adminPool');
  const tc = useTranslations('adminCommon');
  
  const [tickets, setTickets] = useState<PoolTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<PoolTicket | null>(null);
  const [validationCode, setValidationCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ success: boolean; message: string; ticket?: PoolTicket } | null>(null);
  const validationInputRef = useRef<HTMLInputElement>(null);

  const validateTicket = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validationCode.trim() || validating) return;

    setValidating(true);
    setValidationResult(null);

    try {
      const response = await api.post('/pool/staff/validate', { ticketNumber: validationCode.trim() });
      const ticket = response.data.data;
      setValidationResult({
        success: true,
        message: response.data.message || 'Ticket validated successfully!',
        ticket,
      });
      toast.success(response.data.message || 'Ticket validated!', { icon: '🏊' });
      fetchTickets(); // Refresh list
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      const errorMessage = axiosError.response?.data?.error || 'Invalid ticket code';
      setValidationResult({
        success: false,
        message: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setValidating(false);
      setValidationCode('');
      validationInputRef.current?.focus();
    }
  };

  const fetchTickets = useCallback(async () => {
    try {
      const response = await api.get('/pool/staff/tickets/today');
      setTickets(response.data.data || []);
    } catch (error) {
      toast.error(tc('errors.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [tc]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const cancelTicket = async (id: string) => {
    if (!confirm(tc('confirmAction'))) return;
    
    try {
      await api.put(`/pool/tickets/${id}/cancel`);
      toast.success(t('tickets.ticketCancelled'));
      fetchTickets();
    } catch (error) {
      toast.error(tc('errors.failedToUpdate'));
    }
  };

  const recordExit = async (id: string) => {
    try {
      await api.post(`/pool/tickets/${id}/exit`);
      toast.success('Exit recorded successfully!', { icon: '🚪' });
      fetchTickets();
    } catch (error) {
      toast.error('Failed to record exit');
    }
  };

  // Helper to check if guest is currently in pool (has entry_time but no exit_time)
  const isInPool = (ticket: PoolTicket) => {
    return ticket.entry_time && !ticket.exit_time;
  };

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (typeFilter !== 'all' && t.ticket_type !== typeFilter) return false;
    return true;
  });

  // Helper to get ticket price
  const getTicketPrice = (t: PoolTicket): number => {
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('tickets.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400">{t('title')}</p>
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
                  <p className="text-slate-500 dark:text-slate-400 text-sm">{t('tickets.totalTickets')}</p>
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
                  <p className="text-slate-500 dark:text-slate-400 text-sm">{tc('active')}</p>
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
                  <p className="text-slate-500 dark:text-slate-400 text-sm">{tc('status')}</p>
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
                  <p className="text-slate-500 dark:text-slate-400 text-sm">{tc('total')}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(stats.todayRevenue)}</p>
                </div>
                <Calendar className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Ticket Validation Section */}
      <motion.div variants={fadeInUp}>
        <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <QrCode className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Validate Ticket</h3>
            </div>
            <form onSubmit={validateTicket} className="flex gap-3">
              <div className="flex-1">
                <input
                  ref={validationInputRef}
                  type="text"
                  value={validationCode}
                  onChange={(e) => setValidationCode(e.target.value)}
                  placeholder="Enter ticket number (e.g., P-260118-1234)"
                  className="w-full px-4 py-3 rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <Button 
                type="submit" 
                disabled={validating || !validationCode.trim()}
                className="px-6 bg-blue-600 hover:bg-blue-700"
              >
                {validating ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Search className="w-5 h-5 mr-2" />
                    Validate
                  </>
                )}
              </Button>
            </form>
            
            {/* Validation Result */}
            <AnimatePresence>
              {validationResult && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`mt-4 p-4 rounded-lg ${
                    validationResult.success
                      ? 'bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800'
                      : 'bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {validationResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <X className="w-5 h-5 text-red-600 dark:text-red-400" />
                    )}
                    <span className={validationResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                      {validationResult.message}
                    </span>
                  </div>
                  {validationResult.ticket && (
                    <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                      <p>Ticket: {validationResult.ticket.ticket_number}</p>
                      <p>Customer: {validationResult.ticket.customer_name || 'N/A'}</p>
                      <p>Guests: {validationResult.ticket.number_of_guests || 1}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">{tc('all')} {tc('status')}</option>
              <option value="pending">{tc('status')}</option>
              <option value="active">{tc('active')}</option>
              <option value="used">{tc('status')}</option>
              <option value="expired">{tc('status')}</option>
              <option value="cancelled">{tc('status')}</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">{tc('all')}</option>
              <option value="adult">Adult</option>
              <option value="child">Child</option>
              <option value="family">Family</option>
              <option value="vip">VIP</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">{t('tickets.ticketNumber')}</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">{tc('status')}</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">{t('tickets.guestInfo')}</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">{t('tickets.validDate')}</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">{tc('price')}</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">{tc('status')}</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      {tc('noResults')}
                    </td>
                  </tr>
                ) : (
                  filteredTickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-4">
                        <span className="font-mono font-medium text-slate-900 dark:text-white">
                          {ticket.ticket_number}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {ticket.ticket_type ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-white ${ticketTypeColors[ticket.ticket_type] || 'bg-slate-500'}`}>
                            {ticket.ticket_type.charAt(0).toUpperCase() + ticket.ticket_type.slice(1)}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-sm">
                            {ticket.number_of_guests || 1} guest(s)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">
                            {ticket.customer_name || ticket.users?.full_name || 'Guest'}
                          </p>
                          <p className="text-sm text-slate-500">{ticket.customer_phone || ticket.users?.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {ticket.ticket_date ? new Date(ticket.ticket_date).toLocaleDateString() : ticket.valid_date || 'N/A'}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {formatCurrency(getTicketPrice(ticket))}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[ticket.status] || 'bg-green-100 text-green-800'}`}>
                          {(ticket.status || 'valid').toUpperCase()}
                        </span>
                        {isInPool(ticket) && (
                          <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            🏊 IN POOL
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedTicket(ticket)}>
                          <Eye className="w-4 h-4 text-slate-500" />
                        </Button>
                        {isInPool(ticket) && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => recordExit(ticket.id)}
                            title="Record Exit"
                          >
                            <LogOut className="w-4 h-4 text-orange-500" />
                          </Button>
                        )}
                        {(ticket.status === 'pending' || ticket.status === 'active') && (
                          <Button variant="ghost" size="sm" onClick={() => cancelTicket(ticket.id)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
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

      {/* Ticket Details Modal */}
      <AnimatePresence>
        {selectedTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('tickets.ticketDetails')}</h2>
                <Button variant="ghost" size="sm" onClick={() => setSelectedTicket(null)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">{t('tickets.ticketNumber')}</p>
                    <p className="font-mono font-medium">{selectedTicket.ticket_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{tc('status')}</p>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[selectedTicket.status] || 'bg-green-100 text-green-800'}`}>
                      {(selectedTicket.status || 'valid').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{tc('quantity')}</p>
                    <p className="font-medium">{selectedTicket.number_of_guests || 1} guest(s)</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{tc('price')}</p>
                    <p className="font-medium text-lg text-green-600">{formatCurrency(getTicketPrice(selectedTicket))}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('tickets.ticketDate')}</p>
                    <p className="font-medium">{selectedTicket.ticket_date ? new Date(selectedTicket.ticket_date).toLocaleDateString() : selectedTicket.valid_date || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('tickets.createdAt')}</p>
                    <p className="font-medium">{new Date(selectedTicket.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Payment Status</p>
                    <p className="font-medium capitalize">{selectedTicket.payment_status || 'pending'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Payment Method</p>
                    <p className="font-medium capitalize">{selectedTicket.payment_method || 'cash'}</p>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                  <h3 className="font-medium mb-2">{t('tickets.guestInfo')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500">{tc('name')}</p>
                      <p className="font-medium">{selectedTicket.customer_name || selectedTicket.users?.full_name || 'Guest'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">{tc('phone')} / {tc('email')}</p>
                      <p className="font-medium">{selectedTicket.customer_phone || selectedTicket.users?.email || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* QR Code if available */}
                {selectedTicket.qr_code && (
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <h3 className="font-medium mb-2">{t('tickets.qrCode')}</h3>
                    <div className="flex justify-center">
                      <img src={selectedTicket.qr_code} alt="Ticket QR Code" className="w-32 h-32" />
                    </div>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
                <Button onClick={() => setSelectedTicket(null)}>{tc('close')}</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
