# ConnectionCache Service

A simple in-memory cache service for storing database connections and user records with TTL (Time To Live) support.

## Features

- **TTL Support**: Automatic expiration of cached data
- **Pattern Invalidation**: Remove multiple cache entries matching a regex pattern
- **Type-Safe**: Full TypeScript support with generics
- **Singleton Pattern**: Single shared instance across the application

## Usage

### Basic Operations

```typescript
import { connectionCache } from '@/services/cache/connectionCache';

// Store data with default TTL (5 minutes)
connectionCache.set('user-connections:abc123', connections);

// Store data with custom TTL (2 minutes)
connectionCache.set('user-record:abc123:1', record, 120000);

// Retrieve data
const cached = connectionCache.get('user-connections:abc123');

// Remove specific entry
connectionCache.invalidate('user-record:abc123:1');

// Remove all entries matching pattern
connectionCache.invalidatePattern(/^user-record:abc123:/);

// Clear all cache
connectionCache.clear();
```

### Integration with DatabaseConnectionsService

```typescript
import { connectionCache } from '@/services/cache/connectionCache';
import { databaseConnectionsService } from '@/services/database-connections';

// Cache user connections
async function getUserConnections(userToken: string) {
  const cacheKey = `user-connections:${userToken}`;
  
  // Try cache first
  const cached = connectionCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Fetch from API
  const connections = await databaseConnectionsService.getUserConnections(userToken);
  
  // Cache for 5 minutes
  connectionCache.set(cacheKey, connections, 300000);
  
  return connections;
}

// Invalidate cache after update
async function updateUserRecord(userToken: string, connectionId: number, recordId: string, data: any) {
  await databaseConnectionsService.updateUserTableRecord(userToken, connectionId, recordId, data);
  
  // Invalidate the cached record
  connectionCache.invalidate(`user-record:${userToken}:${connectionId}`);
}
```

### Cache Key Conventions

- User connections: `user-connections:{userToken}`
- User records: `user-record:{userToken}:{connectionId}`
- Connection details: `connection:{connectionId}`

### TTL Recommendations

- User connections: 5 minutes (300000ms) - default
- User records: 2 minutes (120000ms)
- Connection metadata: 10 minutes (600000ms)

## API Reference

### `set<T>(key: string, data: T, ttl?: number): void`
Store data in cache with optional TTL (default: 5 minutes).

### `get<T>(key: string): T | null`
Retrieve data from cache. Returns null if not found or expired.

### `invalidate(key: string): void`
Remove a specific entry from cache.

### `invalidatePattern(pattern: RegExp): void`
Remove all entries matching a regex pattern.

### `clear(): void`
Clear all cached data.

### `size(): number`
Get the number of entries in cache.

### `has(key: string): boolean`
Check if a key exists in cache (regardless of expiration).

### `keys(): string[]`
Get all cache keys.

## Testing

Run tests with:
```bash
npm test -- src/services/cache/connectionCache.test.ts --run
```

All tests cover:
- Basic storage and retrieval
- TTL expiration
- Invalidation (single and pattern-based)
- Real-world usage scenarios
