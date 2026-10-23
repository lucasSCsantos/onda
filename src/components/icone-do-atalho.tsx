import { BookOpen, Camera, FileText, Flag, Folder, Heart, Image, Megaphone, Music, Palette, Star, Tent, type LucideIcon } from "lucide-react";
import type { IconeDeAtalho } from "@/dominio/arquivos";

/** O desenho de cada ícone de atalho (a lista fechada de ICONES_DOS_ATALHOS). */
export const ICONES_DE_ATALHO: Record<IconeDeAtalho, LucideIcon> = {
  folder: Folder,
  image: Image,
  palette: Palette,
  tent: Tent,
  "file-text": FileText,
  star: Star,
  music: Music,
  camera: Camera,
  megaphone: Megaphone,
  heart: Heart,
  flag: Flag,
  "book-open": BookOpen,
};

export function IconeDoAtalho({ icone, className = "size-5" }: { icone: IconeDeAtalho; className?: string }) {
  const Icone = ICONES_DE_ATALHO[icone] ?? Folder;
  return <Icone aria-hidden className={className} />;
}
