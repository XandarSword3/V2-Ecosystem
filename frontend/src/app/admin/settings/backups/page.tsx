'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Database,
    Download,
    Trash2,
    Plus,
    FileJson,
    Clock,
    User,
    AlertTriangle,
    RefreshCcw,
    CheckCircle2,
    XCircle,
    Loader2,
    HardDrive
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { toast } from 'sonner';

interface Backup {
    id: string;
    filename: string;
    size_bytes: number;
    status: 'pending' | 'completed' | 'failed';
    type: 'manual' | 'scheduled';
    created_at: string;
    users?: {
        full_name: string;
    };
}

const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4 }
};

export default function BackupsPage() {
    const [backups, setBackups] = useState<Backup[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [downloading, setDownloading] = useState<string | null>(null);

    const fetchBackups = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get('/admin/backups');
            if (response.data.success) {
                setBackups(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch backups:', error);
            toast.error('Failed to load backup history');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBackups();
    }, [fetchBackups]);

    const handleCreateBackup = async () => {
        try {
            setCreating(true);
            toast.loading('Initializing database snapshot...', { id: 'backup-create' });

            const response = await api.post('/admin/backups');

            if (response.data.success) {
                toast.success(`Backup created: ${response.data.data.filename}`, { id: 'backup-create' });
                fetchBackups();
            }
        } catch (error) {
            console.error('Backup failed:', error);
            toast.error('Database backup failed', { id: 'backup-create' });
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteBackup = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this backup? This action cannot be undone.')) return;

        try {
            await api.delete(`/admin/backups/${id}`);
            toast.success('Backup deleted successfully');
            setBackups(prev => prev.filter(b => b.id !== id));
        } catch (error) {
            toast.error('Failed to delete backup');
        }
    };

    const handleDownloadBackup = async (id: string, filename: string) => {
        try {
            setDownloading(id);
            const response = await api.get(`/admin/backups/${id}/download`);

            if (response.data.success && response.data.data.downloadUrl) {
                // Fetch the file content and create a blob for proper download
                // This is needed because the download attribute doesn't work for cross-origin URLs
                const fileResponse = await fetch(response.data.data.downloadUrl);
                if (!fileResponse.ok) {
                    throw new Error('Failed to fetch backup file');
                }
                
                const blob = await fileResponse.blob();
                const blobUrl = window.URL.createObjectURL(blob);
                
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Clean up the blob URL
                window.URL.revokeObjectURL(blobUrl);
                toast.success('Download started');
            }
        } catch (error) {
            console.error('Download failed:', error);
            toast.error('Failed to download backup');
        } finally {
            setDownloading(null);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
            case 'pending': return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
            default: return <Clock className="w-4 h-4 text-slate-400" />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Database className="w-7 h-7 text-blue-600" />
                        Database Backups
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Create and manage point-in-time snapshots of your entire system data.
                    </p>
                </div>
                <Button
                    onClick={handleCreateBackup}
                    disabled={creating}
                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
                >
                    {creating ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <Plus className="w-4 h-4 mr-2" />
                    )}
                    Create Manual Backup
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Retention Info */}
                <motion.div variants={fadeInUp} className="lg:col-span-1">
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="text-lg">System Health</CardTitle>
                            <CardDescription>Backup statistics and policies</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Backups</span>
                                    <span className="text-lg font-bold text-slate-900 dark:text-white">{backups.length}</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                    <div className="bg-blue-600 h-full" style={{ width: `${Math.min(backups.length * 10, 100)}%` }} />
                                </div>
                                <p className="text-xs text-slate-500 mt-2">Storage usage: {formatSize(backups.reduce((acc, curr) => acc + curr.size_bytes, 0))}</p>
                            </div>

                            <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-lg">
                                <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                                <p className="text-xs text-yellow-700 dark:text-yellow-400">
                                    <strong>Important:</strong> Backups contain sensitive database information. Ensure download links are only shared with authorized administrators.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">Storage Policy</h4>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">Auto-Retention</span>
                                    <span className="font-medium text-green-600">Enabled</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">Max Backups</span>
                                    <span className="font-medium">10 Files</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">Last Cleanup</span>
                                    <span className="font-medium text-slate-400">Never</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Backup List */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>History</CardTitle>
                                <CardDescription>Last 30 days of data snapshots</CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" onClick={fetchBackups} disabled={loading}>
                                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 uppercase font-semibold">
                                        <tr>
                                            <th className="px-6 py-4">Filename</th>
                                            <th className="px-6 py-4">Metadata</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        <AnimatePresence mode="popLayout">
                                            {loading && backups.length === 0 ? (
                                                Array.from({ length: 3 }).map((_, i) => (
                                                    <tr key={i} className="animate-pulse">
                                                        <td colSpan={4} className="px-6 py-8">
                                                            <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded w-full" />
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : backups.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                                        <Database className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                        <p>No backups found</p>
                                                    </td>
                                                </tr>
                                            ) : (
                                                backups.map((backup) => (
                                                    <motion.tr
                                                        key={backup.id}
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        exit={{ opacity: 0 }}
                                                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                                                    >
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <FileJson className="w-8 h-8 text-blue-500/50" />
                                                                <div>
                                                                    <p className="font-medium text-slate-900 dark:text-white truncate max-w-[200px]" title={backup.filename}>
                                                                        {backup.filename}
                                                                    </p>
                                                                    <p className="text-xs text-slate-500 flex items-center gap-1">
                                                                        <Clock className="w-3 h-3" />
                                                                        {new Date(backup.created_at).toLocaleString()}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                                                    <HardDrive className="w-3 h-3" />
                                                                    {formatSize(backup.size_bytes)}
                                                                </div>
                                                                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                                                    <User className="w-3 h-3" />
                                                                    {backup.users?.full_name || 'System'}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2 text-xs font-medium capitalize">
                                                                {getStatusIcon(backup.status)}
                                                                {backup.status}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                {backup.status === 'completed' && (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => handleDownloadBackup(backup.id, backup.filename)}
                                                                        disabled={downloading === backup.id}
                                                                        title="Download snapshot"
                                                                    >
                                                                        {downloading === backup.id ? (
                                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                                        ) : (
                                                                            <Download className="w-4 h-4" />
                                                                        )}
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                    onClick={() => handleDeleteBackup(backup.id)}
                                                                    title="Delete backup"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </motion.tr>
                                                ))
                                            )}
                                        </AnimatePresence>
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
