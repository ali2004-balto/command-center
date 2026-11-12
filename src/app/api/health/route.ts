// Health check: says only that the app is up. Exposes nothing else.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ ok: true });
}
