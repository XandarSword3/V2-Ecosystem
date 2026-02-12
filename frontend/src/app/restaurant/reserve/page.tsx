'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Calendar, 
  Clock, 
  Users, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Loader2,
  Phone,
  Mail,
  User
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

interface TimeSlot {
  time: string;
  available: boolean;
}

interface ReservationForm {
  date: string;
  time: string;
  partySize: number;
  name: string;
  email: string;
  phone: string;
  specialRequests: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

// Generate time slots from 11:00 to 22:00
const generateTimeSlots = (): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  for (let hour = 11; hour <= 21; hour++) {
    for (let min of [0, 30]) {
      const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      slots.push({ time, available: Math.random() > 0.3 }); // Demo: random availability
    }
  }
  return slots;
};

export default function RestaurantReservePage() {
  const [step, setStep] = useState<'select' | 'details' | 'confirm' | 'success'>('select');
  const [form, setForm] = useState<ReservationForm>({
    date: new Date().toISOString().split('T')[0],
    time: '',
    partySize: 2,
    name: '',
    email: '',
    phone: '',
    specialRequests: ''
  });
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(generateTimeSlots());

  // Fetch available tables for selected date/time
  const { data: availableTables, isLoading: loadingTables, refetch } = useQuery({
    queryKey: ['available-tables', form.date, form.partySize],
    queryFn: async () => {
      try {
        const res = await api.get(`/restaurant/tables/available?date=${form.date}&partySize=${form.partySize}`);
        return res.data?.data || [];
      } catch {
        return [];
      }
    },
    enabled: !!form.date
  });

  // Submit reservation
  const submitMutation = useMutation({
    mutationFn: async (data: ReservationForm) => {
      const res = await api.post('/restaurant/reservations', {
        date: data.date,
        time: data.time,
        party_size: data.partySize,
        guest_name: data.name,
        guest_email: data.email,
        guest_phone: data.phone,
        special_requests: data.specialRequests
      });
      return res.data;
    },
    onSuccess: () => {
      setStep('success');
    },
    onError: () => {
      toast.error('Failed to create reservation. Please try again.');
    }
  });

  const handleDateChange = (days: number) => {
    const currentDate = new Date(form.date);
    currentDate.setDate(currentDate.getDate() + days);
    const newDate = currentDate.toISOString().split('T')[0];
    setForm({ ...form, date: newDate, time: '' });
    setTimeSlots(generateTimeSlots()); // Regenerate slots for new date
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const canProceedToDetails = form.date && form.time && form.partySize > 0;
  const canSubmit = form.name && form.email && form.phone;

  // Select Date/Time Step
  if (step === 'select') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <div className="max-w-4xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Reserve a Table
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              Book your dining experience at Iron Paradise Gym Restaurant
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Party Size */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 mb-6 border border-slate-200 dark:border-slate-700">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
              <Users className="w-4 h-4" />
              Party Size
            </label>
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((size) => (
                <button
                  key={size}
                  onClick={() => setForm({ ...form, partySize: size })}
                  className={`px-5 py-3 rounded-lg font-medium transition-colors ${
                    form.partySize === size
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {size} {size === 1 ? 'Guest' : 'Guests'}
                </button>
              ))}
              <button
                onClick={() => setForm({ ...form, partySize: 10 })}
                className={`px-5 py-3 rounded-lg font-medium transition-colors ${
                  form.partySize > 8
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                9+ (Large Party)
              </button>
            </div>
          </div>

          {/* Date Selection */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 mb-6 border border-slate-200 dark:border-slate-700">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
              <Calendar className="w-4 h-4" />
              Select Date
            </label>
            <div className="flex items-center justify-between">
              <button
                onClick={() => handleDateChange(-1)}
                disabled={form.date <= new Date().toISOString().split('T')[0]}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-center">
                <p className="text-xl font-semibold text-slate-900 dark:text-white">
                  {formatDate(form.date)}
                </p>
                <input
                  type="date"
                  value={form.date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setForm({ ...form, date: e.target.value, time: '' })}
                  className="mt-2 px-3 py-1 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                />
              </div>
              <button
                onClick={() => handleDateChange(1)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Time Selection */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 mb-6 border border-slate-200 dark:border-slate-700">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
              <Clock className="w-4 h-4" />
              Select Time
            </label>
            
            {loadingTables ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                {timeSlots.map((slot) => (
                  <button
                    key={slot.time}
                    onClick={() => slot.available && setForm({ ...form, time: slot.time })}
                    disabled={!slot.available}
                    className={`py-3 px-2 rounded-lg text-sm font-medium transition-colors ${
                      form.time === slot.time
                        ? 'bg-primary text-white'
                        : slot.available
                          ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed line-through'
                    }`}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Continue Button */}
          <button
            onClick={() => setStep('details')}
            disabled={!canProceedToDetails}
            className="w-full py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // Guest Details Step
  if (step === 'details') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <div className="max-w-4xl mx-auto px-4 py-8">
            <button
              onClick={() => setStep('select')}
              className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-4"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Your Details
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              {formatDate(form.date)} at {form.time} for {form.partySize} {form.partySize === 1 ? 'guest' : 'guests'}
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 space-y-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <User className="w-4 h-4" />
                Full Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="John Smith"
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <Mail className="w-4 h-4" />
                Email Address *
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="john@example.com"
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <Phone className="w-4 h-4" />
                Phone Number *
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                Special Requests (optional)
              </label>
              <textarea
                value={form.specialRequests}
                onChange={(e) => setForm({ ...form, specialRequests: e.target.value })}
                placeholder="Allergies, dietary requirements, special occasions..."
                rows={3}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white resize-none"
              />
            </div>
          </div>

          <div className="mt-6 flex gap-4">
            <button
              onClick={() => setStep('select')}
              className="flex-1 py-4 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep('confirm')}
              disabled={!canSubmit}
              className="flex-1 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Review Reservation
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Confirmation Step
  if (step === 'confirm') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <div className="max-w-4xl mx-auto px-4 py-8">
            <button
              onClick={() => setStep('details')}
              className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-4"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Confirm Reservation
            </h1>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Date</p>
                <p className="text-lg font-medium text-slate-900 dark:text-white">{formatDate(form.date)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Time</p>
                <p className="text-lg font-medium text-slate-900 dark:text-white">{form.time}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Party Size</p>
                <p className="text-lg font-medium text-slate-900 dark:text-white">{form.partySize} guests</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Name</p>
                <p className="text-lg font-medium text-slate-900 dark:text-white">{form.name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Email</p>
                <p className="text-lg font-medium text-slate-900 dark:text-white">{form.email}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Phone</p>
                <p className="text-lg font-medium text-slate-900 dark:text-white">{form.phone}</p>
              </div>
              {form.specialRequests && (
                <div className="col-span-2">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Special Requests</p>
                  <p className="text-slate-900 dark:text-white">{form.specialRequests}</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">Cancellation Policy</p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Please cancel at least 2 hours before your reservation time to avoid a no-show fee.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-4">
            <button
              onClick={() => setStep('details')}
              className="flex-1 py-4 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => submitMutation.mutate(form)}
              disabled={submitMutation.isPending}
              className="flex-1 py-4 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Booking...
                </>
              ) : (
                'Confirm Reservation'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success Step
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-700">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Reservation Confirmed!
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          We've sent a confirmation email to {form.email}
        </p>

        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 mb-6 text-left">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-500 dark:text-slate-400">Date</p>
              <p className="font-medium text-slate-900 dark:text-white">{formatDate(form.date)}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Time</p>
              <p className="font-medium text-slate-900 dark:text-white">{form.time}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Party</p>
              <p className="font-medium text-slate-900 dark:text-white">{form.partySize} guests</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Name</p>
              <p className="font-medium text-slate-900 dark:text-white">{form.name}</p>
            </div>
          </div>
        </div>

        <a
          href="/restaurant"
          className="block w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors"
        >
          Back to Restaurant
        </a>
      </div>
    </div>
  );
}
