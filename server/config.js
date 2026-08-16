const DEFAULT_SOCKET = '/run/mysqld/mysqld.sock';

function integer(value, fallback, name) {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

export function loadConfig(env = process.env, { migration = false } = {}) {
  const socketPath = env.DB_SOCKET === '' ? null : (env.DB_SOCKET || DEFAULT_SOCKET);
  const host = env.DB_HOST || null;
  if (env.DB_SOCKET && host) throw new Error('Configure DB_SOCKET or DB_HOST, not both');

  const prefix = migration ? 'MIGRATION_DB_' : 'DB_';
  const user = env[`${prefix}USER`] || (migration ? 'waypoint_migrate' : 'waypoint_app');
  const password = env[`${prefix}PASSWORD`];
  if (!password) throw new Error(`${prefix}PASSWORD is required`);

  return {
    server: {
      host: env.HOST || '127.0.0.1',
      port: integer(env.PORT, 3000, 'PORT'),
      nodeEnv: env.NODE_ENV || 'development',
    },
    database: {
      socketPath: host ? null : socketPath,
      host,
      port: host ? integer(env.DB_PORT, 3306, 'DB_PORT') : undefined,
      database: env.DB_NAME || 'waypoint',
      user,
      password,
      connectionLimit: integer(env.DB_CONNECTION_LIMIT, 5, 'DB_CONNECTION_LIMIT'),
    },
    adzuna: {
      appId: env.ADZUNA_APP_ID || '',
      appKey: env.ADZUNA_APP_KEY || '',
      configured: Boolean(env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY),
    },
    geocoder: {
      baseUrl: env.GEOCODER_BASE_URL || 'https://nominatim.openstreetmap.org',
      userAgent: env.GEOCODER_USER_AGENT || '',
    },
    discovery: {
      runRequestBudget: integer(env.DISCOVERY_RUN_REQUEST_BUDGET, 20, 'DISCOVERY_RUN_REQUEST_BUDGET'),
      queryRequestBudget: integer(env.DISCOVERY_QUERY_REQUEST_BUDGET, 12, 'DISCOVERY_QUERY_REQUEST_BUDGET'),
      previewRequestBudget: integer(env.DISCOVERY_PREVIEW_REQUEST_BUDGET, 8, 'DISCOVERY_PREVIEW_REQUEST_BUDGET'),
      maxPagesPerFamily: integer(env.DISCOVERY_MAX_PAGES_PER_FAMILY, 3, 'DISCOVERY_MAX_PAGES_PER_FAMILY'),
      persistedMatchTarget: integer(env.DISCOVERY_PERSISTED_MATCH_TARGET, 50, 'DISCOVERY_PERSISTED_MATCH_TARGET'),
    },
  };
}

export function publicConfig(config) {
  return {
    providerConfigured: config.adzuna.configured,
    locationResolutionConfigured: Boolean(config.geocoder.userAgent),
  };
}
