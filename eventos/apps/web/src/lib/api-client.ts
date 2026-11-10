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

// Uma tentativa só: repetir POST/DELETE em outra URL pode duplicar a operação.
export function fetchAdminProxy(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return fetch(`${getAdminProxyUrl()}${cleanEndpoint}`, options);
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
