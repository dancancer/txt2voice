'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { booksApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  ArrowLeft,
  Play,
  Settings,
  Volume2,
  Mic,
  User,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  Zap,
  Download,
  RefreshCw,
  Users
} from 'lucide-react'

interface VoiceProvider {
  id: string
  name: string
  description: string
  icon: string
  isConfigured: boolean
}

interface VoiceProfile {
  id: string
  name: string
  provider: string
  voice: string
  language: string
  gender: string
  age: string
  style: string
}

const VOICE_PROVIDERS: VoiceProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI TTS',
    description: '高质量的语音合成，支持多种声音风格',
    icon: '🤖',
    isConfigured: process.env.NEXT_PUBLIC_OPENAI_CONFIGURED === 'true'
  },
  {
    id: 'azure',
    name: 'Azure Speech',
    description: '微软 Azure 语音服务，专业级语音合成',
    icon: '☁️',
    isConfigured: process.env.NEXT_PUBLIC_AZURE_CONFIGURED === 'true'
  },
  {
    id: 'edge',
    name: 'Edge TTS',
    description: '免费的浏览器内置语音合成',
    icon: '🌐',
    isConfigured: true
  }
]

export default function AudioGenerationPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const bookId = params.id as string
  const selectedCharacterId = searchParams.get('character')

  const [book, setBook] = useState<any>(null)
  const [characters, setCharacters] = useState<any[]>([])
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Audio generation state
  const [selectedProvider, setSelectedProvider] = useState<string>('edge')
  const [generationProgress, setGenerationProgress] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<string>('')

  // Voice configuration state
  const [characterVoices, setCharacterVoices] = useState<Record<string, string>>({})
  const [showVoiceConfig, setShowVoiceConfig] = useState(false)
  const [audioSettings, setAudioSettings] = useState({
    speed: 1.0,
    pitch: 1.0,
    volume: 1.0,
    outputFormat: 'mp3',
    quality: 'standard'
  })

  useEffect(() => {
    loadBookAndData()
  }, [bookId])

  const loadBookAndData = async () => {
    try {
      setLoading(true)
      const response = await booksApi.getBook(bookId)
      setBook(response.data)
      setCharacters(response.data.characterProfiles || [])

      // Load voice profiles
      await loadVoiceProfiles()

      // Initialize character voices if they exist
      const initialVoices: Record<string, string> = {}
      response.data.characterProfiles?.forEach((char: any) => {
        if (char.voiceBindings?.length > 0) {
          initialVoices[char.id] = char.voiceBindings[0].voiceProfileId
        }
      })
      setCharacterVoices(initialVoices)

    } catch (err) {
      console.error('Failed to load book data:', err)
      setError('加载音频配置失败')
    } finally {
      setLoading(false)
    }
  }

  const loadVoiceProfiles = async () => {
    // TODO: Implement voice profiles API
    // Mock data for now
    const mockProfiles: VoiceProfile[] = [
      {
        id: 'voice-1',
        name: '温柔女声',
        provider: 'edge',
        voice: 'zh-CN-XiaoxiaoNeural',
        language: 'zh-CN',
        gender: 'Female',
        age: 'Adult',
        style: 'Gentle'
      },
      {
        id: 'voice-2',
        name: '沉稳男声',
        provider: 'edge',
        voice: 'zh-CN-YunyangNeural',
        language: 'zh-CN',
        gender: 'Male',
        age: 'Adult',
        style: 'Calm'
      },
      {
        id: 'voice-3',
        name: '活泼童声',
        provider: 'edge',
        voice: 'zh-CN-XiaoyiNeural',
        language: 'zh-CN',
        gender: 'Female',
        age: 'Child',
        style: 'Cheerful'
      }
    ]
    setVoiceProfiles(mockProfiles)
  }

  const handleCharacterVoiceChange = (characterId: string, voiceProfileId: string) => {
    setCharacterVoices(prev => ({
      ...prev,
      [characterId]: voiceProfileId
    }))
  }

  const handleSaveVoiceConfiguration = async () => {
    try {
      // TODO: Implement save voice configuration API
      console.log('Saving voice configuration:', characterVoices)
      setShowVoiceConfig(false)
      alert('语音配置已保存')
    } catch (error) {
      console.error('Failed to save voice configuration:', error)
      alert('保存语音配置失败')
    }
  }

  const handleGenerateAudio = async () => {
    try {
      setIsGenerating(true)
      setGenerationProgress(0)
      setGenerationStatus('准备生成音频...')

      // Check if all characters have voice assignments
      const unassignedCharacters = characters.filter(char =>
        char.isActive && !characterVoices[char.id]
      )

      if (unassignedCharacters.length > 0) {
        alert(`请为以下角色配置语音：${unassignedCharacters.map(c => c.name).join(', ')}`)
        setShowVoiceConfig(true)
        setIsGenerating(false)
        return
      }

      // TODO: Implement audio generation API
      for (let i = 0; i <= 100; i += 10) {
        setGenerationProgress(i)
        setGenerationStatus(`生成进度：${i}%`)
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      setGenerationStatus('音频生成完成！')

      // Reload book data to show new audio files
      await loadBookAndData()

    } catch (error) {
      console.error('Failed to generate audio:', error)
      setGenerationStatus('音频生成失败')
      alert('音频生成失败，请重试')
    } finally {
      setIsGenerating(false)
    }
  }

  const handlePlayAudio = (audioFile: any) => {
    // TODO: Implement audio playback
    console.log('Playing audio:', audioFile)
  }

  const handleDownloadAudio = (audioFile: any) => {
    // TODO: Implement audio download
    console.log('Downloading audio:', audioFile)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Volume2 className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || '书籍不存在'}</p>
          <Button onClick={() => router.back()}>返回</Button>
        </div>
      </div>
    )
  }

  const availableProviders = VOICE_PROVIDERS.filter(provider => provider.isConfigured)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/books/${bookId}`)}
                className="mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">音频生成</h1>
                <p className="text-sm text-gray-500">{book.title}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="secondary">
                {book._count?.audioFiles || 0} 个音频文件
              </Badge>
              <Button
                variant="outline"
                onClick={() => router.push(`/books/${bookId}/play`)}
                disabled={!book._count?.audioFiles}
              >
                <Play className="w-4 h-4 mr-2" />
                播放音频
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Audio Generation Progress */}
        {(isGenerating || generationStatus) && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                {isGenerating ? (
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                ) : generationStatus.includes('完成') ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : generationStatus.includes('失败') ? (
                  <AlertCircle className="w-6 h-6 text-red-600" />
                ) : (
                  <Volume2 className="w-6 h-6 text-blue-600" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{generationStatus}</p>
                  {isGenerating && (
                    <Progress value={generationProgress} className="mt-2" />
                  )}
                </div>
                {!isGenerating && generationStatus.includes('完成') && (
                  <Button
                    onClick={() => router.push(`/books/${bookId}/play`)}
                    size="sm"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    立即播放
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Configuration */}
          <div className="lg:col-span-2 space-y-6">
            {/* Voice Provider Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Mic className="w-5 h-5 mr-2" />
                  语音提供商
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {availableProviders.map((provider) => (
                    <div
                      key={provider.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedProvider === provider.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedProvider(provider.id)}
                    >
                      <div className="text-2xl mb-2">{provider.icon}</div>
                      <h4 className="font-medium text-gray-900">{provider.name}</h4>
                      <p className="text-sm text-gray-600 mt-1">{provider.description}</p>
                    </div>
                  ))}
                </div>
                {availableProviders.length === 0 && (
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      未配置语音服务
                    </h3>
                    <p className="text-gray-600 mb-4">
                      请在环境变量中配置至少一个语音服务提供商
                    </p>
                    <div className="text-sm text-gray-500">
                      <p>• OpenAI TTS: 设置 OPENAI_API_KEY</p>
                      <p>• Azure Speech: 设置 AZURE_SPEECH_KEY 和 AZURE_SPEECH_REGION</p>
                      <p>• Edge TTS: 无需配置，免费使用</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Character Voice Configuration */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    角色语音配置
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowVoiceConfig(!showVoiceConfig)}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    {showVoiceConfig ? '收起' : '配置'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {characters.length > 0 ? (
                  <div className="space-y-4">
                    {characters
                      .filter(char => char.isActive)
                      .map((character) => (
                        <div key={character.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{character.name}</h4>
                              <p className="text-sm text-gray-500">
                                {character._count?.scriptSentences || 0} 句台词
                              </p>
                            </div>
                          </div>
                          {showVoiceConfig ? (
                            <select
                              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              value={characterVoices[character.id] || ''}
                              onChange={(e) => handleCharacterVoiceChange(character.id, e.target.value)}
                            >
                              <option value="">选择语音</option>
                              {voiceProfiles
                                .filter(profile => profile.provider === selectedProvider)
                                .map((profile) => (
                                  <option key={profile.id} value={profile.id}>
                                    {profile.name} ({profile.gender})
                                  </option>
                                ))}
                            </select>
                          ) : (
                            <div className="flex items-center space-x-2">
                              {characterVoices[character.id] ? (
                                <>
                                  <Volume2 className="w-4 h-4 text-green-600" />
                                  <span className="text-sm text-green-600">已配置</span>
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                                  <span className="text-sm text-yellow-600">未配置</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    {showVoiceConfig && (
                      <div className="flex justify-end pt-4">
                        <Button onClick={handleSaveVoiceConfiguration}>
                          保存配置
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      暂无角色配置
                    </h3>
                    <p className="text-gray-600 mb-4">
                      请先创建角色配置，然后再生成音频
                    </p>
                    <Button
                      onClick={() => router.push(`/books/${bookId}/characters`)}
                      variant="outline"
                    >
                      <User className="w-4 h-4 mr-2" />
                      配置角色
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Audio Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  音频设置
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      语速: {audioSettings.speed}x
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={audioSettings.speed}
                      onChange={(e) => setAudioSettings({...audioSettings, speed: parseFloat(e.target.value)})}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      音调: {audioSettings.pitch}
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={audioSettings.pitch}
                      onChange={(e) => setAudioSettings({...audioSettings, pitch: parseFloat(e.target.value)})}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      音量: {Math.round(audioSettings.volume * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.1"
                      value={audioSettings.volume}
                      onChange={(e) => setAudioSettings({...audioSettings, volume: parseFloat(e.target.value)})}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      输出格式
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={audioSettings.outputFormat}
                      onChange={(e) => setAudioSettings({...audioSettings, outputFormat: e.target.value})}
                    >
                      <option value="mp3">MP3</option>
                      <option value="wav">WAV</option>
                      <option value="ogg">OGG</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Actions and Status */}
          <div className="space-y-6">
            {/* Generation Status */}
            <Card>
              <CardHeader>
                <CardTitle>生成状态</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">文本段落</span>
                    <Badge variant="outline">{book._count?.textSegments || 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">角色配置</span>
                    <Badge variant="outline">{characters.filter(c => c.isActive).length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">已生成音频</span>
                    <Badge variant="outline">{book._count?.audioFiles || 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">待生成</span>
                    <Badge variant="outline">
                      {Math.max(0, (book._count?.textSegments || 0) - (book._count?.audioFiles || 0))}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Card>
              <CardHeader>
                <CardTitle>操作</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleGenerateAudio}
                  disabled={
                    isGenerating ||
                    availableProviders.length === 0 ||
                    !book.textSegments ||
                    book.textSegments.length === 0
                  }
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      生成音频
                    </>
                  )}
                </Button>

                {book._count?.audioFiles > 0 && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push(`/books/${bookId}/play`)}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    播放音频
                  </Button>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(`/books/${bookId}/segments`)}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  查看文本
                </Button>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(`/books/${bookId}/characters`)}
                >
                  <User className="w-4 h-4 mr-2" />
                  管理角色
                </Button>
              </CardContent>
            </Card>

            {/* Quick Tips */}
            <Card>
              <CardHeader>
                <CardTitle>提示</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <p>为每个角色配置不同的语音，让有声读物更加生动</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <p>调整语速和音调以获得最佳的听感效果</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <p>Edge TTS 是免费选项，无需配置 API 密钥</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
