'use client';

import { use, useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';
import { 
    Ticket, QrCode, Search, CheckCircle2, XCircle, Clock, 
    RefreshCw, Users, CreditCard, LucideIcon 
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

interface ModuleTicket {
  id: string;
  ticket_number: string;
  status: 'pending' | 'active' | 'used' | 'expired' | 'cancelled' | 'valid';
  guest_name?: string;
  number_of_guests?: number;
  valid_date?: string;
  ticket_date?: string;
  session_name?: string;
}

const statusConfig: Record<string, { color: string; icon: LucideIcon }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  active: { color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  valid: { color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  used: { color: 'bg-slate-100 text-slate-800', icon: CheckCircle2 },
  expired: { color: 'bg-red-100 text-red-800', icon: XCircle },
  cancelled: { color: 'bg-orange-100 text-orange-800', icon: XCircle },
};

export default function ModuleTicketsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [tickets, setTickets] = useState<ModuleTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualCode, setManualCode] = useState('');
  const [validating, setValidating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      // Generic endpoint: /api/:slug/staff/tickets/today
      const response = await api.get(`/${slug}/staff/tickets/today`, {
        params: { date: new Date().toISOString().split('T')[0] },
      }).catch(err => {
        // Fallback for modules that might not have this endpoint yet
        console.warn(`Endpoint /${slug}/staff/tickets/today not found or error`, err);
        return { data: { data: [] } }; 
      });
      
      setTickets(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load tickets');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const validateTicket = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!manualCode.trim()) return;
    
    setValidating(true);
    try {
      // Generic endpoint: /api/:slug/staff/validate
      const response = await api.post(`/${slug}/staff/validate`, { ticketNumber: manualCode });
      
      toast.success(response.data.message || 'Ticket validated!', { icon: '🎟️' });
      setManualCode('');
      fetchTickets(); // Refresh list to show status change
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      const errorMessage = axiosError.response?.data?.error || 'Invalid ticket code';
      toast.error(errorMessage);
    } finally {
      setValidating(false);
      inputRef.current?.focus();
    }
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${config.color}`}>
        <Icon className="w-3 h-3" />
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight capitalize">{slug} Tickets</h1>
          <p className="text-muted-foreground">Scan and manage entry tickets for today</p>
        </div>
        <Button onClick={fetchTickets} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Scanner / Manual Entry Card */}
        <Card className="md:col-span-1 shadow-md border-primary/20">
          <CardHeader className="bg-muted/50 pb-4">
            <CardTitle className="text-lg flex items-center">
              <QrCode className="w-5 h-5 mr-2 text-primary" />
              Ticket Entry
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="bg-slate-900 text-white p-6 rounded-lg text-center mx-auto mb-4 relative overflow-hidden group">
               {/* Simulated Camera View */}
               <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover:opacity-10 transition-opacity">
                 <QrCode className="w-32 h-32" />
               </div>
               <div className="relative z-10">
                 <p className="text-sm text-slate-400 mb-2">Scanner Active</p>
                 <div className="w-full h-1 bg-red-500 shadow-[0_0_10px_red] animate-pulse"></div>
               </div>
            </div>

            <form onSubmit={validateTicket} className="flex gap-2">
              <Input 
                ref={inputRef}
                placeholder="Scan or type ticket #" 
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                autoFocus
                className="font-mono uppercase"
              />
              <Button type="submit" disabled={validating || !manualCode}>
                {validating ? '...' : 'Go'}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground text-center">
              Enter ticket ID (e.g. TICK-1234)
            </p>
          </CardContent>
        </Card>

        {/* Recent Tickets List */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Today's Log</span>
              <Badge variant="secondary" className="font-mono">
                {tickets.length} Total
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tickets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Ticket className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No tickets scanned for {slug} today</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                 {tickets.map((ticket) => (
                   <div key={ticket.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium">{ticket.guest_name || 'Guest'}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                             <span className="font-mono">{ticket.ticket_number}</span>
                             <span>•</span>
                             <span>{ticket.number_of_guests} Person(s)</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(ticket.status)}
                        <p className="text-xs text-muted-foreground mt-1">
                          {ticket.session_name || 'Standard Entry'}
                        </p>
                      </div>
                   </div>
                 ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
