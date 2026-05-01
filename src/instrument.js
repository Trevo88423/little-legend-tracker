import React from 'react'
import {
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
} from 'react-router-dom'
import * as Sentry from '@sentry/react'

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    // Medical data app — never send IPs, headers, or other default PII.
    sendDefaultPii: false,
    integrations: [
      Sentry.reactRouterV7BrowserTracingIntegration({
        useEffect: React.useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    ignoreErrors: [
      'AbortError',
      /Lock broken by another request/,
      'NetworkError when attempting to fetch resource',
      'Failed to fetch',
      'Load failed',
    ],
  })
}
