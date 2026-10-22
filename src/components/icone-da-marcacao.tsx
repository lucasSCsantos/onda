import { Award, BookOpen, Check, Flame, HandHeart, Heart, Music, Pencil, Smile, Sparkles, Star, UserPlus, type LucideIcon } from "lucide-react";
import type { IconeDeMarcacao } from "@/dominio/presenca";

/** O desenho de cada ícone de Marcação (a lista fechada de ICONES_DAS_MARCACOES). */
export const ICONES: Record<IconeDeMarcacao, LucideIcon> = {
  check: Check,
  "book-open": BookOpen,
  "user-plus": UserPlus,
  pencil: Pencil,
  star: Star,
  music: Music,
  heart: Heart,
  smile: Smile,
  award: Award,
  "hand-heart": HandHeart,
  sparkles: Sparkles,
  flame: Flame,
};

export function IconeDaMarcacao({ icone, className = "size-5" }: { icone: IconeDeMarcacao; className?: string }) {
  const Icone = ICONES[icone] ?? Check;
  return <Icone aria-hidden className={className} />;
}
