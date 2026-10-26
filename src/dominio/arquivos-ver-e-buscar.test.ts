import { describe, expect, it } from "vitest";
import { driveFalso } from "@/lib/drive/falso";
import { abrirPasta, buscarArquivos, cabecalhoDeAnexo, construirIndice, lerLimiteDeDownload, servirItem } from "./arquivos";
import { ErroDoDrive } from "./drive";
import type { ClienteDoDrive } from "./pastas";

const RAIZ = "RAIZ1234567890";
const OUTRA_RAIZ = "OUTRA_RAIZ_QUALQUER";
const LIMITE = 4 * 1024 * 1024;
const conteudo = new TextEncoder().encode("conteudo");
const texto = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

type Drive = ReturnType<typeof driveFalso>;

/** Raiz > Identidade > Logos (logo.png e regras.pdf), Raiz > Acampamento, e uma pasta de fora da raiz com um arquivo. */
function ministerio() {
  const drive = driveFalso();
  const identidade = drive.pasta("Identidade", RAIZ);
  const logos = drive.pasta("Logos", identidade);
  const png = drive.arquivo("logo.png", logos, { mime: "image/png", tamanho: conteudo.length, conteudo, miniatura: new TextEncoder().encode("mini") });
  const pdf = drive.arquivo("regras.pdf", logos, { mime: "application/pdf", tamanho: conteudo.length, conteudo });
  const acampamento = drive.pasta("Acampamento", RAIZ);
  const fora = drive.pasta("Outro ministério", OUTRA_RAIZ);
  const segredo = drive.arquivo("folha.pdf", fora, { tamanho: conteudo.length, conteudo });
  return { drive, identidade, logos, png, pdf, acampamento, fora, segredo };
}

describe("o que cada item permite", () => {
  const itens = async (drive: Drive, limite = LIMITE) => {
    const r = await abrirPasta({ cliente: drive.cliente, raizId: RAIZ, atalho: null, pastaId: null, ordem: "nome", pagina: null, limiteDeDownloadBytes: limite });
    if (r.estado !== "ok") throw new Error(r.estado);
    return Object.fromEntries(r.itens.map((i) => [i.nome, i]));
  };

  it("imagem comum tem prévia e baixa; o link abre o arquivo no Drive", async () => {
    const drive = driveFalso();
    const id = drive.arquivo("logo.png", RAIZ, { mime: "image/png", tamanho: 1000 });
    expect((await itens(drive))["logo.png"]).toMatchObject({ previa: true, baixavel: true, link: `https://drive.google.com/file/d/${id}/view` });
  });

  it("SVG não tem prévia no app (pode carregar script), mas baixa", async () => {
    const drive = driveFalso();
    drive.arquivo("marca.svg", RAIZ, { mime: "image/svg+xml", tamanho: 1000 });
    expect((await itens(drive))["marca.svg"]).toMatchObject({ previa: false, baixavel: true });
  });

  it("imagem acima do limite ainda tem miniatura, mas não baixa nem amplia", async () => {
    const drive = driveFalso();
    drive.arquivo("foto.jpg", RAIZ, { mime: "image/jpeg", tamanho: LIMITE + 1 });
    expect((await itens(drive))["foto.jpg"]).toMatchObject({ previa: true, baixavel: false });
  });

  it("acima do limite só abre no Drive, e o limite é do Admin", async () => {
    const drive = driveFalso();
    drive.arquivo("video.mp4", RAIZ, { mime: "video/mp4", tamanho: LIMITE + 1 });
    drive.arquivo("exato.pdf", RAIZ, { tamanho: LIMITE });
    expect((await itens(drive))["video.mp4"]).toMatchObject({ baixavel: false });
    expect((await itens(drive))["exato.pdf"]).toMatchObject({ baixavel: true });
    expect((await itens(drive, 1024))["exato.pdf"]).toMatchObject({ baixavel: false });
  });

  it("documento do Google, sem tamanho, só abre no Drive; pasta não baixa e abre pelo link da pasta", async () => {
    const drive = driveFalso();
    drive.arquivo("Ata", RAIZ, { mime: "application/vnd.google-apps.document", tamanho: null });
    const pasta = drive.pasta("Logos", RAIZ);
    const todos = await itens(drive);
    expect(todos["Ata"]).toMatchObject({ baixavel: false, previa: false });
    expect(todos["Logos"]).toMatchObject({ baixavel: false, previa: false, link: `https://drive.google.com/drive/folders/${pasta}` });
  });
});

describe("servir um item pelo servidor", () => {
  const servir = (m: { drive: Drive }, itemId: string, acao: "miniatura" | "ver" | "baixar", sobre: Partial<Parameters<typeof servirItem>[0]> = {}) =>
    servirItem({ cliente: m.drive.cliente, raizId: RAIZ, atalho: null, itemId, acao, limiteDeDownloadBytes: LIMITE, ...sobre });

  it("baixa o arquivo como anexo, com o nome e o tipo dele", async () => {
    const m = ministerio();
    const r = await servir(m, m.pdf, "baixar");
    expect(r).toMatchObject({ estado: "ok", nome: "regras.pdf", mime: "application/pdf", emLinha: false });
    expect(r.estado === "ok" && texto(r.bytes)).toBe("conteudo");
  });

  it("mostra a imagem na tela e a miniatura em linha", async () => {
    const m = ministerio();
    expect(await servir(m, m.png, "ver")).toMatchObject({ estado: "ok", mime: "image/png", emLinha: true });
    const mini = await servir(m, m.png, "miniatura");
    expect(mini).toMatchObject({ estado: "ok", emLinha: true });
    expect(mini.estado === "ok" && texto(mini.bytes)).toBe("mini");
  });

  it("nega o que está fora da raiz, em miniatura, prévia e download, sem tocar no conteúdo", async () => {
    const m = ministerio();
    for (const acao of ["miniatura", "ver", "baixar"] as const) {
      expect(await servir(m, m.segredo, acao), acao).toEqual({ estado: "bloqueado" });
    }
    expect(m.drive.chamadas.baixar).toBe(0);
  });

  it("nega o que está fora do atalho, mesmo dentro da raiz", async () => {
    const m = ministerio();
    const atalho = { id: "a1", nome: "Acampamento", pastaId: m.acampamento };
    expect(await servir(m, m.png, "baixar", { atalho })).toEqual({ estado: "bloqueado" });
    const dentro = m.drive.arquivo("mapa.pdf", m.acampamento, { tamanho: conteudo.length, conteudo });
    expect(await servir(m, dentro, "baixar", { atalho })).toMatchObject({ estado: "ok" });
  });

  it("um atalho com pasta de fora da raiz não serve nada", async () => {
    const m = ministerio();
    expect(await servir(m, m.segredo, "baixar", { atalho: { id: "a1", nome: "Fora", pastaId: m.fora } })).toEqual({ estado: "bloqueado" });
  });

  it("um ID que não existe também é negado", async () => {
    const m = ministerio();
    expect(await servir(m, "NAO_EXISTE_1234", "baixar")).toEqual({ estado: "bloqueado" });
  });

  it("respeita o limite de tamanho sem baixar nada", async () => {
    const m = ministerio();
    expect(await servir(m, m.pdf, "baixar", { limiteDeDownloadBytes: conteudo.length - 1 })).toEqual({ estado: "grande" });
    expect(await servir(m, m.png, "ver", { limiteDeDownloadBytes: conteudo.length - 1 })).toEqual({ estado: "grande" });
    expect(m.drive.chamadas.baixar).toBe(0);
  });

  it("não baixa documento do Google nem pasta, nem mostra como imagem o que não é imagem segura", async () => {
    const m = ministerio();
    const doc = m.drive.arquivo("Ata", m.logos, { mime: "application/vnd.google-apps.document", tamanho: null });
    expect(await servir(m, doc, "baixar")).toEqual({ estado: "indisponivel" });
    expect(await servir(m, m.logos, "baixar")).toEqual({ estado: "indisponivel" });
    expect(await servir(m, m.pdf, "ver")).toEqual({ estado: "indisponivel" });
    const svg = m.drive.arquivo("x.svg", m.logos, { mime: "image/svg+xml", tamanho: 10 });
    expect(await servir(m, svg, "ver")).toEqual({ estado: "indisponivel" });
    expect(await servir(m, svg, "miniatura")).toEqual({ estado: "indisponivel" });
  });

  it("sem miniatura no Drive, a tela usa o ícone: indisponível, não erro", async () => {
    const m = ministerio();
    const sem = m.drive.arquivo("sem.png", m.logos, { mime: "image/png", tamanho: 10 });
    expect(await servir(m, sem, "miniatura")).toEqual({ estado: "indisponivel" });
  });

  it("erro do Drive vira erro, sem a mensagem dele", async () => {
    const m = ministerio();
    const cliente: ClienteDoDrive = {
      ...m.drive.cliente,
      baixar: async () => {
        throw new ErroDoDrive("Drive 500: segredo");
      },
    };
    expect(await servir(m, m.pdf, "baixar", { cliente })).toEqual({ estado: "erro" });
  });

  it("conteúdo maior do que o Drive disse que era também é recusado", async () => {
    const m = ministerio();
    const mentiroso = m.drive.arquivo("mentiroso.pdf", m.logos, { tamanho: 5, conteudo: new Uint8Array(100) });
    expect(await servir(m, mentiroso, "baixar", { limiteDeDownloadBytes: 50 })).toEqual({ estado: "grande" });
  });
});

describe("índice e busca por nome", () => {
  const indiceDe = (drive: Drive, maximoDePastas?: number) => async (inicioId: string, recursivo: boolean) =>
    construirIndice({ cliente: drive.cliente, inicioId, recursivo, maximoDePastas });
  const buscar = (m: { drive: Drive }, termo: string, sobre: Partial<Parameters<typeof buscarArquivos>[0]> = {}) =>
    buscarArquivos({ cliente: m.drive.cliente, raizId: RAIZ, atalho: null, pastaId: null, termo, limiteDeDownloadBytes: LIMITE, obterIndice: indiceDe(m.drive), ...sobre });
  const nomes = (r: Awaited<ReturnType<typeof buscar>>) => {
    if (r.estado !== "ok") throw new Error(r.estado);
    return r.resultados.map((i) => i.nome);
  };

  it("acha pelo nome em qualquer pasta da raiz, sem ligar para maiúsculas nem acentos, e diz onde está", async () => {
    const m = ministerio();
    m.drive.arquivo("Programação do Acampamento.pdf", m.acampamento);
    const r = await buscar(m, "programacao");
    expect(nomes(r)).toEqual(["Programação do Acampamento.pdf"]);
    expect(r.estado === "ok" && r.resultados[0]).toMatchObject({ paiNome: "Acampamento", paiId: m.acampamento });
    expect(nomes(await buscar(m, "LOGO"))).toEqual(["Logos", "logo.png"]);
  });

  it("exige todas as palavras e um termo de pelo menos 2 letras", async () => {
    const m = ministerio();
    m.drive.arquivo("logo azul.png", m.logos);
    m.drive.arquivo("logo verde.png", m.logos);
    expect(nomes(await buscar(m, "logo verde"))).toEqual(["logo verde.png"]);
    expect(await buscar(m, "a")).toEqual({ estado: "termo-curto" });
    expect(await buscar(m, "   ")).toEqual({ estado: "termo-curto" });
  });

  it("nunca mostra o que está fora da raiz", async () => {
    const m = ministerio();
    expect(nomes(await buscar(m, "folha"))).toEqual([]);
    expect(nomes(await buscar(m, "outro"))).toEqual([]);
  });

  it("com atalho, busca só dentro da pasta dele", async () => {
    const m = ministerio();
    m.drive.arquivo("mapa.pdf", m.acampamento);
    m.drive.arquivo("mapa antigo.pdf", m.logos);
    const atalho = { id: "a1", nome: "Acampamento", pastaId: m.acampamento };
    expect(nomes(await buscar(m, "mapa", { atalho }))).toEqual(["mapa.pdf"]);
  });

  it("um atalho com pasta de fora da raiz não busca nada", async () => {
    const m = ministerio();
    expect(await buscar(m, "folha", { atalho: { id: "a1", nome: "Fora", pastaId: m.fora } })).toEqual({ estado: "bloqueado" });
  });

  it("uma pasta atual de fora da raiz também é negada", async () => {
    const m = ministerio();
    expect(await buscar(m, "folha", { pastaId: m.fora })).toEqual({ estado: "bloqueado" });
  });

  it("não segue atalhos do Drive, que podem apontar para fora", async () => {
    const m = ministerio();
    m.drive.arquivo("Atalho para o outro ministério", RAIZ, { mime: "application/vnd.google-apps.shortcut", tamanho: null });
    const indice = await construirIndice({ cliente: m.drive.cliente, inicioId: RAIZ, recursivo: true });
    expect(indice.completo).toBe(true);
    expect(indice.entradas.map((e) => e.nome)).not.toContain("folha.pdf");
  });

  it("estourado o teto de pastas, avisa e busca só na pasta atual", async () => {
    const m = ministerio();
    m.drive.arquivo("logo grande.png", m.logos);
    m.drive.arquivo("logo do acampamento.png", m.acampamento);
    const r = await buscar(m, "logo", { pastaId: m.logos, obterIndice: indiceDe(m.drive, 2) });
    expect(r).toMatchObject({ estado: "ok", somentePastaAtual: true });
    expect(nomes(r).sort()).toEqual(["logo grande.png", "logo.png"]);
  });

  it("dentro do teto, busca a raiz inteira e não avisa nada", async () => {
    const m = ministerio();
    expect(await buscar(m, "logo")).toMatchObject({ estado: "ok", somentePastaAtual: false });
  });

  it("o índice mede as pastas percorridas", async () => {
    const m = ministerio();
    expect((await construirIndice({ cliente: m.drive.cliente, inicioId: RAIZ, recursivo: true, maximoDePastas: 10 })).completo).toBe(true);
    expect((await construirIndice({ cliente: m.drive.cliente, inicioId: RAIZ, recursivo: true, maximoDePastas: 1 })).completo).toBe(false);
    const soUma = await construirIndice({ cliente: m.drive.cliente, inicioId: RAIZ, recursivo: false });
    expect(soUma.completo).toBe(true);
    expect(soUma.entradas.map((e) => e.nome).sort()).toEqual(["Acampamento", "Identidade"]);
  });

  it("falha do Drive vira erro", async () => {
    const m = ministerio();
    m.drive.falharAoListar(new ErroDoDrive("Drive 500"));
    expect(await buscar(m, "logo")).toEqual({ estado: "erro" });
  });

  it("limita o número de resultados e diz que cortou", async () => {
    const m = ministerio();
    for (let i = 0; i < 130; i++) m.drive.arquivo(`relatorio ${i}.pdf`, RAIZ);
    const r = await buscar(m, "relatorio");
    expect(r.estado === "ok" && r.resultados).toHaveLength(100);
    expect(r.estado === "ok" && r.cortada).toBe(true);
  });
});

describe("limite de download do Admin", () => {
  it("lê MB inteiros de 1 a 50", () => {
    expect(lerLimiteDeDownload("4")).toEqual({ drive_limite_de_download_mb: 4 });
    expect(lerLimiteDeDownload("50")).toEqual({ drive_limite_de_download_mb: 50 });
    for (const ruim of ["", "0", "51", "2,5", "abc", "-1"]) expect(lerLimiteDeDownload(ruim), ruim).toHaveProperty("erro");
  });
});

describe("cabeçalho de anexo", () => {
  it("manda o nome em ASCII e o verdadeiro codificado", () => {
    expect(cabecalhoDeAnexo("Programação 2026.pdf", false)).toBe(`attachment; filename="Programacao 2026.pdf"; filename*=UTF-8''Programa%C3%A7%C3%A3o%202026.pdf`);
    expect(cabecalhoDeAnexo("logo.png", true)).toMatch(/^inline; filename="logo.png"/);
  });

  it("não deixa aspas, barras nem quebras de linha escaparem do cabeçalho", () => {
    const h = cabecalhoDeAnexo('a"b\\c/d;e\r\nSet-Cookie: x=1', false);
    expect(h).not.toMatch(/[\r\n]/);
    expect(h.split('filename="')[1].split('"')[0]).toBe("a_b_c_d_eSet-Cookie: x=1");
  });

  it("nome vazio vira \"arquivo\"", () => {
    expect(cabecalhoDeAnexo("  ", false)).toMatch(/filename="arquivo"/);
  });
});
