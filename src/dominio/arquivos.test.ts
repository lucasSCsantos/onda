import { describe, expect, it } from "vitest";
import { driveFalso } from "@/lib/drive/falso";
import { abrirPasta, caminhoDentro, enderecoDeArquivos, formatarTamanho, lerAtalho, lerIdDoAtalho, lerModo, lerOrdem, lerPagina, situacaoDeArquivos, tipoDoItem } from "./arquivos";
import { ErroDoDrive } from "./drive";
import type { ClienteDoDrive } from "./pastas";

const RAIZ = "RAIZ1234567890";
const OUTRA_RAIZ = "OUTRA_RAIZ_QUALQUER";

/** Raiz > Identidade > Logos (com uma logo), Raiz > Acampamento, e uma pasta de fora da raiz com um arquivo. */
function ministerio() {
  const drive = driveFalso();
  const identidade = drive.pasta("Identidade", RAIZ);
  const logos = drive.pasta("Logos", identidade);
  const logo = drive.arquivo("logo.png", logos, { mime: "image/png", tamanho: 2048 });
  const acampamento = drive.pasta("Acampamento", RAIZ);
  const fora = drive.pasta("Outro ministério", OUTRA_RAIZ);
  const segredo = drive.arquivo("folha.pdf", fora);
  return { drive, identidade, logos, logo, acampamento, fora, segredo };
}

const pedido = (cliente: ClienteDoDrive, sobre: Partial<Omit<Parameters<typeof abrirPasta>[0], "cliente">> = {}) => ({
  cliente,
  raizId: RAIZ,
  atalho: null,
  pastaId: null,
  ordem: "nome" as const,
  pagina: null,
  limiteDeDownloadBytes: 4 * 1024 * 1024,
  ...sobre,
});

const ok = async (p: ReturnType<typeof pedido>) => {
  const r = await abrirPasta(p);
  if (r.estado !== "ok") throw new Error(`esperava ok, veio ${r.estado}`);
  return r;
};

describe("onde um item mora", () => {
  it("devolve o caminho da pasta de baixo da raiz até o item, na ordem", async () => {
    const { drive, identidade, logos } = ministerio();
    const caminho = await caminhoDentro({ limiteId: RAIZ, itemId: logos, cliente: drive.cliente });
    expect(caminho?.map((i) => i.nome)).toEqual(["Identidade", "Logos"]);
    expect(caminho?.[0].id).toBe(identidade);
  });

  it("a própria pasta-limite tem caminho vazio", async () => {
    const { drive } = ministerio();
    expect(await caminhoDentro({ limiteId: RAIZ, itemId: RAIZ, cliente: drive.cliente })).toEqual([]);
  });

  it("nega o que mora fora da raiz, mesmo fundo no Drive", async () => {
    const { drive, fora, segredo } = ministerio();
    expect(await caminhoDentro({ limiteId: RAIZ, itemId: fora, cliente: drive.cliente })).toBeNull();
    expect(await caminhoDentro({ limiteId: RAIZ, itemId: segredo, cliente: drive.cliente })).toBeNull();
  });

  it("nega o ID que o Drive não conhece, em vez de dar erro", async () => {
    const { drive } = ministerio();
    expect(await caminhoDentro({ limiteId: RAIZ, itemId: "NAO_EXISTE_1234", cliente: drive.cliente })).toBeNull();
  });

  it("uma pasta que sai da raiz deixa de valer", async () => {
    const { drive, logos } = ministerio();
    drive.mover(logos, OUTRA_RAIZ);
    expect(await caminhoDentro({ limiteId: RAIZ, itemId: logos, cliente: drive.cliente })).toBeNull();
  });

  it("não se perde num ciclo de pastas", async () => {
    const { drive, identidade, logos } = ministerio();
    drive.mover(identidade, logos);
    expect(await caminhoDentro({ limiteId: RAIZ, itemId: logos, cliente: drive.cliente })).toBeNull();
  });

  it("um erro passageiro do Drive não vira permissão: sobe como erro", async () => {
    const { drive, logos } = ministerio();
    const cliente: ClienteDoDrive = {
      ...drive.cliente,
      obterItem: async () => {
        throw new ErroDoDrive("Drive 503: indisponível");
      },
    };
    await expect(caminhoDentro({ limiteId: RAIZ, itemId: logos, cliente })).rejects.toThrow("503");
  });
});

describe("abrir uma pasta em Arquivos", () => {
  it("sem pasta pedida abre a raiz, com as pastas antes dos arquivos", async () => {
    const { drive } = ministerio();
    drive.arquivo("avisos.pdf", RAIZ);
    const r = await ok(pedido(drive.cliente));
    expect(r.caminho).toEqual([{ id: RAIZ, nome: "Arquivos" }]);
    expect(r.itens.map((i) => [i.nome, i.pasta])).toEqual([
      ["Acampamento", true],
      ["Identidade", true],
      ["avisos.pdf", false],
    ]);
  });

  it("monta o breadcrumb da raiz até a pasta", async () => {
    const { drive, logos } = ministerio();
    const r = await ok(pedido(drive.cliente, { pastaId: logos }));
    expect(r.caminho.map((c) => c.nome)).toEqual(["Arquivos", "Identidade", "Logos"]);
    expect(r.itens.map((i) => i.nome)).toEqual(["logo.png"]);
  });

  it("entrega só o que a tela mostra: nada de pais nem tipo MIME cru", async () => {
    const { drive, logos } = ministerio();
    const r = await ok(pedido(drive.cliente, { pastaId: logos }));
    expect(Object.keys(r.itens[0]).sort()).toEqual(["baixavel", "id", "link", "modificadoEm", "nome", "pasta", "previa", "tamanho", "tipo"]);
    expect(r.itens[0]).toMatchObject({ tipo: "imagem", tamanho: 2048 });
  });

  it("bloqueia uma pasta de fora da raiz", async () => {
    const { drive, fora } = ministerio();
    expect(await abrirPasta(pedido(drive.cliente, { pastaId: fora }))).toEqual({ estado: "bloqueado" });
  });

  it("bloqueia um arquivo pedido como se fosse pasta, mesmo dentro da raiz", async () => {
    const { drive, logo } = ministerio();
    expect(await abrirPasta(pedido(drive.cliente, { pastaId: logo }))).toEqual({ estado: "bloqueado" });
  });

  it("um ID que não existe também é bloqueado, sem dizer o que há no Drive", async () => {
    const { drive } = ministerio();
    expect(await abrirPasta(pedido(drive.cliente, { pastaId: "NAO_EXISTE_1234" }))).toEqual({ estado: "bloqueado" });
  });

  describe("com atalho", () => {
    it("abre a pasta do atalho e o breadcrumb começa nele", async () => {
      const { drive, identidade, logos } = ministerio();
      const atalho = { id: "a1", nome: "Identidade visual", pastaId: identidade };
      const r = await ok(pedido(drive.cliente, { atalho, pastaId: logos }));
      expect(r.caminho.map((c) => c.nome)).toEqual(["Identidade visual", "Logos"]);
    });

    it("sem pasta pedida abre a do atalho", async () => {
      const { drive, identidade } = ministerio();
      const r = await ok(pedido(drive.cliente, { atalho: { id: "a1", nome: "Identidade visual", pastaId: identidade } }));
      expect(r.itens.map((i) => i.nome)).toEqual(["Logos"]);
    });

    it("não deixa subir para fora da pasta do atalho, mesmo dentro da raiz", async () => {
      const { drive, identidade, acampamento } = ministerio();
      const atalho = { id: "a1", nome: "Identidade visual", pastaId: identidade };
      expect(await abrirPasta(pedido(drive.cliente, { atalho, pastaId: acampamento }))).toEqual({ estado: "bloqueado" });
    });

    it("um atalho cadastrado com pasta de fora da raiz não abre nada", async () => {
      const { drive, fora } = ministerio();
      const atalho = { id: "a1", nome: "Fora", pastaId: fora };
      expect(await abrirPasta(pedido(drive.cliente, { atalho }))).toEqual({ estado: "bloqueado" });
    });
  });

  describe("ordem e páginas", () => {
    it("ordena por nome e por data, nos dois sentidos", async () => {
      const { drive } = ministerio();
      drive.arquivo("b.pdf", RAIZ, { modificadoEm: new Date("2026-01-02") });
      drive.arquivo("a.pdf", RAIZ, { modificadoEm: new Date("2026-03-01") });
      drive.arquivo("c.pdf", RAIZ, { modificadoEm: new Date("2026-02-01") });
      const nomes = async (ordem: string) =>
        (await ok(pedido(drive.cliente, { ordem: lerOrdem(ordem) }))).itens.filter((i) => !i.pasta).map((i) => i.nome);
      expect(await nomes("nome")).toEqual(["a.pdf", "b.pdf", "c.pdf"]);
      expect(await nomes("nome-desc")).toEqual(["c.pdf", "b.pdf", "a.pdf"]);
      expect(await nomes("data-desc")).toEqual(["a.pdf", "c.pdf", "b.pdf"]);
      expect(await nomes("data")).toEqual(["b.pdf", "c.pdf", "a.pdf"]);
    });

    it("carrega por páginas e devolve a chave da próxima até acabar", async () => {
      const { drive } = ministerio();
      for (let i = 1; i <= 45; i++) drive.arquivo(`arquivo ${String(i).padStart(2, "0")}.pdf`, RAIZ);
      const primeira = await ok(pedido(drive.cliente));
      expect(primeira.itens).toHaveLength(40);
      expect(primeira.proxima).not.toBeNull();
      const segunda = await ok(pedido(drive.cliente, { pagina: primeira.proxima }));
      expect(segunda.itens).toHaveLength(7);
      expect(segunda.proxima).toBeNull();
    });
  });

  describe("quando o Drive falha", () => {
    it("diz que houve erro na integração, sem tela quebrada nem a mensagem do Drive", async () => {
      const { drive } = ministerio();
      drive.falharAoListar(new ErroDoDrive("Drive 500: segredo-interno"));
      expect(await abrirPasta(pedido(drive.cliente))).toEqual({ estado: "erro" });
    });

    it("um erro ao conferir a raiz também vira erro, e não permissão", async () => {
      const { drive, logos } = ministerio();
      const cliente: ClienteDoDrive = {
        ...drive.cliente,
        obterItem: async () => {
          throw new Error("rede caiu");
        },
      };
      expect(await abrirPasta(pedido(cliente, { pastaId: logos }))).toEqual({ estado: "erro" });
    });
  });
});

describe("ordem pedida na URL", () => {
  it("aceita as quatro e cai em nome para qualquer outra coisa", () => {
    expect(["nome", "nome-desc", "data", "data-desc"].map(lerOrdem)).toEqual(["nome", "nome-desc", "data", "data-desc"]);
    expect(lerOrdem("qualquer")).toBe("nome");
    expect(lerOrdem(undefined)).toBe("nome");
  });
});

describe("tipo do item", () => {
  it("separa pasta, imagem, PDF, documento, planilha, apresentação, vídeo, áudio e o resto", () => {
    const tipo = (mime: string, pasta = false) => tipoDoItem({ mime, pasta });
    expect(tipo("application/vnd.google-apps.folder", true)).toBe("pasta");
    expect(tipo("image/png")).toBe("imagem");
    expect(tipo("application/pdf")).toBe("pdf");
    expect(tipo("application/vnd.google-apps.document")).toBe("documento");
    expect(tipo("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("documento");
    expect(tipo("application/vnd.google-apps.spreadsheet")).toBe("planilha");
    expect(tipo("application/vnd.google-apps.presentation")).toBe("apresentacao");
    expect(tipo("video/mp4")).toBe("video");
    expect(tipo("audio/mpeg")).toBe("audio");
    expect(tipo("application/zip")).toBe("outro");
  });

  it("um atalho do Drive não é pasta, mesmo que aponte para uma", () => {
    expect(tipoDoItem({ mime: "application/vnd.google-apps.shortcut", pasta: false })).toBe("outro");
  });
});

describe("atalho cadastrado pelo Admin", () => {
  const entrada = {
    nome: "Identidade visual",
    icone: "palette",
    pasta: "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp?usp=sharing",
    funcoes: ["f1", "f1", "f2"],
  };

  it("lê nome, ícone, o ID da pasta e as Funções sem repetir", () => {
    expect(lerAtalho(entrada)).toEqual({ nome: "Identidade visual", icone: "palette", pastaId: "1AbCdEfGhIjKlMnOp", funcoes: ["f1", "f2"] });
  });

  it("exige nome, ícone da lista e uma pasta que pareça uma pasta", () => {
    expect(lerAtalho({ ...entrada, nome: "  " })).toHaveProperty("erro");
    expect(lerAtalho({ ...entrada, nome: "x".repeat(41) })).toHaveProperty("erro");
    expect(lerAtalho({ ...entrada, icone: "bomba" })).toHaveProperty("erro");
    expect(lerAtalho({ ...entrada, pasta: "" })).toHaveProperty("erro");
    expect(lerAtalho({ ...entrada, pasta: "https://exemplo.com/x" })).toHaveProperty("erro");
  });

  it("sem Função marcada vale para toda a Liderança", () => {
    expect(lerAtalho({ ...entrada, funcoes: [] })).toMatchObject({ funcoes: [] });
  });
});

describe("endereço de Arquivos", () => {
  it("deixa de fora o padrão e leva atalho, pasta, ordem, modo e página", () => {
    expect(enderecoDeArquivos({})).toBe("/arquivos");
    expect(enderecoDeArquivos({ atalho: "a1", pasta: "P1", ordem: "data-desc", modo: "lista", pagina: "TOKEN" })).toBe(
      "/arquivos?atalho=a1&pasta=P1&ordem=data-desc&modo=lista&pagina=TOKEN",
    );
    expect(enderecoDeArquivos({ pasta: "a b&c" })).toBe("/arquivos?pasta=a+b%26c");
    expect(enderecoDeArquivos({ busca: "logo azul" })).toBe("/arquivos?q=logo+azul");
  });

  it("lê modo e página com cuidado", () => {
    expect(lerModo("lista")).toBe("lista");
    expect(lerModo("outra")).toBe("grade");
    expect(lerPagina("abc_DEF-123=")).toBe("abc_DEF-123=");
    expect(lerPagina("x y")).toBeNull();
    expect(lerPagina("")).toBeNull();
    expect(lerPagina(undefined)).toBeNull();
  });
});

describe("tamanho do arquivo", () => {
  it("escreve em B, KB, MB e GB, e fica vazio sem tamanho", () => {
    expect(formatarTamanho(null)).toBe("");
    expect(formatarTamanho(980)).toBe("980 B");
    expect(formatarTamanho(2048)).toBe("2,0 KB");
    expect(formatarTamanho(1.5 * 1024 * 1024)).toBe("1,5 MB");
    expect(formatarTamanho(3 * 1024 ** 3)).toBe("3,0 GB");
  });
});

describe("situação da seção Arquivos", () => {
  const base = { driveLigado: true, raizId: RAIZ, temCliente: true, atalhoPedido: false, atalhoVisivel: false };

  it("fica desligada sem Drive ligado, sem pasta raiz ou sem credenciais", () => {
    expect(situacaoDeArquivos({ ...base, driveLigado: false })).toBe("desligado");
    expect(situacaoDeArquivos({ ...base, raizId: null })).toBe("desligado");
    expect(situacaoDeArquivos({ ...base, temCliente: false })).toBe("desligado");
  });

  it("um atalho pedido que a pessoa não vê é negado, em vez de abrir a raiz", () => {
    expect(situacaoDeArquivos({ ...base, atalhoPedido: true, atalhoVisivel: false })).toBe("atalho-negado");
    expect(situacaoDeArquivos({ ...base, atalhoPedido: true, atalhoVisivel: true })).toBe("pronto");
    expect(situacaoDeArquivos(base)).toBe("pronto");
  });
});

describe("ID de atalho na URL", () => {
  it("só aceita UUID", () => {
    expect(lerIdDoAtalho("3f2b8c1e-9a4d-4e7b-8c21-0a1b2c3d4e5f")).toBe("3f2b8c1e-9a4d-4e7b-8c21-0a1b2c3d4e5f");
    expect(lerIdDoAtalho("1 or 1=1")).toBeNull();
    expect(lerIdDoAtalho("")).toBeNull();
    expect(lerIdDoAtalho(null)).toBeNull();
  });
});
