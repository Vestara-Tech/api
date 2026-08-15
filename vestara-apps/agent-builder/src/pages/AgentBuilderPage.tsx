import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Box, Chip, Divider, Stack, Typography } from '@mui/material';
import { agentBuilderApi, type AgentView, type CarRuntimeView, type SkillView, type ToolView } from '../api/agentBuilderApi';

export function AgentBuilderPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [agent, setAgent] = useState<AgentView | null>(null);
  const [runtimes, setRuntimes] = useState<readonly CarRuntimeView[]>([]);
  const [tools, setTools] = useState<readonly ToolView[]>([]);
  const [skills, setSkills] = useState<readonly SkillView[]>([]);

  useEffect(() => {
    if (!agentId) return;
    void Promise.all([
      agentBuilderApi.agent(agentId),
      agentBuilderApi.carRuntimes(),
      agentBuilderApi.tools(),
      agentBuilderApi.skills(),
    ]).then(([a, r, t, s]) => {
      setAgent(a);
      setRuntimes(r);
      setTools(t);
      setSkills(s);
    }).catch(() => undefined);
  }, [agentId]);

  if (!agent) {
    return <Box sx={{ p: 3 }}><Typography sx={{ color: 'text.secondary' }}>Loading agent…</Typography></Box>;
  }

  const agentToolIds = new Set(agent.tools.map((t) => t.id));
  const agentSkillIds = new Set(agent.skills.map((s) => s.id));
  const relevantTools = tools.filter((t) => agentToolIds.has(t.id));
  const relevantSkills = skills.filter((s) => agentSkillIds.has(s.id));

  return (
    <Box sx={{ p: 3, maxWidth: 1000 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'baseline' }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {agent.name}
        </Typography>
        <Chip size="small" label={agent.role} variant="outlined" />
        <Chip size="small" label={`rev ${agent.version}`} variant="outlined" />
      </Stack>

      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start', mt: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Section title="Runtime">
            <RuntimeSection runtimes={runtimes} />
          </Section>

          <Section title={`Skills (${agent.skills.length})`}>
            <Stack spacing={1}>
              {relevantSkills.map((skill) => (
                <Box key={skill.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, bgcolor: 'background.paper' }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Chip size="small" label="ON" color="success" />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{skill.name}</Typography>
                  </Stack>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                    {skill.description}
                  </Typography>
                  <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', mt: 0.5 }}>
                    {skill.requiredCapabilities.map((cap) => (
                      <Chip key={cap} size="small" label={cap} variant="outlined" />
                    ))}
                  </Stack>
                </Box>
              ))}
              {relevantSkills.length === 0 ? <Typography variant="caption" sx={{ color: 'text.secondary' }}>No skills assigned.</Typography> : null}
            </Stack>
          </Section>

          <Section title={`Tools (${agent.tools.length})`}>
            <Stack spacing={0.5}>
              {relevantTools.map((tool) => (
                <Stack key={tool.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Chip size="small" label={tool.id} variant="outlined" sx={{ fontFamily: 'monospace' }} />
                  <Chip size="small" label={tool.risk} color={tool.risk === 'control' ? 'warning' : tool.risk === 'critical' ? 'error' : 'default'} />
                </Stack>
              ))}
              {relevantTools.length === 0 ? <Typography variant="caption" sx={{ color: 'text.secondary' }}>No tools assigned.</Typography> : null}
            </Stack>
          </Section>

          <Section title={`Permissions (${agent.permissions.length})`}>
            <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {agent.permissions.map((permission) => (
                <Chip key={permission} size="small" label={permission} sx={{ fontFamily: 'monospace' }} />
              ))}
            </Stack>
          </Section>
        </Box>

        <Box sx={{ width: 320 }}>
          <Section title="Inspector">
            <Stack spacing={1.5}>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Agent</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{agent.id}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Role</Typography>
                <Typography variant="body2">{agent.role}</Typography>
              </Box>
              <Divider />
              <Link to={`/agent-builder/${agent.id}/test`} style={{ fontSize: 14, color: '#8ab4ff' }}>
                → Test Agent
              </Link>
            </Stack>
          </Section>
        </Box>
      </Stack>
    </Box>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function RuntimeSection({ runtimes }: { runtimes: readonly CarRuntimeView[] }) {
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 1.5 }}>
      <Chip size="small" label="AUTO" color="primary" />
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
        Best compatible coding runtime
      </Typography>
      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', mt: 1 }}>
        {runtimes.map((r) => (
          <Chip key={r.id} size="small" label={r.id} variant="outlined" />
        ))}
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
        Requirements: repository editing · terminal · tool calling
      </Typography>
    </Box>
  );
}
