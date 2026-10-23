import { CAMINHO_DOS_PROFESSORES_NO_ADMIN } from "@/dominio/professores";
import { ClipboardCheck, Download, GraduationCap, LayoutDashboard, ScrollText, Settings, Tags, Ticket, UserCog, type LucideIcon } from "lucide-react";

export type DestinoDeAdmin = { href: string; rotulo: string; icone: LucideIcon };

/** As seções de `/admin`: a sidebar do desktop, o menu hambúrguer do celular e os cartões do painel saem desta lista. */
export const PAINEL: DestinoDeAdmin = { href: "/admin", rotulo: "Painel", icone: LayoutDashboard };
export const SECOES_DE_ADMIN: DestinoDeAdmin[] = [
  { href: "/admin/usuarios", rotulo: "Usuários", icone: UserCog },
  { href: "/admin/convites", rotulo: "Convites", icone: Ticket },
  { href: "/admin/catalogo", rotulo: "Catálogo", icone: Tags },
  { href: CAMINHO_DOS_PROFESSORES_NO_ADMIN, rotulo: "Professores", icone: GraduationCap },
  { href: "/admin/exportar", rotulo: "Exportar", icone: Download },
  { href: "/admin/marcacoes", rotulo: "Marcações", icone: ClipboardCheck },
  { href: "/admin/logs", rotulo: "Logs", icone: ScrollText },
  { href: "/admin/configuracoes", rotulo: "Configurações", icone: Settings },
];
