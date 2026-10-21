/** Uma tarefa do checklist: texto e feita ou não feita. */
export type ItemDoChecklist = { texto: string; feito: boolean };

/** O que se faz num checklist; `posicao` é a do item na lista. */
export type MudancaNoChecklist =
  | { tipo: "adicionar"; texto: string }
  | { tipo: "marcar"; posicao: number; feito: boolean }
  | { tipo: "remover"; posicao: number };

/** Um valor gravado num campo checklist (uma lista de `{ texto, feito }`)? O banco confere o mesmo formato em `campo_valido`. */
export function eChecklist(valor: unknown): valor is ItemDoChecklist[] {
  return (
    Array.isArray(valor) &&
    valor.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof item.texto === "string" &&
        item.texto.trim() !== "" &&
        typeof item.feito === "boolean",
    )
  );
}

/** O checklist depois de uma mudança, ou o que a impede. O checklist anterior não é alterado. */
export function mudarChecklist(itens: readonly ItemDoChecklist[], mudanca: MudancaNoChecklist): { itens: ItemDoChecklist[] } | { erro: string } {
  if (mudanca.tipo === "adicionar") {
    const texto = mudanca.texto.trim();
    return texto ? { itens: [...itens, { texto, feito: false }] } : { erro: "Escreva a tarefa." };
  }
  if (!Number.isInteger(mudanca.posicao) || mudanca.posicao < 0 || mudanca.posicao >= itens.length) {
    return { erro: "Tarefa não encontrada. Atualize a página." };
  }
  if (mudanca.tipo === "remover") return { itens: itens.filter((_, i) => i !== mudanca.posicao) };
  return { itens: itens.map((item, i) => (i === mudanca.posicao ? { ...item, feito: mudanca.feito } : item)) };
}

/** Quantas tarefas estão feitas, para o resumo "2 de 5". */
export const tarefasFeitas = (itens: readonly ItemDoChecklist[]) => itens.filter((item) => item.feito).length;

/** A mudança que um botão do checklist envia: `adicionar`, `marcar:<posição>:<feito>` ou `remover:<posição>`. */
export function lerMudancaDoChecklist(botao: string, texto: string): MudancaNoChecklist {
  const [tipo, posicao, feito] = botao.split(":");
  if (tipo === "marcar") return { tipo, posicao: Number(posicao), feito: feito === "true" };
  if (tipo === "remover") return { tipo, posicao: Number(posicao) };
  return { tipo: "adicionar", texto };
}
