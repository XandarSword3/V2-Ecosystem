'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';

interface TurnstileCaptchaProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  action?: string;
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        params: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          action?: string;
          theme?: string;
        }
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

const SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const SCRIPT_TIMEOUT_MS = 10_000;

function ensureTurnstileLoaded(): Promise<void> {
  if (typeof window !== 'undefined' && window.turnstile) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const startedAt = Date.now();

    const cleanup = () => {
      script?.removeEventListener('load', checkReady);
      script?.removeEventListener('error', handleError);
      window.clearInterval(pollId);
      window.clearTimeout(timeoutId);
    };

    const handleError = () => {
      cleanup();
      reject(new Error('Turnstile script failed to load'));
    };

    const checkReady = () => {
      if (window.turnstile) {
        cleanup();
        resolve();
      } else if (Date.now() - startedAt >= SCRIPT_TIMEOUT_MS) {
        cleanup();
        reject(new Error('Turnstile script timed out'));
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    script.addEventListener('load', checkReady);
    script.addEventListener('error', handleError);

    const pollId = window.setInterval(checkReady, 100);
    const timeoutId = window.setTimeout(checkReady, SCRIPT_TIMEOUT_MS);
    checkReady();
  });
}

export function TurnstileCaptcha({
  onVerify,
  onError,
  onExpire,
  action = 'login',
  theme = 'auto',
  className = '',
}: TurnstileCaptchaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onVerifyRef = useRef(onVerify);
  const onErrorRef = useRef(onError);
  const onExpireRef = useRef(onExpire);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

  useEffect(() => {
    onVerifyRef.current = onVerify;
    onErrorRef.current = onError;
    onExpireRef.current = onExpire;
  }, [onVerify, onError, onExpire]);

  useEffect(() => {
    let active = true;

    if (!siteKey) {
      setLoadError('Turnstile site key is not configured.');
      onErrorRef.current?.();
      return () => {
        active = false;
      };
    }

    ensureTurnstileLoaded()
      .then(() => {
        if (active) setScriptLoaded(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : 'Turnstile is unavailable');
        onErrorRef.current?.();
      });

    return () => {
      active = false;
    };
  }, [siteKey]);

  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || !window.turnstile) return;

    try {
      if (widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
      }

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => onVerifyRef.current(token),
        'error-callback': () => onErrorRef.current?.(),
        'expired-callback': () => onExpireRef.current?.(),
        action,
        theme,
      });
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'Turnstile failed to render');
      onErrorRef.current?.();
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Ignore removal errors during unmount.
        }
        widgetIdRef.current = null;
      }
    };
  }, [action, scriptLoaded, siteKey, theme]);

  return (
    <div className={`turnstile-wrapper my-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          Security Verification
        </span>
        <span className="text-[10px] text-slate-400">Protected by Turnstile</span>
      </div>

      {loadError ? (
        <p className="text-xs text-red-600 dark:text-red-400">
          Security verification is unavailable. Check the Turnstile site key and network access.
        </p>
      ) : (
        <div ref={containerRef} className="min-h-[65px] flex items-center justify-center">
          {!scriptLoaded && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading security challenge...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TurnstileCaptcha;
