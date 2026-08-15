import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateDefinitionInput } from '../api/contracts';
import { builderApi } from '../api/builderApi';
import { queryKeys } from '../api/queryKeys';

export function useDefinitionsList() {
  return useQuery({
    queryKey: queryKeys.definitions.list({}),
    queryFn: () => builderApi.list({}),
  });
}

export function useDefinition(definitionId: string) {
  return useQuery({
    queryKey: queryKeys.definitions.detail(definitionId),
    queryFn: () => builderApi.get(definitionId),
    enabled: definitionId.length > 0,
  });
}

export function useCreateDefinition() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; namespace: string; version: string; description?: string; tags?: string[] }) =>
      builderApi.create(input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.definitions.all }),
  });
}

export function useUpdateDefinition(definitionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateDefinitionInput) =>
      builderApi.get(definitionId).then((current) => builderApi.update(definitionId, patch, current.revision)),
    onSuccess: (updated) => {
      client.setQueryData(queryKeys.definitions.detail(definitionId), updated);
      client.invalidateQueries({ queryKey: queryKeys.definitions.all });
    },
  });
}

export function useValidate(definitionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => builderApi.validate(definitionId),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.definitions.detail(definitionId) }),
  });
}

export function usePreview(definitionId: string) {
  return useQuery({
    queryKey: queryKeys.definitions.preview(definitionId),
    queryFn: () => builderApi.preview(definitionId),
    enabled: false,
  });
}

export function usePublish(definitionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => builderApi.get(definitionId).then((current) => builderApi.publish(definitionId, current.revision)),
    onSuccess: (result) => {
      client.setQueryData(queryKeys.definitions.detail(definitionId), result.definition);
      client.invalidateQueries({ queryKey: queryKeys.definitions.all });
    },
  });
}

export function useRevisions(definitionId: string) {
  return useQuery({
    queryKey: queryKeys.definitions.revisions(definitionId),
    queryFn: () => builderApi.revisions(definitionId),
    enabled: definitionId.length > 0,
  });
}

export function useRollback(definitionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => builderApi.rollback(definitionId),
    onSuccess: (updated) => {
      client.setQueryData(queryKeys.definitions.detail(definitionId), updated);
      client.invalidateQueries({ queryKey: queryKeys.definitions.all });
      client.invalidateQueries({ queryKey: queryKeys.definitions.revisions(definitionId) });
    },
  });
}
