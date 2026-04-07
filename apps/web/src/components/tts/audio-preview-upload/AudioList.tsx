"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pause, Play, Trash2 } from "lucide-react";
import type { AudioFile } from "./types";
import { formatDuration, formatFileSize, getAudioTypeLabel } from "./utils";

interface AudioListProps {
  audios: AudioFile[];
  onDelete?: (filename: string) => void;
  onPlay?: (url: string, filename: string) => void;
}

export function AudioList({ audios, onDelete, onPlay }: AudioListProps) {
  const [isPlaying, setIsPlaying] = useState<string | null>(null);

  const togglePlayPause = (url: string, filename: string) => {
    if (isPlaying === filename) {
      const audio = document.getElementById(`audio-${filename}`) as HTMLAudioElement;
      if (audio) {
        audio.pause();
        setIsPlaying(null);
      }
      return;
    }

    const audio = document.getElementById(`audio-${filename}`) as HTMLAudioElement;
    if (audio) {
      audio.play();
      setIsPlaying(filename);
      onPlay?.(url, filename);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {audios.map((audio) => (
        <Card key={audio.filename} className="relative">
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="truncate text-lg">{audio.originalName}</CardTitle>
              <Badge variant={audio.audioType === "example" ? "default" : "secondary"}>
                {getAudioTypeLabel(audio.audioType)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="space-y-1 text-sm">
              <p>
                <strong>文件名:</strong> {audio.filename}
              </p>
              <p>
                <strong>大小:</strong> {formatFileSize(audio.fileSize)}
              </p>
              <p>
                <strong>时长:</strong> {formatDuration(audio.duration)}
              </p>
              <p>
                <strong>采样率:</strong> {audio.sampleRate} Hz
              </p>
              <p>
                <strong>格式:</strong> {audio.format}
              </p>
              {audio.speaker && (
                <p>
                  <strong>说话人:</strong> {audio.speaker.name}
                </p>
              )}
            </div>
            {audio.description && (
              <p className="text-sm text-muted-foreground">{audio.description}</p>
            )}
            <div className="mt-2">
              <audio
                id={`audio-${audio.filename}`}
                src={audio.url}
                controls
                className="w-full"
                onEnded={() => setIsPlaying(null)}
              />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => togglePlayPause(audio.url, audio.filename)}
                className="flex items-center gap-1"
              >
                {isPlaying === audio.filename ? (
                  <>
                    <Pause className="h-3 w-3" />
                    停止
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3" />
                    播放
                  </>
                )}
              </Button>
              {onDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(audio.filename)}
                  className="flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  删除
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
