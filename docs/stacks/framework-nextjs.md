# Next.js — the concrete procedures

> **Applies when `.ai-eng-kit` → `stack.framework` is `nextjs`.**
> If it is not, this file does not describe this project and nothing in it should be followed.
> The principles behind these rules live in the skills themselves and hold in any framework; this
> is only how Next.js expresses them.

---

## Which values reach the browser

_Reached from `/deploy` (step 2, host configuration) and `/security-check`._

Next.js exposes an environment variable to client-side code **only** when its name starts with
`NEXT_PUBLIC_`. Everything else stays on the server.

Two consequences, and they pull in opposite directions:

- A value the browser genuinely needs — a public API URL, a publishable key — must carry the prefix,
  or it is simply `undefined` in the browser and the failure looks like a bug elsewhere.
- A value that must **not** reach the browser must never carry it. A prefixed secret is baked into
  the deployed JavaScript and served to every visitor. That is not a leak that shows up in a log;
  it is public from the first page load.

When setting variables in a host's panel, check each name against that rule before pasting.

## Where the app's routes and layout live

_Reached from `/build` and `/audit` when they map the real code surface._

With the App Router, pages live under `src/app/`, API routes are `route.ts` files under
`src/app/api/`, and the app-wide frame is `src/app/layout.tsx`. Projects that predate `src/` keep
the same tree at the repository root.

## Submitting a form that carries credentials

_Reached from the project security rules, `/build`, `/qa` and `/security-check`._

A `<form>` left to submit natively sends every field in the URL (`?email=…&password=…`), which
leaks it into browser history, server logs and `Referer` headers. Next.js gives two correct paths:

- A **Server Action** — `<button formAction={action}>` with a `'use server'` handler. It POSTs by
  design, which is why this is the default for auth forms.
- In a client component, an `onSubmit` handler that calls `e.preventDefault()` before doing the
  call itself.

A credential-carrying form with neither — no `method="post"`, no Server Action, no
`preventDefault()` — is a bug, not a style preference.

## Security headers

_Reached from `/deploy` step 5 and `/security-check`._

Headers are configured in `next.config.*` via the `headers()` function and served on every
response. What each header does, and the CSP rollout rule, is in `docs/production/security-headers.md`;
this is the block to copy:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ]
  },
}

export default nextConfig
```

A host can still strip or override them, which is why `/security-check` verifies them against the
live URL rather than against the config file.

---

## App-level rate limiting with Upstash Redis

_Reached from the project security rules, `/architecture`, `/build` and `docs/production/rate-limiting.md` — the throttle keyed per IP and per account that the platform's own limits do not give you._

### 1. Install Dependencies
```bash
npm install @upstash/ratelimit @upstash/redis
```

### 2. Create Upstash Account
- Go to [upstash.com](https://upstash.com) (free tier: 10k requests/day)
- Create a Redis database
- Copy REST URL and token

### 3. Add Environment Variables
```bash
# .env.local
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

### 4. Create Rate Limiter
```typescript
// src/lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'), // 10 requests per 10 seconds
})
```

### 5. Use in API Routes
```typescript
// src/app/api/example/route.ts
import { ratelimit } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'anonymous'
  const { success, limit, remaining } = await ratelimit.limit(ip)

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
        },
      }
    )
  }

  // Process request normally...
}
```

### 6. Use in Middleware (Global)
```typescript
// middleware.ts
import { ratelimit } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // Only rate limit API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for') ?? 'anonymous'
    const { success } = await ratelimit.limit(ip)

    if (!success) {
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 })
    }
  }
}

export const config = {
  matcher: '/api/:path*',
}
```


---

## Content-Security-Policy with a nonce

_Reached from `docs/production/security-headers.md` and `/security-check`._

**Content-Security-Policy (CSP)** — the most powerful header against XSS, and the easiest to get wrong. It is not part of the four above because it needs per-app testing; add it once the rest is live.

> ⚠️ **Never ship `script-src 'self' 'unsafe-inline'`.** `'unsafe-inline'` permits exactly the injected inline `<script>` that CSP exists to stop — it looks like protection while giving away most of it. If you find that value in a tutorial (it is a very common copy-paste), treat it as broken.

Next.js needs a **nonce** instead: a random token generated per request, attached to the scripts your app legitimately renders. Anything injected by an attacker lacks the token and is blocked. That means it belongs in middleware, not in `next.config.ts`:

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const isDev = process.env.NODE_ENV === 'development'
  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''};
    style-src 'self' 'nonce-${nonce}';
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
```

`'strict-dynamic'` lets scripts your nonced code loads run too, so you don't have to list every CDN. `'unsafe-eval'` is dev-only — React's fast refresh needs it; it must never reach production.

**Rolling it out safely:**
1. Ship it as `Content-Security-Policy-Report-Only` first — the browser reports violations without breaking anything
2. Click through the app, watch the console for violation reports, and fix what's genuinely yours
3. Only then switch the header name to `Content-Security-Policy`

**Caveats worth knowing before you start:**
- Nonces force **dynamic rendering** — a statically prerendered page has no per-request token. Pages that need one must opt in with `await connection()` from `next/server`.
- Third-party scripts (analytics, tag managers) need the nonce passed explicitly — read it with `(await headers()).get('x-nonce')`.

Reference: [Next.js — Content Security Policy](https://nextjs.org/docs/app/guides/content-security-policy)

---

## Wiring up Sentry

_Reached from `/deploy` step 5, `/dsgvo` and `docs/production/error-tracking.md`. The five obligations before shipping (no PII, EU region, DPA, retention, privacy policy) are in that guide — this is only the Next.js wiring._

### 1. Create Sentry Account
- Go to [sentry.io](https://sentry.io) (free tier available for small apps)
- Create a new project and select "Next.js"

### 2. Install Next.js Integration
```bash
npx @sentry/wizard@latest -i nextjs
```
This automatically:
- Installs `@sentry/nextjs`
- Creates the config files (recent App Router versions use `instrumentation.ts` + `instrumentation-client.ts`; older ones `sentry.client.config.ts` / `sentry.server.config.ts`) — let the wizard decide, don't create them by hand
- Updates `next.config.ts` with the Sentry plugin

### 3. Add Environment Variables
Add to `.env.local` (local) and your host's environment variables (production):
```bash
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=sntrys_xxx  # For source maps upload
```

### 4. Verify Setup
Trigger a test error and check Sentry Dashboard:
```typescript
// Temporary test - remove after verification
throw new Error("Sentry test error")
```

### 5. Turn off sending personal data before the first real error

In the config files the wizard created (`instrumentation-client.ts` and the server config; older
setups `sentry.client.config.ts` / `sentry.server.config.ts`):

```typescript
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,        // don't attach IP addresses, cookies, or user headers
  beforeSend(event) {
    // Drop anything users typed — form bodies and query strings are the usual culprits
    if (event.request) {
      delete event.request.data
      delete event.request.cookies
      if (event.request.headers) delete event.request.headers['authorization']
    }
    return event
  },
})
```

`sendDefaultPii` defaults to sending IP addresses and request headers — set it explicitly rather
than relying on the default staying put. The EU region (`.de.sentry.io`), the DPA and the retention
period are decided in the Sentry organisation, not in code — `docs/production/error-tracking.md`.
