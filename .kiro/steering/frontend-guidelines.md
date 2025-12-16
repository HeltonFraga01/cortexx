---
inclusion: fileMatch
fileMatchPattern: 'src/**/*.tsx'
---

# Frontend Guidelines

## Component Structure

All React components follow this pattern:

```typescript
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/useToast'
import type { ComponentProps } from '@/types/component'

interface MyComponentProps {
  title: string
  onSubmit?: (data: any) => void
}

export function MyComponent({ title, onSubmit }: MyComponentProps) {
  // 1. Hooks first
  const [state, setState] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  // 2. Event handlers
  const handleClick = () => {
    setState('new value')
  }

  const handleSubmit = async () => {
    try {
      setIsLoading(true)
      await onSubmit?.({ state })
      toast({ title: 'Success', description: 'Operation completed' })
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 3. Effects
  useEffect(() => {
    // Initialization logic
  }, [])

  // 4. Render
  return (
    <div className="space-y-4">
      <h1>{title}</h1>
      <Button onClick={handleClick} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Click me'}
      </Button>
    </div>
  )
}
```

**Component Checklist:**
- ✅ Props interface defined
- ✅ Hooks at top (useState, useContext, custom hooks)
- ✅ Event handlers after hooks
- ✅ Effects after handlers
- ✅ JSX render at bottom
- ✅ Loading states managed
- ✅ Error handling with toast notifications
- ✅ Proper TypeScript types

## Component Organization

**By role:**
- `src/components/admin/` - Admin-only UI
- `src/components/user/` - User-only UI
- `src/components/shared/` - Shared across roles

**By domain:**
- `src/components/features/messaging/` - Message-related components
- `src/components/features/webhooks/` - Webhook-related components
- `src/components/features/database/` - Database navigation

**Naming:**
```
✅ UserDashboard.tsx
✅ MessageForm.tsx
✅ WebhookList.tsx
✅ DatabaseTable.tsx

❌ user-dashboard.tsx
❌ message_form.tsx
❌ webhookList.tsx
```

## Forms with React Hook Form + Zod

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

const formSchema = z.object({
  email: z.string().email('Invalid email'),
  message: z.string().min(1, 'Message required').max(4096),
  phoneNumber: z.string().regex(/^\d{10,15}$/, 'Invalid phone number')
})

type FormData = z.infer<typeof formSchema>

interface MessageFormProps {
  onSubmit: (data: FormData) => Promise<void>
}

export function MessageForm({ onSubmit }: MessageFormProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      message: '',
      phoneNumber: ''
    }
  })

  const handleSubmit = async (data: FormData) => {
    try {
      await onSubmit(data)
      form.reset()
    } catch (error) {
      form.setError('root', { message: 'Failed to send message' })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="user@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <textarea {...field} className="w-full p-2 border rounded" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Sending...' : 'Send'}
        </Button>
      </form>
    </Form>
  )
}
```

## API Client Services

Create service abstractions for API calls:

```typescript
// src/services/api-client.ts
import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
})

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default apiClient

// src/services/message.ts
import apiClient from './api-client'
import type { Message, SendMessageRequest } from '@/types/message'

export const messageService = {
  async sendMessage(data: SendMessageRequest): Promise<Message> {
    const response = await apiClient.post('/api/user/messages/send', data)
    return response.data.data
  },

  async getMessages(page = 1, limit = 20) {
    const response = await apiClient.get('/api/user/messages', {
      params: { page, limit }
    })
    return response.data.data
  },

  async deleteMessage(id: string) {
    await apiClient.delete(`/api/user/messages/${id}`)
  }
}
```

**Service Usage in Components:**
```typescript
import { messageService } from '@/services/message'
import { useQuery, useMutation } from '@tanstack/react-query'

export function MessageList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['messages'],
    queryFn: () => messageService.getMessages()
  })

  const sendMutation = useMutation({
    mutationFn: messageService.sendMessage,
    onSuccess: () => {
      // Refetch messages
      queryClient.invalidateQueries({ queryKey: ['messages'] })
    }
  })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      {data?.map(msg => (
        <div key={msg.id}>{msg.text}</div>
      ))}
    </div>
  )
}
```

## State Management

**Global state with Context:**
```typescript
// src/contexts/AuthContext.tsx
import { createContext, useContext, ReactNode } from 'react'

interface User {
  id: string
  email: string
  role: 'admin' | 'user'
}

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Implementation
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
```

**Server state with TanStack Query:**
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export function useMessages() {
  return useQuery({
    queryKey: ['messages'],
    queryFn: () => messageService.getMessages()
  })
}

export function useSendMessage() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: messageService.sendMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] })
    }
  })
}
```

## Custom Hooks

Create reusable hooks for common logic:

```typescript
// src/hooks/useAsync.ts
import { useState, useEffect } from 'react'

interface UseAsyncState<T> {
  data: T | null
  isLoading: boolean
  error: Error | null
}

export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  immediate = true
): UseAsyncState<T> {
  const [state, setState] = useState<UseAsyncState<T>>({
    data: null,
    isLoading: immediate,
    error: null
  })

  useEffect(() => {
    if (!immediate) return

    let isMounted = true

    asyncFunction()
      .then(data => {
        if (isMounted) {
          setState({ data, isLoading: false, error: null })
        }
      })
      .catch(error => {
        if (isMounted) {
          setState({ data: null, isLoading: false, error })
        }
      })

    return () => {
      isMounted = false
    }
  }, [asyncFunction, immediate])

  return state
}
```

## Pagination

All list views MUST implement pagination:

```typescript
import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface PaginatedListProps {
  items: any[]
  totalPages: number
  currentPage: number
  onPageChange: (page: number) => void
}

export function PaginatedList({ items, totalPages, currentPage, onPageChange }: PaginatedListProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="p-2 border rounded">
            {item.name}
          </div>
        ))}
      </div>

      <div className="flex gap-2 justify-center">
        <Button 
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          Previous
        </Button>
        
        <span className="px-4 py-2">
          Page {currentPage} of {totalPages}
        </span>
        
        <Button 
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
```

## Import Paths

**ALWAYS use `@/` alias:**

```typescript
// ✅ Correct
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import type { User } from '@/types/user'
import { messageService } from '@/services/message'

// ❌ Wrong - never use relative paths
import { Button } from '../../../components/ui/button'
import { useAuth } from '../../hooks/useAuth'
```

## Error Handling

Use toast notifications for user feedback:

```typescript
import { useToast } from '@/hooks/useToast'

export function MyComponent() {
  const { toast } = useToast()

  const handleAction = async () => {
    try {
      await someAsyncOperation()
      toast({
        title: 'Success',
        description: 'Operation completed successfully',
        variant: 'default'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    }
  }

  return <button onClick={handleAction}>Do something</button>
}
```

## TypeScript Types

Define types in `src/types/`:

```typescript
// src/types/message.ts
export interface Message {
  id: string
  userId: string
  phoneNumber: string
  text: string
  status: 'pending' | 'sent' | 'failed'
  createdAt: string
  updatedAt: string
}

export interface SendMessageRequest {
  phoneNumber: string
  text: string
  variables?: Record<string, string>
}

export interface MessageListResponse {
  data: Message[]
  total: number
  page: number
  limit: number
}
```

## Accessibility

- Use semantic HTML (`<button>`, `<form>`, `<nav>`)
- Include `aria-label` for icon-only buttons
- Ensure color contrast meets WCAG standards
- Test with keyboard navigation
- Use shadcn/ui components (already accessible)

## Performance

- Use `React.memo()` for expensive components
- Implement code splitting with `React.lazy()`
- Use `useCallback()` for event handlers passed to memoized components
- Avoid inline object/array creation in render
- Use TanStack Query for efficient data fetching
