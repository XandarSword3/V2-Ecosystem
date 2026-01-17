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
  Users,
  CheckCircle2,
  XCircle,
  X,
} from 'lucide-react';

interface Table {
  id: string;
  table_number: number;
  capacity: number;
  is_available: boolean;
  qr_code?: string;
  location?: string;
  module_id?: string;
}

interface QRModalState {
  open: boolean;
  table: Table | null;
}

export default function DynamicTablesPage() {
  const params = useParams();
  const { modules } = useSiteSettings();
  const tc = useTranslations('adminCommon');
  const rawSlug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const slug = rawSlug ? decodeURIComponent(rawSlug).toLowerCase() : '';
  const currentModule = modules.find(m => m.slug.toLowerCase() === slug);

  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [formData, setFormData] = useState({ table_number: '', capacity: '4', location: '' });
  const [qrModal, setQrModal] = useState<QRModalState>({ open: false, table: null });

  const fetchTables = useCallback(async () => {
    if (!currentModule) return;
    try {
      const response = await api.get('/restaurant/staff/tables', { params: { moduleId: currentModule.id } });
      setTables(response.data.data || []);
    } catch (error) {
      toast.error(tc('errors.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [currentModule]);

  useEffect(() => {
    if (currentModule) {
      fetchTables();
    }
  }, [currentModule, fetchTables]);

  const handleSubmit = async () => {
    if (!formData.table_number || !currentModule) {
      toast.error(tc('tables.tableNumberRequired'));
      return;
    }

    try {
      const payload = {
        table_number: parseInt(formData.table_number),
        capacity: parseInt(formData.capacity),
        location: formData.location,
        module_id: currentModule.id,
      };

      if (editingTable) {
        await api.patch(`/restaurant/staff/tables/${editingTable.id}`, payload);
        toast.success(tc('success.updated'));
      } else {
        await api.post('/restaurant/admin/tables', payload);
        toast.success(tc('success.created'));
      }
      setShowModal(false);
      setEditingTable(null);
      setFormData({ table_number: '', capacity: '4', location: '' });
      fetchTables();
    } catch (error) {
      toast.error(tc('errors.failedToSave'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tc('tables.confirmDelete'))) return;
    try {
      await api.delete(`/restaurant/admin/tables/${id}`);
      toast.success(tc('success.deleted'));
      fetchTables();
    } catch (error) {
      toast.error(tc('errors.failedToSave'));
    }
  };

  const toggleAvailability = async (table: Table) => {
    try {
      await api.patch(`/restaurant/staff/tables/${table.id}`, { is_available: !table.is_available });
      setTables((prev) => prev.map((t) => (t.id === table.id ? { ...t, is_available: !t.is_available } : t)));
      toast.success(table.is_available ? tc('tables.markedOccupied') : tc('tables.markedAvailable'));
    } catch (error) {
      toast.error(tc('errors.failedToSave'));
    }
  };

  const openEdit = (table: Table) => {
    setEditingTable(table);
    setFormData({
      table_number: table.table_number.toString(),
      capacity: table.capacity.toString(),
      location: table.location || '',
    });
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

  const availableTables = tables.filter((t) => t.is_available).length;
  const occupiedTables = tables.filter((t) => !t.is_available).length;

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{currentModule.name} {tc('tables.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {availableTables} {tc('tables.available')}, {occupiedTables} {tc('tables.occupied')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchTables}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {tc('refresh')}
          </Button>
          <Button onClick={() => { setEditingTable(null); setFormData({ table_number: '', capacity: '4', location: '' }); setShowModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            {tc('tables.addTable')}
          </Button>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <AnimatePresence mode="popLayout">
          {tables.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full text-center py-12">
              <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-500 dark:text-slate-400">{tc('tables.noTablesConfigured')}</p>
              <Button className="mt-4" onClick={() => setShowModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {tc('tables.addFirstTable')}
              </Button>
            </motion.div>
          ) : (
            tables.sort((a, b) => a.table_number - b.table_number).map((table, index) => (
              <motion.div
                key={table.id}
                variants={fadeInUp}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.03 }}
                layout
              >
                <Card className={`relative overflow-hidden ${
                  table.is_available 
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                      {table.table_number}
                    </div>
                    <div className="flex items-center justify-center gap-1 text-sm text-slate-600 dark:text-slate-300 mb-2">
                      <Users className="w-4 h-4" />
                      {table.capacity}
                    </div>
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mb-3 ${
                      table.is_available
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                    }`}>
                      {table.is_available ? <><CheckCircle2 className="w-3 h-3" /> {tc('tables.available')}</> : <><XCircle className="w-3 h-3" /> {tc('tables.occupied')}</>}
                    </div>
                    {table.location && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{table.location}</p>
                    )}
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={() => toggleAvailability(table)}
                        className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        title={table.is_available ? 'Mark Occupied' : 'Mark Available'}
                      >
                        {table.is_available ? <XCircle className="w-4 h-4 text-red-500" /> : <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      </button>
                      <button onClick={() => setQrModal({ open: true, table })} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" title="View QR Code">
                        <QrCode className="w-4 h-4 text-purple-500" />
                      </button>
                      <button onClick={() => openEdit(table)} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <Edit2 className="w-4 h-4 text-blue-500" />
                      </button>
                      <button onClick={() => handleDelete(table.id)} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
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
                  {editingTable ? tc('tables.editTable') : tc('tables.addTable')}
                </h3>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{tc('tables.tableNumber')} *</label>
                  <input
                    type="number"
                    value={formData.table_number}
                    onChange={(e) => setFormData({ ...formData, table_number: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{tc('tables.capacity')}</label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{tc('tables.location')}</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., Terrace, Indoor"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">{tc('cancel')}</Button>
                <Button onClick={handleSubmit} className="flex-1">{editingTable ? tc('update') : tc('create')}</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Code Modal */}
      <AnimatePresence>
        {qrModal.open && qrModal.table && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setQrModal({ open: false, table: null })}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-xl max-w-sm w-full p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Table {qrModal.table.table_number}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                Scan to order from this table
              </p>

              <div className="flex justify-center p-4 bg-white rounded-lg border border-slate-200 mb-4">
                {qrModal.table.qr_code ? (
                  <img 
                    src={qrModal.table.qr_code} 
                    alt={`QR Code for Table ${qrModal.table.table_number}`}
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
                <Button variant="outline" onClick={() => setQrModal({ open: false, table: null })}>
                  {tc('close')}
                </Button>
                {qrModal.table.qr_code && (
                  <Button onClick={() => {
                    const link = document.createElement('a');
                    link.href = qrModal.table!.qr_code!;
                    link.download = `table-${qrModal.table!.table_number}-qr.png`;
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
