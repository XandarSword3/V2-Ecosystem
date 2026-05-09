'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface Property {
  id: string;
  name: string;
  type: string;
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
      setProperties(data.map((p: any) => ({
        property_id: p.id,
        access_level: p.access_level,
        is_primary: p.is_primary,
        property: p
      })));

      if (data.length > 0) {
        const storedId = localStorage.getItem('activePropertyId');
        const hasAccessToStored = data.find((p: PropertyAccess) => p.property_id === storedId);
        
        if (storedId && hasAccessToStored) {
          setActivePropertyIdState(storedId);
        } else {
          // Fall back to primary or first available
          const primary = data.find((p: PropertyAccess) => p.is_primary) || data[0];
          setActivePropertyIdState(primary.property_id);
          localStorage.setItem('activePropertyId', primary.property_id);
        }
      } else {
        setActivePropertyIdState(null);
        localStorage.removeItem('activePropertyId');
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error);
      toast.error('Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const setActiveProperty = (id: string) => {
    setActivePropertyIdState(id);
    localStorage.setItem('activePropertyId', id);
    // Optionally we can force a page reload to refresh all data, 
    // or rely on components listening to this context.
    // window.location.reload(); 
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
