import { AppError } from '../errors.js';

const chatSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['messages'],
  properties: {
    messages: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['role', 'content'],
        properties: {
          role: { type: 'string', enum: ['user', 'assistant'] },
          content: { type: 'string', maxLength: 12_000 },
        },
      },
    },
  },
};

export async function assistantRoutes(app, { assistant, config }) {
  app.post('/api/assistant/chat', { schema: { body: chatSchema } }, async (request, reply) => {
    if (!config.assistant.configured || !assistant) {
      throw new AppError(
        503,
        'ASSISTANT_NOT_CONFIGURED',
        'Set ASSISTANT_BASE_URL and ASSISTANT_MODEL to enable the in-app assistant'
      );
    }
    const result = await assistant.chat({ messages: request.body.messages });
    return reply.send(result);
  });
}
