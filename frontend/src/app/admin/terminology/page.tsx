// File: frontend/src/app/admin/terminology/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useTerminology, Terminology } from '@/hooks/useTerminology';
import { toast } from 'sonner';
import api from '@/lib/api';

interface TerminologyItem {
    key: string;
    label: string;
    description: string;
}

const KNOWN_TERMS: TerminologyItem[] = [
    { key: 'unit_singular', label: 'Unit (Singular)', description: 'e.g. Room, Suite, Cabin' },
    { key: 'unit_plural', label: 'Unit (Plural)', description: 'e.g. Rooms, Suites, Cabins' },
    { key: 'facility_singular', label: 'Facility (Singular)', description: 'e.g. Pool, Gym, Spa' },
    { key: 'facility_plural', label: 'Facility (Plural)', description: 'e.g. Pools, Gyms, Spas' },
    { key: 'dining_singular', label: 'Dining (Singular)', description: 'e.g. Café, Bar' },
    { key: 'dining_plural', label: 'Dining (Plural)', description: 'e.g. Cafés, Bars' },
];

export default function TerminologyPage() {
    const [businessType, setBusinessType] = useState('hotel');
    const [loading, setLoading] = useState(false);
    const [values, setValues] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchData();
    }, [businessType]);

    // FIX: Iteration 26 - Use api instance instead of raw fetch (fixes CSRF 403 on terminology save)
    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/terminology?business_type=${businessType}`);
            setValues(response.data?.data || {});
        } catch (error) {
            toast.error('Failed to fetch terminology');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (key: string, value: string) => {
        setValues(prev => ({ ...prev, [key]: value }));
    };

    // FIX: Iteration 26 - Use api instance instead of raw fetch (fixes CSRF 403)
    const handleSave = async () => {
        setLoading(true);
        try {
            const response = await api.post('/terminology/bulk', {
                business_type: businessType,
                language: 'en',
                updates: values
            });

            if (!response.data?.success) throw new Error('Failed to save');

            toast.success('Terminology updated successfully');
        } catch (error) {
            toast.error('Failed to save changes');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Terminology Configuration</h1>

            <div className="mb-8 p-4 bg-white rounded-lg border shadow-sm">
                <label className="block text-sm font-medium text-gray-700 mb-2">Business Type Context</label>
                <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="w-full max-w-xs p-2 border rounded-md"
                >
                    <option value="resort">Resort</option>
                    <option value="hotel">Hotel</option>
                    <option value="food_service">Food & Beverage</option>
                    <option value="villa">Villa / Vacation Rental</option>
                </select>
                <p className="text-sm text-gray-500 mt-2">
                    Select which business type you are configuring terms for.
                </p>
            </div>

            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <div className="p-4 bg-gray-50 border-b">
                    <h2 className="font-semibold">Term Overrides</h2>
                </div>

                <div className="p-6 grid gap-6">
                    {KNOWN_TERMS.map((term) => (
                        <div key={term.key} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center border-b pb-4 last:border-0 last:pb-0">
                            <div>
                                <label className="block font-medium text-gray-900">{term.label}</label>
                                <p className="text-sm text-gray-500">{term.description}</p>
                                <div className="mt-1 text-xs text-gray-400 font-mono">{term.key}</div>
                            </div>
                            <div className="md:col-span-2">
                                <input
                                    type="text"
                                    value={values[term.key] || ''}
                                    onChange={(e) => handleChange(term.key, e.target.value)}
                                    placeholder={`Default for ${businessType}...`}
                                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    ))}

                    {/* Dynamic Field Adder could go here */}
                </div>

                <div className="p-4 bg-gray-50 border-t flex justify-end">
                    <button
                        onClick={() => fetchData()}
                        disabled={loading}
                        className="px-4 py-2 text-gray-700 hover:text-gray-900 mr-2"
                    >
                        Reset
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}
