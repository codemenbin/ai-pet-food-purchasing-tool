"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AddProductModal from "@/components/AddProductModal";
import type { UserProduct } from "@/types";

export default function AddProductPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  function onSaved(_product: UserProduct) {
    // 1.2 秒后回推荐页，让用户看到已保存的反馈
    setTimeout(() => router.push("/recommend"), 1200);
  }

  if (!mounted) return null;
  return (
    <AddProductModal
      open={true}
      onClose={() => router.push("/recommend")}
      onSaved={onSaved}
    />
  );
}
