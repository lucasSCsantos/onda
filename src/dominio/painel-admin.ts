import { situacaoDoConvite, type Convite } from "./convites";
import type { NivelDeAcesso } from "./acesso";
import type { NoCalendario } from "./calendario";
import type { Status } from "./eventos";
import { alertas } from "./filtros";

export type IndicadoresDoPainel = {
  pendentes: number;
  /** Pessoas ativas que já foram aprovadas (qualquer nível, menos Pendente). */
  usuariosAtivos: number;
  convitesAtivos: number;
  rascunhos: number;
  semResponsavel: number;
};

/**
 * A faixa de indicadores de `/admin`. Os de Eventos reaproveitam `alertas`, de modo que o número do painel e o da tela
 * de Eventos nunca divirjam. `responsavel` é nulo quando o Evento conta como sem Responsável.
 */
export function indicadoresDoPainel({
  pessoas,
  convites,
  eventos,
  agora,
}: {
  pessoas: { nivel: NivelDeAcesso; ativo: boolean }[];
  convites: Convite[];
  eventos: (NoCalendario & { status: Status; responsavel: string | null })[];
  agora: Date;
}): IndicadoresDoPainel {
  const dosAlertas = alertas(eventos, agora);
  const totalDoAlerta = (tipo: "rascunho" | "sem-responsavel") => dosAlertas.find((a) => a.tipo === tipo)?.eventos.length ?? 0;
  return {
    pendentes: pessoas.filter((p) => p.ativo && p.nivel === "pendente").length,
    usuariosAtivos: pessoas.filter((p) => p.ativo && p.nivel !== "pendente").length,
    convitesAtivos: convites.filter((c) => situacaoDoConvite(c, agora) === "valido").length,
    rascunhos: totalDoAlerta("rascunho"),
    semResponsavel: totalDoAlerta("sem-responsavel"),
  };
}
