export function normalizeBaseUrl(raw?: string): string {
  return (raw ?? '').trim().replace(/\/+$/, '');
}

const configuredApiBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);
const isDevRuntime = import.meta.env.DEV === true && import.meta.env.PROD !== true;

export const API_BASE_URL: string =
  configuredApiBaseUrl || (isDevRuntime ? 'http://localhost:8080' : '');

export const AUTH_TOKEN_STORAGE_KEY = 'study_together_token';
export const GUEST_TOKEN_STORAGE_KEY = 'guestToken';

export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  errors?: Record<string, string>;
  [key: string]: unknown;
}

export class ApiError extends Error {
  public readonly type: string;
  public readonly title: string;
  public readonly status: number;
  public readonly detail: string;
  public readonly instance?: string;
  public readonly errors?: Record<string, string>;

  constructor(problem: ProblemDetail) {
    super(problem.detail || problem.title || `HTTP Error ${problem.status}`);
    this.name = 'ApiError';
    this.type = problem.type || 'about:blank';
    this.title = problem.title || 'Request Failed';
    this.status = problem.status;
    this.detail = problem.detail || this.title;
    this.instance = problem.instance;
    this.errors = problem.errors;
  }
}

export function formatApiError(
  error: unknown,
  fallbackMessage: string,
  includeErrorMessage = false,
): string {
  if (error instanceof ApiError) {
    if (error.status === 502 || error.status === 503 || error.status === 504) {
      return 'Máy chủ đang khởi động lại (Render Free). Vui lòng đợi vài giây rồi thử lại.';
    }
    const fieldSummary = error.errors
      ? Object.values(error.errors).join(', ')
      : '';
    return fieldSummary || error.detail;
  }
  if (error instanceof TypeError) {
    return 'Không thể kết nối tới máy chủ. Máy chủ có thể đang khởi động lại, vui lòng thử lại sau giây lát.';
  }
  if (includeErrorMessage && error instanceof Error && error.message) {
    return error.message;
  }
  return fallbackMessage;
}

export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return (
    window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ||
    window.localStorage.getItem(GUEST_TOKEN_STORAGE_KEY)
  );
}

export async function parseErrorResponse(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as Partial<ProblemDetail>;
    return new ApiError({
      type: typeof body.type === 'string' ? body.type : 'about:blank',
      title:
        typeof body.title === 'string'
          ? body.title
          : response.statusText || 'Error',
      status:
        typeof body.status === 'number' ? body.status : response.status,
      detail:
        typeof body.detail === 'string'
          ? body.detail
          : `Request failed with status ${response.status}`,
      instance: typeof body.instance === 'string' ? body.instance : undefined,
      errors:
        body.errors && typeof body.errors === 'object'
          ? (body.errors as Record<string, string>)
          : undefined,
    });
  } catch {
    return new ApiError({
      type: 'about:blank',
      title: response.statusText || 'HTTP Error',
      status: response.status,
      detail: `Request failed with status ${response.status}`,
    });
  }
}

export interface ApiRequestOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { skipAuth = false, ...fetchOptions } = options;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE_URL}${normalizedPath}`;

  const headers = new Headers(fetchOptions.headers);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json, application/problem+json');
  }
  if (
    fetchOptions.body &&
    !(fetchOptions.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  const token = skipAuth ? null : getStoredAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export interface BackendHealthResponse {
  status: string;
  service?: string;
  timestamp?: string;
}

export async function fetchBackendHealth(
  signal?: AbortSignal,
): Promise<BackendHealthResponse> {
  return apiRequest<BackendHealthResponse>('/api/v1/health', {
    method: 'GET',
    signal,
  });
}
