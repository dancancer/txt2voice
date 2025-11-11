'use client'

import { useAppStore } from '@/store/useAppStore'
import { Button } from './ui/button'
import { Play, Pause, Volume2 } from 'lucide-react'

export function TextInput() {
  const { text, setText, isPlaying, setIsPlaying } = useAppStore()

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter your text here..."
          className="w-full min-h-[200px] p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
        <div className="absolute bottom-4 right-4 text-sm text-gray-400">
          {text.length} characters
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Volume2 className="w-5 h-5 text-gray-600" />
          <span className="text-sm text-gray-600">
            {isPlaying ? 'Playing...' : 'Ready to speak'}
          </span>
        </div>

        <Button
          onClick={handlePlayPause}
          disabled={!text.trim()}
          className="flex items-center space-x-2"
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>Play</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}