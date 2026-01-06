'use client';

import { use, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/Progress'; // Assuming we have this, or I'll use a simple div
import { Badge } from '@/components/ui/Badge';

interface CapacityData {
    sessionId: string;
    sessionName: string;
    startTime: string;
    endTime: string;
    maxCapacity: number;
    sold: number;
    admitted: number;
    pending: number;
    available: number;
}

export default function ModuleCapacityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [capacity, setCapacity] = useState<CapacityData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCapacity = async () => {
      try {
        setLoading(true);
        // /api/:slug/staff/capacity
        const response = await api.get(`/${slug}/staff/capacity`);
        setCapacity(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch capacity', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCapacity();
    
    // Poll every 30 seconds
    const interval = setInterval(fetchCapacity, 30000);
    return () => clearInterval(interval);
  }, [slug]);

  const getPercentage = (val: number, max: number) => {
      if (max === 0) return 0;
      return Math.min(100, Math.round((val / max) * 100));
  };

  const getStatusColor = (percentage: number) => {
      if (percentage >= 100) return 'bg-red-500';
      if (percentage >= 80) return 'bg-orange-500';
      return 'bg-green-500';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold capitalize">{slug} Capacity</h1>
        <p className="text-muted-foreground">Real-time occupancy and capacity tracking</p>
      </div>

      {loading && capacity.length === 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map(i => <div key={i} className="h-48 bg-muted/20 animate-pulse rounded-lg" />)}
          </div>
      ) : capacity.length === 0 ? (
            <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>No active sessions or capacity data available for today.</p>
                </CardContent>
            </Card>
      ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {capacity.map((cap) => {
                const soldPercent = getPercentage(cap.sold, cap.maxCapacity);
                const admittedPercent = getPercentage(cap.admitted, cap.maxCapacity);

                return (
                    <Card key={cap.sessionId} className="overflow-hidden">
                        <CardHeader className="pb-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle>{cap.sessionName}</CardTitle>
                                    <p className="text-sm text-muted-foreground">
                                        {cap.startTime} - {cap.endTime}
                                    </p>
                                </div>
                                <Badge variant={soldPercent >= 90 ? 'destructive' : 'secondary'}>
                                    {soldPercent}% Sold
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Visual Progress Bar */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Occupancy (Admitted)</span>
                                    <span className="font-bold">{cap.admitted} / {cap.maxCapacity}</span>
                                </div>
                                <div className="h-4 w-full bg-secondary rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full transition-all duration-500 ${getStatusColor(admittedPercent)}`} 
                                        style={{ width: `${admittedPercent}%` }}
                                    />
                                </div>
                            </div>

                             {/* Stats Grid */}
                            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-primary">{cap.available}</div>
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Available</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold">{cap.pending}</div>
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Pending</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold">{cap.admitted}</div>
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Checked In</div>
                                </div>
                            </div>
                            
                            {soldPercent >= 100 && (
                                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded text-sm">
                                    <AlertTriangle className="w-4 h-4" />
                                    <span>Session is fully booked. No new tickets can be sold.</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
          </div>
      )}
    </div>
  );
}
