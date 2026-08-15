import { useState } from 'react';
import { Box, Chip, Divider, Stack, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { Composer, MessageView, type VestaraMessage, type VestaraMessagePart } from '@vestara/ai-ui';
import { VestaraAssistantRuntime } from '@vestara/ai-ui';

const runtime = new VestaraAssistantRuntime({ apiBase: '' });

/**
 * AssistantPanel — embeds the shared ai-ui conversation into the API Builder.
 * AI proposes; the builder's governed flow validates; human applies. The panel
 * never talks to a provider directly.
 */
export function AssistantPanel() {
  const [messages, setMessages] = useState<VestaraMessage[]>([]);
  const [streaming, setStreaming] = useState(false);

  const handleSend = async (text: string): Promise<void> => {
    const userMsg: VestaraMessage = { id: `u_${Date.now().toString(36)}`, role: 'user', parts: [{ kind: 'text', text }], createdAt: new Date().toISOString() };
    const assistantId = `a_${Date.now().toString(36)}`;
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', parts: [], createdAt: new Date().toISOString() },
    ]);
    setStreaming(true);

    const buffer: string[] = [];
    const extra: VestaraMessagePart[] = [];
    const update = (): void => {
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, parts: [{ kind: 'text', text: buffer.join('') }, ...extra] } : m)));
    };

    try {
      await runtime.stream(
        {
          consumer: { type: 'module', id: 'vestara.api-builder' },
          model: { requirements: { structuredOutput: true }, optimizeFor: 'balanced' },
          messages: [
            { role: 'system', content: 'You help design governed Vestara API definitions. Propose resources, fields, relations and endpoints; never mutate directly.' },
            { role: 'user', content: text },
          ],
        },
        {
          onChunk: (t) => { buffer.push(t); update(); },
          onToolCall: (call) => {
            extra.push({ kind: 'tool-call', toolCallId: call.id, name: call.name, arguments: call.arguments, status: 'completed' });
            update();
          },
          onDone: () => setStreaming(false),
          onError: (message) => {
            setStreaming(false);
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, parts: [{ kind: 'error', message }] } : m)));
          },
        },
      );
    } catch (err) {
      setStreaming(false);
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, parts: [{ kind: 'error', message: (err as Error).message }] } : m)));
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', borderLeft: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <AutoAwesomeIcon sx={{ color: 'primary.main' }} fontSize="small" />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>AI Assistant</Typography>
        {streaming ? <Chip size="small" label="streaming" color="info" /> : null}
      </Stack>
      <Divider />
      <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
        {messages.map((msg) => (
          <MessageView key={msg.id} message={msg} onApprove={undefined} onReject={undefined} />
        ))}
        {messages.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Ask the assistant to help design your API definition. AI proposes — you review and apply.
          </Typography>
        ) : null}
      </Box>
      <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <Composer onSend={(t) => void handleSend(t)} disabled={streaming} placeholder="Describe the API you want…" />
      </Box>
    </Box>
  );
}
