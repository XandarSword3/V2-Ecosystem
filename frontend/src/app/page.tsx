'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useRef, useMemo } from 'react';
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
  Users,
  Calendar,
  Award,
  Clock,
} from 'lucide-react';
import { fadeInUp, staggerContainer, scaleIn } from '@/lib/animations/presets';
import { Button } from '@/components/ui/Button';
import dynamic from 'next/dynamic';
import { useSiteSettings } from '@/lib/settings-context';
import { getModuleIcon, getMainPageModules, getModuleDefaultDescription, getModuleStatLabel, getModuleStatPlaceholder, type Module } from '@/lib/module-utils';

// Premium effects
import { AuroraBackground, AuroraSection } from '@/components/effects/AuroraBackground';
import { BentoGrid, BentoCard, BentoFeatureCard } from '@/components/effects/BentoGrid';
import { Card3D, TiltCard, FloatingCard } from '@/components/effects/Card3D';
import { AnimatedCounter, AnimatedStat, AnimatedStatsRow } from '@/components/effects/AnimatedCounter';
import { SpotlightCard, MagneticButton } from '@/components/effects/GlowingBorder';
import { GradientText, StaggerText, RevealHeading, BlurReveal, HighlightText } from '@/components/effects/TextEffects';

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
  const { settings, modules } = useSiteSettings();
  const heroRef = useRef<HTMLDivElement>(null);
  
  // Parallax effect for hero
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start']
  });
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  // Get active modules for dynamic display
  const activeModules = useMemo(() => getMainPageModules(modules as Module[]), [modules]);
  
  // Generate services from active modules
  const services = useMemo(() => {
    if (activeModules.length === 0) {
      // Fallback to default services if no modules configured
      return [
        {
          icon: <UtensilsCrossed className="w-8 h-8" />,
          title: tHome('services.restaurant.title'),
          description: tHome('services.restaurant.description'),
          href: '/restaurant',
          image: '/images/restaurant-bg.jpg',
        },
        {
          icon: <Cookie className="w-8 h-8" />,
          title: tHome('services.snackBar.title'),
          description: tHome('services.snackBar.description'),
          href: '/snack-bar',
          image: '/images/snack-bg.jpg',
        },
        {
          icon: <Home className="w-8 h-8" />,
          title: tHome('services.chalets.title'),
          description: tHome('services.chalets.description'),
          href: '/chalets',
          image: '/images/chalet-bg.jpg',
        },
        {
          icon: <Waves className="w-8 h-8" />,
          title: tHome('services.pool.title'),
          description: tHome('services.pool.description'),
          href: '/pool',
          image: '/images/pool-bg.jpg',
        },
      ];
    }
    
    return activeModules.map(module => {
      const IconComponent = getModuleIcon(module);
      return {
        icon: <IconComponent className="w-8 h-8" />,
        title: module.name,
        description: module.description || getModuleDefaultDescription(module),
        href: `/${module.slug}`,
        image: `/images/${module.slug}-bg.jpg`,
        module, // Keep reference for rendering
      };
    });
  }, [activeModules, tHome]);

  // Generate stats from active modules
  const stats = useMemo(() => {
    if (activeModules.length === 0) {
      // Fallback to default stats
      return [
        { value: 50, label: tHome('stats.restaurant'), suffix: '+', icon: <UtensilsCrossed className="w-6 h-6" /> },
        { value: 4, label: tHome('stats.chalets'), icon: <Home className="w-6 h-6" /> },
        { value: 3, label: tHome('stats.pool'), icon: <Waves className="w-6 h-6" /> },
        { value: 1000, label: tHome('stats.snackBar'), suffix: '+', icon: <Users className="w-6 h-6" /> },
      ];
    }
    
    return activeModules.slice(0, 4).map(module => {
      const IconComponent = getModuleIcon(module);
      return {
        value: getModuleStatPlaceholder(module),
        label: module.name,
        suffix: module.template_type === 'menu_service' ? '+' : '',
        icon: <IconComponent className="w-6 h-6" />,
      };
    });
  }, [activeModules, tHome]);

  const features = [
    { title: tHome('features.primeLocation.title'), description: tHome('features.primeLocation.description'), icon: <MapPin className="w-5 h-5" /> },
    { title: tHome('features.authenticCuisine.title'), description: tHome('features.authenticCuisine.description'), icon: <Award className="w-5 h-5" /> },
    { title: tHome('features.modernAmenities.title'), description: tHome('features.modernAmenities.description'), icon: <Sparkles className="w-5 h-5" /> },
    { title: tHome('features.familyFriendly.title'), description: tHome('features.familyFriendly.description'), icon: <Users className="w-5 h-5" /> },
  ];

  return (
    <AuroraBackground className="min-h-screen" intensity="medium">
      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-[100vh] flex items-center justify-center pt-20 overflow-hidden">
        <motion.div 
          className="absolute inset-0 z-0"
          style={{ y: heroY, opacity: heroOpacity }}
        >
          {/* Floating decorative orbs */}
          {[
            { size: 300, x: '10%', y: '20%', delay: 0 },
            { size: 200, x: '80%', y: '30%', delay: 1 },
            { size: 150, x: '20%', y: '70%', delay: 2 },
            { size: 250, x: '70%', y: '75%', delay: 0.5 },
          ].map((orb, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: orb.size,
                height: orb.size,
                left: orb.x,
                top: orb.y,
                background: `radial-gradient(circle, var(--color-primary)20 0%, transparent 70%)`,
              }}
              animate={{
                y: [0, -30, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 6 + i,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: orb.delay,
              }}
            />
          ))}
        </motion.div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <MagneticButton>
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-full text-sm font-medium shadow-glass border border-white/20 mb-8">
                <Sparkles className="w-4 h-4 text-primary-500" />
                <span className="text-slate-700 dark:text-slate-200">{settings.tagline || tHome('hero.badge')}</span>
                <Sparkles className="w-4 h-4 text-primary-500" />
              </div>
            </MagneticButton>
          </motion.div>

          {/* Main heading - Uses CMS heroSlides if available */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight text-slate-900 dark:text-white">
              <StaggerText delay={0.4} staggerDelay={0.08}>
                {tCommon('welcome').replace('V2 Resort', '')}
              </StaggerText>
              <br />
              <span className="relative inline-block mt-2">
                <GradientText className="text-6xl md:text-8xl lg:text-9xl font-black">
                  {settings.homepage?.heroSlides?.[0]?.title || settings.resortName || tHome('hero.titleHighlight')}
                </GradientText>
              </span>
            </h1>
          </motion.div>

          {/* Subtitle - Uses CMS heroSlides if available */}
          <BlurReveal delay={0.6}>
            <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 mb-12 max-w-3xl mx-auto leading-relaxed">
              {settings.homepage?.heroSlides?.[0]?.subtitle || settings.description || tHome('hero.subtitle')}
            </p>
          </BlurReveal>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/restaurant">
              <MagneticButton strength={0.15}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button 
                    size="lg" 
                    className="relative overflow-hidden px-8 py-6 text-lg font-semibold shadow-elevated-lg rounded-2xl group"
                    style={{
                      background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
                    }}
                  >
                    <span className="relative z-10 flex items-center text-white">
                      {tHome('cta.viewMenu')}
                      <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </span>
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  </Button>
                </motion.div>
              </MagneticButton>
            </Link>
            <Link href="/chalets">
              <MagneticButton strength={0.15}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="px-8 py-6 text-lg font-semibold rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-2 border-primary-500/30 hover:border-primary-500 text-primary-600 dark:text-primary-400 shadow-glass"
                  >
                    <Home className="w-5 h-5 mr-2" />
                    {tHome('cta.bookChalet')}
                  </Button>
                </motion.div>
              </MagneticButton>
            </Link>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="absolute bottom-12 left-1/2 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="flex flex-col items-center gap-2"
            >
              <span className="text-sm text-slate-500 dark:text-slate-400">{tCommon('learnMore')}</span>
              <div className="w-6 h-10 border-2 border-slate-300 dark:border-slate-600 rounded-full flex justify-center pt-2">
                <motion.div 
                  className="w-1.5 h-3 bg-primary-500 rounded-full"
                  animate={{ y: [0, 8, 0], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Services Section - Bento Grid */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={staggerContainer}
            className="text-center mb-16"
          >
            <motion.div variants={fadeInUp}>
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500/10 text-primary-600 dark:text-primary-400 rounded-full text-sm font-medium mb-4">
                <Sparkles className="w-4 h-4" />
                {tHome('services.whatWeOffer')}
              </span>
            </motion.div>
            <RevealHeading className="text-4xl md:text-6xl font-bold text-slate-900 dark:text-white mb-4">
              {tHome('services.title')}
            </RevealHeading>
            <BlurReveal delay={0.2}>
              <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                {tHome('services.subtitle')}
              </p>
            </BlurReveal>
          </motion.div>

          {/* Dynamic Bento Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-[280px]">
            {services.map((service, index) => {
              // First service gets the large card treatment
              if (index === 0) {
                return (
                  <motion.div
                    key={service.href}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0 }}
                    className="md:col-span-2 md:row-span-2"
                  >
                    <Link href={service.href} className="block h-full">
                      <Card3D className="h-full" intensity={8}>
                        <SpotlightCard className="h-full p-8 flex flex-col justify-between group">
                          <div>
                            <motion.div
                              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-secondary-500 flex items-center justify-center mb-6 shadow-lg"
                              whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                              transition={{ duration: 0.5 }}
                            >
                              <div className="text-white">{service.icon}</div>
                            </motion.div>
                            <h3 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-3">
                              {service.title}
                            </h3>
                            <p className="text-slate-600 dark:text-slate-400 text-lg">
                              {service.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-primary-500 font-medium mt-4">
                            <span>{tCommon('learnMore')}</span>
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
                          </div>
                        </SpotlightCard>
                      </Card3D>
                    </Link>
                  </motion.div>
                );
              }
              
              // Services 2-3 get regular cards
              if (index === 1 || index === 2) {
                return (
                  <motion.div
                    key={service.href}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="lg:col-span-1"
                  >
                    <Link href={service.href} className="block h-full">
                      <TiltCard className="h-full" tiltAmount={10}>
                        <SpotlightCard className="h-full p-6 flex flex-col group">
                          <motion.div
                            className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-400 to-secondary-500 flex items-center justify-center mb-4 shadow-lg"
                            whileHover={{ rotate: [0, -10, 10, 0] }}
                          >
                            <div className="text-white w-6 h-6 flex items-center justify-center">
                              {service.icon}
                            </div>
                          </motion.div>
                          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                            {service.title}
                          </h3>
                          <p className="text-slate-600 dark:text-slate-400 text-sm flex-1">
                            {service.description}
                          </p>
                          <div className="flex items-center gap-2 text-primary-500 font-medium mt-3 text-sm">
                            <span>{tCommon('learnMore')}</span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </SpotlightCard>
                      </TiltCard>
                    </Link>
                  </motion.div>
                );
              }
              
              // Service 4 (and onwards) gets wide cards
              return (
                <motion.div
                  key={service.href}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="md:col-span-2"
                >
                  <Link href={service.href} className="block h-full">
                    <FloatingCard className="h-full">
                      <SpotlightCard className="h-full p-6 flex flex-col md:flex-row md:items-center gap-6 group">
                        <motion.div
                          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-secondary-500 flex items-center justify-center shadow-lg flex-shrink-0"
                          whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                        >
                          <div className="text-white">{service.icon}</div>
                        </motion.div>
                        <div className="flex-1">
                          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                            {service.title}
                          </h3>
                          <p className="text-slate-600 dark:text-slate-400">
                            {service.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-primary-500 font-medium">
                          <span>{tCommon('learnMore')}</span>
                          <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                        </div>
                      </SpotlightCard>
                    </FloatingCard>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats Section - Animated Counters */}
      <AuroraSection className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-full text-sm font-medium mb-4 shadow-glass">
              <Award className="w-4 h-4 text-primary-500" />
              <span className="text-slate-700 dark:text-slate-200">{tHome('stats.businessUnits')}</span>
            </span>
            <RevealHeading className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white">
              {tHome('features.subtitle')}
            </RevealHeading>
          </motion.div>
          
          <AnimatedStatsRow stats={stats} />
        </div>
      </AuroraSection>

      {/* Features Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-sm font-medium mb-6">
                <Star className="w-4 h-4" />
                {tHome('features.subtitle')}
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-8">
                {tHome('features.title').replace('V2 Resort', '')}
                <span className="relative inline-block">
                  <span className="text-primary-600 dark:text-primary-400">
                    {' '}{settings.resortName || tHome('hero.titleHighlight')}
                  </span>
                  <motion.span
                    className="absolute bottom-0 left-0 h-[0.15em] w-full bg-primary-500/40"
                    initial={{ scaleX: 0, transformOrigin: 'left' }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
                  />
                </span>?
              </h2>

              <div className="space-y-6">
                {features.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <FloatingCard className="flex items-start gap-4 p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm border border-white/20">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                        <span className="text-white">{feature.icon}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-lg">{feature.title}</h4>
                        <p className="text-slate-600 dark:text-slate-400">{feature.description}</p>
                      </div>
                    </FloatingCard>
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
              {/* Premium stats card with 3D effect */}
              <Card3D intensity={10}>
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                  {/* Background glow */}
                  <div 
                    className="absolute inset-0 opacity-30"
                    style={{
                      background: 'radial-gradient(circle at 30% 30%, var(--color-primary)40, transparent 50%), radial-gradient(circle at 70% 70%, var(--color-secondary)30, transparent 50%)',
                    }}
                  />
                  
                  <div className="relative z-10">
                    <motion.div
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ type: 'spring', stiffness: 200, delay: 0.3 }}
                      className="text-center mb-8"
                    >
                      <div className="text-7xl font-black">
                        <GradientText>{services.length.toString()}</GradientText>
                      </div>
                      <div className="text-slate-300 text-lg">{tHome('stats.businessUnits')}</div>
                    </motion.div>

                    <div className="grid grid-cols-2 gap-4">
                      {stats.map((item, index) => (
                        <motion.div
                          key={item.label}
                          initial={{ opacity: 0, scale: 0.8 }}
                          whileInView={{ opacity: 1, scale: 1 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.4 + index * 0.1 }}
                          whileHover={{ scale: 1.05, y: -2 }}
                          className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/10"
                        >
                          <div className="flex justify-center mb-2 text-primary-400">{item.icon}</div>
                          <div className="text-2xl font-bold text-white">{item.value}</div>
                          <div className="text-slate-400 text-sm">{item.label}</div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card3D>

              {/* Floating decorative elements */}
              <motion.div
                animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl shadow-xl flex items-center justify-center text-4xl"
              >
                ☀️
              </motion.div>
              <motion.div
                animate={{ y: [0, 10, 0], rotate: [0, -5, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute -bottom-6 -left-6 w-20 h-20 bg-gradient-to-br from-primary-400 to-secondary-500 rounded-2xl shadow-xl flex items-center justify-center text-3xl"
              >
                🌊
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Background gradient blobs */}
        <div className="absolute inset-0 opacity-30">
          <div 
            className="absolute top-0 left-1/4 w-96 h-96 rounded-full"
            style={{ background: 'radial-gradient(circle, var(--color-primary)20, transparent 70%)', filter: 'blur(40px)' }}
          />
          <div 
            className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full"
            style={{ background: 'radial-gradient(circle, var(--color-secondary)20, transparent 70%)', filter: 'blur(40px)' }}
          />
        </div>
        
        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full text-sm font-medium mb-4">
              <Star className="w-4 h-4" fill="currentColor" />
              {tCommon('testimonials') || 'What Our Guests Say'}
            </span>
          </motion.div>
          <TestimonialsCarousel />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        {/* Gradient background */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
          }}
        />
        
        {/* Animated circles */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 50, repeat: Infinity, ease: 'linear' }}
          className="absolute -right-20 -top-20 w-80 h-80 border border-white/10 rounded-full"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
          className="absolute -left-10 -bottom-10 w-60 h-60 border border-white/10 rounded-full"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/5"
        />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              {tHome('cta.readyGetaway')}
            </h2>
          </motion.div>
          <BlurReveal delay={0.2}>
            <p className="text-white/80 text-xl mb-10 max-w-2xl mx-auto">
              {tHome('cta.bookStayNow')}
            </p>
          </BlurReveal>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <Link href="/chalets">
              <MagneticButton strength={0.2}>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button 
                    size="lg" 
                    className="bg-white text-slate-900 hover:bg-white/90 px-10 py-6 text-lg font-semibold shadow-2xl rounded-2xl group"
                  >
                    {tHome('cta.bookYourChaletNow')}
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </motion.div>
              </MagneticButton>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Resort Map Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500/10 text-primary-600 dark:text-primary-400 rounded-full text-sm font-medium mb-4">
              <MapPin className="w-4 h-4" />
              {tCommon('location') || 'Find Us'}
            </span>
            <RevealHeading className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
              {tCommon('exploreResort') || 'Explore Our Resort'}
            </RevealHeading>
          </motion.div>
          <Card3D intensity={5}>
            <div className="rounded-3xl overflow-hidden shadow-glass-xl border border-white/20">
              <InteractiveResortMap />
            </div>
          </Card3D>
        </div>
      </section>

      {/* Live Chat Widget */}
      <LiveChatWidget />

      {/* SEO Content for Bots/Audits - Visually Hidden but Accessible */}
      <div className="sr-only">
        <section itemScope itemType="https://schema.org/Resort">
          <h2>About {settings.resortName || 'V2 Resort'}</h2>
          <p>
            {settings.description || `${settings.resortName || 'V2 Resort'} is a premier destination offering exceptional services and amenities.`}
          </p>
          
          <h3>Our Pricing</h3>
          <ul>
            <li><strong>Restaurant:</strong> Main courses start from $15. Average meal cost $30-$50 per person.</li>
            <li><strong>Chalets:</strong> Nightly rates start from $150. Weekly discounts available.</li>
            <li><strong>Pool Entrance:</strong> Adults ${settings.adultPrice || 20}, Children ${settings.childPrice || 10}. Weekend rates may vary.</li>
          </ul>

          <h3>Location & Contact</h3>
          <address>
            {settings.resortName || 'V2 Resort'}<br />
            {settings.address || '123 Resort Boulevard, Global City'}<br />
            Phone: {settings.phone || '+1 234 567 8900'}<br />
            Email: {settings.email || 'bookings@v2resort.com'}
          </address>
        </section>
      </div>

    </AuroraBackground>
  );
}
