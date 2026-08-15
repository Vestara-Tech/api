import { useState } from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { Composer, MessageView, streamEventToParts, type VestaraMessage, type VestaraMessagePart } from '@vestara/ai-ui';
import { VestaraAssistantRuntime } from '@vestara/ai-ui';

const runtime = new VestaraAssistantRuntime({ apiBase: '' });

export function AiChatPage() {
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
    <Box sx={{ p: 3, maxWidth: 860, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          AI Chat
        </Typography>
        {streaming ? <Chip size="small" label="streaming" color="info" /> : null}
      </Stack>

      <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
        {messages.map((msg) => (
          <MessageView key={msg.id} message={msg} onApprove={undefined} onReject={undefined} />
        ))}
        {messages.length === 0 ? (
          <Typography sx={{ color: 'text.secondary' }}>Ask anything. The response streams from the Vestara AI runtime.</Typography>
        ) : null}
      </Box>

      <Composer onSend={(t) => void handleSend(t)} disabled={streaming} placeholder="Message the Vestara AI…" />
    </Box>
  );
}
