/**
 * API 速率限制器
 * 防止 DDoS 攻击和滥用
 */

import { NextRequest, NextResponse } from 'next/server'
import { CONFIG, ERROR_CODES } from './constants'

interface RateLimitOptions {
  interval?: number // 时间窗口（毫秒）
  uniqueTokenPerInterval?: number // 最大唯一令牌数
  maxRequests?: number // 每个令牌的最大请求数
}

class RateLimiter {
  private tokenCache: Map<string, { count: number; resetTime: number }>
  private interval: number
  private maxRequests: number
  private uniqueTokenPerInterval: number

  constructor(options: RateLimitOptions = {}) {
    this.tokenCache = new Map()
    this.interval = options.interval || CONFIG.RATE_LIMIT.WINDOW_MS
    this.maxRequests = options.maxRequests || CONFIG.RATE_LIMIT.MAX_REQUESTS_PER_IP
    this.uniqueTokenPerInterval = options.uniqueTokenPerInterval || CONFIG.RATE_LIMIT.UNIQUE_TOKENS
  }

  check(token: string): { success: boolean; remaining: number; resetTime: number } {
    const now = Date.now()
    const record = this.tokenCache.get(token)

    // 清理过期记录
    if (record && now > record.resetTime) {
      this.tokenCache.delete(token)
    }

    // 检查缓存大小
    if (this.tokenCache.size >= this.uniqueTokenPerInterval) {
      // 清理最旧的记录
      const oldestKey = Array.from(this.tokenCache.entries())
        .sort((a, b) => a[1].resetTime - b[1].resetTime)[0]?.[0]
      if (oldestKey) {
        this.tokenCache.delete(oldestKey)
      }
    }

    const currentRecord = this.tokenCache.get(token)

    if (!currentRecord) {
      // 新令牌
      const resetTime = now + this.interval
      this.tokenCache.set(token, { count: 1, resetTime })
      return { success: true, remaining: this.maxRequests - 1, resetTime }
    }

    if (currentRecord.count >= this.maxRequests) {
      // 超过限制
      return {
        success: false,
        remaining: 0,
        resetTime: currentRecord.resetTime,
      }
    }

    // 增加计数
    currentRecord.count++
    return {
      success: true,
      remaining: this.maxRequests - currentRecord.count,
      resetTime: currentRecord.resetTime,
    }
  }

  reset(token: string): void {
    this.tokenCache.delete(token)
  }

  clear(): void {
    this.tokenCache.clear()
  }
}

// 全局速率限制器实例
const globalLimiter = new RateLimiter()

// API 路由速率限制器
const apiLimiter = new RateLimiter({
  interval: CONFIG.RATE_LIMIT.WINDOW_MS,
  maxRequests: CONFIG.RATE_LIMIT.MAX_REQUESTS_PER_IP,
})

/**
 * 速率限制中间件
 */
export function withRateLimit(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>,
  options?: RateLimitOptions
) {
  const limiter = options ? new RateLimiter(options) : apiLimiter

  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    // 获取客户端标识（IP 地址或其他唯一标识）
    const token = getClientToken(request)

    // 检查速率限制
    const result = limiter.check(token)

    // 设置响应头
    const headers = {
      'X-RateLimit-Limit': String(limiter['maxRequests']),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(result.resetTime),
    }

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            message: '请求过于频繁，请稍后再试',
            code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
            retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
          },
        },
        {
          status: 429,
          headers,
        }
      )
    }

    // 继续处理请求
    const response = await handler(request, ...args)

    // 添加速率限制头到响应
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  }
}

/**
 * 获取客户端唯一标识
 */
function getClientToken(request: NextRequest): string {
  // 优先使用 X-Forwarded-For
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  // 使用 X-Real-IP
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // 默认值
  return '127.0.0.1'
}

export { RateLimiter, globalLimiter, apiLimiter }
