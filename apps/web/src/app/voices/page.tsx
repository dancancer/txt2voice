"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VoicesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // 重定向到实际的语音库页面
    router.replace("/tts/speakers");
  }, [router]);

  return (
    <div className="container mx-auto p-6">
      <div className="text-center">
        <p>正在跳转到语音库页面...</p>
      </div>
    </div>
  );
}
