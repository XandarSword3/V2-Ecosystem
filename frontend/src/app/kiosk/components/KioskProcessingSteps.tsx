'use client';

import {
  CreditCard,
  Key,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
} from 'lucide-react';
import { GuestInfo, KioskMode, KioskStep } from './types';

export interface KioskProcessingStepsProps {
  step: KioskStep;
  mode: KioskMode;
  guestInfo: GuestInfo | null;
  loading: boolean;
  error: string | null;
  onProcessPayment: () => void;
  onEncodeKey: () => void;
  onReset: () => void;
}

export function KioskProcessingSteps({
  step,
  mode,
  guestInfo,
  loading,
  error,
  onProcessPayment,
  onEncodeKey,
  onReset,
}: KioskProcessingStepsProps) {
  /* Error State */
  if (step === 'error') {
    return (
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-4">Something went wrong</h2>
        <p className="text-slate-400 mb-8">{error}</p>
        <button
          onClick={onReset}
          className="px-8 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors"
        >
          Return to Home
        </button>
      </div>
    );
  }

  /* Payment Step */
  if (step === 'payment') {
    return (
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-orange-500/20 flex items-center justify-center">
          <CreditCard className="w-10 h-10 text-orange-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Payment Required</h2>
        <p className="text-slate-400 mb-8">Please settle your outstanding balance</p>

        <div className="bg-slate-800/50 rounded-2xl p-6 mb-8">
          <p className="text-slate-500 text-sm mb-2">Amount Due</p>
          <p className="text-4xl font-bold text-white">${guestInfo?.balance?.toFixed(2)}</p>
        </div>

        <button
          onClick={onProcessPayment}
          disabled={loading}
          className="w-full px-8 py-4 bg-orange-600 text-white text-lg font-semibold rounded-xl hover:bg-orange-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing Payment...
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              Insert or Tap Card
            </>
          )}
        </button>

        <p className="text-slate-500 text-sm mt-4">
          Please insert, tap, or swipe your card when prompted
        </p>
      </div>
    );
  }

  /* Key Encoding Step */
  if (step === 'key') {
    return (
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-500/20 flex items-center justify-center">
          <Key className="w-10 h-10 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Encoding Your Room Key</h2>
        <p className="text-slate-400 mb-8">Please wait while we prepare your room key</p>

        {loading ? (
          <div className="space-y-4">
            <div className="w-32 h-32 mx-auto rounded-xl bg-slate-800 flex items-center justify-center">
              <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
            </div>
            <p className="text-blue-400">Encoding key card...</p>
          </div>
        ) : (
          <button
            onClick={onEncodeKey}
            className="w-full px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-500 transition-colors"
          >
            Dispense Room Key
          </button>
        )}
      </div>
    );
  }

  /* Complete Step */
  if (step === 'complete') {
    return (
      <div className="text-center">
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center animate-bounce">
          <CheckCircle className="w-14 h-14 text-green-400" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">
          {mode === 'checkin' ? 'Welcome!' : 'Thank You!'}
        </h2>
        <p className="text-slate-400 mb-8">
          {mode === 'checkin'
            ? `Your room ${guestInfo?.room} is ready. Enjoy your stay!`
            : 'We hope you enjoyed your stay. See you again soon!'}
        </p>

        {mode === 'checkin' && (
          <div className="bg-slate-800/50 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-center gap-4">
              <Key className="w-8 h-8 text-green-400" />
              <div className="text-left">
                <p className="text-slate-500 text-sm">Room Number</p>
                <p className="text-3xl font-bold text-white">{guestInfo?.room}</p>
              </div>
            </div>
            <p className="text-green-400 text-sm mt-4">
              ✓ Key card dispensed below
            </p>
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={onReset}
            className="flex-1 px-8 py-4 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors"
          >
            Done
          </button>
          <button className="flex-1 px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors flex items-center justify-center gap-2">
            <FileText className="w-5 h-5" />
            Print Receipt
          </button>
        </div>
      </div>
    );
  }

  return null;
}
