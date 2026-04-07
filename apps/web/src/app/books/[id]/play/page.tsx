// 一旦我被更新，请更新我的开头注释
// input: 路由参数/客户端数据
// output: 页面 UI
// pos: 路由页面入口
"use client";

import { useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { PlaybackHeader } from "./components/PlaybackHeader";
import {
  PlaybackEmptyState,
  PlaybackErrorState,
  PlaybackLoadingState,
} from "./components/PlaybackStates";
import { PlaybackMain } from "./components/PlaybackMain";
import { PlaybackSidebar } from "./components/PlaybackSidebar";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { usePlaybackData } from "./hooks/usePlaybackData";
import type { AudioFile } from "./models";

export default function AudioPlaybackPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  const { book, audioFiles, loading, error } = usePlaybackData(bookId);
  const {
    audioRef,
    progressBarRef,
    isPlaying,
    setIsPlaying,
    currentTrackIndex,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackSpeed,
    setPlaybackSpeed,
    showPlaylist,
    setShowPlaylist,
    currentTrack,
    totalDuration,
    totalFileSize,
    handlePlayPause,
    handlePreviousTrack,
    handleNextTrack,
    handleProgressClick,
    handleVolumeChange,
    handleMuteToggle,
    handleTrackSelect,
  } = useAudioPlayer(audioFiles);

  const handleDownloadAudio = useCallback((audioFile: AudioFile) => {
    const link = document.createElement("a");
    link.href = `/api/audio/${audioFile.id}`;
    link.download = audioFile.filename || `${audioFile.id}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  if (loading) {
    return <PlaybackLoadingState />;
  }

  if (error || !book) {
    return (
      <PlaybackErrorState
        message={error || "书籍不存在"}
        onBack={() => router.back()}
      />
    );
  }

  return (
    <div className="min-h-full bg-background">
      <PlaybackHeader
        bookTitle={book.title}
        audioCount={audioFiles.length}
        showPlaylist={showPlaylist}
        onBack={() => router.push(`/books/${bookId}`)}
        onTogglePlaylist={() => setShowPlaylist((prev) => !prev)}
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {audioFiles.length === 0 ? (
          <PlaybackEmptyState
            onGenerate={() => router.push(`/books/${bookId}/studio/audio`)}
            onBackBook={() => router.push(`/books/${bookId}`)}
          />
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <PlaybackMain
              audioFiles={audioFiles}
              currentTrack={currentTrack}
              currentTrackIndex={currentTrackIndex}
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              volume={volume}
              isMuted={isMuted}
              playbackSpeed={playbackSpeed}
              showPlaylist={showPlaylist}
              totalDuration={totalDuration}
              progressBarRef={progressBarRef}
              onPlayPause={handlePlayPause}
              onPreviousTrack={handlePreviousTrack}
              onNextTrack={handleNextTrack}
              onProgressClick={handleProgressClick}
              onVolumeChange={handleVolumeChange}
              onMuteToggle={handleMuteToggle}
              onSpeedChange={setPlaybackSpeed}
              onTrackSelect={handleTrackSelect}
              onDownload={handleDownloadAudio}
            />
            <PlaybackSidebar
              book={book}
              audioFiles={audioFiles}
              totalDuration={totalDuration}
              totalFileSize={totalFileSize}
              onGoGenerate={() => router.push(`/books/${bookId}/studio/audio`)}
              onGoBook={() => router.push(`/books/${bookId}`)}
              onGoCharacters={() => router.push(`/books/${bookId}/characters`)}
            />
          </div>
        )}

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
