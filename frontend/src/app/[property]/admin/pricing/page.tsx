'use client';

/**
 * F11 — Pricing capability page.
 *
 * Canonical home for the property-wide pricing configuration surfaces:
 *   - Seasonal pricing rules (CRUD via /pricing/seasonal-rules)
 *   - Dynamic pricing configuration (GET/PUT /pricing/dynamic-config)
 *
 * This page MIGRATES the legacy /[slug]/admin/settings/pricing surface
 * (orphaned: no navigation linked to it, and its API calls pointed at
 * /admin/pricing/* which was never mounted). API paths here target the
 * real backend mount: apiRouter.use('/pricing', pricing.controller).
 */

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Calendar,
  TrendingUp,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/Switch';
import { Badge } from '@/components/ui/Badge';
import { Slider } from '@/components/ui/Slider';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/Dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/Form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { Checkbox } from '@/components/ui/Checkbox';
import { Separator } from '@/components/ui/Separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { api } from '@/lib/api';
import { CardSkeleton } from '@/components/ui/Skeleton';

const seasonalRuleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  startDate: z.string().regex(/^\d{2}-\d{2}$/, 'Use MM-DD format'),
  endDate: z.string().regex(/^\d{2}-\d{2}$/, 'Use MM-DD format'),
  priceMultiplier: z.number().min(0.1).max(3),
  applicableTo: z.array(z.string()).min(1, 'Select at least one module'),
  priority: z.number().min(0).max(100),
  isActive: z.boolean(),
});

type SeasonalRuleFormData = z.infer<typeof seasonalRuleSchema>;

interface SeasonalRule {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  priceMultiplier: number;
  applicableTo: string[];
  priority: number;
  isActive: boolean;
}

interface DynamicPricingConfig {
  enabled: boolean;
  minOccupancyThreshold: number;
  maxOccupancyThreshold: number;
  minPriceMultiplier: number;
  maxPriceMultiplier: number;
  advanceBookingDays: number;
  earlyBirdDiscount: number;
  lastMinuteDays: number;
  lastMinutePremium: number;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export default function AdminPricingCapabilityPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [rules, setRules] = useState<SeasonalRule[]>([]);
  const [modules, setModules] = useState<{ value: string; label: string }[]>([]);
  const [dynamicConfig, setDynamicConfig] = useState<DynamicPricingConfig>({
    enabled: false,
    minOccupancyThreshold: 30,
    maxOccupancyThreshold: 80,
    minPriceMultiplier: 0.85,
    maxPriceMultiplier: 1.25,
    advanceBookingDays: 30,
    earlyBirdDiscount: 0.1,
    lastMinuteDays: 3,
    lastMinutePremium: 0,
  });
  const [editingRule, setEditingRule] = useState<SeasonalRule | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSavingDynamic, setIsSavingDynamic] = useState(false);

  const form = useForm<SeasonalRuleFormData>({
    resolver: zodResolver(seasonalRuleSchema),
    defaultValues: {
      name: '',
      startDate: '',
      endDate: '',
      priceMultiplier: 1,
      applicableTo: [],
      priority: 5,
      isActive: true,
    },
  });

  const fetchData = useCallback(async () => {
    try {
      const [rulesRes, configRes, modulesRes] = await Promise.all([
        api.get('/pricing/seasonal-rules'),
        api.get('/pricing/dynamic-config'),
        api.get('/admin/modules').catch(() => ({ data: { data: [] } })),
      ]);
      setRules(rulesRes.data.data);
      setDynamicConfig((prev) => ({ ...prev, ...configRes.data.data }));
      const mods = (modulesRes.data.data || []) as { id: string; name: string; slug: string; is_active: boolean }[];
      setModules(mods.filter((m) => m.is_active).map((m) => ({ value: m.slug, label: m.name })));
    } catch (error) {
      console.error('Failed to fetch pricing data:', error);
      toast.error('Failed to load pricing settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onSubmitRule = async (data: SeasonalRuleFormData) => {
    try {
      if (editingRule) {
        await api.put(`/pricing/seasonal-rules/${editingRule.id}`, data);
        toast.success('Rule updated successfully');
      } else {
        await api.post('/pricing/seasonal-rules', data);
        toast.success('Rule created successfully');
      }
      setIsDialogOpen(false);
      setEditingRule(null);
      form.reset();
      fetchData();
    } catch {
      toast.error('Failed to save rule');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      await api.delete(`/pricing/seasonal-rules/${ruleId}`);
      toast.success('Rule deleted successfully');
      fetchData();
    } catch {
      toast.error('Failed to delete rule');
    }
  };

  const handleEditRule = (rule: SeasonalRule) => {
    setEditingRule(rule);
    form.reset({
      name: rule.name,
      startDate: rule.startDate,
      endDate: rule.endDate,
      priceMultiplier: rule.priceMultiplier,
      applicableTo: rule.applicableTo,
      priority: rule.priority,
      isActive: rule.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSaveDynamicConfig = async () => {
    setIsSavingDynamic(true);
    try {
      await api.put('/pricing/dynamic-config', dynamicConfig);
      toast.success('Dynamic pricing settings saved');
    } catch {
      toast.error('Failed to save dynamic pricing settings');
    } finally {
      setIsSavingDynamic(false);
    }
  };

  const getDateLabel = (date: string) => {
    const [month, day] = date.split('-').map(Number);
    return `${MONTHS[month - 1]} ${day}`;
  };

  const getMultiplierColor = (multiplier: number) => {
    if (multiplier > 1) return 'bg-red-100 text-red-700';
    if (multiplier < 1) return 'bg-green-100 text-green-700';
    return 'bg-gray-100 text-gray-700';
  };

  const moduleLabel = (slug: string) =>
    modules.find((m) => m.value === slug)?.label || slug;

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-6 h-6" />
          Seasonal &amp; Dynamic Pricing
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Property-wide pricing rules. The backend pricing engine is the sole
          authority — these rules feed it.
        </p>
      </div>

      <Tabs defaultValue="seasonal" className="space-y-6">
        <TabsList>
          <TabsTrigger value="seasonal" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Seasonal Rules
          </TabsTrigger>
          <TabsTrigger value="dynamic" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Dynamic Pricing
          </TabsTrigger>
        </TabsList>

        {/* Seasonal Rules Tab */}
        <TabsContent value="seasonal" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Seasonal Pricing Rules</CardTitle>
                <CardDescription>
                  Define price adjustments for specific date ranges
                </CardDescription>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) {
                  setEditingRule(null);
                  form.reset();
                }
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Rule
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {editingRule ? 'Edit Rule' : 'Add Seasonal Rule'}
                    </DialogTitle>
                    <DialogDescription>
                      Configure a price adjustment for a specific period
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmitRule)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rule Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Summer Peak" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="startDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Start (MM-DD)</FormLabel>
                              <FormControl>
                                <Input placeholder="06-01" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="endDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>End (MM-DD)</FormLabel>
                              <FormControl>
                                <Input placeholder="09-15" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="priceMultiplier"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Price Multiplier</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.05"
                                min="0.1"
                                max="3"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="applicableTo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Applies To (Modules)</FormLabel>
                            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded-md p-2">
                              {modules.length === 0 && (
                                <p className="text-xs text-slate-400 col-span-2">
                                  No active modules
                                </p>
                              )}
                              {modules.map((m) => (
                                <label key={m.value} className="flex items-center gap-2 text-sm">
                                  <Checkbox
                                    checked={field.value.includes(m.value)}
                                    onCheckedChange={(checked) => {
                                      const next = checked
                                        ? [...field.value, m.value]
                                        : field.value.filter((v) => v !== m.value);
                                      field.onChange(next);
                                    }}
                                  />
                                  {m.label}
                                </label>
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4 items-center">
                        <FormField
                          control={form.control}
                          name="priority"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Priority</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="isActive"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2 pt-5">
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                              <FormLabel className="!mt-0">Active</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>

                      <DialogFooter>
                        <Button type="submit">Save Rule</Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Multiplier</TableHead>
                    <TableHead>Applies To</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-slate-400 py-8">
                        No seasonal rules configured
                      </TableCell>
                    </TableRow>
                  ) : (
                    rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell className="text-sm">
                          {getDateLabel(rule.startDate)} → {getDateLabel(rule.endDate)}
                        </TableCell>
                        <TableCell>
                          <Badge className={getMultiplierColor(rule.priceMultiplier)}>
                            ×{rule.priceMultiplier}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 max-w-40 truncate">
                          {(rule.applicableTo || []).map(moduleLabel).join(', ') || 'All'}
                        </TableCell>
                        <TableCell className="text-sm">{rule.priority}</TableCell>
                        <TableCell>
                          <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                            {rule.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleEditRule(rule)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteRule(rule.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dynamic Pricing Tab */}
        <TabsContent value="dynamic">
          <Card>
            <CardHeader>
              <CardTitle>Dynamic Pricing Configuration</CardTitle>
              <CardDescription>
                Occupancy-driven and booking-time adjustments applied by the
                pricing engine
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Enable Dynamic Pricing</p>
                  <p className="text-sm text-slate-500">
                    Adjust prices automatically based on occupancy and booking timing
                  </p>
                </div>
                <Switch
                  checked={dynamicConfig.enabled}
                  onCheckedChange={(checked) =>
                    setDynamicConfig({ ...dynamicConfig, enabled: checked })
                  }
                />
              </div>

              <div className={dynamicConfig.enabled ? '' : 'opacity-50 pointer-events-none'}>
                {/* Occupancy-based Pricing */}
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Occupancy-based Pricing
                  </h3>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>
                        Min Occupancy Threshold: {dynamicConfig.minOccupancyThreshold}%
                      </Label>
                      <Slider
                        min={0}
                        max={100}
                        step={5}
                        value={[dynamicConfig.minOccupancyThreshold]}
                        onValueChange={([value]) =>
                          setDynamicConfig({ ...dynamicConfig, minOccupancyThreshold: value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>
                        Max Occupancy Threshold: {dynamicConfig.maxOccupancyThreshold}%
                      </Label>
                      <Slider
                        min={0}
                        max={100}
                        step={5}
                        value={[dynamicConfig.maxOccupancyThreshold]}
                        onValueChange={([value]) =>
                          setDynamicConfig({ ...dynamicConfig, maxOccupancyThreshold: value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>
                        Min Price Multiplier: {dynamicConfig.minPriceMultiplier}
                      </Label>
                      <Slider
                        min={0.5}
                        max={1}
                        step={0.05}
                        value={[dynamicConfig.minPriceMultiplier]}
                        onValueChange={([value]) =>
                          setDynamicConfig({ ...dynamicConfig, minPriceMultiplier: value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>
                        Max Price Multiplier: {dynamicConfig.maxPriceMultiplier}
                      </Label>
                      <Slider
                        min={1}
                        max={2}
                        step={0.05}
                        value={[dynamicConfig.maxPriceMultiplier]}
                        onValueChange={([value]) =>
                          setDynamicConfig({ ...dynamicConfig, maxPriceMultiplier: value })
                        }
                      />
                    </div>
                  </div>
                </div>

                <Separator className="my-6" />

                {/* Time-based Pricing */}
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Booking Time-based Pricing
                  </h3>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Early Bird: Book {dynamicConfig.advanceBookingDays}+ days ahead</Label>
                      <Slider
                        min={14}
                        max={90}
                        step={7}
                        value={[dynamicConfig.advanceBookingDays]}
                        onValueChange={([value]) =>
                          setDynamicConfig({ ...dynamicConfig, advanceBookingDays: value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>
                        Early Bird Discount: {Math.round(dynamicConfig.earlyBirdDiscount * 100)}%
                      </Label>
                      <Slider
                        min={0}
                        max={0.25}
                        step={0.05}
                        value={[dynamicConfig.earlyBirdDiscount]}
                        onValueChange={([value]) =>
                          setDynamicConfig({ ...dynamicConfig, earlyBirdDiscount: value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Last Minute: Book within {dynamicConfig.lastMinuteDays} days</Label>
                      <Slider
                        min={1}
                        max={7}
                        step={1}
                        value={[dynamicConfig.lastMinuteDays]}
                        onValueChange={([value]) =>
                          setDynamicConfig({ ...dynamicConfig, lastMinuteDays: value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>
                        Last Minute Adjustment: {dynamicConfig.lastMinutePremium >= 0 ? '+' : ''}
                        {Math.round(dynamicConfig.lastMinutePremium * 100)}%
                      </Label>
                      <Slider
                        min={-0.2}
                        max={0.2}
                        step={0.05}
                        value={[dynamicConfig.lastMinutePremium]}
                        onValueChange={([value]) =>
                          setDynamicConfig({ ...dynamicConfig, lastMinutePremium: value })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Negative values = discount, positive = premium
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleSaveDynamicConfig} disabled={isSavingDynamic}>
                  {isSavingDynamic ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Configuration
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
