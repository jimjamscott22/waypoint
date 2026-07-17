export function createLogger(output = console) {
  function write(level, event, details = {}) {
    output[level](JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...details }));
  }
  return {
    info: (event, details) => write('info', event, details),
    warn: (event, details) => write('warn', event, details),
    error: (event, details) => write('error', event, details),
  };
}
