import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { ImageProfile, UpdateImageProfileInput } from '../api/contracts';
import { useProfile, useUpdateProfile } from '../hooks/useImage';

interface ImageBuilderContextValue {
  profile: ImageProfile | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  patch: (mutator: (draft: ImageProfile) => ImageProfile) => Promise<void>;
  update: (patch: UpdateImageProfileInput) => Promise<void>;
}

const ImageBuilderContext = createContext<ImageBuilderContextValue | null>(null);

export function ImageBuilderProvider({
  profileId,
  children,
}: {
  profileId: string;
  children: ReactNode;
}) {
  const { data: profile, isLoading, isError, error } = useProfile(profileId);
  const updateMutation = useUpdateProfile(profileId);

  const update = useCallback(
    async (patch: UpdateImageProfileInput) => {
      await updateMutation.mutateAsync(patch);
    },
    [updateMutation],
  );

  const patch = useCallback(
    async (mutator: (draft: ImageProfile) => ImageProfile) => {
      if (!profile) return;
      await updateMutation.mutateAsync(mutator(profile));
    },
    [profile, updateMutation],
  );

  const value = useMemo<ImageBuilderContextValue>(
    () => ({
      profile,
      isLoading,
      isError,
      error: error ?? null,
      patch,
      update,
    }),
    [profile, isLoading, isError, error, patch, update],
  );

  return <ImageBuilderContext.Provider value={value}>{children}</ImageBuilderContext.Provider>;
}

export function useImageBuilder(): ImageBuilderContextValue {
  const ctx = useContext(ImageBuilderContext);
  if (!ctx) throw new Error('useImageBuilder must be used within ImageBuilderProvider');
  return ctx;
}
