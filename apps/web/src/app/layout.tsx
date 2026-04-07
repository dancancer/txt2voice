// If I change, please update my header comment.
// input: children/route params
// output: shared layout UI
// pos: route layout entry
import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Navigation";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Text to Voice",
  description: "Convert text to voice using modern web technologies",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", type: "image/x-icon", sizes: "any" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-background font-sans text-foreground antialiased">
        <ErrorBoundary>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1 min-h-0">{children}</main>
          </div>
        </ErrorBoundary>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
