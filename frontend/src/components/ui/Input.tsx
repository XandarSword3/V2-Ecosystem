'use client';

import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  helperText?: string;
  variant?: 'default' | 'glass' | 'filled';
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, helperText, variant = 'default', ...props }, ref) => {
    const variants = {
      default: cn(
        'bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg',
        'border-slate-200/60 dark:border-slate-700/40',
        'hover:bg-white/90 dark:hover:bg-slate-800/90',
        'hover:border-slate-300/80 dark:hover:border-slate-600/60',
        'focus:bg-white dark:focus:bg-slate-800',
        'focus:border-primary-400 dark:focus:border-primary-500'
      ),
      glass: cn(
        'bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl',
        'border-white/30 dark:border-slate-700/30',
        'hover:bg-white/60 dark:hover:bg-slate-800/60',
        'hover:border-white/50 dark:hover:border-slate-600/50',
        'focus:bg-white/70 dark:focus:bg-slate-800/70',
        'focus:border-primary-400/60 dark:focus:border-primary-500/60'
      ),
      filled: cn(
        'bg-slate-100 dark:bg-slate-800',
        'border-transparent',
        'hover:bg-slate-200/80 dark:hover:bg-slate-700/80',
        'focus:bg-white dark:focus:bg-slate-700',
        'focus:border-primary-400 dark:focus:border-primary-500'
      ),
    };

    return (
      <div className="w-full group">
        <input
          type={type}
          className={cn(
            'flex h-11 w-full rounded-xl border-2 px-4 py-2.5 text-sm',
            'text-slate-900 dark:text-white',
            'placeholder:text-slate-400/80 dark:placeholder:text-slate-500/80',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            'focus:ring-primary-500/30 focus:shadow-lg focus:shadow-primary-500/10',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'shadow-sm shadow-slate-900/5',
            'transition-all duration-300 ease-out',
            variants[variant],
            error && 'border-red-400/50 focus:ring-red-500/30 focus:border-red-400 focus:shadow-red-500/10',
            className
          )}
          ref={ref}
          {...props}
        />
        {helperText && (
          <p className={cn(
            'mt-1.5 text-sm transition-colors duration-200',
            error ? 'text-red-500' : 'text-slate-500/80 dark:text-slate-400/80'
          )}>
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
