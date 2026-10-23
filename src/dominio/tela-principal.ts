import type { NoCalendario } from "./calendario";
import { alertas, filtrar, proximosEventos, SEM_FILTROS, type EventoFiltravel, type Filtros, type TipoDeAlerta } from "./filtros";
import type { Status } from "./eventos";

type EventoDaTela = EventoFiltravel & { status: Status };

/**
 * As listas da tela principal da Liderança, todas a partir dos mesmos Eventos e da mesma semana do atalho "Esta semana"
 * (`filtrar`): "Meus eventos desta semana" (em que `eu` está envolvido), "Esta semana no ONDA" (todos, ou só os meus),
 * os alertas dos Eventos da semana e "Depois", o que começa depois do domingo (só esta lista obedece aos `filtros`). Nenhum Evento está em "Depois" e na semana.
 */
export function montarTelaPrincipal<E extends EventoDaTela>(
  eventos: E[],
  { eu, agora, soMeus = false, filtros = SEM_FILTROS }: { eu: string; agora: Date; soMeus?: boolean; filtros?: Filtros },
): { meus: E[]; semana: E[]; alertas: { tipo: TipoDeAlerta; eventos: E[] }[]; depois: E[] } {
  const daSemana = filtrar(eventos, { ...SEM_FILTROS, semana: true }, { eu, agora });
  const ordem = (a: NoCalendario, b: NoCalendario) =>
    a.inicio.getTime() - b.inicio.getTime() || Number(b.diaInteiro) - Number(a.diaInteiro);
  const meus = daSemana.filter((e) => e.envolvidos.includes(eu)).sort(ordem);
  return {
    meus,
    semana: soMeus ? meus : [...daSemana].sort(ordem),
    alertas: alertas(daSemana, agora),
    depois: proximosEventos(filtrar(eventos, filtros, { eu, agora }), agora).depois,
  };
}
