'use client';

/**
 * Error State Component
 * 
 * Consistent error display with retry functionality.
 * White-label safe: Uses CSS variables for theming.
 */

import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: Error | null;
  retry?: () => void;
  homeLink?: boolean;
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'We encountered an error while loading this content.',
  error,
  retry,
  homeLink = true,
}: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      {/* Error Icon */}
      <div 
        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{
          background: 'linear-gradient(135deg, var(--color-error)20 0%, transparent 100%)',
        }}
      >
        <AlertCircle 
          className="w-10 h-10"
          style={{ color: 'var(--color-error)' }}
        />
      </div>

      {/* Title */}
      <h3 
        className="text-xl font-semibold mb-2"
        style={{ color: 'var(--color-text)' }}
      >
        {title}
      </h3>

      {/* Description */}
      <p 
        className="max-w-md mb-2"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {description}
      </p>

      {/* Error Details (only in development) */}
      {error && process.env.NODE_ENV === 'development' && (
        <pre 
          className="mt-4 p-4 rounded-lg text-xs overflow-auto max-w-md"
          style={{ 
            background: 'var(--color-surface-secondary)',
            color: 'var(--color-error)',
          }}
        >
          {error.message}
          {error.stack && `\n\n${error.stack}`}
        </pre>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        {retry && (
          <Button
            onClick={retry}
            className="flex items-center gap-2"
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-text-on-primary)',
            }}
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>
        )}
        {homeLink && (
          <Link href="/">
            <Button variant="outline" className="flex items-center gap-2">
              <Home className="w-4 h-4" />
              Go Home
            </Button>
          </Link>
        )}
      </div>
    </motion.div>
  );
}

export default ErrorState;
