"use client";

import { cn } from "@/lib/utils";
import { AjiLogoIcon } from "@/components/brand/AjiLogoIcon";

interface AjiLogoProps {
  className?: string;
  showLabel?: boolean;
}

export function AjiLogo({ className, showLabel = true }: AjiLogoProps) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <AjiLogoIcon />
      {showLabel && (
        <span className="text-xl font-bold font-headline">AJI Editions</span>
      )}
    </span>
  );
}
