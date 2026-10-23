import { ErroDoDrive, idDaPasta } from "./drive";
import type { ClienteDoDrive, ItemDoDrive, OrdemDaListagem } from "./pastas";

// Arquivos: o Drive do ministério, só para ler, dentro do Mural (ADR 0006). Aqui moram as regras: o que vale como
// "dentro da raiz", como uma pasta se abre, a ordem e os atalhos do Admin. O que fala com o Drive e com o banco fica
// em src/lib; a interface só desenha o que sai daqui.

/** Quantos itens vêm por página; o celular carrega rápido e quem quer mais pede a próxima. */
export const TAMANHO_DA_PAGINA = 40;

/** Quantos níveis de pasta se sobe, no máximo, procurando a raiz; mais fundo que isso não é do ministério. */
const PROFUNDIDADE_MAXIMA = 25;

export const ORDENS: readonly OrdemDaListagem[] = ["nome", "nome-desc", "data", "data-desc"];

export const NOMES_DAS_ORDENS: Record<OrdemDaListagem, string> = {
  nome: "Nome (A a Z)",
  "nome-desc": "Nome (Z a A)",
  data: "Mais antigos primeiro",
  "data-desc": "Mais recentes primeiro",
};

/** A ordem pedida na URL; qualquer coisa diferente das quatro conhecidas vale nome. */
export const lerOrdem = (texto: string | undefined): OrdemDaListagem => ORDENS.find((o) => o === texto) ?? "nome";

export type TipoDeItem = "pasta" | "imagem" | "pdf" | "documento" | "planilha" | "apresentacao" | "video" | "audio" | "outro";

/** O tipo que a tela mostra, pelo tipo MIME do Drive. Um atalho do Drive não é pasta: pode apontar para fora da raiz. */
export function tipoDoItem({ mime, pasta }: { mime: string; pasta: boolean }): TipoDeItem {
  if (pasta) return "pasta";
  if (mime.startsWith("image/")) return "imagem";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  if (mime === "application/vnd.google-apps.document" || /wordprocessingml|msword|opendocument\.text|^text\//.test(mime)) return "documento";
  if (mime === "application/vnd.google-apps.spreadsheet" || /spreadsheetml|ms-excel|opendocument\.spreadsheet/.test(mime)) return "planilha";
  if (mime === "application/vnd.google-apps.presentation" || /presentationml|ms-powerpoint|opendocument\.presentation/.test(mime)) return "apresentacao";
  return "outro";
}

/**
 * A cadeia de pastas de baixo do limite até o item (o limite não entra), ou nulo se o item não mora dentro do limite.
 * Sobe pelos pais, de pai em pai, até achar o limite: é a única prova de que algo é da raiz. Um item que o Drive não
 * conhece, uma subida que passa de 25 níveis e um ciclo valem como "fora"; erro passageiro do Drive sobe como erro,
 * porque não se dá acesso por falta de resposta.
 */
export async function caminhoDentro({
  limiteId,
  itemId,
  cliente,
}: {
  limiteId: string;
  itemId: string;
  cliente: ClienteDoDrive;
}): Promise<ItemDoDrive[] | null> {
  const visitados = new Set<string>();

  async function subir(id: string, profundidade: number): Promise<ItemDoDrive[] | null> {
    if (id === limiteId) return [];
    if (profundidade > PROFUNDIDADE_MAXIMA || visitados.has(id)) return null;
    visitados.add(id);
    let item: ItemDoDrive;
    try {
      item = await cliente.obterItem(id);
    } catch (erro) {
      if (erro instanceof ErroDoDrive && erro.permanente) return null;
      throw erro;
    }
    for (const pai of item.pais) {
      const acima = await subir(pai, profundidade + 1);
      if (acima) return [...acima, item];
    }
    return null;
  }

  return subir(itemId, 0);
}

/** Um item como a tela o mostra: nada do que o Drive sabe além disso (pais, tipo MIME cru, links) sai do servidor. */
export type ItemDeListagem = { id: string; nome: string; pasta: boolean; tipo: TipoDeItem; tamanho: number | null; modificadoEm: Date | null };

const paraListagem = (i: ItemDoDrive): ItemDeListagem => ({
  id: i.id,
  nome: i.nome,
  pasta: i.pasta,
  tipo: tipoDoItem(i),
  tamanho: i.tamanho,
  modificadoEm: i.modificadoEm,
});

/** O ID de um atalho (UUID) como vem na URL; qualquer outra coisa nem vai ao banco. */
export const lerIdDoAtalho = (texto: string | null | undefined): string | null =>
  texto && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(texto) ? texto : null;

/**
 * O que a seção Arquivos mostra antes de olhar o Drive: desligada (Drive desligado, sem pasta raiz ou sem credenciais),
 * atalho negado (pedido, mas a pessoa não o vê ou ele não existe: não cai na raiz por engano) ou pronta para abrir.
 */
export function situacaoDeArquivos({
  driveLigado,
  raizId,
  temCliente,
  atalhoPedido,
  atalhoVisivel,
}: {
  driveLigado: boolean;
  raizId: string | null;
  temCliente: boolean;
  atalhoPedido: boolean;
  atalhoVisivel: boolean;
}): "desligado" | "atalho-negado" | "pronto" {
  if (!driveLigado || raizId === null || !temCliente) return "desligado";
  return atalhoPedido && !atalhoVisivel ? "atalho-negado" : "pronto";
}

/** O atalho que a pessoa escolheu e que o banco lhe deixou ver. */
export type AtalhoPermitido = { id: string; nome: string; pastaId: string };

export type ResultadoDaPasta =
  | { estado: "ok"; pasta: { id: string; nome: string }; caminho: { id: string; nome: string }[]; itens: ItemDeListagem[]; proxima: string | null }
  /** Fora da raiz ou do atalho, não é pasta ou não existe: a tela não distingue, para não revelar o que há no Drive. */
  | { estado: "bloqueado" }
  | { estado: "erro" };

/**
 * Abre uma pasta de Arquivos. O limite é a pasta do atalho (que precisa estar dentro da raiz) ou a própria raiz; a pasta
 * pedida precisa estar dentro do limite pela cadeia de pais. Só então lista. Qualquer falha do Drive vira `erro`, sem a
 * mensagem dele.
 */
export async function abrirPasta({
  cliente,
  raizId,
  atalho,
  pastaId,
  ordem,
  pagina,
}: {
  cliente: ClienteDoDrive;
  raizId: string;
  atalho: AtalhoPermitido | null;
  pastaId: string | null;
  ordem: OrdemDaListagem;
  pagina: string | null;
}): Promise<ResultadoDaPasta> {
  try {
    if (atalho && (await caminhoDentro({ limiteId: raizId, itemId: atalho.pastaId, cliente })) === null) return { estado: "bloqueado" };
    const limiteId = atalho ? atalho.pastaId : raizId;
    const alvoId = pastaId ?? limiteId;

    const caminho = await caminhoDentro({ limiteId, itemId: alvoId, cliente });
    if (caminho === null) return { estado: "bloqueado" };
    // A raiz é a pasta que o Admin configurou: o que ela é já foi conferido ao configurar.
    const alvo = alvoId === raizId ? null : await cliente.obterItem(alvoId);
    if (alvo && !alvo.pasta) return { estado: "bloqueado" };

    const { itens, proxima } = await cliente.listarFilhos(alvoId, { ordem, pagina, tamanho: TAMANHO_DA_PAGINA });
    const inicio = { id: limiteId, nome: atalho?.nome ?? "Arquivos" };
    return {
      estado: "ok",
      pasta: alvo && alvoId !== limiteId ? { id: alvo.id, nome: alvo.nome } : inicio,
      caminho: [inicio, ...caminho.map((i) => ({ id: i.id, nome: i.nome }))],
      itens: itens.map(paraListagem),
      proxima,
    };
  } catch {
    return { estado: "erro" };
  }
}

// Atalhos --------------------------------------------------------------------------

/** Os ícones que um atalho pode ter (nomes do lucide). O banco aceita a mesma lista. */
export const ICONES_DOS_ATALHOS = ["folder", "image", "palette", "tent", "file-text", "star", "music", "camera", "megaphone", "heart", "flag", "book-open"] as const;
export type IconeDeAtalho = (typeof ICONES_DOS_ATALHOS)[number];

export const NOMES_DOS_ICONES_DOS_ATALHOS: Record<IconeDeAtalho, string> = {
  folder: "Pasta",
  image: "Imagem",
  palette: "Paleta de cores",
  tent: "Barraca",
  "file-text": "Documento",
  star: "Estrela",
  music: "Música",
  camera: "Câmera",
  megaphone: "Megafone",
  heart: "Coração",
  flag: "Bandeira",
  "book-open": "Livro",
};

export const TAMANHO_MAXIMO_DO_NOME_DO_ATALHO = 40;

export type Atalho = { nome: string; icone: IconeDeAtalho; pastaId: string; funcoes: string[] };

/** O atalho pronto para gravar, ou o que impede. Sem Função marcada ele vale para toda a Liderança. */
export function lerAtalho(entrada: { nome: string; icone: string; pasta: string; funcoes: readonly string[] }): Atalho | { erro: string } {
  const nome = entrada.nome.trim();
  if (!nome) return { erro: "Dê um nome ao atalho." };
  if (nome.length > TAMANHO_MAXIMO_DO_NOME_DO_ATALHO) return { erro: `Use um nome de até ${TAMANHO_MAXIMO_DO_NOME_DO_ATALHO} letras.` };
  const icone = ICONES_DOS_ATALHOS.find((i) => i === entrada.icone);
  if (!icone) return { erro: "Escolha um ícone." };
  const pastaId = idDaPasta(entrada.pasta);
  if (!pastaId) return { erro: "A pasta não parece uma pasta do Drive: cole o endereço dela ou o ID." };
  return { nome, icone, pastaId, funcoes: [...new Set(entrada.funcoes)] };
}

// Endereços e textos --------------------------------------------------------------------

export type ModoDeVista = "grade" | "lista";

/** O modo pedido na URL; o padrão é a grade, que mostra mais no celular. */
export const lerModo = (texto: string | undefined): ModoDeVista => (texto === "lista" ? "lista" : "grade");

/** A chave de página que o Drive entregou, se parece uma; qualquer outra coisa vale a primeira página. */
export const lerPagina = (texto: string | undefined): string | null => (texto && /^[A-Za-z0-9_=+/.~-]{1,2000}$/.test(texto) ? texto : null);

/** O endereço de uma pasta em Arquivos; o que está no padrão (nome, grade, primeira página) fica de fora. */
export function enderecoDeArquivos({
  atalho,
  pasta,
  ordem = "nome",
  modo = "grade",
  pagina = null,
}: {
  atalho?: string | null;
  pasta?: string | null;
  ordem?: OrdemDaListagem;
  modo?: ModoDeVista;
  pagina?: string | null;
}): string {
  const parametros = new URLSearchParams();
  if (atalho) parametros.set("atalho", atalho);
  if (pasta) parametros.set("pasta", pasta);
  if (ordem !== "nome") parametros.set("ordem", ordem);
  if (modo !== "grade") parametros.set("modo", modo);
  if (pagina) parametros.set("pagina", pagina);
  const texto = parametros.toString();
  return texto ? `/arquivos?${texto}` : "/arquivos";
}

/** "980 B", "2,0 KB", "1,5 MB": o tamanho de um arquivo para gente; vazio quando o Drive não diz (documentos do Google). */
export function formatarTamanho(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  const unidades = ["KB", "MB", "GB"];
  let valor = bytes / 1024;
  let i = 0;
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024;
    i++;
  }
  return `${valor.toFixed(1).replace(".", ",")} ${unidades[i]}`;
}
