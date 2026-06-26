'use client';

import { use, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Calendar, Clock, Users, ArrowRight, MoreHorizontal } from 'lucide-react';
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
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        // Using the public sessions endpoint. 
        // Note: The backend controller needs to support ?moduleId or we use the generic route
        // Assuming /api/:slug/sessions follows the pattern
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
        <Button>
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
                           <Button variant="ghost" size="icon" className="h-8 w-8">
                             <MoreHorizontal className="w-4 h-4" />
                           </Button>
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
                        
                        <Button className="w-full mt-4" variant="outline" size="sm">
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
