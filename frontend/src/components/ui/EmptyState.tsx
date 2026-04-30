'use client';

/**
 * Empty State Component
 * 
 * Consistent empty state display across all pages.
 * White-label safe: Uses CSS variables for theming.
 */

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    href?: string;
  };
  secondaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action,
  secondaryAction 
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      {/* Icon Container */}
      <div 
        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{
          background: 'linear-gradient(135deg, var(--color-primary)20 0%, var(--color-secondary)20 100%)',
        }}
      >
        <Icon 
          className="w-10 h-10"
          style={{ color: 'var(--color-primary)' }}
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
        className="max-w-md mb-6"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {description}
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        {action && (
          <Button
            onClick={action.onClick}
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-text-on-primary)',
            }}
          >
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <Button
            variant="outline"
            onClick={secondaryAction.onClick}
          >
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export default EmptyState;
