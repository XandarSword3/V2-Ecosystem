'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Mail, Send, CheckCircle, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/Form';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

// Validation schema
const emailConfigSchema = z.object({
  provider: z.enum(['smtp', 'sendgrid', 'ses', 'mailgun', 'postmark']),
  smtpHost: z.string().optional(),
  smtpPort: z.number().min(1).max(65535).optional(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  apiKey: z.string().optional(),
  fromEmail: z.string().email('Valid email required'),
  fromName: z.string().min(1, 'Sender name required'),
  replyToEmail: z.string().email().optional().or(z.literal('')),
}).superRefine((data, ctx) => {
  if (data.provider === 'smtp') {
    if (!data.smtpHost) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SMTP host is required',
        path: ['smtpHost'],
      });
    }
    if (!data.smtpPort) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SMTP port is required',
        path: ['smtpPort'],
      });
    }
  } else {
    if (!data.apiKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'API key is required for this provider',
        path: ['apiKey'],
      });
    }
  }
});

type EmailConfig = z.infer<typeof emailConfigSchema>;

interface TestResult {
  success: boolean;
  message: string;
  timestamp: Date;
}

export default function EmailConfigurationPage() {
  const t = useTranslations('admin.settings');
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const form = useForm<EmailConfig>({
    resolver: zodResolver(emailConfigSchema),
    defaultValues: {
      provider: 'smtp',
      smtpHost: '',
      smtpPort: 587,
      smtpSecure: true,
      smtpUser: '',
      smtpPassword: '',
      apiKey: '',
      fromEmail: '',
      fromName: 'V2 Resort',
      replyToEmail: '',
    },
  });

  const provider = form.watch('provider');

  const onSubmit = async (data: EmailConfig) => {
    setIsLoading(true);
    try {
      await api.put('/admin/settings/email', data);
      toast.success('Email configuration saved successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save email configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestEmail = async () => {
    const values = form.getValues();
    const validation = emailConfigSchema.safeParse(values);
    
    if (!validation.success) {
      toast.error('Please fill in all required fields before testing');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await api.post('/admin/settings/email/test', {
        ...values,
        testRecipient: values.fromEmail, // Send test to configured from address
      });

      setTestResult({
        success: true,
        message: 'Test email sent successfully! Check your inbox.',
        timestamp: new Date(),
      });
      toast.success('Test email sent successfully');
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || 'Failed to send test email',
        timestamp: new Date(),
      });
      toast.error('Failed to send test email');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Mail className="h-8 w-8" />
          Email Configuration
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure your email service provider for sending transactional emails.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Provider Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Email Provider</CardTitle>
              <CardDescription>
                Select your email service provider
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a provider" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="smtp">SMTP Server</SelectItem>
                        <SelectItem value="sendgrid">SendGrid</SelectItem>
                        <SelectItem value="ses">Amazon SES</SelectItem>
                        <SelectItem value="mailgun">Mailgun</SelectItem>
                        <SelectItem value="postmark">Postmark</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose how emails will be sent from the system
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* SMTP Configuration */}
          {provider === 'smtp' && (
            <Card>
              <CardHeader>
                <CardTitle>SMTP Settings</CardTitle>
                <CardDescription>
                  Configure your SMTP server connection
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="smtpHost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP Host</FormLabel>
                        <FormControl>
                          <Input placeholder="smtp.example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="smtpPort"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP Port</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="587"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>Common: 587 (TLS), 465 (SSL), 25</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="smtpUser"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SMTP Username</FormLabel>
                      <FormControl>
                        <Input placeholder="your-username" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="smtpPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SMTP Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* API Key Configuration for other providers */}
          {provider !== 'smtp' && (
            <Card>
              <CardHeader>
                <CardTitle>{provider.charAt(0).toUpperCase() + provider.slice(1)} Settings</CardTitle>
                <CardDescription>
                  Enter your {provider} API credentials
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="apiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Key</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showApiKey ? 'text' : 'password'}
                            placeholder="Enter your API key"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowApiKey(!showApiKey)}
                          >
                            {showApiKey ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Your {provider} API key for authentication
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Sender Information */}
          <Card>
            <CardHeader>
              <CardTitle>Sender Information</CardTitle>
              <CardDescription>
                Configure how emails appear to recipients
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fromEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="noreply@resort.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fromName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From Name</FormLabel>
                      <FormControl>
                        <Input placeholder="V2 Resort" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="replyToEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reply-To Email (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="support@resort.com"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Where replies should be sent (if different from From address)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Test Result */}
          {testResult && (
            <Card className={testResult.success ? 'border-green-500' : 'border-red-500'}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  {testResult.success ? (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-500" />
                  )}
                  <div>
                    <p className="font-medium">
                      {testResult.success ? 'Test Successful' : 'Test Failed'}
                    </p>
                    <p className="text-sm text-muted-foreground">{testResult.message}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestEmail}
              disabled={isTesting || isLoading}
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Test Email
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Save Configuration
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
