'use client';

import { use, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Calendar, Clock, Users, ArrowRight, MoreHorizontal, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/Badge';

interface Session {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  is_active: boolean;
  price: number;
}

export default function ModuleSessionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const routeParams = useParams();
  const propertySlug = (routeParams?.property as string) || '';
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/${slug}/sessions`); 
        setSessions(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch sessions', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [slug]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold capitalize">{slug} Sessions</h1>
           <p className="text-muted-foreground">Manage and view scheduled sessions</p>
        </div>
        <Button onClick={() => window.location.href = `/${propertySlug}/admin/${slug}/sessions`}>
          <Calendar className="w-4 h-4 mr-2" />
          Manage Schedule
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
             [1,2,3].map(i => <div key={i} className="h-40 bg-muted/20 animate-pulse rounded-lg" />)
        ) : sessions.length === 0 ? (
            <Card className="col-span-full py-12 text-center text-muted-foreground bg-muted/10 border-dashed">
                <CardContent>
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>No active sessions found for this module.</p>
                </CardContent>
            </Card>
        ) : (
            sessions.map((session) => (
                <Card key={session.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <div className="h-2 w-full bg-primary/20" />
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                           <Badge variant={session.is_active ? 'default' : 'secondary'}>
                             {session.is_active ? 'Active' : 'Inactive'}
                           </Badge>
                           <div className="relative">
                             <Button
                               variant="ghost"
                               size="icon"
                               className="h-8 w-8"
                               onClick={() => setMenuOpen(menuOpen === session.id ? null : session.id)}
                               aria-label="Session options"
                             >
                               <MoreHorizontal className="w-4 h-4" />
                             </Button>
                             {menuOpen === session.id && (
                               <div className="absolute right-0 top-8 z-10 w-40 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1">
                                 <button
                                   className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                                   onClick={() => { setMenuOpen(null); window.location.href = `/${propertySlug}/admin/${slug}/sessions`; }}
                                 >
                                   Edit Session
                                 </button>
                                 <button
                                   className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                                   onClick={async () => {
                                     await api.patch(`/${slug}/sessions/${session.id}`, { is_active: !session.is_active });
                                     setSessions(prev => prev.map(s => s.id === session.id ? { ...s, is_active: !s.is_active } : s));
                                     setMenuOpen(null);
                                   }}
                                 >
                                   {session.is_active ? 'Deactivate' : 'Activate'}
                                 </button>
                               </div>
                             )}
                           </div>
                        </div>
                        <CardTitle className="text-lg">{session.name}</CardTitle>
                        <CardDescription>
                            Capacity: {session.max_capacity} Guests
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3 text-sm">
                            <div className="flex items-center text-muted-foreground">
                                <Clock className="w-4 h-4 mr-2" />
                                {session.start_time} - {session.end_time}
                            </div>
                            <div className="flex items-center text-muted-foreground">
                                <Users className="w-4 h-4 mr-2" />
                                {session.max_capacity} Max Capacity
                            </div>
                        </div>
                        
                        <Button
                          className="w-full mt-4"
                          variant="outline"
                          size="sm"
                          onClick={() => window.location.href = `/${propertySlug}/admin/${slug}/tickets`}
                        >
                            View Bookings <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </CardContent>
                </Card>
            ))
        )}
      </div>
    </div>
  );
}
