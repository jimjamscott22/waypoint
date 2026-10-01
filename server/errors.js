export class AppError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function sanitizeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/((?:[?&]|\b)(?:app_id|app_key)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(password\s*[=:]\s*)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]+\b/g, '[REDACTED]')
    .replace(/(ASSISTANT_API_KEY\s*[=:]\s*)\S+/gi, '$1[REDACTED]')
    .replace(/(api[_-]?key\s*[=:]\s*)\S+/gi, '$1[REDACTED]')
    .slice(0, 500);
}
