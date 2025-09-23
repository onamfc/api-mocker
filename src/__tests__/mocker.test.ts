import { ApiMocker } from '../mocker';

const mockFetch = jest.fn();
const originalFetch = global.fetch;

beforeAll(() => {
  (global as any).fetch = mockFetch;
});

afterAll(() => {
  (global as any).fetch = originalFetch;
});

describe('ApiMocker', () => {
  let mocker: ApiMocker;

  beforeEach(() => {
    mockFetch.mockReset();
    mocker = new ApiMocker({ logRequests: false });
  });

  afterEach(() => {
    mocker.restore();
  });

  describe('Static Endpoints', () => {
    test('should mock GET request', async () => {
      const mockData = { id: 1, name: 'Test User' };
      mocker.get('/users/1', mockData);

      const response = await fetch('/users/1');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockData);
    });

    test('should mock POST request with custom status', async () => {
      const mockData = { id: 2, name: 'New User' };
      mocker.post('/users', mockData, { status: 201 });

      const response = await fetch('/users', { method: 'POST' });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toEqual(mockData);
    });

    test('should handle different HTTP methods', async () => {
      mocker
        .put('/users/1', { updated: true })
        .delete('/users/1', { deleted: true })
        .patch('/users/1', { patched: true });

      const putResponse = await fetch('/users/1', { method: 'PUT' });
      const deleteResponse = await fetch('/users/1', { method: 'DELETE' });
      const patchResponse = await fetch('/users/1', { method: 'PATCH' });

      expect(await putResponse.json()).toEqual({ updated: true });
      expect(await deleteResponse.json()).toEqual({ deleted: true });
      expect(await patchResponse.json()).toEqual({ patched: true });
    });

    test('should support MockResponse objects', async () => {
      mocker.get('/with-meta', () => ({
        data: { ok: true },
        status: 202,
        headers: { 'X-Meta': 'yes' }
      }));

      const response = await fetch('/with-meta');
      const data = await response.json();

      expect(response.status).toBe(202);
      expect(response.headers.get('X-Meta')).toBe('yes');
      expect(data).toEqual({ ok: true });
    });

    test('should support returning Response instances', async () => {
      mocker.get('/custom-response', () => new Response('custom', {
        status: 203,
        headers: { 'X-Custom': '1' }
      }));

      const response = await fetch('/custom-response');

      expect(response.status).toBe(203);
      expect(response.headers.get('X-Custom')).toBe('1');
      expect(await response.text()).toBe('custom');
    });
  });

  describe('Dynamic Endpoints', () => {
    test('should handle dynamic parameters', async () => {
      mocker.mockDynamic({
        path: '/users/:id',
        method: 'GET',
        handler: (context) => ({ id: context.params.id, name: `User ${context.params.id}` })
      });

      const response = await fetch('/users/123');
      const data = await response.json();

      expect(data).toEqual({ id: '123', name: 'User 123' });
    });

    test('should handle multiple parameters', async () => {
      mocker.mockDynamic({
        path: '/users/:userId/posts/:postId',
        method: 'GET',
        handler: (context) => ({
          userId: context.params.userId,
          postId: context.params.postId,
          title: `Post ${context.params.postId} by User ${context.params.userId}`
        })
      });

      const response = await fetch('/users/1/posts/5');
      const data = await response.json();

      expect(data).toEqual({
        userId: '1',
        postId: '5',
        title: 'Post 5 by User 1'
      });
    });

    test('should handle request body in dynamic handlers', async () => {
      mocker.mockDynamic({
        path: '/users',
        method: 'POST',
        handler: (context) => ({
          id: Date.now(),
          ...context.body,
          created: true
        })
      });

      const requestBody = { name: 'John', email: 'john@example.com' };
      const response = await fetch('/users', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();

      expect(data.name).toBe('John');
      expect(data.email).toBe('john@example.com');
      expect(data.created).toBe(true);
      expect(typeof data.id).toBe('number');
    });

    test('should provide query parameters in context', async () => {
      mocker.mockDynamic({
        path: '/search',
        method: 'GET',
        handler: (context) => ({
          query: context.queryParams.q,
          limit: context.queryParams.limit,
          results: [`Result for: ${context.queryParams.q}`]
        })
      });

      const response = await fetch('/search?q=test&limit=10');
      const data = await response.json();

      expect(data).toEqual({
        query: 'test',
        limit: '10',
        results: ['Result for: test']
      });
    });

    test('should provide request headers in context', async () => {
      mocker.mockDynamic({
        path: '/protected',
        method: 'GET',
        handler: (context) => ({
          authorized: context.headers['authorization'] === 'Bearer token123',
          userAgent: context.headers['user-agent']
        })
      });

      const response = await fetch('/protected', {
        headers: {
          'Authorization': 'Bearer token123',
          'User-Agent': 'Test Agent'
        }
      });
      const data = await response.json();

      expect(data.authorized).toBe(true);
      expect(data.userAgent).toBe('Test Agent');
    });

    test('should allow dynamic handlers to override status and headers', async () => {
      mocker.mockDynamic({
        path: '/dynamic/meta',
        method: 'GET',
        handler: () => ({
          data: { ok: true },
          status: 418,
          headers: { 'X-Dynamic': '1' }
        })
      });

      const response = await fetch('/dynamic/meta');

      expect(response.status).toBe(418);
      expect(response.headers.get('X-Dynamic')).toBe('1');
      expect(await response.json()).toEqual({ ok: true });
    });

    test('should allow dynamic handlers to return Response instances', async () => {
      mocker.mockDynamic({
        path: '/dynamic/response',
        method: 'GET',
        handler: () => new Response('dynamic', {
          status: 203,
          headers: { 'X-Handler': 'yes' }
        })
      });

      const response = await fetch('/dynamic/response');

      expect(response.status).toBe(203);
      expect(response.headers.get('X-Handler')).toBe('yes');
      expect(await response.text()).toBe('dynamic');
    });
  });

  describe('Advanced Request Matching', () => {
    test('should match based on query parameters', async () => {
      mocker.mock({
        path: '/users',
        method: 'GET',
        response: [{ id: 1, name: 'Admin User', role: 'admin' }],
        queryParams: { role: 'admin' }
      });

      mocker.mock({
        path: '/users',
        method: 'GET',
        response: [{ id: 2, name: 'Regular User', role: 'user' }],
        queryParams: { role: 'user' }
      });

      const adminResponse = await fetch('/users?role=admin');
      const userResponse = await fetch('/users?role=user');

      const adminData = await adminResponse.json();
      const userData = await userResponse.json();

      expect(adminData[0].role).toBe('admin');
      expect(userData[0].role).toBe('user');
    });

    test('should match based on request headers', async () => {
      mocker.mock({
        path: '/api/data',
        method: 'GET',
        response: { data: 'json response' },
        requestHeaders: { 'Accept': 'application/json' }
      });

      mocker.mock({
        path: '/api/data',
        method: 'GET',
        response: '<xml>xml response</xml>',
        requestHeaders: { 'Accept': 'application/xml' }
      });

      const jsonResponse = await fetch('/api/data', {
        headers: { 'Accept': 'application/json' }
      });
      const xmlResponse = await fetch('/api/data', {
        headers: { 'Accept': 'application/xml' }
      });

      const jsonData = await jsonResponse.json();
      const xmlData = await xmlResponse.text();

      expect(jsonData.data).toBe('json response');
      expect(xmlData).toBe('<xml>xml response</xml>');
    });

    test('should use custom match function', async () => {
      mocker.mock({
        path: '/conditional',
        method: 'POST',
        response: { matched: true },
        match: (request) => {
          const url = new URL(request.url, 'http://localhost');
          return url.searchParams.get('special') === 'true';
        }
      });

      const matchedResponse = await fetch('/conditional?special=true', { method: 'POST' });
      const matchedData = await matchedResponse.json();

      expect(matchedData.matched).toBe(true);

      mockFetch.mockResolvedValueOnce(new Response('{"original": true}'));
      await fetch('/conditional?special=false', { method: 'POST' });
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Priority System', () => {
    test('should prioritize higher priority endpoints', async () => {
      mocker.mock({
        path: '/users/:id',
        method: 'GET',
        response: { type: 'generic' },
        priority: 1
      });

      mocker.mock({
        path: '/users/:id',
        method: 'GET',
        response: { type: 'specific' },
        priority: 10
      });

      const response = await fetch('/users/123');
      const data = await response.json();

      expect(data.type).toBe('specific');
    });

    test('should prioritize more specific paths when priority is equal', async () => {
      mocker.mock({
        path: '/users/:id',
        method: 'GET',
        response: { type: 'dynamic' }
      });

      mocker.mock({
        path: '/users/me',
        method: 'GET',
        response: { type: 'static' }
      });

      const response = await fetch('/users/me');
      const data = await response.json();

      expect(data.type).toBe('static');
    });
  });

  describe('Network Error Simulation', () => {
    test('should simulate timeout error', async () => {
      mocker.mock({
        path: '/timeout',
        method: 'GET',
        response: {},
        networkError: 'timeout'
      });

      await expect(fetch('/timeout')).rejects.toThrow('Network request failed: timeout');
    });

    test('should simulate connection refused error', async () => {
      mocker.mock({
        path: '/refused',
        method: 'GET',
        response: {},
        networkError: 'connection_refused'
      });

      await expect(fetch('/refused')).rejects.toThrow('Network request failed: connection refused');
    });

    test('should simulate abort error', async () => {
      mocker.mock({
        path: '/abort',
        method: 'GET',
        response: {},
        networkError: 'abort'
      });

      await expect(fetch('/abort')).rejects.toThrow('The operation was aborted');
    });
  });

  describe('Stateful Mocks', () => {
    test('should maintain state across requests', async () => {
      let todoId = 1;

      mocker.mockDynamic({
        path: '/todos',
        method: 'POST',
        handler: (context) => {
          if (!context.state.todos) {
            context.state.todos = [];
          }

          const todo = {
            id: todoId++,
            ...context.body,
            completed: false
          };

          context.state.todos.push(todo);
          return todo;
        }
      });

      mocker.mockDynamic({
        path: '/todos',
        method: 'GET',
        handler: (context) => {
          return context.state.todos || [];
        }
      });

      await fetch('/todos', {
        method: 'POST',
        body: JSON.stringify({ title: 'First todo' })
      });

      await fetch('/todos', {
        method: 'POST',
        body: JSON.stringify({ title: 'Second todo' })
      });

      const response = await fetch('/todos');
      const todos = await response.json();

      expect(todos).toHaveLength(2);
      expect(todos[0].title).toBe('First todo');
      expect(todos[1].title).toBe('Second todo');
    });

    test('should allow manual state management', async () => {
      mocker.setState('counter', 0);

      mocker.mockDynamic({
        path: '/counter',
        method: 'POST',
        handler: (context) => {
          context.state.counter = (context.state.counter || 0) + 1;
          return { count: context.state.counter };
        }
      });

      const response1 = await fetch('/counter', { method: 'POST' });
      const data1 = await response1.json();
      expect(data1.count).toBe(1);

      const response2 = await fetch('/counter', { method: 'POST' });
      const data2 = await response2.json();
      expect(data2.count).toBe(2);

      expect(mocker.getState().counter).toBe(2);
    });
  });

  describe('Configuration', () => {
    test('should respect baseUrl configuration', async () => {
      const mockerWithBaseUrl = new ApiMocker({
        baseUrl: 'https://api.example.com/',
        logRequests: false
      });

      mockerWithBaseUrl.get('/users', [{ id: 1, name: 'User' }]);

      const response = await fetch('https://api.example.com/users');
      const data = await response.json();

      expect(data).toEqual([{ id: 1, name: 'User' }]);
      expect(mockerWithBaseUrl.getConfig().baseUrl).toBe('https://api.example.com');

      mockerWithBaseUrl.restore();
    });

    test('should apply global delay', async () => {
      const startTime = Date.now();
      const mockerWithDelay = new ApiMocker({
        globalDelay: 100,
        logRequests: false
      });

      mockerWithDelay.get('/test', { message: 'delayed' });

      await fetch('/test');
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(100);

      mockerWithDelay.restore();
    });

    test('should apply custom headers', async () => {
      mocker.get('/test', { data: 'test' }, {
        headers: { 'X-Custom-Header': 'custom-value' }
      });

      const response = await fetch('/test');

      expect(response.headers.get('X-Custom-Header')).toBe('custom-value');
    });
  });

  describe('Enable/Disable', () => {
    test('should disable mocking when disabled', async () => {
      mocker.get('/test', { mocked: true });
      mocker.disable();

      mockFetch.mockResolvedValueOnce(new Response('{"original": true}'));

      await fetch('/test');

      expect(mockFetch).toHaveBeenCalledWith('/test', undefined);
    });

    test('should re-enable mocking', async () => {
      mocker.get('/test', { mocked: true });
      mocker.disable();
      mocker.enable();

      const response = await fetch('/test');
      const data = await response.json();

      expect(data).toEqual({ mocked: true });
    });
  });

  describe('Management', () => {
    test('should clear all endpoints and state', async () => {
      mocker.get('/test1', { data: 1 });
      mocker.setState('testKey', 'testValue');

      mocker.clear();

      expect(mocker.getState()).toEqual({});

      mockFetch.mockResolvedValue(new Response('{"original": true}'));

      await fetch('/test1');
      expect(mockFetch).toHaveBeenCalled();
    });

    test('should remove specific endpoint', async () => {
      mocker.get('/test1', { data: 1 });
      mocker.get('/test2', { data: 2 });

      mocker.remove('GET', '/test1');

      const response2 = await fetch('/test2');
      const data2 = await response2.json();
      expect(data2).toEqual({ data: 2 });

      mockFetch.mockResolvedValue(new Response('{"original": true}'));
      await fetch('/test1');
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});

describe('ApiMocker environment requirements', () => {
  test('should throw a helpful error when fetch is unavailable', () => {
    const existingFetch = (global as any).fetch;
    (global as any).fetch = undefined;

    expect(() => new ApiMocker({ logRequests: false })).toThrow(
      'ApiMocker requires a global fetch implementation. Please provide a fetch polyfill before creating an ApiMocker instance.'
    );

    (global as any).fetch = existingFetch;
  });
});
