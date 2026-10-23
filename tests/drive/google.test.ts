import { createVerify, generateKeyPairSync } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ErroDoDrive } from "@/dominio/drive";
import { criarClienteDoGoogle, lerCredenciais } from "@/lib/drive/google";

// O cliente real do Drive contra um Google de mentira: um servidor HTTP local que responde como a API v3 (token,
// busca e criação de pasta) e deixa conferir a assinatura do JWT da service account.

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const CHAVE_PRIVADA = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const EMAIL = "mural@projeto.iam.gserviceaccount.com";

type Pedido = { metodo: string; caminho: string; autorizacao: string | undefined; corpo: string };

let servidor: Server;
let base = "";
let pedidos: Pedido[] = [];
/** O que o servidor responde a cada rota; os testes trocam para simular erros. */
let respostas: { token: () => [number, unknown]; buscar: () => [number, unknown]; criar: () => [number, unknown]; miniatura: [number, string] };
let tokensEmitidos = 0;

const lerCorpo = (req: IncomingMessage) =>
  new Promise<string>((resolve) => {
    let corpo = "";
    req.on("data", (pedaco) => (corpo += pedaco));
    req.on("end", () => resolve(corpo));
  });

beforeAll(async () => {
  servidor = createServer(async (req, res) => {
    const corpo = await lerCorpo(req);
    const url = new URL(req.url!, base);
    pedidos.push({ metodo: req.method!, caminho: url.pathname + url.search, autorizacao: req.headers.authorization, corpo });
    if (url.pathname.startsWith("/thumb")) {
      res.writeHead(respostas.miniatura[0], { "Content-Type": respostas.miniatura[1] });
      res.end("bytes-da-miniatura");
      return;
    }
    const [status, json] = url.pathname === "/token" ? respostas.token() : req.method === "GET" ? respostas.buscar() : respostas.criar();
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(json));
  });
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((ok) => servidor.close(() => ok())));

beforeEach(() => {
  pedidos = [];
  tokensEmitidos = 0;
  respostas = {
    token: () => [200, { access_token: `token-${++tokensEmitidos}`, expires_in: 3600 }],
    buscar: () => [200, { files: [] }],
    criar: () => [200, { id: "NOVA_PASTA_ID" }],
    miniatura: [200, "image/png"],
  };
});

const cliente = (extra: { agora?: () => number; aceitaMiniatura?: (url: URL) => boolean } = {}) =>
  criarClienteDoGoogle({
    credenciais: { client_email: EMAIL, private_key: CHAVE_PRIVADA },
    urlDaApi: `${base}/drive/v3`,
    urlDoToken: `${base}/token`,
    ...extra,
  });

describe("credenciais da service account", () => {
  it("lê o JSON do Google e recusa o que não é uma chave de service account", () => {
    expect(lerCredenciais(JSON.stringify({ type: "service_account", client_email: EMAIL, private_key: CHAVE_PRIVADA }))).toMatchObject({
      client_email: EMAIL,
    });
    expect(lerCredenciais(undefined)).toBeNull();
    expect(lerCredenciais("")).toBeNull();
    expect(lerCredenciais("não é json")).toBeNull();
    expect(lerCredenciais(JSON.stringify({ type: "authorized_user", client_email: EMAIL, private_key: CHAVE_PRIVADA }))).toBeNull();
    expect(lerCredenciais(JSON.stringify({ type: "service_account", client_email: EMAIL }))).toBeNull();
  });
});

describe("cliente do Drive", () => {
  it("entra com um JWT assinado pela service account e usa o token nos pedidos", async () => {
    respostas.buscar = () => [200, { files: [{ id: "ACHADA" }] }];
    expect(await cliente().buscarPasta("EBD", "RAIZ")).toEqual({ id: "ACHADA" });

    const pedidoDoToken = pedidos.find((p) => p.caminho === "/token")!;
    const formulario = new URLSearchParams(pedidoDoToken.corpo);
    expect(formulario.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    const [cabecalho, reivindicacoes, assinatura] = formulario.get("assertion")!.split(".");
    const verificador = createVerify("RSA-SHA256").update(`${cabecalho}.${reivindicacoes}`);
    expect(verificador.verify(publicKey, Buffer.from(assinatura, "base64url"))).toBe(true);
    expect(JSON.parse(Buffer.from(reivindicacoes, "base64url").toString())).toMatchObject({
      iss: EMAIL,
      scope: "https://www.googleapis.com/auth/drive",
      aud: `${base}/token`,
    });
    expect(pedidos.find((p) => p.caminho.startsWith("/drive/v3/files"))!.autorizacao).toBe("Bearer token-1");
  });

  it("guarda o token: dois pedidos, uma entrada só", async () => {
    const drive = cliente();
    await drive.buscarPasta("EBD", "RAIZ");
    await drive.criarPasta("2026", "ACHADA");
    expect(pedidos.filter((p) => p.caminho === "/token")).toHaveLength(1);
  });

  it("entra de novo quando o token está para vencer", async () => {
    let agora = 1_000_000;
    const drive = cliente({ agora: () => agora });
    await drive.buscarPasta("EBD", "RAIZ");
    agora += 3_600_000;
    await drive.buscarPasta("EBD", "RAIZ");
    expect(pedidos.filter((p) => p.caminho === "/token")).toHaveLength(2);
  });

  it("busca a pasta pelo nome dentro do pai, só pastas, sem lixeira, com aspas escapadas", async () => {
    await cliente().buscarPasta("Culto d'Ana", "RAIZ1");
    const busca = pedidos.find((p) => p.metodo === "GET" && p.caminho.startsWith("/drive/v3/files"))!;
    const q = new URL(base + busca.caminho).searchParams.get("q")!;
    expect(q).toBe("name = 'Culto d\\'Ana' and 'RAIZ1' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
    expect(busca.caminho).toContain("supportsAllDrives=true");
  });

  it("sem pasta com esse nome, devolve nulo", async () => {
    expect(await cliente().buscarPasta("Nada", "RAIZ")).toBeNull();
  });

  it("cria a pasta dentro do pai e devolve o ID", async () => {
    expect(await cliente().criarPasta("2026-10-24 · Aula", "PAI")).toEqual({ id: "NOVA_PASTA_ID" });
    const criacao = pedidos.find((p) => p.metodo === "POST" && p.caminho.startsWith("/drive/v3/files"))!;
    expect(JSON.parse(criacao.corpo)).toEqual({ name: "2026-10-24 · Aula", mimeType: "application/vnd.google-apps.folder", parents: ["PAI"] });
    expect(criacao.caminho).toContain("supportsAllDrives=true");
  });

  it("renomeia a pasta com PATCH, mandando só o nome novo", async () => {
    await cliente().renomearPasta("PASTA/1", "2026-11-01 · Aula nova");
    const pedido = pedidos.find((p) => p.metodo === "PATCH")!;
    expect(pedido.caminho).toContain("/drive/v3/files/PASTA%2F1?");
    expect(pedido.caminho).toContain("supportsAllDrives=true");
    expect(JSON.parse(pedido.corpo)).toEqual({ name: "2026-11-01 · Aula nova" });
  });

  it("404 (pasta fora de alcance) é erro permanente; 500, 429 e 403 passam", async () => {
    respostas.buscar = () => [404, { error: { message: "File not found: RAIZ." } }];
    const erro404 = await cliente().buscarPasta("EBD", "RAIZ").catch((e) => e);
    expect(erro404).toBeInstanceOf(ErroDoDrive);
    expect(erro404.permanente).toBe(true);

    for (const status of [500, 429, 403]) {
      respostas.buscar = () => [status, { error: { message: "tente depois" } }];
      const erro = await cliente().buscarPasta("EBD", "RAIZ").catch((e) => e);
      expect(erro).toBeInstanceOf(ErroDoDrive);
      expect(erro.permanente).toBe(false);
      expect(erro.message).toContain(String(status));
    }
  });

  it("credenciais recusadas: o erro nunca leva a chave nem o JWT", async () => {
    respostas.token = () => [400, { error: "invalid_grant", error_description: "Invalid JWT Signature." }];
    const erro = await cliente().buscarPasta("EBD", "RAIZ").catch((e) => e);
    expect(erro).toBeInstanceOf(ErroDoDrive);
    expect(erro.message).toContain("invalid_grant");
    expect(erro.message).not.toContain("PRIVATE KEY");
    expect(erro.message).not.toContain(CHAVE_PRIVADA.slice(40, 80));
  });
});

describe("cliente do Drive: Arquivos (só leitura)", () => {
  const pedidoDeGet = () => pedidos.find((p) => p.metodo === "GET" && p.caminho.startsWith("/drive/v3/files"))!;

  it("olha um item e devolve só o que o Mural usa, com pasta, tamanho e data", async () => {
    respostas.buscar = () => [
      200,
      { id: "ARQ1", name: "logo.png", mimeType: "image/png", size: "2048", modifiedTime: "2026-10-01T12:00:00.000Z", parents: ["PAI1"] },
    ];
    expect(await cliente().obterItem("ARQ/1")).toEqual({
      id: "ARQ1",
      nome: "logo.png",
      pasta: false,
      mime: "image/png",
      tamanho: 2048,
      modificadoEm: new Date("2026-10-01T12:00:00Z"),
      pais: ["PAI1"],
    });
    expect(pedidoDeGet().caminho).toContain("/drive/v3/files/ARQ%2F1?");
    expect(pedidoDeGet().caminho).toContain("supportsAllDrives=true");
  });

  it("uma pasta vem sem tamanho e sem pais quando o Drive não manda", async () => {
    respostas.buscar = () => [200, { id: "P", name: "Logos", mimeType: "application/vnd.google-apps.folder" }];
    expect(await cliente().obterItem("P")).toMatchObject({ pasta: true, tamanho: null, modificadoEm: null, pais: [] });
  });

  it("lista os filhos de uma pasta (sem lixeira), na ordem pedida, por páginas", async () => {
    respostas.buscar = () => [
      200,
      { nextPageToken: "PROXIMA", files: [{ id: "A", name: "a.pdf", mimeType: "application/pdf", size: "10", parents: ["PAI'1"] }] },
    ];
    const pagina = await cliente().listarFilhos("PAI'1", { ordem: "data-desc", pagina: "ATUAL", tamanho: 40 });
    expect(pagina.proxima).toBe("PROXIMA");
    expect(pagina.itens.map((i) => i.nome)).toEqual(["a.pdf"]);

    const params = new URL(base + pedidoDeGet().caminho).searchParams;
    expect(params.get("q")).toBe("'PAI\\'1' in parents and trashed = false");
    expect(params.get("orderBy")).toBe("folder,modifiedTime desc");
    expect(params.get("pageSize")).toBe("40");
    expect(params.get("pageToken")).toBe("ATUAL");
    expect(params.get("supportsAllDrives")).toBe("true");
  });

  it("na última página não há próxima, e a primeira não manda chave de página", async () => {
    const pagina = await cliente().listarFilhos("PAI", { ordem: "nome", pagina: null, tamanho: 40 });
    expect(pagina).toEqual({ itens: [], proxima: null });
    const params = new URL(base + pedidoDeGet().caminho).searchParams;
    expect(params.has("pageToken")).toBe(false);
    expect(params.get("orderBy")).toBe("folder,name_natural");
  });

  it("baixa o conteúdo pelo servidor", async () => {
    respostas.buscar = () => [200, { qualquer: "coisa" }];
    const bytes = await cliente().baixar("ARQ1");
    expect(new TextDecoder().decode(bytes)).toBe('{"qualquer":"coisa"}');
    expect(pedidoDeGet().caminho).toContain("alt=media");
  });

  it("item que o Drive não acha é erro permanente", async () => {
    respostas.buscar = () => [404, { error: { message: "File not found" } }];
    const erro = await cliente().obterItem("X").catch((e) => e);
    expect(erro).toBeInstanceOf(ErroDoDrive);
    expect(erro.permanente).toBe(true);
  });
});

describe("cliente do Drive: miniaturas", () => {
  const comMiniatura = () => cliente({ aceitaMiniatura: (url) => url.hostname === "127.0.0.1" });
  const pedidoDaMiniatura = () => pedidos.find((p) => p.caminho.startsWith("/thumb"))!;

  it("busca a miniatura no endereço que o Drive deu, em tamanho de grade, e devolve os bytes", async () => {
    respostas.buscar = () => [200, { thumbnailLink: `${base}/thumb/abc=s220` }];
    const m = await comMiniatura().miniatura("ARQ1");
    expect(m?.mime).toBe("image/png");
    expect(new TextDecoder().decode(m!.bytes)).toBe("bytes-da-miniatura");
    expect(pedidoDaMiniatura().caminho).toBe("/thumb/abc=s400");
    expect(pedidoDaMiniatura().autorizacao).toBeUndefined();
  });

  it("sem miniatura no Drive, devolve nulo", async () => {
    respostas.buscar = () => [200, {}];
    expect(await comMiniatura().miniatura("ARQ1")).toBeNull();
  });

  it("só busca endereços do Google: nada de pedir a um endereço qualquer", async () => {
    respostas.buscar = () => [200, { thumbnailLink: `${base}/thumb/abc=s220` }];
    expect(await cliente().miniatura("ARQ1")).toBeNull();
    expect(pedidos.some((p) => p.caminho.startsWith("/thumb"))).toBe(false);
  });

  it("resposta que não é imagem ou deu erro vale como sem miniatura", async () => {
    respostas.buscar = () => [200, { thumbnailLink: `${base}/thumb/abc=s220` }];
    respostas.miniatura = [200, "text/html"];
    expect(await comMiniatura().miniatura("ARQ1")).toBeNull();
    respostas.miniatura = [403, "image/png"];
    expect(await comMiniatura().miniatura("ARQ1")).toBeNull();
  });
});
