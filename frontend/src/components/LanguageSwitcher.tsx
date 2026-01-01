'use client';

import { useRouter } from 'next/navigation';
import { useTransition, useState, useEffect } from 'react';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n';
import { Globe } from 'lucide-react';

function setLocaleCookie(locale: Locale) {
  document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`;
}

function getLocaleCookie(): Locale | null {
  const match = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
  return match ? (match[1] as Locale) : null;
}

export function LanguageSwitcher() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [currentLocale, setCurrentLocale] = useState<Locale>('en');

  useEffect(() => {
    const cookie = getLocaleCookie();
    if (cookie && locales.includes(cookie)) {
      setCurrentLocale(cookie);
    }
  }, []);

  const handleLocaleChange = (locale: Locale) => {
    setLocaleCookie(locale);
    setCurrentLocale(locale);
    setIsOpen(false);
    
    // Dispatch custom event so Providers can update the messages
    window.dispatchEvent(new CustomEvent('localeChange', { detail: locale }));
    
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
      >
        <Globe className="h-4 w-4" />
        <span className="text-sm">
          {localeFlags[currentLocale]} {localeNames[currentLocale]}
        </span>
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute right-0 mt-2 w-40 rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 z-20">
            <div className="py-1">
              {locales.map((locale) => (
                <button
                  key={locale}
                  onClick={() => handleLocaleChange(locale)}
                  className={`flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    currentLocale === locale 
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' 
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span>{localeFlags[locale]}</span>
                  <span>{localeNames[locale]}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Simple inline switcher for compact spaces
export function LanguageSwitcherCompact() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentLocale, setCurrentLocale] = useState<Locale>('en');

  useEffect(() => {
    const cookie = getLocaleCookie();
    if (cookie && locales.includes(cookie)) {
      setCurrentLocale(cookie);
    }
  }, []);

  const handleLocaleChange = (locale: Locale) => {
    setLocaleCookie(locale);
    setCurrentLocale(locale);
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-1">
      {locales.map((locale) => (
        <button
          key={locale}
          onClick={() => handleLocaleChange(locale)}
          disabled={isPending}
          className={`px-2 py-1 text-sm rounded transition-colors ${
            currentLocale === locale
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          title={localeNames[locale]}
        >
          {localeFlags[locale]}
        </button>
      ))}
    </div>
  );
}
