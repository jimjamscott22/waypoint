import { AppError } from '../errors.js';
import { ASSISTANT_SYSTEM_PROMPT } from './systemPrompt.js';

const MAX_ASSISTANT_MESSAGE_CHARS = 12_000;
const MAX_HISTORY_MESSAGES = 20;

function normalizeHistory(messages = []) {
  return messages
    .filter(message => message && (message.role === 'user' || message.role === 'assistant'))
    .map(message => ({
      role: message.role,
      content: String(message.content ?? '').slice(0, MAX_ASSISTANT_MESSAGE_CHARS),
    }))
    .filter(message => message.content.trim())
    .slice(-MAX_HISTORY_MESSAGES);
}

function trimAssistantContent(content) {
  const text = String(content ?? '');
  if (text.length <= MAX_ASSISTANT_MESSAGE_CHARS) return text;
  return `${text.slice(0, MAX_ASSISTANT_MESSAGE_CHARS)}…`;
}

export function createAssistantService({ client, toolkit, maxIterations = 6 }) {
  return {
    async chat({ messages, signal }) {
      const history = normalizeHistory(messages);
      if (!history.length || history[history.length - 1].role !== 'user') {
        throw new AppError(400, 'ASSISTANT_INVALID_MESSAGES', 'The final message must be from the user');
      }

      const conversation = [
        { role: 'system', content: ASSISTANT_SYSTEM_PROMPT },
        ...history,
      ];
      const toolsUsed = [];

      for (let iteration = 0; iteration < maxIterations; iteration += 1) {
        const assistantMessage = await client.complete({
          messages: conversation,
          tools: toolkit.definitions,
          signal,
        });

        if (!assistantMessage.tool_calls?.length) {
          return {
            message: {
              role: 'assistant',
              content: trimAssistantContent(assistantMessage.content),
            },
            toolsUsed,
            iterations: iteration + 1,
          };
        }

        conversation.push({
          role: 'assistant',
          content: assistantMessage.content ?? '',
          tool_calls: assistantMessage.tool_calls,
        });

        for (const call of assistantMessage.tool_calls) {
          const name = call.function?.name;
          let args = {};
          try {
            args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
          } catch {
            args = {};
          }
          const result = await toolkit.execute(name, args);
          toolsUsed.push({ name, args });
          conversation.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }
      }

      throw new AppError(429, 'ASSISTANT_TOOL_LIMIT', 'Assistant needed more tool steps than allowed; try a narrower question');
    },
  };
}
