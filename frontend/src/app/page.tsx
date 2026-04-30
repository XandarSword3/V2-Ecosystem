'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useRef, useMemo, useState, useEffect } from 'react';
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
import WeatherWidget from '@/components/WeatherWidget';

export default function HomePage() {
  const t = useTranslations();
  const tHome = useTranslations('home');
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');
  const tFooter = useTranslations('footer');
  const { settings, modules } = useSiteSettings();
  const heroRef = useRef<HTMLDivElement>(null);

  // Hero slide carousel state
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const heroSlides = useMemo(() => {
    const slides = settings.homepage?.heroSlides?.filter(s => s.enabled) || [];
    return slides.length > 0 ? slides : [{
      id: 'default',
      title: settings.resortName || tHome('hero.titleHighlight'),
      subtitle: settings.description || tHome('hero.subtitle'),
      buttonText: tHome('cta.viewMenu'),
      buttonLink: '/restaurant',
      imageUrl: '',
      enabled: true
    }];
  }, [settings.homepage?.heroSlides, settings.resortName, settings.description, tHome]);

  // Auto-rotate hero slides
  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlideIndex(prev => (prev + 1) % heroSlides.length);
    }, 6000); // Change slide every 6 seconds
    return () => clearInterval(interval);
  }, [heroSlides.length]);

  const currentSlide = heroSlides[currentSlideIndex];

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
      // No modules configured - show a message to set up modules
      return [];
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
  }, [activeModules]);

  // Get sorted and enabled homepage sections from CMS settings
  const homepageSections = useMemo(() => {
    const defaultSections = [
      { id: '1', type: 'services' as const, title: 'Our Services', enabled: true, order: 1 },
      { id: '2', type: 'features' as const, title: 'Why Choose Us', enabled: true, order: 2 },
      { id: '3', type: 'stats' as const, title: 'Our Numbers', enabled: true, order: 3 },
      { id: '4', type: 'testimonials' as const, title: 'What Our Guests Say', enabled: true, order: 4 },
      { id: '5', type: 'map' as const, title: 'Find Us', enabled: true, order: 5 },
      { id: '6', type: 'cta' as const, title: 'Call to Action', enabled: true, order: 6 },
    ];

    const sections = settings.homepage?.sections || defaultSections;
    return sections
      .filter(s => s.enabled)
      .sort((a, b) => a.order - b.order);
  }, [settings.homepage?.sections]);

  // Helper to check if a section should be shown
  const isSectionEnabled = (type: string) => {
    return homepageSections.some(s => s.type === type);
  };

  // Get CTA settings from CMS
  const ctaSettings = useMemo(() => ({
    title: settings.homepage?.ctaTitle || `Ready to Experience ${settings.resortName || 'Our Services'}?`,
    subtitle: settings.homepage?.ctaSubtitle || "Book your stay today and discover why we're the preferred destination.",
    buttonText: settings.homepage?.ctaButtonText || 'Book Now',
    buttonLink: settings.homepage?.ctaButtonLink || '/restaurant', // IMPROVE Iter-5: Default CTA to /restaurant instead of / (self-link)
  }), [settings.homepage, settings.resortName]);

  // Generate stats from active modules
  const stats = useMemo(() => {
    if (activeModules.length === 0) {
      // No modules - show generic stats from CMS or defaults
      const cmsStats = settings.homepage?.stats;
      if (cmsStats && Array.isArray(cmsStats)) {
        return cmsStats.map((stat: { value: string; label: string }) => ({
          value: parseInt(stat.value) || 0,
          label: stat.label,
          suffix: '+',
          icon: <Users className="w-6 h-6" />,
        }));
      }
      return [];
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
  }, [activeModules, settings.homepage?.stats]);

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
        {/* Background Image from CMS */}
        <AnimatePresence mode="wait">
          {currentSlide.imageUrl && (
            <motion.div
              key={currentSlide.id}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}
              className="absolute inset-0 z-0"
            >
              <Image
                src={currentSlide.imageUrl}
                alt={currentSlide.title || 'Hero background'}
                fill
                priority
                className="object-cover"
                sizes="100vw"
              />
              {/* Overlay for better text readability */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className="absolute inset-0 z-0"
          style={{ y: heroY, opacity: heroOpacity }}
        >
          {/* Floating decorative orbs - only show if no background image */}
          {!currentSlide.imageUrl && [
            { size: 'w-48 sm:w-64 lg:w-80', x: '10%', y: '20%', delay: 0 },
            { size: 'w-32 sm:w-48 lg:w-64', x: '80%', y: '30%', delay: 1 },
            { size: 'w-24 sm:w-32 lg:w-48', x: '20%', y: '70%', delay: 2 },
            { size: 'w-40 sm:w-56 lg:w-72', x: '70%', y: '75%', delay: 0.5 },
          ].map((orb, i) => (
            <motion.div
              key={i}
              className={`absolute rounded-full ${orb.size}`}
              style={{
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
          {/* Weather Widget - Below hero text on mobile, top right on desktop */}
          <div className="hidden sm:block absolute top-4 right-4 z-20">
            <WeatherWidget variant="compact" />
          </div>

          {/* Slide indicators */}
          {heroSlides.length > 1 && (
            <div className="absolute bottom-20 sm:bottom-28 left-1/2 -translate-x-1/2 flex gap-2 z-20">
              {heroSlides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlideIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-all ${idx === currentSlideIndex
                    ? 'w-8 bg-white'
                    : 'bg-white/50 hover:bg-white/75'
                    }`}
                />
              ))}
            </div>
          )}

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <MagneticButton>
              <div className={`inline-flex items-center gap-2 px-6 py-3 backdrop-blur-xl rounded-full text-sm font-medium shadow-glass border border-white/20 mb-8 ${currentSlide.imageUrl
                ? 'bg-black/30 text-white'
                : 'bg-white/80 dark:bg-slate-900/80'
                }`}>
                <Sparkles className={`w-4 h-4 ${currentSlide.imageUrl ? 'text-white' : 'text-primary-500'}`} />
                <span className={currentSlide.imageUrl ? 'text-white' : 'text-slate-700 dark:text-slate-200'}>
                  {settings.tagline || tHome('hero.badge')}
                </span>
                <Sparkles className={`w-4 h-4 ${currentSlide.imageUrl ? 'text-white' : 'text-primary-500'}`} />
              </div>
            </MagneticButton>
          </motion.div>

          {/* Main heading - Uses current slide from CMS */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide.id + '-title'}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className={`text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight ${currentSlide.imageUrl ? 'text-white drop-shadow-lg' : 'text-slate-900 dark:text-white'
                }`}>
                {/* Single CMS-driven title from Homepage Hero Config */}
                {currentSlide.imageUrl ? (
                  <span className="text-4xl sm:text-6xl md:text-8xl lg:text-9xl font-black text-white drop-shadow-xl">
                    <StaggerText delay={0.4} staggerDelay={0.08}>
                      {settings.homepage?.hero?.title || currentSlide.title || settings.resortName || 'Welcome'}
                    </StaggerText>
                  </span>
                ) : (
                  <GradientText className="text-4xl sm:text-6xl md:text-8xl lg:text-9xl font-black">
                    {settings.homepage?.hero?.title || currentSlide.title || settings.resortName || 'Welcome'}
                  </GradientText>
                )}
              </h1>
            </motion.div>
          </AnimatePresence>

          {/* Subtitle - Uses current slide from CMS */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide.id + '-subtitle'}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <BlurReveal delay={0.6}>
                <p className={`text-lg sm:text-xl md:text-2xl mb-12 max-w-3xl mx-auto leading-relaxed px-4 sm:px-0 ${currentSlide.imageUrl
                  ? 'text-white/90 drop-shadow-md'
                  : 'text-slate-600 dark:text-slate-300'
                  }`}>
                  {currentSlide.subtitle || settings.description || tHome('hero.subtitle')}
                </p>
              </BlurReveal>
            </motion.div>
          </AnimatePresence>

          {/* CTA Buttons - Fully CMS-driven from homepage.hero config */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href={settings.homepage?.hero?.ctaLink || currentSlide.buttonLink || '/restaurant'}> {/* IMPROVE Iter-5: Default CTA to /restaurant instead of / (self-link) */}
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
                      {settings.homepage?.hero?.ctaText || currentSlide.buttonText || 'Get Started'}
                      <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </span>
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  </Button>
                </motion.div>
              </MagneticButton>
            </Link>
            {/* Secondary CTA - Only show if configured in CMS hero.secondaryCtaLink */}
            {(settings.homepage?.hero as any)?.secondaryCtaLink && (
              <Link href={(settings.homepage?.hero as any)?.secondaryCtaLink || '/about'}>
                <MagneticButton strength={0.15}>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      variant="outline"
                      size="lg"
                      className={`px-8 py-6 text-lg font-semibold rounded-2xl backdrop-blur-xl border-2 shadow-glass ${currentSlide.imageUrl
                        ? 'bg-white/20 border-white/50 hover:border-white text-white hover:bg-white/30'
                        : 'bg-white/80 dark:bg-slate-900/80 border-primary-500/30 hover:border-primary-500 text-primary-600 dark:text-primary-400'
                        }`}
                    >
                      {(settings.homepage?.hero as any)?.secondaryCtaText || 'Learn More'}
                    </Button>
                  </motion.div>
                </MagneticButton>
              </Link>
            )}
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

      {/* Services Section - Bento Grid - Conditionally rendered based on CMS settings */}
      {isSectionEnabled('services') && (
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
      )}

      {/* Stats Section - Animated Counters - Conditionally rendered */}
      {isSectionEnabled('stats') && (
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
      )}

      {/* Features Section - Conditionally rendered */}
      {isSectionEnabled('features') && (
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
                  {tHome('features.title')}
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
      )}

      {/* Testimonials Section - Conditionally rendered */}
      {isSectionEnabled('testimonials') && (
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
      )}

      {/* CTA Section - Conditionally rendered with CMS settings */}
      {isSectionEnabled('cta') && (
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
                {ctaSettings.title}
              </h2>
            </motion.div>
            <BlurReveal delay={0.2}>
              <p className="text-white/80 text-xl mb-10 max-w-2xl mx-auto">
                {ctaSettings.subtitle}
              </p>
            </BlurReveal>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            >
              <Link href={ctaSettings.buttonLink}>
                <MagneticButton strength={0.2}>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      size="lg"
                      className="bg-white text-slate-900 hover:bg-white/90 px-10 py-6 text-lg font-semibold shadow-2xl rounded-2xl group"
                    >
                      {ctaSettings.buttonText}
                      <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </motion.div>
                </MagneticButton>
              </Link>
            </motion.div>
          </div>
        </section>
      )}

      {/* Resort Map Section - Conditionally rendered */}
      {isSectionEnabled('map') && (
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
      )}

      {/* Live Chat Widget */}
      <LiveChatWidget />

      {/* SEO Content for Bots/Audits - Visually Hidden but Accessible */}


    </AuroraBackground>
  );
}
