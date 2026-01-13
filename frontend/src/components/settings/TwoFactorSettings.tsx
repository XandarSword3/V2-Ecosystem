'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  KeyRound,
  Smartphone,
} from 'lucide-react';

interface TwoFactorStatus {
  enabled: boolean;
  enabledAt?: string;
  backupCodesRemaining?: number;
}

interface SetupData {
  qrCodeDataUrl: string;
  secret: string;
  backupCodes: string[];
}

export function TwoFactorSettings() {
  const t = useTranslations('profile');
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<'status' | 'setup' | 'verify' | 'backup' | 'disable'>('status');

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await authApi.get2FAStatus();
      setStatus(response.data.data);
    } catch {
      // 2FA not set up yet
      setStatus({ enabled: false });
    } finally {
      setLoading(false);
    }
  };

  const startSetup = async () => {
    setProcessing(true);
    try {
      const response = await authApi.setup2FA();
      setSetupData(response.data.data);
      setStep('setup');
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'Failed to initialize 2FA setup');
    } finally {
      setProcessing(false);
    }
  };

  const enableTwoFactor = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }
    
    setProcessing(true);
    try {
      const response = await authApi.enable2FA(verificationCode);
      setBackupCodes(response.data.data?.backupCodes || setupData?.backupCodes || []);
      setStep('backup');
      toast.success('Two-factor authentication enabled!');
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'Invalid verification code');
    } finally {
      setProcessing(false);
    }
  };

  const disableTwoFactor = async () => {
    if (!disableCode || disableCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }
    
    setProcessing(true);
    try {
      await authApi.disable2FA(disableCode);
      setStatus({ enabled: false });
      setStep('status');
      setDisableCode('');
      toast.success('Two-factor authentication disabled');
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'Invalid verification code');
    } finally {
      setProcessing(false);
    }
  };

  const copyBackupCodes = () => {
    const codes = backupCodes.join('\n');
    navigator.clipboard.writeText(codes);
    setCopied(true);
    toast.success('Backup codes copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const finishSetup = () => {
    setStep('status');
    setSetupData(null);
    setVerificationCode('');
    setBackupCodes([]);
    fetchStatus();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          {t('twoFactor.title') || 'Two-Factor Authentication'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status View */}
        {step === 'status' && (
          <>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
              {status?.enabled ? (
                <>
                  <ShieldCheck className="w-8 h-8 text-green-500" />
                  <div className="flex-1">
                    <p className="font-medium text-green-700 dark:text-green-400">
                      {t('twoFactor.enabled') || '2FA is enabled'}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {t('twoFactor.enabledDesc') || 'Your account is protected with two-factor authentication'}
                    </p>
                    {status.backupCodesRemaining !== undefined && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        <KeyRound className="w-3 h-3 inline mr-1" />
                        {status.backupCodesRemaining} backup codes remaining
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <ShieldOff className="w-8 h-8 text-slate-400" />
                  <div className="flex-1">
                    <p className="font-medium text-slate-700 dark:text-slate-300">
                      {t('twoFactor.disabled') || '2FA is not enabled'}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {t('twoFactor.disabledDesc') || 'Add an extra layer of security to your account'}
                    </p>
                  </div>
                </>
              )}
            </div>

            {status?.enabled ? (
              <Button
                variant="danger"
                onClick={() => setStep('disable')}
                className="w-full"
              >
                <ShieldOff className="w-4 h-4 mr-2" />
                {t('twoFactor.disable') || 'Disable 2FA'}
              </Button>
            ) : (
              <Button
                onClick={startSetup}
                disabled={processing}
                className="w-full"
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4 mr-2" />
                )}
                {t('twoFactor.enable') || 'Enable 2FA'}
              </Button>
            )}
          </>
        )}

        {/* Setup View */}
        {step === 'setup' && setupData && (
          <div className="space-y-4">
            <div className="text-center">
              <Smartphone className="w-12 h-12 mx-auto text-blue-500 mb-2" />
              <h3 className="font-medium text-lg">
                {t('twoFactor.scanQR') || 'Scan QR Code'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('twoFactor.scanQRDesc') || 'Use Google Authenticator, Authy, or similar app'}
              </p>
            </div>

            <div className="flex justify-center p-4 bg-white rounded-lg">
              <img
                src={setupData.qrCodeDataUrl}
                alt="2FA QR Code"
                className="w-48 h-48"
              />
            </div>

            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                {t('twoFactor.manualEntry') || "Can't scan? Enter this code manually:"}
              </p>
              <code className="text-sm font-mono break-all">{setupData.secret}</code>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('twoFactor.enterCode') || 'Enter the 6-digit code from your app'}
              </label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStep('status');
                  setSetupData(null);
                  setVerificationCode('');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={enableTwoFactor}
                disabled={processing || verificationCode.length !== 6}
                className="flex-1"
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Verify & Enable
              </Button>
            </div>
          </div>
        )}

        {/* Backup Codes View */}
        {step === 'backup' && (
          <div className="space-y-4">
            <div className="text-center">
              <ShieldCheck className="w-12 h-12 mx-auto text-green-500 mb-2" />
              <h3 className="font-medium text-lg text-green-700 dark:text-green-400">
                {t('twoFactor.setupComplete') || '2FA Enabled Successfully!'}
              </h3>
            </div>

            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-400">
                    {t('twoFactor.saveBackupCodes') || 'Save your backup codes'}
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-500 mt-1">
                    {t('twoFactor.saveBackupCodesDesc') || 
                      "These codes can be used if you lose access to your authenticator app. Each code can only be used once."}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg font-mono text-sm">
              {backupCodes.map((code, index) => (
                <div key={index} className="p-2 bg-white dark:bg-slate-700 rounded text-center">
                  {code}
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              onClick={copyBackupCodes}
              className="w-full"
            >
              {copied ? (
                <Check className="w-4 h-4 mr-2" />
              ) : (
                <Copy className="w-4 h-4 mr-2" />
              )}
              {copied ? 'Copied!' : 'Copy all codes'}
            </Button>

            <Button onClick={finishSetup} className="w-full">
              I've saved my codes
            </Button>
          </div>
        )}

        {/* Disable View */}
        {step === 'disable' && (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800 dark:text-red-400">
                    {t('twoFactor.disableWarning') || 'Warning'}
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-500 mt-1">
                    {t('twoFactor.disableWarningDesc') || 
                      'Disabling 2FA will make your account less secure. You will only need your password to log in.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('twoFactor.enterCodeToDisable') || 'Enter your 2FA code to confirm'}
              </label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStep('status');
                  setDisableCode('');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={disableTwoFactor}
                disabled={processing || disableCode.length !== 6}
                className="flex-1"
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ShieldOff className="w-4 h-4 mr-2" />
                )}
                Disable 2FA
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
