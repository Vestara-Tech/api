import { useParams } from 'react-router';
import type { ReactNode } from 'react';
import { BuilderProvider } from '../context/BuilderContext';

export function DefinitionRoute({ children }: { children: ReactNode }) {
  const { definitionId } = useParams<{ definitionId: string }>();
  if (!definitionId) return null;
  return <BuilderProvider definitionId={definitionId}>{children}</BuilderProvider>;
}
