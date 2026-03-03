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
import type { ReferenceAudio, Speaker } from "../types";

interface EditSpeakerDialogProps {
  open: boolean;
  editingSpeaker: Speaker | null;
  referenceAudios: ReferenceAudio[];
  onOpenChange: (open: boolean) => void;
  onEditingSpeakerChange: (speaker: Speaker | null) => void;
  onUpdateSpeaker: () => Promise<void> | void;
}

export function EditSpeakerDialog({
  open,
  editingSpeaker,
  referenceAudios,
  onOpenChange,
  onEditingSpeakerChange,
  onUpdateSpeaker,
}: EditSpeakerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑说话人</DialogTitle>
        </DialogHeader>
        {editingSpeaker && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="editName">名称</Label>
              <Input
                id="editName"
                value={editingSpeaker.name}
                onChange={(e) =>
                  onEditingSpeakerChange({
                    ...editingSpeaker,
                    name: e.target.value,
                  })
                }
                placeholder="输入说话人名称"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editGender">性别</Label>
                <Select
                  value={editingSpeaker.gender}
                  onValueChange={(value) =>
                    onEditingSpeakerChange({
                      ...editingSpeaker,
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
                <Label htmlFor="editAgeGroup">年龄段</Label>
                <Select
                  value={editingSpeaker.ageGroup}
                  onValueChange={(value) =>
                    onEditingSpeakerChange({
                      ...editingSpeaker,
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
              <Label htmlFor="editToneStyle">音调风格</Label>
              <Select
                value={editingSpeaker.toneStyle}
                onValueChange={(value) =>
                  onEditingSpeakerChange({
                    ...editingSpeaker,
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
              <Label htmlFor="editDescription">描述</Label>
              <Textarea
                id="editDescription"
                value={editingSpeaker.description}
                onChange={(e) =>
                  onEditingSpeakerChange({
                    ...editingSpeaker,
                    description: e.target.value,
                  })
                }
                placeholder="输入说话人描述"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="editReferenceAudio">参考音频</Label>
              <Select
                value={editingSpeaker.referenceAudio || ""}
                onValueChange={(value) =>
                  onEditingSpeakerChange({
                    ...editingSpeaker,
                    referenceAudio: value || null,
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
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="editIsActive"
                checked={editingSpeaker.isActive}
                onChange={(e) =>
                  onEditingSpeakerChange({
                    ...editingSpeaker,
                    isActive: e.target.checked,
                  })
                }
              />
              <Label htmlFor="editIsActive">活跃状态</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onEditingSpeakerChange(null);
                }}
              >
                取消
              </Button>
              <Button onClick={onUpdateSpeaker} disabled={!editingSpeaker.name.trim()}>
                更新
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
