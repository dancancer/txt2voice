// 一旦我被更新，请更新我的开头注释
// input: 播放器状态与交互方法
// output: 播放主区域内容
// pos: 页面组件
"use client";

import type { RefObject } from "react";
import {
  Clock,
  Download,
  HardDrive,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  User,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AudioFile } from "../models";
import { formatFileSize, formatTime } from "../models";

interface PlaybackMainProps {
  audioFiles: AudioFile[];
  currentTrack?: AudioFile;
  currentTrackIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackSpeed: number;
  showPlaylist: boolean;
  totalDuration: number;
  progressBarRef: RefObject<HTMLDivElement | null>;
  onPlayPause: () => void;
  onPreviousTrack: () => void;
  onNextTrack: () => void;
  onProgressClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  onVolumeChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onMuteToggle: () => void;
  onSpeedChange: (speed: number) => void;
  onTrackSelect: (index: number) => void;
  onDownload: (file: AudioFile) => void;
}

export function PlaybackMain({
  audioFiles,
  currentTrack,
  currentTrackIndex,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  playbackSpeed,
  showPlaylist,
  totalDuration,
  progressBarRef,
  onPlayPause,
  onPreviousTrack,
  onNextTrack,
  onProgressClick,
  onVolumeChange,
  onMuteToggle,
  onSpeedChange,
  onTrackSelect,
  onDownload,
}: PlaybackMainProps) {
  return (
    <div className="space-y-6 lg:col-span-2">
      <Card>
        <CardContent className="p-4 !pt-4 sm:p-6 sm:!pt-6 lg:p-8 lg:!pt-8">
          <div className="mb-6">
            <h2 className="mb-2 text-xl font-bold leading-8 text-gray-900 sm:text-2xl">
              {currentTrack?.scriptSentence?.text || `音频文件 ${currentTrackIndex + 1}`}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
              {currentTrack?.character && (
                <div className="flex items-center">
                  <User className="mr-1 h-4 w-4" />
                  {currentTrack.character.canonicalName}
                </div>
              )}
              <div className="flex items-center">
                <Clock className="mr-1 h-4 w-4" />
                {currentTrack ? formatTime(currentTrack.duration) : "--:--"}
              </div>
              {currentTrack && (
                <div className="flex items-center">
                  <HardDrive className="mr-1 h-4 w-4" />
                  {formatFileSize(currentTrack.fileSize)}
                </div>
              )}
            </div>
          </div>

          <div className="mb-6">
            <div
              ref={progressBarRef}
              className="relative h-2 cursor-pointer rounded-full bg-gray-200"
              onClick={onProgressClick}
            >
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-blue-600 transition-all duration-100"
                style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%" }}
              />
            </div>
            <div className="mt-2 flex justify-between text-sm text-gray-600">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="mb-6 flex items-center justify-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={onPreviousTrack}
              disabled={currentTrackIndex === 0}
              className="min-h-11 min-w-11"
              aria-label="上一首"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              onClick={onPlayPause}
              disabled={!currentTrack}
              className="h-16 w-16 rounded-full"
              aria-label={isPlaying ? "暂停" : "播放"}
            >
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="ml-1 h-6 w-6" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onNextTrack}
              disabled={currentTrackIndex === audioFiles.length - 1}
              className="min-h-11 min-w-11"
              aria-label="下一首"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onMuteToggle}
                  className="min-h-11 min-w-11"
                  aria-label={isMuted ? "取消静音" : "静音"}
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={onVolumeChange}
                  className="flex-1"
                  aria-label="音量调节"
                />
                <span className="w-10 text-sm text-gray-600">
                  {Math.round((isMuted ? 0 : volume) * 100)}%
                </span>
              </div>
            </div>
            <div>
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                <span className="text-sm text-gray-600">播放速度:</span>
                <div className="flex flex-wrap gap-1">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                    <Button
                      key={speed}
                      variant={playbackSpeed === speed ? "default" : "outline"}
                      size="sm"
                      onClick={() => onSpeedChange(speed)}
                      className="min-h-11 min-w-[52px]"
                    >
                      {speed}x
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {showPlaylist && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>播放列表</CardTitle>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>{audioFiles.length} 个文件</span>
                <span>•</span>
                <span>{totalDuration > 0 ? formatTime(totalDuration) : "--:--"}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {audioFiles.map((file, index) => (
                <div
                  key={file.id}
                  role="button"
                  tabIndex={0}
                  className={`w-full rounded-lg p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    index === currentTrackIndex
                      ? "border border-blue-200 bg-blue-50"
                      : "bg-gray-50 hover:bg-gray-100"
                  }`}
                  onClick={() => onTrackSelect(index)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onTrackSelect(index);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-1 items-center space-x-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${
                          index === currentTrackIndex
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {index === currentTrackIndex && isPlaying ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="line-clamp-2 font-medium text-gray-900">
                          {file.scriptSentence?.text || `音频文件 ${index + 1}`}
                        </h4>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                          {file.character && <span>{file.character.canonicalName}</span>}
                          <span>{formatTime(file.duration)}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-11 min-w-11"
                      aria-label="下载音频"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDownload(file);
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
