'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { fadeInUp, staggerContainer, scaleIn } from '@/lib/animations/presets';
import {
  QrCode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Ticket,
  Clock,
  User,
  Calendar,
  LogIn,
  LogOut,
  RefreshCw,
} from 'lucide-react';

interface ValidationResult {
  success: boolean;
  message: string;
  ticket?: {
    id: string;
    ticket_number: string;
    ticket_type: string;
    status: string;
    valid_date: string;
    users?: {
      full_name: string;
      email: string;
    };
  };
}

interface ScanHistory {
  id: string;
  code: string;
  success: boolean;
  message: string;
  timestamp: Date;
}

export default function StaffScannerPage() {
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<ValidationResult | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistory[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount and after each scan
  useEffect(() => {
    inputRef.current?.focus();
  }, [lastResult]);

  const handleScan = async (code: string) => {
    if (!code.trim()) return;

    setLoading(true);
    setLastResult(null);

    try {
      const response = await api.post('/pool/staff/validate', { ticketNumber: code.trim() });
      const result: ValidationResult = {
        success: true,
        message: response.data.message || 'Ticket validated successfully',
        ticket: response.data.data,
      };
      setLastResult(result);
      setScanHistory((prev) => [
        { id: Date.now().toString(), code, success: true, message: result.message, timestamp: new Date() },
        ...prev.slice(0, 9),
      ]);
      toast.success(result.message);
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      const result: ValidationResult = {
        success: false,
        message: axiosError.response?.data?.error || 'Invalid or expired ticket',
      };
      setLastResult(result);
      setScanHistory((prev) => [
        { id: Date.now().toString(), code, success: false, message: result.message, timestamp: new Date() },
        ...prev.slice(0, 9),
      ]);
      toast.error(result.message);
    } finally {
      setLoading(false);
      setManualCode('');
      inputRef.current?.focus();
    }
  };

  const handleEntry = async () => {
    if (!lastResult?.ticket?.id) return;

    try {
      await api.post(`/pool/tickets/${lastResult.ticket.id}/entry`);
      toast.success('Entry recorded successfully');
      setLastResult(null);
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'Failed to record entry');
    }
  };

  const handleExit = async () => {
    if (!lastResult?.ticket?.id) return;

    try {
      await api.post(`/pool/tickets/${lastResult.ticket.id}/exit`);
      toast.success('Exit recorded successfully');
      setLastResult(null);
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'Failed to record exit');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleScan(manualCode);
  };

  const clearHistory = () => {
    setScanHistory([]);
    setLastResult(null);
  };

  const ticketTypeLabels: Record<string, string> = {
    adult: 'Adult',
    child: 'Child',
    family: 'Family',
    vip: 'VIP',
  };

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            Ticket Scanner
          </h1>
          <p className="text-slate-500 dark:text-slate-400">Scan pool tickets to validate entry</p>
        </div>
        <Button variant="outline" onClick={clearHistory}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Clear History
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scanner Input */}
        <motion.div variants={fadeInUp}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                Scan or Enter Code
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Input
                    ref={inputRef}
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Enter ticket code or scan QR..."
                    className="text-center text-lg font-mono h-14"
                    autoFocus
                    autoComplete="off"
                  />
                </div>
                <Button type="submit" className="w-full h-12" disabled={loading || !manualCode.trim()}>
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <Ticket className="w-4 h-4 mr-2" />
                      Validate Ticket
                    </>
                  )}
                </Button>
              </form>

              {/* Scan Result */}
              <AnimatePresence>
                {lastResult && (
                  <motion.div
                    variants={scaleIn}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    className={`mt-6 p-6 rounded-xl ${
                      lastResult.success
                        ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-500'
                        : 'bg-red-50 dark:bg-red-900/20 border-2 border-red-500'
                    }`}
                  >
                    <div className="flex items-center gap-4 mb-4">
                      {lastResult.success ? (
                        <CheckCircle2 className="w-12 h-12 text-green-500" />
                      ) : (
                        <XCircle className="w-12 h-12 text-red-500" />
                      )}
                      <div>
                        <h3 className={`text-xl font-bold ${lastResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                          {lastResult.success ? 'Valid Ticket' : 'Invalid Ticket'}
                        </h3>
                        <p className="text-slate-600 dark:text-slate-400">{lastResult.message}</p>
                      </div>
                    </div>

                    {lastResult.ticket && (
                      <>
                        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                          <div className="flex items-center gap-2">
                            <Ticket className="w-4 h-4 text-slate-500" />
                            <span className="font-mono">{lastResult.ticket.ticket_number}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                              {ticketTypeLabels[lastResult.ticket.ticket_type] || lastResult.ticket.ticket_type}
                            </span>
                          </div>
                          {lastResult.ticket.users && (
                            <div className="flex items-center gap-2 col-span-2">
                              <User className="w-4 h-4 text-slate-500" />
                              <span>{lastResult.ticket.users.full_name}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-500" />
                            <span>{new Date(lastResult.ticket.valid_date).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button onClick={handleEntry} className="flex-1">
                            <LogIn className="w-4 h-4 mr-2" />
                            Record Entry
                          </Button>
                          <Button onClick={handleExit} variant="outline" className="flex-1">
                            <LogOut className="w-4 h-4 mr-2" />
                            Record Exit
                          </Button>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        {/* Scan History */}
        <motion.div variants={fadeInUp}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Scans
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scanHistory.length === 0 ? (
                <div className="text-center py-12">
                  <QrCode className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">No scans yet</p>
                  <p className="text-sm text-slate-400 dark:text-slate-500">Scanned tickets will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {scanHistory.map((scan, index) => (
                    <motion.div
                      key={scan.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`p-3 rounded-lg flex items-center justify-between ${
                        scan.success
                          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                          : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {scan.success ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                        <div>
                          <p className="font-mono text-sm">{scan.code}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{scan.message}</p>
                        </div>
                      </div>
                      <span className="text-xs text-slate-400">
                        {scan.timestamp.toLocaleTimeString()}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
