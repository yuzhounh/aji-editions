import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface AjiLogoIconProps {
  className?: string;
}

export function AjiLogoIcon({ className }: AjiLogoIconProps) {
  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-sm",
        className
      )}
    >
      <BookOpen className="h-[22px] w-[22px]" strokeWidth={2.1} />
    </div>
  );
}
