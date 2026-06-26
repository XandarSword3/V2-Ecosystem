/**
 * sanitize.ts — XSS sanitization wrapper for all CMS/user-generated HTML
 *
 * Usage:
 *   import { sanitize, sanitizeText } from '@/lib/sanitize';
 *
 *   // For any field rendered via dangerouslySetInnerHTML:
 *   <div dangerouslySetInnerHTML={{ __html: sanitize(cms.heroBody) }} />
 *
 *   // For plain text fields (no HTML allowed at all):
 *   <p>{sanitizeText(cms.description)}</p>
 *
 * DOMPurify runs client-side only. Both functions are SSR-safe:
 * they fall back to stripping all tags server-side when window is unavailable.
 */

import type { Config } from 'dompurify';

// SSR-safe DOMPurify import — only runs in the browser
let _purify: typeof import('dompurify').default | null = null;

async function getPurify() {
  if (_purify) return _purify;
  if (typeof window === 'undefined') return null;
  const { default: DOMPurify } = await import('dompurify');
  _purify = DOMPurify;
  return _purify;
}

/**
 * Allowed HTML elements for CMS rich-text fields.
 * Covers typical tenant-authored content: paragraphs, links, lists, headings,
 * basic formatting. Script tags, iframes, object, embed are always blocked
 * by DOMPurify regardless of this config.
 */
const CMS_CONFIG: Config = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 's',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'a', 'img',
    'blockquote', 'code', 'pre',
    'span', 'div',
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel',  // <a>
    'src', 'alt', 'width', 'height',  // <img>
    'class', 'id',            // structural
  ],
  ALLOW_DATA_ATTR: false,
  FORCE_BODY: false,
};

/** Force all links to open in a new tab with rel=noopener */
const LINK_HOOK_APPLIED = new Set<object>();
function applyLinkHook(purify: NonNullable<typeof _purify>) {
  if (LINK_HOOK_APPLIED.has(purify)) return;
  purify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
  LINK_HOOK_APPLIED.add(purify);
}

/**
 * Sanitize an HTML string for safe rendering via dangerouslySetInnerHTML.
 * Returns a clean HTML string. On SSR (no window), strips all tags.
 *
 * @param dirty - Raw HTML string from CMS, user input, or API response
 * @param config - Optional DOMPurify config override
 */
export function sanitize(dirty: string | null | undefined, config?: Config): string {
  if (!dirty) return '';
  // SSR fallback: strip all tags server-side
  if (typeof window === 'undefined') {
    return dirty.replace(/<[^>]*>/g, '');
  }
  // Lazy-initialise synchronously in browser context
  if (!_purify) {
    // Trigger async load — on first call we fall back to tag-strip
    getPurify().then((p) => { _purify = p; });
    return dirty.replace(/<[^>]*>/g, '');
  }
  applyLinkHook(_purify);
  return _purify.sanitize(dirty, { ...CMS_CONFIG, ...config }) as string;
}

/**
 * Sanitize plain text — strips ALL HTML tags.
 * Use this for fields that should never contain markup
 * (titles, labels, nav items, descriptions, etc.).
 */
export function sanitizeText(dirty: string | null | undefined): string {
  if (!dirty) return '';
  if (typeof window === 'undefined') {
    return dirty.replace(/<[^>]*>/g, '');
  }
  if (!_purify) {
    getPurify().then((p) => { _purify = p; });
    return dirty.replace(/<[^>]*>/g, '');
  }
  return _purify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }) as string;
}

/**
 * React helper — returns a dangerouslySetInnerHTML prop object.
 * Saves a line at each call site.
 *
 * Usage:
 *   <div {...innerHtml(cms.heroBody)} />
 */
export function innerHtml(dirty: string | null | undefined, config?: Config) {
  return { dangerouslySetInnerHTML: { __html: sanitize(dirty, config) } };
}
