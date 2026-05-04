'use client';

import { useState, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  FileText,
  FileJson,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Download,
} from 'lucide-react';

export interface ImportWizardProps<T> {
  title: string;
  parseEndpoint: string;
  commitEndpoint: string;
  llmPlaceholder: string;
  moduleId?: string;
  categories?: { id: string; name: string }[];
  renderPreviewItem: (item: T & { _tempId: string; _selected?: boolean; _parseWarnings?: string[] }, onChange: (field: string, value: unknown) => void, onRemove: () => void) => ReactNode;
  renderCategorySelect?: (item: T & { _tempId: string }, categoryMap: Record<string, string | null>, categories: { id: string; name: string }[], onCategoryChange: (category: string, value: string | null) => void) => ReactNode;
  csvTemplate?: { headers: string[]; exampleRows: string[][] };
  extraStep2Header?: ReactNode;
  onComplete?: () => void;
  onBack?: () => void;
}

interface ImportResult<T> {
  items: (T & { _tempId: string; _selected?: boolean; _parseWarnings?: string[] })[];
  warnings: string[];
  errors: string[];
  totalParsed: number;
  successful: number;
}

interface CommitResult {
  created: number;
  failed: number;
  errors: string[];
  inventoryCreated?: number;
  inventoryLinked?: number;
  inventoryWarnings?: string[];
}

export function ImportWizard<T extends Record<string, unknown>>({
  title,
  parseEndpoint,
  commitEndpoint,
  llmPlaceholder,
  moduleId,
  categories = [],
  renderPreviewItem,
  renderCategorySelect,
  csvTemplate,
  extraStep2Header,
  onComplete,
  onBack,
}: ImportWizardProps<T>) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState<'json' | 'csv' | null>(null);
  const [importResult, setImportResult] = useState<ImportResult<T> | null>(null);
  const [categoryMap, setCategoryMap] = useState<Record<string, string | null>>({});

  // Input states
  const [rawText, setRawText] = useState('');
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // Result states
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);

  const handleParse = async (type: 'text' | 'json' | 'csv') => {
    setLoading(true);
    const formData = new FormData();

    try {
      let res;
      if (type === 'text') {
        res = await api.post(parseEndpoint, { text: rawText });
      } else {
        const file = type === 'json' ? jsonFile : csvFile;
        if (!file) return;
        formData.append('file', file);
        res = await api.post(parseEndpoint, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      const result: ImportResult<T> = res.data.data;
      const itemsWithSelection = result.items.map(item => ({ ...item, _selected: true }));
      setImportResult({ ...result, items: itemsWithSelection });

      // Auto-map categories if renderCategorySelect is provided
      if (renderCategorySelect) {
        const initialMap: Record<string, string | null> = {};
        const uniqueParsedCategories = Array.from(new Set(itemsWithSelection.map(i => (i as unknown as { category: string }).category)));
        uniqueParsedCategories.forEach(catName => {
          const existing = categories.find(c => c.name.toLowerCase() === (catName as string).toLowerCase());
          initialMap[catName as string] = existing ? existing.id : null;
        });
        setCategoryMap(initialMap);
      }

      setStep(2);
    } catch (error: unknown) {
      const errors = (error as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors || ['Parsing failed. Please check your input format.'];
      toast.error(errors.join(', '));
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!importResult) return;

    setLoading(true);

    const selectedItems = importResult.items.filter(i => i._selected);

    try {
      const payload: Record<string, unknown> = {
        items: selectedItems,
      };
      if (moduleId) payload.moduleId = moduleId;
      if (renderCategorySelect) payload.categoryMap = categoryMap;

      const res = await api.post(commitEndpoint, payload);
      setCommitResult(res.data.data);
      setStep(3);
      onComplete?.();
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Commit failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    if (!csvTemplate) return;
    const csvContent = [
      csvTemplate.headers.join(','),
      ...csvTemplate.exampleRows.map(row => row.join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import_template.csv';
    a.click();
  };

  const updateItem = (tempId: string, field: string, value: unknown) => {
    if (!importResult) return;
    setImportResult({
      ...importResult,
      items: importResult.items.map(i => i._tempId === tempId ? { ...i, [field]: value } : i)
    });
  };

  const removeItem = (tempId: string) => {
    if (!importResult) return;
    setImportResult({
      ...importResult,
      items: importResult.items.filter(i => i._tempId !== tempId)
    });
  };

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="max-w-6xl mx-auto space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-slate-500">Import multiple items using AI or files</p>
        </div>
      </div>

      {/* Step Wizard */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
              step === i ? 'bg-orange-500 text-white' :
              step > i ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
            }`}>
              {step > i ? <CheckCircle2 className="w-5 h-5" /> : i}
            </div>
            <span className={`text-sm hidden sm:inline ${step === i ? 'font-bold' : 'text-slate-400'}`}>
              {i === 1 ? 'Input' : i === 2 ? 'Preview' : 'Result'}
            </span>
            {i < 3 && <div className="w-12 h-px bg-slate-200 dark:bg-slate-700 mx-2" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Input */}
        {step === 1 && (
          <motion.div key="step1" variants={fadeInUp}>
            <Tabs defaultValue="ai" className="w-full">
              <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto mb-8">
                <TabsTrigger value="ai" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Paste Text
                </TabsTrigger>
                <TabsTrigger value="json" className="flex items-center gap-2">
                  <FileJson className="w-4 h-4" />
                  JSON
                </TabsTrigger>
                <TabsTrigger value="csv" className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  CSV
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ai">
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <Textarea
                      placeholder={llmPlaceholder}
                      rows={12}
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-slate-500">
                        Our AI will parse this into structured items for your review.
                      </p>
                      <Button
                        onClick={() => handleParse('text')}
                        disabled={loading || !rawText.trim()}
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                      >
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {loading ? 'AI is reading...' : 'Parse →'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="json">
                <Card
                  className={`transition-colors duration-200 ${isDragging === 'json' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging('json'); }}
                  onDragLeave={() => setIsDragging(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(null);
                    const file = e.dataTransfer.files?.[0];
                    if (file && file.name.endsWith('.json')) setJsonFile(file);
                    else toast.error('Please drop a valid .json file');
                  }}
                >
                  <CardContent className="p-12 flex flex-col items-center justify-center space-y-6 border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <FileJson className="w-8 h-8 text-blue-500" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold">{jsonFile ? jsonFile.name : 'Drop your JSON file here'}</p>
                      <p className="text-sm text-slate-500">Only .json files are supported</p>
                    </div>
                    <input
                      type="file"
                      id="json-input"
                      accept=".json"
                      onChange={(e) => setJsonFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <div className="flex gap-4">
                      <Button variant="outline" onClick={() => document.getElementById('json-input')?.click()}>
                        Choose File
                      </Button>
                      <Button
                        onClick={() => handleParse('json')}
                        disabled={loading || !jsonFile}
                      >
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Parse File →
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="csv">
                <Card
                  className={`transition-colors duration-200 ${isDragging === 'csv' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging('csv'); }}
                  onDragLeave={() => setIsDragging(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(null);
                    const file = e.dataTransfer.files?.[0];
                    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) setCsvFile(file);
                    else toast.error('Please drop a valid .csv file');
                  }}
                >
                  <CardContent className="p-12 flex flex-col items-center justify-center space-y-6 border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                      <FileSpreadsheet className="w-8 h-8 text-emerald-500" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold">{csvFile ? csvFile.name : 'Drop your CSV file here'}</p>
                      <p className="text-sm text-slate-500">Only .csv files are supported</p>
                    </div>
                    <input
                      type="file"
                      id="csv-input"
                      accept=".csv"
                      onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <div className="flex gap-4">
                      <Button variant="outline" onClick={() => document.getElementById('csv-input')?.click()}>
                        Choose File
                      </Button>
                      {csvTemplate && (
                        <Button variant="outline" onClick={downloadTemplate} className="flex items-center gap-2">
                          <Download className="w-4 h-4" />
                          Template
                        </Button>
                      )}
                      <Button
                        onClick={() => handleParse('csv')}
                        disabled={loading || !csvFile}
                      >
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Parse File →
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>
        )}

        {/* Step 2: Preview & Approve */}
        {step === 2 && importResult && (
          <motion.div key="step2" variants={fadeInUp} className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex gap-4">
                    <Badge variant="outline">{importResult.items.length} items parsed</Badge>
                    {importResult.warnings.length > 0 && <Badge className="bg-amber-500 text-white">{importResult.warnings.length} warnings</Badge>}
                    {importResult.errors.length > 0 && <Badge variant="destructive">{importResult.errors.length} errors</Badge>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      <ChevronLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    <Button
                      onClick={handleCommit}
                      disabled={loading || importResult.items.filter(i => i._selected).length === 0}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white"
                    >
                      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Import {importResult.items.filter(i => i._selected).length} Selected →
                    </Button>
                  </div>
                </div>

                {extraStep2Header}

                {/* Warnings/Errors Collapsible */}
                {(importResult.warnings.length > 0 || importResult.errors.length > 0) && (
                  <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-2 border border-slate-200 dark:border-slate-700">
                    <p className="text-sm font-bold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Parsing Issues
                    </p>
                    <ul className="text-xs space-y-1">
                      {importResult.errors.map((e, i) => <li key={i} className="text-red-500">• {e}</li>)}
                      {importResult.warnings.map((w, i) => <li key={i} className="text-amber-600">• {w}</li>)}
                    </ul>
                  </div>
                )}

                {/* Bulk Actions */}
                <div className="flex justify-between items-center mb-4 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg">
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setImportResult({ ...importResult, items: importResult.items.map(i => ({ ...i, _selected: true })) })}>
                      Select All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setImportResult({ ...importResult, items: importResult.items.map(i => ({ ...i, _selected: false })) })}>
                      Deselect All
                    </Button>
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-3">
                  {importResult.items.map((item) => (
                    <Card key={item._tempId} className={!item._selected ? 'opacity-50' : ''}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <input
                            type="checkbox"
                            checked={item._selected}
                            onChange={(e) => updateItem(item._tempId, '_selected', e.target.checked)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            {renderPreviewItem(item as T & { _tempId: string; _selected?: boolean; _parseWarnings?: string[] }, (field, value) => updateItem(item._tempId, field, value), () => removeItem(item._tempId))}
                          </div>
                          <div className="flex items-center gap-2">
                            {item._parseWarnings?.length ? (
                              <div title={item._parseWarnings.join(', ')}>
                                <AlertTriangle className="w-5 h-5 text-amber-500 cursor-help" />
                              </div>
                            ) : null}
                            <Button variant="ghost" size="icon" onClick={() => removeItem(item._tempId)} className="text-red-500">
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 3: Result */}
        {step === 3 && commitResult && (
          <motion.div key="step3" variants={fadeInUp} className="max-w-2xl mx-auto text-center space-y-8">
            <div className="flex flex-col items-center gap-4">
              {commitResult.failed === 0 ? (
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                </div>
              ) : (
                <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-12 h-12 text-amber-500" />
                </div>
              )}
              <h2 className="text-2xl font-bold">Import Complete</h2>
              <div className="flex gap-8">
                <div className="text-center">
                  <p className="text-3xl font-bold text-emerald-500">{commitResult.created}</p>
                  <p className="text-sm text-slate-500">Created</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-500">{commitResult.failed}</p>
                  <p className="text-sm text-slate-500">Failed</p>
                </div>
                {(commitResult.inventoryCreated !== undefined || commitResult.inventoryLinked !== undefined) && (
                  <>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-blue-500">{commitResult.inventoryCreated || 0}</p>
                      <p className="text-sm text-slate-500">Inventory Items Created</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-purple-500">{commitResult.inventoryLinked || 0}</p>
                      <p className="text-sm text-slate-500">Inventory Links Created</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {commitResult.errors.length > 0 && (
              <div className="text-left p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl space-y-2">
                <p className="font-bold text-red-600 flex items-center gap-2">
                  <XCircle className="w-4 h-4" /> Errors
                </p>
                <ul className="text-sm space-y-1 text-red-500">
                  {commitResult.errors.map((e, idx) => <li key={idx}>• {e}</li>)}
                </ul>
              </div>
            )}

            {commitResult.inventoryWarnings && commitResult.inventoryWarnings.length > 0 && (
              <div className="text-left p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl space-y-2">
                <p className="font-bold text-amber-600 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Inventory Warnings
                </p>
                <ul className="text-sm space-y-1 text-amber-700">
                  {commitResult.inventoryWarnings.map((w, idx) => <li key={idx}>• {w}</li>)}
                </ul>
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={() => {
                setStep(1);
                setImportResult(null);
                setCommitResult(null);
                setRawText('');
                setJsonFile(null);
                setCsvFile(null);
              }}>
                Import More
              </Button>
              {onBack && (
                <Button className="bg-orange-500 text-white" onClick={onBack}>
                  Done
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default ImportWizard;
