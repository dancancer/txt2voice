// If I change, please update my header comment.
// input: children/route params
// output: shared layout UI
// pos: route layout entry
"use client";

import { useParams } from "next/navigation";
import { BookNavigation } from "@/components/BookNavigation";

export default function BookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const bookId = params.id as string;

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <BookNavigation bookId={bookId} />
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
