import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import type { ApiEndpoint } from '../api/contracts';
import { useBuilder } from '../context/BuilderContext';

export function EndpointPage() {
  const { definitionId, endpointId } = useParams<{ definitionId: string; endpointId: string }>();
  const { definition, patch } = useBuilder();
  const navigate = useNavigate();

  const endpoint = useMemo(
    () => definition?.endpoints.find((e) => e.id === endpointId),
    [definition, endpointId],
  );

  if (!definition || !endpoint) {
    return <Typography sx={{ p: 3, color: 'text.secondary' }}>Endpoint not found</Typography>;
  }

  const setEndpoint = (mutator: (e: ApiEndpoint) => ApiEndpoint) => {
    void patch((d) => ({
      ...d,
      endpoints: d.endpoints.map((e) => (e.id === endpoint.id ? mutator(e) : e)),
    }));
  };

  const addParameter = () => {
    setEndpoint((e) => ({
      ...e,
      parameters: [
        ...(e.parameters ?? []),
        { id: `param_${Date.now().toString(36)}`, name: 'id', in: 'path', type: 'string', required: true },
      ],
    }));
  };

  const removeParameter = (paramId: string) => {
    setEndpoint((e) => ({ ...e, parameters: (e.parameters ?? []).filter((p) => p.id !== paramId) }));
  };

  const togglePolicy = (policyId: string) => {
    setEndpoint((e) => {
      const current = e.policyIds ?? [];
      const next = current.includes(policyId) ? current.filter((p) => p !== policyId) : [...current, policyId];
      return { ...e, policyIds: next };
    });
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 2  }}>
        <Button component={Link} to={`/definitions/${definitionId}`} startIcon={<ArrowBackIcon />} size="small">
          Back
        </Button>
        <Chip
          label={endpoint.method}
          sx={{ bgcolor: methodColor(endpoint.method), color: '#fff', fontFamily: 'monospace', fontWeight: 700 }}
        />
        <Typography sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{endpoint.path}</Typography>
        <Box sx={{ flex: 1 }} />
        <Chip
          label={(endpoint.responses ?? []).some((r) => r.status < 400) ? 'Has success response' : 'No response configured'}
          color={(endpoint.responses ?? []).some((r) => r.status < 400) ? 'success' : 'default'}
          size="small"
        />
      </Stack>

      <Stack direction="row" spacing={3} sx={{ alignItems: 'flex-start' }}>
        {/* REQUEST */}
        <Box sx={{ flex: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary' }}>
            Request
          </Typography>

          <Typography variant="subtitle2" sx={{ mt: 2, fontSize: 12, fontWeight: 600 }}>
            Path Parameters
          </Typography>
          {(endpoint.parameters ?? []).filter((p) => p.in === 'path').length === 0 ? (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              None
            </Typography>
          ) : null}
          {(endpoint.parameters ?? [])
            .filter((p) => p.in === 'path')
            .map((param) => (
              <Stack key={param.id} direction="row" spacing={1} sx={{ mt: 1 }}>
                <TextField size="small" label="Name" value={param.name} sx={{ width: 140 }} onChange={(e) => updateParam(endpoint, setEndpoint, param.id, { name: e.target.value })} />
                <TextField size="small" select label="Type" value={param.type} sx={{ width: 140 }} onChange={(e) => updateParam(endpoint, setEndpoint, param.id, { type: e.target.value })}>
                  {['string', 'integer', 'number', 'uuid', 'boolean'].map((t) => (
                    <MenuItem key={t} value={t}>
                      {t}
                    </MenuItem>
                  ))}
                </TextField>
                <FormControlLabel
                  control={<Switch size="small" checked={param.required ?? false} onChange={(e) => updateParam(endpoint, setEndpoint, param.id, { required: e.target.checked })} />}
                  label="required"
                />
                <Button size="small" onClick={() => removeParameter(param.id)}>
                  <DeleteOutlinedIcon fontSize="small" />
                </Button>
              </Stack>
            ))}

          <Typography variant="subtitle2" sx={{ mt: 2, fontSize: 12, fontWeight: 600 }}>
            Query Parameters
          </Typography>
          {(endpoint.parameters ?? []).filter((p) => p.in === 'query').length === 0 ? (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              None
            </Typography>
          ) : null}
          {(endpoint.parameters ?? [])
            .filter((p) => p.in === 'query')
            .map((param) => (
              <Stack key={param.id} direction="row" spacing={1} sx={{ mt: 1 }}>
                <TextField size="small" label="Name" value={param.name} sx={{ width: 140 }} onChange={(e) => updateParam(endpoint, setEndpoint, param.id, { name: e.target.value })} />
                <TextField size="small" select label="Type" value={param.type} sx={{ width: 140 }} onChange={(e) => updateParam(endpoint, setEndpoint, param.id, { type: e.target.value })}>
                  {['string', 'integer', 'number', 'uuid', 'boolean'].map((t) => (
                    <MenuItem key={t} value={t}>
                      {t}
                    </MenuItem>
                  ))}
                </TextField>
                <FormControlLabel
                  control={<Switch size="small" checked={param.required ?? false} onChange={(e) => updateParam(endpoint, setEndpoint, param.id, { required: e.target.checked })} />}
                  label="required"
                />
                <Button size="small" onClick={() => removeParameter(param.id)}>
                  <DeleteOutlinedIcon fontSize="small" />
                </Button>
              </Stack>
            ))}

          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button size="small" startIcon={<AddIcon />} onClick={addParameter}>
              Add Parameter
            </Button>
          </Stack>

          <Typography variant="subtitle2" sx={{ mt: 3, fontSize: 12, fontWeight: 600 }}>
            Request Body
          </Typography>
          <TextField
            select
            size="small"
            label="Resource"
            value={endpoint.requestBody?.resource ?? ''}
            sx={{ mt: 1, minWidth: 200 }}
            onChange={(e) =>
              setEndpoint((ep) => ({
                ...ep,
                ...(e.target.value
                  ? { requestBody: { resource: e.target.value } }
                  : {}),
              }))
            }
          >
            <MenuItem value="">— none —</MenuItem>
            {definition.resources.map((r) => (
              <MenuItem key={r.id} value={r.name}>
                {r.name}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        {/* RESPONSE + POLICIES */}
        <Box sx={{ flex: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary' }}>
            Response
          </Typography>
          {(endpoint.responses ?? []).map((resp) => (
            <Stack key={resp.status} direction="row" spacing={1} sx={{ mt: 1 }}>
              <Chip label={resp.status} size="small" color={resp.status < 400 ? 'success' : 'error'} />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {resp.description ?? ''}
              </Typography>
            </Stack>
          ))}
          {(endpoint.responses ?? []).length === 0 ? (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              No responses configured
            </Typography>
          ) : null}

          <Typography variant="subtitle2" sx={{ mt: 3, fontSize: 12, fontWeight: 600 }}>
            Policies
          </Typography>
          {definition.policies.length === 0 ? (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              No policies declared
            </Typography>
          ) : (
            definition.policies.map((policy) => (
              <FormControlLabel
                key={policy.id}
                control={
                  <Switch
                    size="small"
                    checked={(endpoint.policyIds ?? []).includes(policy.id)}
                    onChange={() => togglePolicy(policy.id)}
                  />
                }
                label={`${policy.name} (${policy.effect} ${policy.action})`}
              />
            ))
          )}
        </Box>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
        <Button variant="outlined" onClick={() => navigate(`/definitions/${definitionId}/preview`)}>
          Preview Contract
        </Button>
        <Button variant="contained" onClick={() => navigate(`/definitions/${definitionId}`)}>
          Save & Close
        </Button>
      </Stack>
    </Box>
  );
}

function updateParam(
  endpoint: ApiEndpoint,
  setEndpoint: (mutator: (e: ApiEndpoint) => ApiEndpoint) => void,
  paramId: string,
  patch: Record<string, unknown>,
) {
  setEndpoint((e) => ({
    ...e,
    parameters: (e.parameters ?? []).map((p) => (p.id === paramId ? { ...p, ...patch } : p)),
  }));
}

function methodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: '#4f8a5b',
    POST: '#5a7fb8',
    PUT: '#b8865a',
    PATCH: '#a05a9c',
    DELETE: '#b85a5a',
  };
  return colors[method] ?? '#555';
}
