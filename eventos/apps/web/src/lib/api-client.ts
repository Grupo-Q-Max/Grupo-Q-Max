/**
 * API Client unificado do Finora Experience
 */

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // No browser, usamos o caminho relativo com o basePath da aplicação
    return '/finora-experience/api/v1';
  }

  // No servidor (SSR), usamos a URL direta da API interna
  return process.env.FINORA_INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3334/api/v1';
}

export function getAdminProxyUrl(): string {
  if (typeof window !== 'undefined') {
    return '/finora-experience/api/admin-proxy';
  }
  return '/api/admin-proxy';
}

export function getAdminProxyCandidateUrls(endpoint: string = ''): string[] {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (typeof window !== 'undefined') {
    const urls: string[] = [];
    const basePath = '/finora-experience';
    if (window.location.pathname.startsWith(basePath)) {
      urls.push(`${basePath}/api/admin-proxy${cleanEndpoint}`);
      urls.push(`/api/admin-proxy${cleanEndpoint}`);
    } else {
      urls.push(`/api/admin-proxy${cleanEndpoint}`);
      urls.push(`${basePath}/api/admin-proxy${cleanEndpoint}`);
    }
    return Array.from(new Set(urls));
  }
  return [`/api/admin-proxy${cleanEndpoint}`];
}

export async function fetchAdminProxy(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const urls = getAdminProxyCandidateUrls(endpoint);
  let lastResponse: Response | null = null;
  let lastError: unknown = null;

  for (const url of urls) {
    try {
      const res = await fetch(url, options);
      if (res.ok) {
        return res;
      }
      lastResponse = res;
      if (res.status !== 404) {
        return res;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (lastResponse) {
    return lastResponse;
  }
  throw lastError || new Error(`Falha ao conectar à API admin (${endpoint})`);
}

type FetchOptions = RequestInit & {
  params?: Record<string, string | number | boolean | undefined>;
};

export async function fetchApi<T = unknown>(
  endpoint: string,
  options: FetchOptions = {},
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  let url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  if (options.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        searchParams.append(key, String(val));
      }
    });
    const query = searchParams.toString();
    if (query) {
      url += (url.includes('?') ? '&' : '?') + query;
    }
  }

  const { params: _params, ...customConfig } = options;

  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...customConfig.headers,
    },
    ...customConfig,
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    let errorMessage = `Erro na requisição (${response.status})`;
    try {
      const errorData = await response.json();
      if (errorData.message) {
        errorMessage = Array.isArray(errorData.message)
          ? errorData.message.join(', ')
          : errorData.message;
      }
    } catch {
      // Falha ao parsear JSON
    }
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}
