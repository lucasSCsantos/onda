import { ErroDoDrive } from "@/dominio/drive";
import type { ClienteDoDrive, ItemDoDrive, OrdemDaListagem } from "@/dominio/pastas";

const PASTA = "application/vnd.google-apps.folder";

type Item = { id: string; nome: string; pai: string; pasta: boolean; mime: string; tamanho: number | null; modificadoEm: Date | null; conteudo: Uint8Array };

/**
 * Um Drive em memória, só para testes: pastas e arquivos com nome, pai e ID, e falhas combinadas por nome de pasta (o
 * pedido de outro Evento nunca cai numa falha que não era dele). Serve ao domínio e aos testes de banco.
 */
export function driveFalso() {
  const itens: Item[] = [];
  const falhas = new Map<string, Error[]>();
  const falhasAoListar: Error[] = [];
  const chamadas = { obterItem: 0, listarFilhos: 0, baixar: 0 };

  const falharSeCombinado = (nome: string) => {
    const erro = falhas.get(nome)?.shift();
    if (erro) throw erro;
  };

  const novoId = () => `PASTA${String(itens.length + 1).padStart(6, "0")}`;

  const criar = (nome: string, pai: string, resto: Partial<Item> = {}) => {
    const item: Item = { id: novoId(), nome, pai, pasta: true, mime: PASTA, tamanho: null, modificadoEm: null, conteudo: new Uint8Array(), ...resto };
    itens.push(item);
    return item;
  };

  const doDrive = (i: Item): ItemDoDrive => ({ id: i.id, nome: i.nome, pasta: i.pasta, mime: i.mime, tamanho: i.tamanho, modificadoEm: i.modificadoEm, pais: i.pai ? [i.pai] : [] });

  const cliente: ClienteDoDrive = {
    async buscarPasta(nome, paiId) {
      falharSeCombinado(nome);
      return itens.find((p) => p.pasta && p.nome === nome && p.pai === paiId) ?? null;
    },
    async criarPasta(nome, paiId) {
      falharSeCombinado(nome);
      return { id: criar(nome, paiId).id };
    },
    async renomearPasta(pastaId, nome) {
      falharSeCombinado(nome);
      const pasta = itens.find((i) => i.id === pastaId && i.pasta);
      if (!pasta) throw new ErroDoDrive("pasta não encontrada ou sem acesso", { permanente: true });
      pasta.nome = nome;
    },
    async obterItem(id) {
      chamadas.obterItem++;
      const item = itens.find((i) => i.id === id);
      if (!item) throw new ErroDoDrive("Drive 404: File not found", { permanente: true });
      return doDrive(item);
    },
    async listarFilhos(paiId, { ordem, pagina, tamanho }) {
      chamadas.listarFilhos++;
      const erro = falhasAoListar.shift();
      if (erro) throw erro;
      const filhos = itens.filter((i) => i.pai === paiId).sort(comparar(ordem));
      const inicio = pagina ? Number(pagina) : 0;
      const fim = inicio + tamanho;
      return { itens: filhos.slice(inicio, fim).map(doDrive), proxima: fim < filhos.length ? String(fim) : null };
    },
    async baixar(id) {
      chamadas.baixar++;
      const item = itens.find((i) => i.id === id && !i.pasta);
      if (!item) throw new ErroDoDrive("Drive 404: File not found", { permanente: true });
      return item.conteudo;
    },
  };

  /** Os nomes do caminho, da raiz até a pasta de nome dado (sem a raiz, que não é uma pasta daqui). */
  const caminhoDe = (nome: string) => {
    const nomes: string[] = [];
    let atual = itens.find((p) => p.nome === nome);
    while (atual) {
      nomes.unshift(atual.nome);
      const pai: string = atual.pai;
      atual = itens.find((p) => p.id === pai);
    }
    return nomes;
  };

  return {
    cliente,
    /** Só as pastas, como o ticket de pastas do Evento as conta. */
    get pastas() {
      return itens.filter((i) => i.pasta);
    },
    chamadas,
    caminhoDe,
    /** Uma pasta dentro de `pai`; devolve o ID. Um `pai` que o Drive falso não conhece vale como pasta de fora (a raiz de mentira). */
    pasta: (nome: string, pai: string) => criar(nome, pai).id,
    /** Um arquivo dentro de `pai`; devolve o ID. */
    arquivo: (nome: string, pai: string, { mime = "application/pdf", tamanho = 1024, modificadoEm = null, conteudo = new Uint8Array() }: Partial<Pick<Item, "mime" | "tamanho" | "modificadoEm" | "conteudo">> = {}) =>
      criar(nome, pai, { pasta: false, mime, tamanho, modificadoEm, conteudo }).id,
    /** Muda de pasta um item que já existe (para testar o que sai da raiz). */
    mover: (id: string, novoPai: string) => {
      const item = itens.find((i) => i.id === id);
      if (item) item.pai = novoPai;
    },
    /** Os próximos pedidos que mexerem numa pasta com este nome (buscar ou criar) falham com estes erros, um por pedido. */
    falharAoMexerEm: (nome: string, ...erros: Error[]) => falhas.set(nome, erros),
    /** As próximas listagens falham com estes erros, uma por pedido. */
    falharAoListar: (...erros: Error[]) => falhasAoListar.push(...erros),
  };
}

/** Pastas antes; depois por nome (sem ligar para maiúsculas) ou por data da última mudança, como o Drive ordena. */
function comparar(ordem: OrdemDaListagem) {
  return (a: Item, b: Item) => {
    if (a.pasta !== b.pasta) return a.pasta ? -1 : 1;
    const sentido = ordem.endsWith("-desc") ? -1 : 1;
    if (ordem.startsWith("data")) return sentido * ((a.modificadoEm?.getTime() ?? 0) - (b.modificadoEm?.getTime() ?? 0));
    return sentido * a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
  };
}
