'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSiteSettings } from '@/lib/settings-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import {
  CheckCircle2,
  Calendar,
  Users,
  Clock,
  Phone,
  ArrowRight,
  Loader2,
  AlertCircle,
  Ticket,
  UtensilsCrossed,
  Home,
  User,
  MapPin,
  Receipt,
  Tag,
  CreditCard,
  Sparkles,
  Store,
  ShoppingCart,
  Truck,
  Banknote,
  MessageSquare,
  Star,
} from 'lucide-react';

// ============================
// TYPE DEFINITIONS
// ============================

interface SessionTicket {
  id: string;
  ticket_number: string;
  session_id: string;
  customer_name: string;
  customer_phone: string;
  ticket_date: string;
  number_of_guests: number;
  total_amount: number;
  status: string;
  payment_status: string;
  qr_code?: string;
  session?: {
    name: string;
    start_time: string;
    end_time: string;
  };
}

interface OrderDiscount {
  type: string;
  referenceId?: string;
  label: string;
  amount: number;
  taxSavings?: number;
}

interface OrderTaxLine {
  name: string;
  rate?: number;
  amount: number;
}

interface OrderLineItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  selectedModifiers?: Array<{ modifierType: string; optionName: string }>;
}

interface OrderConfirmation {
  id: string;
  order_number: string;
  customer_name?: string;
  customer_phone?: string;
  staff_id?: string | null;
  staff_name?: string | null;
  notes?: string;
  status: string;
  order_type: string;
  total_amount: number;
  tax_amount?: number;
  discount_amount?: number;
  payment_method?: string;
  qr_code?: string;
  table_id?: string;
  created_at: string;
  items?: Array<{
    id: string;
    quantity: number;
    catalog_items?: { name: string };
  }>;
  // Rich breakdown — only populated for orders created after the ledger
  // was wired up; null for older orders, so every field below must be
  // treated as optional and the UI must degrade gracefully without it.
  subtotal?: number | null;
  tax_rate?: number | null;
  service_charge?: number | null;
  delivery_fee?: number | null;
  deposit_amount?: number | null;
  loyalty_points_earned?: number | null;
  discounts?: OrderDiscount[] | null;
  line_items?: OrderLineItem[] | null;
  tax_breakdown?: OrderTaxLine[] | null;
  fee_breakdown?: OrderTaxLine[] | null;
}

interface BookingConfirmation {
  id: string;
  booking_number: string;
  customer_name: string;
  customer_email?: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  total_price: number;
  guests?: number;
  special_requests?: string;
  unit?: { name: string };
}

// ============================
// SMALL DISPLAY HELPERS
// ============================

function orderTypeIcon(orderType?: string) {
  switch (orderType) {
    case 'delivery':
      return Truck;
    case 'takeaway':
    case 'pickup':
      return ShoppingCart;
    case 'dine_in':
      return Store;
    default:
      return UtensilsCrossed;
  }
}

function paymentMethodIcon(paymentMethod?: string) {
  const value = (paymentMethod || '').toLowerCase();
  if (value.includes('cash')) return Banknote;
  return CreditCard;
}

function discountIcon(type?: string) {
  switch (type) {
    case 'gift_card':
      return CreditCard;
    case 'loyalty':
      return Sparkles;
    default:
      return Tag;
  }
}

// Status pills use the CMS's own success/warning/primary/destructive
// tokens (see tailwind.config.js) rather than hardcoded green/amber/blue,
// so an order's status reads correctly no matter which theme is active.
function orderStatusStyle(status?: string) {
  switch (status) {
    case 'ready':
    case 'delivered':
    case 'completed':
      return 'bg-success/10 text-success';
    case 'confirmed':
    case 'preparing':
      return 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400';
    case 'cancelled':
      return 'bg-destructive/10 text-destructive';
    default:
      return 'bg-warning/10 text-warning';
  }
}

// ============================
// MAIN COMPONENT
// ============================

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const params = useParams();
  const propertySlug = (params?.property as string) || '';
  const tCommon = useTranslations('common');
  const currency = useSettingsStore((s) => s.currency);
  const { modules } = useSiteSettings();
  const { socket } = useSocket();

  const [ticket, setTicket] = useState<SessionTicket | null>(null);
  const [order, setOrder] = useState<OrderConfirmation | null>(null);
  const [booking, setBooking] = useState<BookingConfirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Staff review (POST /orders/:id/staff-review) — only rendered when this
  // order has a serving staff member and has reached a servable state.
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const confirmationType = searchParams.get('type') || 'session'; // 'session' | 'order' | 'booking'
  const itemId = searchParams.get('id');
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug || '';

  const currentModule = modules.find((m) => m.slug.toLowerCase() === slug.toLowerCase());
  const moduleName = currentModule?.name || 'Module';

  useEffect(() => {
    if (!itemId) {
      setError('No confirmation ID provided');
      setLoading(false);
      return;
    }
    fetchConfirmation();

    if (confirmationType === 'order') {
      const intervalId = setInterval(fetchConfirmation, 5000);
      return () => clearInterval(intervalId);
    }
  }, [itemId, confirmationType]);

  // Live order status updates via WebSockets
  useEffect(() => {
    if (socket && itemId && confirmationType === 'order') {
      socket.emit('order:join', { orderId: itemId });

      const handleOrderUpdate = (update: { orderId?: string; id?: string; status: string }) => {
        const targetId = update.orderId || update.id;
        if (!targetId || targetId === itemId) {
          setOrder((prev) => (prev ? { ...prev, status: update.status } : prev));
          toast.info(`Order status: ${update.status.replace('_', ' ')}`);
        }
      };

      socket.on('order:status', handleOrderUpdate);
      socket.on('order-status-updated', handleOrderUpdate);

      return () => {
        socket.emit('leave:order', itemId);
        socket.off('order:status', handleOrderUpdate);
        socket.off('order-status-updated', handleOrderUpdate);
      };
    }
  }, [socket, itemId, confirmationType]);

  const fetchConfirmation = async () => {
    try {
      if (confirmationType === 'order') {
        const response = await api.get(`/${slug}/orders/${itemId}`);
        setOrder(response.data.data);
      } else if (confirmationType === 'booking') {
        const response = await api.get(`/${slug}/bookings/${itemId}`);
        setBooking(response.data.data);
      } else {
        // Default: session ticket
        const response = await api.get(`/${slug}/tickets/${itemId}`);
        setTicket(response.data.data);
      }
    } catch (err) {
      setError('Failed to load confirmation details');
    } finally {
      setLoading(false);
    }
  };

  const submitStaffReview = async () => {
    if (reviewRating < 1 || reviewRating > 5) {
      toast.error('Please select a star rating');
      return;
    }
    setReviewSubmitting(true);
    setReviewError(null);
    try {
      await api.post(`/${slug}/orders/${itemId}/staff-review`, {
        rating: reviewRating,
        text: reviewText.trim() ? reviewText.trim() : undefined,
      });
      setReviewSubmitted(true);
      toast.success('Thanks for rating your server!');
    } catch (err) {
      setReviewError('Could not submit your rating. Please try again.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || (!ticket && !order && !booking)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{error || 'Confirmation not found'}</h2>
            <Link href={`/${propertySlug}/${slug}`}>
              <Button className="mt-4">Back to {moduleName}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Section className="py-12">
        <Container size="sm">
        {/* Success Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <CheckCircle2 className="w-10 h-10 text-primary-600 dark:text-primary-400" />
          </motion.div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {confirmationType === 'order' ? 'Order Confirmed!' :
             confirmationType === 'booking' ? 'Booking Confirmed!' :
             'Ticket Confirmed!'}
          </h1>
          <p className="text-muted-foreground">
            {confirmationType === 'order' ? 'Your order has been placed successfully.' :
             confirmationType === 'booking' ? 'Your booking is confirmed. We look forward to hosting you!' :
             'Your ticket has been confirmed.'}
          </p>
        </motion.div>

        {/* ========== SESSION TICKET CONFIRMATION ========== */}
        {ticket && (
          <Card className="overflow-hidden">
            <CardHeader className="rounded-lg bg-gradient-to-r from-primary-600 to-secondary-500 text-primary-foreground border-b-0">
              <CardTitle className="flex items-center justify-between text-primary-foreground">
                <span className="flex items-center gap-2">
                  <Ticket className="w-5 h-5" />
                  {moduleName} Ticket
                </span>
                <span className="text-sm font-mono bg-white/20 px-3 py-1 rounded-full">
                  #{ticket.ticket_number}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {ticket.qr_code && (
                <div className="py-6 flex justify-center">
                  <div className="bg-white p-4 rounded-lg shadow-inner">
                    <img src={ticket.qr_code} alt="Ticket QR Code" className="w-40 h-40" />
                  </div>
                </div>
              )}
              <div className="py-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                  <Ticket className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{'Session'}</p>
                  <p className="font-semibold">{ticket.session?.name || 'Session'}</p>
                </div>
              </div>
              <div className="py-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-primary-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{'Date'}</p>
                  <p className="font-semibold">{formatDate(ticket.ticket_date)}</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>{ticket.session?.start_time} - {ticket.session?.end_time}</span>
                </div>
              </div>
              <div className="py-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-secondary-100 dark:bg-secondary-900/30 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-secondary-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{tCommon('guests')}</p>
                  <p className="font-semibold">{ticket.number_of_guests} {ticket.number_of_guests > 1 ? 'guests' : 'guest'}</p>
                </div>
              </div>
              <div className="py-4 space-y-2">
                <p className="text-sm text-muted-foreground">{'Contact Information'}</p>
                <p className="font-medium">{ticket.customer_name}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <span>{ticket.customer_phone}</span>
                </div>
              </div>
              <div className="py-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">{tCommon('total')}</span>
                  <span className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">{formatCurrency(ticket.total_amount, currency)}</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    ticket.status === 'valid' 
                      ? 'bg-success/10 text-success'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {ticket.status.toUpperCase()}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    ticket.payment_status === 'paid'
                      ? 'bg-success/10 text-success'
                      : 'bg-warning/10 text-warning'
                  }`}>
                    {ticket.payment_status === 'paid' ? 'PAID' : 'PAY ON ARRIVAL'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ========== ORDER CONFIRMATION (menu_service) ========== */}
        {order && (() => {
          const OrderTypeIcon = orderTypeIcon(order.order_type);
          const PaymentIcon = paymentMethodIcon(order.payment_method);
          const hasBreakdown = typeof order.subtotal === 'number';
          const preDiscountTotal = hasBreakdown
            ? (order.subtotal || 0) + (order.tax_amount || 0) + (order.service_charge || 0) + (order.delivery_fee || 0)
            : null;
          const showStrikethrough = preDiscountTotal !== null && preDiscountTotal - order.total_amount > 0.01;
          const richItems = order.line_items && order.line_items.length > 0 ? order.line_items : null;
          const legacyItems = !richItems && order.items && order.items.length > 0 ? order.items : null;

          return (
            <Card className="overflow-hidden">
              <CardHeader className="relative overflow-hidden rounded-lg bg-gradient-to-r from-primary-600 to-secondary-500 text-primary-foreground border-b-0">
                <div
                  className="pointer-events-none absolute inset-0 opacity-20"
                  style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '20px 20px' }}
                />
                <CardTitle className="relative flex items-center justify-between text-primary-foreground">
                  <span className="flex items-center gap-2">
                    <OrderTypeIcon className="w-5 h-5" />
                    {moduleName} Order
                  </span>
                  <span className="text-sm font-mono bg-white/20 px-3 py-1 rounded-full">
                    #{order.order_number}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                {order.qr_code && (
                  <div className="py-6 flex justify-center">
                    <div className="bg-white p-4 rounded-lg shadow-inner">
                      <img src={order.qr_code} alt="Order QR Code" className="w-40 h-40" />
                    </div>
                  </div>
                )}

                <div className="py-4 flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                    <OrderTypeIcon className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Order Type</p>
                    <p className="font-semibold capitalize">{order.order_type ? order.order_type.replace('_', ' ') : 'Order'}</p>
                  </div>
                </div>

                {order.table_id && (
                  <div className="py-4 flex items-center gap-4">
                    <div className="w-12 h-12 bg-secondary-100 dark:bg-secondary-900/30 rounded-lg flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-secondary-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Table</p>
                      <p className="font-semibold">Table {order.table_id}</p>
                    </div>
                  </div>
                )}

                {(order.customer_name || order.customer_phone || order.payment_method) && (
                  <div className="py-4 space-y-2">
                    <p className="text-sm text-muted-foreground">Customer</p>
                    {order.customer_name && <p className="font-medium">{order.customer_name}</p>}
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                      {order.customer_phone && (
                        <span className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          {order.customer_phone}
                        </span>
                      )}
                      {order.payment_method && (
                        <span className="flex items-center gap-2 capitalize">
                          <PaymentIcon className="w-4 h-4" />
                          {order.payment_method.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {richItems && (
                  <div className="py-4">
                    <p className="text-sm text-muted-foreground mb-3">Items Ordered</p>
                    <div className="space-y-2">
                      {richItems.map((item, idx) => (
                        <div key={`${item.itemId}-${idx}`} className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2">
                            <span className="font-medium bg-primary-100 dark:bg-primary-900/30 px-2 py-0.5 rounded text-xs text-primary-700 dark:text-primary-400 shrink-0">
                              {item.quantity}x
                            </span>
                            <div>
                              <span className="text-foreground text-sm">{item.name}</span>
                              {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {item.selectedModifiers.map((mod, mi) => (
                                    <span key={mi} className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                      {mod.optionName}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <span className="text-sm text-muted-foreground whitespace-nowrap">{formatCurrency(item.lineTotal, currency)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {legacyItems && (
                  <div className="py-4">
                    <p className="text-sm text-muted-foreground mb-3">Items Ordered</p>
                    <div className="space-y-2">
                      {legacyItems.map((item) => (
                        <div key={item.id} className="flex items-center gap-2">
                          <span className="font-medium bg-primary-100 dark:bg-primary-900/30 px-2 py-0.5 rounded text-xs text-primary-700 dark:text-primary-400">
                            {item.quantity}x
                          </span>
                          <span className="text-foreground text-sm">
                            {item.catalog_items?.name || 'Item'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="py-4 space-y-2">
                  {hasBreakdown ? (
                    <div className="space-y-1.5 text-sm text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>{formatCurrency(order.subtotal || 0, currency)}</span>
                      </div>
                      {order.tax_breakdown && order.tax_breakdown.length > 0 ? (
                        order.tax_breakdown.map((line, i) => (
                          <div key={i} className="flex justify-between">
                            <span>{line.name}{typeof line.rate === 'number' ? ` (${line.rate}%)` : ''}</span>
                            <span>{formatCurrency(line.amount, currency)}</span>
                          </div>
                        ))
                      ) : !!order.tax_amount && (
                        <div className="flex justify-between">
                          <span>Tax</span>
                          <span>{formatCurrency(order.tax_amount, currency)}</span>
                        </div>
                      )}
                      {/* All fees (service charge, delivery fee, resort fee, custom) come from
                          the CMS tax configuration. Older orders predating the ledger wiring
                          only have the two flat scalar fields, so fall back to those. */}
                      {order.fee_breakdown && order.fee_breakdown.length > 0 ? (
                        order.fee_breakdown.map((line, i) => (
                          <div key={i} className="flex justify-between">
                            <span>{line.name}{typeof line.rate === 'number' ? ` (${line.rate}%)` : ''}</span>
                            <span>{formatCurrency(line.amount, currency)}</span>
                          </div>
                        ))
                      ) : (
                        <>
                          {!!order.service_charge && (
                            <div className="flex justify-between">
                              <span>Service charge</span>
                              <span>{formatCurrency(order.service_charge, currency)}</span>
                            </div>
                          )}
                          {!!order.delivery_fee && (
                            <div className="flex justify-between">
                              <span>Delivery fee</span>
                              <span>{formatCurrency(order.delivery_fee, currency)}</span>
                            </div>
                          )}
                        </>
                      )}
                      {order.discounts && order.discounts.length > 0 && order.discounts.map((d, i) => {
                        const DiscountIcon = discountIcon(d.type);
                        return (
                          <div key={i} className="flex justify-between text-success">
                            <span className="flex items-center gap-1.5">
                              <DiscountIcon className="w-3.5 h-3.5" />
                              {d.label}
                            </span>
                            <span>-{formatCurrency(d.amount, currency)}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    (!!order.discount_amount || !!order.tax_amount) && (
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {!!order.discount_amount && (
                          <div className="flex justify-between">
                            <span>Discount applied</span>
                            <span className="text-success">-{formatCurrency(order.discount_amount, currency)}</span>
                          </div>
                        )}
                        {!!order.tax_amount && (
                          <div className="flex justify-between">
                            <span>Tax</span>
                            <span>{formatCurrency(order.tax_amount, currency)}</span>
                          </div>
                        )}
                      </div>
                    )
                  )}

                  <div className="flex justify-between items-end pt-1">
                    <span className="font-semibold text-foreground">{tCommon('total')}</span>
                    <div className="text-right">
                      {showStrikethrough && preDiscountTotal !== null && (
                        <p className="text-sm text-muted-foreground line-through">{formatCurrency(preDiscountTotal, currency)}</p>
                      )}
                      <span className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                        {formatCurrency(order.total_amount, currency)}
                      </span>
                    </div>
                  </div>

                  {!!order.loyalty_points_earned && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                      <Sparkles className="w-3.5 h-3.5 text-accent-600" />
                      You earned {order.loyalty_points_earned} loyalty points on this order
                    </p>
                  )}

                  <div className="pt-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${orderStatusStyle(order.status)}`}>
                      {order.status?.toUpperCase() || 'PENDING'}
                    </span>
                  </div>
                </div>

                {order.notes && (
                  <div className="py-4">
                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Notes
                    </p>
                    <p className="text-foreground text-sm bg-muted p-3 rounded-lg">{order.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* ========== RATE YOUR SERVER (menu_service) ========== */}
        {/* Gated on the *resolved* server name, not transactions.staff_id:
            the backend now routes table orders through
            service_locations.assigned_staff_id, so staff_name is the single
            source of truth for whether this order has someone to rate. */}
        {order && order.staff_name && ['ready', 'delivered', 'completed'].includes(order.status) && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" />
                Rate your server
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reviewSubmitted ? (
                <p className="text-sm text-muted-foreground">
                  Thanks — your feedback helps {order.staff_name || 'your server'} improve.
                </p>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    How was your experience with {order.staff_name || 'your server'}?
                  </p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setReviewRating(n)}
                        aria-label={`${n} star${n === 1 ? '' : 's'}`}
                        className="p-1"
                      >
                        <Star
                          className={`w-7 h-7 transition ${n <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`}
                        />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="Optional: share a few words…"
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                  {reviewError && <p className="text-sm text-destructive">{reviewError}</p>}
                  <Button onClick={submitStaffReview} disabled={reviewSubmitting}>
                    {reviewSubmitting ? 'Submitting…' : 'Submit Rating'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ========== BOOKING CONFIRMATION (multi_day_booking) ========== */}
        {booking && (
          <Card className="overflow-hidden">
            <CardHeader className="rounded-lg bg-gradient-to-r from-primary-600 to-secondary-500 text-primary-foreground border-b-0">
              <CardTitle className="flex items-center justify-between text-primary-foreground">
                <span className="flex items-center gap-2">
                  <Home className="w-5 h-5" />
                  {moduleName} Booking
                </span>
                <span className="text-sm font-mono bg-white/20 px-3 py-1 rounded-full">
                  #{booking.booking_number}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {booking.unit?.name && (
                <div className="py-4 flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                    <Home className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Unit</p>
                    <p className="font-semibold">{booking.unit.name}</p>
                  </div>
                </div>
              )}
              <div className="py-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-secondary-100 dark:bg-secondary-900/30 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-secondary-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Check-in / Check-out</p>
                  <p className="font-semibold">
                    {formatDate(booking.check_in_date)} — {formatDate(booking.check_out_date)}
                  </p>
                </div>
              </div>
              <div className="py-4 space-y-2">
                <p className="text-sm text-muted-foreground">Guest Details</p>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <p className="font-medium">{booking.customer_name}</p>
                </div>
                {booking.customer_email && (
                  <p className="text-sm text-muted-foreground ml-6">{booking.customer_email}</p>
                )}
                {booking.guests && (
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm">{booking.guests} guests</p>
                  </div>
                )}
              </div>
              {booking.special_requests && (
                <div className="py-4">
                  <p className="text-sm text-muted-foreground mb-1">Special Requests</p>
                  <p className="text-foreground text-sm bg-muted p-3 rounded-lg">
                    {booking.special_requests}
                  </p>
                </div>
              )}
              <div className="py-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">{tCommon('total')}</span>
                  <span className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">{formatCurrency(booking.total_price, currency)}</span>
                </div>
                <div className="mt-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    booking.status === 'confirmed'
                      ? 'bg-success/10 text-success'
                      : 'bg-warning/10 text-warning'
                  }`}>
                    {booking.status?.toUpperCase() || 'PENDING'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Note */}
        {ticket && (
          <div className="mt-6 bg-warning/10 border border-warning/20 rounded-lg p-4">
            <p className="text-sm text-warning">
              <strong>{'Important Note'}:</strong> {'Please show your QR code at the entrance to gain access.'}
            </p>
          </div>
        )}
        {order && (
          <div className="mt-6 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
            <p className="text-sm text-primary-800 dark:text-primary-300">
              <strong>Note:</strong> Your order is being prepared. You will be notified when it&apos;s ready.
            </p>
          </div>
        )}
        {booking && (
          <div className="mt-6 bg-secondary-50 dark:bg-secondary-900/20 border border-secondary-200 dark:border-secondary-800 rounded-lg p-4">
            <p className="text-sm text-secondary-800 dark:text-secondary-300">
              <strong>Note:</strong> A confirmation email has been sent. Please present your booking number at check-in.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href={`/${propertySlug}/${slug}`}>
            <Button variant="outline">Back to {moduleName}</Button>
          </Link>
          {ticket && (
            <Button
              variant="outline"
              onClick={() => window.print()}
              className="gap-2"
            >
              <Receipt className="w-4 h-4" />
              Print Ticket
            </Button>
          )}
          <Link href={`/${propertySlug}/profile`}>
            <Button className="gap-2">
              {confirmationType === 'order' ? 'View My Orders' : confirmationType === 'booking' ? 'View My Bookings' : 'View My Tickets'}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
        </Container>
      </Section>
    </div>
  );
}

export default function UnifiedConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    }>
      <ConfirmationContent />
    </Suspense>
  );
}
