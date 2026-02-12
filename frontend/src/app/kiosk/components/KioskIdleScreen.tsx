'use client';

import { LogIn, LogOut, ArrowRight } from 'lucide-react';
import { KioskMode } from './types';

export interface KioskIdleScreenProps {
  deviceId: string;
  loading: boolean;
  onStartSession: (type: 'checkin' | 'checkout') => void;
}

export function KioskIdleScreen({ deviceId, loading, onStartSession }: KioskIdleScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-teal-700 flex flex-col">
      {/* Header */}
      <header className="p-6 text-center">
        <h1 className="text-4xl font-bold text-white">Welcome to Iron Paradise Gym</h1>
        <p className="text-xl text-blue-200 mt-2">Self-Service Kiosk</p>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
          {/* Check-In Card */}
          <button
            onClick={() => onStartSession('checkin')}
            disabled={loading}
            className="group bg-white/10 backdrop-blur-sm hover:bg-white/20 border border-white/20 rounded-3xl p-12 text-center transition-all duration-300 hover:scale-105 hover:shadow-2xl"
          >
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
              <LogIn className="w-12 h-12 text-green-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Check In</h2>
            <p className="text-blue-200">Arriving guests</p>
            <div className="mt-6 flex items-center justify-center text-green-400 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="mr-2">Start</span>
              <ArrowRight className="w-5 h-5" />
            </div>
          </button>

          {/* Check-Out Card */}
          <button
            onClick={() => onStartSession('checkout')}
            disabled={loading}
            className="group bg-white/10 backdrop-blur-sm hover:bg-white/20 border border-white/20 rounded-3xl p-12 text-center transition-all duration-300 hover:scale-105 hover:shadow-2xl"
          >
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-orange-500/20 flex items-center justify-center group-hover:bg-orange-500/30 transition-colors">
              <LogOut className="w-12 h-12 text-orange-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Check Out</h2>
            <p className="text-blue-200">Departing guests</p>
            <div className="mt-6 flex items-center justify-center text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="mr-2">Start</span>
              <ArrowRight className="w-5 h-5" />
            </div>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center">
        <p className="text-blue-300 text-sm">
          Need assistance? Please visit our front desk or call extension 0
        </p>
        <p className="text-blue-400/50 text-xs mt-2">
          Device: {deviceId}
        </p>
      </footer>
    </div>
  );
}
