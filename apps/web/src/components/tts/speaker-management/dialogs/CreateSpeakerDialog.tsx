import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { NewSpeakerForm, ReferenceAudio } from "../types";

interface CreateSpeakerDialogProps {
  open: boolean;
  newSpeaker: NewSpeakerForm;
  referenceAudios: ReferenceAudio[];
  onOpenChange: (open: boolean) => void;
  onNewSpeakerChange: (nextSpeaker: NewSpeakerForm) => void;
  onCreateSpeaker: () => Promise<void> | void;
}

export function CreateSpeakerDialog({
  open,
  newSpeaker,
  referenceAudios,
  onOpenChange,
  onNewSpeakerChange,
  onCreateSpeaker,
}: CreateSpeakerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建新说话人</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">名称</Label>
            <Input
              id="name"
              value={newSpeaker.name}
              onChange={(e) =>
                onNewSpeakerChange({
                  ...newSpeaker,
                  name: e.target.value,
                })
              }
              placeholder="输入说话人名称"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="gender">性别</Label>
              <Select
                value={newSpeaker.gender}
                onValueChange={(value) =>
                  onNewSpeakerChange({
                    ...newSpeaker,
                    gender: value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">未知</SelectItem>
                  <SelectItem value="male">男性</SelectItem>
                  <SelectItem value="female">女性</SelectItem>
                  <SelectItem value="neutral">中性</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ageGroup">年龄段</Label>
              <Select
                value={newSpeaker.ageGroup}
                onValueChange={(value) =>
                  onNewSpeakerChange({
                    ...newSpeaker,
                    ageGroup: value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="child">儿童</SelectItem>
                  <SelectItem value="teen">青少年</SelectItem>
                  <SelectItem value="adult">成人</SelectItem>
                  <SelectItem value="senior">老年</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="toneStyle">音调风格</Label>
            <Select
              value={newSpeaker.toneStyle}
              onValueChange={(value) =>
                onNewSpeakerChange({
                  ...newSpeaker,
                  toneStyle: value,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="neutral">中性</SelectItem>
                <SelectItem value="gentle">温柔</SelectItem>
                <SelectItem value="energetic">活力</SelectItem>
                <SelectItem value="serious">严肃</SelectItem>
                <SelectItem value="cheerful">开朗</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="referenceAudio">参考音频</Label>
            <Select
              value={newSpeaker.referenceAudio}
              onValueChange={(value) =>
                onNewSpeakerChange({
                  ...newSpeaker,
                  referenceAudio: value,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="选择参考音频（可选）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">无参考音频</SelectItem>
                {referenceAudios.map((audio) => (
                  <SelectItem key={audio.filename} value={audio.filename}>
                    {audio.originalName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="description">描述</Label>
            <Textarea
              id="description"
              value={newSpeaker.description}
              onChange={(e) =>
                onNewSpeakerChange({
                  ...newSpeaker,
                  description: e.target.value,
                })
              }
              placeholder="输入说话人描述"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={onCreateSpeaker} disabled={!newSpeaker.name.trim()}>
              创建
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
