'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Palette,
  Upload,
  Eye,
  Save,
  RotateCcw,
  Globe,
  Mail,
  Phone,
  MapPin,
  Image as ImageIcon,
  Type,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Switch } from '@/components/ui/Switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/Form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Separator } from '@/components/ui/Separator';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

const brandingSchema = z.object({
  // Basic Info
  businessName: z.string().min(1, 'Business name is required').max(100),
  tagline: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  
  // Contact Info
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  address: z.string().max(300).optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  
  // Branding
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color'),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color'),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color'),
  
  // Typography
  headingFont: z.string().min(1),
  bodyFont: z.string().min(1),
  
  // Features
  showPoweredBy: z.boolean(),
  customDomain: z.string().optional(),
  
  // Social Media
  facebook: z.string().url().optional().or(z.literal('')),
  instagram: z.string().url().optional().or(z.literal('')),
  twitter: z.string().url().optional().or(z.literal('')),
  linkedin: z.string().url().optional().or(z.literal('')),
});

type BrandingFormData = z.infer<typeof brandingSchema>;

const FONT_OPTIONS = [
  { value: 'inter', label: 'Inter' },
  { value: 'roboto', label: 'Roboto' },
  { value: 'open-sans', label: 'Open Sans' },
  { value: 'lato', label: 'Lato' },
  { value: 'poppins', label: 'Poppins' },
  { value: 'montserrat', label: 'Montserrat' },
  { value: 'playfair-display', label: 'Playfair Display' },
  { value: 'merriweather', label: 'Merriweather' },
];

const DEFAULT_COLORS = {
  primary: '#0891b2',
  secondary: '#64748b',
  accent: '#f59e0b',
};

export default function AdminBrandingPage() {
  const t = useTranslations('admin.branding');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  const form = useForm<BrandingFormData>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      businessName: '',
      tagline: '',
      description: '',
      email: '',
      phone: '',
      address: '',
      website: '',
      primaryColor: DEFAULT_COLORS.primary,
      secondaryColor: DEFAULT_COLORS.secondary,
      accentColor: DEFAULT_COLORS.accent,
      headingFont: 'inter',
      bodyFont: 'inter',
      showPoweredBy: true,
      customDomain: '',
      facebook: '',
      instagram: '',
      twitter: '',
      linkedin: '',
    },
  });

  // Fetch current branding settings
  const fetchBranding = useCallback(async () => {
    try {
      const response = await api.get('/admin/branding');
      const data = response.data.data;
      
      form.reset({
        businessName: data.businessName || '',
        tagline: data.tagline || '',
        description: data.description || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
        website: data.website || '',
        primaryColor: data.primaryColor || DEFAULT_COLORS.primary,
        secondaryColor: data.secondaryColor || DEFAULT_COLORS.secondary,
        accentColor: data.accentColor || DEFAULT_COLORS.accent,
        headingFont: data.headingFont || 'inter',
        bodyFont: data.bodyFont || 'inter',
        showPoweredBy: data.showPoweredBy ?? true,
        customDomain: data.customDomain || '',
        facebook: data.facebook || '',
        instagram: data.instagram || '',
        twitter: data.twitter || '',
        linkedin: data.linkedin || '',
      });
      
      setLogoUrl(data.logoUrl || null);
      setFaviconUrl(data.faviconUrl || null);
    } catch (error) {
      console.error('Failed to fetch branding:', error);
      toast.error('Failed to load branding settings');
    } finally {
      setIsLoading(false);
    }
  }, [form]);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  // Handle logo upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo must be less than 5MB');
      return;
    }

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      
      const response = await api.post('/admin/branding/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      setLogoUrl(response.data.data.url);
      toast.success('Logo uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  // Handle favicon upload
  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setUploadingFavicon(true);
    try {
      const formData = new FormData();
      formData.append('favicon', file);
      
      const response = await api.post('/admin/branding/favicon', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      setFaviconUrl(response.data.data.url);
      toast.success('Favicon uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload favicon');
    } finally {
      setUploadingFavicon(false);
    }
  };

  // Save branding settings
  const onSubmit = async (data: BrandingFormData) => {
    setIsSaving(true);
    try {
      await api.put('/admin/branding', {
        ...data,
        logoUrl,
        faviconUrl,
      });
      
      toast.success('Branding settings saved successfully');
    } catch (error) {
      toast.error('Failed to save branding settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to defaults
  const handleReset = () => {
    form.reset({
      ...form.getValues(),
      primaryColor: DEFAULT_COLORS.primary,
      secondaryColor: DEFAULT_COLORS.secondary,
      accentColor: DEFAULT_COLORS.accent,
      headingFont: 'inter',
      bodyFont: 'inter',
    });
    toast.info('Colors and fonts reset to defaults');
  };

  const watchedColors = form.watch(['primaryColor', 'secondaryColor', 'accentColor']);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Branding & White Label</h1>
          <p className="text-muted-foreground mt-1">
            Customize the look and feel of your resort management system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPreviewMode(!previewMode)}
          >
            <Eye className="mr-2 h-4 w-4" />
            {previewMode ? 'Exit Preview' : 'Preview'}
          </Button>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset Colors
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Tabs defaultValue="identity" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="identity">Identity</TabsTrigger>
              <TabsTrigger value="colors">Colors & Fonts</TabsTrigger>
              <TabsTrigger value="contact">Contact Info</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="identity" className="space-y-6">
              {/* Logo & Favicon */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    Logo & Favicon
                  </CardTitle>
                  <CardDescription>
                    Upload your brand logo and favicon
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6">
                  {/* Logo Upload */}
                  <div className="space-y-4">
                    <Label>Logo</Label>
                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                      {logoUrl ? (
                        <div className="space-y-4">
                          <img
                            src={logoUrl}
                            alt="Logo"
                            className="max-h-24 mx-auto object-contain"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById('logo-upload')?.click()}
                            disabled={uploadingLogo}
                          >
                            {uploadingLogo ? 'Uploading...' : 'Change Logo'}
                          </Button>
                        </div>
                      ) : (
                        <div
                          className="cursor-pointer"
                          onClick={() => document.getElementById('logo-upload')?.click()}
                        >
                          <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                          <p className="mt-2 text-sm text-muted-foreground">
                            Click to upload logo
                          </p>
                          <p className="text-xs text-muted-foreground">
                            PNG, JPG up to 5MB
                          </p>
                        </div>
                      )}
                      <input
                        id="logo-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                    </div>
                  </div>

                  {/* Favicon Upload */}
                  <div className="space-y-4">
                    <Label>Favicon</Label>
                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                      {faviconUrl ? (
                        <div className="space-y-4">
                          <img
                            src={faviconUrl}
                            alt="Favicon"
                            className="h-16 w-16 mx-auto object-contain"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById('favicon-upload')?.click()}
                            disabled={uploadingFavicon}
                          >
                            {uploadingFavicon ? 'Uploading...' : 'Change Favicon'}
                          </Button>
                        </div>
                      ) : (
                        <div
                          className="cursor-pointer"
                          onClick={() => document.getElementById('favicon-upload')?.click()}
                        >
                          <Sparkles className="h-10 w-10 mx-auto text-muted-foreground" />
                          <p className="mt-2 text-sm text-muted-foreground">
                            Click to upload favicon
                          </p>
                          <p className="text-xs text-muted-foreground">
                            32x32 or 64x64 PNG
                          </p>
                        </div>
                      )}
                      <input
                        id="favicon-upload"
                        type="file"
                        accept="image/png,image/x-icon"
                        className="hidden"
                        onChange={handleFaviconUpload}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Business Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Type className="h-5 w-5" />
                    Business Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="businessName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Your Resort Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tagline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tagline</FormLabel>
                        <FormControl>
                          <Input placeholder="Your perfect getaway awaits" {...field} />
                        </FormControl>
                        <FormDescription>
                          A short slogan shown in headers and emails
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Brief description of your resort..."
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="colors" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Brand Colors
                  </CardTitle>
                  <CardDescription>
                    Choose colors that match your brand identity
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="primaryColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary Color</FormLabel>
                          <div className="flex gap-2">
                            <div
                              className="w-10 h-10 rounded-md border cursor-pointer"
                              style={{ backgroundColor: field.value }}
                              onClick={() => document.getElementById('primary-color')?.click()}
                            />
                            <FormControl>
                              <Input {...field} className="font-mono" />
                            </FormControl>
                            <input
                              id="primary-color"
                              type="color"
                              value={field.value}
                              onChange={(e) => field.onChange(e.target.value)}
                              className="sr-only"
                            />
                          </div>
                          <FormDescription>
                            Main brand color for buttons and links
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="secondaryColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Secondary Color</FormLabel>
                          <div className="flex gap-2">
                            <div
                              className="w-10 h-10 rounded-md border cursor-pointer"
                              style={{ backgroundColor: field.value }}
                              onClick={() => document.getElementById('secondary-color')?.click()}
                            />
                            <FormControl>
                              <Input {...field} className="font-mono" />
                            </FormControl>
                            <input
                              id="secondary-color"
                              type="color"
                              value={field.value}
                              onChange={(e) => field.onChange(e.target.value)}
                              className="sr-only"
                            />
                          </div>
                          <FormDescription>
                            Used for secondary elements
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="accentColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Accent Color</FormLabel>
                          <div className="flex gap-2">
                            <div
                              className="w-10 h-10 rounded-md border cursor-pointer"
                              style={{ backgroundColor: field.value }}
                              onClick={() => document.getElementById('accent-color')?.click()}
                            />
                            <FormControl>
                              <Input {...field} className="font-mono" />
                            </FormControl>
                            <input
                              id="accent-color"
                              type="color"
                              value={field.value}
                              onChange={(e) => field.onChange(e.target.value)}
                              className="sr-only"
                            />
                          </div>
                          <FormDescription>
                            Highlights and notifications
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Color Preview */}
                  <Separator />
                  <div>
                    <Label className="mb-3 block">Preview</Label>
                    <div className="p-4 border rounded-lg space-y-4">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          style={{ backgroundColor: watchedColors[0] }}
                        >
                          Primary Button
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          style={{
                            borderColor: watchedColors[1],
                            color: watchedColors[1],
                          }}
                        >
                          Secondary Button
                        </Button>
                        <div
                          className="px-3 py-2 rounded text-white text-sm"
                          style={{ backgroundColor: watchedColors[2] }}
                        >
                          Accent Badge
                        </div>
                      </div>
                      <div
                        className="h-2 rounded-full"
                        style={{
                          background: `linear-gradient(to right, ${watchedColors[0]}, ${watchedColors[1]}, ${watchedColors[2]})`,
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Typography */}
              <Card>
                <CardHeader>
                  <CardTitle>Typography</CardTitle>
                  <CardDescription>
                    Choose fonts for headings and body text
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="headingFont"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Heading Font</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {FONT_OPTIONS.map((font) => (
                              <SelectItem key={font.value} value={font.value}>
                                {font.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bodyFont"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Body Font</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {FONT_OPTIONS.map((font) => (
                              <SelectItem key={font.value} value={font.value}>
                                {font.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contact" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Contact Information
                  </CardTitle>
                  <CardDescription>
                    Information displayed in emails and footer
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="contact@resort.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="+1 234 567 8900" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="123 Resort Way, Beach City, BC 12345"
                            rows={2}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://www.yourresort.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Social Media */}
              <Card>
                <CardHeader>
                  <CardTitle>Social Media</CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="facebook"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Facebook</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://facebook.com/yourresort"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="instagram"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Instagram</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://instagram.com/yourresort"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="twitter"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Twitter / X</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://twitter.com/yourresort"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="linkedin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>LinkedIn</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://linkedin.com/company/yourresort"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    White Label Settings
                  </CardTitle>
                  <CardDescription>
                    Advanced customization options
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="showPoweredBy"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Show "Powered By" Footer
                          </FormLabel>
                          <FormDescription>
                            Display V2 Resort attribution in the footer
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customDomain"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom Domain</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="booking.yourresort.com"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Contact support to configure a custom domain
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Save Button */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
            >
              Discard Changes
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
