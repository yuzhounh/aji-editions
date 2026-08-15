import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        level1: "border-partition-q1/20 bg-partition-q1/10 text-partition-q1",
        level2: "border-partition-q2/20 bg-partition-q2/10 text-partition-q2",
        level3: "border-partition-q3/20 bg-partition-q3/10 text-partition-q3",
        level4: "border-partition-q4/20 bg-partition-q4/10 text-partition-q4",
        authority1: "border-authority-l1/20 bg-authority-l1/10 text-authority-l1",
        authority2: "border-authority-l2/20 bg-authority-l2/10 text-authority-l2",
        authority3: "border-authority-l3/20 bg-authority-l3/10 text-authority-l3",
        openAccess: "border-oa-open/20 bg-oa-open/10 text-oa-open",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
