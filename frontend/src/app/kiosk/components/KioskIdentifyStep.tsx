'use client';

import { User, ArrowRight, Loader2 } from 'lucide-react';

export interface KioskIdentifyStepProps {
  confirmationCode: string;
  onConfirmationCodeChange: (value: string) => void;
  error: string | null;
  loading: boolean;
  onLookup: () => void;
}

export function KioskIdentifyStep({
  confirmationCode,
  onConfirmationCodeChange,
  error,
  loading,
  onLookup,
}: KioskIdentifyStepProps) {
  return (
    <div className="text-center">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-500/20 flex items-center justify-center">
        <User className="w-10 h-10 text-blue-400" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Enter Your Details</h2>
      <p className="text-slate-400 mb-8">
        Please enter your confirmation number or scan your ID
      </p>

      <div className="space-y-4">
        <input
          type="text"
          value={confirmationCode}
          onChange={(e) => onConfirmationCodeChange(e.target.value.toUpperCase())}
          placeholder="Confirmation Code (e.g., ABC123)"
          className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-xl text-white text-center text-xl tracking-wider placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          autoFocus
        />

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        <button
          onClick={onLookup}
          disabled={loading || !confirmationCode.trim()}
          className="w-full px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Looking up...
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-slate-900 px-4 text-slate-500 text-sm">or</span>
          </div>
        </div>

        <button className="w-full px-8 py-4 bg-slate-800 border border-slate-700 text-slate-300 text-lg rounded-xl hover:bg-slate-700 transition-colors">
          Scan ID / Passport
        </button>
      </div>
    </div>
  );
}
