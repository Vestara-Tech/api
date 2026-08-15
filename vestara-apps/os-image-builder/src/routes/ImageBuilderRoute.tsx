import { useParams } from 'react-router';
import type { ReactNode } from 'react';
import { ImageBuilderProvider } from '../context/ImageBuilderContext';

export function ImageBuilderRoute({ children }: { children: ReactNode }) {
  const { profileId } = useParams<{ profileId: string }>();
  if (!profileId) return null;
  return <ImageBuilderProvider profileId={profileId}>{children}</ImageBuilderProvider>;
}
