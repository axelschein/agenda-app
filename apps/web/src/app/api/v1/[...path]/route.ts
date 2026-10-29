const API_URL =
  process.env.API_URL_INTERNAL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001/api/v1";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

async function proxy(request: Request): Promise<Response> {
  const incoming = new URL(request.url);
  const apiBase = API_URL.replace(/\/$/, "");
  const suffix = incoming.pathname.replace(/^\/api\/v1\/?/, "");
  const target = `${apiBase}/${suffix}${incoming.search}`;
  const headers = new Headers();
  for (const name of ["accept", "content-type", "cookie"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    ...(hasBody ? { body: await request.arrayBuffer() } : {}),
    cache: "no-store",
    redirect: "manual",
  });

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, name) => {
    if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase()) && name.toLowerCase() !== "set-cookie") {
      responseHeaders.append(name, value);
    }
  });
  for (const cookie of upstream.headers.getSetCookie()) {
    responseHeaders.append("set-cookie", cookie);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
