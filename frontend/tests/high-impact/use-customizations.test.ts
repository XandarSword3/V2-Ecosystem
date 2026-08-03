import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useQueryMock = vi.hoisted(() => vi.fn((options: unknown) => options));
const useMutationMock = vi.hoisted(() => vi.fn((options: unknown) => options));
const invalidateQueriesMock = vi.hoisted(() => vi.fn());

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const apiPutMock = vi.hoisted(() => vi.fn());
const apiDeleteMock = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => useQueryMock(options),
  useMutation: (options: unknown) => useMutationMock(options),
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: apiGetMock,
    post: apiPostMock,
    put: apiPutMock,
    delete: apiDeleteMock,
  },
}));

import {
  customizationKeys,
  useCreateCustomizationOption,
  useCreateCustomizationGroup,
  useCustomizationGroup,
  useCustomizationGroups,
  useDeleteCustomizationGroup,
  useDeleteCustomizationOption,
  useEntityCustomizations,
  useLinkCustomization,
  useOrderCustomizations,
  useUnlinkCustomization,
  useUpdateCustomizationOption,
  useUpdateCustomizationGroup,
  useValidateCustomizations,
} from '../../src/hooks/useCustomizations';

describe('useCustomizations hooks', () => {
  beforeEach(() => {
    useQueryMock.mockClear();
    useMutationMock.mockClear();
    invalidateQueriesMock.mockClear();
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPutMock.mockReset();
    apiDeleteMock.mockReset();
  });

  it('builds stable query keys', () => {
    expect(customizationKeys.all).toEqual(['customizations']);
    expect(customizationKeys.forEntity('menu_item', 'entity-1')).toEqual([
      'customizations',
      'entity',
      'menu_item',
      'entity-1',
    ]);
    expect(customizationKeys.group('group-1')).toEqual([
      'customizations',
      'groups',
      'group-1',
    ]);
    expect(customizationKeys.order('menu_service', 'order-1')).toEqual([
      'customizations',
      'order',
      'menu_service',
      'order-1',
    ]);
  });

  it('configures entity customization query and calls expected endpoint', async () => {
    renderHook(() => useEntityCustomizations('menu_item', 'item-1'));

    const options = useQueryMock.mock.calls[0][0] as {
      queryKey: unknown[];
      queryFn: () => Promise<unknown>;
      enabled: boolean;
      staleTime: number;
    };

    expect(options.queryKey).toEqual([
      'customizations',
      'entity',
      'menu_item',
      'item-1',
    ]);
    expect(options.enabled).toBe(true);
    expect(options.staleTime).toBe(5 * 60 * 1000);

    apiGetMock.mockResolvedValueOnce({ data: [{ groupId: 'g-1' }] });
    const result = await options.queryFn();

    expect(apiGetMock).toHaveBeenCalledWith('/customizations/for-entity/menu_item/item-1');
    expect(result).toEqual([{ groupId: 'g-1' }]);
  });

  it('disables entity query when entity id is missing', () => {
    renderHook(() => useEntityCustomizations('menu_item', ''));

    const options = useQueryMock.mock.calls[0][0] as { enabled: boolean };
    expect(options.enabled).toBe(false);
  });

  it('configures order customizations query with optional orderItemId param', async () => {
    renderHook(() => useOrderCustomizations('menu_service', 'ord-1', 'line-1'));

    const withItem = useQueryMock.mock.calls[0][0] as {
      queryKey: unknown[];
      queryFn: () => Promise<unknown>;
    };

    expect(withItem.queryKey).toEqual([
      'customizations',
      'order',
      'menu_service',
      'ord-1',
      'line-1',
    ]);

    apiGetMock.mockResolvedValueOnce({ data: [{ groupName: 'Sauces' }] });
    const resultWithItem = await withItem.queryFn();
    expect(apiGetMock).toHaveBeenCalledWith('/customizations/orders/menu_service/ord-1?orderItemId=line-1');
    expect(resultWithItem).toEqual([{ groupName: 'Sauces' }]);

    useQueryMock.mockClear();
    renderHook(() => useOrderCustomizations('menu_service', 'ord-2'));

    const withoutItem = useQueryMock.mock.calls[0][0] as {
      queryKey: unknown[];
      queryFn: () => Promise<unknown>;
    };

    expect(withoutItem.queryKey).toEqual([
      'customizations',
      'order',
      'menu_service',
      'ord-2',
      undefined,
    ]);

    apiGetMock.mockResolvedValueOnce({ data: [] });
    await withoutItem.queryFn();
    expect(apiGetMock).toHaveBeenLastCalledWith('/customizations/orders/menu_service/ord-2');
  });

  it('uses mutation endpoint for selection validation', async () => {
    renderHook(() => useValidateCustomizations());

    const options = useMutationMock.mock.calls[0][0] as {
      mutationFn: (payload: unknown) => Promise<unknown>;
    };

    const payload = {
      entityType: 'menu_item',
      entityId: 'item-1',
      selections: [{ groupId: 'g', optionId: 'o', quantity: 1 }],
    };

    apiPostMock.mockResolvedValueOnce({ data: { isValid: true } });
    const result = await options.mutationFn(payload);

    expect(apiPostMock).toHaveBeenCalledWith('/customizations/validate', payload);
    expect(result).toEqual({ isValid: true });
  });

  it('configures admin list/detail queries with expected params', async () => {
    renderHook(() =>
      useCustomizationGroups({
        entityType: 'menu_item',
        isGlobal: true,
        includeOptions: true,
      })
    );

    const listOptions = useQueryMock.mock.calls[0][0] as {
      queryKey: unknown[];
      queryFn: () => Promise<unknown>;
    };

    expect(listOptions.queryKey).toEqual([
      'customizations',
      'groups',
      {
        entityType: 'menu_item',
        isGlobal: true,
        includeOptions: true,
      },
    ]);

    apiGetMock.mockResolvedValueOnce({ data: { data: [{ id: 'group-1' }] } });
    await listOptions.queryFn();

    expect(apiGetMock).toHaveBeenCalledWith(
      '/customizations/groups?entityType=menu_item&isGlobal=true&includeOptions=true'
    );

    useQueryMock.mockClear();

    renderHook(() => useCustomizationGroup('group-1', false));
    const detailOptions = useQueryMock.mock.calls[0][0] as {
      queryKey: unknown[];
      queryFn: () => Promise<unknown>;
      enabled: boolean;
    };

    expect(detailOptions.queryKey).toEqual(['customizations', 'groups', 'group-1']);
    expect(detailOptions.enabled).toBe(true);

    apiGetMock.mockResolvedValueOnce({ data: { data: { id: 'group-1' } } });
    await detailOptions.queryFn();
    expect(apiGetMock).toHaveBeenLastCalledWith('/customizations/groups/group-1?includeOptions=false');
  });

  it('invalidates related caches on admin mutation success callbacks', async () => {
    renderHook(() => useCreateCustomizationGroup());
    const createOptions = useMutationMock.mock.calls[0][0] as {
      onSuccess: () => void;
    };

    createOptions.onSuccess();
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ['customizations', 'groups'],
    });

    useMutationMock.mockClear();
    invalidateQueriesMock.mockClear();

    renderHook(() => useUpdateCustomizationGroup());
    const updateOptions = useMutationMock.mock.calls[0][0] as {
      onSuccess: (_: unknown, variables: { id: string; data: Record<string, unknown> }) => void;
    };

    updateOptions.onSuccess(undefined, { id: 'group-9', data: {} });

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ['customizations', 'groups'],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ['customizations', 'groups', 'group-9'],
    });
  });

  it('configures option and link mutations with correct invalidations', async () => {
    renderHook(() => useCreateCustomizationOption());
    const createOption = useMutationMock.mock.calls[0][0] as {
      mutationFn: (payload: unknown) => Promise<unknown>;
      onSuccess: (_: unknown, vars: { groupId: string }) => void;
    };

    const optionPayload = {
      groupId: 'group-2',
      name: 'Extra Cheese',
      customizationType: 'add',
    };
    apiPostMock.mockResolvedValueOnce({ data: { id: 'opt-1' } });
    await createOption.mutationFn(optionPayload);
    expect(apiPostMock).toHaveBeenCalledWith('/customizations/options', optionPayload);

    createOption.onSuccess(undefined, { groupId: 'group-2' });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ['customizations', 'groups', 'group-2'],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ['customizations', 'groups'],
    });

    useMutationMock.mockClear();
    invalidateQueriesMock.mockClear();

    renderHook(() => useUpdateCustomizationOption());
    const updateOption = useMutationMock.mock.calls[0][0] as {
      mutationFn: (payload: { id: string; groupId: string; data: Record<string, unknown> }) => Promise<unknown>;
      onSuccess: (_: unknown, vars: { groupId: string }) => void;
    };

    apiPutMock.mockResolvedValueOnce({ data: { id: 'opt-1' } });
    await updateOption.mutationFn({ id: 'opt-1', groupId: 'group-2', data: { name: 'No Onion' } });
    expect(apiPutMock).toHaveBeenCalledWith('/customizations/options/opt-1', { name: 'No Onion' });

    updateOption.onSuccess(undefined, { groupId: 'group-2' });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['customizations', 'groups', 'group-2'] });

    useMutationMock.mockClear();
    invalidateQueriesMock.mockClear();

    renderHook(() => useDeleteCustomizationOption());
    const deleteOption = useMutationMock.mock.calls[0][0] as {
      mutationFn: (payload: { id: string; groupId: string }) => Promise<{ groupId: string }>;
      onSuccess: (_: unknown, vars: { groupId: string }) => void;
    };

    apiDeleteMock.mockResolvedValueOnce({});
    const deleteOptionResult = await deleteOption.mutationFn({ id: 'opt-1', groupId: 'group-2' });
    expect(apiDeleteMock).toHaveBeenCalledWith('/customizations/options/opt-1');
    expect(deleteOptionResult).toEqual({ groupId: 'group-2' });

    deleteOption.onSuccess(undefined, { groupId: 'group-2' });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['customizations', 'groups', 'group-2'] });

    useMutationMock.mockClear();
    invalidateQueriesMock.mockClear();

    renderHook(() => useLinkCustomization());
    const linkMutation = useMutationMock.mock.calls[0][0] as {
      mutationFn: (payload: unknown) => Promise<unknown>;
      onSuccess: (_: unknown, vars: { entityType: 'menu_item'; entityId: string }) => void;
    };

    const linkPayload = { entityType: 'menu_item', entityId: 'menu-1', customizationGroupId: 'group-2' };
    apiPostMock.mockResolvedValueOnce({ data: { id: 'link-1' } });
    await linkMutation.mutationFn(linkPayload);
    expect(apiPostMock).toHaveBeenCalledWith('/customizations/entity-links', linkPayload);

    linkMutation.onSuccess(undefined, { entityType: 'menu_item', entityId: 'menu-1' });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ['customizations', 'entity', 'menu_item', 'menu-1'],
    });

    useMutationMock.mockClear();
    invalidateQueriesMock.mockClear();

    renderHook(() => useUnlinkCustomization());
    const unlinkMutation = useMutationMock.mock.calls[0][0] as {
      mutationFn: (payload: { linkId: string; entityType: 'menu_item'; entityId: string }) => Promise<unknown>;
      onSuccess: (_: unknown, vars: { entityType: 'menu_item'; entityId: string }) => void;
    };

    apiDeleteMock.mockResolvedValueOnce({});
    await unlinkMutation.mutationFn({ linkId: 'link-1', entityType: 'menu_item', entityId: 'menu-1' });
    expect(apiDeleteMock).toHaveBeenCalledWith('/customizations/entity-links/link-1');

    unlinkMutation.onSuccess(undefined, { entityType: 'menu_item', entityId: 'menu-1' });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ['customizations', 'entity', 'menu_item', 'menu-1'],
    });
  });

  it('configures delete group mutation and invalidates list cache', async () => {
    renderHook(() => useDeleteCustomizationGroup());
    const options = useMutationMock.mock.calls[0][0] as {
      mutationFn: (id: string) => Promise<void>;
      onSuccess: () => void;
    };

    apiDeleteMock.mockResolvedValueOnce({});
    await options.mutationFn('group-1');
    expect(apiDeleteMock).toHaveBeenCalledWith('/customizations/groups/group-1');

    options.onSuccess();
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ['customizations', 'groups'],
    });
  });
});
