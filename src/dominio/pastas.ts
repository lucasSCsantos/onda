import { caminhoDaPasta, ErroDoDrive, esperaEmMinutos, linkDaPasta, MAXIMO_DE_TENTATIVAS, nomeDaPasta } from "./drive";

/**
 * O que o Mural precisa do Drive: achar e criar uma pasta dentro de outra, e trocar o nome de uma. Nunca apaga nem move
 * (ADR 0006). A implementação real fica em src/lib/drive.
 */
export interface ClienteDoDrive {
  buscarPasta(nome: string, paiId: string): Promise<{ id: string } | null>;
  criarPasta(nome: string, paiId: string): Promise<{ id: string }>;
  renomearPasta(pastaId: string, nome: string): Promise<void>;
  /** Arquivos, só leitura: olhar um item, listar o conteúdo de uma pasta por páginas e baixar. */
  obterItem(id: string): Promise<ItemDoDrive>;
  listarFilhos(paiId: string, opcoes: { ordem: OrdemDaListagem; pagina: string | null; tamanho: number }): Promise<{ itens: ItemDoDrive[]; proxima: string | null }>;
  baixar(id: string): Promise<Uint8Array>;
  /** A miniatura de um arquivo, quando o Drive tem uma; nulo se não tem. */
  miniatura(id: string): Promise<{ bytes: Uint8Array; mime: string } | null>;
}

/** Um arquivo ou pasta do Drive como o Mural precisa vê-lo. `pais` são os IDs das pastas onde mora (o Drive permite mais de um). */
export type ItemDoDrive = {
  id: string;
  nome: string;
  pasta: boolean;
  mime: string;
  tamanho: number | null;
  modificadoEm: Date | null;
  pais: string[];
};

/** Como uma listagem se ordena: pastas sempre vêm antes dos arquivos. */
export type OrdemDaListagem = "nome" | "nome-desc" | "data" | "data-desc";

/** Uma tarefa de criar a pasta de um Evento. `tentativas` já conta a que está rodando. */
export type TarefaDePasta = { categoria: string; inicio: Date; titulo: string; tentativas: number };

export type ResultadoDaPasta =
  | { estado: "criada"; pastaId: string; link: string }
  /** Falhou agora, mas vale tentar de novo depois da espera. */
  | { estado: "adiada"; erro: string; depoisDeMinutos: number }
  | { estado: "falhou"; erro: string };

/** O erro vira texto curto para o banco e os Logs: nunca o objeto inteiro, que poderia carregar o que não deve. */
const TAMANHO_MAXIMO_DO_ERRO = 300;
const mensagemDe = (erro: unknown) => (erro instanceof Error ? erro.message : String(erro)).slice(0, TAMANHO_MAXIMO_DO_ERRO);

/**
 * Cria `Categoria/Ano/AAAA-MM-DD · título` dentro da raiz. Cada nível é achado antes de criado, então repetir a tarefa
 * (ou outra aula na mesma Categoria e ano) reaproveita o que já existe e nunca duplica. Não apaga nada.
 */
export async function criarPastaDoEvento({
  tarefa,
  raizId,
  cliente,
}: {
  tarefa: TarefaDePasta;
  raizId: string;
  cliente: ClienteDoDrive;
}): Promise<ResultadoDaPasta> {
  try {
    let paiId = raizId;
    for (const nome of caminhoDaPasta(tarefa)) {
      const existente = await cliente.buscarPasta(nome, paiId);
      paiId = (existente ?? (await cliente.criarPasta(nome, paiId))).id;
    }
    return { estado: "criada", pastaId: paiId, link: linkDaPasta(paiId) };
  } catch (erro) {
    return falhaDe(erro, tarefa.tentativas);
  }
}

/** A tentativa falhou: erro permanente ou tentativas esgotadas fecham a tarefa; o resto espera e volta. */
function falhaDe(erro: unknown, tentativas: number): Extract<ResultadoDaPasta, { estado: "adiada" | "falhou" }> {
  const permanente = erro instanceof ErroDoDrive && erro.permanente;
  if (permanente || tentativas >= MAXIMO_DE_TENTATIVAS) return { estado: "falhou", erro: mensagemDe(erro) };
  return { estado: "adiada", erro: mensagemDe(erro), depoisDeMinutos: esperaEmMinutos(tentativas) };
}

/** Uma tarefa de renomear a pasta de um Evento que mudou de título ou de data. `tentativas` já conta a que está rodando. */
export type TarefaDeRenomear = { pastaId: string; inicio: Date; titulo: string; tentativas: number };

export type ResultadoDaRenomeacao = { estado: "renomeada" } | Extract<ResultadoDaPasta, { estado: "adiada" | "falhou" }>;

/**
 * Dá à pasta do Evento o nome certo para o título e a data de agora. Só troca o nome: o conteúdo fica, e a pasta
 * continua onde está, mesmo que a data tenha mudado de ano. Renomear para o nome que já tem não muda nada.
 */
export async function renomearPastaDoEvento({ tarefa, cliente }: { tarefa: TarefaDeRenomear; cliente: ClienteDoDrive }): Promise<ResultadoDaRenomeacao> {
  try {
    await cliente.renomearPasta(tarefa.pastaId, nomeDaPasta(tarefa));
    return { estado: "renomeada" };
  } catch (erro) {
    return falhaDe(erro, tarefa.tentativas);
  }
}
