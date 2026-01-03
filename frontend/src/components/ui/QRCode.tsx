'use client';

import { QRCodeCanvas } from 'qrcode.react';
import { useEffect, useState } from 'react';

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRCode({ value, size = 128, className }: QRCodeProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div style={{ width: size, height: size }} className="bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />;
  }

  return (
    <div className={`bg-white p-2 rounded-lg inline-block ${className}`}>
      <QRCodeCanvas
        value={value}
        size={size}
        level="H"
        includeMargin={true}
      />
    </div>
  );
}
