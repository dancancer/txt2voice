// 一旦我被更新，请更新我的开头注释
// input: 路径场景样本
// output: 路径解析断言
// pos: 单元测试
import { mkdirSync, writeFileSync } from 'fs'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join, normalize } from 'path'
import {
  buildAudioFilePathCandidates,
  resolveExistingAudioFilePath
} from '../storage-path'

describe('storage-path', () => {
  const originalUploadDir = process.env.UPLOAD_DIR
  const originalAudioDir = process.env.AUDIO_DIR

  afterEach(async () => {
    process.env.UPLOAD_DIR = originalUploadDir
    process.env.AUDIO_DIR = originalAudioDir
  })

  it('should include remapped candidate for docker absolute path', () => {
    process.env.UPLOAD_DIR = '/tmp/txt2voice-uploads'

    const candidates = buildAudioFilePathCandidates({
      filePath: '/app/apps/web/uploads/audio/book-1/demo.mp3',
      fileName: 'demo.mp3',
      bookId: 'book-1'
    })

    expect(candidates).toContain(normalize('/tmp/txt2voice-uploads/audio/book-1/demo.mp3'))
  })

  it('should resolve existing file from remapped path', async () => {
    const root = await mkdtemp(join(tmpdir(), 'txt2voice-uploads-'))
    process.env.UPLOAD_DIR = root

    const targetPath = join(root, 'audio', 'book-2', 'voice.mp3')
    mkdirSync(join(root, 'audio', 'book-2'), { recursive: true })
    writeFileSync(targetPath, 'ok')

    const resolved = resolveExistingAudioFilePath({
      filePath: '/app/apps/web/uploads/audio/book-2/voice.mp3',
      fileName: 'voice.mp3',
      bookId: 'book-2'
    })

    expect(resolved).toBe(normalize(targetPath))

    await rm(root, { recursive: true, force: true })
  })
})
