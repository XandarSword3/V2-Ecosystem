'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Calendar, Clock, Users, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, Loader2, Phone, Mail, User } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useSiteSettings } from '@/lib/settings-context';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';

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

// Generate time slots from 11:00 to 22:00
const generateTimeSlots = (): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  for (let hour = 11; hour <= 21; hour++) {
    for (const min of [0, 30]) {
      const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      slots.push({ time, available: Math.random() > 0.3 });
    }
  }
  return slots;
};

export default function ModuleReservePage() {
  const params = useParams();
  const router = useRouter();
  const rawSlug = params?.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug || '';
  const { modules, loading } = useSiteSettings();
  const currentModule = modules.find((m) => m.slug.toLowerCase() === decodeURIComponent(slug).toLowerCase());

  const [step, setStep] = useState<'select' | 'details' | 'confirm' | 'success'>('select');
  const [form, setForm] = useState<ReservationForm>({
    date: new Date().toISOString().split('T')[0],
    time: '',
    partySize: 2,
    name: '',
    email: '',
    phone: '',
    specialRequests: '',
  });
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(generateTimeSlots());

  // Fetch available tables for selected date/party size
  const { data: availableTables, isLoading: loadingTables } = useQuery({
    queryKey: ['available-tables', form.date, form.partySize, currentModule?.id],
    queryFn: async () => {
      try {
        const res = await api.get(`/restaurant/tables/available?date=${form.date}&partySize=${form.partySize}`);
        return res.data?.data || [];
      } catch {
        return [];
      }
    },
    enabled: !!form.date && !!currentModule,
  });

  const submitMutation = useMutation({
    mutationFn: async (data: ReservationForm) => {
      const res = await api.post('/restaurant/reservations', {
        date: data.date,
        time: data.time,
        party_size: data.partySize,
        guest_name: data.name,
        guest_email: data.email,
        guest_phone: data.phone,
        special_requests: data.specialRequests,
        module_id: currentModule?.id,
      });
      return res.data;
    },
    onSuccess: () => setStep('success'),
    onError: () => toast.error('Failed to create reservation. Please try again.'),
  });

  const handleDateChange = (days: number) => {
    const currentDate = new Date(form.date);
    currentDate.setDate(currentDate.getDate() + days);
    setForm({ ...form, date: currentDate.toISOString().split('T')[0], time: '' });
    setTimeSlots(generateTimeSlots());
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentModule) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Module Not Found</h2>
          <Link href="/" className="text-primary hover:underline">Return Home</Link>
        </div>
      </div>
    );
  }

  const moduleName = currentModule.name;
  const canProceedToDetails = form.date && form.time && form.partySize > 0;
  const canSubmit = form.name && form.email && form.phone;

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center py-10">
        <Container size="sm" className="w-full">
          <div className="w-full rounded-2xl p-8 text-center border border-border bg-card text-card-foreground shadow-elevated">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Reservation Confirmed!</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">We&apos;ve sent a confirmation email to {form.email}</p>
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 mb-6 text-left">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><p className="text-slate-500">Date</p><p className="font-medium text-slate-900 dark:text-white">{formatDate(form.date)}</p></div>
              <div><p className="text-slate-500">Time</p><p className="font-medium text-slate-900 dark:text-white">{form.time}</p></div>
              <div><p className="text-slate-500">Party</p><p className="font-medium text-slate-900 dark:text-white">{form.partySize} guests</p></div>
              <div><p className="text-slate-500">Name</p><p className="font-medium text-slate-900 dark:text-white">{form.name}</p></div>
            </div>
          </div>
          <Link href={`/${slug}`} className="block w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors text-center">
            Back to {moduleName}
          </Link>
          </div>
        </Container>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div className="min-h-screen bg-background">
        <Section tone="surface" className="py-8 border-b border-border">
          <Container size="md">
            <Button variant="ghost" className="-ml-2 mb-4" onClick={() => setStep('details')}>
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
            <h1 className="text-3xl font-bold">Confirm Reservation</h1>
          </Container>
        </Section>

        <Container size="md" className="py-8">
          <div className="rounded-xl p-6 border border-border bg-card text-card-foreground">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div><p className="text-sm text-slate-500">Date</p><p className="text-lg font-medium text-slate-900 dark:text-white">{formatDate(form.date)}</p></div>
              <div><p className="text-sm text-slate-500">Time</p><p className="text-lg font-medium text-slate-900 dark:text-white">{form.time}</p></div>
              <div><p className="text-sm text-slate-500">Party Size</p><p className="text-lg font-medium text-slate-900 dark:text-white">{form.partySize} guests</p></div>
              <div><p className="text-sm text-slate-500">Name</p><p className="text-lg font-medium text-slate-900 dark:text-white">{form.name}</p></div>
              <div><p className="text-sm text-slate-500">Email</p><p className="text-lg font-medium text-slate-900 dark:text-white">{form.email}</p></div>
              <div><p className="text-sm text-slate-500">Phone</p><p className="text-lg font-medium text-slate-900 dark:text-white">{form.phone}</p></div>
              {form.specialRequests && (
                <div className="col-span-2"><p className="text-sm text-slate-500">Special Requests</p><p className="text-slate-900 dark:text-white">{form.specialRequests}</p></div>
              )}
            </div>
          </div>
          <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">Cancellation Policy</p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">Please cancel at least 2 hours before your reservation time.</p>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Button variant="outline" className="flex-1 py-6" onClick={() => setStep('details')}>
              Back
            </Button>
            <Button
              variant="success"
              className="flex-1 py-6"
              onClick={() => submitMutation.mutate(form)}
              disabled={submitMutation.isPending}
              isLoading={submitMutation.isPending}
            >
              Confirm Reservation
            </Button>
          </div>
        </Container>
      </div>
    );
  }

  if (step === 'details') {
    return (
      <div className="min-h-screen bg-background">
        <Section tone="surface" className="py-8 border-b border-border">
          <Container size="md">
            <Button variant="ghost" className="-ml-2 mb-4" onClick={() => setStep('select')}>
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
            <h1 className="text-3xl font-bold">Your Details</h1>
            <p className="text-muted-foreground mt-2">
              {formatDate(form.date)} at {form.time} for {form.partySize}{' '}
              {form.partySize === 1 ? 'guest' : 'guests'}
            </p>
          </Container>
        </Section>

        <Container size="md" className="py-8">
          <div className="rounded-xl p-6 border border-border bg-card text-card-foreground space-y-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <User className="w-4 h-4" /> Full Name *
              </label>
              <Input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="John Smith"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Mail className="w-4 h-4" /> Email Address *
              </label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Phone className="w-4 h-4" /> Phone Number *
              </label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Special Requests</label>
              <Textarea
                value={form.specialRequests}
                onChange={(e) => setForm({ ...form, specialRequests: e.target.value })}
                placeholder="Allergies, dietary requirements..."
                rows={3}
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Button variant="outline" className="flex-1 py-6" onClick={() => setStep('select')}>
              Back
            </Button>
            <Button
              variant="primary"
              className="flex-1 py-6"
              onClick={() => setStep('confirm')}
              disabled={!canSubmit}
            >
              Review Reservation
            </Button>
          </div>
        </Container>
      </div>
    );
  }

  // Select Date/Time Step (default)
  return (
    <div className="min-h-screen bg-background">
      <Section tone="surface" className="py-8 border-b border-border">
        <Container size="md">
          <h1 className="text-3xl font-bold">Reserve a Table</h1>
          <p className="text-muted-foreground mt-2">Book your dining experience at {moduleName}</p>
        </Container>
      </Section>

      <Container size="md" className="py-8">
        {/* Party Size */}
        <div className="rounded-xl p-6 mb-6 border border-border bg-card text-card-foreground">
          <label className="flex items-center gap-2 text-sm font-medium mb-4">
            <Users className="w-4 h-4" /> Party Size
          </label>
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((size) => (
              <Button
                key={size}
                variant={form.partySize === size ? 'primary' : 'secondary'}
                onClick={() => setForm({ ...form, partySize: size })}
              >
                {size} {size === 1 ? 'Guest' : 'Guests'}
              </Button>
            ))}
          </div>
        </div>

        {/* Date Selection */}
        <div className="rounded-xl p-6 mb-6 border border-border bg-card text-card-foreground">
          <label className="flex items-center gap-2 text-sm font-medium mb-4">
            <Calendar className="w-4 h-4" /> Select Date
          </label>
          <div className="flex items-center justify-between">
            <button onClick={() => handleDateChange(-1)} disabled={form.date <= new Date().toISOString().split('T')[0]} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <p className="text-xl font-semibold text-slate-900 dark:text-white">{formatDate(form.date)}</p>
              <input type="date" value={form.date} min={new Date().toISOString().split('T')[0]} onChange={(e) => setForm({ ...form, date: e.target.value, time: '' })} className="mt-2 px-3 py-1 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm" />
            </div>
            <button onClick={() => handleDateChange(1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Time Selection */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 mb-6 border border-slate-200 dark:border-slate-700">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-4"><Clock className="w-4 h-4" /> Select Time</label>
          <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
            {timeSlots.map((slot) => (
              <button key={slot.time} onClick={() => slot.available && setForm({ ...form, time: slot.time })} disabled={!slot.available} className={`py-3 px-2 rounded-lg text-sm font-medium transition-colors ${form.time === slot.time ? 'bg-primary text-white' : slot.available ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 cursor-not-allowed line-through'}`}>
                {slot.time}
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => setStep('details')} disabled={!canProceedToDetails} className="w-full py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          Continue
        </button>
      </Container>
    </div>
  );
}
