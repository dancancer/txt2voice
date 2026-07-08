import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveMastraStudioUrl } from "@/lib/mastra-studio-url";

export const dynamic = "force-dynamic";

const studioCommand = "cd /Users/xupeng/mycode/txt2voice/apps/web && pnpm run dev:mastra";

export default async function MastraStudioPage() {
  const studioUrl = await resolveMastraStudioUrl({
    envStudioUrl:
      process.env.NEXT_PUBLIC_MASTRA_STUDIO_URL || process.env.MASTRA_STUDIO_URL,
  });

  if (studioUrl) {
    redirect(studioUrl);
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Mastra Studio
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          当前没有探测到可访问的 Studio 实例
        </h1>
        <p className="text-base leading-7 text-muted-foreground">
          `pnpm dev` 只会启动 Next.js Web UI，不会启动 Mastra Studio。请在
          `apps/web` 目录单独运行 Mastra 开发服务，然后再刷新当前页面。
        </p>
      </div>

      <div className="rounded-2xl border border-border/80 bg-card p-5 text-sm text-card-foreground shadow-sm">
        <p className="font-medium">建议命令</p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          <code>{studioCommand}</code>
        </pre>
        <p className="mt-3 leading-6 text-muted-foreground">
          如果你把 Studio 配到了别的地址，也可以通过
          `NEXT_PUBLIC_MASTRA_STUDIO_URL` 指向明确入口。
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border/80 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/80"
        >
          返回首页
        </Link>
      </div>
    </main>
  );
}
