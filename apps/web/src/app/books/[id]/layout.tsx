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
    <div className=" bg-gray-50 h-full overflow-hidden flex flex-col">
      <BookNavigation bookId={bookId} />
      <div className="container mx-auto p-4 flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
      <div className=" mt-4"></div>
    </div>
  );
}
