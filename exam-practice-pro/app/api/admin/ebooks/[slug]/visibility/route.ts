import { proxyAdminJson } from "@/lib/server/ebook-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params;
  if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(slug))
    return Response.json({ success: false, error: { message: "Ebook not found." } }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); }
  catch {
    return Response.json({ success: false, error: { message: "Invalid JSON payload." } }, { status: 400 });
  }
  return proxyAdminJson(`/${encodeURIComponent(slug)}/visibility`, "PATCH", body);
}
