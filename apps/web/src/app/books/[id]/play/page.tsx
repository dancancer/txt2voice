"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { booksApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Settings,
  Download,
  RefreshCw,
  FileText,
  User,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

interface AudioFile {
  id: string;
  filename: string;
  duration: number;
  fileSize: number;
  createdAt: string;
  scriptSentence?: {
    text: string;
    order: number;
  };
  character?: {
    name: string;
  };
}

export default function AudioPlaybackPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  const [book, setBook] = useState<any>(null);
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showPlaylist, setShowPlaylist] = useState(true);

  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const loadBookAndAudioFiles = useCallback(async () => {
    try {
      setLoading(true);
      const response = await booksApi.getBook(bookId);
      setBook(response.data);

      // Process audio files with script sentences
      const processedAudioFiles = (response.data.audioFiles || []).map(
        (file: any) => ({
          ...file,
          scriptSentence: file.scriptSentence,
          character: file.scriptSentence?.character,
        })
      );
      setAudioFiles(processedAudioFiles);
    } catch (err) {
      console.error("Failed to load book and audio files:", err);
      setError("加载音频文件失败");
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    loadBookAndAudioFiles();
  }, [loadBookAndAudioFiles]);

  const handleTrackEnd = useCallback(() => {
    setCurrentTrackIndex((prev) => {
      if (prev < audioFiles.length - 1) {
        return prev + 1;
      }
      setIsPlaying(false);
      setCurrentTime(0);
      return prev;
    });
  }, [audioFiles.length]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => handleTrackEnd();

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [handleTrackEnd]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [volume, isMuted, playbackSpeed]);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || audioFiles.length === 0) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handlePreviousTrack = () => {
    if (currentTrackIndex > 0) {
      setCurrentTrackIndex(currentTrackIndex - 1);
      setCurrentTime(0);
    }
  };

  const handleNextTrack = () => {
    if (currentTrackIndex < audioFiles.length - 1) {
      setCurrentTrackIndex(currentTrackIndex + 1);
      setCurrentTime(0);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const progressBar = progressBarRef.current;
    if (!audio || !progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercent = clickX / rect.width;
    const newTime = clickPercent * duration;

    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
  };

  const handleTrackSelect = (index: number) => {
    setCurrentTrackIndex(index);
    setCurrentTime(0);
    if (isPlaying && audioRef.current) {
      audioRef.current.play();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const downloadAudioFile = (audioFile: AudioFile) => {
    // TODO: Implement audio download
    console.log("Downloading audio file:", audioFile);
  };

  const regenerateAudio = async () => {
    try {
      // TODO: Implement audio regeneration
      console.log("Regenerating audio for book:", bookId);
      router.push(`/books/${bookId}/audio`);
    } catch (error) {
      console.error("Failed to regenerate audio:", error);
    }
  };

  const currentTrack = audioFiles[currentTrackIndex];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || "书籍不存在"}</p>
          <Button onClick={() => router.back()}>返回</Button>
        </div>
      </div>
    );
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
                <h1 className="text-xl font-semibold text-gray-900">
                  音频播放
                </h1>
                <p className="text-sm text-gray-500">{book.title}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="secondary">{audioFiles.length} 个音频文件</Badge>
              <Button
                variant="outline"
                onClick={() => setShowPlaylist(!showPlaylist)}
              >
                <FileText className="w-4 h-4 mr-2" />
                {showPlaylist ? "隐藏" : "显示"}列表
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {audioFiles.length === 0 ? (
          /* No Audio Files State */
          <Card>
            <CardContent className="p-12 text-center">
              <Volume2 className="w-16 h-16 text-gray-400 mx-auto mb-6" />
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                暂无音频文件
              </h2>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                这本书还没有生成音频文件。请先前往音频生成页面创建音频。
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={() => router.push(`/books/${bookId}/audio`)}
                  size="lg"
                >
                  <Volume2 className="w-5 h-5 mr-2" />
                  生成音频
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/books/${bookId}/segments`)}
                  size="lg"
                >
                  <FileText className="w-5 h-5 mr-2" />
                  查看文本
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Player */}
            <div className="lg:col-span-2 space-y-6">
              {/* Now Playing */}
              <Card>
                <CardContent className="p-8">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      {currentTrack?.scriptSentence?.text ||
                        `音频文件 ${currentTrackIndex + 1}`}
                    </h2>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      {currentTrack?.character && (
                        <div className="flex items-center">
                          <User className="w-4 h-4 mr-1" />
                          {currentTrack.character.name}
                        </div>
                      )}
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {currentTrack
                          ? formatTime(currentTrack.duration)
                          : "--:--"}
                      </div>
                      {currentTrack && (
                        <div className="flex items-center">
                          <span className="w-4 h-4 mr-1 text-center">💾</span>
                          {formatFileSize(currentTrack.fileSize)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-6">
                    <div
                      ref={progressBarRef}
                      className="relative h-2 bg-gray-200 rounded-full cursor-pointer"
                      onClick={handleProgressClick}
                    >
                      <div
                        className="absolute left-0 top-0 h-full bg-blue-600 rounded-full transition-all duration-100"
                        style={{
                          width:
                            duration > 0
                              ? `${(currentTime / duration) * 100}%`
                              : "0%",
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-2 text-sm text-gray-600">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Playback Controls */}
                  <div className="flex items-center justify-center space-x-4 mb-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreviousTrack}
                      disabled={currentTrackIndex === 0}
                    >
                      <SkipBack className="w-4 h-4" />
                    </Button>
                    <Button
                      size="lg"
                      onClick={handlePlayPause}
                      disabled={!currentTrack}
                      className="w-16 h-16 rounded-full"
                    >
                      {isPlaying ? (
                        <Pause className="w-6 h-6" />
                      ) : (
                        <Play className="w-6 h-6 ml-1" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextTrack}
                      disabled={currentTrackIndex === audioFiles.length - 1}
                    >
                      <SkipForward className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Volume and Speed Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <div className="flex items-center space-x-3 mb-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleMuteToggle}
                        >
                          {isMuted ? (
                            <VolumeX className="w-4 h-4" />
                          ) : (
                            <Volume2 className="w-4 h-4" />
                          )}
                        </Button>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={isMuted ? 0 : volume}
                          onChange={handleVolumeChange}
                          className="flex-1"
                        />
                        <span className="text-sm text-gray-600 w-10">
                          {Math.round((isMuted ? 0 : volume) * 100)}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">播放速度:</span>
                        <div className="flex space-x-1">
                          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                            <Button
                              key={speed}
                              variant={
                                playbackSpeed === speed ? "default" : "outline"
                              }
                              size="sm"
                              onClick={() => handleSpeedChange(speed)}
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

              {/* Playlist */}
              {showPlaylist && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>播放列表</CardTitle>
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <span>{audioFiles.length} 个文件</span>
                        <span>•</span>
                        <span>
                          {audioFiles.reduce(
                            (total, file) => total + file.duration,
                            0
                          ) > 0
                            ? formatTime(
                                audioFiles.reduce(
                                  (total, file) => total + file.duration,
                                  0
                                )
                              )
                            : "--:--"}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {audioFiles.map((file, index) => (
                        <div
                          key={file.id}
                          className={`p-4 rounded-lg cursor-pointer transition-colors ${
                            index === currentTrackIndex
                              ? "bg-blue-50 border-blue-200 border"
                              : "bg-gray-50 hover:bg-gray-100"
                          }`}
                          onClick={() => handleTrackSelect(index)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    index === currentTrackIndex
                                      ? "bg-blue-600 text-white"
                                      : "bg-gray-200 text-gray-600"
                                  }`}
                                >
                                  {index === currentTrackIndex && isPlaying ? (
                                    <Pause className="w-4 h-4" />
                                  ) : (
                                    <Play className="w-4 h-4" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900 line-clamp-1">
                                    {file.scriptSentence?.text ||
                                      `音频文件 ${index + 1}`}
                                  </h4>
                                  <div className="flex items-center space-x-3 text-sm text-gray-600">
                                    {file.character && (
                                      <span>{file.character.name}</span>
                                    )}
                                    <span>{formatTime(file.duration)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadAudioFile(file);
                                }}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Sidebar */}
            <div className="space-y-6">
              {/* Book Info */}
              <Card>
                <CardHeader>
                  <CardTitle>书籍信息111</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {book.title}
                      </h3>
                      {book.author && (
                        <p className="text-sm text-gray-600">
                          作者：{book.author}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">总时长</span>
                      <span className="font-medium">
                        {audioFiles.reduce(
                          (total, file) => total + file.duration,
                          0
                        ) > 0
                          ? formatTime(
                              audioFiles.reduce(
                                (total, file) => total + file.duration,
                                0
                              )
                            )
                          : "--:--"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">文件数量</span>
                      <span className="font-medium">{audioFiles.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">总大小</span>
                      <span className="font-medium">
                        {formatFileSize(
                          audioFiles.reduce(
                            (total, file) => total + file.fileSize,
                            0
                          )
                        )}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>快捷操作</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push(`/books/${bookId}/audio`)}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    重新生成
                  </Button>
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
                    角色配置111
                  </Button>
                </CardContent>
              </Card>

              {/* Keyboard Shortcuts */}
              <Card>
                <CardHeader>
                  <CardTitle>快捷键</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">播放/暂停</span>
                      <kbd className="px-2 py-1 bg-gray-100 rounded">Space</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">上一首</span>
                      <kbd className="px-2 py-1 bg-gray-100 rounded">←</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">下一首</span>
                      <kbd className="px-2 py-1 bg-gray-100 rounded">→</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">静音</span>
                      <kbd className="px-2 py-1 bg-gray-100 rounded">M</kbd>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Hidden Audio Element */}
        <audio
          ref={audioRef}
          src={currentTrack ? `/api/audio/${currentTrack.id}` : ""}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      </div>
    </div>
  );
}
