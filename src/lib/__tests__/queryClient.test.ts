/**
 * QueryClient Configuration Tests (Task 6.1)
 * Tests for TanStack Query client configuration
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { queryClient } from '../queryClient'

describe('QueryClient Configuration', () => {
  beforeEach(() => {
    queryClient.clear()
  })

  describe('Default Options', () => {
    it('should have staleTime of 30 seconds', () => {
      const defaults = queryClient.getDefaultOptions()
      expect(defaults.queries?.staleTime).toBe(30 * 1000)
    })

    it('should have gcTime of 5 minutes', () => {
      const defaults = queryClient.getDefaultOptions()
      expect(defaults.queries?.gcTime).toBe(5 * 60 * 1000)
    })

    it('should disable refetchOnWindowFocus', () => {
      const defaults = queryClient.getDefaultOptions()
      expect(defaults.queries?.refetchOnWindowFocus).toBe(false)
    })

    it('should enable refetchOnReconnect', () => {
      const defaults = queryClient.getDefaultOptions()
      expect(defaults.queries?.refetchOnReconnect).toBe('always')
    })
  })

  describe('Retry Logic', () => {
    it('should have retry function defined', () => {
      const defaults = queryClient.getDefaultOptions()
      expect(typeof defaults.queries?.retry).toBe('function')
    })

    it('should not retry on 4xx errors (except 408)', () => {
      const defaults = queryClient.getDefaultOptions()
      const retry = defaults.queries?.retry as (failureCount: number, error: Error) => boolean

      // Create error with status property
      const error400 = Object.assign(new Error('Bad Request'), { status: 400 })
      const error401 = Object.assign(new Error('Unauthorized'), { status: 401 })
      const error403 = Object.assign(new Error('Forbidden'), { status: 403 })
      const error404 = Object.assign(new Error('Not Found'), { status: 404 })

      expect(retry(1, error400)).toBe(false)
      expect(retry(1, error401)).toBe(false)
      expect(retry(1, error403)).toBe(false)
      expect(retry(1, error404)).toBe(false)
    })

    it('should retry on 408 Request Timeout', () => {
      const defaults = queryClient.getDefaultOptions()
      const retry = defaults.queries?.retry as (failureCount: number, error: Error) => boolean

      const error408 = Object.assign(new Error('Request Timeout'), { status: 408 })
      expect(retry(1, error408)).toBe(true)
    })

    it('should retry on 5xx errors up to 3 times', () => {
      const defaults = queryClient.getDefaultOptions()
      const retry = defaults.queries?.retry as (failureCount: number, error: Error) => boolean

      const error500 = Object.assign(new Error('Server Error'), { status: 500 })
      
      expect(retry(1, error500)).toBe(true)
      expect(retry(2, error500)).toBe(true)
      expect(retry(3, error500)).toBe(false)
    })

    it('should retry on network errors', () => {
      const defaults = queryClient.getDefaultOptions()
      const retry = defaults.queries?.retry as (failureCount: number, error: Error) => boolean

      const networkError = new Error('Network Error')
      
      expect(retry(1, networkError)).toBe(true)
      expect(retry(2, networkError)).toBe(true)
    })
  })

  describe('Retry Delay', () => {
    it('should have exponential backoff', () => {
      const defaults = queryClient.getDefaultOptions()
      const retryDelay = defaults.queries?.retryDelay as (attemptIndex: number) => number

      // First retry: 1000ms
      expect(retryDelay(0)).toBe(1000)
      // Second retry: 2000ms
      expect(retryDelay(1)).toBe(2000)
      // Third retry: 4000ms
      expect(retryDelay(2)).toBe(4000)
    })

    it('should cap retry delay at 30 seconds', () => {
      const defaults = queryClient.getDefaultOptions()
      const retryDelay = defaults.queries?.retryDelay as (attemptIndex: number) => number

      // Very high attempt index should still cap at 30s
      expect(retryDelay(10)).toBe(30000)
      expect(retryDelay(20)).toBe(30000)
    })
  })

  describe('Mutation Options', () => {
    it('should retry mutations once', () => {
      const defaults = queryClient.getDefaultOptions()
      expect(defaults.mutations?.retry).toBe(1)
    })
  })

  describe('Query Cache', () => {
    it('should be able to set and get query data', () => {
      const testData = { id: 1, name: 'Test' }
      queryClient.setQueryData(['test'], testData)
      
      const data = queryClient.getQueryData(['test'])
      expect(data).toEqual(testData)
    })

    it('should be able to invalidate queries', async () => {
      queryClient.setQueryData(['test'], { id: 1 })
      
      await queryClient.invalidateQueries({ queryKey: ['test'] })
      
      const state = queryClient.getQueryState(['test'])
      expect(state?.isInvalidated).toBe(true)
    })

    it('should be able to clear all queries', () => {
      queryClient.setQueryData(['test1'], { id: 1 })
      queryClient.setQueryData(['test2'], { id: 2 })
      
      queryClient.clear()
      
      expect(queryClient.getQueryData(['test1'])).toBeUndefined()
      expect(queryClient.getQueryData(['test2'])).toBeUndefined()
    })
  })
})
