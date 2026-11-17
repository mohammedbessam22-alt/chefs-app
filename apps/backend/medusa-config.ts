import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// Cross-process locking (route + auto-cancel job may run in different processes).
const lockingModules = process.env.REDIS_URL
  ? [
      {
        key: "locking",
        resolve: "@medusajs/medusa/locking",
        options: {
          providers: [
            {
              resolve: "@medusajs/medusa/locking-redis",
              id: "locking-redis",
              is_default: true,
              options: { redisUrl: process.env.REDIS_URL },
            },
          ],
        },
      },
    ]
  : []

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    }
  },
  modules: [
    ...lockingModules,
    { resolve: "./src/modules/delivery-settings" },
  ],
})
