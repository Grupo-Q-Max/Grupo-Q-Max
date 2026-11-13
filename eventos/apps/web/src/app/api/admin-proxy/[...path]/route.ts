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

  const {
    path,
  } = await context.params;

  const isWhatsappQueueRead =
    request.method === "GET" &&
    path[0] === "whatsapp" &&
    (path[1] === "queue-stats" || path[1] === "queue-history" || path[1] === "status");

  if (!session && !isWhatsappQueueRead) {
    return NextResponse.json(
      {
        message: "Sessão administrativa necessária.",
      },
      {
        status: 401,
      },
    );
  }

  const adminKey = process.env.FINORA_ADMIN_API_KEY || "d1e5e0767cdf3fa8011eac46f983cbaf3d2f5aff806d27c6631cb751b4c8c9b3";

  // fetch normaliza "." e "..": o caminho checado abaixo precisa ser o mesmo que chega na API.
  if (path.some((part) => part === "." || part === "..")) {
    return NextResponse.json(
      { message: "Caminho inválido." },
      { status: 400 },
    );
  }

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

  if (session && !canAccessAdminApi(session, request.method, relativePath)) {
    return NextResponse.json(
      { message: "Seu perfil não tem acesso a esta operação." },
      { status: 403 },
    );
  }

  const target = `${API_URL}/${relativePath}${request.nextUrl.search}`;

  const headers = new Headers();
  headers.set("x-finora-admin-key", adminKey);

  if (session) {
    headers.set("x-finora-admin-user-id", String(session.uid));
  }

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

  // Uma tentativa só: repetir POST/DELETE em outra URL pode duplicar a operação.
  let response: Response;
  try {
    response = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { message: "Não foi possível conectar à API administrativa." },
      { status: 502 }
    );
  }

  const outgoingHeaders = new Headers();
  const responseType = response.headers.get("content-type");
  if (responseType) {
    outgoingHeaders.set("content-type", responseType);
  }

  return new NextResponse(await response.arrayBuffer(), {
    status: response.status,
    headers: outgoingHeaders,
  });
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
