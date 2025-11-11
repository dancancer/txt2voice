/**
 * 缓存工具
 * 提供简单的内存缓存功能
 */

import { CONFIG } from './constants'

interface CacheEntry<T> {
  value: T
  expiry: number
}

class Cache<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map()
  private maxSize: number
  private defaultTTL: number

  constructor(maxSize = CONFIG.CACHE.MAX_ITEMS, defaultTTL = CONFIG.CACHE.TTL) {
    this.maxSize = maxSize
    this.defaultTTL = defaultTTL
  }

  set(key: string, value: T, ttl?: number): void {
    // 清理过期条目
    this.cleanup()

    // 如果达到最大容量，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    const expiry = Date.now() + (ttl || this.defaultTTL)
    this.cache.set(key, { value, expiry })
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return undefined
    }

    // 检查是否过期
    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      return undefined
    }

    return entry.value
  }

  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    this.cleanup()
    return this.cache.size
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key)
      }
    }
  }
}

// 全局缓存实例
const globalCache = new Cache()

/**
 * 缓存装饰器函数
 * 自动缓存异步函数的结果
 */
export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const cached = globalCache.get(key)
  if (cached !== undefined) {
    return cached as T
  }

  const data = await fetcher()
  globalCache.set(key, data, ttl)
  return data
}

/**
 * 生成缓存键
 */
export function generateCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}:${parts.join(':')}`
}

export { Cache, globalCache }
