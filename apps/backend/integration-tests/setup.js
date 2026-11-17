const { MetadataStorage } = require("@medusajs/framework/mikro-orm/core")

MetadataStorage.clear()

// Derive DB_* settings for @medusajs/test-utils from DATABASE_URL in .env (no secrets hardcoded)
if (!process.env.DB_USERNAME) {
  const { loadEnv: load } = require("@medusajs/utils");
  load("development", process.cwd());
  if (process.env.DATABASE_URL) {
    const u = new URL(process.env.DATABASE_URL);
    process.env.DB_USERNAME = decodeURIComponent(u.username);
    process.env.DB_PASSWORD = decodeURIComponent(u.password);
    process.env.DB_HOST = u.hostname;
    process.env.DB_PORT = u.port || "5432";
  }
}
