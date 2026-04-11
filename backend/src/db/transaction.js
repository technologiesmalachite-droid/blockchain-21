import { pool } from "./pool.js";

export const withTransaction = async (executor) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await executor(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
