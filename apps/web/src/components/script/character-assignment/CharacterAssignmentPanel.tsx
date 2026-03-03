import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AudioPreviewUpload } from "@/components/tts/AudioPreviewUpload";
import {
  Ear,
  Mic,
  Pause,
  Play,
  Settings,
  Upload,
  User,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchSpeakers,
  requestSynthesisPreview,
} from "@/components/script/character-assignment/speaker-service";
import type {
  CharacterAssignmentProps,
  Speaker,
} from "@/components/script/character-assignment/types";

const DEFAULT_PREVIEW_TEXT = "这是一个测试语音合成的句子。";

const getSegmentLabel = (sentence: CharacterAssignmentProps["scriptSentences"][number]) => {
  return sentence.segment?.orderIndex
    ? sentence.segment.orderIndex + 1
    : sentence.orderInSegment + 1;
};

const getAudioElement = (filename: string): HTMLAudioElement | null => {
  return document.getElementById(`audio-${filename}`) as HTMLAudioElement | null;
};

interface SpeakerDialogProps {
  loadingSpeakers: boolean;
  speakers: Speaker[];
  isPlaying: string | null;
  onPlayAudio: (speaker: Speaker) => void;
  onTestSynthesis: (speaker: Speaker) => void;
  onStop: () => void;
}

function SpeakerDialog({
  loadingSpeakers,
  speakers,
  isPlaying,
  onPlayAudio,
  onTestSynthesis,
  onStop,
}: SpeakerDialogProps) {
  if (loadingSpeakers) {
    return <div className="py-8 text-center">加载中...</div>;
  }

  if (speakers.length === 0) {
    return <div className="py-8 text-center text-gray-500">暂无说话人，请先在说话人管理页面创建说话人。</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {speakers.map((speaker) => (
        <div key={speaker.id} className="space-y-3 rounded-lg border p-4">
          <div className="flex items-start justify-between">
            <h4 className="font-medium">{speaker.name}</h4>
            <Badge variant={speaker.isActive ? "default" : "secondary"}>
              {speaker.isActive ? "活跃" : "非活跃"}
            </Badge>
          </div>

          <div className="space-y-1 text-sm">
            <p>
              <strong>ID:</strong> {speaker.speakerId}
            </p>
            <p>
              <strong>性别:</strong> {speaker.gender}
            </p>
            <p>
              <strong>年龄段:</strong> {speaker.ageGroup}
            </p>
            <p>
              <strong>音调风格:</strong> {speaker.toneStyle}
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

          {speaker.description && <p className="text-sm text-gray-600">{speaker.description}</p>}

          {speaker.referenceAudio && (
            <div className="space-y-2">
              <p className="text-sm font-medium">参考音频:</p>
              <audio
                id={`audio-${speaker.referenceAudio}`}
                src={`/api/tts/reference-audio/${speaker.referenceAudio}`}
                controls
                className="w-full"
                onEnded={onStop}
              />
            </div>
          )}

          <div className="flex gap-2 border-t pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPlayAudio(speaker)}
              disabled={!speaker.referenceAudio}
              className="flex items-center gap-1"
            >
              {isPlaying === speaker.referenceAudio ? (
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTestSynthesis(speaker)}
              disabled={!speaker.referenceAudio}
              className="flex items-center gap-1"
            >
              <Volume2 className="h-3 w-3" />
              测试
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CharacterAssignmentPanel({
  scriptSentences,
  characters,
  showCharacterAssignment,
  onToggleAssignment,
  onSentenceCharacterChange,
  onSaveAssignment,
}: CharacterAssignmentProps) {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [showSpeakerDialog, setShowSpeakerDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [loadingSpeakers, setLoadingSpeakers] = useState(false);

  const assignedCount = scriptSentences.filter((sentence) => sentence.character?.id).length;
  const assignmentProgress =
    scriptSentences.length > 0 ? (assignedCount / scriptSentences.length) * 100 : 0;

  const loadSpeakers = async () => {
    setLoadingSpeakers(true);
    try {
      const nextSpeakers = await fetchSpeakers();
      setSpeakers(nextSpeakers);
    } catch (error) {
      console.error("Failed to fetch speakers:", error);
      toast.error("获取说话人列表失败");
    } finally {
      setLoadingSpeakers(false);
    }
  };

  const handlePlayAudio = (speaker: Speaker) => {
    if (!speaker.referenceAudio) {
      return;
    }

    if (isPlaying === speaker.referenceAudio) {
      const currentAudio = getAudioElement(speaker.referenceAudio);
      currentAudio?.pause();
      setIsPlaying(null);
      return;
    }

    const audio = getAudioElement(speaker.referenceAudio);
    audio?.play();
    setIsPlaying(speaker.referenceAudio);
  };

  const handleTestSynthesis = async (speaker: Speaker) => {
    try {
      const previewUrl = await requestSynthesisPreview(speaker, DEFAULT_PREVIEW_TEXT);
      toast.success("语音合成测试成功");
      if (previewUrl) {
        void new Audio(previewUrl).play();
      }
    } catch (error) {
      console.error("Failed to test synthesis:", error);
      toast.error(error instanceof Error ? error.message : "语音合成测试失败");
    }
  };

  useEffect(() => {
    if (showCharacterAssignment) {
      void loadSpeakers();
    }
  }, [showCharacterAssignment]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <User className="mr-2 h-5 w-5" />
            角色分配
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onToggleAssignment}>
            <Settings className="mr-2 h-4 w-4" />
            {showCharacterAssignment ? "收起" : "配置"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">已分配角色</span>
            <span className="font-medium">
              {assignedCount} / {scriptSentences.length}
            </span>
          </div>
          <Progress value={assignmentProgress} className="mt-2" />
        </div>

        {showCharacterAssignment && (
          <div className="space-y-4">
            {scriptSentences.slice(0, 10).map((sentence) => (
              <div
                key={sentence.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex-1">
                  <p className="line-clamp-2 text-sm text-gray-900">{sentence.text}</p>
                  <p className="mt-1 text-xs text-gray-500">段落 {getSegmentLabel(sentence)}</p>
                </div>
                <select
                  className="ml-4 rounded-md border border-gray-300 px-3 py-1 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  value={sentence.characterId || ""}
                  onChange={(event) =>
                    onSentenceCharacterChange(sentence.id, event.target.value)
                  }
                >
                  <option value="">选择角色</option>
                  <option value="">旁白</option>
                  {characters
                    .filter((character) => character.isActive)
                    .map((character) => (
                      <option key={character.id} value={character.id}>
                        {character.canonicalName}
                      </option>
                    ))}
                </select>
              </div>
            ))}

            <div className="mt-6 border-t pt-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center text-lg font-medium">
                  <Mic className="mr-2 h-5 w-5" />
                  说话人管理
                </h3>
                <div className="flex gap-2">
                  <Dialog open={showSpeakerDialog} onOpenChange={setShowSpeakerDialog}>
                    <DialogTrigger>
                      <Button variant="outline" size="sm">
                        <Settings className="mr-2 h-4 w-4" />
                        管理说话人
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>说话人管理</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <SpeakerDialog
                          loadingSpeakers={loadingSpeakers}
                          speakers={speakers}
                          isPlaying={isPlaying}
                          onPlayAudio={handlePlayAudio}
                          onTestSynthesis={handleTestSynthesis}
                          onStop={() => setIsPlaying(null)}
                        />

                        <div className="flex justify-end border-t pt-4">
                          <Button variant="outline" onClick={() => window.open("/tts/speakers", "_blank")}>
                            打开说话人管理页面
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                    <DialogTrigger>
                      <Button variant="outline" size="sm">
                        <Upload className="mr-2 h-4 w-4" />
                        上传参考音频
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>上传参考音频</DialogTitle>
                      </DialogHeader>
                      <AudioPreviewUpload
                        onUploadComplete={() => {
                          toast.success("参考音频上传成功");
                          void loadSpeakers();
                        }}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={onSaveAssignment}>保存分配</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
