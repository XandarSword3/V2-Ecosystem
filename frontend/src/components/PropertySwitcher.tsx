'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useProperty } from '@/context/PropertyContext';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';

export function PropertySwitcher() {
  const { properties, activePropertyId, activeProperty, setActiveProperty, loading } = useProperty();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading || !activeProperty) {
    return (
      <div className="animate-pulse bg-slate-200 dark:bg-slate-700 h-9 w-40 rounded-lg"></div>
    );
  }

  // If only one property, just show the name
  if (properties.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300">
        <Building2 className="w-4 h-4" />
        <span className="truncate max-w-[150px]">{activeProperty.name}</span>
      </div>
    );
  }

  return (
    <div className="relative z-[150]" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors shadow-sm"
      >
        <Building2 className="w-4 h-4 text-blue-500" />
        <span className="truncate max-w-[150px]">{activeProperty.name}</span>
        <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden flex flex-col"
          >
            <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Switch Property</p>
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {properties.map((access) => (
                <button
                  key={access.property_id}
                  onClick={() => {
                    setActiveProperty(access.property_id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 text-left text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors",
                    activePropertyId === access.property_id ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-300"
                  )}
                >
                  <div className="flex flex-col">
                    <span className="font-medium truncate">{access.property.name}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">{access.access_level} access</span>
                  </div>
                  {activePropertyId === access.property_id && (
                    <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
