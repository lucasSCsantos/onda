/** Uma opção de select, de seleção múltipla ou de grupo de radios. */
export type Opcao = { valor: string; texto: string };

/** Acima disto, o painel do select ganha uma busca. */
export const LIMITE_PARA_BUSCA = 8;

export const temBusca = (total: number) => total > LIMITE_PARA_BUSCA;

/** Minúsculas e sem acentos, para comparar o que se digita com o texto das opções. */
function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/** As opções cujo texto contém a busca; busca vazia devolve todas. */
export function filtrarOpcoes<T extends Opcao>(opcoes: T[], busca: string): T[] {
  const alvo = normalizar(busca);
  if (!alvo) return opcoes;
  return opcoes.filter((o) => normalizar(o.texto).includes(alvo));
}

/** Para onde vai o item ativo com uma tecla de navegação. Fica nos limites da lista, sem dar a volta; -1 é "nenhum". */
export function moverIndice(atual: number, total: number, tecla: "baixo" | "cima" | "inicio" | "fim"): number {
  if (total === 0) return -1;
  if (tecla === "inicio") return 0;
  if (tecla === "fim") return total - 1;
  if (atual < 0) return tecla === "baixo" ? 0 : total - 1;
  return Math.min(total - 1, Math.max(0, atual + (tecla === "baixo" ? 1 : -1)));
}

/**
 * O índice da próxima opção que começa com o que foi digitado, a partir da ativa e dando a volta. Repetir a mesma letra
 * ("ee") percorre as opções que começam com ela. Sem correspondência, devolve o índice atual.
 */
export function buscarPorDigitacao(opcoes: Opcao[], digitado: string, atual: number): number {
  const alvo = normalizar(digitado);
  if (!alvo) return atual;
  const repetida = alvo.length > 1 && [...alvo].every((letra) => letra === alvo[0]);
  const prefixo = repetida ? alvo[0] : alvo;
  // Com a letra repetida, parte da seguinte à ativa; com um prefixo novo, a própria ativa já pode servir.
  const partida = repetida || prefixo.length === 1 ? atual + 1 : Math.max(atual, 0);
  for (let passo = 0; passo < opcoes.length; passo++) {
    const indice = (((partida + passo) % opcoes.length) + opcoes.length) % opcoes.length;
    if (normalizar(opcoes[indice].texto).startsWith(prefixo)) return indice;
  }
  return atual;
}

export function indiceDoValor(opcoes: Opcao[], valor: string): number {
  return opcoes.findIndex((o) => o.valor === valor);
}

/** Liga ou desliga um valor numa seleção múltipla. */
export function alternarValor(valores: string[], valor: string): string[] {
  return valores.includes(valor) ? valores.filter((v) => v !== valor) : [...valores, valor];
}
