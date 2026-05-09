'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl'; // IMPROVE Iter-9: i18n
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
  transaction?: {
    id: string;
    engine_type: 'instant_transaction' | 'shared_capacity_access' | 'time_exclusive_reservation' | 'ongoing_entitlement';
    status: string;
    amount: number;
    metadata: {
      qr_code?: string;
      order_number?: string;
      ticket_number?: string;
      booking_number?: string;
      membership_number?: string;
      session_id?: string;
      adults?: number;
      children?: number;
      customer_name?: string;
    };
    customer?: {
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
  const t = useTranslations('staffScanner'); // IMPROVE Iter-9: i18n
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
      const response = await api.post('/staff/scan', { code: code.trim() });
      const result: ValidationResult = {
        success: !!response.data.valid,
        message: response.data.message || t('ticketValidated'),
        transaction: response.data.transaction || response.data.entity, // Support both new and legacy response
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
        message: axiosError.response?.data?.error || t('invalidOrExpired'), // IMPROVE Iter-9: i18n
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

  const handleTransition = async (event: 'scan_entry' | 'scan_exit' | 'scan_validate') => {
    if (!lastResult?.transaction?.id) return;

    try {
      await api.post('/engines/transition', {
        transactionId: lastResult.transaction.id,
        event,
        context: {
          scannedBy: 'staff', // Will be replaced with actual staff ID from auth context
          timestamp: new Date().toISOString(),
        },
      });
      toast.success(event === 'scan_entry' ? t('entryRecorded') : t('exitRecorded'));
      setLastResult(null);
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || t('failedRecordTransition'));
    }
  };

  const canTransition = (tx: ValidationResult['transaction']) => {
    if (!tx) return false;
    // shared_capacity_access: confirmed → active (entry), active → used (exit)
    // time_exclusive_reservation: confirmed → checked_in
    const transitionableStatuses = ['confirmed', 'active', 'ready'];
    return transitionableStatuses.includes(tx.status);
  };

  const getTransitionActions = (tx: ValidationResult['transaction']) => {
    if (!tx) return [];
    
    switch (tx.engine_type) {
      case 'shared_capacity_access':
        if (tx.status === 'confirmed') return [{ event: 'scan_entry' as const, label: t('recordEntry') }];
        if (tx.status === 'active') return [{ event: 'scan_exit' as const, label: t('recordExit') }];
        return [];
      case 'time_exclusive_reservation':
        if (tx.status === 'confirmed') return [{ event: 'scan_validate' as const, label: t('recordCheckIn') }];
        return [];
      case 'instant_transaction':
        if (tx.status === 'ready') return [{ event: 'scan_validate' as const, label: t('recordServed') }];
        return [];
      default:
        return [];
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


  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            {t('title')}{/* IMPROVE Iter-9: i18n */}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">{t('subtitle')}{/* IMPROVE Iter-9: i18n */}</p>
        </div>
        <Button variant="outline" onClick={clearHistory}>
          <RefreshCw className="w-4 h-4 mr-2" />
          {t('clearHistory')}{/* IMPROVE Iter-9: i18n */}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scanner Input */}
        <motion.div variants={fadeInUp}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                {t('scanOrEnterCode')}{/* IMPROVE Iter-9: i18n */}
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
                    placeholder={t('enterTicketCode')} // IMPROVE Iter-9: i18n
                    className="text-center text-lg font-mono h-14"
                    autoFocus
                    autoComplete="off"
                  />
                </div>
                <Button type="submit" className="w-full h-12" disabled={loading || !manualCode.trim()}>
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      {t('validating')}{/* IMPROVE Iter-9: i18n */}
                    </>
                  ) : (
                    <>
                      <Ticket className="w-4 h-4 mr-2" />
                      {t('validateTicket')}{/* IMPROVE Iter-9: i18n */}
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
                          {lastResult.success ? t('validTicket') : t('invalidTicket')}{/* IMPROVE Iter-9: i18n */}
                        </h3>
                        <p className="text-slate-600 dark:text-slate-400">{lastResult.message}</p>
                      </div>
                    </div>

                    {lastResult.transaction && (
                      <>
                        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                          <div className="flex items-center gap-2">
                            <Ticket className="w-4 h-4 text-slate-500" />
                            <span className="font-mono">
                              {lastResult.transaction.metadata.ticket_number
                                || lastResult.transaction.metadata.booking_number
                                || lastResult.transaction.metadata.order_number
                                || lastResult.transaction.metadata.membership_number
                                || lastResult.transaction.id.slice(0, 8)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                              {lastResult.transaction.engine_type.replace(/_/g, ' ')}
                            </span>
                            <span className="px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
                              {lastResult.transaction.status}
                            </span>
                          </div>
                          {lastResult.transaction.customer?.full_name && (
                            <div className="flex items-center gap-2 col-span-2">
                              <User className="w-4 h-4 text-slate-500" />
                              <span>{lastResult.transaction.customer.full_name}</span>
                            </div>
                          )}
                          {lastResult.transaction.metadata.qr_code && (
                            <div className="flex items-center gap-2">
                              <QrCode className="w-4 h-4 text-slate-500" />
                              <span className="font-mono text-xs">{lastResult.transaction.metadata.qr_code}</span>
                            </div>
                          )}
                        </div>

                        {canTransition(lastResult.transaction) && (
                          <div className="flex gap-2">
                            {getTransitionActions(lastResult.transaction).map((action) => (
                              <Button 
                                key={action.event}
                                onClick={() => handleTransition(action.event)} 
                                className="flex-1"
                                variant={action.event === 'scan_exit' ? 'outline' : 'default'}
                              >
                                {action.event === 'scan_entry' && <LogIn className="w-4 h-4 mr-2" />}
                                {action.event === 'scan_exit' && <LogOut className="w-4 h-4 mr-2" />}
                                {action.event === 'scan_validate' && <CheckCircle2 className="w-4 h-4 mr-2" />}
                                {action.label}
                              </Button>
                            ))}
                          </div>
                        )}
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
                {t('recentScans')}{/* IMPROVE Iter-9: i18n */}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scanHistory.length === 0 ? (
                <div className="text-center py-12">
                  <QrCode className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">{t('noScansYet')}</p>{/* IMPROVE Iter-9: i18n */}
                  <p className="text-sm text-slate-400 dark:text-slate-500">{t('scannedTicketsWillAppear')}</p>{/* IMPROVE Iter-9: i18n */}
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
