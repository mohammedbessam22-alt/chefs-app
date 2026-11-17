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

// Uploaded product images: stored in ./static, served by Medusa at <MEDUSA_BACKEND_URL>/static.
const fileModule = {
  resolve: "@medusajs/medusa/file",
  options: {
    providers: [
      {
        resolve: "@medusajs/medusa/file-local",
        id: "local",
        options: {
          upload_dir: "static",
          backend_url: `${process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"}/static`,
        },
      },
    ],
  },
}

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
    fileModule,
    { resolve: "./src/modules/delivery-settings" },
    { resolve: "./src/modules/translations" },
  ],
})
