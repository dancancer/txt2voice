// 一旦我被更新，请更新我的开头注释
// input: 音频文件列表与播放器依赖
// output: 播放器状态与控制方法
// pos: 页面 Hook
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AudioFile } from "../models";

export function useAudioPlayer(audioFiles: AudioFile[]) {
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

  const maxTrackIndex = Math.max(audioFiles.length - 1, 0);
  const safeTrackIndex = Math.min(currentTrackIndex, maxTrackIndex);

  const handleTrackEnd = useCallback(() => {
    setCurrentTrackIndex((prev) => {
      const nextBase = Math.min(prev, maxTrackIndex);
      if (nextBase < maxTrackIndex) {
        return nextBase + 1;
      }
      setIsPlaying(false);
      setCurrentTime(0);
      return nextBase;
    });
  }, [maxTrackIndex]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleTrackEnd);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleTrackEnd);
    };
  }, [handleTrackEnd]);

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }
    audioRef.current.volume = isMuted ? 0 : volume;
    audioRef.current.playbackRate = playbackSpeed;
  }, [isMuted, playbackSpeed, volume]);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audioFiles.length === 0) {
      return;
    }

    if (isPlaying) {
      audio.pause();
    } else {
      void audio.play();
    }
    setIsPlaying(!isPlaying);
  }, [audioFiles.length, isPlaying]);

  const handlePreviousTrack = useCallback(() => {
    if (safeTrackIndex > 0) {
      setCurrentTrackIndex(safeTrackIndex - 1);
      setCurrentTime(0);
    }
  }, [safeTrackIndex]);

  const handleNextTrack = useCallback(() => {
    if (safeTrackIndex < maxTrackIndex) {
      setCurrentTrackIndex(safeTrackIndex + 1);
      setCurrentTime(0);
    }
  }, [maxTrackIndex, safeTrackIndex]);

  const handleProgressClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current;
      const progressBar = progressBarRef.current;
      if (!audio || !progressBar) {
        return;
      }

      const rect = progressBar.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const clickPercent = clickX / rect.width;
      const newTime = clickPercent * duration;

      audio.currentTime = newTime;
      setCurrentTime(newTime);
    },
    [duration]
  );

  const handleVolumeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newVolume = Number(event.target.value);
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    },
    []
  );

  const handleMuteToggle = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const handleTrackSelect = useCallback(
    (index: number) => {
      const normalized = Math.min(Math.max(index, 0), maxTrackIndex);
      setCurrentTrackIndex(normalized);
      setCurrentTime(0);
      if (isPlaying && audioRef.current) {
        void audioRef.current.play();
      }
    },
    [isPlaying, maxTrackIndex]
  );

  const currentTrack = useMemo(
    () => audioFiles[safeTrackIndex],
    [audioFiles, safeTrackIndex]
  );

  const totalDuration = useMemo(
    () => audioFiles.reduce((total, file) => total + (file.duration || 0), 0),
    [audioFiles]
  );

  const totalFileSize = useMemo(
    () => audioFiles.reduce((total, file) => total + (file.fileSize || 0), 0),
    [audioFiles]
  );

  return {
    audioRef,
    progressBarRef,
    isPlaying,
    setIsPlaying,
    currentTrackIndex: safeTrackIndex,
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
  };
}
