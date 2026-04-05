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
        setError(data.error || 'Failed to start session. Please try again.');
        return;
      }
      setSessionId(data.data?.id || data.data?.sessionId);
      setMode(type);
      setStep('identify');
    } catch (err) {
      console.error('Kiosk session creation failed:', err);
      setError('Kiosk service unavailable. Please contact reception.');
      return;
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
        setError(data.error || 'Reservation not found. Please check your details and try again.');
        return;
      }
    } catch (err) {
      console.error('Reservation lookup failed:', err);
      setError('Unable to look up reservation. Please contact reception.');
      return;
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
    if (!sessionId || !deviceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/kiosk/transactions/${sessionId}/${deviceId}/payment`, {
        amount: guestInfo?.balance || 0,
        method: 'card'
      });
      if (!res.data.success) {
        setError(res.data.error || 'Payment failed. Please try again or contact reception.');
        return;
      }
      setStep('complete');
    } catch (err) {
      console.error('Payment processing failed:', err);
      setError('Payment processing failed. Please contact reception.');
    } finally {
      setLoading(false);
    }
  }, [sessionId, deviceId, guestInfo]);

  const encodeKey = useCallback(async () => {
    if (!sessionId || !deviceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/kiosk/transactions/${sessionId}/${deviceId}/key-encode`, {
        roomNumber: guestInfo?.room
      });
      if (!res.data.success) {
        setError(res.data.error || 'Key encoding failed. Please contact reception.');
        return;
      }
      setStep('complete');
    } catch (err) {
      console.error('Key encoding failed:', err);
      setError('Key encoding failed. Please contact reception.');
    } finally {
      setLoading(false);
    }
  }, [sessionId, deviceId, guestInfo]);

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
