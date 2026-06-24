'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { X, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type UserScope = 
  | 'super_admin'
  | 'platform_admin'
  | 'tenant_owner'
  | 'tenant_admin'
  | 'property_manager'
  | 'property_staff'
  | 'customer';

interface ScopeOption {
  value: UserScope;
  label: string;
  description: string;
  color: string;
}

const SCOPE_OPTIONS: ScopeOption[] = [
  {
    value: 'super_admin',
    label: 'Super Admin',
    description: 'V2 platform itself. No tenant, no property.',
    color: '#FF4D4F',
  },
  {
    value: 'platform_admin',
    label: 'Platform Admin',
    description: 'Platform-level operator within platform tenant.',
    color: '#9B5DE5',
  },
  {
    value: 'tenant_owner',
    label: 'Tenant Owner',
    description: 'Full control of tenant + all properties.',
    color: '#F5A623',
  },
  {
    value: 'tenant_admin',
    label: 'Tenant Admin',
    description: 'Tenant-wide admin (no billing/deletion).',
    color: '#52C41A',
  },
  {
    value: 'property_manager',
    label: 'Property Manager',
    description: 'Scoped to specific properties.',
    color: '#3A8DFF',
  },
  {
    value: 'property_staff',
    label: 'Property Staff',
    description: 'Scoped to specific properties.',
    color: '#5B8DEF',
  },
  {
    value: 'customer',
    label: 'Customer',
    description: 'Guest of a tenant.',
    color: '#8A95A5',
  },
];

interface ScopeAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  currentScope: UserScope;
  onScopeUpdated: (newScope: UserScope) => void;
}

export function ScopeAssignmentModal({
  isOpen,
  onClose,
  userId,
  userName,
  currentScope,
  onScopeUpdated,
}: ScopeAssignmentModalProps) {
  const [selectedScope, setSelectedScope] = useState<UserScope>(currentScope);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/admin/users/${userId}/scope`, { scope: selectedScope });
      onScopeUpdated(selectedScope);
      toast.success('Scope updated successfully');
      onClose();
    } catch (error) {
      console.error('Failed to update scope:', error);
      toast.error('Failed to update scope');
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
            <h2 className="text-xl font-bold">Manage Scope</h2>
            <p className="text-muted-foreground text-sm">
              Assign scope to <span className="font-medium text-foreground">{userName}</span>
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-2">
            {SCOPE_OPTIONS.map((option) => {
              const isSelected = selectedScope === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedScope(option.value)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    isSelected
                      ? 'bg-primary/10 border-primary'
                      : 'bg-background border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="text-left">
                    <div className="font-medium flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: option.color }}
                      />
                      {option.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {option.description}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="bg-primary rounded-full p-1">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-6 border-t">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={saving}
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
