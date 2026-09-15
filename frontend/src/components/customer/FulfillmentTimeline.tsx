'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { FulfillmentMode, FulfillmentState } from '@/lib/engine-a/types';
import { statesForMode, getModeStateConfig } from '@/lib/engine-a/types';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  ChefHat,
  Package,
  Truck,
  Download,
  Store,
  Check,
} from 'lucide-react';

export interface FulfillmentTimelineProps {
  mode: FulfillmentMode;
  currentState: string | null | undefined;
  isCancelled?: boolean;
  isCompleted?: boolean;
  estimatedReadyTime?: string | null;
  className?: string;
}

/** Contextual human-readable descriptions for each state in each mode. */
const STEP_DESCRIPTIONS: Record<string, string> = {
  // Hospitality
  queued: 'Order received and waiting in queue',
  in_progress: 'Being prepared fresh right now',
  ready: 'Order is ready for collection / service',
  handed_off: 'Order successfully fulfilled and served',

  // Digital
  provisioning: 'Generating digital licenses & assets',
  provisioned: 'Assets ready in your account',
  delivered: 'Digital access successfully delivered',

  // Shipment
  allocated: 'Inventory reserved at warehouse',
  picking: 'Items being picked from inventory',
  packed: 'Package safely packed and labeled',
  shipped: 'Handed to courier carrier',
  in_transit: 'On the way to your destination',

  // Service
  received: 'Appointment checked in',
  working: 'Service currently in progress',
  collected: 'Service completed successfully',
};

/**
 * FulfillmentTimeline — Visual Multi-Step Fulfillment Progress Tracker (Plan F7).
 *
 * Exposes canonical fulfillment state transitions to the customer.
 * Dynamically derives steps and transitions from `statesForMode(mode)`,
 * never hardcoding restaurant vertical assumptions.
 */
export function FulfillmentTimeline({
  mode,
  currentState,
  isCancelled = false,
  isCompleted = false,
  estimatedReadyTime,
  className = '',
}: FulfillmentTimelineProps) {
  const t = useTranslations('checkout');

  if (mode === 'none') {
    return null;
  }

  const steps = statesForMode(mode);
  if (steps.length === 0) {
    return null;
  }

  const modeConfig = getModeStateConfig(mode);

  // Normalize state and find active step index
  const normalizedCurrent = (currentState || '').toLowerCase() as FulfillmentState;
  const terminalStates = ['handed_off', 'delivered', 'collected', 'completed'];
  const hasFinished = isCompleted || terminalStates.includes(normalizedCurrent);

  let activeIndex = steps.indexOf(normalizedCurrent);
  if (activeIndex === -1) {
    if (hasFinished) {
      activeIndex = steps.length - 1;
    } else {
      activeIndex = 0; // Default to first step if pending
    }
  }

  if (isCancelled) {
    return (
      <div
        className={`p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive space-y-2 ${className}`}
        data-testid="fulfillment-timeline-cancelled"
        role="region"
        aria-label="Order fulfillment cancelled"
      >
        <div className="flex items-center gap-2 font-semibold text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Order Fulfillment Cancelled</span>
        </div>
        <p className="text-xs opacity-90">
          This order has been cancelled and fulfillment activity has been stopped.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`p-5 rounded-2xl bg-card border border-border/60 shadow-sm space-y-5 ${className}`}
      data-testid="fulfillment-timeline"
      role="region"
      aria-label="Order fulfillment progress"
      aria-live="polite"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-foreground">
          {t('orderTracking') || 'Live Order Progress'}
        </h4>
        {estimatedReadyTime && !hasFinished && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5" />
            <span>Ready ~{estimatedReadyTime}</span>
          </div>
        )}
        {hasFinished && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Completed</span>
          </div>
        )}
      </div>

      {/* Steps Progress Row */}
      <div className="relative">
        <div className="flex items-center justify-between">
          {steps.map((step, idx) => {
            const isStepPast = hasFinished || idx < activeIndex;
            const isStepCurrent = !hasFinished && idx === activeIndex;
            const isStepUpcoming = !hasFinished && idx > activeIndex;

            const stepMeta = modeConfig?.metadata[step];
            const stepLabel = stepMeta?.label || step.replace('_', ' ');

            return (
              <React.Fragment key={step}>
                {/* Node */}
                <div
                  className="flex flex-col items-center relative z-10 text-center flex-1"
                  data-testid={`timeline-step-${step}`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 font-semibold text-xs ${
                      isStepPast
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                        : isStepCurrent
                        ? 'bg-primary-600 text-white ring-4 ring-primary-500/20 shadow-lg shadow-primary-500/30 animate-pulse'
                        : 'bg-muted text-muted-foreground border-2 border-border/80'
                    }`}
                  >
                    {isStepPast ? (
                      <Check className="w-4 h-4 stroke-[3]" />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>
                  <span
                    className={`mt-2 text-xs font-semibold capitalize max-w-[80px] leading-tight ${
                      isStepPast
                        ? 'text-foreground'
                        : isStepCurrent
                        ? 'text-primary-600 dark:text-primary-400 font-bold'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {stepLabel}
                  </span>
                </div>

                {/* Connecting Line between nodes */}
                {idx < steps.length - 1 && (
                  <div
                    className={`h-1 flex-1 -mt-6 transition-all duration-300 ${
                      hasFinished || idx < activeIndex
                        ? 'bg-emerald-600'
                        : idx === activeIndex - 1 && !hasFinished
                        ? 'bg-primary-500/80'
                        : 'bg-muted-foreground/20'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Current Step Description Card */}
      <div
        className="p-3.5 rounded-xl bg-muted/40 border border-border/40 text-xs text-foreground flex items-center justify-between"
        data-testid="timeline-current-status-description"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-primary-600 animate-ping shrink-0" />
          <span className="font-medium">
            {hasFinished
              ? 'Order completed. Thank you for your business!'
              : STEP_DESCRIPTIONS[steps[activeIndex]] || `Currently in ${steps[activeIndex].replace('_', ' ')}`}
          </span>
        </div>
      </div>
    </div>
  );
}

export default FulfillmentTimeline;
