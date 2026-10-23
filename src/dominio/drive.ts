import { dataLocal } from "./fuso";

// Pastas do Evento no Drive do ministério (ADR 0006): nomes, ID da pasta raiz, espera entre tentativas e a
// configuração do Admin. O que fala com o Drive e com o banco fica em src/lib/drive; as regras ficam aqui.

/** Quantas vezes a criação de uma pasta é tentada antes de a tarefa falhar de vez. */
export const MAXIMO_DE_TENTATIVAS = 5;

/** Minutos de espera depois de cada tentativa que falhou (1ª, 2ª…); passando da lista, vale a última. */
const ESPERAS_EM_MINUTOS = [1, 5, 15, 60, 240];

export const esperaEmMinutos = (tentativa: number) => ESPERAS_EM_MINUTOS[Math.min(Math.max(tentativa, 1), ESPERAS_EM_MINUTOS.length) - 1];

/** O Drive recusou ou não achou algo; `permanente` quando tentar de novo não adianta (a pasta raiz some ou não é nossa). */
export class ErroDoDrive extends Error {
  readonly permanente: boolean;
  constructor(mensagem: string, { permanente = false }: { permanente?: boolean } = {}) {
    super(mensagem);
    this.name = "ErroDoDrive";
    this.permanente = permanente;
  }
}

const TAMANHO_MAXIMO_DO_NOME = 120;
const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** `AAAA-MM-DD · título`, com a data no fuso do Mural; o título perde barras, quebras de linha e espaços a mais. */
export function nomeDaPasta({ inicio, titulo }: { inicio: Date; titulo: string }): string {
  const { ano, mes, dia } = dataLocal(inicio);
  const prefixo = `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)} · `;
  const limpo = titulo
    .replace(/\s+/g, " ")
    .replace(/[/\\]/g, "-")
    .trim();
  return `${prefixo}${limpo.slice(0, TAMANHO_MAXIMO_DO_NOME - prefixo.length)}`.trim();
}

/** Onde a pasta do Evento mora dentro da raiz: Categoria, ano e a pasta do Evento. */
export function caminhoDaPasta({ categoria, inicio, titulo }: { categoria: string; inicio: Date; titulo: string }): string[] {
  return [categoria, String(dataLocal(inicio).ano), nomeDaPasta({ inicio, titulo })];
}

/** O ID de uma pasta do Drive, vindo puro ou dentro do endereço da pasta; nulo se não parece uma. */
export function idDaPasta(texto: string): string | null {
  const limpo = texto.trim();
  const doEndereco = limpo.match(/\/folders\/([A-Za-z0-9_-]{10,})(?:[/?#]|$)/);
  if (doEndereco) return doEndereco[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(limpo) ? limpo : null;
}

export const linkDaPasta = (id: string) => `https://drive.google.com/drive/folders/${id}`;

/** O que o formulário de configurações envia para o Drive; a caixa de marcar vem como "on" ou vazia. */
export type EntradaDoDrive = { ligado: string; pastaRaiz: string; categorias: string[] };

export type ConfiguracaoDoDrive = {
  drive_ligado: boolean;
  drive_pasta_raiz_id: string | null;
  drive_categorias: string[];
};

/** A configuração do Drive pronta para gravar, ou o que impede. Ligar exige uma pasta raiz válida. */
export function lerConfiguracaoDoDrive(entrada: EntradaDoDrive): ConfiguracaoDoDrive | { erro: string } {
  const ligado = entrada.ligado === "on";
  const informada = entrada.pastaRaiz.trim() !== "";
  const raiz = informada ? idDaPasta(entrada.pastaRaiz) : null;
  if (informada && raiz === null) return { erro: "A pasta raiz do Drive não parece uma pasta: cole o endereço dela ou o ID." };
  if (ligado && raiz === null) return { erro: "Para ligar o Drive, informe a pasta raiz (o endereço dela ou o ID)." };
  return { drive_ligado: ligado, drive_pasta_raiz_id: raiz, drive_categorias: [...new Set(entrada.categorias)] };
}

const escaparNaConsulta = (texto: string) => texto.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

/** A consulta da API do Drive que acha uma pasta pelo nome dentro de outra; aspas e barras do nome são escapadas. */
export const consultaDeBusca = (nome: string, paiId: string) =>
  `name = '${escaparNaConsulta(nome)}' and '${escaparNaConsulta(paiId)}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

/** Os campos de link onde a pasta mora; os mesmos nomes de `campo_da_pasta`, no banco. */
export const NOMES_DO_CAMPO_DA_PASTA = ["Link do material", "Link dos materiais"];

export type EstadoDaPasta = "pendente" | "criada" | "falhou";

/** O que a tela do Evento diz da pasta no Drive, e com que tom; nulo quando o Evento não tem pasta automática. */
export function situacaoDaPasta(estado: EstadoDaPasta | null): { tom: "info" | "ok" | "erro"; texto: string } | null {
  switch (estado) {
    case "pendente":
      return { tom: "info", texto: "Criando a pasta no Drive. Em instantes o link aparece em “Link do material”. Se demorar, avise quem administra o Mural." };
    case "criada":
      return { tom: "ok", texto: "Pasta criada no Drive. O link só abre para quem tem acesso à pasta no Drive." };
    case "falhou":
      return {
        tom: "erro",
        texto: "Não foi possível criar a pasta no Drive. Se quiser, cole o link da pasta em “Link do material”.",
      };
    default:
      return null;
  }
}

/** A Categoria tem um campo de link para a pasta? Sem ele, o Evento não ganha pasta sozinho. */
export const temCampoDaPasta = (campos: readonly { nome: string; tipo: string }[]) =>
  campos.some((c) => c.tipo === "link" && NOMES_DO_CAMPO_DA_PASTA.includes(c.nome));

/**
 * O agendador do banco chama o app com `Authorization: Bearer <segredo>`. A comparação percorre sempre o texto todo,
 * para o tempo da resposta não revelar quantos caracteres batem; sem segredo configurado, ninguém entra.
 */
export function autorizadoPeloAgendador(cabecalho: string | null, segredo: string | undefined): boolean {
  if (!segredo) return false;
  const esperado = `Bearer ${segredo}`;
  const recebido = cabecalho ?? "";
  let diferenca = recebido.length ^ esperado.length;
  for (let i = 0; i < esperado.length; i++) diferenca |= (recebido.charCodeAt(i) || 0) ^ esperado.charCodeAt(i);
  return diferenca === 0;
}
