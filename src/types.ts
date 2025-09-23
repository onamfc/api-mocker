export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export interface RequestContext {
  params: Record<string, string>;
  body: any;
  queryParams: Record<string, string>;
  headers: Record<string, string>;
  request: Request;
  state: Record<string, any>;
}

export interface MockResponse {
  data: any;
  status?: number;
  headers?: Record<string, string>;
}

export type StaticResponseValue = any | MockResponse | Response;

export type StaticResponse =
  | StaticResponseValue
  | Promise<StaticResponseValue>
  | (() => StaticResponseValue | Promise<StaticResponseValue>);

export interface MockEndpoint {
  path: string;
  method: HttpMethod;
  response: StaticResponse;
  status?: number;
  delay?: number;
  headers?: Record<string, string>;
  priority?: number;
  queryParams?: Record<string, string>;
  requestHeaders?: Record<string, string>;
  match?: (request: Request) => boolean;
  networkError?: NetworkError;
}

export interface MockConfig {
  baseUrl?: string;
  globalDelay?: number;
  globalHeaders?: Record<string, string>;
  logRequests?: boolean;
  defaultPriority?: number;
}

export interface RequestMatcherOptions {
  exact?: boolean;
  ignoreQuery?: boolean;
}

export type ResponseGenerator = (
  context: RequestContext
) => StaticResponseValue | Promise<StaticResponseValue>;

export interface DynamicEndpoint {
  path: string;
  method: HttpMethod;
  handler: ResponseGenerator;
  status?: number;
  delay?: number;
  headers?: Record<string, string>;
  priority?: number;
  queryParams?: Record<string, string>;
  requestHeaders?: Record<string, string>;
  match?: (request: Request) => boolean;
  networkError?: NetworkError;
}

export type NetworkError = 'timeout' | 'connection_refused' | 'abort';
