import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { UploadAudioPreview } from "../types";
import { formatFileSize } from "../utils";

interface UploadAudioDialogProps {
  open: boolean;
  selectedAudioPreview: UploadAudioPreview | null;
  isUploading: boolean;
  uploadProgress: number;
  onOpenChange: (open: boolean) => void;
  onSelectFile: (file: File | null) => void;
  onUpload: () => Promise<void> | void;
}

export function UploadAudioDialog({
  open,
  selectedAudioPreview,
  isUploading,
  uploadProgress,
  onOpenChange,
  onSelectFile,
  onUpload,
}: UploadAudioDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>上传参考音频</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="audioFile">音频文件</Label>
            <Input
              id="audioFile"
              type="file"
              accept=".wav,.mp3,.flac,.m4a,.ogg,audio/wav,audio/mp3,audio/mpeg,audio/flac,audio/m4a,audio/x-m4a,audio/ogg"
              onChange={(e) => onSelectFile(e.target.files?.[0] || null)}
              disabled={isUploading}
            />
          </div>
          {selectedAudioPreview && (
            <div className="space-y-2 text-sm">
              <p>
                <strong>文件名:</strong> {selectedAudioPreview.originalName}
              </p>
              <p>
                <strong>文件大小:</strong> {formatFileSize(selectedAudioPreview.fileSize)}
              </p>
              <p>
                <strong>格式:</strong> {selectedAudioPreview.format}
              </p>
            </div>
          )}
          {isUploading && (
            <div className="space-y-2">
              <Label>上传进度</Label>
              <Progress value={uploadProgress} className="w-full" />
              <p className="text-sm text-muted-foreground">{uploadProgress.toFixed(1)}%</p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
            >
              取消
            </Button>
            <Button onClick={onUpload} disabled={!selectedAudioPreview || isUploading}>
              上传
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
