import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import type { Contract, PreviewResult } from '../api/contracts';
import { builderApi } from '../api/builderApi';
import { useBuilder } from '../context/BuilderContext';
import { fieldTypeLabel } from '../types/domain';

type TabKey = 'api' | 'openapi' | 'schema' | 'changes';

export function PreviewPage() {
  const { definitionId } = useParams<{ definitionId: string }>();
  const { definition } = useBuilder();
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('api');

  useEffect(() => {
    if (!definitionId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void builderApi
      .preview(definitionId)
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [definitionId, definition?.revision]);

  if (!definition) return null;

  const validation = preview?.validation;
  const compat = preview?.compatibility;
  const errors = validation?.issues.filter((i) => i.severity === 'error') ?? [];
  const warnings = validation?.issues.filter((i) => i.severity === 'warning') ?? [];

  return (
    <Box sx={{ p: 3, maxWidth: 1200 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 2  }}>
        <Button component={Link} to={`/definitions/${definitionId}`} startIcon={<ArrowBackIcon />} size="small">
          Back
        </Button>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Preview — {definition.name}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {validation ? (
          validation.ok ? (
            <Chip label="Contract valid ✓" color="success" />
          ) : (
            <Chip label={`${errors.length} errors · ${warnings.length} warnings`} color="error" />
          )
        ) : null}
        {preview?.contract ? <Chip label={`hash ${preview.contract.hash.slice(0, 8)}…`} variant="outlined" size="small" /> : null}
      </Stack>

      {loading ? <LinearProgress /> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      {!preview ? null : (
        <>
          {compat && (compat.changes.length > 0 || compat.classification === 'breaking') ? (
            <Alert severity={compat.classification === 'breaking' ? 'warning' : 'success'} sx={{ mb: 2 }}>
              Compatibility: {compat.classification} — {compat.changes.length} change{compat.changes.length === 1 ? '' : 's'}
            </Alert>
          ) : null}

          <Tabs value={tab} onChange={(_, v: TabKey) => setTab(v)} sx={{ mb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Tab label="API" value="api" />
            <Tab label="OpenAPI" value="openapi" />
            <Tab label="Schema" value="schema" />
            <Tab label="Changes" value="changes" />
          </Tabs>

          {tab === 'api' ? <ApiTab preview={preview} /> : null}
          {tab === 'openapi' ? <OpenApiTab contract={preview.contract} /> : null}
          {tab === 'schema' ? <SchemaTab preview={preview} /> : null}
          {tab === 'changes' ? <ChangesTab preview={preview} /> : null}
        </>
      )}
    </Box>
  );
}

function ApiTab({ preview }: { preview: PreviewResult }) {
  const resources = preview.definition.resources;
  const endpoints = preview.definition.endpoints;
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
            Resources
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            {resources.map((r) => (
              <Chip key={r.id} label={r.name} size="small" />
            ))}
          </Stack>
        </Box>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
            Endpoints ({endpoints.length})
          </Typography>
          {endpoints.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Endpoints are generated when you define resources and fields.
            </Typography>
          ) : (
            endpoints.map((e) => (
              <Box key={e.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                <Chip label={e.method} size="small" sx={{ fontFamily: 'monospace', minWidth: 56 }} color={e.method === 'GET' ? 'success' : e.method === 'DELETE' ? 'error' : 'primary'} />
                <Typography sx={{ fontFamily: 'monospace' }}>{e.path}</Typography>
              </Box>
            ))
          )}
        </Box>
      </Stack>
    </Box>
  );
}

function OpenApiTab({ contract }: { contract: Contract }) {
  const openapi = contract.openapi as { paths?: Record<string, unknown>; info?: { title?: string } } | undefined;
  const paths = Object.keys(openapi?.paths ?? {});
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 1  }}>
        <Chip label={`OpenAPI 3.1 · ${paths.length} paths`} size="small" />
        <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
          compiler {contract.compilerVersion}
        </Typography>
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: 12 }}>
        {JSON.stringify(openapi, null, 2)}
      </Typography>
    </Box>
  );
}

function SchemaTab({ preview }: { preview: PreviewResult }) {
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2 }}>
      <Stack spacing={3}>
        {preview.definition.resources.map((r) => (
          <Box key={r.id}>
            <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{r.name}</Typography>
            {r.fields.map((f) => (
              <Box key={f.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontFamily: 'monospace', width: 160 }}>{f.name}</Typography>
                <Chip label={fieldTypeLabel(f.type)} size="small" variant="outlined" />
                {f.required ? <Chip label="required" size="small" color="primary" /> : null}
                {f.unique ? <Chip label="unique" size="small" /> : null}
              </Box>
            ))}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function ChangesTab({ preview }: { preview: PreviewResult }) {
  const compat = preview.compatibility;
  if (compat.changes.length === 0) {
    return (
      <Alert severity="info">
        No changes detected against the published revision (or none published yet).
      </Alert>
    );
  }
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2 }}>
      <Stack spacing={1}>
        {compat.changes.map((change, i) => (
          <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Chip
              label={change.severity.toUpperCase()}
              size="small"
              color={change.severity === 'breaking' ? 'error' : change.severity === 'compatible' ? 'success' : 'default'}
            />
            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', minWidth: 220 }}>
              {change.path}
            </Typography>
            <Typography variant="body2">{change.message}</Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
