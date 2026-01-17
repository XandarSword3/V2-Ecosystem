'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Save, Shield, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Permission {
    id: string;
    slug: string;
    description: string;
    module_slug: string;
}

interface PermissionOverride {
    permission_id: string;
    is_granted: boolean;
}

export default function UserDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // State for overrides
  const [overrides, setOverrides] = useState<Record<string, boolean>>({}); // permissionId -> is_granted

  useEffect(() => {
    if (id) {
        Promise.all([
            api.get(`/admin/users/${id}`),
            api.get('/admin/permissions')
        ]).then(([userRes, permRes]) => {
            const userPayload = userRes.data?.data ?? userRes.data ?? null;
            if (userPayload) {
                setUser(userPayload);
                // Initialize overrides from user data
                const initialOverrides: Record<string, boolean> = {};
                (userPayload.user_permissions_overrides || []).forEach((p: { permission_id: string; is_granted: boolean }) => {
                    initialOverrides[p.permission_id] = p.is_granted;
                });
                setOverrides(initialOverrides);
            }
            const permsPayload = permRes.data?.data ?? permRes.data ?? [];
            setAllPermissions(Array.isArray(permsPayload) ? permsPayload : []);
            setLoading(false);
        }).catch(err => {
            toast.error('Failed to load user data');
            console.error(err);
        });
    }
  }, [id]);

  const handleSaveOverrides = async () => {
      setSaving(true);
      try {
          // Convert map to array
          const permissionsPayload = Object.entries(overrides).map(([pid, granted]) => ({
              permission_id: pid,
              is_granted: granted
          }));

          await api.put(`/admin/users/${id}/permissions`, { permissions: permissionsPayload });
          toast.success('Permissions updated successfully');
          router.refresh(); // Refresh to ensure data consistency
      } catch (error) {
          toast.error('Failed to save permissions');
      } finally {
          setSaving(false);
      }
  };

  const toggleOverride = (permissionId: string, value: boolean | undefined) => {
      const newOverrides = { ...overrides };
      if (value === undefined) {
          delete newOverrides[permissionId]; // Remove override (reset to role default)
      } else {
          newOverrides[permissionId] = value;
      }
      setOverrides(newOverrides);
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!user) return <div className="p-8">User not found</div>;

  // Group permissions by module
  const permissionsByModule = allPermissions.reduce((acc, perm) => {
      if (!acc[perm.module_slug]) acc[perm.module_slug] = [];
      acc[perm.module_slug].push(perm);
      return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
           <h1 className="text-2xl font-bold">{user.full_name}</h1>
           <p className="text-muted-foreground">{user.email}</p>
        </div>
        <div className="ml-auto flex gap-2">
             <Button variant="outline">Edit Profile</Button> 
             {/* Profile editing not implemented in this snippet, focusing on permissions as requested */}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-6">
              <Card>
                  <CardHeader>
                      <CardTitle>Roles</CardTitle>
                      <CardDescription>
                          Assigned roles determine default permissions.
                      </CardDescription>
                  </CardHeader>
                  <CardContent>
                      <div className="flex flex-wrap gap-2">
                          {user.roles && user.roles.map((r: string) => (
                              <div key={r} className="bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm font-medium">
                                  {r}
                              </div>
                          ))}
                      </div>
                      <Button variant="ghost" className="px-0 mt-4 text-primary hover:bg-transparent hover:underline" onClick={() => {
                          // TODO: Open role assignment modal (reuse existing logic from UserEditModal or similar)
                          toast.info("Role editing modal would open here");
                      }}>
                          Manage Roles
                      </Button>
                  </CardContent>
              </Card>

               <Card>
                  <CardHeader>
                      <CardTitle>Account Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Active</span>
                          <span className={user.is_active ? "text-green-600 font-medium" : "text-destructive"}>
                              {user.is_active ? "Yes" : "No"}
                          </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Online</span>
                          <span className={user.is_online ? "text-green-600 font-medium" : "text-muted-foreground"}>
                              {user.is_online ? "Yes" : "No"}
                          </span>
                      </div>
                  </CardContent>
              </Card>
          </div>

          <div className="md:col-span-2">
              <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-primary" />
                            Permissions Overrides
                        </CardTitle>
                        <CardDescription>
                            Fine-tune access by granting specific permissions. 
                            Green = Granted (Override).
                        </CardDescription>
                      </div>
                      <Button onClick={handleSaveOverrides} disabled={saving}>
                          {saving ? 'Saving...' : 'Save Changes'}
                      </Button>
                  </CardHeader>
                  <CardContent>
                      <div className="space-y-6">
                          {Object.entries(permissionsByModule).map(([module, perms]) => (
                              <div key={module} className="border rounded-lg p-4">
                                  <h3 className="font-semibold capitalize mb-3 text-lg flex items-center gap-2">
                                      {module} <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">Module</span>
                                  </h3>
                                  <div className="space-y-2">
                                      {perms.map(perm => {
                                          const roleHasIt = user.role_permissions?.includes(perm.slug);
                                          const override = overrides[perm.id];
                                          const isEffective = override === true || (roleHasIt && override !== false);
                                          
                                          return (
                                              <div key={perm.id} className="flex items-center justify-between py-2 border-b last:border-0 pl-2 hover:bg-muted/30 rounded transition-colors">
                                                  <div>
                                                      <div className="font-medium text-sm">{perm.slug}</div>
                                                      <div className="text-xs text-muted-foreground">{perm.description}</div>
                                                  </div>
                                                  <div className="flex items-center gap-3">
                                                      {roleHasIt && (
                                                          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mr-2">
                                                              Inherited
                                                          </span>
                                                      )}
                                                      
                                                      {/* Simple Toggle - For now just "Grant" override vs "Default" */}
                                                      <div className="flex items-center border rounded overflow-hidden">
                                                          <button 
                                                            onClick={() => toggleOverride(perm.id, undefined)}
                                                            className={`px-3 py-1 text-xs ${override === undefined ? 'bg-muted text-muted-foreground font-medium' : 'hover:bg-muted/50'}`}
                                                          >
                                                              Default
                                                          </button>
                                                          <button 
                                                            onClick={() => toggleOverride(perm.id, true)}
                                                            className={`px-3 py-1 text-xs ${override === true ? 'bg-green-100 text-green-700 font-bold border-l border-green-200' : 'hover:bg-green-50 border-l'}`}
                                                          >
                                                              Grant
                                                          </button>
                                                          {/* Deny option hidden for now unless strictly needed, but logic supports it */}
                                                      </div>
                                                  </div>
                                              </div>
                                          );
                                      })}
                                  </div>
                              </div>
                          ))}
                      </div>
                  </CardContent>
              </Card>
          </div>
      </div>
    </div>
  );
}
