/**
 * Next.js `/api/data` — прокси в FastAPI `GET /data?from=&to=`.
 *
 * Требует `API_URL`. Демо-фикстур в репозитории нет: поднимите бекенд
 * (`api/`) и укажите его адрес в `.env.local`.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const API_URL = process.env.API_URL || '';
const API_KEY = process.env.API_KEY || '';

export async function GET(req: Request) {
  if (!API_URL) {
    return new Response(
      JSON.stringify({ error: 'API_URL is not configured' }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    );
  }

  const url = new URL(req.url);
  const month = url.searchParams.get('month');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  let qs = '';
  if (month) {
    qs = `month=${encodeURIComponent(month)}`;
  } else if (from && to) {
    qs = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  } else {
    return new Response(JSON.stringify({ error: 'either month, or from+to required' }), {
      status: 400, headers: { 'content-type': 'application/json' },
    });
  }

  const upstreamHeaders: Record<string, string> = { Accept: 'application/json' };
  if (API_KEY) upstreamHeaders['X-API-Key'] = API_KEY;

  try {
    const upstream = await fetch(`${API_URL}/data?${qs}`, {
      headers: upstreamHeaders,
      cache: 'no-store',
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `proxy failed: ${msg}` }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}
