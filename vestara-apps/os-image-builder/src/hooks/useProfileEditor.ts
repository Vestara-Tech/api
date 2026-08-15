import { useImageBuilder } from '../context/ImageBuilderContext';
import { useUpdateProfile } from '../hooks/useImage';

export function useProfileEditor() {
  const { profile, patch } = useImageBuilder();
  const update = useUpdateProfile(profile?.id ?? '');

  return {
    profile,
    patch,
    update,
    save: (mutator: (draft: NonNullable<typeof profile>) => void) => {
      if (!profile) return;
      const next = structuredClone(profile);
      mutator(next);
      void update.mutateAsync(next);
    },
    isSaving: update.isPending,
  };
}
