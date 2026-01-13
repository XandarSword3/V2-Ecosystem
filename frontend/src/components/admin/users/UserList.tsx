'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { Search, Filter, MoreVertical, Edit2, Trash2, Shield, Circle, User } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  is_active: boolean;
  is_online?: boolean; // From backend
  roles: string[];
}

interface UserListProps {
  type: 'customer' | 'staff' | 'admin';
  title: string;
}

export default function UserList({ type, title }: UserListProps) {
  const t = useTranslations('adminUsers');
  const tCommon = useTranslations('adminCommon');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const router = useRouter();
  const { user: currentUser } = useAuth();
  
  // Refresh interval for online status
  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 10000); // Poll every 10s for presence
    return () => clearInterval(interval);
  }, [type, search]);

  const fetchUsers = async () => {
    try {
      // Assuming GET /admin/users supports ?type=... and ?search=...
      const res = await api.get(`/admin/users?type=${type}&search=${search}`);
      // Backend returns { success: true, data: [...] }
      const payload = res.data?.data ?? res.data ?? [];
      setUsers(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error('Failed to fetch users', error);
      // Don't toast on polling error to avoid spam
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm(tCommon('confirmDelete'))) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      toast.success(t('userDeleted'));
      fetchUsers();
    } catch (error) {
      toast.error(t('errors.failedToDelete'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        {/* Only show 'Create' button for staff/admin if needed, or all types */}
        <Button onClick={() => router.push(`/admin/users/create?type=${type}`)}>
          + {t('addUser')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={tCommon('searchPlaceholder')}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pl-8 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {/* Additional filters could go here */}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="h-10 px-4 font-medium align-middle">{tCommon('tables.name')}</th>
                  <th className="h-10 px-4 font-medium align-middle">{tCommon('status')}</th>
                  <th className="h-10 px-4 font-medium align-middle">{t('roles')}</th>
                  <th className="h-10 px-4 font-medium align-middle">{t('joined')}</th>
                  <th className="h-10 px-4 font-medium align-middle text-right">{tCommon('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                   <tr><td colSpan={5} className="p-4 text-center">{tCommon('loading')}</td></tr>
                ) : users.length === 0 ? (
                   <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">{tCommon('noResults')}</td></tr>
                ) : (
                  users.map((user) => (
                    <tr 
                      key={user.id} 
                      className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted cursor-pointer"
                      onClick={() => router.push(`/admin/users/${user.id}`)}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                                {user.full_name?.[0] || <User size={16} />}
                            </div>
                            <div>
                                <div className="font-medium">{user.full_name}</div>
                                <div className="text-xs text-muted-foreground">{user.email}</div>
                            </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                           {user.is_online ? (
                               <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-green-500/15 text-green-700">
                                   <Circle className="w-2 h-2 mr-1 fill-current" />
                                   {t('online')}
                               </span>
                           ) : (
                               <span className="text-muted-foreground text-xs pl-2">{t('offline')}</span>
                           )}
                           {!user.is_active && (
                               <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-destructive/15 text-destructive">
                                   {tCommon('inactive')}
                               </span>
                           )}
                        </div>
                      </td>
                      <td className="p-4">
                         <div className="flex flex-wrap gap-1">
                            {user.roles && user.roles.length > 0 ? (
                                user.roles.map(r => (
                                    <span key={r} className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                                        {r}
                                    </span>
                                ))
                            ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                            )}
                         </div>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {format(new Date(user.created_at), 'MMM d, yyyy')}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/users/${user.id}`)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(user.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
