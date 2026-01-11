'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { 
  Settings, 
  X, 
  Sparkles, 
  Wand2, 
  Loader2, 
  Check,
  Palette
} from 'lucide-react';
import { useSettingsStore, type TransitionStyle } from '@/lib/stores/settingsStore';

interface UserPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const transitionStyles: { value: TransitionStyle; label: string; icon: string }[] = [
  { value: 'fade', label: 'Fade', icon: '✨' },
  { value: 'slideRight', label: 'Slide Right', icon: '➡️' },
  { value: 'slideUp', label: 'Slide Up', icon: '⬆️' },
  { value: 'scale', label: 'Scale', icon: '🔍' },
  { value: 'reveal', label: 'Reveal', icon: '🎭' },
];

export function UserPreferencesModal({ isOpen, onClose }: UserPreferencesModalProps) {
  const t = useTranslations('settings');
  
  const {
    enableTransitions,
    transitionStyle,
    enableLoadingAnimation,
    animationsEnabled,
    setEnableTransitions,
    setTransitionStyle,
    setEnableLoadingAnimation,
    setAnimationsEnabled,
  } = useSettingsStore();

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleBackdropClick}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-primary-600 via-primary-500 to-secondary-500 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Settings className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{t('preferences.title')}</h2>
                    <p className="text-sm text-white/80">{t('preferences.subtitle')}</p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Animations Toggle */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    {t('preferences.animations.title')}
                  </h3>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 space-y-4">
                  {/* Main Animations Toggle */}
                  <ToggleSwitch
                    label={t('preferences.animations.enableAll')}
                    description={t('preferences.animations.enableAllDesc')}
                    enabled={animationsEnabled}
                    onChange={setAnimationsEnabled}
                  />
                </div>
              </div>

              {/* Page Transitions */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Wand2 className="w-5 h-5 text-purple-500" />
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    {t('preferences.transitions.title')}
                  </h3>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 space-y-4">
                  {/* Enable Transitions */}
                  <ToggleSwitch
                    label={t('preferences.transitions.enable')}
                    description={t('preferences.transitions.enableDesc')}
                    enabled={enableTransitions}
                    onChange={setEnableTransitions}
                  />

                  {/* Transition Style Selector */}
                  {enableTransitions && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="pt-4 border-t border-slate-200 dark:border-slate-700"
                    >
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                        {t('preferences.transitions.style')}
                      </p>
                      <div className="grid grid-cols-5 gap-2">
                        {transitionStyles.map((style) => (
                          <motion.button
                            key={style.value}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setTransitionStyle(style.value)}
                            className={`
                              flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all
                              ${transitionStyle === style.value
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                                : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
                              }
                            `}
                          >
                            <span className="text-2xl mb-1">{style.icon}</span>
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                              {style.label}
                            </span>
                            {transitionStyle === style.value && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center"
                              >
                                <Check className="w-3 h-3 text-white" />
                              </motion.div>
                            )}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Loading Animation */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-green-500" />
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    {t('preferences.loading.title')}
                  </h3>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4">
                  <ToggleSwitch
                    label={t('preferences.loading.enable')}
                    description={t('preferences.loading.enableDesc')}
                    enabled={enableLoadingAnimation}
                    onChange={setEnableLoadingAnimation}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className="w-full py-3 px-4 bg-gradient-to-r from-primary-600 to-secondary-500 text-white font-semibold rounded-xl shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40 transition-all"
              >
                {t('preferences.done')}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Toggle Switch Component
interface ToggleSwitchProps {
  label: string;
  description?: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

function ToggleSwitch({ label, description, enabled, onChange }: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-slate-900 dark:text-white">{label}</p>
        {description && (
          <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => onChange(!enabled)}
        className={`
          relative w-14 h-8 rounded-full transition-colors duration-300
          ${enabled 
            ? 'bg-gradient-to-r from-primary-500 to-secondary-500' 
            : 'bg-slate-300 dark:bg-slate-600'
          }
        `}
      >
        <motion.div
          animate={{ x: enabled ? 24 : 4 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center"
        >
          <motion.div
            animate={{ scale: enabled ? 1 : 0 }}
            className="w-3 h-3 bg-blue-500 rounded-full"
          />
        </motion.div>
      </motion.button>
    </div>
  );
}
