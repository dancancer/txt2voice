'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { booksApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Users,
  Plus,
  Edit,
  Trash2,
  Volume2,
  Settings,
  User,
  Search,
  Mic,
  FileText
} from 'lucide-react'

export default function CharacterProfilesPage() {
  const params = useParams()
  const router = useRouter()
  const bookId = params.id as string

  const [book, setBook] = useState<any>(null)
  const [characters, setCharacters] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddCharacter, setShowAddCharacter] = useState(false)
  const [editingCharacter, setEditingCharacter] = useState<any>(null)

  useEffect(() => {
    loadBookAndCharacters()
  }, [bookId])

  const loadBookAndCharacters = async () => {
    try {
      setLoading(true)
      const response = await booksApi.getBook(bookId)
      setBook(response.data)
      setCharacters(response.data.characterProfiles || [])
    } catch (err) {
      console.error('Failed to load book and characters:', err)
      setError('加载角色配置失败')
    } finally {
      setLoading(false)
    }
  }

  const filteredCharacters = characters.filter(character =>
    (character.canonicalName || character.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    ((character.characteristics as any)?.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleCreateCharacter = async (characterData: any) => {
    try {
      // TODO: Implement character creation API
      console.log('Creating character:', characterData)
      setShowAddCharacter(false)
      await loadBookAndCharacters()
    } catch (error) {
      console.error('Failed to create character:', error)
    }
  }

  const handleUpdateCharacter = async (id: string, characterData: any) => {
    try {
      // TODO: Implement character update API
      console.log('Updating character:', id, characterData)
      setEditingCharacter(null)
      await loadBookAndCharacters()
    } catch (error) {
      console.error('Failed to update character:', error)
    }
  }

  const handleDeleteCharacter = async (id: string) => {
    if (confirm('确定要删除这个角色吗？')) {
      try {
        // TODO: Implement character delete API
        console.log('Deleting character:', id)
        await loadBookAndCharacters()
      } catch (error) {
        console.error('Failed to delete character:', error)
      }
    }
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
          <Users className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || '书籍不存在'}</p>
          <Button onClick={() => router.back()}>返回</Button>
        </div>
      </div>
    )
  }

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
                <h1 className="text-xl font-semibold text-gray-900">角色配置</h1>
                <p className="text-sm text-gray-500">{book.title}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="secondary">
                {filteredCharacters.length} 个角色
              </Badge>
              <Button
                onClick={() => setShowAddCharacter(true)}
                disabled={!book.textSegments || book.textSegments.length === 0}
              >
                <Plus className="w-4 h-4 mr-2" />
                添加角色
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Info */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="搜索角色名称或描述..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-2" />
                  <span>共 {characters.length} 个角色</span>
                </div>
                {book.textSegments && (
                  <div className="flex items-center">
                    <FileText className="w-4 h-4 mr-2" />
                    <span>{book.textSegments.length} 个文本段落</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Characters Grid */}
        {filteredCharacters.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCharacters.map((character) => (
              <Card key={character.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{character.canonicalName || character.name}</h3>
                        <p className="text-sm text-gray-500">
                          {character.aliases?.length || 0}个别名
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Badge variant={character.isActive ? 'default' : 'secondary'}>
                        {character.isActive ? '启用' : '禁用'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  {/* Character Description */}
                  {((character.characteristics as any)?.description || character.description) && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                      {(character.characteristics as any)?.description || character.description}
                    </p>
                  )}

                  {/* Voice Configuration */}
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">语音配置</span>
                      {character.voiceBindings?.length > 0 ? (
                        <Badge variant="outline" className="text-green-600">
                          <Volume2 className="w-3 h-3 mr-1" />
                          已配置
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-orange-600">
                          <Settings className="w-3 h-3 mr-1" />
                          未配置
                        </Badge>
                      )}
                    </div>

                    {character.voiceBindings?.length > 0 && (
                      <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                        {character.voiceBindings.map((binding: any, index: number) => (
                          <div key={index} className="flex items-center">
                            <Mic className="w-3 h-3 mr-1" />
                            {binding.voiceProfile?.name || '未命名语音'}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Statistics */}
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <span>台词数: {character._count?.scriptSentences || 0}</span>
                    <span>出现频率: {character.frequency || '低'}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingCharacter(character)}
                      className="flex-1"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      编辑
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/books/${bookId}/audio?character=${character.id}`)}
                      className="flex-1"
                    >
                      <Settings className="w-4 h-4 mr-1" />
                      语音
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCharacter(character.id)}
                      className="text-red-600 hover:text-red-800 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* Empty State */
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                暂无角色配置
              </h3>
              <p className="text-gray-600 mb-6">
                角色配置用于为书中的人物分配不同的语音，让有声读物更加生动。
              </p>
              <div className="space-y-4">
                <Button
                  onClick={() => setShowAddCharacter(true)}
                  disabled={!book.textSegments || book.textSegments.length === 0}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  创建第一个角色
                </Button>
                {!book.textSegments || book.textSegments.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    请先处理文本段落，然后再创建角色配置
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Character Form Modal */}
        {(showAddCharacter || editingCharacter) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>
                  {editingCharacter ? '编辑角色' : '添加角色'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CharacterForm
                  character={editingCharacter}
                  onSubmit={editingCharacter
                    ? (data) => handleUpdateCharacter(editingCharacter.id, data)
                    : handleCreateCharacter
                  }
                  onCancel={() => {
                    setShowAddCharacter(false)
                    setEditingCharacter(null)
                  }}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

// Character Form Component
function CharacterForm({ character, onSubmit, onCancel }: {
  character?: any
  onSubmit: (data: any) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    name: character?.canonicalName || character?.name || '',
    description: (character?.characteristics as any)?.description || character?.description || '',
    aliases: character?.aliases?.map((a: { alias: string }) => a.alias).join(', ') || '',
    isActive: character?.isActive ?? true
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      aliases: formData.aliases.split(',').map((a: string) => a.trim()).filter(Boolean)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          角色名称 *
        </label>
        <input
          type="text"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="输入角色名称"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          角色描述
        </label>
        <textarea
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="描述角色的性格特征、身份等"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          别名 (用逗号分隔)
        </label>
        <input
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={formData.aliases}
          onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
          placeholder="例如：小明, 少年, 主角"
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="isActive"
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          checked={formData.isActive}
          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
        />
        <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
          启用此角色
        </label>
      </div>

      <div className="flex space-x-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1"
        >
          取消
        </Button>
        <Button
          type="submit"
          className="flex-1"
        >
          {character ? '更新' : '创建'}
        </Button>
      </div>
    </form>
  )
}
