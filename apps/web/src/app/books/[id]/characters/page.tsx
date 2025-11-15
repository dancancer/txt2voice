"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { booksApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Users,
  Plus,
  Edit,
  Trash2,
  Volume2,
  Settings,
  User,
  Search,
  Mic,
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const INDEXTTS_BASE_URL = (
  process.env.NEXT_PUBLIC_INDEXTTS_API_URL || "http://192.168.88.9:8001"
).replace(/\/$/, "");

const buildSpeakerPreviewSources = (referenceAudio?: string | null) => {
  if (!referenceAudio) {
    return [];
  }
  if (/^https?:\/\//.test(referenceAudio)) {
    return [referenceAudio];
  }
  if (referenceAudio.startsWith("/")) {
    return [`${INDEXTTS_BASE_URL}${referenceAudio}`];
  }
  return [`${INDEXTTS_BASE_URL}/uploads/${referenceAudio}`];
};

export default function CharacterProfilesPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  const [book, setBook] = useState<any>(null);
  const [characters, setCharacters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddCharacter, setShowAddCharacter] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<any>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<{
    scriptExtraction: boolean;
    recognition: boolean;
  }>({
    scriptExtraction: false,
    recognition: false,
  });
  const [deletingCharacterId, setDeletingCharacterId] = useState<string | null>(
    null
  );
  const [recognitionStatus, setRecognitionStatus] = useState<any | null>(null);
  const [lastExtractionSummary, setLastExtractionSummary] = useState<
    string | null
  >(null);
  const [speakerDialogOpen, setSpeakerDialogOpen] = useState(false);
  const [speakerDialogCharacter, setSpeakerDialogCharacter] = useState<
    any | null
  >(null);
  const [characterSpeakerBindings, setCharacterSpeakerBindings] = useState<
    any[]
  >([]);
  const [availableSpeakers, setAvailableSpeakers] = useState<any[]>([]);
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>("");
  const [isSpeakerDialogLoading, setIsSpeakerDialogLoading] = useState(false);
  const [isSpeakerListLoading, setIsSpeakerListLoading] = useState(false);
  const [speakerActionLoading, setSpeakerActionLoading] = useState(false);
  const [updatingBindingId, setUpdatingBindingId] = useState<string | null>(
    null
  );
  const [removingBindingId, setRemovingBindingId] = useState<string | null>(
    null
  );

  const segmentsCount =
    (book?.textSegments?.length ?? 0) || book?.stats?.segmentsCount || 0;
  const hasTextSegments = segmentsCount > 0;
  const scriptsCount =
    (book?.scriptSentences?.length ?? 0) || book?.stats?.scriptsCount || 0;
  const hasScripts = scriptsCount > 0;

  const getRecognitionStatusText = (status?: string) => {
    switch (status) {
      case "processing":
        return "识别进行中";
      case "completed":
        return "识别完成";
      case "failed":
        return "识别失败";
      case "pending":
        return "等待开始";
      case "not_started":
      default:
        return "尚未启动";
    }
  };

  const fetchRecognitionStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/books/${bookId}/characters/recognize`);
      if (!response.ok) return;
      const data = await response.json();
      setRecognitionStatus(data.data);
    } catch (err) {
      console.error("Failed to load character recognition status:", err);
    }
  }, [bookId]);

  useEffect(() => {
    loadBookAndCharacters(1, "");
  }, [bookId]);

  useEffect(() => {
    // 防抖搜索
    const timeoutId = setTimeout(() => {
      loadBookAndCharacters(1, searchTerm);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    fetchRecognitionStatus();
  }, [fetchRecognitionStatus]);

  const loadBookAndCharacters = async (
    page: number = 1,
    search: string = ""
  ) => {
    try {
      setLoading(true);
      // 加载书籍信息
      const bookResponse = await booksApi.getBook(bookId);
      setBook(bookResponse.data);

      // 加载角色列表（包含分页和搜索）
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(search && { search }),
      });

      const charactersResponse = await fetch(
        `/api/books/${bookId}/characters?${params}`
      );
      if (charactersResponse.ok) {
        const charactersData = await charactersResponse.json();
        // API返回格式: { success: true, data: { data: [...], pagination: {...} } }
        setCharacters(charactersData.data?.data || []);
        if (charactersData.data?.pagination) {
          setPagination(charactersData.data.pagination);
        }
      } else {
        console.error("Failed to load characters");
        setCharacters([]);
      }
    } catch (err) {
      console.error("Failed to load book and characters:", err);
      setError("加载角色配置失败");
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    loadBookAndCharacters(newPage, searchTerm);
  };

  const filteredCharacters = characters; // 移除前端过滤，使用后端搜索
  const selectedSpeaker =
    selectedSpeakerId.length > 0
      ? availableSpeakers.find(
          (speaker) => String(speaker.id) === selectedSpeakerId
        )
      : null;

  const handleCreateCharacter = async (characterData: any) => {
    try {
      setIsFormSubmitting(true);
      const response = await fetch(`/api/books/${bookId}/characters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          canonicalName: characterData.name,
          description: characterData.description,
          aliases: characterData.aliases,
          isActive: characterData.isActive,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || "创建角色失败");
      }
      toast.success("角色创建成功");
      setShowAddCharacter(false);
      await loadBookAndCharacters(pagination.page, searchTerm);
    } catch (error) {
      console.error("Failed to create character:", error);
      toast.error(
        error instanceof Error ? error.message : "角色创建失败，请重试"
      );
    } finally {
      setIsFormSubmitting(false);
    }
  };

  const handleUpdateCharacter = async (id: string, characterData: any) => {
    try {
      setIsFormSubmitting(true);
      const response = await fetch(`/api/books/${bookId}/characters/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: characterData.name,
          description: characterData.description,
          aliases: characterData.aliases,
          isActive: characterData.isActive,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || "更新角色失败");
      }
      toast.success("角色更新成功");
      setEditingCharacter(null);
      await loadBookAndCharacters(pagination.page, searchTerm);
    } catch (error) {
      console.error("Failed to update character:", error);
      toast.error(
        error instanceof Error ? error.message : "角色更新失败，请重试"
      );
    } finally {
      setIsFormSubmitting(false);
    }
  };

  const fetchCharacterSpeakerBindings = async (characterId: string) => {
    setIsSpeakerDialogLoading(true);
    try {
      const response = await fetch(
        `/api/books/${bookId}/characters/${characterId}/speakers`
      );
      if (!response.ok) {
        throw new Error("加载角色说话人失败");
      }
      const result = await response.json();
      const bindings = result.data?.speakerBindings || [];
      setCharacterSpeakerBindings(bindings);
      setCharacters((prev) =>
        prev.map((character) =>
          character.id === characterId
            ? { ...character, speakerBindings: bindings }
            : character
        )
      );
    } catch (error) {
      console.error("Failed to load character speakers:", error);
      toast.error(
        error instanceof Error ? error.message : "加载角色说话人失败"
      );
    } finally {
      setIsSpeakerDialogLoading(false);
    }
  };

  const fetchAvailableSpeakers = async (force = false) => {
    if (!force && availableSpeakers.length > 0) {
      return;
    }
    setIsSpeakerListLoading(true);
    try {
      const response = await fetch(`/api/tts/speakers?limit=100`);
      if (!response.ok) {
        throw new Error("获取说话人列表失败");
      }
      const data = await response.json();
      setAvailableSpeakers(data.data?.speakers || []);
    } catch (error) {
      console.error("Failed to load speakers:", error);
      toast.error(
        error instanceof Error ? error.message : "获取说话人列表失败"
      );
    } finally {
      setIsSpeakerListLoading(false);
    }
  };

  const openSpeakerDialog = async (character: any) => {
    setSpeakerDialogCharacter(character);
    setSpeakerDialogOpen(true);
    setSelectedSpeakerId("");
    setCharacterSpeakerBindings([]);
    await Promise.all([
      fetchCharacterSpeakerBindings(character.id),
      fetchAvailableSpeakers(),
    ]);
  };

  const closeSpeakerDialog = () => {
    setSpeakerDialogOpen(false);
    setSpeakerDialogCharacter(null);
    setCharacterSpeakerBindings([]);
    setSelectedSpeakerId("");
    setSpeakerActionLoading(false);
    setUpdatingBindingId(null);
    setRemovingBindingId(null);
  };

  const handleAddSpeakerBinding = async () => {
    if (!speakerDialogCharacter) {
      return;
    }
    const speakerProfileId = Number(selectedSpeakerId);
    if (!selectedSpeakerId || Number.isNaN(speakerProfileId)) {
      toast.error("请选择要关联的说话人");
      return;
    }
    try {
      setSpeakerActionLoading(true);
      const response = await fetch(
        `/api/books/${bookId}/characters/${speakerDialogCharacter.id}/speakers`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            speakerProfileId,
            isPreferred: characterSpeakerBindings.length === 0,
          }),
        }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || "关联说话人失败");
      }
      toast.success("已关联说话人");
      setSelectedSpeakerId("");
      await fetchCharacterSpeakerBindings(speakerDialogCharacter.id);
    } catch (error) {
      console.error("Failed to bind speaker:", error);
      toast.error(
        error instanceof Error ? error.message : "关联说话人失败，请稍后重试"
      );
    } finally {
      setSpeakerActionLoading(false);
    }
  };

  const handleSetDefaultSpeaker = async (bindingId: string) => {
    if (!speakerDialogCharacter) {
      return;
    }
    try {
      setUpdatingBindingId(bindingId);
      const response = await fetch(
        `/api/books/${bookId}/characters/${speakerDialogCharacter.id}/speakers`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            bindingId,
            isPreferred: true,
          }),
        }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || "设置默认说话人失败");
      }
      toast.success("已设置默认说话人");
      await fetchCharacterSpeakerBindings(speakerDialogCharacter.id);
    } catch (error) {
      console.error("Failed to set default speaker:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "设置默认说话人失败，请稍后重试"
      );
    } finally {
      setUpdatingBindingId(null);
    }
  };

  const handleRemoveSpeakerBinding = async (bindingId: string) => {
    if (!speakerDialogCharacter) {
      return;
    }
    if (!confirm("确定要解除这个说话人的关联吗？")) {
      return;
    }
    try {
      setRemovingBindingId(bindingId);
      const response = await fetch(
        `/api/books/${bookId}/characters/${
          speakerDialogCharacter.id
        }/speakers?bindingId=${encodeURIComponent(bindingId)}`,
        {
          method: "DELETE",
        }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || "解除关联失败");
      }
      toast.success("说话人已解除关联");
      await fetchCharacterSpeakerBindings(speakerDialogCharacter.id);
    } catch (error) {
      console.error("Failed to remove speaker binding:", error);
      toast.error(
        error instanceof Error ? error.message : "解除关联失败，请稍后重试"
      );
    } finally {
      setRemovingBindingId(null);
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    if (!confirm("确定要删除这个角色吗？")) {
      return;
    }
    try {
      setDeletingCharacterId(id);
      const response = await fetch(`/api/books/${bookId}/characters/${id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || "删除角色失败");
      }
      toast.success("角色已删除");
      await loadBookAndCharacters(pagination.page, searchTerm);
    } catch (error) {
      console.error("Failed to delete character:", error);
      toast.error(
        error instanceof Error ? error.message : "删除角色失败，请重试"
      );
    } finally {
      setDeletingCharacterId(null);
    }
  };

  const handleExtractFromScript = async () => {
    try {
      setActionLoading((prev) => ({ ...prev, scriptExtraction: true }));
      const response = await fetch(
        `/api/books/${bookId}/characters/from-script`,
        {
          method: "POST",
        }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || "台本抽取失败");
      }
      const summary = `新增 ${result.data.createdCount} 个角色，绑定 ${result.data.linkedSentences} 句台词`;
      setLastExtractionSummary(summary);
      toast.success(summary);
      await loadBookAndCharacters(1, searchTerm);
    } catch (error) {
      console.error("Failed to extract characters from script:", error);
      toast.error(
        error instanceof Error ? error.message : "台本抽取失败，请稍后重试"
      );
    } finally {
      setActionLoading((prev) => ({ ...prev, scriptExtraction: false }));
    }
  };

  const handleStartRecognition = async () => {
    try {
      setActionLoading((prev) => ({ ...prev, recognition: true }));
      const response = await fetch(
        `/api/books/${bookId}/characters/recognize`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || "角色识别启动失败");
      }
      toast.success("角色识别任务已启动");
      await fetchRecognitionStatus();
      await loadBookAndCharacters(pagination.page, searchTerm);
    } catch (error) {
      console.error("Failed to start recognition task:", error);
      toast.error(error instanceof Error ? error.message : "角色识别启动失败");
    } finally {
      setActionLoading((prev) => ({ ...prev, recognition: false }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Users className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || "书籍不存在"}</p>
          <Button onClick={() => router.back()}>返回</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/books/${bookId}`)}
                className="mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  角色配置
                </h1>
                <p className="text-sm text-gray-500">{book.title}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="secondary">
                {pagination.total} 个角色（共 {pagination.totalPages} 页）
              </Badge>
              <Button
                onClick={() => setShowAddCharacter(true)}
                disabled={!hasTextSegments}
              >
                <Plus className="w-4 h-4 mr-2" />
                添加角色
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Info */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="搜索角色名称或描述..."
                    className="pl-10 pr-4"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-2" />
                    <span>
                      当前页 {characters.length} 个角色，总计 {pagination.total}{" "}
                      个
                    </span>
                  </div>
                  {segmentsCount > 0 && (
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      <span>{segmentsCount} 个文本段落</span>
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  按提及次数、引用次数、对话次数降序排列
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Character Actions */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle>角色获取方式</CardTitle>
            <p className="text-sm text-gray-500">
              可手动维护角色，也可以从台本或识别服务中自动提取。
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-4 bg-white flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-gray-900">手动添加角色</p>
                    <p className="text-xs text-gray-500">
                      自定义角色档案及别名
                    </p>
                  </div>
                  <div className="p-2 rounded-full bg-blue-50 text-blue-600">
                    <User className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex-1 text-sm text-gray-500 mb-3">
                  {hasTextSegments
                    ? `已解析 ${segmentsCount} 个文本段落`
                    : "请先完成文本处理"}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowAddCharacter(true)}
                  disabled={!hasTextSegments}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  新建角色
                </Button>
              </div>
              <div className="rounded-lg border p-4 bg-white flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-gray-900">台本抽取</p>
                    <p className="text-xs text-gray-500">
                      读取台本说话人并生成角色
                    </p>
                  </div>
                  <div className="p-2 rounded-full bg-amber-50 text-amber-600">
                    <FileText className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-sm text-gray-500 flex-1 mb-3">
                  {hasScripts ? `已有 ${scriptsCount} 句台词` : "尚未生成台本"}
                  {lastExtractionSummary && (
                    <p className="text-xs text-amber-600 mt-2">
                      {lastExtractionSummary}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={handleExtractFromScript}
                  disabled={
                    !hasScripts || actionLoading.scriptExtraction || loading
                  }
                >
                  {actionLoading.scriptExtraction ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      抽取中...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      从台本抽取
                    </>
                  )}
                </Button>
              </div>
              <div className="rounded-lg border p-4 bg-white flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-gray-900">角色识别服务</p>
                    <p className="text-xs text-gray-500">
                      调用识别服务批量提取
                    </p>
                  </div>
                  <div className="p-2 rounded-full bg-purple-50 text-purple-600">
                    <Mic className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-sm text-gray-500 flex-1 mb-3 space-y-2">
                  <div>
                    当前状态：{" "}
                    <span className="font-medium text-gray-900">
                      {getRecognitionStatusText(recognitionStatus?.status)}
                    </span>
                  </div>
                  {recognitionStatus?.message && (
                    <p className="text-xs text-gray-500">
                      {recognitionStatus.message}
                    </p>
                  )}
                  {recognitionStatus?.status === "processing" && (
                    <Progress value={recognitionStatus.progress || 0} />
                  )}
                </div>
                <Button
                  onClick={handleStartRecognition}
                  disabled={
                    !hasTextSegments ||
                    actionLoading.recognition ||
                    recognitionStatus?.status === "processing"
                  }
                >
                  {actionLoading.recognition ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      正在启动...
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 mr-2" />
                      启动识别
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Characters Table */}
        {filteredCharacters.length > 0 ? (
          <>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[180px]">
                          角色名称
                        </TableHead>
                        <TableHead className="min-w-[80px]">性别</TableHead>
                        <TableHead className="min-w-[100px]">台词数</TableHead>
                        <TableHead className="min-w-[100px]">提及数</TableHead>
                        <TableHead className="min-w-[100px]">引用数</TableHead>
                        <TableHead className="min-w-[80px]">别名数</TableHead>
                        <TableHead className="min-w-[140px]">说话人</TableHead>
                        <TableHead className="min-w-[120px]">
                          语音配置
                        </TableHead>
                        <TableHead className="min-w-[80px]">状态</TableHead>
                        <TableHead className="min-w-[150px]">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCharacters.map((character) => {
                        const defaultSpeaker =
                          character.speakerBindings?.find(
                            (binding: any) => binding.isDefault
                          ) || character.speakerBindings?.[0];

                        return (
                          <TableRow key={character.id}>
                            <TableCell>
                              <div className="max-w-[200px]">
                                <div className="font-medium text-gray-900 truncate">
                                  {character.canonicalName || character.name}
                                </div>
                                {((character.characteristics as any)
                                  ?.description ||
                                  character.description) && (
                                  <div className="text-sm text-gray-500 mt-1 line-clamp-2">
                                    {(character.characteristics as any)
                                      ?.description || character.description}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm inline-block">
                                {character.genderHint === "unknown"
                                  ? "未知"
                                  : character.genderHint === "male"
                                  ? "男"
                                  : character.genderHint === "female"
                                  ? "女"
                                  : character.genderHint}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium text-blue-600 inline-block">
                                {character.scriptSentencesCount || 0}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium text-green-600 inline-block">
                                {character.mentions}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium text-orange-600 inline-block">
                                {character.quotes}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-gray-600 inline-block">
                                {character.aliases?.length || 0}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="inline-flex flex-col gap-1">
                                {character.speakerBindings?.length > 0 ? (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-indigo-600">
                                        {defaultSpeaker?.speakerProfile?.name ||
                                          `说话人 #${defaultSpeaker?.speakerProfile?.id}`}
                                      </span>
                                      {defaultSpeaker?.isDefault && (
                                        <Badge
                                          variant="secondary"
                                          className="text-xs"
                                        >
                                          默认
                                        </Badge>
                                      )}
                                    </div>
                                    {character.speakerBindings.length > 1 && (
                                      <span className="text-xs text-gray-500">
                                        共 {character.speakerBindings.length} 个
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="text-gray-500"
                                  >
                                    未关联
                                  </Badge>
                                )}
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="px-0 text-indigo-600 hover:text-indigo-500"
                                  onClick={() => openSpeakerDialog(character)}
                                >
                                  <Mic className="w-3 h-3 mr-1" />
                                  配置说话人
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="inline-block">
                                {character.voiceBindings?.length > 0 ? (
                                  <Badge
                                    variant="outline"
                                    className="text-green-600"
                                  >
                                    <Volume2 className="w-3 h-3 mr-1" />
                                    已配置
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="text-orange-600"
                                  >
                                    <Settings className="w-3 h-3 mr-1" />
                                    未配置
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="inline-block">
                                <Badge
                                  variant={
                                    character.isActive ? "default" : "secondary"
                                  }
                                >
                                  {character.isActive ? "启用" : "禁用"}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-1 min-w-[140px]">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openSpeakerDialog(character)}
                                  className="h-8 w-8 p-0 flex-shrink-0"
                                >
                                  <Mic className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingCharacter(character)}
                                  className="h-8 w-8 p-0 flex-shrink-0"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    router.push(
                                      `/books/${bookId}/audio?character=${character.id}`
                                    )
                                  }
                                  className="h-8 w-8 p-0 flex-shrink-0"
                                >
                                  <Settings className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleDeleteCharacter(character.id)
                                  }
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50 flex-shrink-0"
                                  disabled={
                                    deletingCharacterId === character.id
                                  }
                                >
                                  {deletingCharacterId === character.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="mt-6">
                <Card>
                  <CardContent className="pt-4 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        显示第 {(pagination.page - 1) * pagination.limit + 1} -{" "}
                        {Math.min(
                          pagination.page * pagination.limit,
                          pagination.total
                        )}{" "}
                        个角色，共 {pagination.total} 个
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(pagination.page - 1)}
                          disabled={!pagination.hasPrev}
                        >
                          上一页
                        </Button>

                        <div className="flex items-center space-x-1">
                          {Array.from(
                            { length: pagination.totalPages },
                            (_, i) => i + 1
                          ).map((pageNum) => (
                            <Button
                              key={pageNum}
                              variant={
                                pageNum === pagination.page
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() => handlePageChange(pageNum)}
                              className="min-w-[32px]"
                            >
                              {pageNum}
                            </Button>
                          ))}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(pagination.page + 1)}
                          disabled={!pagination.hasNext}
                        >
                          下一页
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        ) : (
          /* Empty State */
          <Card>
            <CardContent className="pt-12 p-12 text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                暂无角色配置
              </h3>
              <p className="text-gray-600 mb-6">
                角色配置用于为书中的人物分配不同的语音，让有声读物更加生动。
              </p>
              <div className="space-y-4">
                <Button
                  onClick={() => setShowAddCharacter(true)}
                  disabled={!hasTextSegments}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  创建第一个角色
                </Button>
                {!hasTextSegments ? (
                  <p className="text-sm text-gray-500">
                    请先处理文本段落，然后再创建角色配置
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Character Form Modal */}
        {(showAddCharacter || editingCharacter) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>
                  {editingCharacter ? "编辑角色" : "添加角色"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CharacterForm
                  key={editingCharacter ? editingCharacter.id : "create"}
                  character={editingCharacter}
                  onSubmit={
                    editingCharacter
                      ? (data) =>
                          handleUpdateCharacter(editingCharacter.id, data)
                      : handleCreateCharacter
                  }
                  onCancel={() => {
                    setShowAddCharacter(false);
                    setEditingCharacter(null);
                  }}
                  isSubmitting={isFormSubmitting}
                />
              </CardContent>
            </Card>
          </div>
        )}

        <Dialog
          open={speakerDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeSpeakerDialog();
            }
          }}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>角色说话人关联</DialogTitle>
              <p className="text-sm text-gray-500">
                {speakerDialogCharacter
                  ? `为 ${
                      speakerDialogCharacter.canonicalName ||
                      speakerDialogCharacter.name
                    } 配置说话人`
                  : "选择角色以配置说话人"}
              </p>
            </DialogHeader>

            {speakerDialogCharacter ? (
              <div className="space-y-6">
                {isSpeakerDialogLoading ? (
                  <div className="flex items-center justify-center py-8 text-gray-500">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    加载中...
                  </div>
                ) : characterSpeakerBindings.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                    暂无说话人关联，请添加新的说话人。
                  </div>
                ) : (
                  <div className="space-y-3">
                    {characterSpeakerBindings.map((binding) => (
                      <div
                        key={binding.id}
                        className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3"
                      >
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div>
                            <p className="font-medium text-gray-900">
                              {binding.speakerProfile?.name ||
                                `说话人 #${binding.speakerProfile?.id}`}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {[
                                binding.speakerProfile?.gender || "未知",
                                binding.speakerProfile?.ageGroup,
                                binding.speakerProfile?.toneStyle,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            {binding.isPreferred && (
                              <Badge
                                variant="secondary"
                                className="mt-2 text-xs"
                              >
                                默认说话人
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!binding.isPreferred && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleSetDefaultSpeaker(binding.id)
                                }
                                disabled={updatingBindingId === binding.id}
                                className="flex items-center gap-1"
                              >
                                {updatingBindingId === binding.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <User className="w-3 h-3" />
                                )}
                                设为默认
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleRemoveSpeakerBinding(binding.id)
                              }
                              disabled={removingBindingId === binding.id}
                              className="text-red-600 hover:text-red-800 flex items-center gap-1"
                            >
                              {removingBindingId === binding.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                              移除
                            </Button>
                          </div>
                        </div>
                        {binding.speakerProfile?.referenceAudio ? (
                          <div className="space-y-1">
                            <p className="text-xs text-gray-500 flex items-center gap-2">
                              <Volume2 className="w-3 h-3" />
                              示例音频预览
                            </p>
                            <audio controls preload="none" className="w-full">
                              {buildSpeakerPreviewSources(
                                binding.speakerProfile.referenceAudio
                              ).map((src) => (
                                <source key={src} src={src} />
                              ))}
                              您的浏览器不支持音频播放
                            </audio>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">暂无示例音频</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    添加说话人关联
                  </p>
                  {isSpeakerListLoading ? (
                    <div className="text-sm text-gray-500">
                      <Loader2 className="w-4 h-4 mr-2 inline animate-spin" />
                      说话人列表加载中...
                    </div>
                  ) : availableSpeakers.length === 0 ? (
                    <div className="text-sm text-gray-500">
                      暂无说话人，请先在说话人管理页面创建。
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <select
                          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                          value={selectedSpeakerId}
                          onChange={(e) => setSelectedSpeakerId(e.target.value)}
                        >
                          <option value="">选择说话人</option>
                          {availableSpeakers.map((speaker) => (
                            <option key={speaker.id} value={speaker.id}>
                              {speaker.name || `说话人 #${speaker.id}`} ·{" "}
                              {speaker.gender} · {speaker.ageGroup}
                            </option>
                          ))}
                        </select>
                        <Button
                          onClick={handleAddSpeakerBinding}
                          disabled={
                            speakerActionLoading || !selectedSpeakerId.length
                          }
                          className="flex items-center justify-center gap-2"
                        >
                          {speakerActionLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              添加中...
                            </>
                          ) : (
                            <>
                              <Mic className="w-4 h-4" />
                              添加关联
                            </>
                          )}
                        </Button>
                      </div>
                      {selectedSpeakerId.length > 0 && (
                        <div className="mt-4 rounded-md border border-dashed border-gray-200 p-3 space-y-2">
                          <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                            <Volume2 className="w-4 h-4" />
                            {selectedSpeaker?.name ||
                              `说话人 #${
                                selectedSpeaker?.id || selectedSpeakerId
                              }`}
                            <span className="text-xs text-gray-500 font-normal">
                              示例音频
                            </span>
                          </div>
                          {selectedSpeaker?.referenceAudio ? (
                            <audio controls preload="none" className="w-full">
                              {buildSpeakerPreviewSources(
                                selectedSpeaker.referenceAudio
                              ).map((src) => (
                                <source key={src} src={src} />
                              ))}
                              您的浏览器不支持音频播放
                            </audio>
                          ) : (
                            <p className="text-xs text-gray-500">
                              该说话人暂无示例音频
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    说话人数据来源于说话人管理页面，可随时前往 /tts/speakers
                    页面进行维护。
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                请选择角色后再配置说话人。
              </p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// Character Form Component
function CharacterForm({
  character,
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  character?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}) {
  const [formData, setFormData] = useState({
    name: character?.canonicalName || character?.name || "",
    description:
      (character?.characteristics as any)?.description ||
      character?.description ||
      "",
    aliases:
      character?.aliases?.map((a: { alias: string }) => a.alias).join(", ") ||
      "",
    isActive: character?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    onSubmit({
      ...formData,
      aliases: formData.aliases
        .split(",")
        .map((a: string) => a.trim())
        .filter(Boolean),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          角色名称 *
        </label>
        <input
          type="text"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="输入角色名称"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          角色描述
        </label>
        <textarea
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          placeholder="描述角色的性格特征、身份等"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          别名 (用逗号分隔)
        </label>
        <input
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={formData.aliases}
          onChange={(e) =>
            setFormData({ ...formData, aliases: e.target.value })
          }
          placeholder="例如：小明, 少年, 主角"
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="isActive"
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          checked={formData.isActive}
          onChange={(e) =>
            setFormData({ ...formData, isActive: e.target.checked })
          }
        />
        <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
          启用此角色
        </label>
      </div>

      <div className="flex space-x-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1"
        >
          取消
        </Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              保存中...
            </>
          ) : character ? (
            "更新"
          ) : (
            "创建"
          )}
        </Button>
      </div>
    </form>
  );
}
