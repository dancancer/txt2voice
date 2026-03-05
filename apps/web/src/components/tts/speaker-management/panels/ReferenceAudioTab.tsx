import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReferenceAudio } from "../types";
import { formatDuration, formatFileSize } from "../utils";

interface ReferenceAudioTabProps {
  loading: boolean;
  referenceAudios: ReferenceAudio[];
  paginatedReferenceAudios: ReferenceAudio[];
  audioPage: number;
  audioTotalPages: number;
  allowDelete?: boolean;
  selectedAudioFilenames: string[];
  isPlaying: string | null;
  onSetIsPlaying: (value: string | null) => void;
  onTogglePlay: (audioKey: string, elementId: string) => void;
  onDeleteAudio: (filename: string) => void;
  onToggleAudioSelection: (filename: string, checked: boolean) => void;
  onSetAudioSelectionForMany: (filenames: string[], checked: boolean) => void;
  onClearSelectedAudios: () => void;
  onDeleteSelectedAudios: (filenames: string[]) => void;
  onAudioPageChange: (page: number) => void;
}

export function ReferenceAudioTab({
  loading,
  referenceAudios,
  paginatedReferenceAudios,
  audioPage,
  audioTotalPages,
  allowDelete = true,
  selectedAudioFilenames,
  isPlaying,
  onSetIsPlaying,
  onTogglePlay,
  onDeleteAudio,
  onToggleAudioSelection,
  onSetAudioSelectionForMany,
  onClearSelectedAudios,
  onDeleteSelectedAudios,
  onAudioPageChange,
}: ReferenceAudioTabProps) {
  if (loading) {
    return <div className="py-8 text-center">加载中...</div>;
  }

  if (referenceAudios.length === 0) {
    return <div className="py-8 text-center text-sm text-gray-500">暂无参考音频</div>;
  }

  const selectedSet = new Set(selectedAudioFilenames);
  const pageSelectable = paginatedReferenceAudios
    .filter((audio) => allowDelete && audio.audioType !== "example")
    .map((audio) => audio.filename);
  const selectedOnPage = pageSelectable.filter((name) => selectedSet.has(name)).length;
  const hasSelection = selectedAudioFilenames.length > 0;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm text-slate-700">已选择 {selectedAudioFilenames.length} 条音频</p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pageSelectable.length === 0 || selectedOnPage === pageSelectable.length}
            onClick={() => onSetAudioSelectionForMany(pageSelectable, true)}
          >
            本页全选
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={selectedOnPage === 0}
            onClick={() => onSetAudioSelectionForMany(pageSelectable, false)}
          >
            取消本页
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!hasSelection}
            onClick={onClearSelectedAudios}
          >
            清空选择
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={!hasSelection}
            onClick={() => onDeleteSelectedAudios(selectedAudioFilenames)}
          >
            批量删除
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {paginatedReferenceAudios.map((audio) => {
          const canDelete = allowDelete && audio.audioType !== "example";
          const checked = selectedSet.has(audio.filename);
          return (
            <Card key={audio.filename} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="truncate text-lg">{audio.originalName}</CardTitle>
                  <div className="flex items-center gap-2">
                    {canDelete && (
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          onToggleAudioSelection(audio.filename, event.target.checked)
                        }
                        className="h-4 w-4 accent-indigo-600"
                      />
                    )}
                    <Badge variant={audio.audioType === "example" ? "default" : "secondary"}>
                      {audio.audioType === "example"
                        ? "示例"
                        : audio.audioType === "uploaded"
                          ? "上传"
                          : "情感"}
                    </Badge>
                  </div>
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
                  <p className="text-sm text-gray-600">{audio.description}</p>
                )}
                <div className="mt-2">
                  <audio
                    id={`reference-audio-${audio.filename}`}
                    src={audio.url}
                    controls
                    className="w-full"
                    onPlay={() => onSetIsPlaying(audio.filename)}
                    onEnded={() => onSetIsPlaying(null)}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onTogglePlay(audio.filename, `reference-audio-${audio.filename}`)
                    }
                  >
                    {isPlaying === audio.filename ? "停止" : "播放"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={!canDelete}
                    onClick={() => onDeleteAudio(audio.filename)}
                  >
                    {canDelete ? "删除" : "示例不可删"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {audioTotalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => onAudioPageChange(Math.max(1, audioPage - 1))}
            disabled={audioPage === 1}
          >
            上一页
          </Button>
          <span className="text-sm">
            参考音频 第 {audioPage} 页，共 {audioTotalPages} 页（共 {referenceAudios.length} 条）
          </span>
          <Button
            variant="outline"
            onClick={() => onAudioPageChange(Math.min(audioTotalPages, audioPage + 1))}
            disabled={audioPage === audioTotalPages}
          >
            下一页
          </Button>
        </div>
      )}
    </>
  );
}
