/*! Жунгли · https://zhungli.zmoki.xyz/ · Copyright (c) 2026 Zarema Khalilova. All rights reserved. No copying, hosting or reuse without permission. See LICENSE. */
// Forwards anonymous stats to PostHog through our own domain so ad blockers
// don't drop them. Accepts only POST /ingest/batch.
// Privacy: the visitor's IP never reaches PostHog. The country comes from Cloudflare
// and is added to each event; PostHog's own IP lookup is switched off per event.
const POSTHOG = 'https://us.i.posthog.com/batch/';
// Bots get a 204 and nothing is forwarded, also for old app versions they cached.
// Same pattern as STATS_BOT in stats.js: keep the two in sync.
const BOT = /(^|[^u])bot|crawler|spider|crawling|Google-InspectionTool|HeadlessChrome|Lighthouse|PTST|bingpreview|facebookexternalhit|WhatsApp|vkShare/i;

export async function onRequestPost({ request }) {
  if (BOT.test(request.headers.get('User-Agent') || '')) return new Response(null, { status: 204 });
  const text = await request.text();
  if (text.length > 200_000) return new Response('Too large', { status: 413 });
  let data;
  try { data = JSON.parse(text); } catch (e) { return new Response('Bad JSON', { status: 400 }); }
  if (!data || !Array.isArray(data.batch)) return new Response('Bad batch', { status: 400 });

  const country = (request.cf && request.cf.country) || request.headers.get('CF-IPCountry') || null;
  for (const ev of data.batch) {
    ev.properties = { ...(ev.properties || {}), $geoip_disable: true, $ip: null };
    if (country && country !== 'XX' && country !== 'T1') ev.properties.$geoip_country_code = country;
  }

  const res = await fetch(POSTHOG, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return new Response(null, { status: res.ok ? 204 : res.status });
}
