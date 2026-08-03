'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  CustomizableEntityType,
  CustomizationGroupWithOptions,
  CustomizationSelection,
  CustomizationValidationResult,
  ValidatedSelection,
} from '@/components/customization/CustomizationSelector';

// Query keys
export const customizationKeys = {
  all: ['customizations'] as const,
  forEntity: (entityType: CustomizableEntityType, entityId: string) =>
    [...customizationKeys.all, 'entity', entityType, entityId] as const,
  groups: () => [...customizationKeys.all, 'groups'] as const,
  group: (id: string) => [...customizationKeys.groups(), id] as const,
  order: (orderType: string, orderId: string) =>
    [...customizationKeys.all, 'order', orderType, orderId] as const,
};

/**
 * Hook to fetch customizations available for an entity
 */
export function useEntityCustomizations(
  entityType: CustomizableEntityType,
  entityId: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: customizationKeys.forEntity(entityType, entityId),
    queryFn: async () => {
      const response = await api.get<CustomizationGroupWithOptions[]>(
        `/customizations/for-entity/${entityType}/${entityId}`
      );
      return response.data;
    },
    enabled: options?.enabled !== false && !!entityId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to validate customization selections
 */
export function useValidateCustomizations() {
  return useMutation({
    mutationFn: async (data: {
      entityType: CustomizableEntityType;
      entityId: string;
      selections: CustomizationSelection[];
    }) => {
      const response = await api.post<CustomizationValidationResult>(
        '/customizations/validate',
        data
      );
      return response.data;
    },
  });
}

/**
 * Hook to get customizations for a placed order
 */
export function useOrderCustomizations(
  orderType: string,
  orderId: string,
  orderItemId?: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: [...customizationKeys.order(orderType, orderId), orderItemId],
    queryFn: async () => {
      const params = orderItemId ? `?orderItemId=${orderItemId}` : '';
      const response = await api.get<Array<{
        groupName: string;
        options: Array<{
          name: string;
          type: string;
          quantity: number;
          priceAdjustment: number;
        }>;
      }>>(`/customizations/orders/${orderType}/${orderId}${params}`);
      return response.data;
    },
    enabled: options?.enabled !== false && !!orderId,
  });
}

// ==========================================
// ADMIN HOOKS
// ==========================================

/**
 * Hook to list all customization groups (admin)
 */
export function useCustomizationGroups(filters?: {
  entityType?: CustomizableEntityType;
  isGlobal?: boolean;
  includeOptions?: boolean;
}) {
  const params = new URLSearchParams();
  if (filters?.entityType) params.append('entityType', filters.entityType);
  if (filters?.isGlobal !== undefined) params.append('isGlobal', String(filters.isGlobal));
  if (filters?.includeOptions) params.append('includeOptions', 'true');

  return useQuery({
    queryKey: [...customizationKeys.groups(), filters],
    queryFn: async () => {
      const response = await api.get(`/customizations/groups?${params}`);
      return response.data;
    },
  });
}

/**
 * Hook to get a single customization group (admin)
 */
export function useCustomizationGroup(id: string, includeOptions = true) {
  return useQuery({
    queryKey: customizationKeys.group(id),
    queryFn: async () => {
      const response = await api.get(
        `/customizations/groups/${id}?includeOptions=${includeOptions}`
      );
      return response.data;
    },
    enabled: !!id,
  });
}

/**
 * Hook to create a customization group
 */
export function useCreateCustomizationGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      nameAr?: string;
      description?: string;
      selectionMode: 'single' | 'multiple' | 'quantity';
      minSelections?: number;
      maxSelections?: number;
      isRequired?: boolean;
      applicableEntityTypes: CustomizableEntityType[];
      isGlobal?: boolean;
    }) => {
      const response = await api.post('/customizations/groups', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customizationKeys.groups() });
    },
  });
}

/**
 * Hook to update a customization group
 */
export function useUpdateCustomizationGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const response = await api.put(`/customizations/groups/${id}`, data);
      return response.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: customizationKeys.groups() });
      queryClient.invalidateQueries({ queryKey: customizationKeys.group(id) });
    },
  });
}

/**
 * Hook to delete a customization group
 */
export function useDeleteCustomizationGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/customizations/groups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customizationKeys.groups() });
    },
  });
}

/**
 * Hook to create a customization option
 */
export function useCreateCustomizationOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      groupId: string;
      name: string;
      nameAr?: string;
      customizationType: 'add' | 'remove' | 'swap' | 'upgrade' | 'replace';
      priceAdjustment?: number;
      inventoryItemId?: string;
      quantityPerSelection?: number;
      maxQuantity?: number;
      isDefault?: boolean;
      isPopular?: boolean;
    }) => {
      const response = await api.post('/customizations/options', data);
      return response.data;
    },
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: customizationKeys.group(groupId) });
      queryClient.invalidateQueries({ queryKey: customizationKeys.groups() });
    },
  });
}

/**
 * Hook to update a customization option
 */
export function useUpdateCustomizationOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      groupId,
      data,
    }: {
      id: string;
      groupId: string;
      data: Record<string, any>;
    }) => {
      const response = await api.put(`/customizations/options/${id}`, data);
      return response.data;
    },
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: customizationKeys.group(groupId) });
      queryClient.invalidateQueries({ queryKey: customizationKeys.groups() });
    },
  });
}

/**
 * Hook to delete a customization option
 */
export function useDeleteCustomizationOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, groupId }: { id: string; groupId: string }) => {
      await api.delete(`/customizations/options/${id}`);
      return { groupId };
    },
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: customizationKeys.group(groupId) });
      queryClient.invalidateQueries({ queryKey: customizationKeys.groups() });
    },
  });
}

/**
 * Hook to link a customization group to an entity
 */
export function useLinkCustomization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      entityType: CustomizableEntityType;
      entityId: string;
      customizationGroupId: string;
      isRequiredOverride?: boolean;
      priceMultiplier?: number;
    }) => {
      const response = await api.post('/customizations/entity-links', data);
      return response.data;
    },
    onSuccess: (_, { entityType, entityId }) => {
      queryClient.invalidateQueries({
        queryKey: customizationKeys.forEntity(entityType, entityId),
      });
    },
  });
}

/**
 * Hook to unlink a customization from an entity
 */
export function useUnlinkCustomization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      linkId,
      entityType,
      entityId,
    }: {
      linkId: string;
      entityType: CustomizableEntityType;
      entityId: string;
    }) => {
      await api.delete(`/customizations/entity-links/${linkId}`);
      return { entityType, entityId };
    },
    onSuccess: (_, { entityType, entityId }) => {
      queryClient.invalidateQueries({
        queryKey: customizationKeys.forEntity(entityType, entityId),
      });
    },
  });
}
