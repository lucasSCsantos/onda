import { ErroDoDrive, idDaPasta, linkDaPasta } from "./drive";
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

/** Imagens que o app mostra na tela. SVG fica de fora: pode carregar script, e quem quiser baixa ou abre no Drive. */
const MIMES_DE_IMAGEM_COM_PREVIA = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"];

/** O limite de download do Admin (em MB) em bytes: a conta fica num lugar só. */
export const limiteEmBytes = (mb: number) => mb * 1024 * 1024;

/** O limite de download que vale quando o Admin não mexeu: 4 MB, para não estourar a resposta da hospedagem. */
export const LIMITE_DE_DOWNLOAD_PADRAO_MB = 4;
export const LIMITE_DE_DOWNLOAD_MAXIMO_MB = 50;

/** O limite de download que o Admin digitou (em MB inteiros), pronto para gravar, ou o que impede. */
export function lerLimiteDeDownload(texto: string): { drive_limite_de_download_mb: number } | { erro: string } {
  const mb = Number(texto);
  if (texto.trim() === "" || !Number.isInteger(mb) || mb < 1 || mb > LIMITE_DE_DOWNLOAD_MAXIMO_MB) {
    return { erro: `O limite de download de Arquivos precisa ser um número inteiro de 1 a ${LIMITE_DE_DOWNLOAD_MAXIMO_MB} MB.` };
  }
  return { drive_limite_de_download_mb: mb };
}

/** A página do arquivo, ou da pasta, no Drive: só o endereço de abrir; quem não tem acesso lá não entra. */
export const linkNoDrive = (item: { id: string; pasta: boolean }) => (item.pasta ? linkDaPasta(item.id) : `https://drive.google.com/file/d/${item.id}/view`);

/** Um arquivo se baixa pelo servidor se o Drive diz o tamanho (documentos do Google não dizem) e ele cabe no limite. */
const cabeNoLimite = (tamanho: number | null, limiteBytes: number): tamanho is number => tamanho !== null && tamanho <= limiteBytes;

const temPrevia = (i: { mime: string; pasta: boolean }) => !i.pasta && MIMES_DE_IMAGEM_COM_PREVIA.includes(i.mime);

/**
 * Um item como a tela o mostra: nada do que o Drive sabe além disso (pais, tipo MIME cru) sai do servidor. `baixavel`
 * diz se o app baixa (dentro do limite do Admin); `previa`, se é imagem com miniatura no app (a miniatura vem pronta do Drive,
 * então não depende do tamanho; ampliar exige também `baixavel`); `link` abre no Drive.
 */
export type ItemDeListagem = {
  id: string;
  nome: string;
  pasta: boolean;
  tipo: TipoDeItem;
  tamanho: number | null;
  modificadoEm: Date | null;
  baixavel: boolean;
  previa: boolean;
  link: string;
};

const paraListagem = (i: ItemDoDrive, limiteDeDownloadBytes: number): ItemDeListagem => ({
  id: i.id,
  nome: i.nome,
  pasta: i.pasta,
  tipo: tipoDoItem(i),
  tamanho: i.tamanho,
  modificadoEm: i.modificadoEm,
  baixavel: !i.pasta && cabeNoLimite(i.tamanho, limiteDeDownloadBytes),
  previa: temPrevia(i),
  link: linkNoDrive(i),
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
  limiteDeDownloadBytes,
}: {
  cliente: ClienteDoDrive;
  raizId: string;
  atalho: AtalhoPermitido | null;
  pastaId: string | null;
  ordem: OrdemDaListagem;
  pagina: string | null;
  limiteDeDownloadBytes: number;
}): Promise<ResultadoDaPasta> {
  try {
    const limiteId = await limiteAutorizado({ cliente, raizId, atalho });
    if (limiteId === null) return { estado: "bloqueado" };
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
      itens: itens.map((i) => paraListagem(i, limiteDeDownloadBytes)),
      proxima,
    };
  } catch {
    return { estado: "erro" };
  }
}

// Ver, baixar e buscar ----------------------------------------------------------------

/**
 * A pasta de onde a pessoa não sobe: a do atalho (que precisa estar dentro da raiz) ou a própria raiz; nulo se o atalho
 * aponta para fora da raiz.
 */
async function limiteAutorizado({ cliente, raizId, atalho }: { cliente: ClienteDoDrive; raizId: string; atalho: AtalhoPermitido | null }): Promise<string | null> {
  if (!atalho) return raizId;
  return (await caminhoDentro({ limiteId: raizId, itemId: atalho.pastaId, cliente })) === null ? null : atalho.pastaId;
}

export type AcaoSobreItem = "miniatura" | "ver" | "baixar";

export type ResultadoDoItem =
  /** `emLinha`: a imagem aparece na tela; fora isso, o navegador baixa como anexo. */
  | { estado: "ok"; bytes: Uint8Array; mime: string; nome: string; emLinha: boolean }
  | { estado: "bloqueado" }
  /** Acima do limite de download do Admin: só abre no Drive. */
  | { estado: "grande" }
  /** Não há o que servir: pasta, documento do Google, imagem sem prévia ou sem miniatura. */
  | { estado: "indisponivel" }
  | { estado: "erro" };

/**
 * Serve o conteúdo de um item (miniatura, imagem ampliada ou download) pelo servidor. Primeiro confere pela cadeia de pais
 * que o item mora dentro da raiz (e do atalho, se houver); só então fala com o Drive. Respeita o limite de tamanho antes de
 * baixar e de novo depois, caso o Drive tenha dito um tamanho menor que o real.
 */
export async function servirItem({
  cliente,
  raizId,
  atalho,
  itemId,
  acao,
  limiteDeDownloadBytes,
}: {
  cliente: ClienteDoDrive;
  raizId: string;
  atalho: AtalhoPermitido | null;
  itemId: string;
  acao: AcaoSobreItem;
  limiteDeDownloadBytes: number;
}): Promise<ResultadoDoItem> {
  try {
    const limiteId = await limiteAutorizado({ cliente, raizId, atalho });
    if (limiteId === null || (await caminhoDentro({ limiteId, itemId, cliente })) === null) return { estado: "bloqueado" };
    if (itemId === limiteId) return { estado: "indisponivel" };
    const item = await cliente.obterItem(itemId);
    if (item.pasta) return { estado: "indisponivel" };

    if (acao === "miniatura") {
      if (!temPrevia(item)) return { estado: "indisponivel" };
      const miniatura = await cliente.miniatura(itemId);
      return miniatura ? { estado: "ok", bytes: miniatura.bytes, mime: miniatura.mime, nome: item.nome, emLinha: true } : { estado: "indisponivel" };
    }
    if (acao === "ver" && !temPrevia(item)) return { estado: "indisponivel" };
    if (item.tamanho === null) return { estado: "indisponivel" };
    if (item.tamanho > limiteDeDownloadBytes) return { estado: "grande" };

    const bytes = await cliente.baixar(itemId);
    if (bytes.byteLength > limiteDeDownloadBytes) return { estado: "grande" };
    return { estado: "ok", bytes, mime: item.mime, nome: item.nome, emLinha: acao === "ver" };
  } catch {
    return { estado: "erro" };
  }
}

/** Quantas pastas o índice percorre, no máximo; passando disso a busca avisa e usa só a pasta atual. */
export const MAXIMO_DE_PASTAS_DO_INDICE = 300;
/** Quantos itens o índice guarda, no máximo (uma pasta enorme também estoura o teto). */
const MAXIMO_DE_ITENS_DO_INDICE = 20_000;
const TAMANHO_DA_PAGINA_DO_INDICE = 1000;
const MAXIMO_DE_RESULTADOS = 100;
const TAMANHO_MINIMO_DO_TERMO = 2;

/** Um item do índice, com o nome da pasta onde mora, para a busca dizer onde achou. */
export type EntradaDoIndice = {
  id: string;
  nome: string;
  pasta: boolean;
  mime: string;
  tamanho: number | null;
  modificadoEm: Date | null;
  paiId: string;
  paiNome: string;
};

export type Indice = { entradas: EntradaDoIndice[]; completo: boolean };

/**
 * Lê nome, tipo, tamanho e data de tudo que está abaixo de `inicioId` (ou só dentro dele, sem `recursivo`), de pasta em
 * pasta. Só desce por pastas de verdade: atalho do Drive não é seguido, porque pode apontar para fora da raiz. Passando
 * do teto de pastas ou de itens, devolve o que leu e `completo: false`.
 */
export async function construirIndice({
  cliente,
  inicioId,
  inicioNome = "Arquivos",
  recursivo,
  maximoDePastas = MAXIMO_DE_PASTAS_DO_INDICE,
}: {
  cliente: ClienteDoDrive;
  inicioId: string;
  inicioNome?: string;
  recursivo: boolean;
  maximoDePastas?: number;
}): Promise<Indice> {
  const entradas: EntradaDoIndice[] = [];
  const fila = [{ id: inicioId, nome: inicioNome }];
  // Uma pasta com mais de um pai aparece mais de uma vez na descida; só se lê (e se indexa) uma.
  const vistos = new Set<string>([inicioId]);
  let percorridas = 0;
  let completo = true;

  while (fila.length > 0) {
    if (percorridas >= maximoDePastas) {
      completo = false;
      break;
    }
    const pasta = fila.shift()!;
    percorridas++;
    let pagina: string | null = null;
    do {
      const lida = await cliente.listarFilhos(pasta.id, { ordem: "nome", pagina, tamanho: TAMANHO_DA_PAGINA_DO_INDICE });
      for (const i of lida.itens) {
        if (vistos.has(i.id)) continue;
        vistos.add(i.id);
        entradas.push({ id: i.id, nome: i.nome, pasta: i.pasta, mime: i.mime, tamanho: i.tamanho, modificadoEm: i.modificadoEm, paiId: pasta.id, paiNome: pasta.nome });
        if (i.pasta && recursivo) fila.push({ id: i.id, nome: i.nome });
      }
      pagina = lida.proxima;
      if (entradas.length >= MAXIMO_DE_ITENS_DO_INDICE) {
        completo = false;
        return { entradas, completo };
      }
    } while (pagina);
  }
  return { entradas, completo };
}

/** Minúsculas e sem acento, para "programacao" achar "Programação". */
const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/** O termo digitado é grande o bastante para buscar? */
export const termoValido = (termo: string) => normalizar(termo).length >= TAMANHO_MINIMO_DO_TERMO;

export type ItemDeBusca = ItemDeListagem & { paiId: string; paiNome: string };

export type ResultadoDaBusca =
  | { estado: "ok"; resultados: ItemDeBusca[]; cortada: boolean; somentePastaAtual: boolean }
  | { estado: "termo-curto" }
  | { estado: "bloqueado" }
  | { estado: "erro" };

/**
 * Busca por nome na raiz inteira (ou dentro do atalho). Quem chama entrega `obterIndice`, que guarda o índice por alguns
 * minutos. Se o índice estourou o teto de pastas, usa só a pasta atual e diz isso. Todas as palavras do termo precisam
 * aparecer no nome; pastas vêm antes dos arquivos, e no máximo 100 resultados voltam.
 */
export async function buscarArquivos({
  cliente,
  raizId,
  atalho,
  pastaId,
  termo,
  limiteDeDownloadBytes,
  obterIndice,
}: {
  cliente: ClienteDoDrive;
  raizId: string;
  atalho: AtalhoPermitido | null;
  pastaId: string | null;
  termo: string;
  limiteDeDownloadBytes: number;
  obterIndice: (inicioId: string, recursivo: boolean) => Promise<Indice>;
}): Promise<ResultadoDaBusca> {
  if (!termoValido(termo)) return { estado: "termo-curto" };
  try {
    const limiteId = await limiteAutorizado({ cliente, raizId, atalho });
    if (limiteId === null) return { estado: "bloqueado" };
    const atualId = pastaId ?? limiteId;
    if ((await caminhoDentro({ limiteId, itemId: atualId, cliente })) === null) return { estado: "bloqueado" };

    let indice = await obterIndice(limiteId, true);
    const somentePastaAtual = !indice.completo;
    if (somentePastaAtual) indice = await obterIndice(atualId, false);

    const palavras = normalizar(termo).split(/\s+/);
    const achadas = indice.entradas
      .filter((e) => {
        const nome = normalizar(e.nome);
        return palavras.every((p) => nome.includes(p));
      })
      .sort((a, b) => (a.pasta === b.pasta ? a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }) : a.pasta ? -1 : 1));

    return {
      estado: "ok",
      resultados: achadas.slice(0, MAXIMO_DE_RESULTADOS).map((e) => ({ ...paraListagem({ ...e, pais: [e.paiId] }, limiteDeDownloadBytes), paiId: e.paiId, paiNome: e.paiNome })),
      cortada: achadas.length > MAXIMO_DE_RESULTADOS,
      somentePastaAtual,
    };
  } catch {
    return { estado: "erro" };
  }
}

/**
 * O `Content-Disposition` de um arquivo servido pelo app: sempre com um nome seguro em ASCII (sem aspas, barras nem quebras
 * de linha, que abririam brecha em cabeçalho) e, ao lado, o nome verdadeiro codificado.
 */
export function cabecalhoDeAnexo(nome: string, emLinha: boolean): string {
  const limpo = nome.replace(/[\u0000-\u001f\u007f]/g, "").trim() || "arquivo";
  const ascii = limpo.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^\x20-\x7e]|["\\/;%]/g, "_");
  const codificado = encodeURIComponent(limpo).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${emLinha ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${codificado}`;
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
  busca = null,
}: {
  atalho?: string | null;
  pasta?: string | null;
  ordem?: OrdemDaListagem;
  modo?: ModoDeVista;
  pagina?: string | null;
  busca?: string | null;
}): string {
  const parametros = new URLSearchParams();
  if (atalho) parametros.set("atalho", atalho);
  if (pasta) parametros.set("pasta", pasta);
  if (ordem !== "nome") parametros.set("ordem", ordem);
  if (modo !== "grade") parametros.set("modo", modo);
  if (pagina) parametros.set("pagina", pagina);
  if (busca) parametros.set("q", busca);
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
