import mariadb from 'mariadb';

export function createPool(database, overrides = {}) {
  const connection = database.socketPath
    ? { socketPath: database.socketPath }
    : { host: database.host, port: database.port };

  return mariadb.createPool({
    ...connection,
    user: database.user,
    password: database.password,
    database: database.database,
    connectionLimit: database.connectionLimit ?? 5,
    acquireTimeout: 10_000,
    charset: 'utf8mb4',
    dateStrings: true,
    bigIntAsNumber: true,
    decimalAsNumber: true,
    resetAfterUse: true,
    ...overrides,
  });
}

export async function withConnection(pool, operation) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query("SET time_zone = '+00:00'");
    return await operation(connection);
  } finally {
    connection?.release();
  }
}

export async function withTransaction(pool, operation) {
  return withConnection(pool, async connection => {
    await connection.beginTransaction();
    try {
      const result = await operation(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  });
}

export async function verifyDatabase(pool) {
  return withConnection(pool, async connection => {
    const rows = await connection.query('SELECT VERSION() AS version');
    const version = String(rows[0].version);
    const match = version.match(/^(\d+)\.(\d+)/);
    if (!match || Number(match[1]) < 10 || (Number(match[1]) === 10 && Number(match[2]) < 6)) {
      throw new Error(`MariaDB 10.6 or newer is required; detected ${version}`);
    }
    return version;
  });
}
