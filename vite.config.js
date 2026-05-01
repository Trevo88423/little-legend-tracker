import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const hasSentryAuth = Boolean(env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG)

  return {
    plugins: [
      react(),
      sentryVitePlugin({
        org: env.SENTRY_ORG,
        project: env.SENTRY_PROJECT,
        authToken: env.SENTRY_AUTH_TOKEN,
        disable: !hasSentryAuth,
        telemetry: false,
      }),
    ],
    build: { sourcemap: true },
  }
})
