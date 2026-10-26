import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  canAccessAdminApi,
  readAdminSession,
} from "@/lib/admin-session";

const configuredApiUrl =
  process.env.FINORA_INTERNAL_API_URL ||
  "http://127.0.0.1:3334/api/v1";

const API_URL = configuredApiUrl.replace(/\/+$/, "").endsWith("/api/v1")
  ? configuredApiUrl.replace(/\/+$/, "")
  : `${configuredApiUrl.replace(/\/+$/, "")}/api/v1`;

async function forward(
  request: NextRequest,
  context: {
    params: Promise<{
      path: string[];
    }>;
  },
) {
  const session = readAdminSession(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );

  if (!session) {
    return NextResponse.json(
      {
        message: "Sessão administrativa necessária.",
      },
      {
        status: 401,
      },
    );
  }

  const adminKey = process.env.FINORA_ADMIN_API_KEY;

  if (!adminKey) {
    return NextResponse.json(
      { message: "API administrativa não configurada." },
      { status: 503 },
    );
  }

  const {
    path,
  } = await context.params;

  const relativePath =
    path
      .map(
        (part) =>
          encodeURIComponent(
            part,
          ),
      )
      .join("/")
      .replace(/\/+$/, "");

  if (!canAccessAdminApi(session, request.method, relativePath)) {
    return NextResponse.json(
      { message: "Seu perfil não tem acesso a esta operação." },
      { status: 403 },
    );
  }

  const search =
    request.nextUrl.search;

  const candidateBases: string[] = [];
  if (process.env.FINORA_INTERNAL_API_URL) {
    const envUrl = process.env.FINORA_INTERNAL_API_URL.replace(/\/+$/, "");
    candidateBases.push(envUrl.endsWith("/api/v1") ? envUrl : `${envUrl}/api/v1`);
  }
  candidateBases.push(API_URL);
  candidateBases.push("http://127.0.0.1:3334/api/v1");
  candidateBases.push("http://localhost:3334/api/v1");

  const targets = Array.from(new Set(candidateBases)).map(
    (base) => `${base}/${relativePath}${search}`
  );

  const headers = new Headers();
  headers.set("x-finora-admin-key", adminKey);

  headers.set("x-finora-admin-user-id", String(session.uid));

  headers.set(
    "accept",
    request.headers.get("accept") || "application/json"
  );

  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  const userAgent = request.headers.get("user-agent");
  if (userAgent) {
    headers.set("user-agent", userAgent);
  }

  let body: BodyInit | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    const buffer = await request.arrayBuffer();
    if (buffer.byteLength > 0) {
      body = buffer;
    }
  }

  let lastResponse: Response | null = null;

  for (const target of targets) {
    try {
      const response = await fetch(target, {
        method: request.method,
        headers,
        body,
        cache: "no-store",
      });

      lastResponse = response;
      if (response.ok || response.status !== 404) {
        const responseBody = await response.arrayBuffer();
        const outgoingHeaders = new Headers();
        const responseType = response.headers.get("content-type");
        if (responseType) {
          outgoingHeaders.set("content-type", responseType);
        }

        return new NextResponse(responseBody, {
          status: response.status,
          headers: outgoingHeaders,
        });
      }
    } catch {
      // Tenta a próxima URL candidata
    }
  }

  if (lastResponse) {
    const responseBody = await lastResponse.arrayBuffer();
    const outgoingHeaders = new Headers();
    const responseType = lastResponse.headers.get("content-type");
    if (responseType) {
      outgoingHeaders.set("content-type", responseType);
    }
    return new NextResponse(responseBody, {
      status: lastResponse.status,
      headers: outgoingHeaders,
    });
  }

  return NextResponse.json(
    { message: "Não foi possível conectar à API administrativa." },
    { status: 502 }
  );
}

export function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      path: string[];
    }>;
  },
) {
  return forward(
    request,
    context,
  );
}

export function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      path: string[];
    }>;
  },
) {
  return forward(
    request,
    context,
  );
}

export function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{
      path: string[];
    }>;
  },
) {
  return forward(
    request,
    context,
  );
}

export function PUT(
  request: NextRequest,
  context: {
    params: Promise<{
      path: string[];
    }>;
  },
) {
  return forward(
    request,
    context,
  );
}

export function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{
      path: string[];
    }>;
  },
) {
  return forward(
    request,
    context,
  );
}
