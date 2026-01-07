'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';

export default function RolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Placeholder for full role editor implementation
  // Ideally this would show a list of roles, and clicking one opens a permissions editor.
  
  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const res = await api.get('/admin/roles');
      if(res.data) setRoles(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roles & Permissions</h1>
          <p className="text-muted-foreground">
            Manage system roles and their default permission sets.
          </p>
        </div>
        <Button>+ Create Role</Button>
      </div>

       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading ? <p>Loading...</p> : roles.map(role => (
              <Card key={role.id} className="cursor-pointer hover:border-primary/50 transition-colors">
                  <CardHeader>
                      <CardTitle>{role.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">{role.description}</p>
                      <div className="text-xs font-mono bg-muted p-2 rounded">
                          {role.users_count || 0} users
                      </div>
                      {/* TODO: Add Edit Permissions Button that opens Modal */}
                  </CardContent>
              </Card>
          ))}
       </div>
    </div>
  );
}
