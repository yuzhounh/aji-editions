import type { LucideIcon } from "lucide-react";
import {
  Atom,
  BookOpen,
  Brain,
  Calculator,
  Cpu,
  FlaskConical,
  Globe2,
  GraduationCap,
  HeartPulse,
  Landmark,
  Leaf,
  Library,
  Palette,
  Scale,
  ScrollText,
  Shapes,
  Sprout,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

export type CategoryMeta = {
  icon: LucideIcon;
  accentClass: string;
  bgClass: string;
};

const defaultMeta: CategoryMeta = {
  icon: BookOpen,
  accentClass: "text-slate-600 dark:text-slate-400",
  bgClass: "bg-slate-500/10",
};

export const categoryMetaMap: Record<string, CategoryMeta> = {
  农林科学: { icon: Sprout, accentClass: "text-emerald-600 dark:text-emerald-400", bgClass: "bg-emerald-500/10" },
  地球科学: { icon: Globe2, accentClass: "text-sky-600 dark:text-sky-400", bgClass: "bg-sky-500/10" },
  工程技术: { icon: Wrench, accentClass: "text-orange-600 dark:text-orange-400", bgClass: "bg-orange-500/10" },
  环境科学与生态学: { icon: Leaf, accentClass: "text-green-600 dark:text-green-400", bgClass: "bg-green-500/10" },
  化学: { icon: FlaskConical, accentClass: "text-violet-600 dark:text-violet-400", bgClass: "bg-violet-500/10" },
  计算机科学: { icon: Cpu, accentClass: "text-blue-600 dark:text-blue-400", bgClass: "bg-blue-500/10" },
  经济学: { icon: Wallet, accentClass: "text-amber-600 dark:text-amber-400", bgClass: "bg-amber-500/10" },
  教育学: { icon: GraduationCap, accentClass: "text-indigo-600 dark:text-indigo-400", bgClass: "bg-indigo-500/10" },
  法学: { icon: Scale, accentClass: "text-slate-600 dark:text-slate-400", bgClass: "bg-slate-500/10" },
  管理学: { icon: Landmark, accentClass: "text-rose-600 dark:text-rose-400", bgClass: "bg-rose-500/10" },
  材料科学: { icon: Shapes, accentClass: "text-cyan-600 dark:text-cyan-400", bgClass: "bg-cyan-500/10" },
  数学: { icon: Calculator, accentClass: "text-fuchsia-600 dark:text-fuchsia-400", bgClass: "bg-fuchsia-500/10" },
  医学: { icon: HeartPulse, accentClass: "text-red-600 dark:text-red-400", bgClass: "bg-red-500/10" },
  哲学: { icon: ScrollText, accentClass: "text-stone-600 dark:text-stone-400", bgClass: "bg-stone-500/10" },
  物理与天体物理: { icon: Atom, accentClass: "text-purple-600 dark:text-purple-400", bgClass: "bg-purple-500/10" },
  心理学: { icon: Brain, accentClass: "text-pink-600 dark:text-pink-400", bgClass: "bg-pink-500/10" },
  生物学: { icon: Leaf, accentClass: "text-lime-600 dark:text-lime-400", bgClass: "bg-lime-500/10" },
  社会科学: { icon: Users, accentClass: "text-teal-600 dark:text-teal-400", bgClass: "bg-teal-500/10" },
  艺术学: { icon: Palette, accentClass: "text-orange-600 dark:text-orange-400", bgClass: "bg-orange-500/10" },
  人文学科: { icon: BookOpen, accentClass: "text-amber-700 dark:text-amber-400", bgClass: "bg-amber-500/10" },
  地球科学与环境生态: { icon: Globe2, accentClass: "text-emerald-600 dark:text-emerald-400", bgClass: "bg-emerald-500/10" },
  交叉学科: { icon: Shapes, accentClass: "text-violet-600 dark:text-violet-400", bgClass: "bg-violet-500/10" },
  综合性期刊: { icon: Library, accentClass: "text-indigo-600 dark:text-indigo-400", bgClass: "bg-indigo-500/10" },
  社会学: { icon: Users, accentClass: "text-teal-600 dark:text-teal-400", bgClass: "bg-teal-500/10" },
  文学: { icon: ScrollText, accentClass: "text-rose-600 dark:text-rose-400", bgClass: "bg-rose-500/10" },
  历史学: { icon: Landmark, accentClass: "text-amber-700 dark:text-amber-400", bgClass: "bg-amber-500/10" },
};

export function getCategoryMeta(category: string): CategoryMeta {
  return categoryMetaMap[category] ?? defaultMeta;
}
