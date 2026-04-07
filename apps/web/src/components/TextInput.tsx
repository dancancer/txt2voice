// If I change, please update my header comment.
// input: props/hooks/component deps
// output: reusable UI
// pos: shared component
'use client'

import { useAppStore } from '@/store/useAppStore'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Play, Pause, Volume2 } from 'lucide-react'

export function TextInput() {
  const { text, setText, isPlaying, setIsPlaying } = useAppStore()

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div className="relative">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter your text here..."
          className="min-h-[200px] resize-none p-4"
        />
        <div className="absolute bottom-4 right-4 text-sm text-muted-foreground">
          {text.length} characters
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Volume2 className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
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
