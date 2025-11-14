"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Upload, Trash2, Mic } from "lucide-react";
import { toast } from "sonner";

interface AudioFile {
  filename: string;
  originalName: string;
  fileSize: number;
  duration: number;
  sampleRate: number;
  format: string;
  audioType: "example" | "uploaded" | "emotion";
  description?: string;
  speakerId?: string;
  url: string;
  speaker?: any;
}

interface AudioPreviewUploadProps {
  onUploadComplete?: (audio: AudioFile) => void;
  onDelete?: (filename: string) => void;
  maxFileSize?: number;
  acceptedFormats?: string[];
}

export function AudioPreviewUpload({
  onUploadComplete,
  onDelete,
  maxFileSize = 100 * 1024 * 1024, // 100MB
  acceptedFormats = ["audio/*"],
}: AudioPreviewUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // 处理文件选择
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 验证文件大小
      if (file.size > maxFileSize) {
        toast.error(
          `文件大小超过限制 (${Math.round(maxFileSize / 1024 / 1024)}MB)`
        );
        return;
      }

      // 验证文件类型
      if (!file.type.startsWith("audio/")) {
        toast.error("请选择音频文件");
        return;
      }

      setSelectedFile(file);
      setDescription(file.name.replace(/\.[^/.]+$/, "")); // 移除文件扩展名作为默认描述

      // 创建预览 URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  // 上传文件
  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (description.trim()) {
        formData.append("description", description.trim());
      }

      const xhr = new XMLHttpRequest();

      // 监听上传进度
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener("load", async () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          if (data.success) {
            toast.success("音频上传成功");
            onUploadComplete?.(data.data.upload);
            resetForm();
          } else {
            toast.error(data.error || "音频上传失败");
          }
        } else {
          toast.error("音频上传失败");
        }
        setIsUploading(false);
        setUploadProgress(0);
      });

      xhr.addEventListener("error", () => {
        toast.error("音频上传失败");
        setIsUploading(false);
        setUploadProgress(0);
      });

      xhr.open("POST", "/api/tts/reference-audio/upload");
      xhr.send(formData);
    } catch (error) {
      console.error("Failed to upload audio:", error);
      toast.error("音频上传失败");
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // 播放/暂停音频
  const togglePlayPause = (url: string, filename: string) => {
    if (isPlaying === filename) {
      // 停止播放
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(null);
      }
    } else {
      // 开始播放
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
        setIsPlaying(filename);
      }
    }
  };

  // 删除音频
  const handleDelete = async (filename: string) => {
    if (!confirm("确定要删除这个音频吗？")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/tts/reference-audio?filename=${encodeURIComponent(filename)}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success("音频删除成功");
        onDelete?.(filename);
      } else {
        toast.error(data.error || "音频删除失败");
      }
    } catch (error) {
      console.error("Failed to delete audio:", error);
      toast.error("音频删除失败");
    }
  };

  // 重置表单
  const resetForm = () => {
    setSelectedFile(null);
    setDescription("");
    setUploadProgress(0);
    setIsUploading(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // 获取音频类型标签
  const getAudioTypeLabel = (type: string) => {
    switch (type) {
      case "example":
        return "示例";
      case "uploaded":
        return "上传";
      case "emotion":
        return "情感";
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* 上传区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            上传参考音频
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="audioFile">选择音频文件</Label>
            <Input
              ref={fileInputRef}
              id="audioFile"
              type="file"
              accept={acceptedFormats.join(",")}
              onChange={handleFileSelect}
              disabled={isUploading}
            />
            <p className="text-sm text-gray-600 mt-1">
              支持格式: {acceptedFormats.join(", ")} | 最大大小:{" "}
              {Math.round(maxFileSize / 1024 / 1024)}MB
            </p>
          </div>

          {selectedFile && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="description">描述 (可选)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="输入音频描述..."
                  rows={3}
                  disabled={isUploading}
                />
              </div>

              <div className="space-y-2">
                <p>
                  <strong>文件名:</strong> {selectedFile.name}
                </p>
                <p>
                  <strong>文件大小:</strong> {formatFileSize(selectedFile.size)}
                </p>
                <p>
                  <strong>格式:</strong> {selectedFile.type}
                </p>
              </div>

              {previewUrl && (
                <div>
                  <Label>预览</Label>
                  <div className="mt-2">
                    <audio
                      ref={audioRef}
                      controls
                      className="w-full"
                      onEnded={() => setIsPlaying(null)}
                    >
                      <source src={previewUrl} type={selectedFile.type} />
                      您的浏览器不支持音频播放。
                    </audio>
                  </div>
                </div>
              )}

              {isUploading && (
                <div className="space-y-2">
                  <Label>上传进度</Label>
                  <Progress value={uploadProgress} className="w-full" />
                  <p className="text-sm text-gray-600">
                    {uploadProgress.toFixed(1)}%
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {isUploading ? "上传中..." : "上传"}
                </Button>
                <Button
                  variant="outline"
                  onClick={resetForm}
                  disabled={isUploading}
                >
                  取消
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 音频列表预览 */}
      {onUploadComplete && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              已上传的音频
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600">
              上传完成后，音频将显示在这里。您可以在说话人管理页面查看所有音频。
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// 音频列表组件
export function AudioList({
  audios,
  onDelete,
  onPlay,
}: {
  audios: AudioFile[];
  onDelete?: (filename: string) => void;
  onPlay?: (url: string, filename: string) => void;
}) {
  const [isPlaying, setIsPlaying] = useState<string | null>(null);

  const togglePlayPause = (url: string, filename: string) => {
    if (isPlaying === filename) {
      // 停止播放
      const audio = document.getElementById(
        `audio-${filename}`
      ) as HTMLAudioElement;
      if (audio) {
        audio.pause();
        setIsPlaying(null);
      }
    } else {
      // 开始播放
      const audio = document.getElementById(
        `audio-${filename}`
      ) as HTMLAudioElement;
      if (audio) {
        audio.play();
        setIsPlaying(filename);
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getAudioTypeLabel = (type: string) => {
    switch (type) {
      case "example":
        return "示例";
      case "uploaded":
        return "上传";
      case "emotion":
        return "情感";
      default:
        return type;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {audios.map((audio) => (
        <Card key={audio.filename} className="relative">
          <CardHeader>
            <div className="flex justify-between items-start">
              <CardTitle className="text-lg truncate">
                {audio.originalName}
              </CardTitle>
              <Badge
                variant={
                  audio.audioType === "example" ? "default" : "secondary"
                }
              >
                {getAudioTypeLabel(audio.audioType)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm space-y-1">
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
              <p className="text-sm text-gray-600">{audio.description}</p>
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
            <div className="flex justify-between items-center mt-2">
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
