'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';
import { Shield, Users, Plus, X, Check, Edit2 } from 'lucide-react';

interface Role {
  id: string;
  name: string;
  description?: string;
  users_count?: number;
  permissions_count?: number;
}

interface Permission {
  id: string;
  slug: string;
  name?: string;
  description?: string;
  module_slug?: string;
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]); // permission IDs
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Create role form
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [rolesRes, permsRes] = await Promise.all([
        api.get('/admin/roles'),
        api.get('/admin/permissions')
      ]);
      const rolesPayload = rolesRes.data?.data ?? rolesRes.data ?? [];
      setRoles(Array.isArray(rolesPayload) ? rolesPayload : []);
      const permsPayload = permsRes.data?.data ?? permsRes.data ?? [];
      setPermissions(Array.isArray(permsPayload) ? permsPayload : []);
      // Clear any previous auth error on success
      setAuthError(null);
    } catch (error: any) {
      console.error(error);

      // Give clearer feedback for auth/permission issues
      if (error.response?.status === 401) {
        setAuthError('You must be logged in to view roles. Please login.');
      } else if (error.response?.status === 403) {
        setAuthError('Access denied. You need the super_admin role to view and manage roles.');
      } else {
        toast.error('Failed to load roles');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      toast.error('Role name is required');
      return;
    }
    
    setSaving(true);
    try {
      const res = await api.post('/admin/roles', {
        name: newRoleName.toLowerCase().replace(/\s+/g, '_'),
        description: newRoleDescription
      });
      
      if (res.data?.data) {
        setRoles([...roles, res.data.data]);
      }
      toast.success('Role created successfully');
      setShowCreateModal(false);
      setNewRoleName('');
      setNewRoleDescription('');
      fetchData(); // Refresh
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create role');
    } finally {
      setSaving(false);
    }
  };

  const openPermissionsModal = async (role: Role) => {
    setSelectedRole(role);
    setShowPermissionsModal(true);
    
    // Fetch current role permissions
    try {
      const res = await api.get(`/admin/roles/${role.id}/permissions`);
      setRolePermissions(res.data?.data || []);
    } catch (e) {
      console.error(e);
      setRolePermissions([]);
    }
  };

  const togglePermission = (permissionId: string) => {
    setRolePermissions(prev => 
      prev.includes(permissionId)
        ? prev.filter(id => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const saveRolePermissions = async () => {
    if (!selectedRole) return;
    
    setSaving(true);
    try {
      await api.put(`/admin/roles/${selectedRole.id}/permissions`, {
        permission_ids: rolePermissions
      });
      toast.success('Permissions updated successfully');
      setShowPermissionsModal(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  // Group permissions by module
  const permissionsByModule = permissions.reduce((acc, perm) => {
    const module = perm.module_slug || 'other';
    if (!acc[module]) acc[module] = [];
    acc[module].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roles & Permissions</h1>
          <p className="text-muted-foreground">
            Manage system roles and their default permission sets.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Role
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="col-span-full text-center py-8 text-muted-foreground">Loading...</p>
        ) : authError ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            <p className="mb-2 text-sm">{authError}</p>
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" onClick={() => (window.location.href = '/login')}>Login</Button>
              <Button variant="ghost" onClick={() => window.location.reload()}>Retry</Button>
            </div>
          </div>
        ) : roles.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground space-y-2">
            <p>No roles found</p>
            <p className="text-xs">If this is a fresh install, run the seed script to create default roles and an admin user.</p>
          </div>
        ) : (
          roles.map(role => (
            <Card key={role.id} className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    {role.name}
                  </CardTitle>
                </div>
                {role.description && (
                  <CardDescription>{role.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>{role.users_count || 0} users</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <span>{role.permissions_count || 0} perms</span>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => openPermissionsModal(role)}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Permissions
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Role Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Create New Role</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowCreateModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Role Name *</label>
                <Input
                  placeholder="e.g., pool_manager"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use lowercase with underscores (e.g., restaurant_staff)
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Description</label>
                <Input
                  placeholder="Describe this role..."
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleCreateRole} disabled={saving}>
                  {saving ? 'Creating...' : 'Create Role'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Editor Modal */}
      {showPermissionsModal && selectedRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-background rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b">
              <div>
                <h2 className="text-xl font-bold">Edit Permissions</h2>
                <p className="text-muted-foreground text-sm">
                  Role: <span className="font-medium text-foreground">{selectedRole.name}</span>
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowPermissionsModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {Object.entries(permissionsByModule).map(([module, perms]) => (
                <div key={module} className="border rounded-lg p-4">
                  <h3 className="font-semibold capitalize mb-3 text-lg flex items-center gap-2">
                    {module}
                    <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      Module
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {perms.map(perm => {
                      const isSelected = rolePermissions.includes(perm.id);
                      return (
                        <div 
                          key={perm.id}
                          className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => togglePermission(perm.id)}
                        >
                          <div>
                            <div className="font-medium text-sm">{perm.slug}</div>
                            {perm.description && (
                              <div className="text-xs text-muted-foreground">{perm.description}</div>
                            )}
                          </div>
                          <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected 
                              ? 'bg-primary border-primary text-primary-foreground' 
                              : 'border-muted-foreground/30'
                          }`}>
                            {isSelected && <Check className="h-4 w-4" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-6 border-t flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowPermissionsModal(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={saveRolePermissions} disabled={saving}>
                {saving ? 'Saving...' : 'Save Permissions'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
