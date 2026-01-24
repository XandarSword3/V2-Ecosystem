'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Calendar, X, RefreshCw, CreditCard, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Calendar as CalendarComponent } from '@/components/ui/Calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/Alert';
import { Textarea } from '@/components/ui/Textarea';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface CancellationPolicy {
  refundPercentage: number;
  refundType: 'FULL' | 'PARTIAL' | 'CREDIT' | 'NONE';
  estimatedRefund: number;
  daysBeforeCheckin: number;
}

interface BookingModificationModalProps {
  booking: {
    id: string;
    type: 'chalet' | 'pool';
    name: string;
    checkInDate?: string;
    checkOutDate?: string;
    date?: string;
    totalPrice: number;
    status: string;
  };
  onSuccess?: () => void;
}

export function BookingModificationModal({ 
  booking, 
  onSuccess 
}: BookingModificationModalProps) {
  const t = useTranslations('booking');
  const [isOpen, setIsOpen] = useState(false);
  const [action, setAction] = useState<'cancel' | 'modify' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [policy, setPolicy] = useState<CancellationPolicy | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  
  // For date modification
  const [newCheckIn, setNewCheckIn] = useState<Date | undefined>(
    booking.checkInDate ? new Date(booking.checkInDate) : undefined
  );
  const [newCheckOut, setNewCheckOut] = useState<Date | undefined>(
    booking.checkOutDate ? new Date(booking.checkOutDate) : undefined
  );
  const [newDate, setNewDate] = useState<Date | undefined>(
    booking.date ? new Date(booking.date) : undefined
  );

  // Fetch cancellation policy
  useEffect(() => {
    if (isOpen && action === 'cancel' && booking.type === 'chalet') {
      fetchCancellationPolicy();
    }
  }, [isOpen, action, booking.type, booking.id]);

  const fetchCancellationPolicy = async () => {
    try {
      const response = await api.get(
        `/bookings/chalets/${booking.id}/cancellation-policy`
      );
      setPolicy(response.data.data);
    } catch (error) {
      console.error('Failed to fetch cancellation policy:', error);
    }
  };

  const handleCancel = async () => {
    setIsLoading(true);
    try {
      const endpoint = booking.type === 'chalet'
        ? `/bookings/chalets/${booking.id}/cancel`
        : `/bookings/pool-tickets/${booking.id}/cancel`;

      const response = await api.post(endpoint, { reason: cancelReason });
      
      const { refundAmount, creditAmount } = response.data.data;
      
      let message = 'Booking cancelled successfully.';
      if (refundAmount > 0) {
        message += ` Refund of $${refundAmount.toFixed(2)} will be processed.`;
      }
      if (creditAmount > 0) {
        message += ` Credit of $${creditAmount.toFixed(2)} added to your account.`;
      }
      
      toast.success(message);
      setIsOpen(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to cancel booking');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModifyDates = async () => {
    if (booking.type === 'chalet' && (!newCheckIn || !newCheckOut)) {
      toast.error('Please select both check-in and check-out dates');
      return;
    }
    if (booking.type === 'pool' && !newDate) {
      toast.error('Please select a new date');
      return;
    }

    setIsLoading(true);
    try {
      if (booking.type === 'chalet') {
        const response = await api.put(`/bookings/chalets/${booking.id}/dates`, {
          checkInDate: newCheckIn!.toISOString(),
          checkOutDate: newCheckOut!.toISOString(),
        });
        
        const { priceDifference, refundAmount, newPaymentRequired } = response.data.data;
        
        if (newPaymentRequired) {
          toast.info(`Dates updated. Additional payment of $${priceDifference.toFixed(2)} required.`);
        } else if (refundAmount) {
          toast.success(`Dates updated. Refund of $${refundAmount.toFixed(2)} processed.`);
        } else {
          toast.success('Dates updated successfully.');
        }
      } else {
        await api.put(`/bookings/pool-tickets/${booking.id}/reschedule`, {
          newDate: newDate!.toISOString(),
        });
        toast.success('Ticket rescheduled successfully.');
      }
      
      setIsOpen(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to modify booking');
    } finally {
      setIsLoading(false);
    }
  };

  const getRefundBadgeColor = (type: string) => {
    switch (type) {
      case 'FULL':
        return 'bg-green-100 text-green-800';
      case 'PARTIAL':
        return 'bg-yellow-100 text-yellow-800';
      case 'CREDIT':
        return 'bg-blue-100 text-blue-800';
      case 'NONE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Manage Booking
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Booking</DialogTitle>
          <DialogDescription>
            {booking.name} - {booking.type === 'chalet' 
              ? `${format(new Date(booking.checkInDate!), 'MMM d')} - ${format(new Date(booking.checkOutDate!), 'MMM d, yyyy')}`
              : format(new Date(booking.date!), 'MMM d, yyyy')
            }
          </DialogDescription>
        </DialogHeader>

        {!action && (
          <div className="grid gap-4 py-4">
            <Button
              variant="outline"
              className="h-20 flex flex-col items-center gap-2"
              onClick={() => setAction('modify')}
            >
              <RefreshCw className="h-6 w-6" />
              <span>Change Dates</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col items-center gap-2 border-red-200 hover:bg-red-50"
              onClick={() => setAction('cancel')}
            >
              <X className="h-6 w-6 text-red-500" />
              <span className="text-red-600">Cancel Booking</span>
            </Button>
          </div>
        )}

        {action === 'cancel' && (
          <div className="space-y-4 py-4">
            {policy && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Cancellation Policy</AlertTitle>
                <AlertDescription className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className={getRefundBadgeColor(policy.refundType)}>
                      {policy.refundPercentage}% Refund
                    </Badge>
                  </div>
                  <p>
                    {policy.refundType === 'FULL' && 'You will receive a full refund.'}
                    {policy.refundType === 'PARTIAL' && `You will receive $${policy.estimatedRefund.toFixed(2)} back.`}
                    {policy.refundType === 'CREDIT' && 'Amount will be added as account credit.'}
                    {policy.refundType === 'NONE' && 'No refund available for this cancellation.'}
                  </p>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="reason">Reason for cancellation (optional)</Label>
              <Textarea
                id="reason"
                placeholder="Let us know why you're cancelling..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAction(null)}>
                Back
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleCancel}
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Cancellation
              </Button>
            </DialogFooter>
          </div>
        )}

        {action === 'modify' && (
          <div className="space-y-4 py-4">
            {booking.type === 'chalet' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>New Check-in Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !newCheckIn && 'text-muted-foreground'
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {newCheckIn ? format(newCheckIn, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={newCheckIn}
                          onSelect={setNewCheckIn}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>New Check-out Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !newCheckOut && 'text-muted-foreground'
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {newCheckOut ? format(newCheckOut, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={newCheckOut}
                          onSelect={setNewCheckOut}
                          disabled={(date) => 
                            date < new Date() || 
                            (newCheckIn ? date <= newCheckIn : false)
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Note: Price may change based on new dates. You'll be notified of any price difference.
                </p>
              </>
            ) : (
              <div className="space-y-2">
                <Label>New Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !newDate && 'text-muted-foreground'
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {newDate ? format(newDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={newDate}
                      onSelect={setNewDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setAction(null)}>
                Back
              </Button>
              <Button onClick={handleModifyDates} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Dates
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default BookingModificationModal;
