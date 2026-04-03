"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

interface LLMSettingsModel {
  id: string;
  name: string;
  provider: string;
  baseURL: string;
  model: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  hasApiKey: boolean;
}

interface FormState {
  name: string;
  provider: string;
  baseURL: string;
  model: string;
  apiKey: string;
  isActive: boolean;
  sortOrder: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  provider: "custom",
  baseURL: "",
  model: "",
  apiKey: "",
  isActive: true,
  sortOrder: "0",
};

export default function LLMSettingsPage() {
  const [models, setModels] = useState<LLMSettingsModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clearApiKey, setClearApiKey] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const title = useMemo(
    () => (editingId ? "编辑 LLM 模型" : "新增 LLM 模型"),
    [editingId]
  );

  const loadModels = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/settings/llm/models");
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error?.message || "加载配置失败");
      }

      setModels(Array.isArray(result.data?.models) ? result.data.models : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载配置失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadModels();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setClearApiKey(false);
    setForm(EMPTY_FORM);
  };

  const submit = async () => {
    try {
      setSaving(true);
      setError("");

      const payload: Record<string, unknown> = {
        name: form.name,
        provider: form.provider,
        baseURL: form.baseURL,
        model: form.model,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder || "0"),
      };

      if (editingId) {
        if (clearApiKey) {
          payload.apiKey = "";
        } else if (form.apiKey.trim()) {
          payload.apiKey = form.apiKey;
        }
      } else {
        payload.apiKey = form.apiKey;
      }

      const response = await fetch(
        editingId
          ? `/api/settings/llm/models/${editingId}`
          : "/api/settings/llm/models",
        {
          method: editingId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error?.message || "保存配置失败");
      }

      resetForm();
      await loadModels();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "保存配置失败");
    } finally {
      setSaving(false);
    }
  };

  const edit = (model: LLMSettingsModel) => {
    setEditingId(model.id);
    setClearApiKey(false);
    setForm({
      name: model.name,
      provider: model.provider,
      baseURL: model.baseURL,
      model: model.model,
      apiKey: "",
      isActive: model.isActive,
      sortOrder: String(model.sortOrder),
    });
  };

  const setDefault = async (id: string) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/settings/llm/models/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "set-default" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error?.message || "设置默认模型失败");
      }
      await loadModels();
    } catch (setDefaultError) {
      setError(
        setDefaultError instanceof Error
          ? setDefaultError.message
          : "设置默认模型失败"
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/settings/llm/models/${id}`, {
        method: "DELETE",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error?.message || "删除模型失败");
      }
      if (editingId === id) {
        resetForm();
      }
      await loadModels();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "删除模型失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-background px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">LLM 设置</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            在这里集中管理可选模型、默认模型和本地/云端推理入口。`apiKey`
            允许为空；编辑已有模型时，留空表示保持原值。
          </p>
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="rounded-lg border bg-card p-5">
            <h2 className="text-lg font-medium text-foreground">{title}</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">名称</span>
                <input
                  className="w-full rounded-md border px-3 py-2"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Provider</span>
                <input
                  className="w-full rounded-md border px-3 py-2"
                  value={form.provider}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      provider: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Base URL</span>
                <input
                  className="w-full rounded-md border px-3 py-2"
                  value={form.baseURL}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      baseURL: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Model</span>
                <input
                  className="w-full rounded-md border px-3 py-2"
                  value={form.model}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, model: event.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">API Key</span>
                <input
                  className="w-full rounded-md border px-3 py-2"
                  value={form.apiKey}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, apiKey: event.target.value }))
                  }
                  placeholder={editingId ? "留空表示保持现状" : "可为空"}
                />
              </label>
              {editingId ? (
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    checked={clearApiKey}
                    onChange={(event) => setClearApiKey(event.target.checked)}
                    type="checkbox"
                  />
                  清空已保存的 API Key
                </label>
              ) : null}
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">排序</span>
                <input
                  className="w-full rounded-md border px-3 py-2"
                  inputMode="numeric"
                  value={form.sortOrder}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sortOrder: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isActive: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                启用此模型
              </label>
              <div className="flex gap-2 pt-2">
                <Button disabled={saving} onClick={() => void submit()}>
                  {editingId ? "保存修改" : "新增模型"}
                </Button>
                <Button
                  disabled={saving}
                  onClick={resetForm}
                  type="button"
                  variant="outline"
                >
                  重置
                </Button>
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-foreground">已配置模型</h2>
              <Button disabled={loading || saving} onClick={() => void loadModels()} variant="outline">
                刷新
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="text-sm text-muted-foreground">加载中...</div>
              ) : models.length === 0 ? (
                <div className="rounded-md border border-dashed px-4 py-8 text-sm text-muted-foreground">
                  还没有持久化的 LLM 模型配置。新增一条后，台本工作台会自动读取这里的列表。
                </div>
              ) : (
                models.map((model) => (
                  <div
                    className="rounded-lg border px-4 py-4"
                    key={model.id}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-foreground">{model.name}</h3>
                      {model.isDefault ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          默认
                        </span>
                      ) : null}
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {model.isActive ? "启用" : "停用"}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {model.hasApiKey ? "已配置 Key" : "Key 为空"}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      <div>Provider: {model.provider}</div>
                      <div>Base URL: {model.baseURL}</div>
                      <div>Model: {model.model}</div>
                      <div>Sort: {model.sortOrder}</div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button onClick={() => edit(model)} size="sm">
                        编辑
                      </Button>
                      <Button
                        onClick={() => void setDefault(model.id)}
                        size="sm"
                        variant="outline"
                      >
                        设为默认
                      </Button>
                      <Button
                        onClick={() => void remove(model.id)}
                        size="sm"
                        variant="destructive"
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
