import { useState } from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { useSearchParams } from 'react-router';
import { Composer, MessageView, type VestaraMessage, type VestaraMessagePart } from '@vestara/ai-ui';
import { VestaraAssistantRuntime } from '@vestara/ai-ui';
import { ActivityRoomContextCard } from '../app/components';

const runtime = new VestaraAssistantRuntime({ apiBase: '' });

export function AiChatPage() {
  const [searchParams] = useSearchParams();
  const seedGoal = searchParams.get('goal')?.trim() ?? '';
  const [messages, setMessages] = useState<VestaraMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async (text: string): Promise<void> => {
    const userMsg: VestaraMessage = {
      id: `u_${Date.now().toString(36)}`,
      role: 'user',
      parts: [{ kind: 'text', text }],
      createdAt: new Date().toISOString(),
    };
    const assistantId = `a_${Date.now().toString(36)}`;
    const assistantMsg: VestaraMessage = {
      id: assistantId,
      role: 'assistant',
      parts: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);
    setError(null);

    const buffer: string[] = [];
    const extraParts: VestaraMessagePart[] = [];

    try {
      await runtime.stream(
        {
          consumer: { type: 'user', id: 'chat' },
          model: { requirements: { tools: true }, optimizeFor: 'balanced' },
          messages: [{ role: 'user', content: text }],
        },
        {
          onChunk: (chunkText) => {
            buffer.push(chunkText);
            updateMessage(assistantId, [{ kind: 'text', text: buffer.join('') }, ...extraParts]);
          },
          onToolCall: (call) => {
            extraParts.push({
              kind: 'tool-call',
              toolCallId: call.id,
              name: call.name,
              arguments: call.arguments,
              status: 'completed',
            });
            updateMessage(assistantId, [{ kind: 'text', text: buffer.join('') }, ...extraParts]);
          },
          onDone: () => {
            setStreaming(false);
          },
          onError: (message) => {
            setStreaming(false);
            setError(message);
            updateMessage(assistantId, [{ kind: 'error', message }]);
          },
        },
      );
    } catch (err) {
      setStreaming(false);
      setError((err as Error).message);
      updateMessage(assistantId, [{ kind: 'error', message: (err as Error).message }]);
    }
  };

  const updateMessage = (id: string, parts: VestaraMessagePart[]): void => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, parts } : m)));
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1440, height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          AI Chat
        </Typography>
        {streaming ? <Chip size="small" label="streaming" color="info" /> : null}
        {seedGoal ? <Chip size="small" label="goal handoff" variant="outlined" color="warning" /> : null}
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Draft here, then move the goal into Activity Room when the work needs governed execution.
      </Typography>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} sx={{ flex: 1, minHeight: 0, alignItems: 'flex-start' }}>
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            p: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            bgcolor: 'background.paper',
          }}
        >
          <Box sx={{ flex: 1, overflow: 'auto', pr: 1 }}>
            {messages.map((msg) => (
              <MessageView key={msg.id} message={msg} onApprove={undefined} onReject={undefined} />
            ))}
            {messages.length === 0 ? (
              <Typography sx={{ color: 'text.secondary' }}>
                Ask anything. The response streams from the Vestara AI runtime.
              </Typography>
            ) : null}
          </Box>

          {error ? (
            <Typography variant="caption" sx={{ color: 'error.main', mb: 1 }}>
              {error}
            </Typography>
          ) : null}

          <Composer onSend={(t) => void handleSend(t)} disabled={streaming} placeholder="Message the Vestara AI…" initialValue={seedGoal} />
        </Box>

        <Box sx={{ width: { lg: 420 }, minWidth: 0 }}>
          <ActivityRoomContextCard goal={seedGoal} />
        </Box>
      </Stack>
    </Box>
  );
}
