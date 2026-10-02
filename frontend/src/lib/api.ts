import axios, { AxiosError, AxiosInstance } from 'axios';
import { clearAllAuth, getAuthClearVersion } from './auth';

interface ApiResponseEnvelope<T> {
  data?: T;
  error?: { code: string; message: string; details?: Record<string, any> };
  meta?: Record<string, any>;
}

interface ApiClientOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

interface ApiRequestOptions {
  silent?: boolean;
  suppressStatuses?: number[];
  skipAuthRedirect?: boolean;
}

interface ApiGetCacheOptions extends ApiRequestOptions {
  staleTime?: number;
  force?: boolean;
}

export class ApiClientError extends Error {
  status?: number;
  code?: string;
  details?: Record<string, any>;

  constructor(message: string, status?: number, code?: string, details?: Record<string, any>) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class ApiClient {
  private client: AxiosInstance;
  private maxRetries: number;
  private retryDelay: number;
  private refreshPromise?: Promise<void>;
  private lastRefreshCompletedAt = 0;

  constructor(options: ApiClientOptions = {}) {
    this.maxRetries = options.maxRetries || 2;
    this.retryDelay = options.retryDelay || 1000;

    this.client = axios.create({
      baseURL: '/api',
      withCredentials: true,
      timeout: options.timeout || 30000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.client.interceptors.request.use(
      (config) => {
        (config as any)._authClearVersion = getAuthClearVersion();
        (config as any)._sentAt = Date.now();
        if (activeOrganizationId) {
          config.headers = config.headers ?? {};
          config.headers['X-Organization-Id'] = activeOrganizationId;
        }
        if (process.env.NODE_ENV === 'development') {
          console.debug(`REQUEST ${config.method?.toUpperCase()} ${config.url}`);
        }
        return config;
      },
      (error) => {
        console.error('Request error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        if (process.env.NODE_ENV === 'development') {
          console.debug(`RESPONSE ${response.status} ${response.config.url}`);
        }
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        if (
          error.response?.status === 401 &&
          typeof window !== 'undefined' &&
          !originalRequest?.skipAuthRedirect &&
          originalRequest?._authClearVersion === getAuthClearVersion()
        ) {
          if (!originalRequest?._refreshRetry && originalRequest?.url !== '/auth/refresh') {
            originalRequest._refreshRetry = true;

           
            if (!this.refreshPromise && (originalRequest?._sentAt ?? 0) < this.lastRefreshCompletedAt) {
              return this.client(originalRequest);
            }

            try {
              await this.refreshSession();
              return this.client(originalRequest);
            } catch {
              await this.clearSession();
            }
          } else {
            await this.clearSession();
          }

          if (!window.location.pathname.includes('/login')) {
            const next = encodeURIComponent(window.location.pathname + window.location.search);
            window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { next } }));
          }
        }

        if (error.response?.status === 403) {
          const data = error.response.data as ApiResponseEnvelope<any>;
          console.error('Access Forbidden:', data.error?.message);
        }

        if (error.response?.status === 404) {
          const data = error.response.data as ApiResponseEnvelope<any>;
          console.warn('Resource not found:', data.error?.message);
        }

        if (
          !originalRequest?._retry &&
          (error.response?.status === 502 || error.response?.status === 503 || error.code === 'ECONNABORTED')
        ) {
          originalRequest._retry = true;
          originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
          if (originalRequest._retryCount <= this.maxRetries) {
            const delay = this.retryDelay * originalRequest._retryCount;
            console.warn(
              `Retrying request (attempt ${originalRequest._retryCount}/${this.maxRetries}) after ${delay}ms`
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            return this.client(originalRequest);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private refreshSession(): Promise<void> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.client
        .post<ApiResponseEnvelope<unknown>>('/auth/refresh', undefined, { skipAuthRedirect: true } as any)
        .then(() => {
          this.lastRefreshCompletedAt = Date.now();
        })
        .finally(() => {
          this.refreshPromise = undefined;
        });
    }

    return this.refreshPromise;
  }

  private async clearSession(): Promise<void> {
    try {
      await this.client.post<ApiResponseEnvelope<unknown>>('/auth/logout', undefined, { skipAuthRedirect: true } as any);
    } catch {}

    invalidateApiCache();
    setActiveOrganizationId(null);
    clearAllAuth();
  }

  private extractData<T>(response: ApiResponseEnvelope<T>): T {
    if (response.error) throw new Error(response.error.message);
    return response.data as T;
  }

  async get<T>(url: string, options: ApiRequestOptions = {}): Promise<T> {
 
    if (this.refreshPromise && !options.skipAuthRedirect) {
      await this.refreshPromise.catch(() => undefined);
    }
    try {
      const response = Object.keys(options).length > 0
        ? await this.client.get<ApiResponseEnvelope<T>>(url, { ...options } as any)
        : await this.client.get<ApiResponseEnvelope<T>>(url);
      return this.extractData(response.data);
    } catch (error) {
      this.handleError(error, 'GET', url, options);
      throw this.buildError(error);
    }
  }

  async post<T>(url: string, data?: any, options?: ApiRequestOptions): Promise<T> {
    try {
      const response = options && Object.keys(options).length > 0
        ? await this.client.post<ApiResponseEnvelope<T>>(url, data, options as any)
        : await this.client.post<ApiResponseEnvelope<T>>(url, data);
      invalidateApiCache();
      return this.extractData(response.data);
    } catch (error) {
      this.handleError(error, 'POST', url, options);
      throw this.buildError(error);
    }
  }

  async put<T>(url: string, data?: any, options?: ApiRequestOptions): Promise<T> {
    try {
      const response = options && Object.keys(options).length > 0
        ? await this.client.put<ApiResponseEnvelope<T>>(url, data, options as any)
        : await this.client.put<ApiResponseEnvelope<T>>(url, data);
      invalidateApiCache();
      return this.extractData(response.data);
    } catch (error) {
      this.handleError(error, 'PUT', url, options);
      throw this.buildError(error);
    }
  }

  async patch<T>(url: string, data?: any, options?: ApiRequestOptions): Promise<T> {
    try {
      const response = options && Object.keys(options).length > 0
        ? await this.client.patch<ApiResponseEnvelope<T>>(url, data, options as any)
        : await this.client.patch<ApiResponseEnvelope<T>>(url, data);
      invalidateApiCache();
      return this.extractData(response.data);
    } catch (error) {
      this.handleError(error, 'PATCH', url, options);
      throw this.buildError(error);
    }
  }

  async delete<T>(url: string, options?: ApiRequestOptions): Promise<T> {
    try {
      const response = options && Object.keys(options).length > 0
        ? await this.client.delete<ApiResponseEnvelope<T>>(url, options as any)
        : await this.client.delete<ApiResponseEnvelope<T>>(url);
      invalidateApiCache();
      return this.extractData(response.data);
    } catch (error) {
      this.handleError(error, 'DELETE', url, options);
      throw this.buildError(error);
    }
  }

  private buildError(error: any): ApiClientError {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const data = axios.isAxiosError(error) ? (error.response?.data as any) : undefined;
    return new ApiClientError(
      this.extractErrorMessage(error),
      status,
      data?.error?.code,
      data?.error?.details,
    );
  }

  private extractErrorMessage(error: any): string {
    if (axios.isAxiosError(error)) {
      if (!error.response) {
        return 'No se pudo conectar con el backend';
      }
      const d = error.response?.data as any;
      return d?.error?.message || d?.message || d?.msg || error.message || 'Unknown error';
    }
    return error instanceof Error ? error.message : 'Unknown error';
  }

  private handleError(error: any, method: string, url: string, options: ApiRequestOptions = {}) {
    if (options.silent) {
      return;
    }

    if (axios.isAxiosError(error)) {
      if (!error.response) {
        console.warn(`API ${method} ${url} - Backend no disponible`);
        return;
      }

      const status = error.response?.status || 'UNKNOWN';
      if (typeof status === 'number' && options.suppressStatuses?.includes(status)) {
        return;
      }

      const d = error.response?.data as any;
      const msg = d?.error?.message || d?.message || d?.msg || 'Unknown error';
      console.error(`API ${method} ${url} - ${status}: ${msg}`);
      if (d?.error?.details) console.error('Details:', d.error.details);
      return;
    }

    if (error instanceof Error) {
      console.error(`API ${method} ${url} - Error: ${error.message}`);
      return;
    }

    console.error(`API ${method} ${url} - Unknown error:`, error);
  }
}

const apiClient = new ApiClient();
let activeOrganizationId: string | null = null;

export function setActiveOrganizationId(organizationId: string | null) {
  if (activeOrganizationId !== organizationId) {
    invalidateApiCache();
  }
  activeOrganizationId = organizationId;
}

export function getActiveOrganizationId() {
  return activeOrganizationId;
}

interface CacheEntry<T> {
  data?: T;
  fetchedAt: number;
  inflight?: Promise<T>;
}

const responseCache = new Map<string, CacheEntry<unknown>>();

function getCacheEntry<T>(key: string) {
  return responseCache.get(key) as CacheEntry<T> | undefined;
}

function setCacheEntry<T>(key: string, entry: CacheEntry<T>) {
  responseCache.set(key, entry as CacheEntry<unknown>);
}

export function invalidateApiCache(matchers?: string | string[]) {
  if (!matchers) {
    responseCache.clear();
    return;
  }

  const matcherList = Array.isArray(matchers) ? matchers : [matchers];
  for (const key of responseCache.keys()) {
    if (matcherList.some((matcher) => key.startsWith(matcher) || key.includes(`:${matcher}`))) {
      responseCache.delete(key);
    }
  }
}

export async function apiGet<T>(url: string, options?: ApiRequestOptions): Promise<T> {
  return apiClient.get<T>(url, options);
}

let authContextRequest: Promise<unknown> | undefined;

/** Shares the short-lived session bootstrap request across Strict Mode and login consumers. */
export function apiGetAuthContext<T>(): Promise<T> {
  if (!authContextRequest) {
    const request = apiClient.get<T>('/auth/context', {
      silent: true,
      suppressStatuses: [401],
    });
    authContextRequest = request;
    void request.then(() => {
      if (authContextRequest === request) authContextRequest = undefined;
    }, () => {
      if (authContextRequest === request) authContextRequest = undefined;
    });
  }

  return authContextRequest as Promise<T>;
}

export function invalidateAuthContextRequest() {
  authContextRequest = undefined;
}

export async function apiGetCached<T>(url: string, options: ApiGetCacheOptions = {}): Promise<T> {
  const authVersion = getAuthClearVersion();
  const requestOrganizationId = activeOrganizationId;
  const cacheKey = `${requestOrganizationId ?? 'no-org'}:${url}`;
  const staleTime = options.staleTime ?? 0;
  const entry = getCacheEntry<T>(cacheKey);
  const isFresh = !!entry?.data && Date.now() - entry.fetchedAt < staleTime;

  if (!options.force && isFresh) {
    return entry!.data as T;
  }

  if (!options.force && entry?.inflight) {
    return entry.inflight;
  }

  const inflight = apiClient
    .get<T>(url, options)
    .then((data) => {
      if (
        getAuthClearVersion() !== authVersion ||
        activeOrganizationId !== requestOrganizationId
      ) {
        responseCache.delete(cacheKey);
        throw new ApiClientError(
          'Request superseded by an authentication context change',
          undefined,
          'STALE_AUTH_CONTEXT',
        );
      }
      setCacheEntry(cacheKey, { data, fetchedAt: Date.now() });
      return data;
    })
    .catch((error) => {
      if (
        getAuthClearVersion() !== authVersion ||
        (error instanceof ApiClientError && error.code === 'STALE_AUTH_CONTEXT')
      ) {
        responseCache.delete(cacheKey);
      } else if (entry?.data) {
        setCacheEntry(cacheKey, { data: entry.data, fetchedAt: entry.fetchedAt });
      } else {
        responseCache.delete(cacheKey);
      }
      throw error;
    });

  setCacheEntry(cacheKey, {
    data: entry?.data,
    fetchedAt: entry?.fetchedAt ?? 0,
    inflight,
  });

  return inflight;
}

export async function apiPost<T>(url: string, data?: any, options?: ApiRequestOptions): Promise<T> {
  return apiClient.post<T>(url, data, options);
}

export async function apiPut<T>(url: string, data?: any, options?: ApiRequestOptions): Promise<T> {
  return apiClient.put<T>(url, data, options);
}

export async function apiPatch<T>(url: string, data?: any, options?: ApiRequestOptions): Promise<T> {
  return apiClient.patch<T>(url, data, options);
}

export async function apiDelete<T>(url: string, options?: ApiRequestOptions): Promise<T> {
  return apiClient.delete<T>(url, options);
}

export async function apiDownload(url: string): Promise<Blob> {
  const response = await fetch(`/api${url}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('No se pudo descargar el archivo');
  }

  return response.blob();
}

export function clearApiCache() {
  responseCache.clear();
  // Clear any other internal state if necessary
}

export default apiClient;

