import { caminhoDaPasta, ErroDoDrive, esperaEmMinutos, linkDaPasta, MAXIMO_DE_TENTATIVAS } from "./drive";

/** O que o Mural precisa do Drive: achar e criar uma pasta dentro de outra. A implementação real fica em src/lib/drive. */
export interface ClienteDoDrive {
  buscarPasta(nome: string, paiId: string): Promise<{ id: string } | null>;
  criarPasta(nome: string, paiId: string): Promise<{ id: string }>;
}

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
    const permanente = erro instanceof ErroDoDrive && erro.permanente;
    if (permanente || tarefa.tentativas >= MAXIMO_DE_TENTATIVAS) return { estado: "falhou", erro: mensagemDe(erro) };
    return { estado: "adiada", erro: mensagemDe(erro), depoisDeMinutos: esperaEmMinutos(tarefa.tentativas) };
  }
}
