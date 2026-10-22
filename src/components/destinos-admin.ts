import { Download, GraduationCap, LayoutDashboard, Tags, Ticket, UserCog, type LucideIcon } from "lucide-react";

export type DestinoDeAdmin = { href: string; rotulo: string; icone: LucideIcon };

/** As seções de `/admin`: a sidebar do desktop, o menu hambúrguer do celular e os cartões do painel saem desta lista. */
export const PAINEL: DestinoDeAdmin = { href: "/admin", rotulo: "Painel", icone: LayoutDashboard };
export const SECOES_DE_ADMIN: DestinoDeAdmin[] = [
  { href: "/admin/usuarios", rotulo: "Usuários", icone: UserCog },
  { href: "/admin/convites", rotulo: "Convites", icone: Ticket },
  { href: "/admin/catalogo", rotulo: "Catálogo", icone: Tags },
  { href: "/professores", rotulo: "Professores", icone: GraduationCap },
  { href: "/admin/exportar", rotulo: "Exportar", icone: Download },
];
