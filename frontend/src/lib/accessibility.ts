/**
 * WCAG 2.1 Color Contrast & Accessibility Audit Utilities
 */

import { UIBlock } from '@/types/module-builder';

// Parse hex color to RGB [0..255]
export function hexToRgb(hex: string): [number, number, number] | null {
  let cleaned = hex.trim().replace(/^#/, '');
  if (cleaned.length === 3) {
    cleaned = cleaned.split('').map(c => c + c).join('');
  }
  if (cleaned.length !== 6) return null;
  const num = parseInt(cleaned, 16);
  if (isNaN(num)) return null;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

// Convert 0..255 sRGB value to relative luminance value
function srgbToLuminance(val: number): number {
  const s = val / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

// Calculate relative luminance of an RGB color
export function getRelativeLuminance(rgb: [number, number, number]): number {
  return (
    0.2126 * srgbToLuminance(rgb[0]) +
    0.7152 * srgbToLuminance(rgb[1]) +
    0.0722 * srgbToLuminance(rgb[2])
  );
}

// Calculate WCAG contrast ratio between two colors (hex)
export function getContrastRatio(fgHex: string, bgHex: string): number | null {
  const fgRgb = hexToRgb(fgHex);
  const bgRgb = hexToRgb(bgHex);
  if (!fgRgb || !bgRgb) return null;

  const l1 = getRelativeLuminance(fgRgb);
  const l2 = getRelativeLuminance(bgRgb);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

export interface AccessibilityIssue {
  blockId: string;
  blockType: string;
  severity: 'error' | 'warning';
  message: string;
  field?: string;
  suggestion?: string;
}

export function auditBlockAccessibility(block: UIBlock): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  // Image alt text check
  if (block.type === 'image') {
    if (!block.props?.alt || block.props.alt.trim() === '') {
      issues.push({
        blockId: block.id,
        blockType: block.type,
        severity: 'error',
        message: 'Image is missing alt text for screen readers',
        field: 'props.alt',
        suggestion: 'Add a descriptive alt text string explaining what the image displays',
      });
    }
  }

  // Text contrast check
  const textColor = block.style?.color;
  const bgColor = block.style?.backgroundColor || block.background?.color;
  if (textColor && bgColor) {
    const ratio = getContrastRatio(textColor, bgColor);
    if (ratio !== null && ratio < 4.5) {
      issues.push({
        blockId: block.id,
        blockType: block.type,
        severity: ratio < 3.0 ? 'error' : 'warning',
        message: `Low text contrast ratio (${ratio.toFixed(2)}:1). WCAG AA requires minimum 4.5:1`,
        field: 'style.color',
        suggestion: 'Adjust text or background color to increase contrast',
      });
    }
  }

  // Button text check
  if (block.type === 'button') {
    if (!block.props?.text && !block.props?.ariaLabel) {
      issues.push({
        blockId: block.id,
        blockType: block.type,
        severity: 'error',
        message: 'Button missing label or aria-label',
        field: 'props.text',
        suggestion: 'Provide visible text or an aria-label attribute for accessibility',
      });
    }
  }

  return issues;
}

export function auditLayoutAccessibility(layout: UIBlock[]): AccessibilityIssue[] {
  const allIssues: AccessibilityIssue[] = [];
  for (const block of layout) {
    allIssues.push(...auditBlockAccessibility(block));
    if (block.children) {
      allIssues.push(...auditLayoutAccessibility(block.children));
    }
  }
  return allIssues;
}
