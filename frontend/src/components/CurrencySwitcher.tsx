'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, ChevronDown } from 'lucide-react';
import { 
  useSettingsStore, 
  Currency, 
  currencySymbols, 
  currencyNames 
} from '@/lib/stores/settingsStore';

const currencies: Currency[] = ['USD', 'EUR', 'LBP'];

export function CurrencySwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const currency = useSettingsStore((s) => s.currency);
  const setCurrency = useSettingsStore((s) => s.setCurrency);

  const handleCurrencyChange = (newCurrency: Currency) => {
    setCurrency(newCurrency);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
      >
        <Coins className="h-4 w-4" />
        <span className="text-sm font-medium">{currencySymbols[currency]}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-48 rounded-xl bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10 z-20 overflow-hidden"
            >
              <div className="py-1">
                {currencies.map((curr) => (
                  <button
                    key={curr}
                    onClick={() => handleCurrencyChange(curr)}
                    className={`flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                      currency === curr 
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' 
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <span className="text-lg font-semibold w-8">{currencySymbols[curr]}</span>
                    <div className="text-left">
                      <div className="font-medium">{curr}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {currencyNames[curr]}
                      </div>
                    </div>
                    {currency === curr && (
                      <motion.div 
                        layoutId="currency-check"
                        className="ml-auto w-2 h-2 bg-blue-500 rounded-full" 
                      />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
