---
inclusion: always
---

# Coding Standards

## TypeScript Best Practices

### Type Definitions

Always define explicit types:

```typescript
// ✅ Correct - explicit types
interface User {
  id: string
  email: string
  role: 'admin' | 'user'
  createdAt: Date
}

function getUser(id: string): Promise<User> {
  // Implementation
}

// ❌ Wrong - implicit any
function getUser(id) {
  // Implementation
}

// ❌ Wrong - overly generic
function getUser(id: string): Promise<any> {
  // Implementation
}
```

### Union Types vs Enums

Prefer union types for simple cases:

```typescript
// ✅ Correct - union type
type MessageStatus = 'pending' | 'sent' | 'failed'

// ✅ Also correct - enum for complex cases
enum UserRole {
  Admin = 'admin',
  User = 'user',
  Guest = 'guest'
}

// ❌ Wrong - string literals without type
const status = 'pending' // type is string, not 'pending'
```

### Generics

Use generics for reusable components and functions:

```typescript
// ✅ Correct - generic component
interface ListProps<T> {
  items: T[]
  renderItem: (item: T) => React.ReactNode
}

function List<T extends { id: string }>({ items, renderItem }: ListProps<T>) {
  return <ul>{items.map(item => <li key={item.id}>{renderItem(item)}</li>)}</ul>
}

// ✅ Correct - generic service
class Repository<T> {
  async getById(id: string): Promise<T> {
    // Implementation
  }
}
```

### Avoid `any`

Never use `any` - use `unknown` if needed:

```typescript
// ✅ Correct - use unknown
function handleError(error: unknown) {
  if (error instanceof Error) {
    console.error(error.message)
  } else {
    console.error('Unknown error')
  }
}

// ❌ Wrong - any bypasses type checking
function handleError(error: any) {
  console.error(error.message) // Could crash
}
```

## Naming Conventions

### Variables and Functions

Use camelCase:

```typescript
// ✅ Correct
const userName = 'John'
const isLoading = false
function getUserById(id: string) {}
const handleSubmit = () => {}

// ❌ Wrong
const user_name = 'John'
const IsLoading = false
function get_user_by_id(id: string) {}
const HandleSubmit = () => {}
```

### Constants

Use UPPER_SNAKE_CASE for constants:

```typescript
// ✅ Correct
const MAX_RETRIES = 3
const API_TIMEOUT = 5000
const DEFAULT_PAGE_SIZE = 20

// ❌ Wrong
const maxRetries = 3
const apiTimeout = 5000
```

### Classes and Interfaces

Use PascalCase:

```typescript
// ✅ Correct
class UserService {}
interface UserProps {}
type UserData = {}

// ❌ Wrong
class userService {}
interface userProps {}
```

### Boolean Variables

Prefix with `is`, `has`, `can`, `should`:

```typescript
// ✅ Correct
const isLoading = false
const hasError = true
const canDelete = true
const shouldRetry = false

// ❌ Wrong
const loading = false
const error = true
const delete = true
```

### Event Handlers

Prefix with `handle`:

```typescript
// ✅ Correct
const handleClick = () => {}
const handleSubmit = (e: FormEvent) => {}
const handleChange = (value: string) => {}

// ❌ Wrong
const onClick = () => {}
const onSubmit = (e: FormEvent) => {}
const onChange = (value: string) => {}
```

## Error Handling

### Try-Catch Pattern

Always wrap async operations:

```typescript
// ✅ Correct
async function fetchUser(id: string) {
  try {
    const response = await api.get(`/users/${id}`)
    return response.data
  } catch (error) {
    if (error instanceof AxiosError) {
      logger.error('Failed to fetch user', { id, status: error.response?.status })
      throw new Error(`User not found: ${error.message}`)
    }
    throw error
  }
}

// ❌ Wrong - no error handling
async function fetchUser(id: string) {
  const response = await api.get(`/users/${id}`)
  return response.data
}
```

### Error Messages

Provide context in error messages:

```typescript
// ✅ Correct - descriptive error
throw new Error(`Failed to send message to ${phoneNumber}: Invalid format`)

// ❌ Wrong - vague error
throw new Error('Error')
```

### Logging Errors

Always log with context:

```typescript
// ✅ Correct
logger.error('Failed to process webhook', {
  webhookId: webhook.id,
  userId: webhook.userId,
  eventType: event.type,
  error: error.message,
  stack: error.stack
})

// ❌ Wrong - no context
logger.error(error)
```

## Code Organization

### File Size

Keep files focused and under 300 lines:

```
✅ UserService.js (150 lines) - Single responsibility
✅ UserForm.tsx (200 lines) - One component
❌ UserModule.js (800 lines) - Too many responsibilities
```

### Function Size

Keep functions under 50 lines:

```typescript
// ✅ Correct - focused function
function validateEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(email)
}

// ❌ Wrong - too many responsibilities
function processUser(user: any) {
  // Validate
  // Transform
  // Save to DB
  // Send email
  // Log
  // ... 100+ lines
}
```

### Import Organization

Group imports logically:

```typescript
// ✅ Correct order
// 1. External libraries
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

// 2. Internal components
import { Button } from '@/components/ui/button'
import { UserForm } from '@/components/user/UserForm'

// 3. Internal services
import { userService } from '@/services/user'

// 4. Internal types
import type { User } from '@/types/user'

// 5. Internal utilities
import { formatDate } from '@/lib/date'
```

## Comments and Documentation

### When to Comment

Comment the "why", not the "what":

```typescript
// ✅ Correct - explains why
// Retry with exponential backoff to handle rate limiting
async function fetchWithRetry(url: string, maxRetries = 3) {
  // Implementation
}

// ❌ Wrong - explains what (obvious from code)
// Get the user from the API
const user = await api.get('/users/1')
```

### JSDoc for Public APIs

```typescript
/**
 * Sends a message to a WhatsApp contact
 * @param phoneNumber - The recipient's phone number (format: 55XXXXXXXXX)
 * @param text - The message text (max 4096 characters)
 * @param variables - Optional template variables for substitution
 * @returns Promise resolving to the sent message
 * @throws Error if phone number is invalid or message sending fails
 */
export async function sendMessage(
  phoneNumber: string,
  text: string,
  variables?: Record<string, string>
): Promise<Message> {
  // Implementation
}
```

## Testing

### Test File Naming

```
✅ user.test.ts
✅ UserService.test.js
✅ useAuth.test.ts

❌ user_test.ts
❌ userTest.ts
```

### Test Structure

```typescript
describe('UserService', () => {
  describe('getUser', () => {
    it('should return user by id', async () => {
      // Arrange
      const userId = '123'
      
      // Act
      const user = await UserService.getUser(userId)
      
      // Assert
      expect(user.id).toBe(userId)
    })

    it('should throw error if user not found', async () => {
      // Arrange
      const userId = 'invalid'
      
      // Act & Assert
      await expect(UserService.getUser(userId)).rejects.toThrow()
    })
  })
})
```

## Performance

### Avoid Unnecessary Re-renders

```typescript
// ✅ Correct - memoized component
const UserCard = React.memo(({ user }: { user: User }) => {
  return <div>{user.name}</div>
})

// ✅ Correct - useCallback for handlers
const handleClick = useCallback(() => {
  // Implementation
}, [dependency])

// ❌ Wrong - inline function causes re-renders
<Button onClick={() => handleClick()} />
```

### Lazy Loading

```typescript
// ✅ Correct - code splitting
const AdminPanel = lazy(() => import('@/components/admin/AdminPanel'))

// ✅ Correct - with Suspense
<Suspense fallback={<Loading />}>
  <AdminPanel />
</Suspense>
```

## Security

### Input Validation

Always validate user input:

```typescript
// ✅ Correct - validate before use
const email = validateEmail(userInput)
const phoneNumber = validatePhoneNumber(userInput)

// ❌ Wrong - trust user input
const email = userInput
```

### Sanitize HTML

Use DOMPurify for user-generated HTML:

```typescript
import DOMPurify from 'dompurify'

// ✅ Correct - sanitize before rendering
const cleanHtml = DOMPurify.sanitize(userHtml)
return <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />

// ❌ Wrong - XSS vulnerability
return <div dangerouslySetInnerHTML={{ __html: userHtml }} />
```

### Environment Variables

Never commit secrets:

```typescript
// ✅ Correct - use env variables
const apiKey = import.meta.env.VITE_API_KEY

// ❌ Wrong - hardcoded secret
const apiKey = 'sk_live_abc123xyz'
```

## Consistency

### Semicolons

Use semicolons consistently:

```typescript
// ✅ Consistent
const name = 'John';
const age = 30;
function greet() {
  console.log('Hello');
}

// ❌ Inconsistent
const name = 'John'
const age = 30;
function greet() {
  console.log('Hello')
}
```

### Quotes

Use single quotes for strings:

```typescript
// ✅ Correct
const message = 'Hello world'
const template = `Hello ${name}`

// ❌ Wrong
const message = "Hello world"
```

### Indentation

Use 2 spaces:

```typescript
// ✅ Correct
function example() {
  if (true) {
    console.log('Hello')
  }
}

// ❌ Wrong - 4 spaces
function example() {
    if (true) {
        console.log('Hello')
    }
}
```

## Git Commit Messages

Follow conventional commits:

```
✅ feat: add user authentication
✅ fix: resolve message sending bug
✅ docs: update API documentation
✅ refactor: simplify UserService
✅ test: add tests for webhook validation
✅ chore: update dependencies

❌ fixed bug
❌ updated code
❌ changes
```

## Code Review Checklist

Before submitting code:

- [ ] TypeScript types are explicit (no `any`)
- [ ] Error handling is present (try-catch, error logging)
- [ ] Functions are under 50 lines
- [ ] Files are under 300 lines
- [ ] Naming follows conventions (camelCase, PascalCase, UPPER_SNAKE_CASE)
- [ ] Comments explain "why", not "what"
- [ ] No hardcoded secrets or sensitive data
- [ ] Tests are included for new features
- [ ] No console.log statements (use logger)
- [ ] Imports are organized and use `@/` alias (frontend)
- [ ] Security best practices followed (validation, sanitization)
- [ ] Performance optimizations applied (memoization, lazy loading)
