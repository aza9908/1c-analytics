/**
 * Next.js `/api/etl-status` — прокси в FastAPI `GET /etl-status`.
 *
 * Требует `API_URL`. Демо-фикстур в репозитории нет: поднимите бекенд
 * (`api/`) и укажите его адрес в `.env.local`.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const API_URL = process.env.API_URL || '';
const API_KEY = process.env.API_KEY || '';

export async function GET() {
  if (!API_URL) {
    return new Response(
      JSON.stringify({ error: 'API_URL is not configured' }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    );
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (API_KEY) headers['X-API-Key'] = API_KEY;
  try {
    const upstream = await fetch(`${API_URL}/etl-status`, { headers, cache: 'no-store' });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 502, headers: { 'content-type': 'application/json' },
    });
  }
}
