"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SetupPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/"); }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <span className="text-gray-400 text-sm">Loading…</span>
    </div>
  );
}
