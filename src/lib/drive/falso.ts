import type { ClienteDoDrive } from "@/dominio/pastas";

/**
 * Um Drive em memória, só para testes: pastas com nome, pai e ID, e falhas combinadas por nome de pasta (o pedido de
 * outro Evento nunca cai numa falha que não era dele). Serve ao domínio e aos testes de banco, e vai crescer com o
 * painel de Arquivos.
 */
export function driveFalso() {
  const pastas: { id: string; nome: string; pai: string }[] = [];
  const falhas = new Map<string, Error[]>();

  const falharSeCombinado = (nome: string) => {
    const erro = falhas.get(nome)?.shift();
    if (erro) throw erro;
  };

  const cliente: ClienteDoDrive = {
    async buscarPasta(nome, paiId) {
      falharSeCombinado(nome);
      return pastas.find((p) => p.nome === nome && p.pai === paiId) ?? null;
    },
    async criarPasta(nome, paiId) {
      falharSeCombinado(nome);
      const pasta = { id: `PASTA${String(pastas.length + 1).padStart(6, "0")}`, nome, pai: paiId };
      pastas.push(pasta);
      return { id: pasta.id };
    },
  };

  /** Os nomes do caminho, da raiz até a pasta de nome dado (sem a raiz, que não é uma pasta daqui). */
  const caminhoDe = (nome: string) => {
    const nomes: string[] = [];
    let atual = pastas.find((p) => p.nome === nome);
    while (atual) {
      nomes.unshift(atual.nome);
      const pai: string = atual.pai;
      atual = pastas.find((p) => p.id === pai);
    }
    return nomes;
  };

  return {
    cliente,
    pastas,
    caminhoDe,
    /** Os próximos pedidos que mexerem numa pasta com este nome (buscar ou criar) falham com estes erros, um por pedido. */
    falharAoMexerEm: (nome: string, ...erros: Error[]) => falhas.set(nome, erros),
  };
}
