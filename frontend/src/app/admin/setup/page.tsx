'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Upload,
  Sparkles,
  ShieldAlert,
  DollarSign,
  Mail,
  Users,
  CheckCircle2,
  Building2,
  Play,
  FileText,
  Trash2,
  Plus,
  Compass,
  LayoutGrid,
  Menu,
  Settings,
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react';

interface Step {
  id: string;
  title: string;
  description: string;
  phase: number;
}

const PHASES = [
  { id: 1, name: 'Identity & Brand' },
  { id: 2, name: 'Module Templates' },
  { id: 3, name: 'Commerce & Taxes' },
  { id: 4, name: 'Staff Management' },
  { id: 5, name: 'Guest CMS Customization' },
  { id: 6, name: 'Integrations' },
  { id: 7, name: 'Launch & Live' }
];

const STEPS: Step[] = [
  { id: 'welcome', title: 'Welcome', description: 'Start your resort setup journey', phase: 1 },
  { id: 'resort_details', title: 'Resort Profile', description: 'Configure basic contact information', phase: 1 },
  { id: 'visual_design', title: 'Visual Branding', description: 'Accent color extraction and logo setup', phase: 1 },
  { id: 'modules', title: 'Active Modules', description: 'Select engine templates to deploy', phase: 2 },
  { id: 'menu_import', title: 'Menu CSV Import', description: 'Import F&B options dynamically', phase: 2 },
  { id: 'accommodation_import', title: 'Units CSV Import', description: 'Provision chalets and rooms', phase: 2 },
  { id: 'inventory_import', title: 'Inventory CSV Import', description: 'Populate starting stock catalogs', phase: 2 },
  { id: 'payment_gateway', title: 'Stripe Gateway', description: 'Connect Stripe for live charges', phase: 3 },
  { id: 'taxes', title: 'Tax Rates', description: 'Establish regional tax calculations', phase: 3 },
  { id: 'staff_invitations', title: 'Staff Roster', description: 'Add managers and operators', phase: 4 },
  { id: 'landing_cms', title: 'Landing Editor', description: 'Customize guest welcome page', phase: 5 },
  { id: 'transactional_emails', title: 'SMTP Mail Server', description: 'Verify transactional mail delivery', phase: 6 },
  { id: 'go_live', title: 'Go Live Dashboard', description: 'Provision properties, sync modules, launch', phase: 7 }
];

export default function SetupWizardPage() {
  const router = useRouter();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // State variables for form fields
  const [resortDetails, setResortDetails] = useState({
    name: '',
    slug: '',
    phone: '',
    email: '',
    address: ''
  });

  const [branding, setBranding] = useState({
    logoUrl: '',
    faviconUrl: '',
    themeColor: '#6366f1',
    accentColor: '#4f46e5'
  });

  const [selectedModules, setSelectedModules] = useState<string[]>(['restaurant', 'accommodation', 'inventory']);
  
  // CSV Import mapping states
  const [menuCsv, setMenuCsv] = useState<{ headers: string[]; rows: string[][]; filename: string } | null>(null);
  const [menuMapping, setMenuMapping] = useState<Record<string, string>>({});
  const [accommodationCsv, setAccommodationCsv] = useState<{ headers: string[]; rows: string[][]; filename: string } | null>(null);
  const [accommodationMapping, setAccommodationMapping] = useState<Record<string, string>>({});
  const [inventoryCsv, setInventoryCsv] = useState<{ headers: string[]; rows: string[][]; filename: string } | null>(null);
  const [inventoryMapping, setInventoryMapping] = useState<Record<string, string>>({});

  // Stripe & Taxes
  const [stripeConfig, setStripeConfig] = useState({ secretKey: '', publicKey: '', verifySuccess: false, verifyMsg: '' });
  const [taxConfig, setTaxConfig] = useState({ taxRate: '8.25', serviceCharge: '10' });

  // Staff list
  const [staffList, setStaffList] = useState<{ name: string; email: string; role: string }[]>([
    { name: '', email: '', role: 'staff' }
  ]);

  // CMS
  const [cmsConfig, setCmsConfig] = useState({
    heroTitle: 'A Sanctuary of Refined Comfort',
    heroSubtitle: 'Enjoy unparalleled luxury and tailored hospitality services at your fingertips.',
    welcomeMessage: 'Welcome to your premium resort escape.'
  });

  // SMTP Mail Server
  const [smtpConfig, setSmtpConfig] = useState({
    provider: 'smtp',
    host: 'smtp.sendgrid.net',
    port: '587',
    secure: false,
    user: 'apikey',
    pass: '',
    apiKey: '',
    fromEmail: 'noreply@v2ecosystem.com',
    testRecipient: '',
    verifySuccess: false,
    verifyMsg: ''
  });

  // Final manual URL
  const [finalManualUrl, setFinalManualUrl] = useState<string | null>(null);

  const logoCanvasRef = useRef<HTMLCanvasElement>(null);
  const currentStep = STEPS[currentStepIndex];

  // Load state from DB on mount
  useEffect(() => {
    async function loadState() {
      try {
        setLoading(true);
        const res = await api.get('/admin/onboarding');
        const json = res.data;
        if (json.success && json.data) {
          const s = json.data;
          // Prepopulate states from steps if present
          const stepsData = s.steps || {};
          if (stepsData['resort_details']?.data) setResortDetails(stepsData['resort_details'].data);
          if (stepsData['visual_design']?.data) setBranding(stepsData['visual_design'].data);
          if (stepsData['modules']?.data) setSelectedModules(stepsData['modules'].data.modules || []);
          if (stepsData['payment_gateway']?.data) setStripeConfig(prev => ({ ...prev, ...stepsData['payment_gateway'].data }));
          if (stepsData['taxes']?.data) setTaxConfig(stepsData['taxes'].data);
          if (stepsData['staff_invitations']?.data) setStaffList(stepsData['staff_invitations'].data.invitations || []);
          if (stepsData['landing_cms']?.data) setCmsConfig(stepsData['landing_cms'].data);
          if (stepsData['transactional_emails']?.data) setSmtpConfig(prev => ({ ...prev, ...stepsData['transactional_emails'].data }));
          
          // Determine step index based on current_step
          const matchedIdx = STEPS.findIndex(st => st.id === s.current_step);
          if (matchedIdx !== -1) {
            setCurrentStepIndex(matchedIdx);
          }
        }
      } catch (err) {
        console.error('Failed to load onboarding state:', err);
      } finally {
        setLoading(false);
      }
    }
    loadState();
  }, []);

  // Save current step data to DB on navigate
  // The backend deep-merges `steps`, so we can PUT just the single step that
  // changed — no need to GET the full state first on every navigation.
  const saveStepProgress = async (stepId: string, data: any) => {
    try {
      await api.put('/admin/onboarding', {
        current_step: stepId,
        steps: {
          [stepId]: {
            status: 'completed',
            completed_at: new Date().toISOString(),
            data,
          },
        },
      });
    } catch (err) {
      console.error('Failed to save progress:', err);
    }
  };

  // Helper: parse CSV string
  const parseCsvText = (text: string) => {
    const lines = text.split('\n');
    return lines.map(line => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    }).filter(line => line.length > 0 && line.some(cell => cell !== ''));
  };

  // Color extraction from uploaded logo
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imgUrl = event.target?.result as string;
      setBranding(prev => ({ ...prev, logoUrl: imgUrl }));

      // Extract accent color using Canvas
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = logoCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        
        // Simple color counting
        const colorCounts: Record<string, number> = {};
        for (let i = 0; i < imgData.length; i += 40) { // Sample every 10 pixels to avoid overhead
          const r = imgData[i];
          const g = imgData[i+1];
          const b = imgData[i+2];
          const a = imgData[i+3];
          if (a < 128) continue; // Skip transparent
          
          // Skip highly white/black backgrounds
          if (r > 240 && g > 240 && b > 240) continue;
          if (r < 15 && g < 15 && b < 15) continue;

          const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
          colorCounts[hex] = (colorCounts[hex] || 0) + 1;
        }

        // Find dominant color
        const sortedColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
        if (sortedColors.length > 0) {
          const dominantColor = sortedColors[0][0];
          setBranding(prev => ({
            ...prev,
            themeColor: dominantColor,
            accentColor: sortedColors[1]?.[0] || dominantColor
          }));
        }
      };
      img.src = imgUrl;
    };
    reader.readAsDataURL(file);
  };

  // Navigations
  const nextStep = async () => {
    // Save state of current step before moving
    await saveCurrentStepState();
    
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const saveCurrentStepState = async () => {
    const id = currentStep.id;
    if (id === 'resort_details') {
      await saveStepProgress(id, resortDetails);
    } else if (id === 'visual_design') {
      await saveStepProgress(id, branding);
    } else if (id === 'modules') {
      await saveStepProgress(id, { modules: selectedModules });
    } else if (id === 'payment_gateway') {
      const { secretKey, verifySuccess, verifyMsg, ...scrubbedStripe } = stripeConfig;
      await saveStepProgress(id, scrubbedStripe);
    } else if (id === 'taxes') {
      await saveStepProgress(id, taxConfig);
    } else if (id === 'staff_invitations') {
      await saveStepProgress(id, { invitations: staffList });
    } else if (id === 'landing_cms') {
      await saveStepProgress(id, cmsConfig);
    } else if (id === 'transactional_emails') {
      const { pass, apiKey, verifySuccess, verifyMsg, ...scrubbedSmtp } = smtpConfig;
      await saveStepProgress(id, scrubbedSmtp);
    }
  };

  // Verification actions
  const handleVerifyStripe = async () => {
    setSubmitting(true);
    setStripeConfig(prev => ({ ...prev, verifySuccess: false, verifyMsg: '' }));
    try {
      const res = await api.post('/admin/onboarding/verify-stripe', {
        secretKey: stripeConfig.secretKey
      });
      const data = res.data;
      if (data.success) {
        setStripeConfig(prev => ({
          ...prev,
          verifySuccess: true,
          verifyMsg: `Connected to Stripe! Account name: ${data.data.businessName || 'Active Merchant Account'}`
        }));
      } else {
        setStripeConfig(prev => ({
          ...prev,
          verifySuccess: false,
          verifyMsg: data.error || 'Stripe key verification failed.'
        }));
      }
    } catch (err: any) {
      setStripeConfig(prev => ({ ...prev, verifySuccess: false, verifyMsg: err.message }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestEmail = async () => {
    setSubmitting(true);
    setSmtpConfig(prev => ({ ...prev, verifySuccess: false, verifyMsg: '' }));
    try {
      const res = await api.post('/admin/onboarding/test-email', {
        provider: smtpConfig.provider,
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        user: smtpConfig.user,
        pass: smtpConfig.pass,
        apiKey: smtpConfig.apiKey,
        fromEmail: smtpConfig.fromEmail,
        toEmail: smtpConfig.testRecipient
      });
      const data = res.data;
      if (data.success) {
        setSmtpConfig(prev => ({
          ...prev,
          verifySuccess: true,
          verifyMsg: 'Test email dispatched successfully! Please check your inbox.'
        }));
      } else {
        setSmtpConfig(prev => ({
          ...prev,
          verifySuccess: false,
          verifyMsg: data.error || 'Email dispatch failed. Verify settings.'
        }));
      }
    } catch (err: any) {
      setSmtpConfig(prev => ({ ...prev, verifySuccess: false, verifyMsg: err.message }));
    } finally {
      setSubmitting(false);
    }
  };

  // Bulk Ingestion Submits
  const handleImportMenu = async () => {
    if (!menuCsv) return;
    setSubmitting(true);
    try {
      // Map rows according to the mapping selections
      const items = menuCsv.rows.slice(1).map(row => {
        const item: Record<string, any> = {};
        Object.entries(menuMapping).forEach(([sysCol, csvColIdx]) => {
          if (csvColIdx !== '') {
            item[sysCol] = row[Number(csvColIdx)];
          }
        });
        return item;
      });

      const res = await api.post('/admin/import/menu', { items });
      const data = res.data;
      alert(data.message || 'Import completed!');
      nextStep();
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportAccommodations = async () => {
    if (!accommodationCsv) return;
    setSubmitting(true);
    try {
      const items = accommodationCsv.rows.slice(1).map(row => {
        const item: Record<string, any> = {};
        Object.entries(accommodationMapping).forEach(([sysCol, csvColIdx]) => {
          if (csvColIdx !== '') {
            item[sysCol] = row[Number(csvColIdx)];
          }
        });
        return item;
      });

      const res = await api.post('/admin/import/accommodations', { items });
      const data = res.data;
      alert(data.message || 'Import completed!');
      nextStep();
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportInventory = async () => {
    if (!inventoryCsv) return;
    setSubmitting(true);
    try {
      const items = inventoryCsv.rows.slice(1).map(row => {
        const item: Record<string, any> = {};
        Object.entries(inventoryMapping).forEach(([sysCol, csvColIdx]) => {
          if (csvColIdx !== '') {
            item[sysCol] = row[Number(csvColIdx)];
          }
        });
        return item;
      });

      const res = await api.post('/admin/import/inventory', { items });
      const data = res.data;
      alert(data.message || 'Import completed!');
      nextStep();
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Go Live provision execution
  const handleGoLive = async () => {
    setSubmitting(true);
    try {
      const res = await api.post('/admin/onboarding/finalize', {
        stripeSecretKey: stripeConfig.secretKey,
        smtpPass: smtpConfig.pass,
        smtpApiKey: smtpConfig.apiKey
      });
      const data = res.data;
      if (data.success) {
        setFinalManualUrl(data.data.manualUrl);
        // confetty trigger
        triggerConfetti();
      } else {
        alert(data.error || 'Provisioning failed.');
      }
    } catch (err: any) {
      alert(`Provisioning failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Simple Canvas-based Confettiburst
  const confettiRafRef = useRef<number | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Clean up confetti on unmount
  useEffect(() => {
    return () => {
      if (confettiRafRef.current !== null) {
        cancelAnimationFrame(confettiRafRef.current);
      }
      if (confettiCanvasRef.current && document.body.contains(confettiCanvasRef.current)) {
        document.body.removeChild(confettiCanvasRef.current);
      }
    };
  }, []);

  const triggerConfetti = () => {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '99999';
    document.body.appendChild(canvas);
    confettiCanvasRef.current = canvas;

    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    const particles = Array.from({ length: 150 }).map(() => ({
      x: canvas.width / 2,
      y: canvas.height / 2 + 100,
      vx: (Math.random() - 0.5) * 15,
      vy: (Math.random() - 1) * 15 - 5,
      r: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      decay: Math.random() * 0.015 + 0.005
    }));

    function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.forEach(p => {
        if (p.alpha > 0) {
          alive = true;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.2; // gravity
          p.alpha -= p.decay;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.fill();
        }
      });

      if (alive) {
        confettiRafRef.current = requestAnimationFrame(frame);
      } else {
        confettiRafRef.current = null;
        confettiCanvasRef.current = null;
        if (document.body.contains(canvas)) document.body.removeChild(canvas);
      }
    }
    confettiRafRef.current = requestAnimationFrame(frame);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-10 w-10 animate-spin text-indigo-500" />
          <p className="text-slate-400 font-medium">Restoring Onboarding Session...</p>
        </div>
      </div>
    );
  }

  // Sidebar phase calculation
  const activePhase = currentStep.phase;

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white font-sans">
      <canvas ref={logoCanvasRef} className="hidden" />
      
      {/* 30% Sidebar Section */}
      <aside className="w-80 flex-shrink-0 border-r border-slate-800/60 bg-slate-950/80 backdrop-blur-xl flex flex-col">
        <div className="p-6 border-b border-slate-800/60 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Compass className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">V2 Ecosystem</h1>
            <p className="text-xs text-slate-400">Resort Setup Wizard</p>
          </div>
        </div>

        {/* Phase List */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-4">
          {PHASES.map((p) => {
            const isCompleted = activePhase > p.id;
            const isActive = activePhase === p.id;
            
            return (
              <div 
                key={p.id} 
                className={`p-3 rounded-xl transition-all duration-300 ${
                  isActive 
                    ? 'bg-indigo-500/10 border border-indigo-500/30 shadow-inner' 
                    : 'border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                    isCompleted 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                      : isActive 
                        ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30' 
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {isCompleted ? <Check className="h-3 w-3" /> : p.id}
                  </div>
                  <div>
                    <span className={`text-sm font-semibold transition-colors ${
                      isActive ? 'text-indigo-400' : isCompleted ? 'text-slate-300' : 'text-slate-500'
                    }`}>
                      {p.name}
                    </span>
                  </div>
                </div>

                {/* Show steps inside active phase */}
                {isActive && (
                  <div className="mt-3 pl-9 space-y-2 border-l-2 border-indigo-500/20">
                    {STEPS.filter(st => st.phase === p.id).map((st) => {
                      const isStepActive = st.id === currentStep.id;
                      const stepIdx = STEPS.findIndex(s => s.id === st.id);
                      const isStepDone = stepIdx < currentStepIndex;

                      return (
                        <button
                          key={st.id}
                          onClick={async () => { await saveCurrentStepState(); setCurrentStepIndex(stepIdx); }}
                          className={`block text-left text-xs transition-colors duration-150 w-full py-1 ${
                            isStepActive 
                              ? 'text-indigo-300 font-medium' 
                              : isStepDone 
                                ? 'text-slate-400 line-through' 
                                : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {st.title}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-800/60 bg-slate-950/40">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Setup Progress</span>
            <span>{Math.round((currentStepIndex / (STEPS.length - 1)) * 100)}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-300"
              style={{ width: `${(currentStepIndex / (STEPS.length - 1)) * 100}%` }}
            />
          </div>
        </div>
      </aside>

      {/* 70% Content workspace area */}
      <main className="flex-1 flex flex-col h-full bg-slate-900/40">
        <header className="h-16 border-b border-slate-800/60 flex items-center justify-between px-8 bg-slate-950/20 backdrop-blur-md">
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              Phase {activePhase} / 7: {PHASES.find(p => p.id === activePhase)?.name}
            </span>
            <h2 className="text-lg font-bold text-slate-100">{currentStep.title}</h2>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={prevStep} 
              disabled={currentStepIndex === 0}
              className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-semibold hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="h-4 w-4 inline mr-1" /> Back
            </button>
            <button 
              onClick={nextStep} 
              disabled={currentStepIndex === STEPS.length - 1}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold hover:shadow-md hover:shadow-indigo-500/20 transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              Next <ChevronRight className="h-4 w-4 inline ml-1" />
            </button>
          </div>
        </header>

        {/* Step Cards Workspace */}
        <div className="flex-1 overflow-y-auto p-8 flex justify-center">
          <div className="w-full max-w-3xl space-y-6">
            
            {/* Step Card */}
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-8 shadow-xl backdrop-blur-xl">
              
              {/* Render Welcome Step */}
              {currentStep.id === 'welcome' && (
                <div className="text-center py-10 space-y-6">
                  <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mb-4 animate-bounce">
                    <Sparkles className="h-10 w-10" />
                  </div>
                  <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                    Welcome to your resort launchpad
                  </h2>
                  <p className="mx-auto max-w-md text-base text-slate-400">
                    Deploy, brand, configure, and orchestrate all aspects of your resort operations through this interactive wizard.
                  </p>
                  <div className="pt-4">
                    <button 
                      onClick={nextStep}
                      className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold hover:shadow-lg hover:shadow-indigo-500/30 transition-all text-sm inline-flex items-center gap-2"
                    >
                      Begin Setup <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Render Resort Details */}
              {currentStep.id === 'resort_details' && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800/80 pb-4">
                    <h3 className="text-xl font-bold">Resort Profile Info</h3>
                    <p className="text-xs text-slate-400">Basic contact profile details for invoices, guests, and branding</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-400">Resort Name</label>
                      <input 
                        type="text" 
                        value={resortDetails.name}
                        onChange={(e) => {
                          const name = e.target.value;
                          const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                          setResortDetails(prev => ({ ...prev, name, slug }));
                        }}
                        placeholder="e.g. Grand Val Thorens Resort" 
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-400">Resort Slug (URL prefix)</label>
                      <input 
                        type="text" 
                        value={resortDetails.slug}
                        onChange={(e) => setResortDetails(prev => ({ ...prev, slug: e.target.value }))}
                        placeholder="e.g. grand-val-thorens" 
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-400">Phone</label>
                      <input 
                        type="text" 
                        value={resortDetails.phone}
                        onChange={(e) => setResortDetails(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+33 4 79 00 00 00" 
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-400">Email Address</label>
                      <input 
                        type="email" 
                        value={resortDetails.email}
                        onChange={(e) => setResortDetails(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="info@grandvalthorens.com" 
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <label className="text-xs font-semibold text-slate-400">Physical Address</label>
                      <textarea 
                        value={resortDetails.address}
                        onChange={(e) => setResortDetails(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Rue du Soleil, 73440 Val Thorens, France" 
                        rows={2}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Render Visual Branding */}
              {currentStep.id === 'visual_design' && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800/80 pb-4">
                    <h3 className="text-xl font-bold">Visual Identity Settings</h3>
                    <p className="text-xs text-slate-400">Upload a logo to automatically extract palette colors and design theme</p>
                  </div>
                  
                  <div className="flex gap-8 items-center">
                    <div className="h-32 w-32 rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden group">
                      {branding.logoUrl ? (
                        <img src={branding.logoUrl} alt="Logo Preview" className="h-full w-full object-contain p-2" />
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-slate-500 mb-1 group-hover:text-indigo-400 transition-colors" />
                          <span className="text-[10px] text-slate-500">Upload Logo</span>
                        </>
                      )}
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                    
                    <div className="flex-1 space-y-4">
                      <div>
                        <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5" /> Canvas Extraction Enabled
                        </span>
                        <p className="text-xs text-slate-500">The theme and accent colors are populated instantly upon uploading your logo file.</p>
                      </div>

                      <div className="flex gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-400">Theme Color</label>
                          <div className="flex gap-2 items-center">
                            <input 
                              type="color" 
                              value={branding.themeColor} 
                              onChange={(e) => setBranding(prev => ({ ...prev, themeColor: e.target.value }))}
                              className="h-8 w-8 rounded-lg bg-transparent border-0 cursor-pointer"
                            />
                            <span className="text-xs font-mono">{branding.themeColor}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-400">Accent Color</label>
                          <div className="flex gap-2 items-center">
                            <input 
                              type="color" 
                              value={branding.accentColor} 
                              onChange={(e) => setBranding(prev => ({ ...prev, accentColor: e.target.value }))}
                              className="h-8 w-8 rounded-lg bg-transparent border-0 cursor-pointer"
                            />
                            <span className="text-xs font-mono">{branding.accentColor}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Render Active Modules */}
              {currentStep.id === 'modules' && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800/80 pb-4">
                    <h3 className="text-xl font-bold">Resort Modules Setup</h3>
                    <p className="text-xs text-slate-400">Choose which operational engines/modules to enable on your system</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { id: 'restaurant', name: 'Food & Beverage', desc: 'Menu ordering, table management, POS hardware, kitchen ticket flows' },
                      { id: 'accommodation', name: 'Stay & Lodging', desc: 'Resort chalets, hotel rooms, seasonal booking modifications, check-ins' },
                      { id: 'pool', name: 'Day Pool Passes', desc: 'Shared capacity access, pool tickets, cabana bookings' },
                      { id: 'inventory', name: 'Materials & Stock', desc: 'Unified inventory catalogs, alerts, low-stock checks' }
                    ].map((mod) => {
                      const isSelected = selectedModules.includes(mod.id);
                      return (
                        <button
                          key={mod.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedModules(selectedModules.filter(m => m !== mod.id));
                            } else {
                              setSelectedModules([...selectedModules, mod.id]);
                            }
                          }}
                          className={`p-4 rounded-xl border text-left transition-all ${
                            isSelected 
                              ? 'bg-indigo-600/10 border-indigo-500 shadow-lg shadow-indigo-500/5' 
                              : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-sm">{mod.name}</span>
                            <div className={`h-4.5 w-4.5 rounded-full border flex items-center justify-center ${
                              isSelected ? 'bg-indigo-500 border-indigo-400 text-white' : 'border-slate-700'
                            }`}>
                              {isSelected && <Check className="h-3 w-3" />}
                            </div>
                          </div>
                          <p className="text-xs text-slate-400 leading-normal">{mod.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Render Menu CSV Import */}
              {currentStep.id === 'menu_import' && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800/80 pb-4">
                    <h3 className="text-xl font-bold">F&B Menu Bulk Ingestion</h3>
                    <p className="text-xs text-slate-400">Map your menu items spreadsheet columns to system fields</p>
                  </div>

                  {!menuCsv ? (
                    <div className="h-48 border-2 border-dashed border-slate-800 bg-slate-900 flex flex-col items-center justify-center p-4 rounded-xl relative group">
                      <FileSpreadsheet className="h-10 w-10 text-slate-500 mb-2 group-hover:text-indigo-400 transition-colors" />
                      <span className="text-sm font-semibold">Select Menu CSV</span>
                      <span className="text-xs text-slate-500 mt-1">Accepts raw standard comma-separated text spreadsheets</span>
                      <input 
                        type="file" 
                        accept=".csv"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            const text = evt.target?.result as string;
                            const parsed = parseCsvText(text);
                            if (parsed.length > 0) {
                              setMenuCsv({ headers: parsed[0], rows: parsed, filename: file.name });
                              // Auto-map simple matches
                              const initialMap: Record<string, string> = { name: '', price: '', category: '', description: '' };
                              parsed[0].forEach((hdr, idx) => {
                                const lower = hdr.toLowerCase();
                                if (lower.includes('name') || lower.includes('title')) initialMap.name = String(idx);
                                if (lower.includes('price') || lower.includes('cost')) initialMap.price = String(idx);
                                if (lower.includes('category') || lower.includes('type')) initialMap.category = String(idx);
                                if (lower.includes('desc') || lower.includes('detail')) initialMap.description = String(idx);
                              });
                              setMenuMapping(initialMap);
                            }
                          };
                          reader.readAsText(file);
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center bg-slate-900 px-4 py-2 rounded-lg text-xs border border-slate-800">
                        <span>Selected Spreadsheet: <strong>{menuCsv.filename}</strong> ({menuCsv.rows.length - 1} rows)</span>
                        <button onClick={() => setMenuCsv(null)} className="text-rose-400 hover:text-rose-300 font-semibold">Remove</button>
                      </div>

                      {/* Columns Mapper */}
                      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 space-y-3">
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">Column Mapper</span>
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { id: 'name', label: 'Item Name *', req: true },
                            { id: 'price', label: 'Item Price *', req: true },
                            { id: 'category', label: 'Item Category *', req: true },
                            { id: 'description', label: 'Description', req: false }
                          ].map((sysField) => (
                            <div key={sysField.id} className="space-y-1">
                              <label className="text-xs text-slate-400 font-semibold">{sysField.label}</label>
                              <select 
                                value={menuMapping[sysField.id] || ''}
                                onChange={(e) => setMenuMapping({ ...menuMapping, [sysField.id]: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 text-xs px-3 py-1.5 rounded-lg focus:border-indigo-500 outline-none text-slate-300"
                              >
                                <option value="">-- Ignore / Skip --</option>
                                {menuCsv.headers.map((h, index) => (
                                  <option key={index} value={index}>{h}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Map Preview Grid */}
                      <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-900 border-b border-slate-800">
                              <th className="p-3">CSV Row</th>
                              <th className="p-3">Name</th>
                              <th className="p-3">Price</th>
                              <th className="p-3">Category</th>
                            </tr>
                          </thead>
                          <tbody>
                            {menuCsv.rows.slice(1, 4).map((row, rIdx) => {
                              const nameIdx = Number(menuMapping.name);
                              const priceIdx = Number(menuMapping.price);
                              const catIdx = Number(menuMapping.category);

                              const nameVal = !isNaN(nameIdx) && row[nameIdx] ? row[nameIdx] : null;
                              const priceVal = !isNaN(priceIdx) && row[priceIdx] ? row[priceIdx] : null;
                              const catVal = !isNaN(catIdx) && row[catIdx] ? row[catIdx] : null;

                              return (
                                <tr key={rIdx} className="border-b border-slate-800/40">
                                  <td className="p-3 text-slate-500">#{rIdx + 1}</td>
                                  <td className={`p-3 ${!nameVal ? 'bg-red-950/20 text-rose-400' : ''}`}>{nameVal || 'Missing'}</td>
                                  <td className={`p-3 ${!priceVal ? 'bg-red-950/20 text-rose-400' : ''}`}>{priceVal || 'Missing'}</td>
                                  <td className={`p-3 ${!catVal ? 'bg-red-950/20 text-rose-400' : ''}`}>{catVal || 'Missing'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <button 
                        onClick={handleImportMenu}
                        disabled={submitting || !menuMapping.name || !menuMapping.price || !menuMapping.category}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold transition-all disabled:opacity-30 flex justify-center items-center gap-2 text-xs"
                      >
                        {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Confirm Import & Map Menu Items'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Render Accommodations Import */}
              {currentStep.id === 'accommodation_import' && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800/80 pb-4">
                    <h3 className="text-xl font-bold">Stay & Accommodation Bulk Ingestion</h3>
                    <p className="text-xs text-slate-400">Bulk upload your rooms, suites, and chalet units catalog</p>
                  </div>

                  {!accommodationCsv ? (
                    <div className="h-48 border-2 border-dashed border-slate-800 bg-slate-900 flex flex-col items-center justify-center p-4 rounded-xl relative group">
                      <FileSpreadsheet className="h-10 w-10 text-slate-500 mb-2 group-hover:text-indigo-400 transition-colors" />
                      <span className="text-sm font-semibold">Select Accommodation CSV</span>
                      <span className="text-xs text-slate-500 mt-1">Map unit names, room categories, and capacities</span>
                      <input 
                        type="file" 
                        accept=".csv"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            const text = evt.target?.result as string;
                            const parsed = parseCsvText(text);
                            if (parsed.length > 0) {
                              setAccommodationCsv({ headers: parsed[0], rows: parsed, filename: file.name });
                              const initialMap: Record<string, string> = { name: '', type: '', base_price: '', capacity: '' };
                              parsed[0].forEach((hdr, idx) => {
                                const lower = hdr.toLowerCase();
                                if (lower.includes('name') || lower.includes('number') || lower.includes('unit')) initialMap.name = String(idx);
                                if (lower.includes('type') || lower.includes('category')) initialMap.type = String(idx);
                                if (lower.includes('price') || lower.includes('rate')) initialMap.base_price = String(idx);
                                if (lower.includes('capacity') || lower.includes('guest') || lower.includes('sleep')) initialMap.capacity = String(idx);
                              });
                              setAccommodationMapping(initialMap);
                            }
                          };
                          reader.readAsText(file);
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center bg-slate-900 px-4 py-2 rounded-lg text-xs border border-slate-800">
                        <span>Selected Spreadsheet: <strong>{accommodationCsv.filename}</strong></span>
                        <button onClick={() => setAccommodationCsv(null)} className="text-rose-400 hover:text-rose-300 font-semibold">Remove</button>
                      </div>

                      {/* Columns Mapper */}
                      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 space-y-3">
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">Column Mapper</span>
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { id: 'name', label: 'Unit Name / Number *', req: true },
                            { id: 'type', label: 'Unit Type *', req: true },
                            { id: 'base_price', label: 'Price per Night *', req: true },
                            { id: 'capacity', label: 'Guest Capacity', req: false }
                          ].map((sysField) => (
                            <div key={sysField.id} className="space-y-1">
                              <label className="text-xs text-slate-400 font-semibold">{sysField.label}</label>
                              <select 
                                value={accommodationMapping[sysField.id] || ''}
                                onChange={(e) => setAccommodationMapping({ ...accommodationMapping, [sysField.id]: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 text-xs px-3 py-1.5 rounded-lg focus:border-indigo-500 outline-none text-slate-300"
                              >
                                <option value="">-- Ignore / Skip --</option>
                                {accommodationCsv.headers.map((h, index) => (
                                  <option key={index} value={index}>{h}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Preview Table */}
                      <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-900 border-b border-slate-800">
                              <th className="p-3">CSV Row</th>
                              <th className="p-3">Unit</th>
                              <th className="p-3">Type</th>
                              <th className="p-3">Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {accommodationCsv.rows.slice(1, 4).map((row, rIdx) => {
                              const nameIdx = Number(accommodationMapping.name);
                              const typeIdx = Number(accommodationMapping.type);
                              const priceIdx = Number(accommodationMapping.base_price);

                              const nameVal = !isNaN(nameIdx) && row[nameIdx] ? row[nameIdx] : null;
                              const typeVal = !isNaN(typeIdx) && row[typeIdx] ? row[typeIdx] : null;
                              const priceVal = !isNaN(priceIdx) && row[priceIdx] ? row[priceIdx] : null;

                              return (
                                <tr key={rIdx} className="border-b border-slate-800/40">
                                  <td className="p-3 text-slate-500">#{rIdx + 1}</td>
                                  <td className={`p-3 ${!nameVal ? 'bg-red-950/20 text-rose-400' : ''}`}>{nameVal || 'Missing'}</td>
                                  <td className={`p-3 ${!typeVal ? 'bg-red-950/20 text-rose-400' : ''}`}>{typeVal || 'Missing'}</td>
                                  <td className={`p-3 ${!priceVal ? 'bg-red-950/20 text-rose-400' : ''}`}>{priceVal || 'Missing'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <button 
                        onClick={handleImportAccommodations}
                        disabled={submitting || !accommodationMapping.name || !accommodationMapping.type || !accommodationMapping.base_price}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold transition-all disabled:opacity-30 flex justify-center items-center gap-2 text-xs"
                      >
                        {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Confirm Import & Provision Accommodation Units'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Render Inventory Import */}
              {currentStep.id === 'inventory_import' && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800/80 pb-4">
                    <h3 className="text-xl font-bold">Inventory Catalog Bulk Ingestion</h3>
                    <p className="text-xs text-slate-400">Import starting counts for resort assets, linens, and supplies</p>
                  </div>

                  {!inventoryCsv ? (
                    <div className="h-48 border-2 border-dashed border-slate-800 bg-slate-900 flex flex-col items-center justify-center p-4 rounded-xl relative group">
                      <FileSpreadsheet className="h-10 w-10 text-slate-500 mb-2 group-hover:text-indigo-400 transition-colors" />
                      <span className="text-sm font-semibold">Select Inventory CSV</span>
                      <span className="text-xs text-slate-500 mt-1">Map stock item codes, counts, and alert levels</span>
                      <input 
                        type="file" 
                        accept=".csv"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            const text = evt.target?.result as string;
                            const parsed = parseCsvText(text);
                            if (parsed.length > 0) {
                              setInventoryCsv({ headers: parsed[0], rows: parsed, filename: file.name });
                              const initialMap: Record<string, string> = { name: '', sku: '', quantity: '', category: '' };
                              parsed[0].forEach((hdr, idx) => {
                                const lower = hdr.toLowerCase();
                                if (lower.includes('name') || lower.includes('item') || lower.includes('title')) initialMap.name = String(idx);
                                if (lower.includes('sku') || lower.includes('code') || lower.includes('id')) initialMap.sku = String(idx);
                                if (lower.includes('qty') || lower.includes('stock') || lower.includes('quantity')) initialMap.quantity = String(idx);
                                if (lower.includes('category') || lower.includes('department')) initialMap.category = String(idx);
                              });
                              setInventoryMapping(initialMap);
                            }
                          };
                          reader.readAsText(file);
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center bg-slate-900 px-4 py-2 rounded-lg text-xs border border-slate-800">
                        <span>Selected Spreadsheet: <strong>{inventoryCsv.filename}</strong></span>
                        <button onClick={() => setInventoryCsv(null)} className="text-rose-400 hover:text-rose-300 font-semibold">Remove</button>
                      </div>

                      {/* Columns Mapper */}
                      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 space-y-3">
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">Column Mapper</span>
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { id: 'name', label: 'Item Name *', req: true },
                            { id: 'sku', label: 'Item SKU / Part Code', req: false },
                            { id: 'quantity', label: 'Initial Stock Qty *', req: true },
                            { id: 'category', label: 'Item Category', req: false }
                          ].map((sysField) => (
                            <div key={sysField.id} className="space-y-1">
                              <label className="text-xs text-slate-400 font-semibold">{sysField.label}</label>
                              <select 
                                value={inventoryMapping[sysField.id] || ''}
                                onChange={(e) => setInventoryMapping({ ...inventoryMapping, [sysField.id]: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 text-xs px-3 py-1.5 rounded-lg focus:border-indigo-500 outline-none text-slate-300"
                              >
                                <option value="">-- Ignore / Skip --</option>
                                {inventoryCsv.headers.map((h, index) => (
                                  <option key={index} value={index}>{h}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Preview Table */}
                      <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-900 border-b border-slate-800">
                              <th className="p-3">CSV Row</th>
                              <th className="p-3">Item</th>
                              <th className="p-3">SKU</th>
                              <th className="p-3">Initial Stock</th>
                            </tr>
                          </thead>
                          <tbody>
                            {inventoryCsv.rows.slice(1, 4).map((row, rIdx) => {
                              const nameIdx = Number(inventoryMapping.name);
                              const skuIdx = Number(inventoryMapping.sku);
                              const qtyIdx = Number(inventoryMapping.quantity);

                              const nameVal = !isNaN(nameIdx) && row[nameIdx] ? row[nameIdx] : null;
                              const skuVal = !isNaN(skuIdx) && row[skuIdx] ? row[skuIdx] : null;
                              const qtyVal = !isNaN(qtyIdx) && row[qtyIdx] ? row[qtyIdx] : null;

                              return (
                                <tr key={rIdx} className="border-b border-slate-800/40">
                                  <td className="p-3 text-slate-500">#{rIdx + 1}</td>
                                  <td className={`p-3 ${!nameVal ? 'bg-red-950/20 text-rose-400' : ''}`}>{nameVal || 'Missing'}</td>
                                  <td className={`p-3 ${!skuVal ? 'bg-red-950/20 text-rose-400' : ''}`}>{skuVal || 'Missing'}</td>
                                  <td className={`p-3 ${!qtyVal ? 'bg-red-950/20 text-rose-400' : ''}`}>{qtyVal || 'Missing'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <button 
                        onClick={handleImportInventory}
                        disabled={submitting || !inventoryMapping.name || !inventoryMapping.quantity}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold transition-all disabled:opacity-30 flex justify-center items-center gap-2 text-xs"
                      >
                        {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Confirm Import & Provision Inventory Catalog'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Render Stripe Gateway */}
              {currentStep.id === 'payment_gateway' && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800/80 pb-4">
                    <h3 className="text-xl font-bold">Stripe Payment Gateway</h3>
                    <p className="text-xs text-slate-400">Link your operational merchant account to support guest booking payments</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-400">Stripe Secret Key (sk_live_... or sk_test_...)</label>
                      <input 
                        type="password" 
                        value={stripeConfig.secretKey}
                        onChange={(e) => setStripeConfig({ ...stripeConfig, secretKey: e.target.value, verifySuccess: false, verifyMsg: '' })}
                        placeholder="sk_test_..." 
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-400">Stripe Publishable Key (pk_live_... or pk_test_...)</label>
                      <input 
                        type="text" 
                        value={stripeConfig.publicKey}
                        onChange={(e) => setStripeConfig({ ...stripeConfig, publicKey: e.target.value })}
                        placeholder="pk_test_..." 
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none font-mono"
                      />
                    </div>

                    <button 
                      onClick={handleVerifyStripe}
                      disabled={submitting || !stripeConfig.secretKey}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg transition-all disabled:opacity-40"
                    >
                      {submitting ? 'Testing Key...' : 'Test Gateway Connection'}
                    </button>

                    {stripeConfig.verifyMsg && (
                      <div className={`p-4 rounded-xl border text-xs flex gap-2 ${
                        stripeConfig.verifySuccess 
                          ? 'bg-emerald-950/20 border-emerald-800 text-emerald-400' 
                          : 'bg-red-950/20 border-red-900 text-rose-400'
                      }`}>
                        {stripeConfig.verifySuccess ? <CheckCircle2 className="h-4.5 w-4.5 shrink-0" /> : <ShieldAlert className="h-4.5 w-4.5 shrink-0" />}
                        <span>{stripeConfig.verifyMsg}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Render Taxes Setup */}
              {currentStep.id === 'taxes' && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800/80 pb-4">
                    <h3 className="text-xl font-bold">Tax & Service Fees Configuration</h3>
                    <p className="text-xs text-slate-400">Establish local hospitality tax percentages and automatic service charge additions</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-400">Primary VAT / VAT Tax Rate (%)</label>
                      <input 
                        type="number" 
                        value={taxConfig.taxRate}
                        onChange={(e) => setTaxConfig({ ...taxConfig, taxRate: e.target.value })}
                        placeholder="8.25" 
                        step="0.01"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-400">Default Service Charge (%)</label>
                      <input 
                        type="number" 
                        value={taxConfig.serviceCharge}
                        onChange={(e) => setTaxConfig({ ...taxConfig, serviceCharge: e.target.value })}
                        placeholder="10" 
                        step="0.1"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Render Staff Invitations */}
              {currentStep.id === 'staff_invitations' && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800/80 pb-4 flex justify-between items-end">
                    <div>
                      <h3 className="text-xl font-bold">Configure Operators Roster</h3>
                      <p className="text-xs text-slate-400">Create login credentials or email invitations for resort staff</p>
                    </div>
                    <button 
                      onClick={() => setStaffList([...staffList, { name: '', email: '', role: 'staff' }])}
                      className="px-3 py-1 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 text-xs font-semibold rounded-lg border border-indigo-500/30 transition-colors flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Staff Member
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {staffList.map((staff, idx) => (
                      <div key={idx} className="flex gap-3 items-center bg-slate-900/40 border border-slate-800 p-3 rounded-xl">
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          <input 
                            type="text" 
                            value={staff.name}
                            onChange={(e) => {
                              const list = [...staffList];
                              list[idx].name = e.target.value;
                              setStaffList(list);
                            }}
                            placeholder="Full Name" 
                            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500 text-white"
                          />
                          <input 
                            type="email" 
                            value={staff.email}
                            onChange={(e) => {
                              const list = [...staffList];
                              list[idx].email = e.target.value;
                              setStaffList(list);
                            }}
                            placeholder="Email Address" 
                            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500 text-white"
                          />
                          <select 
                            value={staff.role}
                            onChange={(e) => {
                              const list = [...staffList];
                              list[idx].role = e.target.value;
                              setStaffList(list);
                            }}
                            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500 text-slate-300"
                          >
                            <option value="staff">Staff Operator</option>
                            <option value="manager">Resort Manager</option>
                            <option value="admin">System Admin</option>
                          </select>
                        </div>
                        
                        <button 
                          onClick={() => setStaffList(staffList.filter((_, i) => i !== idx))}
                          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Render Landing Page Customizer */}
              {currentStep.id === 'landing_cms' && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800/80 pb-4">
                    <h3 className="text-xl font-bold">Landing Page Customizer</h3>
                    <p className="text-xs text-slate-400">Establish the copywriting for the public guest reception portal</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-400">Hero Main Title Headline</label>
                      <input 
                        type="text" 
                        value={cmsConfig.heroTitle}
                        onChange={(e) => setCmsConfig({ ...cmsConfig, heroTitle: e.target.value })}
                        placeholder="A Sanctuary of Refined Comfort" 
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-400">Hero Subtitle Text</label>
                      <input 
                        type="text" 
                        value={cmsConfig.heroSubtitle}
                        onChange={(e) => setCmsConfig({ ...cmsConfig, heroSubtitle: e.target.value })}
                        placeholder="Enjoy premium hospitality services..." 
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-400">Welcome Introduction Message</label>
                      <textarea 
                        value={cmsConfig.welcomeMessage}
                        onChange={(e) => setCmsConfig({ ...cmsConfig, welcomeMessage: e.target.value })}
                        placeholder="Welcome message paragraph details..." 
                        rows={3}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Render Transactional SMTP setup */}
              {currentStep.id === 'transactional_emails' && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800/80 pb-4">
                    <h3 className="text-xl font-bold">SMTP Mail Server Connection</h3>
                    <p className="text-xs text-slate-400">Connect a mail delivery api / SMTP provider to dispatch guest notifications and booking emails</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-400">Email Provider</label>
                        <select 
                          value={smtpConfig.provider}
                          onChange={(e) => setSmtpConfig({ ...smtpConfig, provider: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none text-slate-300"
                        >
                          <option value="smtp">Standard SMTP Transport</option>
                          <option value="sendgrid">SendGrid SMTP API</option>
                        </select>
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-400">Sender Identity Email Address</label>
                        <input 
                          type="email" 
                          value={smtpConfig.fromEmail}
                          onChange={(e) => setSmtpConfig({ ...smtpConfig, fromEmail: e.target.value })}
                          placeholder="noreply@myresort.com" 
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none"
                        />
                      </div>
                    </div>

                    {smtpConfig.provider === 'sendgrid' ? (
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-400">SendGrid API Key (SG....)</label>
                        <input 
                          type="password" 
                          value={smtpConfig.apiKey}
                          onChange={(e) => setSmtpConfig({ ...smtpConfig, apiKey: e.target.value, verifySuccess: false, verifyMsg: '' })}
                          placeholder="SG...." 
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none font-mono"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1 col-span-2">
                          <label className="text-xs font-semibold text-slate-400">SMTP Server Host</label>
                          <input 
                            type="text" 
                            value={smtpConfig.host}
                            onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value, verifySuccess: false, verifyMsg: '' })}
                            placeholder="smtp.mailtrap.io" 
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-400">Port</label>
                          <input 
                            type="text" 
                            value={smtpConfig.port}
                            onChange={(e) => setSmtpConfig({ ...smtpConfig, port: e.target.value, verifySuccess: false, verifyMsg: '' })}
                            placeholder="2525" 
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-400">Username</label>
                          <input 
                            type="text" 
                            value={smtpConfig.user}
                            onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                            placeholder="User login" 
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div className="space-y-1 col-span-2">
                          <label className="text-xs font-semibold text-slate-400">Password</label>
                          <input 
                            type="password" 
                            value={smtpConfig.pass}
                            onChange={(e) => setSmtpConfig({ ...smtpConfig, pass: e.target.value })}
                            placeholder="Password login" 
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none"
                          />
                        </div>
                      </div>
                    )}

                    <div className="border-t border-slate-800/80 pt-4 flex gap-3 items-end">
                      <div className="flex-1 space-y-1">
                        <label className="text-xs font-semibold text-slate-400 font-medium">Test Recipient Email Address</label>
                        <input 
                          type="email" 
                          value={smtpConfig.testRecipient}
                          onChange={(e) => setSmtpConfig({ ...smtpConfig, testRecipient: e.target.value })}
                          placeholder="recipient@example.com" 
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-1.5 text-xs focus:border-indigo-500 outline-none"
                        />
                      </div>
                      <button 
                        onClick={handleTestEmail}
                        disabled={submitting || !smtpConfig.testRecipient}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg transition-all disabled:opacity-40 h-[34px]"
                      >
                        {submitting ? 'Sending Test...' : 'Send Verification Mail'}
                      </button>
                    </div>

                    {smtpConfig.verifyMsg && (
                      <div className={`p-4 rounded-xl border text-xs flex gap-2 ${
                        smtpConfig.verifySuccess 
                          ? 'bg-emerald-950/20 border-emerald-800 text-emerald-400' 
                          : 'bg-red-950/20 border-red-900 text-rose-400'
                      }`}>
                        {smtpConfig.verifySuccess ? <CheckCircle2 className="h-4.5 w-4.5 shrink-0" /> : <ShieldAlert className="h-4.5 w-4.5 shrink-0" />}
                        <span>{smtpConfig.verifyMsg}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Render Finalize / Go Live */}
              {currentStep.id === 'go_live' && (
                <div className="space-y-6 text-center py-6">
                  {finalManualUrl ? (
                    <div className="space-y-6">
                      <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-2">
                        <Check className="h-10 w-10" />
                      </div>
                      <h2 className="text-3xl font-extrabold text-white">Your Resort is Live!</h2>
                      <p className="mx-auto max-w-md text-sm text-slate-400">
                        Property, roles, variables, and selected modules have been provisioned successfully! Download your Resort Operations Manual to keep a local record.
                      </p>
                      
                      <div className="pt-4 flex flex-col gap-3 max-w-xs mx-auto">
                        <a 
                          href={finalManualUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold hover:shadow-lg hover:shadow-indigo-500/30 transition-all text-sm inline-flex items-center justify-center gap-2"
                        >
                          <FileText className="h-4.5 w-4.5" /> Print Operations Manual
                        </a>
                        <button 
                          onClick={() => router.push('/admin')}
                          className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold transition-all text-sm"
                        >
                          Go to Admin Dashboard
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mb-2">
                        <Play className="h-10 w-10" />
                      </div>
                      <h2 className="text-3xl font-extrabold text-white">Provisioning Ready</h2>
                      <p className="mx-auto max-w-md text-sm text-slate-400">
                        We have accumulated all configurations from color palettes to API credentials. Press the button below to initialize database structures and provision your resort ecosystem.
                      </p>
                      
                      <div className="pt-6">
                        <button 
                          onClick={handleGoLive}
                          disabled={submitting}
                          className="px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 font-bold hover:shadow-lg hover:shadow-indigo-500/30 transition-all text-base inline-flex items-center gap-2"
                        >
                          {submitting ? (
                            <>
                              <RefreshCw className="h-5 w-5 animate-spin" /> Provisioning Environment...
                            </>
                          ) : (
                            <>
                              Launch Resort Operations <Sparkles className="h-5 w-5" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Navigation Footer */}
              {currentStep.id !== 'welcome' && (
                <div className="mt-8 pt-6 border-t border-slate-800/80 flex justify-between">
                  <button 
                    onClick={prevStep}
                    className="px-4 py-2 rounded-xl border border-slate-800 text-xs font-semibold hover:bg-slate-900 transition-colors"
                  >
                    Back
                  </button>
                  <button 
                    onClick={nextStep}
                    disabled={
                      (currentStep.id === 'resort_details' && !resortDetails.name) ||
                      (currentStep.id === 'go_live' && !finalManualUrl)
                    }
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold hover:shadow-md hover:shadow-indigo-500/20 transition-all disabled:opacity-30 disabled:pointer-events-none"
                  >
                    Continue
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
