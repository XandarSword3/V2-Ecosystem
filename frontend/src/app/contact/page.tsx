'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import { useSiteSettings } from '@/lib/settings-context';
import {
  MessageCircle,
  Send,
  Phone,
  Mail,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface ContactForm {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

const initialForm: ContactForm = {
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
};

export default function ContactPage() {
  const t = useTranslations('contact');
  const { settings } = useSiteSettings();
  const [form, setForm] = useState<ContactForm>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await api.post('/support/contact', form);
      setSubmitted(true);
      setForm(initialForm);
      toast.success(t('successToast'));
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError.response?.data?.error || t('errorToast'));
      toast.error(t('errorToast'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactInfo = [
    {
      icon: Phone,
      label: t('phone'),
      value: settings.phone || '+961 XX XXX XXX',
      href: `tel:${settings.phone || '+961000000000'}`,
    },
    {
      icon: Mail,
      label: t('email'),
      value: settings.email || 'info@v2resort.com',
      href: `mailto:${settings.email || 'info@v2resort.com'}`,
    },
    {
      icon: MapPin,
      label: t('address'),
      value: settings.address || 'V2 Resort, Lebanon',
      href: '#',
    },
    {
      icon: Clock,
      label: t('receptionHours'),
      value: settings.receptionHours || '24/7',
      href: '#',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="space-y-12"
        >
          {/* Header */}
          <motion.div variants={fadeInUp} className="text-center">
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
              {t('title')}
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              {t('subtitle')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Contact Form */}
            <motion.div variants={fadeInUp} className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-primary-600" />
                    {t('sendMessage')}
                  </CardTitle>
                  <CardDescription>
                    {t('formDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {submitted ? (
                    <div className="text-center py-8">
                      <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                        {t('messageSent')}
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400 mb-4">
                        {t('thankYou')}
                      </p>
                      <Button onClick={() => setSubmitted(false)}>
                        {t('sendAnother')}
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                      {error && (
                        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
                          <AlertCircle className="w-5 h-5" />
                          {error}
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            {t('yourName')} *
                          </label>
                          <Input
                            required
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="John Doe"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            {t('emailAddress')} *
                          </label>
                          <Input
                            required
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            placeholder="john@example.com"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            {t('phoneNumber')}
                          </label>
                          <Input
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            placeholder="+961 XX XXX XXX"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            {t('subject')} *
                          </label>
                          <Input
                            required
                            value={form.subject}
                            onChange={(e) => setForm({ ...form, subject: e.target.value })}
                            placeholder={t('subjectPlaceholder')}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          {t('message')} *
                        </label>
                        <textarea
                          required
                          rows={5}
                          value={form.message}
                          onChange={(e) => setForm({ ...form, message: e.target.value })}
                          placeholder={t('messagePlaceholder')}
                          className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                        />
                      </div>

                      <Button type="submit" isLoading={isSubmitting} className="w-full">
                        <Send className="w-4 h-4 mr-2" />
                        {t('sendMessageButton')}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Contact Info */}
            <motion.div variants={fadeInUp} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('contactInfo')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {contactInfo.map((info) => {
                      const Icon = info.icon;
                      return (
                        <a
                          key={info.label}
                          href={info.href}
                          className="flex items-start gap-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
                            <Icon className="w-5 h-5 text-primary-600" />
                          </div>
                          <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{info.label}</p>
                            <p className="font-medium text-slate-900 dark:text-white">{info.value}</p>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Business Hours */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('businessHours')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">{t('restaurant')}</span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {settings.restaurantHours || '8:00 AM - 11:00 PM'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">{t('pool')}</span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {settings.poolHours || '9:00 AM - 7:00 PM'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">{t('reception')}</span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {settings.receptionHours || '24/7'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
