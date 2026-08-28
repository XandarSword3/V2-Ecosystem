'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Save, User, Mail, Phone, Edit2, X } from 'lucide-react';
import { toast } from 'sonner';

export default function UserDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  
  // Profile edit state
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    is_active: true,
  });

  // Staff employment-record state (staff_profiles)
  const [staffProfile, setStaffProfile] = useState<any>(null);
  const [staffForm, setStaffForm] = useState({
    employee_id: '',
    position: '',
    department: '',
    employment_type: '',
    hire_date: '',
    base_wage: '' as string | number,
    wage_currency: 'USD',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: '',
    notes: '',
  });
  const [savingStaffProfile, setSavingStaffProfile] = useState(false);

  useEffect(() => {
    if (id) {
        Promise.all([
            api.get(`/admin/users/${id}`),
            api.get(`/admin/users/${id}/staff-profile`)
        ]).then(([userRes, staffRes]) => {
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
                // Initialize staff employment record (if the user has one)
                const staffPayload = staffRes.data?.data ?? staffRes.data ?? null;
                setStaffProfile(staffPayload);
                setStaffForm({
                    employee_id: staffPayload?.employee_id || '',
                    position: staffPayload?.position || '',
                    department: staffPayload?.department || '',
                    employment_type: staffPayload?.employment_type || '',
                    hire_date: staffPayload?.hire_date || '',
                    base_wage: staffPayload?.base_wage ?? '',
                    wage_currency: staffPayload?.wage_currency || 'USD',
                    emergency_contact_name: staffPayload?.emergency_contact_name || '',
                    emergency_contact_phone: staffPayload?.emergency_contact_phone || '',
                    emergency_contact_relationship: staffPayload?.emergency_contact_relationship || '',
                    notes: staffPayload?.notes || '',
                });
            }
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
      await api.put(`/admin/users/${id}`, profileForm);
      setUser({ ...user, ...profileForm });
      setEditingProfile(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveStaffProfile = async () => {
    setSavingStaffProfile(true);
    try {
      const payload = {
        ...staffForm,
        hire_date: staffForm.hire_date || null,
        base_wage: staffForm.base_wage === '' || staffForm.base_wage === null ? null : Number(staffForm.base_wage),
        wage_currency: staffForm.wage_currency || null,
      };
      await api.put(`/admin/users/${id}/staff-profile`, payload);
      setStaffProfile(payload);
      toast.success('Staff profile updated successfully');
    } catch (error) {
      toast.error('Failed to update staff profile');
    } finally {
      setSavingStaffProfile(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!user) return <div className="p-8">User not found</div>;

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
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    profileForm.is_active ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                      profileForm.is_active ? 'translate-x-5' : 'translate-x-0'
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

      <div className="space-y-6">
          <Card>
              <CardHeader>
                  <CardTitle>Authorization</CardTitle>
                  <CardDescription>
                      users.scope is the single source of truth for access. Legacy role tables are frozen and no longer enforce anything.
                  </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div>
                      <div className="text-sm font-medium mb-1">Scope</div>
                      <div className="flex flex-wrap gap-2">
                          <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                              {user.scope || 'customer'}
                          </div>
                      </div>
                  </div>
                  <div>
                      <div className="text-sm font-medium mb-1">Derived roles</div>
                      <div className="flex flex-wrap gap-2">
                          {user.roles && user.roles.length > 0 ? user.roles.map((r: string) => (
                              <div key={r} className="bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm font-medium">
                                  {r}
                              </div>
                          )) : (
                              <span className="text-xs text-muted-foreground">-</span>
                          )}
                      </div>
                  </div>
                  {user.staff_profile?.department && (
                      <div>
                          <div className="text-sm font-medium mb-1">Department / Sub-role</div>
                          <div className="bg-muted text-foreground px-3 py-1 rounded-full text-sm font-medium inline-block">
                              {user.staff_profile.department}
                          </div>
                      </div>
                  )}
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

              {['property_staff', 'property_manager'].includes(user.scope) && (
                  <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                          <div>
                              <CardTitle>Staff Profile</CardTitle>
                              <CardDescription>
                                  Employment record — position, department, wage and emergency contact.
                              </CardDescription>
                          </div>
                          <Button onClick={handleSaveStaffProfile} disabled={savingStaffProfile}>
                              {savingStaffProfile ? 'Saving...' : <><Save className="h-4 w-4 mr-2" /> Save</>}
                          </Button>
                      </CardHeader>
                      <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                              <div>
                                  <label className="text-sm font-medium mb-1 block">Employee ID</label>
                                  <input
                                      type="text"
                                      className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                      value={staffForm.employee_id}
                                      onChange={(e) => setStaffForm({ ...staffForm, employee_id: e.target.value })}
                                  />
                              </div>
                              <div>
                                  <label className="text-sm font-medium mb-1 block">Position</label>
                                  <input
                                      type="text"
                                      className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                      value={staffForm.position}
                                      onChange={(e) => setStaffForm({ ...staffForm, position: e.target.value })}
                                  />
                              </div>
                              <div>
                                  <label className="text-sm font-medium mb-1 block">Department / Sub-role</label>
                                  <input
                                      type="text"
                                      placeholder="front_desk, housekeeping, restaurant…"
                                      className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                      value={staffForm.department}
                                      onChange={(e) => setStaffForm({ ...staffForm, department: e.target.value })}
                                  />
                              </div>
                              <div>
                                  <label className="text-sm font-medium mb-1 block">Employment Type</label>
                                  <select
                                      className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                      value={staffForm.employment_type}
                                      onChange={(e) => setStaffForm({ ...staffForm, employment_type: e.target.value })}
                                  >
                                      <option value="">Select…</option>
                                      <option value="full_time">Full-time</option>
                                      <option value="part_time">Part-time</option>
                                      <option value="seasonal">Seasonal</option>
                                      <option value="contract">Contract</option>
                                  </select>
                              </div>
                              <div>
                                  <label className="text-sm font-medium mb-1 block">Hire Date</label>
                                  <input
                                      type="date"
                                      className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                      value={staffForm.hire_date}
                                      onChange={(e) => setStaffForm({ ...staffForm, hire_date: e.target.value })}
                                  />
                              </div>
                              <div>
                                  <label className="text-sm font-medium mb-1 block">Base Wage</label>
                                  <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                      value={staffForm.base_wage}
                                      onChange={(e) => setStaffForm({ ...staffForm, base_wage: e.target.value })}
                                  />
                              </div>
                              <div>
                                  <label className="text-sm font-medium mb-1 block">Wage Currency</label>
                                  <input
                                      type="text"
                                      maxLength={3}
                                      className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                      value={staffForm.wage_currency}
                                      onChange={(e) => setStaffForm({ ...staffForm, wage_currency: e.target.value })}
                                  />
                              </div>
                          </div>

                          <div className="pt-2">
                              <h3 className="text-sm font-semibold mb-2">Emergency Contact</h3>
                              <div className="grid grid-cols-3 gap-3">
                                  <input
                                      type="text"
                                      placeholder="Name"
                                      className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                      value={staffForm.emergency_contact_name}
                                      onChange={(e) => setStaffForm({ ...staffForm, emergency_contact_name: e.target.value })}
                                  />
                                  <input
                                      type="text"
                                      placeholder="Phone"
                                      className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                      value={staffForm.emergency_contact_phone}
                                      onChange={(e) => setStaffForm({ ...staffForm, emergency_contact_phone: e.target.value })}
                                  />
                                  <input
                                      type="text"
                                      placeholder="Relationship"
                                      className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                      value={staffForm.emergency_contact_relationship}
                                      onChange={(e) => setStaffForm({ ...staffForm, emergency_contact_relationship: e.target.value })}
                                  />
                              </div>
                          </div>

                          <div>
                              <label className="text-sm font-medium mb-1 block">Notes</label>
                              <textarea
                                  rows={2}
                                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                  value={staffForm.notes}
                                  onChange={(e) => setStaffForm({ ...staffForm, notes: e.target.value })}
                              />
                          </div>
                      </CardContent>
                  </Card>
              )}
      </div>
    </div>
  );
}
