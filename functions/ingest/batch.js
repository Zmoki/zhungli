// Пересылает анонимную статистику в PostHog через свой домен,
// чтобы её не резали блокировщики. Принимает только POST /ingest/batch.
const POSTHOG = 'https://us.i.posthog.com/batch/';

export async function onRequestPost({ request }) {
  const body = await request.text();
  if (body.length > 200_000) return new Response('Too large', { status: 413 });
  const res = await fetch(POSTHOG, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Страну PostHog определяет по IP посетителя, а не по IP Cloudflare.
      'X-Forwarded-For': request.headers.get('CF-Connecting-IP') || '',
      'User-Agent': request.headers.get('User-Agent') || '',
    },
    body,
  });
  return new Response(null, { status: res.ok ? 204 : res.status });
}
