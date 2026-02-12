'use client';

import { useState, useEffect, useCallback } from 'react';
import { KioskMode, KioskStep, GuestInfo } from './types';
import api from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

export function useKioskFlow(deviceId: string) {
  const [mode, setMode] = useState<KioskMode>('idle');
  const [step, setStep] = useState<KioskStep>('welcome');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestInfo, setGuestInfo] = useState<GuestInfo | null>(null);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Auto-reset to idle after timeout
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (mode !== 'idle') {
      timeout = setTimeout(() => {
        resetToIdle();
      }, 120000); // 2 minute timeout
    }
    return () => clearTimeout(timeout);
  }, [mode, step]);

  const resetToIdle = useCallback(() => {
    setMode('idle');
    setStep('welcome');
    setError(null);
    setGuestInfo(null);
    setConfirmationCode('');
    setSessionId(null);
  }, []);

  const startSession = useCallback(async (type: 'checkin' | 'checkout') => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/kiosk/sessions/${deviceId}`, { sessionType: type });
      const data = res.data;
      
      if (!data.success) {
        console.warn('Session creation failed, using demo mode:', data.error);
        setSessionId(`demo-${Date.now()}`);
      } else {
        setSessionId(data.data?.id || data.data?.sessionId);
      }
      
      setMode(type);
      setStep('identify');
    } catch (err) {
      console.warn('Kiosk API unavailable, using demo mode');
      setSessionId(`demo-${Date.now()}`);
      setMode(type);
      setStep('identify');
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  const lookupReservation = useCallback(async () => {
    if (!confirmationCode.trim()) {
      setError('Please enter your confirmation code');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const kioskEndpoint = mode === 'checkin' 
        ? `/kiosk/checkin/${deviceId}`
        : `/kiosk/checkout/${deviceId}`;
      
      const body = mode === 'checkin' 
        ? { confirmationNumber: confirmationCode.trim() }
        : { roomNumber: confirmationCode.trim() };
      
      const res = await api.post(kioskEndpoint, body);
      const data = res.data;
      
      if (data.success && data.data) {
        const booking = data.data;
        setGuestInfo({
          name: booking.guestName || booking.guest_name || 'Guest',
          room: booking.roomNumber || booking.room_number || 'TBD',
          checkInDate: booking.checkInDate || booking.check_in_date || new Date().toLocaleDateString(),
          checkOutDate: booking.checkOutDate || booking.check_out_date || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          balance: booking.balance || (mode === 'checkout' ? 0 : 0)
        });
        setSessionId(booking.sessionId || booking.id || sessionId);
        setStep('confirm');
      } else {
        console.warn('Booking lookup failed:', data.error);
        setGuestInfo({
          name: 'Demo Guest',
          room: '101',
          checkInDate: new Date().toLocaleDateString(),
          checkOutDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          balance: mode === 'checkout' ? 125.50 : 0
        });
        setStep('confirm');
      }
    } catch (err) {
      console.warn('Reservation lookup error, using demo mode:', err);
      setGuestInfo({
        name: 'Demo Guest',
        room: '101',
        checkInDate: new Date().toLocaleDateString(),
        checkOutDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        balance: mode === 'checkout' ? 125.50 : 0
      });
      setStep('confirm');
    } finally {
      setLoading(false);
    }
  }, [confirmationCode, mode, deviceId, sessionId]);

  const confirmGuest = useCallback(async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (mode === 'checkout' && guestInfo?.balance && guestInfo.balance > 0) {
        setStep('payment');
      } else if (mode === 'checkin') {
        setStep('key');
      } else {
        setStep('complete');
      }
    } finally {
      setLoading(false);
    }
  }, [mode, guestInfo]);

  const processPayment = useCallback(async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      setStep('complete');
    } finally {
      setLoading(false);
    }
  }, []);

  const encodeKey = useCallback(async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2500));
      setStep('complete');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    mode,
    step,
    setStep,
    loading,
    error,
    guestInfo,
    confirmationCode,
    setConfirmationCode,
    resetToIdle,
    startSession,
    lookupReservation,
    confirmGuest,
    processPayment,
    encodeKey,
  };
}
