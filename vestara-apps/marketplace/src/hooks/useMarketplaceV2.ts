import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { marketplaceV2Api, type ContributionManifestView } from '../api/marketplaceV2Api';
import { queryKeys } from '../api/queryKeys';

export function useContributions() {
  return useQuery({
    queryKey: queryKeys.marketplace.contributions,
    queryFn: () => marketplaceV2Api.contributions(),
  });
}

export function useProvides(kind: string) {
  return useQuery({
    queryKey: queryKeys.marketplace.provides(kind),
    queryFn: () => marketplaceV2Api.provides(kind),
    enabled: kind.length > 0,
  });
}

export function useBundles() {
  return useQuery({
    queryKey: queryKeys.marketplace.bundles,
    queryFn: () => marketplaceV2Api.bundles(),
  });
}

export function useCreateBundle() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof marketplaceV2Api.createBundle>[0]) => marketplaceV2Api.createBundle(input),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.marketplace.bundles });
    },
  });
}

export function useDistributions() {
  return useQuery({
    queryKey: queryKeys.marketplace.distributions,
    queryFn: () => marketplaceV2Api.distributions(),
  });
}

export function useCreateDistribution() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof marketplaceV2Api.createDistribution>[0]) => marketplaceV2Api.createDistribution(input),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.marketplace.distributions });
    },
  });
}

export function usePlanDistribution(distributionId: string) {
  return useQuery({
    queryKey: queryKeys.marketplace.plan(distributionId),
    queryFn: () => marketplaceV2Api.planDistribution(distributionId),
    enabled: distributionId.length > 0,
  });
}

export function usePublished() {
  return useQuery({
    queryKey: queryKeys.marketplace.published,
    queryFn: () => marketplaceV2Api.published(),
  });
}

export function usePublishers() {
  return useQuery({
    queryKey: queryKeys.marketplace.publishers,
    queryFn: () => marketplaceV2Api.publishers(),
  });
}

export function useVersions(packageId: string) {
  return useQuery({
    queryKey: queryKeys.marketplace.versions(packageId),
    queryFn: () => marketplaceV2Api.versions(packageId),
    enabled: packageId.length > 0,
  });
}

export function useRegisterContribution() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { packageId: string; version: string; manifest: ContributionManifestView }) => marketplaceV2Api.registerContribution(input.packageId, input.version, input.manifest),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.marketplace.contributions });
    },
  });
}

export function useResolve() {
  return useMutation({
    mutationFn: (manifest: ContributionManifestView) => marketplaceV2Api.resolve(manifest),
  });
}

export function useRegisterPublisher() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof marketplaceV2Api.registerPublisher>[0]) => marketplaceV2Api.registerPublisher(input),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.marketplace.publishers });
    },
  });
}

export function usePublish() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof marketplaceV2Api.publish>[0]) => marketplaceV2Api.publish(input),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.marketplace.published });
    },
  });
}
