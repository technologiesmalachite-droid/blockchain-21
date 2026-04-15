import { Pool } from "pg";
import { env } from "../config/env.js";

if (!env.databaseUrl) {
  console.warn("DATABASE_URL is not set. PostgreSQL repositories cannot initialize without it.");
}

const resolveSslConfig = () => {
  if (env.dbSslMode === "disable") {
    return false;
  }

  return {
    rejectUnauthorized: Boolean(env.dbSslRejectUnauthorized),
  };
};

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: Number(process.env.DB_POOL_MAX || 20),
  idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_MS || 30000),
  connectionTimeoutMillis: Number(process.env.DB_POOL_CONNECT_TIMEOUT_MS || 5000),
  ssl: resolveSslConfig(),
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error", error);
});

export const query = (text, params = []) => pool.query(text, params);
