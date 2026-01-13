'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { MapPin, Phone, Mail, Clock, Navigation, Waves, UtensilsCrossed, Home, Palmtree } from 'lucide-react';
import { useState } from 'react';
import { useSiteSettings } from '@/lib/settings-context';

interface MapLocation {
  id: string;
  name: string;
  nameKey: string;
  x: number;
  y: number;
  icon: React.ReactNode;
  description: string;
}

export default function InteractiveResortMap() {
  const t = useTranslations('resortMap');
  const { settings } = useSiteSettings();
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [isHovered, setIsHovered] = useState<string | null>(null);

  const locations: MapLocation[] = [
    {
      id: 'restaurant',
      name: 'Restaurant',
      nameKey: 'restaurant',
      x: 35,
      y: 40,
      icon: <UtensilsCrossed className="w-5 h-5" />,
      description: 'Fine Lebanese & international cuisine',
    },
    {
      id: 'pool',
      name: 'Swimming Pool',
      nameKey: 'pool',
      x: 60,
      y: 55,
      icon: <Waves className="w-5 h-5" />,
      description: 'Olympic-size pool with lounging area',
    },
    {
      id: 'chalets',
      name: 'Chalets',
      nameKey: 'chalets',
      x: 75,
      y: 30,
      icon: <Home className="w-5 h-5" />,
      description: 'Luxury mountain-view accommodations',
    },
    {
      id: 'snackbar',
      name: 'Snack Bar',
      nameKey: 'snackBar',
      x: 50,
      y: 70,
      icon: <Palmtree className="w-5 h-5" />,
      description: 'Poolside refreshments & light bites',
    },
    {
      id: 'reception',
      name: 'Reception',
      nameKey: 'reception',
      x: 20,
      y: 60,
      icon: <MapPin className="w-5 h-5" />,
      description: 'Main entrance & guest services',
    },
  ];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-6 py-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Navigation className="w-5 h-5" />
          {t('title')}
        </h3>
        <p className="text-white/80 text-sm">{t('subtitle')}</p>
      </div>

      {/* Map Container */}
      <div className="relative aspect-[16/10] bg-gradient-to-br from-emerald-100 via-teal-50 to-blue-100 dark:from-emerald-900/30 dark:via-slate-800 dark:to-blue-900/30">
        {/* Background Pattern - Mountain silhouette */}
        <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M0,70 Q15,40 30,60 T50,50 T70,55 T85,45 T100,60 L100,100 L0,100 Z" fill="currentColor" className="text-primary-500" />
          <path d="M0,80 Q20,60 40,75 T60,65 T80,70 T100,55 L100,100 L0,100 Z" fill="currentColor" className="text-secondary-500" />
        </svg>

        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-primary-400/40 rounded-full"
              style={{
                left: `${20 + i * 15}%`,
                top: `${30 + Math.sin(i) * 20}%`,
              }}
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 2 + i * 0.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>

        {/* Location Markers */}
        {locations.map((location) => (
          <motion.button
            key={location.id}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-10 ${
              selectedLocation?.id === location.id ? 'z-20' : ''
            }`}
            style={{ left: `${location.x}%`, top: `${location.y}%` }}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setSelectedLocation(location)}
            onMouseEnter={() => setIsHovered(location.id)}
            onMouseLeave={() => setIsHovered(null)}
          >
            {/* Pulse ring */}
            <motion.div
              className={`absolute inset-0 rounded-full ${
                selectedLocation?.id === location.id
                  ? 'bg-primary-500'
                  : 'bg-primary-400'
              }`}
              animate={{
                scale: [1, 1.8, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{ width: 40, height: 40, marginLeft: -8, marginTop: -8 }}
            />
            
            {/* Marker */}
            <div
              className={`relative w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all ${
                selectedLocation?.id === location.id
                  ? 'bg-primary-600 text-white ring-4 ring-primary-300'
                  : isHovered === location.id
                  ? 'bg-primary-500 text-white'
                  : 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400'
              }`}
            >
              {location.icon}
            </div>

            {/* Tooltip */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ 
                opacity: isHovered === location.id ? 1 : 0,
                y: isHovered === location.id ? 0 : 10,
              }}
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium pointer-events-none"
            >
              {location.name}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
            </motion.div>
          </motion.button>
        ))}
      </div>

      {/* Location Details Panel */}
      <motion.div
        initial={false}
        animate={{
          height: selectedLocation ? 'auto' : 0,
          opacity: selectedLocation ? 1 : 0,
        }}
        className="overflow-hidden border-t border-slate-200 dark:border-slate-700"
      >
        {selectedLocation && (
          <div className="p-6 bg-gradient-to-r from-slate-50 to-emerald-50 dark:from-slate-800 dark:to-emerald-900/20">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg">
                {selectedLocation.icon}
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                  {selectedLocation.name}
                </h4>
                <p className="text-slate-600 dark:text-slate-400">
                  {selectedLocation.description}
                </p>
              </div>
              <motion.a
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                href={`/${selectedLocation.id === 'snackbar' ? 'snack-bar' : selectedLocation.id}`}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg font-medium shadow-lg"
              >
                {t('explore')}
              </motion.a>
            </div>
          </div>
        )}
      </motion.div>

      {/* Quick Info Footer */}
      <div className="grid grid-cols-3 border-t border-slate-200 dark:border-slate-700">
        <div className="p-4 text-center border-r border-slate-200 dark:border-slate-700">
          <Phone className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
          <p className="text-xs text-slate-600 dark:text-slate-400">{settings.phone || 'Contact us'}</p>
        </div>
        <div className="p-4 text-center border-r border-slate-200 dark:border-slate-700">
          <Mail className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
          <p className="text-xs text-slate-600 dark:text-slate-400">{settings.email || 'info@v2resort.com'}</p>
        </div>
        <div className="p-4 text-center">
          <Clock className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
          <p className="text-xs text-slate-600 dark:text-slate-400">{settings.receptionHours || '8AM - 11PM'}</p>
        </div>
      </div>
    </div>
  );
}
