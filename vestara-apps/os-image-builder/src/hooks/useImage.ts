import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateImageProfileInput } from '../api/contracts';
import { imageApi } from '../api/imageApi';
import { queryKeys } from '../api/queryKeys';

export function useProfiles() {
  return useQuery({
    queryKey: queryKeys.image.profiles,
    queryFn: () => imageApi.listProfiles(),
  });
}

export function useProfile(profileId: string) {
  return useQuery({
    queryKey: queryKeys.image.profile(profileId),
    queryFn: () => imageApi.getProfile(profileId),
    enabled: profileId.length > 0,
  });
}

export function useRegisterProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (profile: Parameters<typeof imageApi.registerProfile>[0]) => imageApi.registerProfile(profile),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.image.profiles });
      client.invalidateQueries({ queryKey: queryKeys.image.all });
    },
  });
}

export function useUpdateProfile(profileId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateImageProfileInput) => imageApi.updateProfile(profileId, patch),
    onSuccess: (profile) => {
      client.setQueryData(queryKeys.image.profile(profileId), profile);
      client.invalidateQueries({ queryKey: queryKeys.image.profiles });
    },
  });
}

export function useBuildPlan(profileId: string, target: string) {
  return useQuery({
    queryKey: queryKeys.image.plan(profileId, target),
    queryFn: () => imageApi.plan(profileId, target),
    enabled: profileId.length > 0,
  });
}

export function useBuild() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { profileId: string; target: string }) => imageApi.build(input.profileId, input.target, true),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.image.state });
    },
  });
}

export function useBuildState() {
  return useQuery({
    queryKey: queryKeys.image.state,
    queryFn: () => imageApi.buildState(),
  });
}
