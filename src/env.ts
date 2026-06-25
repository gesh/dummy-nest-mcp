// Load .env (POSTHOG_PROJECT_TOKEN, optional POSTHOG_HOST, optional PORT) before any module
// that reads process.env at import time (e.g. the PostHog client in posthog.ts).
// Imported first in main.ts; with CommonJS, require() runs top-to-bottom in order.
try {
  (process as any).loadEnvFile();
} catch {
  // no .env file — fall back to the real environment
}
