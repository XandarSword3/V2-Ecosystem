'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Percent,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Settings,
  HelpCircle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip';
import { Checkbox } from '@/components/ui/Checkbox';
import { Separator } from '@/components/ui/Separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const seasonalRuleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  startDate: z.string().regex(/^\d{2}-\d{2}$/, 'Use MM-DD format'),
  endDate: z.string().regex(/^\d{2}-\d{2}$/, 'Use MM-DD format'),
  priceMultiplier: z.number().min(0.1).max(3),
  applicableTo: z.array(z.string()).min(1, 'Select at least one category'),
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

const CATEGORIES = [
  { value: 'chalets', label: 'Chalets' },
  { value: 'pool', label: 'Pool' },
  { value: 'restaurant', label: 'Restaurant' },
];

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export default function SeasonalPricingPage() {
  const t = useTranslations('admin.pricing');
  const [isLoading, setIsLoading] = useState(true);
  const [rules, setRules] = useState<SeasonalRule[]>([]);
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
      applicableTo: ['chalets'],
      priority: 5,
      isActive: true,
    },
  });

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [rulesRes, configRes] = await Promise.all([
        api.get('/admin/pricing/seasonal-rules'),
        api.get('/admin/pricing/dynamic-config'),
      ]);
      setRules(rulesRes.data.data);
      setDynamicConfig(configRes.data.data);
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

  // Handle rule submission
  const onSubmitRule = async (data: SeasonalRuleFormData) => {
    try {
      if (editingRule) {
        await api.put(`/admin/pricing/seasonal-rules/${editingRule.id}`, data);
        toast.success('Rule updated successfully');
      } else {
        await api.post('/admin/pricing/seasonal-rules', data);
        toast.success('Rule created successfully');
      }
      setIsDialogOpen(false);
      setEditingRule(null);
      form.reset();
      fetchData();
    } catch (error) {
      toast.error('Failed to save rule');
    }
  };

  // Handle rule deletion
  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      await api.delete(`/admin/pricing/seasonal-rules/${ruleId}`);
      toast.success('Rule deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete rule');
    }
  };

  // Handle edit
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

  // Save dynamic pricing config
  const handleSaveDynamicConfig = async () => {
    setIsSavingDynamic(true);
    try {
      await api.put('/admin/pricing/dynamic-config', dynamicConfig);
      toast.success('Dynamic pricing settings saved');
    } catch (error) {
      toast.error('Failed to save dynamic pricing settings');
    } finally {
      setIsSavingDynamic(false);
    }
  };

  // Get month label from MM-DD
  const getDateLabel = (date: string) => {
    const [month, day] = date.split('-').map(Number);
    return `${MONTHS[month - 1]} ${day}`;
  };

  // Get multiplier badge color
  const getMultiplierColor = (multiplier: number) => {
    if (multiplier > 1) return 'bg-red-100 text-red-700';
    if (multiplier < 1) return 'bg-green-100 text-green-700';
    return 'bg-gray-100 text-gray-700';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Seasonal & Dynamic Pricing</h1>
        <p className="text-muted-foreground mt-1">
          Configure seasonal rates and dynamic pricing rules
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
                              <Input placeholder="Summer Peak Season" {...field} />
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
                              <FormLabel>Start Date (MM-DD)</FormLabel>
                              <FormControl>
                                <Input placeholder="07-01" {...field} />
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
                              <FormLabel>End Date (MM-DD)</FormLabel>
                              <FormControl>
                                <Input placeholder="08-31" {...field} />
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
                            <FormLabel>
                              Price Multiplier: {field.value}x
                              {field.value > 1 && (
                                <span className="text-red-500 ml-2">
                                  (+{Math.round((field.value - 1) * 100)}%)
                                </span>
                              )}
                              {field.value < 1 && (
                                <span className="text-green-500 ml-2">
                                  ({Math.round((field.value - 1) * 100)}%)
                                </span>
                              )}
                            </FormLabel>
                            <FormControl>
                              <Slider
                                min={0.5}
                                max={2}
                                step={0.05}
                                value={[field.value]}
                                onValueChange={([value]) => field.onChange(value)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="applicableTo"
                        render={() => (
                          <FormItem>
                            <FormLabel>Apply To</FormLabel>
                            <div className="flex flex-wrap gap-2">
                              {CATEGORIES.map((category) => (
                                <FormField
                                  key={category.value}
                                  control={form.control}
                                  name="applicableTo"
                                  render={({ field }) => (
                                    <FormItem className="flex items-center space-x-2">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(category.value)}
                                          onCheckedChange={(checked) => {
                                            return checked
                                              ? field.onChange([...field.value, category.value])
                                              : field.onChange(
                                                  field.value?.filter(
                                                    (value) => value !== category.value
                                                  )
                                                );
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal">
                                        {category.label}
                                      </FormLabel>
                                    </FormItem>
                                  )}
                                />
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="priority"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Priority</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormDescription>
                                Higher priority rules override lower
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="isActive"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Active</FormLabel>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <DialogFooter>
                        <Button type="submit">
                          {editingRule ? 'Update Rule' : 'Create Rule'}
                        </Button>
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
                    <TableHead>Adjustment</TableHead>
                    <TableHead>Applies To</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell>
                        {getDateLabel(rule.startDate)} - {getDateLabel(rule.endDate)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getMultiplierColor(rule.priceMultiplier)}>
                          {rule.priceMultiplier > 1 ? (
                            <TrendingUp className="h-3 w-3 mr-1" />
                          ) : rule.priceMultiplier < 1 ? (
                            <TrendingDown className="h-3 w-3 mr-1" />
                          ) : null}
                          {rule.priceMultiplier}x
                          {rule.priceMultiplier !== 1 && (
                            <span className="ml-1">
                              ({rule.priceMultiplier > 1 ? '+' : ''}
                              {Math.round((rule.priceMultiplier - 1) * 100)}%)
                            </span>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {rule.applicableTo.map((cat) => (
                            <Badge key={cat} variant="outline" className="text-xs">
                              {cat}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{rule.priority}</TableCell>
                      <TableCell>
                        <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditRule(rule)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteRule(rule.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {rules.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No seasonal pricing rules configured. Add your first rule to get started.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Visual Calendar Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Calendar Preview</CardTitle>
              <CardDescription>
                Visual representation of active pricing rules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-12 gap-1">
                {MONTHS.map((month, idx) => (
                  <div key={month} className="text-center">
                    <div className="text-xs font-medium mb-1">{month}</div>
                    <div
                      className={cn(
                        'h-8 rounded',
                        rules.some(
                          (r) =>
                            r.isActive &&
                            isMonthInRange(idx + 1, r.startDate, r.endDate)
                        )
                          ? 'bg-primary/30'
                          : 'bg-muted'
                      )}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dynamic Pricing Tab */}
        <TabsContent value="dynamic" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Dynamic Pricing Configuration</span>
                <Switch
                  checked={dynamicConfig.enabled}
                  onCheckedChange={(checked) =>
                    setDynamicConfig({ ...dynamicConfig, enabled: checked })
                  }
                />
              </CardTitle>
              <CardDescription>
                Automatically adjust prices based on demand and booking patterns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className={cn(!dynamicConfig.enabled && 'opacity-50 pointer-events-none')}>
                {/* Occupancy-based Pricing */}
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    Occupancy-based Pricing
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          Prices adjust based on current occupancy. High demand = higher prices,
                          low demand = lower prices to attract bookings.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </h3>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>
                        Low Occupancy Threshold: {dynamicConfig.minOccupancyThreshold}%
                      </Label>
                      <Slider
                        min={10}
                        max={50}
                        step={5}
                        value={[dynamicConfig.minOccupancyThreshold]}
                        onValueChange={([value]) =>
                          setDynamicConfig({ ...dynamicConfig, minOccupancyThreshold: value })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Below this occupancy, discount prices apply
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>
                        High Occupancy Threshold: {dynamicConfig.maxOccupancyThreshold}%
                      </Label>
                      <Slider
                        min={50}
                        max={95}
                        step={5}
                        value={[dynamicConfig.maxOccupancyThreshold]}
                        onValueChange={([value]) =>
                          setDynamicConfig({ ...dynamicConfig, maxOccupancyThreshold: value })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Above this occupancy, premium prices apply
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>
                        Min Price Multiplier: {dynamicConfig.minPriceMultiplier}x
                        <span className="text-green-500 ml-2">
                          ({Math.round((dynamicConfig.minPriceMultiplier - 1) * 100)}%)
                        </span>
                      </Label>
                      <Slider
                        min={0.7}
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
                        Max Price Multiplier: {dynamicConfig.maxPriceMultiplier}x
                        <span className="text-red-500 ml-2">
                          (+{Math.round((dynamicConfig.maxPriceMultiplier - 1) * 100)}%)
                        </span>
                      </Label>
                      <Slider
                        min={1}
                        max={1.5}
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

// Helper function to check if a month is in a date range
function isMonthInRange(month: number, start: string, end: string): boolean {
  const [startMonth] = start.split('-').map(Number);
  const [endMonth] = end.split('-').map(Number);

  if (startMonth <= endMonth) {
    return month >= startMonth && month <= endMonth;
  } else {
    // Handles year wrap (e.g., Dec-Jan)
    return month >= startMonth || month <= endMonth;
  }
}
