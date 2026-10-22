import { dataLocal } from "./fuso";

// O ranking anual dos Adolescentes. O banco soma os pontos do ano (`public.pontos_do_ano`, com a pontuação atual de
// cada Marcação); aqui se classifica e se desempata. Nada é guardado: mudar os pontos de uma Marcação refaz o ranking de
// todos os anos, inclusive os passados (ADR 0005).

/** Uma linha de `pontos_do_ano`: quantas vezes um Adolescente teve uma Marcação no ano, e quanto isso soma. */
export type PontosDaMarcacao = { adolescente: string; nome: string; ativo: boolean; marcacao: string; quantas: number; pontos: number };

export type Classificado = {
  posicao: number;
  adolescente: { id: string; nome: string; ativo: boolean };
  pontos: number;
  /** Quantas vezes teve a Marcação do desempate (0 sem desempate). */
  desempate: number;
  /** Os pontos Marcação por Marcação, para o detalhamento. */
  porMarcacao: { marcacao: string; quantas: number; pontos: number }[];
};

/**
 * Soma os pontos por Adolescente e classifica: mais pontos na frente; no empate, quem tem mais da Marcação do desempate
 * (`desempatePor`). Quem continua empatado divide a posição, e a seguinte pula (1, 2, 2, 4). Dentro de uma posição, a
 * ordem é alfabética. Sem `desempatePor`, empate em pontos já divide a posição.
 */
export function classificar(linhas: readonly PontosDaMarcacao[], desempatePor: string | null): Classificado[] {
  const porAdolescente = new Map<string, Omit<Classificado, "posicao">>();
  for (const linha of linhas) {
    let item = porAdolescente.get(linha.adolescente);
    if (!item) {
      item = { adolescente: { id: linha.adolescente, nome: linha.nome, ativo: linha.ativo }, pontos: 0, desempate: 0, porMarcacao: [] };
      porAdolescente.set(linha.adolescente, item);
    }
    item.pontos += linha.pontos;
    if (linha.marcacao === desempatePor) item.desempate += linha.quantas;
    item.porMarcacao.push({ marcacao: linha.marcacao, quantas: linha.quantas, pontos: linha.pontos });
  }

  const ordenados = [...porAdolescente.values()].sort(
    (a, b) => b.pontos - a.pontos || b.desempate - a.desempate || a.adolescente.nome.localeCompare(b.adolescente.nome, "pt-BR"),
  );
  return ordenados.map((item, i) => {
    let inicio = i;
    while (inicio > 0 && ordenados[inicio - 1].pontos === item.pontos && ordenados[inicio - 1].desempate === item.desempate) inicio -= 1;
    return { posicao: inicio + 1, ...item };
  });
}

/** O ano pedido na URL, se for um ano plausível; senão, o ano corrente no fuso do Mural. */
export function lerAno(texto: string | undefined, agora: Date): number {
  const ano = Number(texto);
  return Number.isInteger(ano) && ano >= 2000 && ano <= 2100 ? ano : dataLocal(agora).ano;
}

/** Os anos do seletor: os que têm presença e o corrente, do mais recente ao mais antigo. */
export function anosDoSeletor(comPresenca: readonly number[], agora: Date): number[] {
  return [...new Set([dataLocal(agora).ano, ...comPresenca])].sort((a, b) => b - a);
}

/** A Marcação do desempate escolhida no formulário: um id, ou vazio para "sem desempate". */
export function lerDesempate(texto: string): string | null | { erro: string } {
  if (texto === "") return null;
  return /^[0-9a-f-]{36}$/i.test(texto) ? texto : { erro: "Escolha uma Marcação para o desempate." };
}
