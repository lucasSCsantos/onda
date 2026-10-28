import { formatarHora, lerHora } from "./datas-e-horas";
import type { NativosDaCategoria } from "./campos-nativos";

/** O horário que uma Categoria costuma ter: início `HH:MM` e duração em minutos, ambos opcionais. */
export type HorarioPadrao = { inicio: string | null; duracaoMinutos: number | null };

export const SEM_HORARIO_PADRAO: HorarioPadrao = { inicio: null, duracaoMinutos: null };

/** A duração vai de 1 minuto a menos de um dia. */
export const DURACAO_MAXIMA_EM_MINUTOS = 24 * 60 - 1;

/**
 * O que a migração `horarios_padrao` grava (`tests/rls/horarios-padrao.test.ts` confere que o banco e este mapa
 * batem). As demais Categorias ficam sem padrão: nenhuma duração é inventada.
 */
export const HORARIOS_PADRAO_INICIAIS: Record<string, HorarioPadrao> = {
  EBD: { inicio: "09:00", duracaoMinutos: null },
  "Pequeno grupo": { inicio: "15:00", duracaoMinutos: null },
};

/** O padrão como veio do formulário do Admin; vazio limpa o valor. */
export function lerHorarioPadrao(entrada: { inicio: string; duracao: string }): HorarioPadrao | { erro: string } {
  const inicio = entrada.inicio.trim();
  if (inicio && lerHora(inicio) === null) return { erro: "Informe uma hora válida para o início, como 09:00." };
  const duracao = entrada.duracao.trim();
  let duracaoMinutos: number | null = null;
  if (duracao) {
    duracaoMinutos = /^\d+$/.test(duracao) ? Number(duracao) : NaN;
    if (!(duracaoMinutos >= 1 && duracaoMinutos <= DURACAO_MAXIMA_EM_MINUTOS)) {
      return { erro: `A duração vai de 1 a ${DURACAO_MAXIMA_EM_MINUTOS} minutos.` };
    }
  }
  return { inicio: inicio || null, duracaoMinutos };
}

/** A Postagem usa a data de publicação: não tem horário padrão, nem tela para ele. */
export const categoriaTemHorario = (categoria: { nome: string }) => categoria.nome !== "Postagem";

/** O horário como o banco devolve (`09:00:00`) em `HH:MM`; sem horário, `null`. */
export const horarioDoBanco = (horario: string | null): string | null => horario?.slice(0, 5) ?? null;

/** O padrão que a Categoria tem hoje difere do que o Admin mandou? Sem diferença, não há o que gravar nem registrar. */
export function mudouOHorarioPadrao(atual: { horario_padrao: string | null; duracao_padrao_minutos: number | null } | undefined, novo: HorarioPadrao): boolean {
  return !atual || horarioDoBanco(atual.horario_padrao) !== novo.inicio || atual.duracao_padrao_minutos !== novo.duracaoMinutos;
}

type CategoriaComHorario = { nome: string; horarioPadrao?: HorarioPadrao; nativos?: Partial<NativosDaCategoria> };

/**
 * Os valores com que o formulário de Evento **novo** abre: o início da Categoria e, só se ela tem duração e mostra o
 * campo de fim, o fim. Um fim que passaria da meia-noite fica em branco. A Postagem (data de publicação) e as Categorias
 * sem padrão abrem como sempre. Nunca vale para Eventos que já existem nem para a edição.
 */
export function valoresIniciaisDoHorario(categoria: CategoriaComHorario): { hora?: string; hora_fim?: string } {
  const { inicio, duracaoMinutos } = categoria.horarioPadrao ?? SEM_HORARIO_PADRAO;
  const minutosDoInicio = inicio === null ? null : lerHora(inicio);
  if (!categoriaTemHorario(categoria) || minutosDoInicio === null) return {};
  const valores: { hora: string; hora_fim?: string } = { hora: inicio! };
  const mostraOFim = categoria.nativos?.fim !== "oculto";
  if (duracaoMinutos && mostraOFim && minutosDoInicio + duracaoMinutos <= DURACAO_MAXIMA_EM_MINUTOS) {
    valores.hora_fim = formatarHora(minutosDoInicio + duracaoMinutos);
  }
  return valores;
}
