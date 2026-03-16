// 一旦我被更新，请更新我的开头注释
// input: 路由参数/客户端数据
// output: 页面 UI
// pos: 路由页面入口
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { BookList } from "@/components/BookList";
import { BookUpload } from "@/components/BookUpload";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldOpenUpload = searchParams.get("create") === "1";

  useEffect(() => {
    if (shouldOpenUpload) {
      setUploadDialogOpen(true);
    }
  }, [shouldOpenUpload]);

  const closeUploadDialog = () => {
    setUploadDialogOpen(false);

    if (shouldOpenUpload) {
      router.replace("/", { scroll: false });
    }
  };

  const handleUploadSuccess = () => {
    closeUploadDialog();
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-full bg-slate-50">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6 !pt-6 sm:p-8 sm:!pt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 leading-tight">
                书籍管理
              </h2>
              <p className="text-base text-slate-600 leading-7">
                上传文本后系统会自动处理章节与段落，随后可进入章节详情生成台本和音频。
              </p>
            </div>
            <Dialog
              open={uploadDialogOpen}
              onOpenChange={(open) => {
                if (open) {
                  setUploadDialogOpen(true);
                  return;
                }

                closeUploadDialog();
              }}
            >
              <Button
                type="button"
                className="min-h-11 min-w-11 bg-indigo-600 hover:bg-indigo-700 focus-visible:ring-indigo-500"
                onClick={() => setUploadDialogOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                创建书籍
              </Button>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>创建新书籍</DialogTitle>
                  <p className="text-sm text-slate-600 leading-6">
                    上传 txt 或 md 文件，系统会自动执行文本处理。
                  </p>
                </DialogHeader>
                <BookUpload
                  onSuccess={handleUploadSuccess}
                  onCancel={closeUploadDialog}
                />
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6 !pt-6">
            <BookList
              key={refreshKey}
              showUploadButton={false}
              onUploadClick={() => setUploadDialogOpen(true)}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
