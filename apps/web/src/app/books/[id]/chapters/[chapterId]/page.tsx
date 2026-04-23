// 一旦我被更新，请更新我的开头注释
// input: 路由参数
// output: 兼容跳转
// pos: 路由页面入口
import { redirect } from "next/navigation";
import { buildScriptStudioHref } from "../../studio/script/page-container/node-query";

export default async function ChapterDetailPage({
  params,
}: {
  params: Promise<{ id: string; chapterId: string }>;
}) {
  const { id, chapterId } = await params;

  redirect(
    buildScriptStudioHref(id, {
      type: "chapter",
      id: chapterId,
    })
  );
}
