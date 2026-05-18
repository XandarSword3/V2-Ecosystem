'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LogIn, LogOut, Home, Loader2 } from 'lucide-react';
import { useKioskFlow } from './components/useKioskFlow';
import { KioskIdleScreen } from './components/KioskIdleScreen';
import { KioskIdentifyStep } from './components/KioskIdentifyStep';
import { KioskConfirmStep } from './components/KioskConfirmStep';
import { KioskProcessingSteps } from './components/KioskProcessingSteps';

function KioskContent() {
  const searchParams = useSearchParams();
  const deviceId = searchParams.get('device') || 'demo';
  
  const {
    mode, step, setStep, loading, error, guestInfo,
    confirmationCode, setConfirmationCode,
    resetToIdle, startSession, lookupReservation,
    confirmGuest, processPayment, encodeKey,
  } = useKioskFlow(deviceId);

  // Idle Screen
  if (mode === 'idle') {
    return (
      <KioskIdleScreen
        deviceId={deviceId}
        loading={loading}
        onStartSession={startSession}
      />
    );
  }

  // Process Screens
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${mode === 'checkin' ? 'bg-green-500/20' : 'bg-orange-500/20'}`}>
              {mode === 'checkin' ? (
                <LogIn className={`w-6 h-6 ${mode === 'checkin' ? 'text-green-400' : 'text-orange-400'}`} />
              ) : (
                <LogOut className="w-6 h-6 text-orange-400" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {mode === 'checkin' ? 'Check In' : 'Check Out'}
              </h1>
              <p className="text-slate-400 text-sm">Resort Self-Service</p>
            </div>
          </div>
          <button
            onClick={resetToIdle}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <Home className="w-5 h-5" />
            <span>Cancel</span>
          </button>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="px-6 py-4 border-b border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            {['identify', 'confirm', mode === 'checkout' ? 'payment' : 'key', 'complete'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step === s ? 'bg-blue-500 text-white' :
                  ['confirm', 'payment', 'key', 'complete'].indexOf(step) > ['identify', 'confirm', 'payment', 'key'].indexOf(s)
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-700 text-slate-400'
                }`}>
                  {i + 1}
                </div>
                {i < 3 && (
                  <div className={`w-16 md:w-32 h-1 mx-2 rounded ${
                    ['confirm', 'payment', 'key', 'complete'].indexOf(step) > i
                      ? 'bg-green-500'
                      : 'bg-slate-700'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-xl w-full">
          {step === 'identify' && (
            <KioskIdentifyStep
              confirmationCode={confirmationCode}
              onConfirmationCodeChange={(val) => setConfirmationCode(val.toUpperCase())}
              error={error}
              loading={loading}
              onLookup={lookupReservation}
            />
          )}

          {step === 'confirm' && guestInfo && (
            <KioskConfirmStep
              guestInfo={guestInfo}
              mode={mode as 'checkin' | 'checkout'}
              loading={loading}
              onConfirm={confirmGuest}
              onBack={() => setStep('identify')}
            />
          )}

          {(step === 'error' || step === 'payment' || step === 'key' || step === 'complete') && (
            <KioskProcessingSteps
              step={step as 'error' | 'payment' | 'key' | 'complete'}
              mode={mode as 'checkin' | 'checkout'}
              guestInfo={guestInfo}
              loading={loading}
              error={error}
              onProcessPayment={processPayment}
              onEncodeKey={encodeKey}
              onReset={resetToIdle}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 border-t border-white/5 text-center">
        <p className="text-slate-500 text-sm">
          Need help? Press the call button or visit the front desk
        </p>
      </footer>
    </div>
  );
}

export default function KioskPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
      </div>
    }>
      <KioskContent />
    </Suspense>
  );
}
