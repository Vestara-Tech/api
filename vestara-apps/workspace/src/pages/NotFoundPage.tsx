import { SectionPage } from '../app/components/SectionPage.js';

export function NotFoundPage() {
  return (
    <SectionPage
      title="Not found"
      description="The requested workspace route does not exist."
      breadcrumbs={[{ label: 'Workspace', href: '/workspace/overview' }, { label: 'Not found' }]}
      note="Use the Workspace navigation to jump back to an authored surface."
    />
  );
}
