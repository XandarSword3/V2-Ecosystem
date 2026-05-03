'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useSiteSettings } from '@/lib/settings-context';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Upload,
  FileText,
  FileJson,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Download,
} from 'lucide-react';

interface ModifierOption {
  name: string;
  price: number;
  modifierType?: 'add' | 'remove' | 'swap';
}

interface ModifierGroup {
  name: string;
  is_required: boolean;
  options: ModifierOption[];
}

interface ImportedMenuItem {
  name: string;
  price: number;
  category: string;
  description?: string;
  is_available: boolean;
  discount_price?: number;
  preparation_time?: number;
  calories?: number;
  allergens?: string[];
  modifiers?: ModifierGroup[];
  _tempId: string;
  _parseWarnings?: string[];
  _selected?: boolean;
}

interface ImportResult {
  items: ImportedMenuItem[];
  warnings: string[];
  errors: string[];
}

export default function MenuImportPage() {
  const params = useParams();
  const router = useRouter();
  const { modules } = useSiteSettings();
  const t = useTranslations('admin');
  const slug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const currentModule = modules.find(m => m.slug === slug);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, string | null>>({});
  
  // Input states
  const [rawText, setRawText] = useState('');
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // Result states
  const [commitProgress, setCommitProgress] = useState(0);
  const [commitResult, setCommitResult] = useState<{ created: number; failed: number; errors: string[] } | null>(null);

  useEffect(() => {
    if (currentModule) {
      fetchCategories();
    }
  }, [currentModule]);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/restaurant/categories', { params: { moduleId: currentModule?.id } });
      setCategories(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch categories');
    }
  };

  const handleParse = async (type: 'text' | 'json' | 'csv') => {
    setLoading(true);
    const formData = new FormData();
    
    try {
      let res;
      if (type === 'text') {
        res = await api.post('/restaurant/import/parse', { text: rawText });
      } else {
        const file = type === 'json' ? jsonFile : csvFile;
        if (!file) return;
        formData.append('file', file);
        res = await api.post('/restaurant/import/parse', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      const result: ImportResult = res.data.data;
      const itemsWithSelection = result.items.map(item => ({ ...item, _selected: true }));
      setImportResult({ ...result, items: itemsWithSelection });
      
      // Auto-map categories
      const initialMap: Record<string, string | null> = {};
      const uniqueParsedCategories = Array.from(new Set(itemsWithSelection.map(i => i.category)));
      uniqueParsedCategories.forEach(catName => {
        const existing = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
        initialMap[catName] = existing ? existing.id : null;
      });
      setCategoryMap(initialMap);
      
      setStep(2);
    } catch (error: any) {
      const errors = error.response?.data?.errors || ['Parsing failed. Please check your input format.'];
      toast.error(errors.join(', '));
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!currentModule || !importResult) return;
    
    setLoading(true);
    setCommitProgress(0);
    
    const selectedItems = importResult.items.filter(i => i._selected);
    
    try {
      const res = await api.post('/restaurant/import/commit', {
        moduleId: currentModule.id,
        items: selectedItems,
        categoryMap
      });
      setCommitResult(res.data.data);
      setStep(3);
    } catch (error: any) {
      toast.error('Commit failed');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = "name,price,category,description,is_available,discount_price,preparation_time,calories,allergens\nMargherita Pizza,12.99,Pizza,Classic tomato and mozzarella,true,,15,800,\"gluten,dairy\"\nGreek Salad,8.50,Salads,Fresh cucumber and feta,true,,10,350,dairy";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'menu_template.csv';
    a.click();
  };

  const updateItem = (tempId: string, field: keyof ImportedMenuItem, value: any) => {
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
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Import Menu</h1>
          <p className="text-slate-500">Add multiple items at once using AI or files</p>
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
                      placeholder="Paste your menu here in any format. Examples: 'Margherita Pizza 12.99', a copied menu from a website, or a list of items with prices."
                      rows={12}
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-slate-500">
                        Our AI will parse this into structured menu items for your review.
                      </p>
                      <Button 
                        onClick={() => handleParse('text')} 
                        disabled={loading || !rawText.trim()}
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                      >
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {loading ? 'AI is reading your menu...' : 'Parse Menu →'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="json">
                <Card>
                  <CardContent className="p-12 flex flex-col items-center justify-center space-y-6 border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <FileJson className="w-8 h-8 text-blue-500" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold">Drop your JSON file here</p>
                      <p className="text-sm text-slate-500">Only .json files are supported</p>
                    </div>
                    <input 
                      type="file" 
                      accept=".json"
                      onChange={(e) => setJsonFile(e.target.files?.[0] || null)}
                      className="text-sm"
                    />
                    <Button 
                      onClick={() => handleParse('json')} 
                      disabled={loading || !jsonFile}
                    >
                      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Parse File →
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="csv">
                <Card>
                  <CardContent className="p-12 flex flex-col items-center justify-center space-y-6 border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                      <FileSpreadsheet className="w-8 h-8 text-emerald-500" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold">Drop your CSV file here</p>
                      <p className="text-sm text-slate-500">Only .csv files are supported</p>
                    </div>
                    <input 
                      type="file" 
                      accept=".csv"
                      onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                      className="text-sm"
                    />
                    <div className="flex gap-4">
                      <Button variant="outline" onClick={downloadTemplate} className="flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        Download Template
                      </Button>
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
                      Import {importResult.items.filter(i => i._selected).length} Selected Items →
                    </Button>
                  </div>
                </div>

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
                      <CardContent className="p-4 flex flex-col md:flex-row items-start gap-4">
                        <input 
                          type="checkbox" 
                          checked={item._selected} 
                          onChange={(e) => updateItem(item._tempId, '_selected', e.target.checked)}
                          className="mt-3"
                        />
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="col-span-1">
                            <label className="text-[10px] uppercase font-bold text-slate-400">Name</label>
                            <Input 
                              value={item.name} 
                              onChange={(e) => updateItem(item._tempId, 'name', e.target.value)}
                              className="h-9"
                            />
                          </div>
                          <div className="col-span-1">
                            <label className="text-[10px] uppercase font-bold text-slate-400">Price</label>
                            <Input 
                              type="number"
                              value={item.price} 
                              onChange={(e) => updateItem(item._tempId, 'price', parseFloat(e.target.value))}
                              className={`h-9 ${item.price === 0 ? 'border-red-500' : ''}`}
                            />
                          </div>
                          <div className="col-span-1">
                            <label className="text-[10px] uppercase font-bold text-slate-400">Category</label>
                            <Select 
                              value={categoryMap[item.category] || 'new'}
                              onValueChange={(val) => setCategoryMap({ ...categoryMap, [item.category]: val === 'new' ? null : val })}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new">+ New: {item.category}</SelectItem>
                                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-1">
                            <label className="text-[10px] uppercase font-bold text-slate-400">Description</label>
                            <Input 
                              value={item.description || ''} 
                              onChange={(e) => updateItem(item._tempId, 'description', e.target.value)}
                              className="h-9"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item._parseWarnings?.length ? (
                            <div title={item._parseWarnings.join(', ')}>
                              <AlertTriangle className="w-5 h-5 text-amber-500 cursor-help" />
                            </div>
                          ) : null}
                          <Button variant="ghost" size="icon" onClick={() => removeItem(item._tempId)} className="text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                      {/* Modifiers Preview */}
                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="px-12 pb-4 pt-0">
                          <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">Modifiers</p>
                          <div className="flex flex-wrap gap-2">
                            {item.modifiers.map((m, idx) => (
                              <Badge key={idx} variant="secondary" className="text-[10px]">
                                {m.name}: {m.options.length} options
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
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

            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={() => setStep(1)}>
                Import More
              </Button>
              <Button className="bg-orange-500 text-white" onClick={() => router.push(`/admin/${slug}/menu`)}>
                Back to Menu
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
