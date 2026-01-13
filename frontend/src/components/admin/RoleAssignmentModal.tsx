'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { X, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Role {
  id: string;
  name: string;
  display_name?: string;
  description?: string;
}

interface RoleAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  currentRoles: string[];
  onRolesUpdated: (newRoles: string[]) => void;
}

export function RoleAssignmentModal({
  isOpen,
  onClose,
  userId,
  userName,
  currentRoles,
  onRolesUpdated,
}: RoleAssignmentModalProps) {
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch all available roles
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.get('/admin/roles')
        .then((res) => {
          const rolesData = res.data?.data ?? res.data ?? [];
          setAllRoles(Array.isArray(rolesData) ? rolesData : []);
          
          // Map current role names to IDs
          const currentRoleIds = rolesData
            .filter((r: Role) => currentRoles.includes(r.name))
            .map((r: Role) => r.id);
          setSelectedRoleIds(currentRoleIds);
        })
        .catch((err) => {
          console.error('Failed to fetch roles:', err);
          toast.error('Failed to load roles');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, currentRoles]);

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    );
  };

  const handleSave = async () => {
    if (selectedRoleIds.length === 0) {
      toast.error('User must have at least one role');
      return;
    }

    setSaving(true);
    try {
      await api.put(`/admin/users/${userId}/roles`, { roleIds: selectedRoleIds });
      
      // Get the new role names
      const newRoleNames = allRoles
        .filter((r) => selectedRoleIds.includes(r.id))
        .map((r) => r.name);
      
      onRolesUpdated(newRoleNames);
      toast.success('Roles updated successfully');
      onClose();
    } catch (error) {
      console.error('Failed to update roles:', error);
      toast.error('Failed to update roles');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-xl font-bold">Manage Roles</h2>
            <p className="text-muted-foreground text-sm">
              Assign roles to <span className="font-medium text-foreground">{userName}</span>
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {allRoles.map((role) => {
                const isSelected = selectedRoleIds.includes(role.id);
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => toggleRole(role.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-primary/10 border-primary'
                        : 'bg-background border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="text-left">
                      <div className="font-medium">
                        {role.display_name || role.name}
                      </div>
                      {role.description && (
                        <div className="text-xs text-muted-foreground">
                          {role.description}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <div className="bg-primary rounded-full p-1">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}

              {allRoles.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No roles available
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-6 border-t">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
