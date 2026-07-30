'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { useSiteSettings } from '@/lib/settings-context';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  QrCode,
  CheckCircle2,
  XCircle,
  PauseCircle,
  X,
  LayoutGrid,
  Map,
  Layers,
} from 'lucide-react';

// Matches backend service_locations shape (see dynamic-module.router.ts
// fetchServiceLocationsWithOccupancy). Deliberately no `capacity` and no
// stored `is_available` — occupancy is derived server-side from active
// orders, not toggled by staff. See REFIT_PLAN.md Phase 3.
interface ServiceLocation {
  id: string;
  name: string;
  qr_code: string | null;
  is_active: boolean;
  is_occupied: boolean;
  sort_order: number;
}

interface QRModalState {
  open: boolean;
  location: ServiceLocation | null;
}

export default function DynamicTablesPage() {
  const params = useParams();
  const { modules } = useSiteSettings();
  const tc = useTranslations('adminCommon');
  const rawSlug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const slug = rawSlug ? decodeURIComponent(rawSlug).toLowerCase() : '';
  const currentModule = modules.find(m => m.slug.toLowerCase() === slug);

  const [locations, setLocations] = useState<ServiceLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('map');
  const [showModal, setShowModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<ServiceLocation | null>(null);
  const [formData, setFormData] = useState({ name: '' });
  const [qrModal, setQrModal] = useState<QRModalState>({ open: false, location: null });

  const fetchLocations = useCallback(async () => {
    if (!currentModule) return;
    try {
      const response = await api.get(`/${slug}/service-locations`);
      setLocations(response.data.data || []);
    } catch (error) {
      toast.error(tc('errors.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [currentModule, slug, tc]);

  useEffect(() => {
    if (currentModule) {
      fetchLocations();
    }
  }, [currentModule, fetchLocations]);

  const handleSubmit = async () => {
    if (!formData.name.trim() || !currentModule) {
      toast.error(tc('tables.nameRequired'));
      return;
    }

    try {
      if (editingLocation) {
        await api.put(`/${slug}/admin/service-locations/${editingLocation.id}`, { name: formData.name.trim() });
        toast.success(tc('success.updated'));
      } else {
        await api.post(`/${slug}/admin/service-locations`, { name: formData.name.trim() });
        toast.success(tc('success.created'));
      }
      setShowModal(false);
      setEditingLocation(null);
      setFormData({ name: '' });
      fetchLocations();
    } catch (error) {
      toast.error(tc('errors.failedToSave'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tc('tables.confirmDelete'))) return;
    try {
      await api.delete(`/${slug}/admin/service-locations/${id}`);
      toast.success(tc('success.deleted'));
      fetchLocations();
    } catch (error) {
      toast.error(tc('errors.failedToSave'));
    }
  };

  // Toggles whether staff can currently use this location at all (e.g. a
  // table that's out of service). This is NOT the same as occupied — that's
  // derived from active orders and can't be toggled by hand.
  const toggleActive = async (location: ServiceLocation) => {
    try {
      await api.put(`/${slug}/admin/service-locations/${location.id}`, { is_active: !location.is_active });
      setLocations((prev) => prev.map((l) => (l.id === location.id ? { ...l, is_active: !l.is_active } : l)));
    } catch (error) {
      toast.error(tc('errors.failedToSave'));
    }
  };

  const openEdit = (location: ServiceLocation) => {
    setEditingLocation(location);
    setFormData({ name: location.name });
    setShowModal(true);
  };

  if (!currentModule) return null;

  if (loading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  const availableCount = locations.filter((l) => l.is_active && !l.is_occupied).length;
  const occupiedCount = locations.filter((l) => l.is_active && l.is_occupied).length;

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{currentModule.name} {tc('tables.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {availableCount} {tc('tables.available')}, {occupiedCount} {tc('tables.occupied')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 mr-2">
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'map'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Map className="w-3.5 h-3.5" /> Floor Map
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Grid List
            </button>
          </div>
          <Button variant="outline" onClick={fetchLocations}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {tc('refresh')}
          </Button>
          <Button onClick={() => { setEditingLocation(null); setFormData({ name: '' }); setShowModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            {tc('tables.addTable')}
          </Button>
        </div>
      </div>

      {/* Visual Floor Map View */}
      {viewMode === 'map' && locations.length > 0 && (
        <Card className="border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-900 text-white p-6 rounded-2xl relative min-h-[400px]">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Map className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-lg">Interactive Service Floor Plan</h3>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Available</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse"></span> Occupied</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-600"></span> Inactive</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 py-4">
            {locations.map((loc) => (
              <motion.div
                key={loc.id}
                whileHover={{ scale: 1.05 }}
                className={`p-4 rounded-xl border-2 flex flex-col justify-between items-center text-center cursor-pointer transition-all shadow-lg ${
                  !loc.is_active
                    ? 'bg-slate-800/80 border-slate-700 text-slate-500 opacity-60'
                    : loc.is_occupied
                    ? 'bg-rose-950/60 border-rose-500/80 text-rose-200 shadow-rose-950/50'
                    : 'bg-emerald-950/60 border-emerald-500/80 text-emerald-200 shadow-emerald-950/50'
                }`}
                onClick={() => setQrModal({ open: true, location: loc })}
              >
                <div className="w-full flex justify-between items-center text-xs opacity-70 mb-2">
                  <span>Zone 1</span>
                  <QrCode className="w-3.5 h-3.5" />
                </div>
                <div className="text-xl font-extrabold tracking-wide my-2">{loc.name}</div>
                <div className="text-xs font-semibold px-2 py-0.5 rounded-full mt-2 bg-black/40">
                  {!loc.is_active ? 'Disabled' : loc.is_occupied ? 'Occupied' : 'Vacant'}
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      )}

      {/* Locations grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <AnimatePresence mode="popLayout">
          {locations.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full text-center py-12">
              <QrCode className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-500 dark:text-slate-400">{tc('tables.noTablesConfigured')}</p>
              <Button className="mt-4" onClick={() => setShowModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {tc('tables.addFirstTable')}
              </Button>
            </motion.div>
          ) : (
            [...locations].sort((a, b) => a.sort_order - b.sort_order).map((location, index) => (
              <motion.div
                key={location.id}
                variants={fadeInUp}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.03 }}
                layout
              >
                <Card className={`relative overflow-hidden ${
                  !location.is_active
                    ? 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-70'
                    : location.is_occupied
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                }`}>
                  <CardContent className="p-4 text-center">
                    <div className="text-lg font-bold text-slate-900 dark:text-white mb-2 break-words">
                      {location.name}
                    </div>
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mb-3 ${
                      !location.is_active
                        ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        : location.is_occupied
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                    }`}>
                      {!location.is_active ? (
                        <><PauseCircle className="w-3 h-3" /> Inactive</>
                      ) : location.is_occupied ? (
                        <><XCircle className="w-3 h-3" /> {tc('tables.occupied')}</>
                      ) : (
                        <><CheckCircle2 className="w-3 h-3" /> {tc('tables.available')}</>
                      )}
                    </div>
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={() => toggleActive(location)}
                        className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        title={location.is_active ? 'Deactivate' : 'Reactivate'}
                      >
                        {location.is_active ? <PauseCircle className="w-4 h-4 text-slate-500" /> : <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      </button>
                      <button onClick={() => setQrModal({ open: true, location })} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" title="View QR Code">
                        <QrCode className="w-4 h-4 text-purple-500" />
                      </button>
                      <button onClick={() => openEdit(location)} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <Edit2 className="w-4 h-4 text-blue-500" />
                      </button>
                      <button onClick={() => handleDelete(location.id)} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {editingLocation ? tc('tables.editTable') : tc('tables.addTable')}
                </h3>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{tc('tables.name')} *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ name: e.target.value })}
                    placeholder="e.g., Table 5, Poolside Cabana 3"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">{tc('cancel')}</Button>
                <Button onClick={handleSubmit} className="flex-1">{editingLocation ? tc('update') : tc('create')}</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Code Modal */}
      <AnimatePresence>
        {qrModal.open && qrModal.location && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setQrModal({ open: false, location: null })}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-xl max-w-sm w-full p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                {qrModal.location.name}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                Scan to order from this location
              </p>

              <div className="flex justify-center p-4 bg-white rounded-lg border border-slate-200 mb-4">
                {qrModal.location.qr_code ? (
                  <img
                    src={qrModal.location.qr_code}
                    alt={`QR Code for ${qrModal.location.name}`}
                    className="w-48 h-48"
                  />
                ) : (
                  <div className="w-48 h-48 flex flex-col items-center justify-center text-slate-400">
                    <QrCode className="w-16 h-16 mb-2" />
                    <p className="text-sm">No QR code generated</p>
                  </div>
                )}
              </div>

              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={() => setQrModal({ open: false, location: null })}>
                  {tc('close')}
                </Button>
                {qrModal.location.qr_code && (
                  <Button onClick={() => {
                    const link = document.createElement('a');
                    link.href = qrModal.location!.qr_code!;
                    link.download = `${qrModal.location!.name}-qr.png`;
                    link.click();
                  }}>
                    Download
                  </Button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
