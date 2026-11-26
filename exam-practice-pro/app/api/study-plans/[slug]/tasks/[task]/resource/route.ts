import { POST as sessionToken } from "@/app/api/auth/backend-token/route";
import { API_BASE_URL } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; task: string }> },
) {
  const { slug, task } = await params;
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    Vary: "Cookie",
    "X-Content-Type-Options": "nosniff",
  });
  if (!/^[a-z0-9-]{2,60}$/.test(slug) || !/^[a-f0-9-]{36}$/i.test(task))
    return new Response("Not found", { status: 404, headers });
  const auth = await sessionToken();
  if (!auth.ok && auth.status !== 401)
    return new Response("Session unavailable", {
      status: auth.status,
      headers,
    });
  const token = auth.ok ? (await auth.json()).token : null;
  try {
    const r = await fetch(
      `${API_BASE_URL}/api/v1/study-plans/${slug}/tasks/${task}/resource${new URL(request.url).searchParams.get("download") === "1" ? "?download=1" : ""}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      },
    );
    if (r.ok && r.headers.get("content-type")?.includes("application/json")) {
      const data = await r.json();
      if (data.data?.url) {
        headers.set("Location", data.data.url);
        return new Response(null, { status: 302, headers });
      }
    }
    for (const name of ["content-type", "content-disposition"]) {
      const value = r.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(r.body, { status: r.status, headers });
  } catch {
    return new Response("Resource unavailable", { status: 503, headers });
  }
}
