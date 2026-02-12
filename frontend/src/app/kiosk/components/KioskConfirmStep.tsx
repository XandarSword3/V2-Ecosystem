'use client';

import { CheckCircle, ArrowRight, Loader2 } from 'lucide-react';
import { GuestInfo, KioskMode } from './types';

export interface KioskConfirmStepProps {
  guestInfo: GuestInfo;
  mode: KioskMode;
  loading: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

export function KioskConfirmStep({
  guestInfo,
  mode,
  loading,
  onConfirm,
  onBack,
}: KioskConfirmStepProps) {
  return (
    <div className="text-center">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
        <CheckCircle className="w-10 h-10 text-green-400" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Confirm Your Details</h2>
      <p className="text-slate-400 mb-8">Please verify the information below</p>

      <div className="bg-slate-800/50 rounded-2xl p-6 mb-8 text-left">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-slate-500 text-sm">Guest Name</p>
            <p className="text-white font-medium">{guestInfo.name}</p>
          </div>
          <div>
            <p className="text-slate-500 text-sm">Room Number</p>
            <p className="text-white font-medium">{guestInfo.room}</p>
          </div>
          <div>
            <p className="text-slate-500 text-sm">Check-In</p>
            <p className="text-white font-medium">{guestInfo.checkInDate}</p>
          </div>
          <div>
            <p className="text-slate-500 text-sm">Check-Out</p>
            <p className="text-white font-medium">{guestInfo.checkOutDate}</p>
          </div>
          {mode === 'checkout' && guestInfo.balance !== undefined && (
            <div className="col-span-2 pt-4 border-t border-slate-700">
              <p className="text-slate-500 text-sm">Outstanding Balance</p>
              <p className={`text-2xl font-bold ${guestInfo.balance > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                ${guestInfo.balance.toFixed(2)}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 px-8 py-4 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 px-8 py-4 bg-green-600 text-white text-lg font-semibold rounded-xl hover:bg-green-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Confirm
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
