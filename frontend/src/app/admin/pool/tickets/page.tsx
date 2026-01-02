'use client';

import { useEffect, useState, useCallback } from 'react';
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
} from 'lucide-react';

interface PoolTicket {
  id: string;
  ticket_number: string;
  ticket_type: 'adult' | 'child' | 'family' | 'vip';
  price: number;
  status: 'pending' | 'active' | 'used' | 'expired' | 'cancelled';
  valid_date: string;
  created_at: string;
  users?: {
    full_name: string;
    email: string;
  };
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
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
  const [tickets, setTickets] = useState<PoolTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const fetchTickets = useCallback(async () => {
    try {
      const response = await api.get('/pool/staff/tickets/today');
      setTickets(response.data.data || []);
    } catch (error) {
      toast.error('Failed to fetch tickets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const cancelTicket = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this ticket?')) return;
    
    try {
      await api.put(`/pool/tickets/${id}/cancel`);
      toast.success('Ticket cancelled');
      fetchTickets();
    } catch (error) {
      toast.error('Failed to cancel ticket');
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (typeFilter !== 'all' && t.ticket_type !== typeFilter) return false;
    return true;
  });

  const stats = {
    total: tickets.length,
    active: tickets.filter((t) => t.status === 'active').length,
    pending: tickets.filter((t) => t.status === 'pending').length,
    todayRevenue: tickets
      .filter((t) => t.valid_date === new Date().toISOString().split('T')[0])
      .reduce((sum, t) => sum + t.price, 0),
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pool Tickets</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage pool entry tickets</p>
        </div>
        <Button variant="outline" onClick={fetchTickets}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Total Tickets</p>
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
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Active</p>
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
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Pending</p>
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
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Today's Revenue</p>
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
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="used">Used</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">All Types</option>
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
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Ticket</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Guest</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Valid Date</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Price</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      No tickets found
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
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-white ${ticketTypeColors[ticket.ticket_type]}`}>
                          {ticket.ticket_type.charAt(0).toUpperCase() + ticket.ticket_type.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">
                            {ticket.users?.full_name || 'Guest'}
                          </p>
                          <p className="text-sm text-slate-500">{ticket.users?.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {ticket.valid_date}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {formatCurrency(ticket.price)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[ticket.status]}`}>
                          {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
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
    </motion.div>
  );
}
