'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { 
  UtensilsCrossed, 
  Home, 
  Waves, 
  Cookie,
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  Star,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { fadeInUp, staggerContainer, scaleIn } from '@/lib/animations/presets';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import dynamic from 'next/dynamic';

// Dynamically import heavy components for better performance
const InteractiveResortMap = dynamic(() => import('@/components/InteractiveResortMap'), { ssr: false });
const LiveChatWidget = dynamic(() => import('@/components/LiveChatWidget'), { ssr: false });
const TestimonialsCarousel = dynamic(() => import('@/components/TestimonialsCarousel'), { ssr: false });

export default function HomePage() {
  const t = useTranslations();
  const tHome = useTranslations('home');
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');
  const tFooter = useTranslations('footer');

  const services = [
    {
      icon: UtensilsCrossed,
      title: tHome('services.restaurant.title'),
      description: tHome('services.restaurant.description'),
      href: '/restaurant',
      gradient: 'from-orange-400 to-rose-500',
      bgLight: 'bg-orange-50 dark:bg-orange-950/30',
      delay: 0,
    },
    {
      icon: Cookie,
      title: tHome('services.snackBar.title'),
      description: tHome('services.snackBar.description'),
      href: '/snack-bar',
      gradient: 'from-amber-400 to-orange-500',
      bgLight: 'bg-amber-50 dark:bg-amber-950/30',
      delay: 0.1,
    },
    {
      icon: Home,
      title: tHome('services.chalets.title'),
      description: tHome('services.chalets.description'),
      href: '/chalets',
      gradient: 'from-emerald-400 to-teal-500',
      bgLight: 'bg-emerald-50 dark:bg-emerald-950/30',
      delay: 0.2,
    },
    {
      icon: Waves,
      title: tHome('services.pool.title'),
      description: tHome('services.pool.description'),
      href: '/pool',
      gradient: 'from-cyan-400 to-blue-500',
      bgLight: 'bg-cyan-50 dark:bg-cyan-950/30',
      delay: 0.3,
    },
  ];

  const features = [
    { title: tHome('features.primeLocation.title'), description: tHome('features.primeLocation.description') },
    { title: tHome('features.authenticCuisine.title'), description: tHome('features.authenticCuisine.description') },
    { title: tHome('features.modernAmenities.title'), description: tHome('features.modernAmenities.description') },
    { title: tHome('features.familyFriendly.title'), description: tHome('features.familyFriendly.description') },
  ];

  const stats = [
    { name: tHome('stats.restaurant'), stat: tHome('stats.menuItems', { count: 50 }), emoji: '🍽️' },
    { name: tHome('stats.chalets'), stat: tHome('stats.chaletUnits', { count: 4 }), emoji: '🏠' },
    { name: tHome('stats.pool'), stat: tHome('stats.poolSessions', { count: 3 }), emoji: '🏊' },
    { name: tHome('stats.snackBar'), stat: tHome('stats.fastService'), emoji: '🍿' },
  ];

  return (
    <div className="min-h-screen overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 dark:from-primary-800 dark:via-primary-900 dark:to-slate-900 text-white overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Floating circles - using deterministic values to prevent hydration mismatch */}
          {[
            { width: 180, height: 180, left: 10, top: 20 },
            { width: 280, height: 280, left: 80, top: 60 },
            { width: 220, height: 220, left: 30, top: 70 },
            { width: 150, height: 150, left: 60, top: 15 },
            { width: 320, height: 320, left: 45, top: 45 },
            { width: 200, height: 200, left: 75, top: 85 },
          ].map((circle, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-white/10 dark:bg-white/5"
              style={{
                width: circle.width,
                height: circle.height,
                left: `${circle.left}%`,
                top: `${circle.top}%`,
              }}
              animate={{
                y: [0, -30, 0],
                x: [0, 15, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 5 + i * 0.8,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.5,
              }}
            />
          ))}
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 dark:bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium mb-8"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              {tHome('hero.badge')}
              <Sparkles className="w-4 h-4 text-amber-300" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-5xl md:text-7xl font-bold mb-6 tracking-tight"
            >
              {tCommon('welcome').replace('V2 Resort', '')}{' '}
              <span className="relative">
                <span className="relative z-10 bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent">
                  {tHome('hero.titleHighlight')}
                </span>
                <motion.span
                  className="absolute -inset-1 bg-gradient-to-r from-amber-400/30 to-yellow-300/30 blur-lg"
                  animate={{ opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="text-xl md:text-2xl text-primary-100 dark:text-primary-200 mb-10 max-w-3xl mx-auto leading-relaxed"
            >
              {tHome('hero.subtitle')}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link href="/restaurant">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button size="lg" className="bg-white text-primary-700 hover:bg-primary-50 dark:bg-white dark:text-primary-800 dark:hover:bg-gray-100 px-8 py-4 text-lg shadow-xl shadow-black/20">
                    {tHome('cta.viewMenu')}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </motion.div>
              </Link>
              <Link href="/chalets">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button variant="outline" size="lg" className="border-2 border-white text-white hover:bg-white/10 dark:border-white/80 dark:text-white dark:hover:bg-white/5 px-8 py-4 text-lg">
                    {tHome('cta.bookChalet')}
                    <Home className="w-5 h-5 ml-2" />
                  </Button>
                </motion.div>
              </Link>
            </motion.div>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-6 h-10 border-2 border-white/50 dark:border-white/30 rounded-full flex justify-center pt-2"
            >
              <motion.div className="w-1.5 h-3 bg-white dark:bg-white/80 rounded-full" />
            </motion.div>
          </motion.div>
        </div>

        {/* Wave bottom border */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" className="fill-resort-sand dark:fill-slate-900"/>
          </svg>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-24 bg-resort-sand dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={staggerContainer}
            className="text-center mb-16"
          >
            <motion.span
              variants={fadeInUp}
              className="inline-block px-4 py-1 bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium mb-4"
            >
              {tHome('services.whatWeOffer')}
            </motion.span>
            <motion.h2 variants={fadeInUp} className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
              {tHome('services.title')}
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              {tHome('services.subtitle')}
            </motion.p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service, index) => (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: service.delay, duration: 0.5 }}
              >
                <Link href={service.href}>
                  <motion.div
                    whileHover={{ y: -8, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`group relative overflow-hidden rounded-2xl ${service.bgLight} p-8 h-full border border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 hover:shadow-2xl dark:hover:shadow-slate-900/50 transition-all duration-300`}
                  >
                    {/* Gradient icon container */}
                    <motion.div
                      whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                      transition={{ duration: 0.5 }}
                      className={`w-16 h-16 bg-gradient-to-br ${service.gradient} rounded-2xl flex items-center justify-center mb-6 shadow-lg`}
                    >
                      <service.icon className="w-8 h-8 text-white" />
                    </motion.div>

                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {service.title}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-4">
                      {service.description}
                    </p>
                    
                    <div className="flex items-center text-primary-600 dark:text-primary-400 font-medium">
                      <span>{tCommon('learnMore')}</span>
                      <motion.div
                        className="ml-2"
                        initial={{ x: 0 }}
                        whileHover={{ x: 5 }}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </motion.div>
                    </div>

                    {/* Hover gradient overlay */}
                    <motion.div
                      className={`absolute inset-0 bg-gradient-to-br ${service.gradient} opacity-0 group-hover:opacity-5 dark:group-hover:opacity-10 transition-opacity duration-300`}
                    />
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white dark:bg-slate-800 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary-50 dark:from-primary-900/20 to-transparent" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <span className="inline-block px-4 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium mb-4">
                {tHome('features.subtitle')}
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-8">
                {tHome('features.title').replace('V2 Resort', '')}{' '}
                <span className="text-primary-600 dark:text-primary-400">{tHome('hero.titleHighlight')}?</span>
              </h2>

              <div className="space-y-6">
                {features.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-4"
                  >
                    <motion.div
                      whileHover={{ scale: 1.2, rotate: 360 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                      className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                    >
                      <Star className="w-4 h-4 text-white" fill="white" />
                    </motion.div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-lg">{feature.title}</h4>
                      <p className="text-slate-600 dark:text-slate-400">{feature.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              {/* Stats card */}
              <motion.div
                whileHover={{ y: -5 }}
                className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-700 rounded-3xl p-8 text-white shadow-2xl"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.3 }}
                  className="text-center mb-8"
                >
                  <div className="text-6xl font-bold bg-gradient-to-r from-amber-400 to-yellow-200 bg-clip-text text-transparent">4</div>
                  <div className="text-slate-400 dark:text-slate-300 text-lg">{tHome('stats.businessUnits')}</div>
                </motion.div>

                <div className="grid grid-cols-2 gap-4">
                  {stats.map((unit, index) => (
                    <motion.div
                      key={unit.name}
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.4 + index * 0.1 }}
                      whileHover={{ scale: 1.05 }}
                      className="bg-white/10 dark:bg-white/5 backdrop-blur-sm rounded-xl p-4 text-center"
                    >
                      <span className="text-2xl mb-2 block">{unit.emoji}</span>
                      <div className="font-semibold">{unit.name}</div>
                      <div className="text-slate-400 dark:text-slate-300 text-sm">{unit.stat}</div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Floating decorative elements */}
              <motion.div
                animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl shadow-lg flex items-center justify-center text-4xl"
              >
                ☀️
              </motion.div>
              <motion.div
                animate={{ y: [0, 10, 0], rotate: [0, -5, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute -bottom-6 -left-6 w-20 h-20 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl shadow-lg flex items-center justify-center text-3xl"
              >
                🌊
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <TestimonialsCarousel />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-primary-800 dark:from-primary-700 dark:to-primary-900 relative overflow-hidden">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 50, repeat: Infinity, ease: 'linear' }}
          className="absolute -right-20 -top-20 w-80 h-80 border border-white/10 dark:border-white/5 rounded-full"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
          className="absolute -left-10 -bottom-10 w-60 h-60 border border-white/10 dark:border-white/5 rounded-full"
        />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-white mb-6"
          >
            {tHome('cta.readyGetaway')}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-primary-100 dark:text-primary-200 text-lg mb-8 max-w-2xl mx-auto"
          >
            {tHome('cta.bookStayNow')}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Link href="/chalets">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
                <Button size="lg" className="bg-white text-primary-700 hover:bg-primary-50 dark:bg-white dark:text-primary-800 dark:hover:bg-gray-100 px-10 py-4 text-lg shadow-xl">
                  {tHome('cta.bookYourChaletNow')}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </motion.div>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Resort Map Section */}
      <section className="py-20 bg-white dark:bg-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <InteractiveResortMap />
        </div>
      </section>

      {/* Live Chat Widget */}
      <LiveChatWidget />

      {/* Footer */}
      <footer className="bg-slate-900 dark:bg-slate-950 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center space-x-2 mb-4">
                <motion.div 
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                  className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center"
                >
                  <span className="text-white font-bold text-xl">V2</span>
                </motion.div>
                <span className="text-xl font-semibold">{tNav('home').replace('Home', 'Resort')}</span>
              </div>
              <p className="text-slate-400">
                {tFooter('description')}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <h4 className="font-semibold mb-4">{tFooter('quickLinks')}</h4>
              <ul className="space-y-2 text-slate-400">
                {[
                  { name: tNav('restaurant'), href: '/restaurant' },
                  { name: tNav('snackBar'), href: '/snack-bar' },
                  { name: tNav('chalets'), href: '/chalets' },
                  { name: tNav('pool'), href: '/pool' },
                ].map((link) => (
                  <li key={link.name}>
                    <Link href={link.href} className="hover:text-white transition-colors">
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <h4 className="font-semibold mb-4">{tFooter('legal')}</h4>
              <ul className="space-y-2 text-slate-400">
                {[
                  { name: tFooter('privacyPolicy'), href: '/privacy' },
                  { name: tFooter('termsOfService'), href: '/terms' },
                  { name: tFooter('cancellationPolicy'), href: '/cancellation' },
                ].map((link) => (
                  <li key={link.name}>
                    <Link href={link.href} className="hover:text-white transition-colors">
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            >
              <h4 className="font-semibold mb-4">{tFooter('contact')}</h4>
              <ul className="space-y-3 text-slate-400">
                <li className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-primary-400" />
                  <span>{tFooter('address')}</span>
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-primary-400" />
                  <span>{tFooter('phone')}</span>
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-primary-400" />
                  <span>{tFooter('email')}</span>
                </li>
              </ul>
            </motion.div>
          </div>

          <div className="border-t border-slate-800 dark:border-slate-700 pt-8 text-center text-slate-400 dark:text-slate-500">
            <p>{tFooter('copyright', { year: new Date().getFullYear() })}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
