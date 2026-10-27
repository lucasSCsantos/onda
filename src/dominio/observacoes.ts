import type { Pessoa } from "./acesso";

// Observações da Liderança sobre um Adolescente: texto simples, com autoria. Quem lê e quem muda é decidido no banco
// (supabase/migrations/20261027030000_observacoes.sql); aqui ficam as regras que a tela espelha.

export const LIMITE_DA_OBSERVACAO = 2000;

export const AVISO_DAS_OBSERVACOES =
  "Visível apenas para a liderança. Registre só o que ajuda a cuidar do adolescente e evite dados de saúde ou informações sensíveis da família.";

export type Observacao = {
  id: string;
  texto: string;
  /** Nulo quando a conta de quem escreveu foi removida. */
  autorId: string | null;
  autorNome: string | null;
  criadoEm: Date;
  editadoEm: Date;
};

/** O que impede salvar o texto; `null` se nada impede. O conteúdo nunca é julgado: só o tamanho. */
export function erroNaObservacao(texto: string): string | null {
  if (!texto.trim()) return "Escreva a observação.";
  if (!cabeNoLimite(texto)) return "A observação pode ter no máximo 2.000 caracteres.";
  return null;
}

export const cabeNoLimite = (texto: string) => texto.length <= LIMITE_DA_OBSERVACAO;

/** Quantos caracteres ainda cabem; negativo quando passou. */
export const restantes = (texto: string) => LIMITE_DA_OBSERVACAO - texto.length;

/** Só o autor e o Admin editam e apagam. */
export function podeMudarObservacao(quem: Pessoa, autorId: string | null): boolean {
  if (!quem.ativo) return false;
  if (quem.nivel === "admin") return true;
  return quem.nivel === "lider" && autorId !== null && autorId === quem.id;
}

/** Da mais antiga para a mais nova. Devolve uma lista nova. */
export function ordenarObservacoes<T extends { criadoEm: Date }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime());
}

/** Mostra "editada" só quando a última edição é de fato depois da criação (o banco carimba as duas juntas ao criar). */
export const foiEditada = ({ criadoEm, editadoEm }: { criadoEm: Date; editadoEm: Date }) => editadoEm.getTime() - criadoEm.getTime() >= 1000;
