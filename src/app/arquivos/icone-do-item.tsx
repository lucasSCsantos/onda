import { File, FileSpreadsheet, FileText, Folder, Image, Music, Presentation, Video, type LucideIcon } from "lucide-react";
import type { TipoDeItem } from "@/dominio/arquivos";

const ICONES: Record<TipoDeItem, LucideIcon> = {
  pasta: Folder,
  imagem: Image,
  pdf: FileText,
  documento: FileText,
  planilha: FileSpreadsheet,
  apresentacao: Presentation,
  video: Video,
  audio: Music,
  outro: File,
};

/** O ícone de um item de Arquivos, pelo tipo. */
export function IconeDoItem({ tipo, className = "size-5" }: { tipo: TipoDeItem; className?: string }) {
  const Icone = ICONES[tipo];
  return <Icone aria-hidden className={className} />;
}
