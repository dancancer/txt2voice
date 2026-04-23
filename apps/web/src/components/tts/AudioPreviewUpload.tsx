// 一旦我被更新，请更新我的开头注释
// input: props/TTS 依赖
// output: TTS UI
// pos: 领域组件
"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Upload } from "lucide-react";
import { toast } from "sonner";
import type { AudioPreviewUploadProps } from "./audio-preview-upload/types";
import { formatFileSize } from "./audio-preview-upload/utils";

export function AudioPreviewUpload({
  onUploadComplete,
  maxFileSize = 100 * 1024 * 1024,
  acceptedFormats = ["audio/*"],
}: AudioPreviewUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [description, setDescription] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > maxFileSize) {
      toast.error(`文件大小超过限制 (${Math.round(maxFileSize / 1024 / 1024)}MB)`);
      return;
    }

    if (!file.type.startsWith("audio/")) {
      toast.error("请选择音频文件");
      return;
    }

    setSelectedFile(file);
    setDescription(file.name.replace(/\.[^/.]+$/, ""));

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (description.trim()) {
        formData.append("description", description.trim());
      }

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          setUploadProgress((event.loaded / event.total) * 100);
        }
      });

      xhr.addEventListener("load", () => {
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

  return (
    <div className="space-y-6">
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
            <p className="mt-1 text-sm text-muted-foreground">
              支持格式: {acceptedFormats.join(", ")} | 最大大小: {Math.round(maxFileSize / 1024 / 1024)}MB
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
                    <audio controls className="w-full">
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
                  <p className="text-sm text-muted-foreground">{uploadProgress.toFixed(1)}%</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleUpload} disabled={isUploading} className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  {isUploading ? "上传中..." : "上传"}
                </Button>
                <Button variant="outline" onClick={resetForm} disabled={isUploading}>
                  取消
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {onUploadComplete && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              已上传的音频
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              上传完成后，音频将显示在这里。您可以在说话人管理页面查看所有音频。
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export { AudioList } from "./audio-preview-upload/AudioList";
