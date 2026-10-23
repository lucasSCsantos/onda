import { diaDe, type Status } from "./eventos";
import { dataLocal, meiaNoite, somarDias } from "./fuso";

/** Quantos dias depois do dia da aula o cartão continua à vista (padrão: até o fim do dia seguinte). O banco confere os mesmos limites. */
export const JANELA_MINIMA = 0;
export const JANELA_MAXIMA = 7;
export const JANELA_PADRAO = 1;

/** De hoje (a Chamada ainda vai acontecer), feita ✓ ou pendente (o horário da aula passou sem Chamada). */
export type EstadoDoCartao = "de-hoje" | "feita" | "pendente";

type AulaDoCartao = {
  id: string;
  inicio: Date;
  fim: Date | null;
  diaInteiro: boolean;
  status: Status;
  temChamada: boolean;
  /** Os ids do Professor e do Auxiliar da aula (`professoresDaAula`). */
  professores: readonly string[];
};

/** Aulas que não vão acontecer não pedem Chamada. */
const SEM_CHAMADA: readonly Status[] = ["cancelado", "adiado", "rascunho"];

/** O instante em que a aula acaba: o fim, ou o início; numa aula de dia inteiro, a meia-noite seguinte. */
function fimDaAula({ inicio, fim, diaInteiro }: AulaDoCartao): Date {
  if (!diaInteiro) return fim ?? inicio;
  const { ano, mes, dia } = dataLocal(fim ?? inicio);
  return somarDias(meiaNoite(ano, mes, dia), 1);
}

/**
 * Os cartões de Chamada de quem é Professor ou Auxiliar (`eu`), em ordem cronológica: do início do dia da aula até o fim
 * do dia `janelaDias` depois. `feitas` são os ids das aulas com a Chamada concluída (ao menos uma presença).
 */
export function cartoesDeChamada<A extends AulaDoCartao>(
  aulas: readonly A[],
  { eu, agora, janelaDias, feitas }: { eu: string; agora: Date; janelaDias: number; feitas: ReadonlySet<string> },
): { aula: A; estado: EstadoDoCartao }[] {
  const hoje = diaDe(agora);
  return aulas
    .filter(
      (a) =>
        a.temChamada &&
        a.professores.includes(eu) &&
        !SEM_CHAMADA.includes(a.status) &&
        diaDe(a.inicio) <= hoje &&
        hoje <= diaDe(somarDias(a.inicio, janelaDias)),
    )
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
    .map((aula) => ({
      aula,
      estado: feitas.has(aula.id) ? "feita" : fimDaAula(aula) <= agora ? "pendente" : "de-hoje",
    }));
}
