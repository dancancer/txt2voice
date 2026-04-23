// 一旦我被更新，请更新我的开头注释
// input: 路由参数/客户端数据
// output: 页面 UI
// pos: 路由页面入口
"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Plus, Sparkles, Workflow } from "lucide-react";
import { BookList } from "@/components/BookList";
import { BookUpload } from "@/components/BookUpload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function HomePageContent() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldOpenUpload = searchParams.get("create") === "1";
  const isUploadDialogOpen = uploadDialogOpen || shouldOpenUpload;

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
    <div className="min-h-full bg-background">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Card className="shadow-sm">
          <CardContent className="flex flex-col gap-5 p-6 !pt-6 sm:p-8 sm:!pt-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <h2 className="text-2xl sm:text-3xl font-semibold text-foreground leading-tight">
                书籍管理
              </h2>
              <p className="text-base text-muted-foreground leading-7">
                上传文本后系统会自动处理章节与段落，随后可进入章节详情生成台本和音频。
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1 text-[0.72rem] font-medium text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  支持 txt / md
                </Badge>
                <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1 text-[0.72rem] font-medium text-muted-foreground">
                  <Workflow className="h-3.5 w-3.5" />
                  上传后自动文本处理
                </Badge>
                <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1 text-[0.72rem] font-medium text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  可继续生成台本与音频
                </Badge>
              </div>
            </div>
            <Dialog
              open={isUploadDialogOpen}
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
                className="min-h-11 min-w-11 self-start"
                onClick={() => setUploadDialogOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                创建书籍
              </Button>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>创建新书籍</DialogTitle>
                  <p className="text-sm text-muted-foreground leading-6">
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

        <Card className="shadow-sm">
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

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomePageContent />
    </Suspense>
  );
}
