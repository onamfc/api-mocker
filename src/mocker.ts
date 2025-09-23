import {
  MockEndpoint,
  MockConfig,
  HttpMethod,
  MockResponse,
  DynamicEndpoint,
  RequestContext,
  NetworkError
} from './types';

export class ApiMocker {
  private endpoints: Map<string, (MockEndpoint | DynamicEndpoint)[]> = new Map();
  private config: MockConfig;
  private isEnabled = true;
  private originalFetch: typeof fetch;
  private boundOriginalFetch: typeof fetch;
  private interceptFetch?: typeof fetch;
  private state: Record<string, any> = {};

  constructor(config: MockConfig = {}) {
    if (typeof globalThis.fetch !== 'function') {
      throw new Error(
        'ApiMocker requires a global fetch implementation. Please provide a fetch polyfill before creating an ApiMocker instance.'
      );
    }

    this.config = this.createConfig(config);
    this.originalFetch = globalThis.fetch;
    this.boundOriginalFetch = globalThis.fetch.bind(globalThis);
    this.setupFetchInterceptor();
  }

  /**
   * Add a static mock endpoint
   */
  mock(endpoint: MockEndpoint): this {
    const key = this.createEndpointKey(endpoint.method, endpoint.path);
    const endpointWithPriority = {
      ...endpoint,
      priority: endpoint.priority ?? this.config.defaultPriority ?? 0
    };

    if (!this.endpoints.has(key)) {
      this.endpoints.set(key, []);
    }

    this.endpoints.get(key)!.push(endpointWithPriority);
    this.sortEndpointsByPriority(key);

    this.log(`Mocked ${endpoint.method} ${endpoint.path}`);
    return this;
  }

  /**
   * Add a dynamic mock endpoint with custom handler
   */
  mockDynamic(endpoint: DynamicEndpoint): this {
    const key = this.createEndpointKey(endpoint.method, endpoint.path);
    const endpointWithPriority = {
      ...endpoint,
      priority: endpoint.priority ?? this.config.defaultPriority ?? 0
    };

    if (!this.endpoints.has(key)) {
      this.endpoints.set(key, []);
    }

    this.endpoints.get(key)!.push(endpointWithPriority);
    this.sortEndpointsByPriority(key);

    this.log(`Mocked dynamic ${endpoint.method} ${endpoint.path}`);
    return this;
  }

  /**
   * Convenience methods for different HTTP methods
   */
  get(path: string, response: MockEndpoint['response'], options: Partial<MockEndpoint> = {}): this {
    return this.mock({ path, method: 'GET', response, ...options });
  }

  post(path: string, response: MockEndpoint['response'], options: Partial<MockEndpoint> = {}): this {
    return this.mock({ path, method: 'POST', response, ...options });
  }

  put(path: string, response: MockEndpoint['response'], options: Partial<MockEndpoint> = {}): this {
    return this.mock({ path, method: 'PUT', response, ...options });
  }

  patch(path: string, response: MockEndpoint['response'], options: Partial<MockEndpoint> = {}): this {
    return this.mock({ path, method: 'PATCH', response, ...options });
  }

  delete(path: string, response: MockEndpoint['response'], options: Partial<MockEndpoint> = {}): this {
    return this.mock({ path, method: 'DELETE', response, ...options });
  }

  /**
   * Enable or disable mocking
   */
  enable(): this {
    this.isEnabled = true;
    return this;
  }

  disable(): this {
    this.isEnabled = false;
    return this;
  }

  /**
   * Clear all mock endpoints
   */
  clear(): this {
    this.endpoints.clear();
    this.state = {};
    this.log('Cleared all mock endpoints and state');
    return this;
  }

  /**
   * Remove a specific endpoint
   */
  remove(method: HttpMethod, path: string): this {
    const key = this.createEndpointKey(method, path);
    this.endpoints.delete(key);
    this.log(`Removed mock ${method} ${path}`);
    return this;
  }

  /**
   * Get current state
   */
  getState(): Record<string, any> {
    return { ...this.state };
  }

  /**
   * Set state value
   */
  setState(key: string, value: any): this {
    this.state[key] = value;
    return this;
  }

  /**
   * Clear state
   */
  clearState(): this {
    this.state = {};
    return this;
  }

  /**
   * Restore original fetch
   */
  restore(): void {
    if (this.interceptFetch && globalThis.fetch === this.interceptFetch) {
      globalThis.fetch = this.originalFetch;
    } else {
      globalThis.fetch = this.originalFetch;
    }

    this.log('Restored original fetch');
  }

  /**
   * Get current configuration
   */
  getConfig(): MockConfig {
    return {
      ...this.config,
      globalHeaders: { ...this.config.globalHeaders }
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MockConfig>): this {
    const updatedConfig: MockConfig = {
      ...this.config,
      ...newConfig
    };

    if (newConfig.baseUrl !== undefined) {
      updatedConfig.baseUrl = newConfig.baseUrl ? this.normalizeBaseUrl(newConfig.baseUrl) : '';
    }

    if (newConfig.globalHeaders) {
      updatedConfig.globalHeaders = {
        ...this.config.globalHeaders,
        ...newConfig.globalHeaders
      };
    }

    this.config = updatedConfig;
    return this;
  }

  private createConfig(config: MockConfig): MockConfig {
    const defaultHeaders = { 'Content-Type': 'application/json' };

    return {
      baseUrl: config.baseUrl ? this.normalizeBaseUrl(config.baseUrl) : '',
      globalDelay: config.globalDelay ?? 0,
      globalHeaders: {
        ...defaultHeaders,
        ...(config.globalHeaders ?? {})
      },
      logRequests: config.logRequests ?? true,
      defaultPriority: config.defaultPriority ?? 0
    };
  }

  private setupFetchInterceptor(): void {
    const intercept: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' || input instanceof URL ? input.toString() : input.url;
      const absoluteUrl = this.toAbsoluteUrl(url);
      const method = (init?.method || 'GET').toUpperCase() as HttpMethod;

      if (!this.isEnabled) {
        return this.boundOriginalFetch(input, init);
      }

      const request = new Request(absoluteUrl, init);
      const mockEndpoint = this.findMatchingEndpoint(method, absoluteUrl, request);

      if (mockEndpoint) {
        return this.createMockResponse(mockEndpoint, absoluteUrl, request, init);
      }

      return this.boundOriginalFetch(input, init);
    };

    this.interceptFetch = intercept;
    globalThis.fetch = intercept;
  }

  private findMatchingEndpoint(method: HttpMethod, url: string, request: Request): MockEndpoint | DynamicEndpoint | null {
    const candidates: Array<{ endpoint: MockEndpoint | DynamicEndpoint; specificity: number }> = [];

    for (const [, endpointList] of this.endpoints) {
      for (const endpoint of endpointList) {
        if (this.matchesEndpoint(endpoint, method, url, request)) {
          const specificity = this.calculateSpecificity(endpoint.path);
          candidates.push({ endpoint, specificity });
        }
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => {
      const priorityA = a.endpoint.priority ?? 0;
      const priorityB = b.endpoint.priority ?? 0;

      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }

      return b.specificity - a.specificity;
    });

    return candidates[0].endpoint;
  }

  private matchesEndpoint(endpoint: MockEndpoint | DynamicEndpoint, method: HttpMethod, url: string, request: Request): boolean {
    if (endpoint.method !== method) {
      return false;
    }

    if (endpoint.match && !endpoint.match(request)) {
      return false;
    }

    if (!this.matchesPath(endpoint.path, url)) {
      return false;
    }

    if (endpoint.queryParams && !this.matchesQueryParams(endpoint.queryParams, url)) {
      return false;
    }

    if (endpoint.requestHeaders && !this.matchesHeaders(endpoint.requestHeaders, request)) {
      return false;
    }

    return true;
  }

  private matchesPath(pattern: string, url: string): boolean {
    const patternPath = this.trimTrailingSlash(this.normalizePath(pattern));
    const requestPath = this.trimTrailingSlash(this.getPathWithoutBase(url));

    const escapedPattern = patternPath.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const patternRegex = escapedPattern.replace(/:([A-Za-z0-9_-]+)/g, '([^/]+)');
    const regex = new RegExp(`^${patternRegex}$`);

    return regex.test(requestPath);
  }

  private matchesQueryParams(expectedParams: Record<string, string>, url: string): boolean {
    const urlObj = new URL(url, this.getRequestBase());

    for (const [key, expectedValue] of Object.entries(expectedParams)) {
      const actualValue = urlObj.searchParams.get(key);
      if (actualValue !== expectedValue) {
        return false;
      }
    }

    return true;
  }

  private matchesHeaders(expectedHeaders: Record<string, string>, request: Request): boolean {
    const requestHeaders = this.extractHeaders(request);

    for (const [key, expectedValue] of Object.entries(expectedHeaders)) {
      if (requestHeaders[key.toLowerCase()] !== expectedValue) {
        return false;
      }
    }

    return true;
  }

  private calculateSpecificity(path: string): number {
    const segments = this.trimTrailingSlash(this.normalizePath(path)).split('/').filter(Boolean);
    let specificity = 0;

    for (const segment of segments) {
      if (segment.startsWith(':')) {
        specificity += 1;
      } else {
        specificity += 10;
      }
    }

    return specificity;
  }

  private async createMockResponse(
    endpoint: MockEndpoint | DynamicEndpoint,
    url: string,
    request: Request,
    init?: RequestInit
  ): Promise<Response> {
    const delay = endpoint.delay ?? this.config.globalDelay ?? 0;
    await this.applyDelay(delay);

    if (endpoint.networkError) {
      return this.simulateNetworkError(endpoint.networkError);
    }

    const responseValue = await this.resolveEndpointResponse(endpoint, request);

    if (typeof Response !== 'undefined' && responseValue instanceof Response) {
      return responseValue;
    }

    const { body, status, headers } = this.normalizeResponse(endpoint, responseValue);

    this.log(`Mocked response for ${endpoint.method} ${url}`, {
      status,
      data: responseValue instanceof Response ? '[Response]' : responseValue
    });

    return new Response(body, {
      status,
      headers
    });
  }

  private async resolveEndpointResponse(
    endpoint: MockEndpoint | DynamicEndpoint,
    request: Request
  ): Promise<any> {
    if ('handler' in endpoint) {
      const context = await this.buildRequestContext(endpoint.path, request.url, request);
      return endpoint.handler(context);
    }

    if (typeof endpoint.response === 'function') {
      return endpoint.response();
    }

    return endpoint.response;
  }

  private normalizeResponse(endpoint: MockEndpoint | DynamicEndpoint, responseValue: any): {
    body: BodyInit | null;
    status: number;
    headers: Record<string, string>;
  } {
    if (this.isMockResponse(responseValue)) {
      const headers = this.mergeHeaders(endpoint.headers, responseValue.headers);
      const body = this.serializeBody(responseValue.data);
      const status = responseValue.status ?? endpoint.status ?? 200;

      return { body, status, headers };
    }

    const headers = this.mergeHeaders(endpoint.headers);
    const body = this.serializeBody(responseValue);
    const status = endpoint.status ?? 200;

    return { body, status, headers };
  }

  private mergeHeaders(
    ...headerGroups: Array<Record<string, string> | undefined>
  ): Record<string, string> {
    const headers: Record<string, string> = {
      ...(this.config.globalHeaders ?? {})
    };

    for (const group of headerGroups) {
      if (!group) {
        continue;
      }

      for (const [key, value] of Object.entries(group)) {
        headers[key] = value;
      }
    }

    return headers;
  }

  private serializeBody(data: any): BodyInit | null {
    if (data === undefined || data === null) {
      return null;
    }

    if (this.isBodyInit(data)) {
      return data;
    }

    return JSON.stringify(data);
  }

  private isMockResponse(value: any): value is MockResponse {
    return (
      value !== null &&
      typeof value === 'object' &&
      'data' in value &&
      ('status' in value || 'headers' in value)
    );
  }

  private isBodyInit(value: any): value is BodyInit {
    if (typeof value === 'string' || value === null) {
      return true;
    }

    if (typeof Blob !== 'undefined' && value instanceof Blob) {
      return true;
    }

    if (typeof FormData !== 'undefined' && value instanceof FormData) {
      return true;
    }

    if (typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams) {
      return true;
    }

    if (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream) {
      return true;
    }

    if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
      return true;
    }

    if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(value)) {
      return true;
    }

    return false;
  }

  private async buildRequestContext(pattern: string, url: string, request: Request): Promise<RequestContext> {
    const params = this.extractParams(pattern, url);
    const queryParams = this.extractQueryParams(url);
    const headers = this.extractHeaders(request);
    const body = await this.parseRequestBody(request);

    return {
      params,
      body,
      queryParams,
      headers,
      request,
      state: this.state
    };
  }

  private extractParams(pattern: string, url: string): Record<string, string> {
    const params: Record<string, string> = {};

    const normalizedPattern = this.trimTrailingSlash(this.normalizePath(pattern));
    const requestPath = this.trimTrailingSlash(this.getPathWithoutBase(url));

    const patternParts = normalizedPattern.split('/').filter(Boolean);
    const urlParts = requestPath.split('/').filter(Boolean);

    patternParts.forEach((part, index) => {
      if (part.startsWith(':') && urlParts[index]) {
        const paramName = part.substring(1);
        params[paramName] = urlParts[index];
      }
    });

    return params;
  }

  private extractQueryParams(url: string): Record<string, string> {
    const urlObj = new URL(url, this.getRequestBase());
    const params: Record<string, string> = {};

    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    return params;
  }

  private extractHeaders(request: Request): Record<string, string> {
    const headers: Record<string, string> = {};

    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    return headers;
  }

  private async parseRequestBody(request: Request): Promise<any> {
    try {
      const clonedRequest = request.clone();
      const text = await clonedRequest.text();

      if (!text) {
        return undefined;
      }

      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    } catch {
      return undefined;
    }
  }

  private getPathWithoutBase(url: string): string {
    const urlObj = new URL(url, this.getRequestBase());
    const requestPath = this.normalizePath(urlObj.pathname);
    const basePath = this.getBasePath();

    if (basePath && requestPath.startsWith(basePath)) {
      const trimmed = requestPath.slice(basePath.length);
      return this.normalizePath(trimmed);
    }

    return requestPath;
  }

  private getBasePath(): string {
    if (!this.config.baseUrl) {
      return '';
    }

    const base = new URL(this.config.baseUrl, this.config.baseUrl.startsWith('http') ? undefined : 'http://localhost');
    const path = base.pathname;

    if (path === '/') {
      return '';
    }

    return this.normalizePath(path);
  }

  private normalizePath(path: string): string {
    if (!path) {
      return '/';
    }

    return path.startsWith('/') ? path : `/${path}`;
  }

  private trimTrailingSlash(path: string): string {
    if (path.length > 1 && path.endsWith('/')) {
      return path.slice(0, -1);
    }

    return path;
  }

  private normalizeBaseUrl(baseUrl: string): string {
    if (!baseUrl) {
      return '';
    }

    const trimmed = baseUrl.replace(/\/+$/, '');

    if (!trimmed || trimmed === '/') {
      return '';
    }

    return trimmed;
  }

  private getRequestBase(): string {
    if (this.config.baseUrl) {
      const base = new URL(
        this.config.baseUrl,
        this.config.baseUrl.startsWith('http') ? undefined : 'http://localhost'
      );
      return base.href.endsWith('/') ? base.href : `${base.href}/`;
    }

    return 'http://localhost/';
  }

  private toAbsoluteUrl(url: string): string {
    try {
      return new URL(url).toString();
    } catch {
      return new URL(url, this.getRequestBase()).toString();
    }
  }

  private async simulateNetworkError(errorType: NetworkError): Promise<Response> {
    switch (errorType) {
      case 'timeout':
        throw new TypeError('Network request failed: timeout');
      case 'connection_refused':
        throw new TypeError('Network request failed: connection refused');
      case 'abort':
        if (typeof DOMException !== 'undefined') {
          throw new DOMException('The operation was aborted', 'AbortError');
        }

        const abortError = new Error('The operation was aborted');
        abortError.name = 'AbortError';
        throw abortError;
      default:
        throw new TypeError('Network request failed');
    }
  }

  private async applyDelay(delay: number): Promise<void> {
    if (delay > 0) {
      await this.sleep(delay);
    }
  }

  private sortEndpointsByPriority(key: string): void {
    const endpoints = this.endpoints.get(key);
    if (endpoints && endpoints.length > 1) {
      endpoints.sort((a, b) => {
        const priorityA = a.priority ?? 0;
        const priorityB = b.priority ?? 0;
        return priorityB - priorityA;
      });
    }
  }

  private createEndpointKey(method: HttpMethod, path: string): string {
    return `${method}:${path}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private log(message: string, data?: any): void {
    if (this.config.logRequests) {
      console.log(`[ApiMocker] ${message}`, data ?? '');
    }
  }
}
