'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { usePathname } from 'next/navigation';
import { getStoredPropertyId, isValidPropertyId, setStoredPropertyId } from '@/lib/property-id';

interface Property {
  id: string;
  name: string;
  type: string;
  public_slug: string;
  property_code?: string;
  slug?: string;
}

interface PropertyAccess {
  property_id: string;
  access_level: string;
  is_primary: boolean;
  property: Property;
}

interface PropertyContextType {
  properties: PropertyAccess[];
  activePropertyId: string | null;
  activeProperty: Property | null;
  setActiveProperty: (id: string) => void;
  loading: boolean;
  refreshProperties: () => Promise<void>;
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

const GLOBAL_ROUTE_SEGMENTS = new Set([
  'login', 'register', 'forgot-password', 'reset-password',
  'install', 'platform-admin', 'cookie-policy', 'terms', 'privacy',
  'offline', 'error', 'global-error', 'api', 'nexus',
]);

function extractUrlPropertySlug(): string | null {
  if (typeof window === 'undefined') return null;
  const pathSegments = window.location.pathname.split('/').filter(Boolean);
  if (pathSegments.length === 0) return null;
  const first = pathSegments[0];
  if (GLOBAL_ROUTE_SEGMENTS.has(first)) {
    return null;
  }
  return first;
}

function isSlugMatch(p: any, urlSlug: string): boolean {
  if (!urlSlug || !p) return false;
  const s = urlSlug.toLowerCase();
  const ps = (p.public_slug || '').toLowerCase();
  const pc = (p.property_code || '').toLowerCase();
  const slug = (p.slug || '').toLowerCase();
  const name = (p.name || '').toLowerCase().replace(/['\s]/g, '-');

  return (
    ps === s ||
    ps === `${s}-property` ||
    ps.replace(/-property$/, '') === s ||
    pc === s ||
    slug === s ||
    name === s ||
    name.startsWith(s)
  );
}

export function PropertyProvider({ children }: { children: ReactNode }) {
  const [properties, setProperties] = useState<PropertyAccess[]>([]);
  const [activePropertyId, setActivePropertyIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      // Fetch accessible properties from backend
      const res = await api.get('/multi-property/my-properties');
      const data = res.data.properties || [];
      const mapped: PropertyAccess[] = data.map((p: any) => ({
        property_id: p.id,
        access_level: p.access_level,
        is_primary: p.is_primary,
        property: p
      }));
      setProperties(mapped);

      if (data.length > 0) {
        // Priority 1: Match property against current URL slug (e.g. /default/admin -> "default")
        const urlSlug = extractUrlPropertySlug();
        let matchedProp = urlSlug
          ? data.find((p: any) => isSlugMatch(p, urlSlug))
          : null;

        if (matchedProp) {
          setActivePropertyIdState(matchedProp.id);
          setStoredPropertyId(matchedProp.id);
        } else {
          // Priority 2: Pre-stored ID if user has access
          const storedId = getStoredPropertyId();
          const hasAccessToStored = storedId && data.find((p: any) => p.id === storedId);

          if (hasAccessToStored) {
            setActivePropertyIdState(storedId);
          } else {
            // Priority 3: Primary property or first property
            const primary = data.find((p: any) => p.is_primary) || data[0];
            const primaryId = primary?.id;
            if (isValidPropertyId(primaryId)) {
              setActivePropertyIdState(primaryId);
              setStoredPropertyId(primaryId);
            } else {
              setActivePropertyIdState(null);
              setStoredPropertyId(null);
            }
          }
        }
      } else {
        setActivePropertyIdState(null);
        setStoredPropertyId(null);
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error);
      toast.error('Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  const pathname = usePathname();

  useEffect(() => {
    fetchProperties();
  }, []);

  // Sync activePropertyId if URL route changes to a different property slug
  useEffect(() => {
    if (!properties || properties.length === 0) return;
    const urlSlug = extractUrlPropertySlug();
    if (urlSlug) {
      const matched = properties.find((pa) => isSlugMatch(pa.property, urlSlug));
      if (matched && matched.property_id !== activePropertyId) {
        setActivePropertyIdState(matched.property_id);
        setStoredPropertyId(matched.property_id);
      }
    }
  }, [properties, activePropertyId, pathname]);

  const setActiveProperty = (id: string) => {
    if (!isValidPropertyId(id)) return;
    setActivePropertyIdState(id);
    setStoredPropertyId(id);
  };

  const activePropertyAccess = properties.find(p => p.property_id === activePropertyId);
  const activeProperty = activePropertyAccess ? activePropertyAccess.property : null;

  return (
    <PropertyContext.Provider
      value={{
        properties,
        activePropertyId,
        activeProperty,
        setActiveProperty,
        loading,
        refreshProperties: fetchProperties
      }}
    >
      {children}
    </PropertyContext.Provider>
  );
}

export function useProperty() {
  const context = useContext(PropertyContext);
  if (context === undefined) {
    throw new Error('useProperty must be used within a PropertyProvider');
  }
  return context;
}
