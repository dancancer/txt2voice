import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { indexTTSService } from "@/lib/indextts-service";
import type { ReferenceAudio, Speaker } from "../types";
import {
  translateAgeGroup,
  translateGender,
  translateToneStyle,
} from "../utils";

interface SpeakerListTabProps {
  loading: boolean;
  speakers: Speaker[];
  referenceAudios: ReferenceAudio[];
  currentPage: number;
  totalPages: number;
  isPlaying: string | null;
  onSetIsPlaying: (value: string | null) => void;
  onOpenEditDialog: (speaker: Speaker) => void;
  onDeleteSpeaker: (speakerId: string, speakerName: string) => void;
  onPageChange: (page: number) => void;
}

export function SpeakerListTab({
  loading,
  speakers,
  referenceAudios,
  currentPage,
  totalPages,
  isPlaying,
  onSetIsPlaying,
  onOpenEditDialog,
  onDeleteSpeaker,
  onPageChange,
}: SpeakerListTabProps) {
  if (loading) {
    return <div className="py-8 text-center">加载中...</div>;
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {speakers.map((speaker) => {
          const referenceAudio = referenceAudios.find(
            (audio) => audio.filename === speaker.referenceAudio
          );
          const audioUrl =
            referenceAudio?.url ||
            (speaker.referenceAudio
              ? indexTTSService.getPublicAudioUrl(speaker.referenceAudio)
              : null);

          return (
            <Card key={speaker.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{speaker.name}</CardTitle>
                  <Badge variant={speaker.isActive ? "default" : "secondary"}>
                    {speaker.isActive ? "活跃" : "非活跃"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="space-y-1 text-sm">
                  <p>
                    <strong>ID:</strong> {speaker.speakerId}
                  </p>
                  <p>
                    <strong>性别:</strong> {translateGender(speaker.gender)}
                  </p>
                  <p>
                    <strong>年龄段:</strong> {translateAgeGroup(speaker.ageGroup)}
                  </p>
                  <p>
                    <strong>音调风格:</strong> {translateToneStyle(speaker.toneStyle)}
                  </p>
                  {speaker.confidence && (
                    <p>
                      <strong>置信度:</strong> {(speaker.confidence * 100).toFixed(1)}%
                    </p>
                  )}
                  <p>
                    <strong>使用次数:</strong> {speaker.usageCount}
                  </p>
                  {speaker.lastUsedAt && (
                    <p>
                      <strong>最后使用:</strong> {new Date(speaker.lastUsedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                {speaker.description && (
                  <p className="text-sm text-gray-600">{speaker.description}</p>
                )}
                {speaker.referenceAudio && audioUrl && (
                  <div className="mt-2">
                    <p className="text-sm font-medium">参考音频:</p>
                    <audio
                      id={`speaker-audio-${speaker.referenceAudio}`}
                      src={audioUrl}
                      controls
                      className="mt-1 w-full"
                      onPlay={() => onSetIsPlaying(speaker.referenceAudio)}
                      onEnded={() => onSetIsPlaying(null)}
                      onError={(e) => {
                        console.error(`Failed to load audio: ${audioUrl}`, e);
                        const fallbackUrl = `${
                          process.env.NEXT_PUBLIC_INDEXTTS_API_URL ||
                          "http://192.168.88.9:8001"
                        }/api/audio/file/${speaker.referenceAudio}`;
                        (e.target as HTMLAudioElement).src = fallbackUrl;
                      }}
                    />
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenEditDialog(speaker)}
                  >
                    编辑
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDeleteSpeaker(speaker.id, speaker.name)}
                  >
                    删除
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            上一页
          </Button>
          <span className="text-sm">
            第 {currentPage} 页，共 {totalPages} 页
          </span>
          <Button
            variant="outline"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            下一页
          </Button>
        </div>
      )}

      {isPlaying && <span className="sr-only">当前正在播放: {isPlaying}</span>}
    </>
  );
}
