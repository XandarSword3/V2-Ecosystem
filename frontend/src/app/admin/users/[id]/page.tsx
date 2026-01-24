'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Save, Shield, Check, User, Mail, Phone, Edit2, X } from 'lucide-react';
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

interface Role {
    id: string;
    name: string;
    display_name: string;
}

export default function UserDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  
  // Profile edit state
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    is_active: true,
  });

  // Role selection state
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  
  // State for overrides
  const [overrides, setOverrides] = useState<Record<string, boolean>>({}); // permissionId -> is_granted

  useEffect(() => {
    if (id) {
        Promise.all([
            api.get(`/admin/users/${id}`),
            api.get('/admin/permissions'),
            api.get('/admin/roles')
        ]).then(([userRes, permRes, rolesRes]) => {
            const userPayload = userRes.data?.data ?? userRes.data ?? null;
            if (userPayload) {
                setUser(userPayload);
                // Initialize profile form
                setProfileForm({
                    full_name: userPayload.full_name || '',
                    email: userPayload.email || '',
                    phone: userPayload.phone || '',
                    is_active: userPayload.is_active ?? true,
                });
                // Initialize selected roles
                setSelectedRoles(userPayload.roles || []);
                // Initialize overrides from user data
                const initialOverrides: Record<string, boolean> = {};
                (userPayload.user_permissions_overrides || []).forEach((p: { permission_id: string; is_granted: boolean }) => {
                    initialOverrides[p.permission_id] = p.is_granted;
                });
                setOverrides(initialOverrides);
            }
            const permsPayload = permRes.data?.data ?? permRes.data ?? [];
            setAllPermissions(Array.isArray(permsPayload) ? permsPayload : []);
            const rolesPayload = rolesRes.data?.data ?? rolesRes.data ?? [];
            setAllRoles(Array.isArray(rolesPayload) ? rolesPayload : []);
            setLoading(false);
        }).catch(err => {
            toast.error('Failed to load user data');
            console.error(err);
            setLoading(false);
        });
    }
  }, [id]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.patch(`/admin/users/${id}`, profileForm);
      setUser({ ...user, ...profileForm });
      setEditingProfile(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveRoles = async () => {
    setSaving(true);
    try {
      await api.put(`/admin/users/${id}/roles`, { roles: selectedRoles });
      setUser({ ...user, roles: selectedRoles });
      setShowRoleModal(false);
      toast.success('Roles updated successfully');
    } catch (error) {
      toast.error('Failed to update roles');
    } finally {
      setSaving(false);
    }
  };

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
             <Button variant="outline" onClick={() => setEditingProfile(true)}>
               <Edit2 className="h-4 w-4 mr-2" />
               Edit Profile
             </Button> 
        </div>
      </div>

      {/* Profile Edit Modal */}
      {editingProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Edit Profile
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setEditingProfile(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Full Name</label>
                <input
                  type="text"
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    className="w-full border rounded-md pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="tel"
                    className="w-full border rounded-md pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <label className="text-sm font-medium">Account Active</label>
                <button
                  type="button"
                  onClick={() => setProfileForm({ ...profileForm, is_active: !profileForm.is_active })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    profileForm.is_active ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      profileForm.is_active ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditingProfile(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSaveProfile} disabled={savingProfile} className="flex-1">
                  {savingProfile ? 'Saving...' : <><Save className="h-4 w-4 mr-2" /> Save</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Role Management Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Manage Roles
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowRoleModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                Select the roles to assign to this user.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {allRoles.map((role) => (
                  <label
                    key={role.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedRoles.includes(role.name)
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role.name)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRoles([...selectedRoles, role.name]);
                        } else {
                          setSelectedRoles(selectedRoles.filter((r) => r !== role.name));
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <div>
                      <div className="font-medium">{role.display_name || role.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{role.name}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowRoleModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSaveRoles} disabled={saving} className="flex-1">
                  {saving ? 'Saving...' : <><Save className="h-4 w-4 mr-2" /> Save</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
                      <Button variant="ghost" className="px-0 mt-4 text-primary hover:bg-transparent hover:underline" onClick={() => setShowRoleModal(true)}>
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
