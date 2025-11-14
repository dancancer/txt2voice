import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  User,
  Settings,
  Mic,
  Play,
  Pause,
  Volume2,
  Upload,
  Ear,
} from "lucide-react";
import { ScriptSentence, CharacterProfile } from "./types";
import { toast } from "sonner";
import { AudioPreviewUpload } from "@/components/tts/AudioPreviewUpload";

interface Speaker {
  id: string;
  speakerId: string;
  name: string;
  gender: string;
  ageGroup: string;
  toneStyle: string;
  description: string;
  referenceAudio: string | null;
  confidence: number | null;
  isActive: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CharacterAssignmentProps {
  scriptSentences: ScriptSentence[];
  characters: CharacterProfile[];
  showCharacterAssignment: boolean;
  onToggleAssignment: () => void;
  onSentenceCharacterChange: (sentenceId: string, characterId: string) => void;
  onSaveAssignment: () => void;
}

export function CharacterAssignment({
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

  const assignedCount = scriptSentences.filter(
    (s) => s.character && s.character.id
  ).length;
  const assignmentProgress =
    scriptSentences.length > 0
      ? (assignedCount / scriptSentences.length) * 100
      : 0;

  // 获取说话人列表
  const fetchSpeakers = async () => {
    setLoadingSpeakers(true);
    try {
      const response = await fetch("/api/tts/speakers?limit=50");
      const data = await response.json();
      if (data.success) {
        setSpeakers(data.data.speakers);
      }
    } catch (error) {
      console.error("Failed to fetch speakers:", error);
      toast.error("获取说话人列表失败");
    } finally {
      setLoadingSpeakers(false);
    }
  };

  // 播放音频
  const playAudio = (audioUrl: string, filename: string) => {
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

  // 测试语音合成
  const testSynthesis = async (
    speaker: Speaker,
    text: string = "这是一个测试语音合成的句子。"
  ) => {
    try {
      const response = await fetch("/api/tts/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          provider: "indextts",
          referenceAudio: speaker.referenceAudio,
          emotionControlMethod: "Same as voice reference",
          outputFormat: "mp3",
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success("语音合成测试成功");
        // 可以播放合成的音频
        if (data.data.audioUrl) {
          const audio = new Audio(data.data.audioUrl);
          audio.play();
        }
      } else {
        toast.error(data.error || "语音合成测试失败");
      }
    } catch (error) {
      console.error("Failed to test synthesis:", error);
      toast.error("语音合成测试失败");
    }
  };

  useEffect(() => {
    if (showCharacterAssignment) {
      fetchSpeakers();
    }
  }, [showCharacterAssignment]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <User className="w-5 h-5 mr-2" />
            角色分配
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onToggleAssignment}>
            <Settings className="w-4 h-4 mr-2" />
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
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <p className="text-sm text-gray-900 line-clamp-2">
                    {sentence.text}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    段落{" "}
                    {sentence.segment?.orderIndex
                      ? sentence.segment.orderIndex + 1
                      : sentence.orderInSegment + 1}
                  </p>
                </div>
                <select
                  className="ml-4 px-3 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={sentence.characterId || ""}
                  onChange={(e) =>
                    onSentenceCharacterChange(sentence.id, e.target.value)
                  }
                >
                  <option value="">选择角色</option>
                  <option value="">旁白</option>
                  {characters
                    .filter((c) => c.isActive)
                    .map((character) => (
                      <option key={character.id} value={character.id}>
                        {character.canonicalName}
                      </option>
                    ))}
                </select>
              </div>
            ))}

            {/* 说话人管理部分 */}
            <div className="border-t pt-4 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium flex items-center">
                  <Mic className="w-5 h-5 mr-2" />
                  说话人管理
                </h3>
                <div className="flex gap-2">
                  <Dialog
                    open={showSpeakerDialog}
                    onOpenChange={setShowSpeakerDialog}
                  >
                    <DialogTrigger>
                      <Button variant="outline" size="sm">
                        <Settings className="w-4 h-4 mr-2" />
                        管理说话人
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>说话人管理</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        {loadingSpeakers ? (
                          <div className="text-center py-8">加载中...</div>
                        ) : speakers.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            暂无说话人，请先在说话人管理页面创建说话人。
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {speakers.map((speaker) => (
                              <div
                                key={speaker.id}
                                className="border rounded-lg p-4 space-y-3"
                              >
                                <div className="flex justify-between items-start">
                                  <h4 className="font-medium">
                                    {speaker.name}
                                  </h4>
                                  <Badge
                                    variant={
                                      speaker.isActive ? "default" : "secondary"
                                    }
                                  >
                                    {speaker.isActive ? "活跃" : "非活跃"}
                                  </Badge>
                                </div>

                                <div className="text-sm space-y-1">
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
                                    <strong>音调风格:</strong>{" "}
                                    {speaker.toneStyle}
                                  </p>
                                  {speaker.confidence && (
                                    <p>
                                      <strong>置信度:</strong>{" "}
                                      {(speaker.confidence * 100).toFixed(1)}%
                                    </p>
                                  )}
                                  <p>
                                    <strong>使用次数:</strong>{" "}
                                    {speaker.usageCount}
                                  </p>
                                  {speaker.lastUsedAt && (
                                    <p>
                                      <strong>最后使用:</strong>{" "}
                                      {new Date(
                                        speaker.lastUsedAt
                                      ).toLocaleString()}
                                    </p>
                                  )}
                                </div>

                                {speaker.description && (
                                  <p className="text-sm text-gray-600">
                                    {speaker.description}
                                  </p>
                                )}

                                {speaker.referenceAudio && (
                                  <div className="space-y-2">
                                    <p className="text-sm font-medium">
                                      参考音频:
                                    </p>
                                    <audio
                                      id={`audio-${speaker.referenceAudio}`}
                                      src={`/api/tts/reference-audio/${speaker.referenceAudio}`}
                                      controls
                                      className="w-full"
                                      onEnded={() => setIsPlaying(null)}
                                    />
                                  </div>
                                )}

                                <div className="flex gap-2 pt-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      speaker.referenceAudio &&
                                      playAudio(
                                        `/api/tts/reference-audio/${speaker.referenceAudio}`,
                                        speaker.referenceAudio
                                      )
                                    }
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
                                    onClick={() => testSynthesis(speaker)}
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
                        )}

                        <div className="flex justify-end pt-4 border-t">
                          <Button
                            variant="outline"
                            onClick={() =>
                              window.open("/tts/speakers", "_blank")
                            }
                          >
                            打开说话人管理页面
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Dialog
                    open={showUploadDialog}
                    onOpenChange={setShowUploadDialog}
                  >
                    <DialogTrigger>
                      <Button variant="outline" size="sm">
                        <Upload className="w-4 h-4 mr-2" />
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
                          fetchSpeakers(); // 刷新说话人列表
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
