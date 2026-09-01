'use client';

import React, { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/layout/Container';

export default function ModuleErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  const tCommon = useTranslations('common');

  useEffect(() => {
    console.error('Module segment error caught:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-background py-16">
      <Container size="sm" className="text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">
          {t('somethingWentWrong') || 'Something went wrong'}
        </h1>
        <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">
          {error.message || t('unexpectedErrorOccurred') || 'An unexpected error occurred while loading this service.'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => reset()} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            {tCommon('tryAgain') || 'Try Again'}
          </Button>
          <Button onClick={() => { window.location.href = '/'; }} className="gap-2">
            <Home className="w-4 h-4" />
            {tCommon('returnHome') || 'Return Home'}
          </Button>
        </div>
      </Container>
    </div>
  );
}
