import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ApiDefinition, ApiField, ApiResource, UpdateDefinitionInput } from '../api/contracts';
import { useDefinition, useUpdateDefinition } from '../hooks/useBuilder';
import { randomId } from '../lib/id';

interface BuilderContextValue {
  definition: ApiDefinition | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  revision: number;
  patch: (mutator: (draft: ApiDefinition) => ApiDefinition) => Promise<void>;
  addResource: (name: string) => Promise<void>;
  removeResource: (resourceId: string) => Promise<void>;
  renameResource: (resourceId: string, name: string, plural: string) => Promise<void>;
  addField: (resourceId: string, name: string, type: string) => Promise<void>;
  updateField: (resourceId: string, fieldId: string, field: ApiField) => Promise<void>;
  removeField: (resourceId: string, fieldId: string) => Promise<void>;
  addRelation: (
    resourceId: string,
    relation: { name: string; kind: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many'; targetResource: string; foreignKey?: string },
  ) => Promise<void>;
  removeRelation: (resourceId: string, relationId: string) => Promise<void>;
  setSelectedResource: (resourceId: string | null) => void;
  selectedResource: ApiResource | undefined;
  selectedField: ApiField | undefined;
  setSelectedField: (fieldId: string | null) => void;
}

const BuilderContext = createContext<BuilderContextValue | null>(null);

export function BuilderProvider({
  definitionId,
  children,
}: {
  definitionId: string;
  children: ReactNode;
}) {
  const { data: definition, isLoading, isError, error } = useDefinition(definitionId);
  const update = useUpdateDefinition(definitionId);

  const [selectedResourceId, setSelectedResource] = useState<string | null>(null);
  const [selectedFieldId, setSelectedField] = useState<string | null>(null);

  const revision = definition?.revision ?? 0;

  const patch = useCallback(
    async (mutator: (draft: ApiDefinition) => ApiDefinition) => {
      if (!definition) return;
      const next = mutator(definition);
      const body: UpdateDefinitionInput = {
        ...(next.resources !== definition.resources ? { resources: next.resources } : {}),
        ...(next.endpoints !== definition.endpoints ? { endpoints: next.endpoints } : {}),
        ...(next.policies !== definition.policies ? { policies: next.policies } : {}),
        ...(next.operations !== definition.operations ? { operations: next.operations } : {}),
        ...(next.events !== definition.events ? { events: next.events } : {}),
      };
      await update.mutateAsync(body);
    },
    [definition, update],
  );

  const addResource = useCallback(
    async (name: string) => {
      await patch((d) => ({
        ...d,
        resources: [...d.resources, { id: randomId('res'), name, fields: [] }],
      }));
    },
    [patch],
  );

  const removeResource = useCallback(
    async (resourceId: string) => {
      await patch((d) => ({
        ...d,
        resources: d.resources.filter((r) => r.id !== resourceId),
        endpoints: d.endpoints.filter((e) => e.requestBody?.resource !== resourceId),
      }));
    },
    [patch],
  );

  const renameResource = useCallback(
    async (resourceId: string, name: string, plural: string) => {
      await patch((d) => ({
        ...d,
        resources: d.resources.map((r) =>
          r.id === resourceId ? { ...r, name, ...(plural ? { plural } : {}) } : r,
        ),
      }));
    },
    [patch],
  );

  const addField = useCallback(
    async (resourceId: string, name: string, type: string) => {
      await patch((d) => ({
        ...d,
        resources: d.resources.map((r) =>
          r.id === resourceId
            ? { ...r, fields: [...r.fields, { id: randomId('fld'), name, type }] }
            : r,
        ),
      }));
    },
    [patch],
  );

  const updateField = useCallback(
    async (resourceId: string, fieldId: string, field: ApiField) => {
      await patch((d) => ({
        ...d,
        resources: d.resources.map((r) =>
          r.id === resourceId
            ? { ...r, fields: r.fields.map((f) => (f.id === fieldId ? field : f)) }
            : r,
        ),
      }));
    },
    [patch],
  );

  const removeField = useCallback(
    async (resourceId: string, fieldId: string) => {
      await patch((d) => ({
        ...d,
        resources: d.resources.map((r) =>
          r.id === resourceId ? { ...r, fields: r.fields.filter((f) => f.id !== fieldId) } : r,
        ),
      }));
    },
    [patch],
  );

  const addRelation = useCallback(
    async (
      resourceId: string,
      relation: { name: string; kind: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many'; targetResource: string; foreignKey?: string },
    ) => {
      await patch((d) => ({
        ...d,
        resources: d.resources.map((r) =>
          r.id === resourceId
            ? {
                ...r,
                relations: [
                  ...(r.relations ?? []),
                  {
                    id: randomId('rel'),
                    name: relation.name,
                    kind: relation.kind,
                    targetResource: relation.targetResource,
                    ...(relation.foreignKey !== undefined ? { foreignKey: relation.foreignKey } : {}),
                  },
                ],
              }
            : r,
        ),
      }));
    },
    [patch],
  );

  const removeRelation = useCallback(
    async (resourceId: string, relationId: string) => {
      await patch((d) => ({
        ...d,
        resources: d.resources.map((r) =>
          r.id === resourceId
            ? { ...r, relations: (r.relations ?? []).filter((rel) => rel.id !== relationId) }
            : r,
        ),
      }));
    },
    [patch],
  );

  const selectedResource = useMemo(
    () => definition?.resources.find((r) => r.id === selectedResourceId) ?? undefined,
    [definition, selectedResourceId],
  );

  const selectedField = useMemo(
    () => selectedResource?.fields.find((f) => f.id === selectedFieldId) ?? undefined,
    [selectedResource, selectedFieldId],
  );

  const value = useMemo<BuilderContextValue>(
    () => ({
      definition,
      isLoading,
      isError,
      error,
      revision,
      patch,
      addResource,
      removeResource,
      renameResource,
      addField,
      updateField,
      removeField,
      addRelation,
      removeRelation,
      setSelectedResource,
      selectedResource,
      selectedField,
      setSelectedField,
    }),
    [
      definition,
      isLoading,
      isError,
      error,
      revision,
      patch,
      addResource,
      removeResource,
      renameResource,
      addField,
      updateField,
      removeField,
      addRelation,
      removeRelation,
      selectedResource,
      selectedField,
    ],
  );

  return <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>;
}

export function useBuilder(): BuilderContextValue {
  const ctx = useContext(BuilderContext);
  if (!ctx) throw new Error('useBuilder must be used within BuilderProvider');
  return ctx;
}
