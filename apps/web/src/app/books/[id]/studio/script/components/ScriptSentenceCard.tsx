// 一旦我被更新，请更新我的开头注释
// input: props/hooks/组件依赖
// output: 局部 UI
// pos: 页面组件
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Edit,
  Trash2,
  Volume2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Zap,
} from "lucide-react";
import { ScriptSentence } from "@/lib/types";
import { toast } from "sonner";
import { ScriptProsodyDisplay } from "./prosody-display";

interface ScriptSentenceCardProps {
  sentence: ScriptSentence;
  index: number;
  bookId: string;
  onEdit: (sentence: ScriptSentence) => void;
  onDelete: (sentenceId: string) => void;
  onAudioGenerated: (
    sentenceId: string,
    audio: { audioFileId?: string; playbackUrl?: string }
  ) => void;
}

export function ScriptSentenceCard({
  sentence,
  index,
  bookId,
  onEdit,
  onDelete,
  onAudioGenerated,
}: ScriptSentenceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(
    sentence.audioFiles?.[0]?.id ? `/api/audio/${sentence.audioFiles[0].id}` : null
  );

  useEffect(() => {
    const latestAudio = sentence.audioFiles?.[0];
    setAudioUrl(latestAudio ? `/api/audio/${latestAudio.id}` : null);
  }, [sentence.audioFiles, sentence.id]);

  // Determine if text should be truncated (more than 100 characters)
  const shouldShowToggle = sentence.text.length > 100;
  const displayText = shouldShowToggle && !isExpanded
    ? sentence.text.substring(0, 100) + "..."
    : sentence.text;

  const handleGenerateAudio = async () => {
    if (!sentence.character) {
      toast.error("请先为台词分配角色");
      return;
    }

    setIsGeneratingAudio(true);
    try {
      const response = await fetch(
        `/api/books/${bookId}/script/${sentence.id}/audio`,
        {
          method: "POST",
        }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || "生成语音失败");
      }

      const playbackUrl: string | undefined = result.data?.playbackUrl;
      if (playbackUrl) {
        setAudioUrl(playbackUrl);
      }
      onAudioGenerated(sentence.id, {
        audioFileId: result.data?.audioFileId,
        playbackUrl,
      });
      toast.success("语音生成完成");
    } catch (error) {
      console.error("Failed to generate audio:", error);
      toast.error(error instanceof Error ? error.message : "生成语音失败");
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  return (
    <div className="flex items-start justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/40">
      <div className="flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            #{index + 1}
          </span>
          {sentence.character ? (
            <Badge variant="outline">
              <User className="w-3 h-3 mr-1" />
              {sentence.character.canonicalName} {/* 使用canonicalName */}
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="border-border bg-muted text-muted-foreground"
            >
              <Volume2 className="w-3 h-3 mr-1" />
              旁白
            </Badge>
          )}
          {sentence.tone && (
            <Badge
              variant="outline"
              className="border-border bg-accent/60 text-accent-foreground"
            >
              {sentence.tone}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            段落{" "}
            {sentence.segment?.orderIndex
              ? sentence.segment.orderIndex + 1
              : sentence.orderInSegment + 1}
          </span>
        </div>
        <ScriptProsodyDisplay
          strength={sentence.strength}
          pauseAfter={sentence.pauseAfter}
          prosody={sentence.prosody}
          className="mb-3"
        />
        <div className="text-foreground">
          <p>{displayText}</p>
          {shouldShowToggle && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-1 h-auto p-0 text-primary hover:bg-transparent hover:text-primary/80"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3 mr-1" />
                  收起
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3 mr-1" />
                  展开
                </>
              )}
            </Button>
          )}
        </div>
        {sentence.rawSpeaker &&
          sentence.rawSpeaker !== sentence.character?.canonicalName && (
            <p className="mt-1 text-xs text-muted-foreground">
              原始说话人: {sentence.rawSpeaker}
            </p>
          )}
        {audioUrl && (
          <div className="mt-3">
            <audio controls preload="none" className="w-full" src={audioUrl}>
              您的浏览器不支持音频播放
            </audio>
          </div>
        )}
      </div>
      <div className="flex space-x-1 ml-4 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGenerateAudio}
          disabled={!sentence.character || isGeneratingAudio}
          title={sentence.character ? "生成语音" : "请先分配角色"}
        >
          {isGeneratingAudio ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(sentence)}
          title="编辑台词"
        >
          <Edit className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(sentence.id)}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          title="删除台词"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
