import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useImageBuilder } from '../context/ImageBuilderContext';
import { APP_CATALOG, applicationsSizeMb, catalogEntry } from '../types/domain';

export function ApplicationsPage() {
  const { profile, patch } = useImageBuilder();
  if (!profile) return null;

  const selected = profile.applications.applications;
  const footprintMb = applicationsSizeMb(selected);

  const requiredIds = new Set(APP_CATALOG.filter((a) => a.required).map((a) => a.id));
  const selectedSet = new Set(selected);

  const toggle = async (id: string) => {
    const next = selectedSet.has(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id];
    await patch((d) => ({
      ...d,
      applications: { applications: next },
    }));
  };

  const blocking = APP_CATALOG.filter((a) => requiredIds.has(a.id) && selectedSet.has(a.id));

  const groups = [
    { label: 'Core', items: APP_CATALOG.filter((a) => a.category === 'core') },
    { label: 'Vestara Apps', items: APP_CATALOG.filter((a) => a.category === 'vestara') },
    { label: 'Optional', items: APP_CATALOG.filter((a) => a.category === 'optional') },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Applications
        </Typography>
        <Chip label={`${selected.length} selected · ${footprintMb} MB`} color="primary" variant="outlined" />
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Applications come from the Vestara package registry, not a hardcoded checkbox array.
      </Typography>

      {requiredIds.size > 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Core applications ({[...requiredIds].map((id) => catalogEntry(id)?.name).join(', ')}) are required by
          the {profile.id} profile. Removing them would produce a broken image.
        </Alert>
      ) : null}

      {groups.map((group) => {
        const items = group.items.filter((a) => selectedSet.has(a.id) || !requiredIds.has(a.id) || true);
        return (
          <Box key={group.label} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 0.5 }}>
              {group.label}
            </Typography>
            <Table size="small" sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Size</TableCell>
                  <TableCell>Requirement</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((app) => {
                  const isSelected = selectedSet.has(app.id);
                  const isRequired = requiredIds.has(app.id);
                  return (
                    <TableRow key={app.id} hover>
                      <TableCell>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <Checkbox
                            size="small"
                            checked={isSelected}
                            disabled={isSelected && isRequired}
                            onChange={() => void toggle(app.id)}
                          />
                          <Typography sx={{ fontFamily: 'monospace', fontSize: 13 }}>{app.id}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{app.sizeMb} MB</TableCell>
                      <TableCell>
                        {isRequired ? <Chip size="small" label={app.note ?? 'Required'} color="primary" /> : <Chip size="small" label={app.note ?? 'Optional'} variant="outlined" />}
                      </TableCell>
                      <TableCell>
                        {isSelected && isRequired ? (
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            required by profile
                          </Typography>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
          })}
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} sx={{ color: 'text.secondary' }}>
                      Nothing in this group.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Box>
        );
          })}

      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          onClick={() =>
            void patch((d) => ({
              ...d,
              applications: { applications: APP_CATALOG.filter((a) => a.required).map((a) => a.id) },
            }))
          }
        >
          Reset to required
        </Button>
        <Button
          variant="outlined"
          onClick={() => void patch((d) => ({ ...d, applications: { applications: APP_CATALOG.map((a) => a.id) }}))}
        >
          Select all
        </Button>
      </Stack>
    </Box>
  );
}
