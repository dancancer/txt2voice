"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { IndexTTSService } from "@/lib/indextts-service";

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

interface ReferenceAudio {
  filename: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  duration: number;
  sampleRate: number;
  format: string;
  audioType: "example" | "uploaded" | "emotion";
  description?: string;
  speakerId?: string;
  url: string;
  speaker?: Speaker | null;
}

// Helper function to translate gender to Chinese
const translateGender = (gender: string) => {
  const genderMap: { [key: string]: string } = {
    male: "男性",
    female: "女性",
    neutral: "中性",
    unknown: "未知",
  };
  return genderMap[gender] || gender;
};

// Helper function to translate age group to Chinese
const translateAgeGroup = (ageGroup: string) => {
  const ageGroupMap: { [key: string]: string } = {
    child: "儿童",
    teen: "青少年",
    adult: "成人",
    senior: "老年",
  };
  return ageGroupMap[ageGroup] || ageGroup;
};

// Helper function to translate tone style to Chinese
const translateToneStyle = (toneStyle: string) => {
  const toneStyleMap: { [key: string]: string } = {
    neutral: "中性",
    gentle: "温柔",
    energetic: "活力",
    serious: "严肃",
    cheerful: "开朗",
  };
  return toneStyleMap[toneStyle] || toneStyle;
};

const AUDIO_PAGE_SIZE = 9;

export function SpeakerManagement() {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [referenceAudios, setReferenceAudios] = useState<ReferenceAudio[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterGender, setFilterGender] = useState<string>("");
  const [filterAgeGroup, setFilterAgeGroup] = useState<string>("");
  const [filterActive, setFilterActive] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [audioPage, setAudioPage] = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState<ReferenceAudio | null>(
    null
  );
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const paginatedReferenceAudios = useMemo(() => {
    const startIndex = (audioPage - 1) * AUDIO_PAGE_SIZE;
    return referenceAudios.slice(startIndex, startIndex + AUDIO_PAGE_SIZE);
  }, [referenceAudios, audioPage]);

  const audioTotalPages = Math.max(
    1,
    Math.ceil(referenceAudios.length / AUDIO_PAGE_SIZE)
  );

  // 新建说话人表单
  const [newSpeaker, setNewSpeaker] = useState({
    name: "",
    gender: "unknown",
    ageGroup: "adult",
    toneStyle: "neutral",
    description: "",
    referenceAudio: "",
  });

  // 编辑说话人表单
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null);

  // 获取说话人列表
  const fetchSpeakers = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
        ...(searchTerm && { search: searchTerm }),
        ...(filterGender && { gender: filterGender }),
        ...(filterAgeGroup && { ageGroup: filterAgeGroup }),
        ...(filterActive && { isActive: filterActive }),
      });

      const response = await fetch(`/api/tts/speakers?${params}`);
      const data = await response.json();

      if (data.success) {
        setSpeakers(data.data.speakers);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Failed to fetch speakers:", error);
      toast.error("获取说话人列表失败");
    }
  };

  // 获取参考音频列表
  const fetchReferenceAudios = async () => {
    try {
      const allAudios: ReferenceAudio[] = [];
      const limit = 20; // 与接口默认分页保持一致，方便累计所有页面
      let page = 1;
      let hasNext = true;

      while (hasNext) {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        });

        const response = await fetch(`/api/tts/reference-audio?${params}`);
        const data = await response.json();

        if (!data.success) {
          break;
        }

        allAudios.push(...data.data.audios);
        hasNext = data.data.pagination?.hasNext ?? false;
        page += 1;
      }

      setReferenceAudios(allAudios);
    } catch (error) {
      console.error("Failed to fetch reference audios:", error);
      toast.error("获取参考音频列表失败");
    }
  };

  // 创建说话人
  const createSpeaker = async () => {
    try {
      const response = await fetch("/api/tts/speakers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSpeaker),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("说话人创建成功");
        setIsCreateDialogOpen(false);
        setNewSpeaker({
          name: "",
          gender: "unknown",
          ageGroup: "adult",
          toneStyle: "neutral",
          description: "",
          referenceAudio: "",
        });
        fetchSpeakers();
      } else {
        toast.error(data.error || "创建说话人失败");
      }
    } catch (error) {
      console.error("Failed to create speaker:", error);
      toast.error("创建说话人失败");
    }
  };

  // 编辑说话人
  const updateSpeaker = async () => {
    if (!editingSpeaker) return;

    try {
      const response = await fetch(`/api/tts/speakers/${editingSpeaker.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingSpeaker.name,
          gender: editingSpeaker.gender,
          ageGroup: editingSpeaker.ageGroup,
          toneStyle: editingSpeaker.toneStyle,
          description: editingSpeaker.description,
          referenceAudio: editingSpeaker.referenceAudio,
          isActive: editingSpeaker.isActive,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("说话人更新成功");
        setIsEditDialogOpen(false);
        setEditingSpeaker(null);
        fetchSpeakers();
      } else {
        toast.error(data.error || "更新说话人失败");
      }
    } catch (error) {
      console.error("Failed to update speaker:", error);
      toast.error("更新说话人失败");
    }
  };

  // 删除说话人
  const deleteSpeaker = async (speakerId: string, speakerName: string) => {
    if (!confirm(`确定要删除说话人"${speakerName}"吗？此操作不可撤销。`)) {
      return;
    }

    try {
      const response = await fetch(`/api/tts/speakers/${speakerId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        toast.success("说话人删除成功");
        fetchSpeakers();
      } else {
        toast.error(data.error || "删除说话人失败");
      }
    } catch (error) {
      console.error("Failed to delete speaker:", error);
      toast.error("删除说话人失败");
    }
  };

  // 打开编辑对话框
  const openEditDialog = (speaker: Speaker) => {
    setEditingSpeaker(speaker);
    setIsEditDialogOpen(true);
  };

  // 上传参考音频
  const uploadReferenceAudio = async (file: File, description?: string) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (description) {
        formData.append("description", description);
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
            setIsUploadDialogOpen(false);
            setUploadProgress(0);
            await fetchReferenceAudios();
            await fetchSpeakers();
          } else {
            toast.error(data.error || "音频上传失败");
          }
        } else {
          toast.error("音频上传失败");
        }
        setIsUploading(false);
      });

      xhr.addEventListener("error", () => {
        toast.error("音频上传失败");
        setIsUploading(false);
        setUploadProgress(0);
      });

      xhr.open("POST", "/api/tts/reference-audio");
      xhr.send(formData);
    } catch (error) {
      console.error("Failed to upload audio:", error);
      toast.error("音频上传失败");
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // 删除参考音频
  const deleteReferenceAudio = async (filename: string) => {
    if (!confirm("确定要删除这个参考音频吗？")) {
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
        await fetchReferenceAudios();
        await fetchSpeakers();
      } else {
        toast.error(data.error || "音频删除失败");
      }
    } catch (error) {
      console.error("Failed to delete audio:", error);
      toast.error("音频删除失败");
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

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // 格式化时长
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (audioPage > audioTotalPages) {
      setAudioPage(audioTotalPages);
    }
  }, [audioTotalPages, audioPage]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchSpeakers(), fetchReferenceAudios()]);
      setLoading(false);
    };

    loadData();
  }, [currentPage, searchTerm, filterGender, filterAgeGroup, filterActive]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">说话人管理</h1>
        <div className="flex gap-2">
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            新建说话人
          </Button>
          <Button onClick={() => setIsUploadDialogOpen(true)}>
            上传参考音频
          </Button>

          {/* 创建说话人弹窗 */}
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
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
                      setNewSpeaker({ ...newSpeaker, name: e.target.value })
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
                        setNewSpeaker({ ...newSpeaker, gender: value })
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
                        setNewSpeaker({
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
                      setNewSpeaker({
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
                      setNewSpeaker({
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
                      setNewSpeaker({
                        ...newSpeaker,
                        description: e.target.value,
                      })
                    }
                    placeholder="输入说话人描述"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    取消
                  </Button>
                  <Button onClick={createSpeaker}>创建</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* 上传参考音频弹窗 */}
          <Dialog
            open={isUploadDialogOpen}
            onOpenChange={setIsUploadDialogOpen}
          >
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
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSelectedAudio({
                          filename: "",
                          originalName: file.name,
                          filePath: "",
                          fileSize: file.size,
                          duration: 0,
                          sampleRate: 0,
                          format: file.type,
                          audioType: "uploaded",
                          url: "",
                        });
                      }
                    }}
                  />
                </div>
                {selectedAudio && (
                  <div className="space-y-2">
                    <p>
                      <strong>文件名:</strong> {selectedAudio.originalName}
                    </p>
                    <p>
                      <strong>文件大小:</strong>{" "}
                      {formatFileSize(selectedAudio.fileSize)}
                    </p>
                    <p>
                      <strong>格式:</strong> {selectedAudio.format}
                    </p>
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
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsUploadDialogOpen(false)}
                    disabled={isUploading}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={() => {
                      const fileInput = document.getElementById(
                        "audioFile"
                      ) as HTMLInputElement;
                      const file = fileInput.files?.[0];
                      if (file) {
                        // 客户端验证
                        const validation =
                          IndexTTSService.validateAudioFile(file);
                        if (!validation.valid) {
                          toast.error(validation.error);
                          return;
                        }
                        uploadReferenceAudio(file, selectedAudio?.originalName);
                      }
                    }}
                    disabled={!selectedAudio || isUploading}
                  >
                    上传
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
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
                        setEditingSpeaker({
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
                          setEditingSpeaker({
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
                          setEditingSpeaker({
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
                        setEditingSpeaker({
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
                        setEditingSpeaker({
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
                        setEditingSpeaker({
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
                          <SelectItem
                            key={audio.filename}
                            value={audio.filename}
                          >
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
                        setEditingSpeaker({
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
                        setIsEditDialogOpen(false);
                        setEditingSpeaker(null);
                      }}
                    >
                      取消
                    </Button>
                    <Button onClick={updateSpeaker}>更新</Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 筛选控件 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <Label htmlFor="search">搜索</Label>
          <Input
            id="search"
            placeholder="搜索说话人名称或描述"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="gender">性别</Label>
          <Select
            value={filterGender}
            onValueChange={(value) => setFilterGender(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择性别" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部</SelectItem>
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
            value={filterAgeGroup}
            onValueChange={(value) => setFilterAgeGroup(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择年龄段" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部</SelectItem>
              <SelectItem value="child">儿童</SelectItem>
              <SelectItem value="teen">青少年</SelectItem>
              <SelectItem value="adult">成人</SelectItem>
              <SelectItem value="senior">老年</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="active">状态</Label>
          <Select
            value={filterActive}
            onValueChange={(value) => setFilterActive(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部</SelectItem>
              <SelectItem value="true">活跃</SelectItem>
              <SelectItem value="false">非活跃</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="speakers" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="speakers">说话人列表</TabsTrigger>
          <TabsTrigger value="audios">参考音频</TabsTrigger>
        </TabsList>

        <TabsContent value="speakers" className="space-y-4">
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {speakers.map((speaker) => (
                <Card key={speaker.id} className="relative">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{speaker.name}</CardTitle>
                      <Badge
                        variant={speaker.isActive ? "default" : "secondary"}
                      >
                        {speaker.isActive ? "活跃" : "非活跃"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-sm space-y-1">
                      <p>
                        <strong>ID:</strong> {speaker.speakerId}
                      </p>
                      <p>
                        <strong>性别:</strong> {translateGender(speaker.gender)}
                      </p>
                      <p>
                        <strong>年龄段:</strong>{" "}
                        {translateAgeGroup(speaker.ageGroup)}
                      </p>
                      <p>
                        <strong>音调风格:</strong>{" "}
                        {translateToneStyle(speaker.toneStyle)}
                      </p>
                      {speaker.confidence && (
                        <p>
                          <strong>置信度:</strong>{" "}
                          {(speaker.confidence * 100).toFixed(1)}%
                        </p>
                      )}
                      <p>
                        <strong>使用次数:</strong> {speaker.usageCount}
                      </p>
                      {speaker.lastUsedAt && (
                        <p>
                          <strong>最后使用:</strong>{" "}
                          {new Date(speaker.lastUsedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    {speaker.description && (
                      <p className="text-sm text-gray-600">
                        {speaker.description}
                      </p>
                    )}
                    {speaker.referenceAudio && (
                      <div className="mt-2">
                        <p className="text-sm font-medium">参考音频:</p>
                        {(() => {
                          const referenceAudio = referenceAudios.find(
                            (audio) => audio.filename === speaker.referenceAudio
                          );
                          // 如果找到了参考音频记录，使用记录中的URL，否则使用IndexTTS服务生成URL
                          const audioUrl =
                            referenceAudio?.url ||
                            indexTTSService.getPublicAudioUrl(
                              speaker.referenceAudio
                            );
                          return (
                            <audio
                              id={`audio-${speaker.referenceAudio}`}
                              src={audioUrl}
                              controls
                              className="w-full mt-1"
                              onPlay={() =>
                                setIsPlaying(speaker.referenceAudio)
                              }
                              onEnded={() => setIsPlaying(null)}
                              onError={(e) => {
                                console.error(
                                  `Failed to load audio: ${audioUrl}`,
                                  e
                                );
                                // 如果URL加载失败，尝试备用的URL格式
                                const fallbackUrl = `${
                                  process.env.NEXT_PUBLIC_INDEXTTS_API_URL ||
                                  "http://192.168.88.9:8001"
                                }/api/audio/file/${speaker.referenceAudio}`;
                                (e.target as HTMLAudioElement).src =
                                  fallbackUrl;
                              }}
                            />
                          );
                        })()}
                      </div>
                    )}
                    <div className="flex justify-between items-center mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(speaker)}
                      >
                        编辑
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteSpeaker(speaker.id, speaker.name)}
                      >
                        删除
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {!loading && totalPages > 1 && (
            <div className="flex justify-center items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                上一页
              </Button>
              <span className="text-sm">
                第 {currentPage} 页，共 {totalPages} 页
              </span>
              <Button
                variant="outline"
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
              >
                下一页
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="audios" className="space-y-4">
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : referenceAudios.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">
              暂无参考音频
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedReferenceAudios.map((audio) => (
                <Card key={audio.filename} className="relative">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg truncate">
                        {audio.originalName}
                      </CardTitle>
                      <Badge
                        variant={
                          audio.audioType === "example"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {audio.audioType === "example"
                          ? "示例"
                          : audio.audioType === "uploaded"
                          ? "上传"
                          : "情感"}
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
                      <p className="text-sm text-gray-600">
                        {audio.description}
                      </p>
                    )}
                    <div className="mt-2">
                      <audio
                        id={`audio-${audio.filename}`}
                        src={audio.url}
                        controls
                        className="w-full"
                        onPlay={() => setIsPlaying(audio.filename)}
                        onEnded={() => setIsPlaying(null)}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => playAudio(audio.url, audio.filename)}
                      >
                        {isPlaying === audio.filename ? "停止" : "播放"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteReferenceAudio(audio.filename)}
                      >
                        删除
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {!loading && referenceAudios.length > 0 && audioTotalPages > 1 && (
            <div className="flex justify-center items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setAudioPage(Math.max(1, audioPage - 1))}
                disabled={audioPage === 1}
              >
                上一页
              </Button>
              <span className="text-sm">
                参考音频 第 {audioPage} 页，共 {audioTotalPages} 页
                {referenceAudios.length > 0 &&
                  `（共 ${referenceAudios.length} 条）`}
              </span>
              <Button
                variant="outline"
                onClick={() =>
                  setAudioPage(Math.min(audioTotalPages, audioPage + 1))
                }
                disabled={audioPage === audioTotalPages}
              >
                下一页
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

    </div>
  );
}
