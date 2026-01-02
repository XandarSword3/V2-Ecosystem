'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
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
} from 'lucide-react';

interface Table {
  id: string;
  table_number: number;
  capacity: number;
  is_available: boolean;
  qr_code?: string;
  location?: string;
}

export default function AdminTablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [formData, setFormData] = useState({ table_number: '', capacity: '4', location: '' });

  const fetchTables = useCallback(async () => {
    try {
      const response = await api.get('/restaurant/tables');
      setTables(response.data.data || []);
    } catch (error) {
      toast.error('Failed to fetch tables');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const handleSubmit = async () => {
    if (!formData.table_number) {
      toast.error('Table number is required');
      return;
    }

    try {
      const payload = {
        table_number: parseInt(formData.table_number),
        capacity: parseInt(formData.capacity),
        location: formData.location,
      };

      if (editingTable) {
        await api.put(`/restaurant/tables/${editingTable.id}`, payload);
        toast.success('Table updated');
      } else {
        await api.post('/restaurant/tables', payload);
        toast.success('Table created');
      }
      setShowModal(false);
      setEditingTable(null);
      setFormData({ table_number: '', capacity: '4', location: '' });
      fetchTables();
    } catch (error) {
      toast.error('Failed to save table');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this table?')) return;
    
    try {
      await api.delete(`/restaurant/tables/${id}`);
      toast.success('Table deleted');
      fetchTables();
    } catch (error) {
      toast.error('Failed to delete table');
    }
  };

  const toggleAvailability = async (table: Table) => {
    try {
      await api.put(`/restaurant/tables/${table.id}`, { is_available: !table.is_available });
      setTables((prev) => prev.map((t) => (t.id === table.id ? { ...t, is_available: !t.is_available } : t)));
      toast.success(`Table ${table.is_available ? 'marked occupied' : 'marked available'}`);
    } catch (error) {
      toast.error('Failed to update table');
    }
  };

  const generateQR = async (tableId: string) => {
    try {
      const response = await api.post(`/restaurant/tables/${tableId}/qr`);
      toast.success('QR code generated');
      fetchTables();
    } catch (error) {
      toast.error('Failed to generate QR code');
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Restaurant Tables</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {availableTables} available, {occupiedTables} occupied
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchTables}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => { setEditingTable(null); setFormData({ table_number: '', capacity: '4', location: '' }); setShowModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Table
          </Button>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <AnimatePresence mode="popLayout">
          {tables.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full text-center py-12"
            >
              <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-500 dark:text-slate-400">No tables configured</p>
              <Button className="mt-4" onClick={() => setShowModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add your first table
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
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      table.is_available 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {table.is_available ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          Available
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" />
                          Occupied
                        </>
                      )}
                    </div>
                    
                    {table.location && (
                      <p className="text-xs text-slate-400 mt-1">{table.location}</p>
                    )}

                    <div className="flex justify-center gap-1 mt-3">
                      <Button variant="ghost" size="sm" onClick={() => toggleAvailability(table)}>
                        {table.is_available ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => generateQR(table.id)}>
                        <QrCode className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(table)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(table.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
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
              className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                {editingTable ? 'Edit Table' : 'Add Table'}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Table Number
                  </label>
                  <input
                    type="number"
                    value={formData.table_number}
                    onChange={(e) => setFormData({ ...formData, table_number: e.target.value })}
                    placeholder="1"
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Capacity
                  </label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    placeholder="4"
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Location (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., Terrace, Indoor"
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowModal(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit}>
                    {editingTable ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
