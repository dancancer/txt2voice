/**
 * 输入验证 Schemas
 * 使用 Zod 进行类型安全的输入验证
 */

import { z } from 'zod'
import { CONFIG } from './constants'

// 书籍相关验证
export const CreateBookSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题不能超过200个字符'),
  author: z.string().max(100, '作者名不能超过100个字符').optional(),
})

export const UpdateBookSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  author: z.string().max(100).optional(),
  status: z.enum([
    'uploading',
    'uploaded',
    'processing',
    'processed',
    'analyzing',
    'analyzed',
    'generating_script',
    'script_generated',
    'generating_audio',
    'completed',
    'error',
  ]).optional(),
})

// 文本处理选项验证
export const TextProcessingOptionsSchema = z.object({
  maxSegmentLength: z.number().int().min(100).max(5000).optional(),
  minSegmentLength: z.number().int().min(10).max(500).optional(),
  preserveFormatting: z.boolean().optional().default(true),
})

// 音频生成选项验证
export const AudioGenerationOptionsSchema = z.object({
  provider: z.enum(['azure', 'openai', 'edge-tts']).optional(),
  outputFormat: z.enum(['mp3', 'wav', 'ogg']).optional().default('mp3'),
  speed: z.number().min(0.5).max(2.0).optional().default(1.0),
  skipExisting: z.boolean().optional().default(false),
  batchSize: z.number().int().min(1).max(20).optional(),
})

// 分页验证
export const PaginationSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(10),
})

// ID 验证
export const IdSchema = z.string().uuid('无效的ID格式')
