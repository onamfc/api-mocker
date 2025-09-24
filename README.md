# API Mocker
A lightweight TypeScript library for mocking API endpoints during frontend development. Perfect for developing frontend applications before the backend is ready, or for testing different API scenarios.

## Features

- **Easy Integration**: Simple API that works with any HTTP client (fetch, axios, etc.)
- **TypeScript Support**: Full TypeScript support with type definitions
- **Flexible Matching**: Support for exact paths and dynamic parameters (`:id`)
- **Advanced Matching**: Match requests by query parameters, headers, or custom logic
- **Dynamic Responses**: Create responses with custom logic
- **Stateful Mocks**: Built-in state management for realistic CRUD operations
- **Network Error Simulation**: Simulate timeouts, connection errors, and aborts
- **Priority System**: Control which mock takes precedence with priority levels
- **Delay Simulation**: Simulate network delays for realistic testing
- **Request Logging**: Optional request logging for debugging
- **Easy Switching**: Simple enable/disable for switching to real APIs
-  **No Dependencies**: Zero runtime dependencies

## Requirements

- Node.js 18 or later for local development and testing (earlier versions must polyfill the Fetch API).
- Browsers or runtimes that expose `fetch`, `Request`, and `Response` globals. When targeting older environments, install a fetch polyfill before creating an `ApiMocker` instance.

## Installation

```bash
npm install @onamfc/api-mocker
```

## Quick Start Guide

### Step 1: Create Your Mock Setup File

Create a dedicated file for your API mocks. This keeps your mock configuration organized and separate from your main application code.

**Create `src/mocks/api-mocks.ts`**

```typescript
import { createMocker } from '@onamfc/api-mocker';

// Create the mocker instance
export const apiMocker = createMocker({
  baseUrl: 'https://api.yourapp.com', // Your API base URL
  logRequests: true, // Enable logging to see which requests are being mocked
  globalDelay: 500   // Add 500ms delay to all requests for realism
});

// Define your mock endpoints
export function setupMocks() {
  // Simple GET endpoint
  apiMocker.get('/users', [
    { id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'user' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'user' }
  ]);

  // Dynamic endpoint with parameters
  apiMocker.get('/users/:id', {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    role: 'admin',
    createdAt: '2023-01-15T10:30:00Z',
    lastLogin: '2024-01-20T14:22:00Z'
  });

  // POST endpoint with custom status
  apiMocker.post('/users', {
    id: 4,
    name: 'New User',
    email: 'newuser@example.com',
    role: 'user',
    createdAt: new Date().toISOString()
  }, {
    status: 201,
    delay: 1000 // Longer delay for POST requests
  });

  // PUT endpoint
  apiMocker.put('/users/:id', {
    id: 1,
    name: 'Updated User',
    email: 'updated@example.com',
    role: 'admin',
    updatedAt: new Date().toISOString()
  });

  // DELETE endpoint
  apiMocker.delete('/users/:id', {
    success: true,
    message: 'User deleted successfully'
  });
}
```

### Step 2: Initialize Mocks in Your Application

**For React Applications:**

> 💡 **Environment variable tips:** Create React App (and other Webpack-based builds) exposes values through `process.env`, while Vite exposes them via `import.meta.env`. Use the snippet that matches your toolchain so the browser build never tries to access an undefined `process` object.



**Create `src/mocks/index.ts`**

 For Create React App / Webpack projects:
```typescript
import { setupMocks, apiMocker } from './api-mocks';

const env = typeof process !== 'undefined' && process?.env ? process.env : {};

// Only enable mocks in development
const isDevelopment = env.NODE_ENV === 'development';
const useMocks = env.REACT_APP_USE_MOCKS === 'true' || isDevelopment;

if (useMocks) {
  console.log('API Mocking enabled');
  setupMocks();
} else {
  console.log('Using real API');
  apiMocker.disable();
}

export { apiMocker };
```

Or for Vite-powered React projects:

```typescript
import { setupMocks, apiMocker } from './api-mocks';

const env = import.meta.env;

// Only enable mocks in development
const isDevelopment = env.MODE === 'development' || env.DEV;
const useMocks = env.VITE_USE_MOCKS === 'true' || isDevelopment;

if (useMocks) {
  console.log('API Mocking enabled');
  setupMocks();
} else {
  console.log('Using real API');
  apiMocker.disable();
}

export { apiMocker };
```

Then in your `src/index.js` or `src/main.tsx`:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Import mocks BEFORE your app components
import './mocks';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
```

**For Vue Applications:**

Create `src/mocks/index.ts`:

```typescript
import { setupMocks, apiMocker } from './api-mocks';

export function initializeMocks() {
  const isDevelopment = import.meta.env.DEV;
  const useMocks = import.meta.env.VITE_USE_MOCKS === 'true' || isDevelopment;

  if (useMocks) {
    console.log('API Mocking enabled');
    setupMocks();
  } else {
    console.log('Using real API');
    apiMocker.disable();
  }
}
```

Then in your `src/main.js`:

```typescript
import { createApp } from 'vue';
import App from './App.vue';
import { initializeMocks } from './mocks';

// Initialize mocks before creating the app
initializeMocks();

createApp(App).mount('#app');
```

### Step 3: Use Your Regular HTTP Client

Now your existing API calls will automatically use the mocked responses:

```typescript
// This will use your mocked data automatically
async function fetchUsers() {
  try {
    const response = await fetch('https://api.yourapp.com/users');
    const users = await response.json();
    console.log('Users:', users); // Will log your mocked users
    return users;
  } catch (error) {
    console.error('Failed to fetch users:', error);
  }
}

// This will also work with dynamic parameters
async function fetchUser(id) {
  const response = await fetch(`https://api.yourapp.com/users/${id}`);
  return response.json();
}

// POST requests work too
async function createUser(userData) {
  const response = await fetch('https://api.yourapp.com/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  return response.json();
}
```

## API Reference

### `createMocker(config?: MockConfig)`

Factory helper that returns a new `ApiMocker` instance. Use this in your application bootstrap so you can easily share a configured mocker across modules.

### `ApiMocker`

The main class responsible for intercepting `fetch` calls.

- `mock(endpoint)` – Register a static endpoint. The `response` can be plain data, a `MockResponse` object (`{ data, status?, headers? }`), a native `Response`, or a function returning any of those (sync or async).
- `mockDynamic(endpoint)` – Register a dynamic endpoint whose `handler` receives a `RequestContext` with params, query, headers, parsed body, and shared state.
- `get`, `post`, `put`, `patch`, `delete` – Convenience wrappers around `mock` for common HTTP verbs.
- `enable()` / `disable()` – Toggle interception without removing registered mocks.
- `clear()` / `remove(method, path)` – Remove all mocks or a specific endpoint.
- `setState(key, value)` / `getState()` / `clearState()` – Manage shared in-memory state used by dynamic handlers.
- `updateConfig(partialConfig)` – Merge configuration updates at runtime (e.g., change `baseUrl`, add headers, adjust logging).
- `restore()` – Restore the original `fetch` implementation. Call this when you no longer need mocking (for example in test teardown).

### Endpoint Options

- `status`, `delay`, `headers`, `priority` – Control the returned HTTP status, simulated latency, custom headers, and selection priority between overlapping mocks.
- `queryParams`, `requestHeaders`, `match(request)` – Advanced matching rules to scope mocks to specific query strings, request headers, or arbitrary logic.
- `networkError` – Simulate network failures (`'timeout'`, `'connection_refused'`, or `'abort'`).
- `MockResponse` support lets you fine-tune `status` and `headers` on a per-response basis without mutating the endpoint definition.

## Advanced Usage Examples

### 1. Dynamic Responses with Custom Logic

```typescript
// Create a more realistic user endpoint that responds based on the ID
apiMocker.mockDynamic({
  path: '/users/:id',
  method: 'GET',
  handler: (context) => {
    const userId = parseInt(context.params.id);
    
    // Simulate user not found
    if (userId > 100) {
      throw new Error('User not found');
    }
    
    return {
      id: userId,
      name: `User ${userId}`,
      email: `user${userId}@example.com`,
      role: userId === 1 ? 'admin' : 'user',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
      createdAt: new Date(2023, 0, userId).toISOString(),
      isOnline: Math.random() > 0.5
    };
  }
});
```

### 2. Stateful CRUD Operations

Create `src/mocks/stateful-mocks.ts`:

```typescript
import { apiMocker } from './api-mocks';

let nextId = 4;

// Initialize some data
apiMocker.setState('users', [
  { id: 1, name: 'John Doe', email: 'john@example.com' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com' }
]);

export function setupStatefulMocks() {
  // GET all users - returns current state
  apiMocker.mockDynamic({
    path: '/users',
    method: 'GET',
    handler: (context) => {
      return context.state.users || [];
    }
  });

  // GET single user
  apiMocker.mockDynamic({
    path: '/users/:id',
    method: 'GET',
    handler: (context) => {
      const users = context.state.users || [];
      const user = users.find(u => u.id === parseInt(context.params.id));
      
      if (!user) {
        return { error: 'User not found' };
      }
      
      return user;
    },
    status: 200
  });

  // POST new user - adds to state
  apiMocker.mockDynamic({
    path: '/users',
    method: 'POST',
    handler: (context) => {
      const users = context.state.users || [];
      const newUser = {
        id: nextId++,
        ...context.body,
        createdAt: new Date().toISOString()
      };
      
      users.push(newUser);
      context.state.users = users;
      
      return newUser;
    },
    status: 201
  });

  // PUT update user - modifies state
  apiMocker.mockDynamic({
    path: '/users/:id',
    method: 'PUT',
    handler: (context) => {
      const users = context.state.users || [];
      const userIndex = users.findIndex(u => u.id === parseInt(context.params.id));
      
      if (userIndex === -1) {
        return { error: 'User not found' };
      }
      
      users[userIndex] = {
        ...users[userIndex],
        ...context.body,
        updatedAt: new Date().toISOString()
      };
      
      context.state.users = users;
      return users[userIndex];
    }
  });

  // DELETE user - removes from state
  apiMocker.mockDynamic({
    path: '/users/:id',
    method: 'DELETE',
    handler: (context) => {
      const users = context.state.users || [];
      const userIndex = users.findIndex(u => u.id === parseInt(context.params.id));
      
      if (userIndex === -1) {
        return { error: 'User not found' };
      }
      
      users.splice(userIndex, 1);
      context.state.users = users;
      
      return { success: true, message: 'User deleted' };
    }
  });
}
```

### 3. Advanced Request Matching

```typescript
// Match based on query parameters
apiMocker.mock({
  path: '/users',
  method: 'GET',
  response: [{ id: 1, name: 'Admin User', role: 'admin' }],
  queryParams: { role: 'admin' }
});

apiMocker.mock({
  path: '/users',
  method: 'GET',
  response: [
    { id: 2, name: 'Regular User 1', role: 'user' },
    { id: 3, name: 'Regular User 2', role: 'user' }
  ],
  queryParams: { role: 'user' }
});

// Match based on request headers
apiMocker.mock({
  path: '/api/data',
  method: 'GET',
  response: { format: 'json', data: [1, 2, 3] },
  requestHeaders: { 'Accept': 'application/json' }
});

// Custom matching logic
apiMocker.mock({
  path: '/protected',
  method: 'GET',
  response: { message: 'Access granted', data: 'secret' },
  match: (request) => {
    const authHeader = request.headers.get('Authorization');
    return authHeader && authHeader.startsWith('Bearer ');
  }
});
```

### 4. Error Simulation

```typescript
// HTTP error responses
apiMocker.get('/users/999', { error: 'User not found' }, {
  status: 404,
  delay: 300
});

apiMocker.post('/users', { error: 'Validation failed', details: ['Email is required'] }, {
  status: 400
});

// Network error simulation
apiMocker.mock({
  path: '/flaky-endpoint',
  method: 'GET',
  response: {},
  networkError: 'timeout' // Simulates network timeout
});

// Conditional errors
apiMocker.mockDynamic({
  path: '/unreliable',
  method: 'GET',
  handler: () => {
    // 30% chance of success, 70% chance of error
    if (Math.random() > 0.3) {
      throw new Error('Service temporarily unavailable');
    }
    return { status: 'success', data: 'Hello World' };
  }
});
```

## File Organization

Here's a recommended file structure for organizing your mocks:

```
src/
├── mocks/
│   ├── index.ts              # Main mock initialization
│   ├── api-mocks.ts          # Basic mock definitions
│   ├── stateful-mocks.ts     # Stateful CRUD operations
│   ├── error-mocks.ts        # Error scenarios
│   └── data/
│       ├── users.ts          # Mock user data
│       ├── products.ts       # Mock product data
│       └── orders.ts         # Mock order data
├── services/
│   ├── api.ts                # Your API service functions
│   └── userService.ts        # User-specific API calls
└── components/
    └── ...
```

**Example `src/mocks/data/users.ts`:**

```typescript
export const mockUsers = [
  {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    role: 'admin',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=1',
    createdAt: '2023-01-15T10:30:00Z',
    isActive: true
  },
  {
    id: 2,
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'user',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=2',
    createdAt: '2023-02-20T14:22:00Z',
    isActive: true
  },
  // ... more users
];

export const mockUserProfiles = {
  1: {
    bio: 'Software engineer with 10 years of experience',
    location: 'San Francisco, CA',
    website: 'https://johndoe.dev',
    socialLinks: {
      twitter: '@johndoe',
      linkedin: 'john-doe-dev'
    }
  },
  // ... more profiles
};
```

## Environment Configuration

### Using Environment Variables

Create a `.env` file in your project root:

```bash
# Development
REACT_APP_USE_MOCKS=true
REACT_APP_API_URL=https://api.yourapp.com

# For Vue projects, use VITE_ prefix
VITE_USE_MOCKS=true
VITE_API_URL=https://api.yourapp.com
```

### Conditional Mock Setup

```typescript
// src/mocks/index.ts (Create React App / Webpack)
import { setupMocks, setupStatefulMocks, apiMocker } from './api-mocks';

const env = typeof process !== 'undefined' && process?.env ? process.env : {};

const config = {
  // Enable mocks in development or when explicitly requested
  enabled: env.NODE_ENV === 'development' || env.REACT_APP_USE_MOCKS === 'true',

  // Use stateful mocks for more realistic testing
  stateful: env.REACT_APP_STATEFUL_MOCKS === 'true',

  // Add delays to simulate real network conditions
  realistic: env.REACT_APP_REALISTIC_DELAYS === 'true'
};

if (config.enabled) {
  console.log('Initializing API mocks...');

  // Configure the mocker
  apiMocker.updateConfig({
    baseUrl: env.REACT_APP_API_URL,
    logRequests: true,
    globalDelay: config.realistic ? 500 : 0
  });

  // Setup mocks
  if (config.stateful) {
    setupStatefulMocks();
  } else {
    setupMocks();
  }

  console.log('API mocks ready');
} else {
  console.log('Using real API endpoints');
  apiMocker.disable();
}
```

```typescript
// src/mocks/index.ts (Vite)
import { setupMocks, setupStatefulMocks, apiMocker } from './api-mocks';

const env = import.meta.env;

const config = {
  // Enable mocks in development or when explicitly requested
  enabled: env.DEV || env.MODE === 'development' || env.VITE_USE_MOCKS === 'true',

  // Use stateful mocks for more realistic testing
  stateful: env.VITE_STATEFUL_MOCKS === 'true',

  // Add delays to simulate real network conditions
  realistic: env.VITE_REALISTIC_DELAYS === 'true'
};

if (config.enabled) {
  console.log('Initializing API mocks...');

  // Configure the mocker
  apiMocker.updateConfig({
    baseUrl: env.VITE_API_URL,
    logRequests: true,
    globalDelay: config.realistic ? 500 : 0
  });

  // Setup mocks
  if (config.stateful) {
    setupStatefulMocks();
  } else {
    setupMocks();
  }

  console.log('API mocks ready');
} else {
  console.log('Using real API endpoints');
  apiMocker.disable();
}
```

## Migration to Real APIs

When you're ready to connect to real APIs, you have several options:

### 1. Disable All Mocks

```typescript
// Simply disable all mocking
apiMocker.disable();
```

### 2. Gradual Migration

```typescript
// Remove specific endpoints as real ones become available
apiMocker.remove('GET', '/users');
apiMocker.remove('POST', '/users');

// Keep other mocks active
// apiMocker.get('/products', mockProducts); // Still mocked
```

### 3. Environment-based Control

```typescript
// Use environment variables to control which endpoints are mocked (CRA / Webpack)
const env = typeof process !== 'undefined' && process?.env ? process.env : {};

const mockConfig = {
  users: env.REACT_APP_MOCK_USERS !== 'false',
  products: env.REACT_APP_MOCK_PRODUCTS !== 'false',
  orders: env.REACT_APP_MOCK_ORDERS !== 'false'
};

if (mockConfig.users) {
  setupUserMocks();
}

if (mockConfig.products) {
  setupProductMocks();
}

if (mockConfig.orders) {
  setupOrderMocks();
}
```

```typescript
// Use environment variables to control which endpoints are mocked (Vite)
const env = import.meta.env;

const mockConfig = {
  users: env.VITE_MOCK_USERS !== 'false',
  products: env.VITE_MOCK_PRODUCTS !== 'false',
  orders: env.VITE_MOCK_ORDERS !== 'false'
};

if (mockConfig.users) {
  setupUserMocks();
}

if (mockConfig.products) {
  setupProductMocks();
}

if (mockConfig.orders) {
  setupOrderMocks();
}
```

## API Reference

### Creating a Mocker

```typescript
import { ApiMocker, createMocker } from '@onamfc/api-mocker';

// Using the factory function (recommended)
const mocker = createMocker({
  baseUrl: 'https://api.example.com',
  globalDelay: 500,
  logRequests: true,
  globalHeaders: {
    'Content-Type': 'application/json',
    'X-Custom-Header': 'value'
  }
});

// Or using the class directly
const mocker = new ApiMocker(config);
```

### Configuration Options

```typescript
interface MockConfig {
  baseUrl?: string;           // Base URL to match against
  globalDelay?: number;       // Default delay for all requests (ms)
  globalHeaders?: Record<string, string>; // Default headers for all responses
  logRequests?: boolean;      // Enable/disable request logging
  defaultPriority?: number;   // Default priority for endpoints
}
```

### Adding Mock Endpoints

#### Static Responses

```typescript
// Using convenience methods
mocker
  .get('/users', [{ id: 1, name: 'John' }])
  .post('/users', { id: 2, name: 'Jane' })
  .put('/users/:id', { id: 1, name: 'Updated John' })
  .delete('/users/:id', { success: true });

// Using the generic mock method
mocker.mock({
  path: '/products',
  method: 'GET',
  response: [{ id: 1, name: 'Product 1' }],
  status: 200,
  delay: 1000,
  headers: { 'X-Total-Count': '1' }
});
```

#### Dynamic Responses

```typescript
// Enhanced dynamic response with full context
mocker.mockDynamic({
  path: '/users/:id',
  method: 'GET',
  handler: (context) => {
    const userId = context.params.id;
    const includeEmail = context.queryParams.include === 'email';
    const isAdmin = context.headers['x-user-role'] === 'admin';
    
    return {
      id: userId,
      name: `User ${userId}`,
      email: includeEmail ? `user${userId}@example.com` : undefined,
      role: isAdmin ? 'admin' : 'user',
      timestamp: new Date().toISOString()
    };
  },
  delay: 500
});

// Stateful dynamic response
mocker.mockDynamic({
  path: '/analytics/pageview',
  method: 'POST',
  handler: (context) => {
    // Initialize analytics if not exists
    if (!context.state.analytics) {
      context.state.analytics = { pageViews: 0, uniqueVisitors: new Set() };
    }
    
    const { page, userId } = context.body;
    context.state.analytics.pageViews++;
    context.state.analytics.uniqueVisitors.add(userId);
    
    return {
      page,
      totalViews: context.state.analytics.pageViews,
      uniqueVisitors: context.state.analytics.uniqueVisitors.size
    };
  }
});
```

### Managing Mocks

```typescript
// Enable/disable mocking
mocker.enable();
mocker.disable();

// Clear all mocks
mocker.clear();

// Remove specific mock
mocker.remove('GET', '/users');

// State management
mocker.setState('key', 'value');
const state = mocker.getState();
mocker.clearState();

// Restore original fetch
mocker.restore();

// Update configuration
mocker.updateConfig({
  logRequests: false,
  globalDelay: 1000
});
```

## Best Practices

1. **Organize Your Mocks**: Keep mock definitions in separate files organized by feature or endpoint
2. **Use Environment Variables**: Control mock behavior through environment variables
3. **Realistic Data**: Use realistic mock data that matches your actual API responses
4. **Test Error Scenarios**: Mock both success and error responses to test error handling
5. **Gradual Migration**: Disable mocks endpoint by endpoint as real APIs become available
6. **Type Safety**: Use TypeScript interfaces for your API responses

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

mocker.get('/users', [] as User[]);
```

7. **State Management**: Use stateful mocks for realistic CRUD operations
8. **Network Conditions**: Use delays and network errors to test under realistic conditions

## Troubleshooting

### Common Issues

**Mocks not working:**
- Check that mocks are initialized before your API calls
- Verify the `baseUrl` matches your API calls
- Ensure mocking is enabled (`mocker.enable()`)

**TypeScript errors:**
- Make sure you have proper type definitions for your mock data
- Use `as` assertions when needed for complex types

**State not persisting:**
- Remember that state is only maintained within the same session
- Use `mocker.setState()` to initialize state if needed

**Priority conflicts:**
- Use explicit priorities when you have overlapping endpoints
- More specific paths automatically get higher priority

## Development

```bash
npm install
npm test
npm run build
```

These commands run the Jest test suite (using the Node 18 runtime) and build the distributable bundles under `dist/`.

## Contributing

Issues and pull requests are welcome! Please visit the [GitHub repository](https://github.com/onamfc/api-mocker).
