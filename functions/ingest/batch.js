/*! Жунгли · https://zhungli.zmoki.xyz/ · Copyright (c) 2026 Zarema Khalilova. All rights reserved. No copying, hosting or reuse without permission. See LICENSE. */
// Forwards anonymous stats to PostHog through our own domain so ad blockers
// don't drop them. Accepts only POST /ingest/batch.
const POSTHOG = 'https://us.i.posthog.com/batch/';

export async function onRequestPost({ request }) {
  const body = await request.text();
  if (body.length > 200_000) return new Response('Too large', { status: 413 });
  const res = await fetch(POSTHOG, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // PostHog gets the country from the visitor's IP, not Cloudflare's.
      'X-Forwarded-For': request.headers.get('CF-Connecting-IP') || '',
      'User-Agent': request.headers.get('User-Agent') || '',
    },
    body,
  });
  return new Response(null, { status: res.ok ? 204 : res.status });
}
