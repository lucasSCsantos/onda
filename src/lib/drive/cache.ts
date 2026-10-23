import type { ClienteDoDrive } from "@/dominio/pastas";

/** Por quanto tempo uma resposta do Drive vale: o bastante para a navegação ser rápida, pouco para o novo aparecer logo. */
export const VALIDADE_PADRAO_MS = 3 * 60_000;
const MAXIMO_DE_ENTRADAS = 500;

/**
 * O mesmo Drive com cache de poucos minutos para olhar itens e listar pastas (o que a seção Arquivos mais repete: cada
 * página sobe a cadeia de pais). Criar, renomear e baixar passam direto. Só se guarda resposta que deu certo, então um
 * erro nunca fica preso. `limpar` esquece tudo: é o botão "Atualizar".
 */
export function comCache(cliente: ClienteDoDrive, { validadeMs = VALIDADE_PADRAO_MS, agora = Date.now }: { validadeMs?: number; agora?: () => number } = {}) {
  const guardado = new Map<string, { valor: unknown; venceEm: number }>();

  async function lembrar<T>(chave: string, buscar: () => Promise<T>, validade = validadeMs): Promise<T> {
    const antigo = guardado.get(chave);
    if (antigo && antigo.venceEm > agora()) return antigo.valor as T;
    const valor = await buscar();
    guardado.delete(chave);
    guardado.set(chave, { valor, venceEm: agora() + validade });
    if (guardado.size > MAXIMO_DE_ENTRADAS) guardado.delete(guardado.keys().next().value!);
    return valor;
  }

  const comCacheDoDrive: ClienteDoDrive = {
    ...cliente,
    obterItem: (id) => lembrar(`item|${id}`, () => cliente.obterItem(id)),
    listarFilhos: (paiId, opcoes) => lembrar(`filhos|${paiId}|${opcoes.ordem}|${opcoes.pagina ?? ""}|${opcoes.tamanho}`, () => cliente.listarFilhos(paiId, opcoes)),
  };
  /** `lembrar` serve a outras respostas caras, como o índice da busca, com a mesma regra de validade e o mesmo "Atualizar". */
  return { cliente: comCacheDoDrive, limpar: () => guardado.clear(), lembrar };
}
