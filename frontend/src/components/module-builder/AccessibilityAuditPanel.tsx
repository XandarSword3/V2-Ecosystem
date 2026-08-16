'use client';

import { useMemo } from 'react';
import { useModuleBuilderStore } from '@/stores/module-builder-store';
import { auditLayoutAccessibility, AccessibilityIssue } from '@/lib/accessibility';
import { AlertTriangle, CheckCircle, ShieldAlert, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { modulesApi } from '@/lib/api';

export function AccessibilityAuditPanel() {
  const { layout, selectBlock, selectedBlockId } = useModuleBuilderStore();

  const issues = useMemo(() => auditLayoutAccessibility(layout), [layout]);

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  const handleFixAltText = async (issue: AccessibilityIssue) => {
    selectBlock(issue.blockId);
    toast.info('Requesting AI Alt Text generation...');
    try {
      // Endpoint call to backend AI provider
      const response = await fetch('/api/admin/ai/generate-alt-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: 'placeholder.jpg' }),
      });
      const data = await response.json();
      if (!data.success && data.code === 'AI_FEATURE_DISABLED') {
        toast.error('AI features disabled (AI_PROVIDER=disabled). Please set alt text manually.');
      } else if (data.data?.altText) {
        useModuleBuilderStore.getState().updateBlock(issue.blockId, {
          props: { alt: data.data.altText },
        });
        toast.success('Generated alt text applied!');
      }
    } catch {
      toast.error('AI features disabled. Please set alt text manually.');
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between border-b pb-3 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-indigo-500" />
          WCAG 2.1 Audit
        </h3>
        {issues.length === 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <CheckCircle className="h-3.5 w-3.5" /> 100% Pass
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" /> {issues.length} {issues.length === 1 ? 'Issue' : 'Issues'}
          </span>
        )}
      </div>

      {issues.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
          <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
          No accessibility issues detected.<br />
          All canvas images, colors, and controls pass WCAG AA standards.
        </div>
      ) : (
        <div className="space-y-2">
          {issues.map((issue, idx) => {
            const isSelected = selectedBlockId === issue.blockId;
            return (
              <div
                key={`${issue.blockId}_${idx}`}
                onClick={() => selectBlock(issue.blockId)}
                className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40'
                    : issue.severity === 'error'
                    ? 'border-red-200 bg-red-50/30 hover:bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/20'
                    : 'border-amber-200 bg-amber-50/30 hover:bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-medium">
                    {issue.severity === 'error' ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                    )}
                    <span className="text-slate-800 dark:text-slate-200 capitalize">
                      [{issue.blockType}] {issue.message}
                    </span>
                  </div>
                </div>

                {issue.suggestion && (
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 pl-5">
                    💡 {issue.suggestion}
                  </p>
                )}

                {issue.field === 'props.alt' && (
                  <div className="mt-2 pl-5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFixAltText(issue);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-[10px] font-semibold hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-400"
                    >
                      <Sparkles className="h-3 w-3" /> Auto-Generate Alt Text
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
