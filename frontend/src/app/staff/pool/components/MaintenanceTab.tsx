import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Plus, Beaker, Wrench, Search, FileText } from 'lucide-react';

interface MaintenanceLog {
    id: string;
    type: 'cleaning' | 'chemical_check' | 'repair' | 'inspection';
    readings: Record<string, string | number>;
    notes: string;
    created_at: string;
    users?: { full_name: string };
}

export function MaintenanceTab() {
    const [logs, setLogs] = useState<MaintenanceLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);

    // Form State
    const [newLogType, setNewLogType] = useState('chemical_check');
    const [newLogNotes, setNewLogNotes] = useState('');
    const [newLogReadings, setNewLogReadings] = useState({ ph: '', chlorine: '', temperature: '' });

    const fetchLogs = async () => {
        try {
            const { data } = await api.get('/pool/staff/maintenance');
            setLogs(data.data || []);
        } catch (error) {
            toast.error('Failed to load maintenance logs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/pool/staff/maintenance', {
                type: newLogType,
                notes: newLogNotes,
                readings: newLogType === 'chemical_check' ? newLogReadings : {},
            });
            toast.success('Log added successfully');
            setShowAddForm(false);
            setNewLogNotes('');
            setNewLogReadings({ ph: '', chlorine: '', temperature: '' });
            fetchLogs();
        } catch (error) {
            toast.error('Failed to add log');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Maintenance Logs</h2>
                <Button onClick={() => setShowAddForm(!showAddForm)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Log
                </Button>
            </div>

            {showAddForm && (
                <Card>
                    <CardContent className="p-4">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Type</label>
                                    <select
                                        className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                                        value={newLogType}
                                        onChange={(e) => setNewLogType(e.target.value)}
                                    >
                                        <option value="chemical_check">Chemical Check</option>
                                        <option value="cleaning">Cleaning</option>
                                        <option value="repair">Repair</option>
                                        <option value="inspection">Inspection</option>
                                    </select>
                                </div>
                            </div>

                            {newLogType === 'chemical_check' && (
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">pH Level</label>
                                        <input
                                            type="number" step="0.1"
                                            className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                                            value={newLogReadings.ph}
                                            onChange={(e) => setNewLogReadings({ ...newLogReadings, ph: e.target.value })}
                                            placeholder="7.2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Chlorine (ppm)</label>
                                        <input
                                            type="number" step="0.1"
                                            className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                                            value={newLogReadings.chlorine}
                                            onChange={(e) => setNewLogReadings({ ...newLogReadings, chlorine: e.target.value })}
                                            placeholder="1.5"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Temp (°C)</label>
                                        <input
                                            type="number" step="0.1"
                                            className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                                            value={newLogReadings.temperature}
                                            onChange={(e) => setNewLogReadings({ ...newLogReadings, temperature: e.target.value })}
                                            placeholder="26"
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Notes</label>
                                <textarea
                                    className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                                    value={newLogNotes}
                                    onChange={(e) => setNewLogNotes(e.target.value)}
                                    placeholder="Details about the task..."
                                    rows={3}
                                />
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
                                <Button type="submit">Save Log</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            <div className="space-y-4">
                {logs.map((log) => (
                    <Card key={log.id}>
                        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${log.type === 'chemical_check' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' :
                                        log.type === 'cleaning' ? 'bg-green-100 text-green-600 dark:bg-green-900/30' :
                                            'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                                    }`}>
                                    {log.type === 'chemical_check' ? <Beaker className="w-5 h-5" /> :
                                        log.type === 'cleaning' ? <FileText className="w-5 h-5" /> :
                                            <Wrench className="w-5 h-5" />}
                                </div>
                                <div>
                                    <p className="font-semibold capitalize text-slate-900 dark:text-white">{log.type.replace('_', ' ')}</p>
                                    <p className="text-sm text-slate-500">
                                        {new Date(log.created_at).toLocaleString()} • {log.users?.full_name || 'Unknown'}
                                    </p>
                                    {log.notes && <p className="text-sm mt-1 text-slate-600 dark:text-slate-300">{log.notes}</p>}
                                </div>
                            </div>

                            {log.readings && Object.keys(log.readings).length > 0 && (
                                <div className="flex gap-6 text-sm bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">
                                    {Object.entries(log.readings).map(([key, val]) => (
                                        <div key={key} className="text-center">
                                            <span className="block text-slate-500 text-xs uppercase mb-1">{key}</span>
                                            <span className="font-mono font-bold text-slate-900 dark:text-white">{val}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
                {logs.length === 0 && !loading && (
                    <p className="text-center text-slate-500 py-8">No maintenance logs found.</p>
                )}
            </div>
        </div>
    );
}
