'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import {
  Calendar,
  Ticket,
  Users,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  LogIn,
  LogOut,
  Loader2,
  AlertCircle,
  Clock,
  Wrench,
  Plus,
  Beaker,
  FileText,
} from 'lucide-react';

export interface SessionAccessDashboardProps {
  slug: string;
  moduleName: string;
  moduleId?: string;
}

interface CapacitySession {
  id: string;
  name: string;
  capacity: number;
  currentCount: number;
  startTime: string;
  endTime: string;
  utilizationPercent: number;
}

interface CapacityData {
  date: string;
  totalCapacity: number;
  totalOccupancy: number;
  utilizationPercent: number;
  sessions: CapacitySession[];
}

interface TicketData {
  id: string;
  ticketNumber: string;
  customerName: string;
  customerPhone: string;
  guests: number;
  status: string;
  paymentStatus: string;
  entryTime: string | null;
  exitTime: string | null;
  totalAmount: number;
  sessionName: string;
  sessionTime: string;
}

interface ValidationResult {
  valid: boolean;
  reason?: string;
  ticket?: {
    id: string;
    ticketNumber: string;
    status: string;
    guestName: string;
    sessionName: string;
    entryTime: string | null;
    exitTime: string | null;
  };
}

interface MaintenanceLog {
  id: string;
  type: 'cleaning' | 'chemical_check' | 'repair' | 'inspection';
  readings: Record<string, string | number>;
  notes: string;
  created_at: string;
  users?: { full_name: string };
}

export function SessionAccessDashboard({ slug, moduleName, moduleId }: SessionAccessDashboardProps) {
  const [activeTab, setActiveTab] = useState<'tickets' | 'maintenance' | 'bracelets'>('tickets');
  const [capacity, setCapacity] = useState<CapacityData | null>(null);
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [scanInput, setScanInput] = useState('');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);

  // Maintenance state
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [showAddMaintenanceForm, setShowAddMaintenanceForm] = useState(false);
  const [maintenanceType, setMaintenanceType] = useState('inspection');
  const [maintenanceNotes, setMaintenanceNotes] = useState('');
  const [maintenanceReadings, setMaintenanceReadings] = useState({ ph: '', chlorine: '', temperature: '' });
  const [bracelets, setBracelets] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [slug]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [capRes, ticketsRes] = await Promise.all([
        api.get(`/staff/modules/${slug}/capacity`).catch(() => null),
        api.get(`/staff/modules/${slug}/today-tickets`).catch(() => null),
      ]);
      if (capRes?.data?.data) setCapacity(capRes.data.data);
      if (ticketsRes?.data?.data) setTickets(ticketsRes.data.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const createStaffTicket = async () => {
    try {
      const sessionId = window.prompt('Session ID');
      if (!sessionId) return;
      const quantityRaw = window.prompt('Quantity', '1');
      const quantity = Number(quantityRaw || '1');
      if (!Number.isFinite(quantity) || quantity < 1) {
        toast.error('Invalid quantity');
        return;
      }
      await api.post('/pool/staff/tickets', {
        session_id: sessionId,
        quantity,
        ticket_type: 'adult',
        payment_method: 'cash',
      });
      toast.success('Ticket sold successfully');
      loadData();
    } catch (error) {
      toast.error('Failed to sell ticket');
    }
  };

  const handleValidate = async () => {
    if (!scanInput.trim()) return;
    setIsValidating(true);
    setValidationResult(null);
    try {
      const response = await api.post(`/staff/modules/${slug}/validate-ticket`, {
        ticketNumber: scanInput.trim(),
      });
      setValidationResult(response.data.data);
    } catch (error) {
      toast.error('Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handleEntry = async (ticketId: string) => {
    try {
      await api.post(`/staff/modules/${slug}/entry`, { ticketId });
      toast.success('Entry recorded');
      setValidationResult(null);
      setScanInput('');
      loadData();
    } catch (error) {
      toast.error('Failed to record entry');
    }
  };

  const handleExit = async (ticketId: string) => {
    try {
      await api.post(`/staff/modules/${slug}/exit`, { ticketId });
      toast.success('Exit recorded');
      loadData();
    } catch (error) {
      toast.error('Failed to record exit');
    }
  };

  const loadMaintenanceLogs = async () => {
    try {
      const { data } = await api.get(`/staff/modules/${slug}/maintenance`);
      setMaintenanceLogs(data.data || []);
    } catch (error) {
      // Maintenance may not be available for all modules
    }
  };

  const loadBracelets = async () => {
    try {
      const { data } = await api.get('/pool/staff/bracelets/active');
      setBracelets(data.data || []);
    } catch (error) {
      toast.error('Failed to load bracelets');
    }
  };

  const assignBracelet = async () => {
    try {
      const ticketId = window.prompt('Ticket ID');
      if (!ticketId) return;
      const braceletNumber = window.prompt('Bracelet number');
      if (!braceletNumber) return;
      await api.post(`/pool/tickets/${ticketId}/bracelet`, { braceletNumber });
      toast.success('Bracelet assigned');
      loadBracelets();
    } catch (error) {
      toast.error('Failed to assign bracelet');
    }
  };

  const returnBracelet = async (ticketId: string) => {
    try {
      await api.delete(`/pool/tickets/${ticketId}/bracelet`);
      toast.success('Bracelet returned');
      loadBracelets();
    } catch (error) {
      toast.error('Failed to return bracelet');
    }
  };

  const overrideCapacity = async () => {
    try {
      const sessionId = window.prompt('Session ID to override');
      const additionalRaw = window.prompt('Additional capacity');
      const reason = window.prompt('Reason');
      if (!sessionId || !additionalRaw || !reason) return;
      const additional = Number(additionalRaw);
      if (!Number.isFinite(additional) || additional <= 0) {
        toast.error('Invalid additional capacity');
        return;
      }
      await api.post(`/pool/sessions/${sessionId}/capacity/override`, {
        additional,
        reason,
        approved_by: 'manager',
      });
      toast.success('Capacity overridden');
      loadData();
    } catch (error) {
      toast.error('Failed to override capacity');
    }
  };

  const handleMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/staff/modules/${slug}/maintenance`, {
        type: maintenanceType,
        notes: maintenanceNotes,
        readings: maintenanceType === 'chemical_check' ? maintenanceReadings : {},
      });
      toast.success('Maintenance log saved');
      setShowAddMaintenanceForm(false);
      setMaintenanceNotes('');
      setMaintenanceReadings({ ph: '', chlorine: '', temperature: '' });
      loadMaintenanceLogs();
    } catch (error) {
      toast.error('Failed to save maintenance log');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <header className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Ticket className="h-8 w-8 text-primary" />
            {moduleName} Management
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage sessions, validate tickets, and track capacity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={createStaffTicket}>Sell Ticket</Button>
          <Button variant="outline" size="icon" onClick={loadData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-1 inline-flex gap-1">
        <button
          onClick={() => setActiveTab('tickets')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'tickets'
              ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Ticket className="w-4 h-4 inline mr-1" /> Tickets & Capacity
        </button>
        <button
          onClick={() => { setActiveTab('maintenance'); loadMaintenanceLogs(); }}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'maintenance'
              ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Wrench className="w-4 h-4 inline mr-1" /> Maintenance Logs
        </button>
        <button
          onClick={() => { setActiveTab('bracelets'); loadBracelets(); }}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'bracelets'
              ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Ticket className="w-4 h-4 inline mr-1" /> Bracelets
        </button>
      </div>

      {activeTab === 'tickets' && (<>
      {/* Capacity Overview */}
      {capacity && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Capacity</p>
                  <p className="text-3xl font-bold">{capacity.totalCapacity}</p>
                </div>
                <Users className="h-10 w-10 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Current Occupancy</p>
                  <p className="text-3xl font-bold">{capacity.totalOccupancy}</p>
                </div>
                <LogIn className="h-10 w-10 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Utilization</p>
                  <p className="text-3xl font-bold">{capacity.utilizationPercent}%</p>
                </div>
                <div className="w-10 h-10 rounded-full border-4 border-primary flex items-center justify-center">
                  <span className="text-xs font-bold">{capacity.utilizationPercent}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {capacity?.utilizationPercent && capacity.utilizationPercent >= 100 && (
        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <p className="text-sm text-red-600 dark:text-red-400">Pool full for active sessions.</p>
            <Button onClick={overrideCapacity}>Override Capacity</Button>
          </CardContent>
        </Card>
      )}

      {/* Sessions Capacity Bars */}
      {capacity && capacity.sessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              Session Capacity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {capacity.sessions.map((session) => (
                <div key={session.id}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{session.name}</span>
                      <span className="text-xs text-gray-500">{session.startTime} - {session.endTime}</span>
                    </div>
                    <span className="text-sm font-bold">{session.currentCount}/{session.capacity}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        session.utilizationPercent >= 90 ? 'bg-red-500' :
                        session.utilizationPercent >= 70 ? 'bg-amber-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, session.utilizationPercent)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ticket Validation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-green-500" />
            Validate Ticket
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <input
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
              placeholder="Scan or enter ticket number..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              autoFocus
            />
            <Button onClick={handleValidate} disabled={isValidating}>
              {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Validate'}
            </Button>
          </div>

          {/* Validation Result */}
          {validationResult && (
            <div className={`mt-4 p-4 rounded-lg border ${
              validationResult.valid
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-center gap-3">
                {validationResult.valid ? (
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-600" />
                )}
                <div className="flex-1">
                  <p className={`font-bold ${validationResult.valid ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                    {validationResult.valid ? 'VALID TICKET' : 'INVALID TICKET'}
                  </p>
                  {validationResult.reason && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{validationResult.reason}</p>
                  )}
                  {validationResult.ticket && (
                    <div className="text-sm mt-1 space-y-0.5">
                      <p>Guest: <span className="font-medium">{validationResult.ticket.guestName}</span></p>
                      <p>Session: <span className="font-medium">{validationResult.ticket.sessionName}</span></p>
                      <p>Ticket: <span className="font-mono">{validationResult.ticket.ticketNumber}</span></p>
                    </div>
                  )}
                </div>
                {validationResult.valid && validationResult.ticket && !validationResult.ticket.entryTime && (
                  <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleEntry(validationResult.ticket!.id)}>
                    <LogIn className="h-4 w-4 mr-1" /> Record Entry
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's Tickets Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-purple-500" />
            Today&apos;s Tickets ({tickets.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Ticket className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>No tickets for today</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Ticket</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Guest</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Session</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Guests</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Entry</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2 px-3 font-mono text-xs">{ticket.ticketNumber}</td>
                      <td className="py-2 px-3">
                        <div>
                          <p className="font-medium">{ticket.customerName}</p>
                          <p className="text-xs text-gray-500">{ticket.customerPhone}</p>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <p className="text-xs">{ticket.sessionName}</p>
                        <p className="text-xs text-gray-500">{ticket.sessionTime}</p>
                      </td>
                      <td className="py-2 px-3">{ticket.guests}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          ticket.status === 'valid' ? 'bg-green-100 text-green-700' :
                          ticket.status === 'used' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        {ticket.entryTime ? (
                          <div className="text-xs">
                            <p className="text-green-600">{new Date(ticket.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            {ticket.exitTime && (
                              <p className="text-red-600">{new Date(ticket.exitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex gap-1">
                          {ticket.status === 'valid' && !ticket.entryTime && (
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white text-xs" onClick={() => handleEntry(ticket.id)}>
                              <LogIn className="h-3 w-3 mr-1" /> In
                            </Button>
                          )}
                          {ticket.entryTime && !ticket.exitTime && (
                            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white text-xs" onClick={() => handleExit(ticket.id)}>
                              <LogOut className="h-3 w-3 mr-1" /> Out
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      </>)}

      {/* Maintenance Tab */}
      {activeTab === 'maintenance' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Maintenance Logs</h2>
            <Button onClick={() => setShowAddMaintenanceForm(!showAddMaintenanceForm)}>
              <Plus className="w-4 h-4 mr-2" /> Add Log
            </Button>
          </div>

          {showAddMaintenanceForm && (
            <Card>
              <CardContent className="p-4">
                <form onSubmit={handleMaintenanceSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Type</label>
                      <select
                        className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                        value={maintenanceType}
                        onChange={(e) => setMaintenanceType(e.target.value)}
                      >
                        <option value="chemical_check">Chemical Check</option>
                        <option value="cleaning">Cleaning</option>
                        <option value="repair">Repair</option>
                        <option value="inspection">Inspection</option>
                      </select>
                    </div>
                  </div>

                  {maintenanceType === 'chemical_check' && (
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">pH Level</label>
                        <input
                          type="number" step="0.1"
                          className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                          value={maintenanceReadings.ph}
                          onChange={(e) => setMaintenanceReadings({ ...maintenanceReadings, ph: e.target.value })}
                          placeholder="7.2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Chlorine (ppm)</label>
                        <input
                          type="number" step="0.1"
                          className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                          value={maintenanceReadings.chlorine}
                          onChange={(e) => setMaintenanceReadings({ ...maintenanceReadings, chlorine: e.target.value })}
                          placeholder="1.5"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Temp (°C)</label>
                        <input
                          type="number" step="0.1"
                          className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                          value={maintenanceReadings.temperature}
                          onChange={(e) => setMaintenanceReadings({ ...maintenanceReadings, temperature: e.target.value })}
                          placeholder="26"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Notes</label>
                    <textarea
                      className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                      value={maintenanceNotes}
                      onChange={(e) => setMaintenanceNotes(e.target.value)}
                      placeholder="Details about the task..."
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowAddMaintenanceForm(false)}>Cancel</Button>
                    <Button type="submit">Save Log</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {maintenanceLogs.map((log) => (
              <Card key={log.id}>
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      log.type === 'chemical_check' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' :
                      log.type === 'cleaning' ? 'bg-green-100 text-green-600 dark:bg-green-900/30' :
                      'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    }`}>
                      {log.type === 'chemical_check' ? <Beaker className="w-5 h-5" /> :
                       log.type === 'cleaning' ? <FileText className="w-5 h-5" /> :
                       <Wrench className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-semibold capitalize text-slate-900 dark:text-white">{log.type.replace('_', ' ')}</p>
                      <p className="text-sm text-slate-500">
                        {new Date(log.created_at).toLocaleString()} {log.users?.full_name ? `• ${log.users.full_name}` : ''}
                      </p>
                      {log.notes && <p className="text-sm mt-1 text-slate-600 dark:text-slate-300">{log.notes}</p>}
                    </div>
                  </div>
                  {log.readings && Object.keys(log.readings).length > 0 && (
                    <div className="flex gap-6 text-sm bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">
                      {Object.entries(log.readings).map(([key, val]) => (
                        <div key={key} className="text-center">
                          <span className="block text-slate-500 text-xs uppercase mb-1">{key}</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">{val}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {maintenanceLogs.length === 0 && (
              <p className="text-center text-slate-500 py-8">No maintenance logs found.</p>
            )}
          </div>
        </div>
      )}
      {activeTab === 'bracelets' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Active Bracelets</h2>
            <Button onClick={assignBracelet}>Assign Bracelet</Button>
          </div>
          <Card>
            <CardContent className="pt-4 space-y-2">
              {bracelets.length === 0 && <p className="text-sm text-slate-500">No active bracelets.</p>}
              {bracelets.map((item) => (
                <div key={item.id} className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 py-2">
                  <div className="text-sm">
                    <p className="font-medium">{item.bracelet_number} - {item.customer_name || 'Guest'}</p>
                    <p className="text-slate-500">{item.ticket_number}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => returnBracelet(item.id)}>
                    Return Bracelet
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
