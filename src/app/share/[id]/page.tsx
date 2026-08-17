"use client";

import { useParams } from "next/navigation";
import { EditionProvider } from "@/contexts/EditionContext";
import SharedListView from "@/components/share/SharedListView";

export default function SharePage() {
  const params = useParams<{ id: string }>();
  const shareId = params?.id ?? "";

  return (
    <EditionProvider>
      <SharedListView shareId={shareId} />
    </EditionProvider>
  );
}
