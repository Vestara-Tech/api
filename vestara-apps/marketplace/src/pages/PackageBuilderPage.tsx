import { useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, Stack, Step, StepLabel, Stepper, TextField, Typography } from '@mui/material';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import type { ContributionManifestView } from '../api/marketplaceV2Api';
import { useRegisterContribution, useResolve } from '../hooks/useMarketplaceV2';

const STEPS = ['Basics', 'Contributions', 'Requirements', 'Review'] as const;

const EMPTY_MANIFEST: ContributionManifestView = { provides: [], requires: [], optional: [] };

export function PackageBuilderPage() {
  const [step, setStep] = useState(0);
  const [packageId, setPackageId] = useState('');
  const [version, setVersion] = useState('0.1.0');
  const [provides, setProvides] = useState<{ kind: string; id: string; name: string }[]>([{ kind: '', id: '', name: '' }]);
  const [requires, setRequires] = useState<{ module: string; capability?: string }[]>([{ module: '' }]);
  const [result, setResult] = useState<string | null>(null);

  const register = useRegisterContribution();
  const resolve = useResolve();

  const manifest = useMemo<ContributionManifestView>(
    () => ({
      provides: provides.filter((p) => p.kind && p.id && p.name).map((p) => ({ kind: p.kind, id: p.id, name: p.name })),
      requires: requires.filter((r) => r.module).map((r) => ({ module: r.module, ...(r.capability ? { capability: r.capability } : {}) })),
      optional: [],
    }),
    [provides, requires],
  );

  const canAdvance = step === 0 ? packageId.length > 0 && version.length > 0 : step === 1 ? manifest.provides.length > 0 : true;

  const runResolve = async (): Promise<void> => {
    setResult(null);
    try {
      const resolution = await resolve.mutateAsync(manifest);
      setResult(
        resolution.ok
          ? 'Capability resolution: all requirements satisfied.'
          : `Capability resolution: missing required ${resolution.missingRequired.join(', ')}.`,
      );
    } catch (error) {
      setResult(`Resolution failed: ${(error as Error).message}`);
    }
  };

  const submit = async (): Promise<void> => {
    setResult(null);
    try {
      const entry = await register.mutateAsync({ packageId, version, manifest });
      setResult(`Registered ${entry.manifest.provides.length} contribution(s) for ${entry.packageId}@${entry.version}.`);
    } catch (error) {
      setResult(`Failed: ${(error as Error).message}`);
    }
  };

  const setProvide = (index: number, field: keyof typeof provides[number], value: string): void => {
    setProvides((list) => list.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const setRequire = (index: number, value: string, capability?: string): void => {
    setRequires((list) => list.map((item, i) => (i === index ? { module: value, ...(capability ? { capability } : {}) } : item)));
  };

  return (
    <Box sx={{ p: 3, maxWidth: 900 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
        <BuildCircleIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Package Builder</Typography>
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Describe a package's contributions and requirements; resolve capability coverage, then register it in the catalog.
      </Typography>

      <Stepper activeStep={step} sx={{ mb: 3 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {step === 0 ? (
        <Stack spacing={1.5} sx={{ maxWidth: 420 }}>
          <TextField label="Package ID" value={packageId} onChange={(e) => setPackageId(e.target.value)} placeholder="acme.rag-toolkit" />
          <TextField label="Version" value={version} onChange={(e) => setVersion(e.target.value)} />
        </Stack>
      ) : null}

      {step === 1 ? (
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Contributes (provides)</Typography>
          <Stack spacing={1}>
            {provides.map((item, index) => (
              <Stack key={index} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <TextField label="Kind" value={item.kind} onChange={(e) => setProvide(index, 'kind', e.target.value)} placeholder="ai.agent" />
                <TextField label="ID" value={item.id} onChange={(e) => setProvide(index, 'id', e.target.value)} placeholder="acme.rag-agent" />
                <TextField label="Name" value={item.name} onChange={(e) => setProvide(index, 'name', e.target.value)} placeholder="RAG Agent" />
                <Button onClick={() => setProvides((list) => list.filter((_, i) => i !== index))} disabled={provides.length === 1}>Remove</Button>
              </Stack>
            ))}
          </Stack>
          <Button sx={{ mt: 1 }} onClick={() => setProvides((list) => [...list, { kind: '', id: '', name: '' }])}>Add contribution</Button>
        </Box>
      ) : null}

      {step === 2 ? (
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Requires (dependencies)</Typography>
          <Stack spacing={1}>
            {requires.map((item, index) => (
              <Stack key={index} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <TextField label="Module" value={item.module} onChange={(e) => setRequire(index, e.target.value, item.capability)} placeholder="ai" />
                <TextField
                  label="Capability (optional)"
                  value={item.capability ?? ''}
                  onChange={(e) => setRequire(index, item.module, e.target.value || undefined)}
                />
                <Button onClick={() => setRequires((list) => list.filter((_, i) => i !== index))} disabled={requires.length === 1}>Remove</Button>
              </Stack>
            ))}
          </Stack>
          <Button sx={{ mt: 1 }} onClick={() => setRequires((list) => [...list, { module: '' }])}>Add requirement</Button>
        </Box>
      ) : null}

      {step === 3 ? (
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Manifest preview</Typography>
          <Box component="pre" sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'auto', fontSize: 12 }}>
            {JSON.stringify({ packageId, version, manifest }, null, 2)}
          </Box>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button variant="outlined" onClick={() => void runResolve()} disabled={resolve.isPending}>Resolve capabilities</Button>
            <Button variant="contained" onClick={() => void submit()} disabled={register.isPending}>Register package</Button>
          </Stack>
        </Box>
      ) : null}

      {result !== null ? (
        <Alert severity={result.startsWith('Failed') || result.startsWith('Capability resolution: missing') ? 'error' : 'success'} sx={{ mt: 2 }}>
          {result}
        </Alert>
      ) : null}

      <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
        <Button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Back</Button>
        <Box sx={{ flex: 1 }} />
        {step < STEPS.length - 1 ? (
          <Button variant="contained" onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}>Next</Button>
        ) : null}
      </Stack>

      {manifest.provides.length > 0 ? (
        <Stack direction="row" spacing={0.5} sx={{ mt: 2 }}>
          {manifest.provides.map((p) => (
            <Chip key={`${p.kind}:${p.id}`} size="small" label={`${p.kind}: ${p.name}`} variant="outlined" />
          ))}
        </Stack>
      ) : null}
    </Box>
  );
}
