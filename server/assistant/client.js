import { AppError } from '../errors.js';
import { sanitizeError } from '../errors.js';

export function createAssistantClient({
  baseUrl,
  model,
  apiKey = '',
  fetchImpl = globalThis.fetch,
  timeoutMs = 60_000,
}) {
  if (!baseUrl || !model) {
    throw new Error('Assistant client requires baseUrl and model');
  }

  const endpoint = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;

  return {
    async complete({ messages, tools, signal }) {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const abortFromCaller = () => controller.abort();
      signal?.addEventListener('abort', abortFromCaller);

      try {
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages,
            tools,
            tool_choice: 'auto',
            temperature: 0.3,
          }),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const providerMessage = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
          throw new AppError(502, 'ASSISTANT_PROVIDER_ERROR', sanitizeError(new Error(providerMessage)));
        }
        const choice = payload.choices?.[0];
        if (!choice?.message) {
          throw new AppError(502, 'ASSISTANT_PROVIDER_ERROR', 'Assistant provider returned an empty response');
        }
        return choice.message;
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw new AppError(504, 'ASSISTANT_TIMEOUT', 'Assistant request timed out');
        }
        if (error instanceof AppError) throw error;
        throw new AppError(502, 'ASSISTANT_PROVIDER_ERROR', sanitizeError(error));
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', abortFromCaller);
      }
    },
  };
}
