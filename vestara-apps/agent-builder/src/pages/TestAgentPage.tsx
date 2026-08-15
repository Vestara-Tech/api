import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Box, Button, Chip, Stack, TextField, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { MessageView, AgentPresence, type VestaraMessage, type VestaraMessagePart } from '@vestara/ai-ui';
import { agentEventToParts } from '@vestara/ai-ui';
import { agentBuilderApi } from '../api/agentBuilderApi';

export function TestAgentPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [messages, setMessages] = useState<VestaraMessage[]>([]);
  const [goal, setGoal] = useState('');
  const [running, setRunning] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const append = useCallback((role: VestaraMessage['role'], parts: VestaraMessagePart[], authorName?: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, role, parts, createdAt: new Date().toISOString(), ...(authorName ? { authorName } : {}) },
    ]);
  }, []);

  const handleRun = async (): Promise<void> => {
    if (!agentId || !goal.trim() || running) return;
    setRunning(true);
    append('user', [{ kind: 'text', text: goal.trim() }]);
    try {
      const run = await agentBuilderApi.startRun(agentId, goal.trim());
      append('agent', [{ kind: 'agent-activity', agentId, agentName: agentId, activity: 'started' }], agentId);
      pollRef.current = setInterval(async () => {
        try {
          const events = await agentBuilderApi.runEvents(run.id);
          const parts = events.flatMap((e) => agentEventToParts(e as never, agentId));
          setMessages((prev) => {
            const prior = prev.filter((m) => !(m.role === 'agent' && m.authorName === agentId));
            return [...prior, { id: `agent_${run.id}_${events.length}`, role: 'agent', authorName: agentId, parts, createdAt: new Date().toISOString() }];
          });
          if (events.some((e) => e.type === 'completed' || e.type === 'failed')) {
            if (pollRef.current) clearInterval(pollRef.current);
            setRunning(false);
          }
        } catch {
          // keep polling
        }
      }, 500);
    } catch (err) {
      append('assistant', [{ kind: 'error', message: (err as Error).message }]);
      setRunning(false);
    }
  };

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  return (
    <Box sx={{ p: 3, maxWidth: 1000 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Test Agent
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        A controlled miniature Activity Room for agent development — the same ai-ui
        conversation primitives used by the AI Experience and API Builder.
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField
          size="small"
          label="Objective"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleRun(); }}
          sx={{ flex: 1 }}
        />
        <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={() => void handleRun()} disabled={running || !goal.trim()}>
          {running ? 'Running…' : 'Run'}
        </Button>
      </Stack>

      <Box sx={{ mb: 2 }}>
        <AgentPresence agentId={agentId ?? ''} agentName={agentId ?? ''} status={running ? 'running' : 'idle'} detail={undefined} />
      </Box>

      <Stack spacing={1}>
        {messages.map((msg, i) => (
          <MessageView key={`${msg.id}_${i}`} message={msg} onApprove={undefined} onReject={undefined} />
        ))}
        {messages.length === 0 ? (
          <Typography sx={{ color: 'text.secondary' }}>Give the agent an objective to see its tool calls, activity and approvals.</Typography>
        ) : null}
      </Stack>
    </Box>
  );
}
