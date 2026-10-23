import { describe, expect, it } from "vitest";
import {
  autorizadoPeloAgendador,
  caminhoDaPasta,
  consultaDeBusca,
  esperaEmMinutos,
  idDaPasta,
  lerConfiguracaoDoDrive,
  linkDaPasta,
  MAXIMO_DE_TENTATIVAS,
  nomeDaPasta,
  situacaoDaPasta,
  temCampoDaPasta,
} from "./drive";

// Meio-dia em Salvador (UTC-3): 2026-10-25 às 12h no fuso do Mural.
const aula = new Date("2026-10-25T15:00:00Z");

describe("nome e caminho da pasta de um Evento", () => {
  it("a pasta do Evento é a data no fuso do Mural, um ponto e o título", () => {
    expect(nomeDaPasta({ inicio: aula, titulo: "Aula de EBD 3" })).toBe("2026-10-25 · Aula de EBD 3");
  });

  it("perto da meia-noite vale o dia de Salvador, não o de Greenwich", () => {
    // 01h30 UTC de 26/10 ainda é 22h30 de 25/10 em Salvador.
    expect(nomeDaPasta({ inicio: new Date("2026-10-26T01:30:00Z"), titulo: "Culto" })).toBe("2026-10-25 · Culto");
  });

  it("tira o que o Drive ou o caminho não aguentam: barras, quebras de linha e espaços sobrando", () => {
    expect(nomeDaPasta({ inicio: aula, titulo: "  Louvor / ensaio \n geral  " })).toBe("2026-10-25 · Louvor - ensaio geral");
  });

  it("corta títulos enormes sem deixar espaço no fim", () => {
    const nome = nomeDaPasta({ inicio: aula, titulo: "x".repeat(300) });
    expect(nome.length).toBeLessThanOrEqual(120);
    expect(nome).toBe(nome.trim());
  });

  it("o caminho é Categoria, ano e a pasta do Evento", () => {
    expect(caminhoDaPasta({ categoria: "EBD", inicio: aula, titulo: "Aula de EBD 3" })).toEqual(["EBD", "2026", "2026-10-25 · Aula de EBD 3"]);
  });
});

describe("o ID de uma pasta do Drive", () => {
  it("aceita o ID puro", () => {
    expect(idDaPasta("1AbCdEfGhIjKlMnOpQrStUvWxYz")).toBe("1AbCdEfGhIjKlMnOpQrStUvWxYz");
  });

  it("tira o ID do endereço da pasta, com ou sem parâmetros", () => {
    expect(idDaPasta("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz?usp=sharing")).toBe("1AbCdEfGhIjKlMnOpQrStUvWxYz");
    expect(idDaPasta("https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz")).toBe("1AbCdEfGhIjKlMnOpQrStUvWxYz");
  });

  it("recusa o que não parece uma pasta", () => {
    expect(idDaPasta("")).toBeNull();
    expect(idDaPasta("   ")).toBeNull();
    expect(idDaPasta("curto")).toBeNull();
    expect(idDaPasta("https://exemplo.com/pasta")).toBeNull();
    expect(idDaPasta("id com espaço no meio 123456789")).toBeNull();
  });

  it("o link de uma pasta é o do Drive", () => {
    expect(linkDaPasta("1AbC")).toBe("https://drive.google.com/drive/folders/1AbC");
  });
});

describe("espera entre as tentativas", () => {
  it("cresce a cada tentativa e nunca passa do teto", () => {
    const esperas = Array.from({ length: MAXIMO_DE_TENTATIVAS }, (_, i) => esperaEmMinutos(i + 1));
    expect(esperas).toEqual([...esperas].sort((a, b) => a - b));
    expect(esperas[0]).toBeGreaterThan(0);
    expect(esperaEmMinutos(99)).toBe(esperas.at(-1));
  });
});

describe("a configuração do Drive no formulário do Admin", () => {
  const raiz = "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz";

  it("ligado, guarda o ID da pasta raiz e as Categorias escolhidas", () => {
    expect(lerConfiguracaoDoDrive({ ligado: "on", pastaRaiz: raiz, categorias: ["c1", "c2"] })).toEqual({
      drive_ligado: true,
      drive_pasta_raiz_id: "1AbCdEfGhIjKlMnOpQrStUvWxYz",
      drive_categorias: ["c1", "c2"],
    });
  });

  it("ligado sem pasta raiz válida não salva", () => {
    expect(lerConfiguracaoDoDrive({ ligado: "on", pastaRaiz: "", categorias: [] })).toHaveProperty("erro");
    expect(lerConfiguracaoDoDrive({ ligado: "on", pastaRaiz: "isso não é uma pasta", categorias: [] })).toHaveProperty("erro");
  });

  it("desligado guarda o que veio, e a pasta raiz pode ficar em branco", () => {
    expect(lerConfiguracaoDoDrive({ ligado: "", pastaRaiz: "", categorias: ["c1"] })).toEqual({
      drive_ligado: false,
      drive_pasta_raiz_id: null,
      drive_categorias: ["c1"],
    });
  });

  it("não repete Categoria", () => {
    expect(lerConfiguracaoDoDrive({ ligado: "", pastaRaiz: "", categorias: ["c1", "c1"] })).toMatchObject({ drive_categorias: ["c1"] });
  });
});

describe("quem pode chamar o agendador", () => {
  it("só quem manda o segredo certo no Authorization", () => {
    expect(autorizadoPeloAgendador("Bearer segredo-longo-123", "segredo-longo-123")).toBe(true);
    expect(autorizadoPeloAgendador("Bearer outro", "segredo-longo-123")).toBe(false);
    expect(autorizadoPeloAgendador("segredo-longo-123", "segredo-longo-123")).toBe(false);
    expect(autorizadoPeloAgendador(null, "segredo-longo-123")).toBe(false);
  });

  it("sem segredo configurado, ninguém entra", () => {
    expect(autorizadoPeloAgendador("Bearer ", "")).toBe(false);
    expect(autorizadoPeloAgendador("Bearer ", undefined)).toBe(false);
    expect(autorizadoPeloAgendador("Bearer undefined", undefined)).toBe(false);
  });
});

describe("o que a tela do Evento diz da pasta", () => {
  it("sem pasta automática, não diz nada", () => {
    expect(situacaoDaPasta(null)).toBeNull();
  });

  it("pendente: explica que o link aparece em instantes", () => {
    expect(situacaoDaPasta("pendente")).toMatchObject({ tom: "info", texto: expect.stringContaining("Criando") });
    expect(situacaoDaPasta("pendente")!.texto).toContain("Se demorar, avise quem administra");
  });

  it("criada: avisa que o link só abre para quem tem acesso à pasta no Drive", () => {
    expect(situacaoDaPasta("criada")).toMatchObject({ tom: "ok", texto: expect.stringContaining("só abre para quem tem acesso") });
  });

  it("com erro: diz que o campo continua preenchível à mão, sem expor o erro técnico", () => {
    const situacao = situacaoDaPasta("falhou")!;
    expect(situacao.tom).toBe("erro");
    expect(situacao.texto).toContain("Link do material");
  });
});

describe("quais Categorias podem ter pasta sozinha", () => {
  it("as que têm um campo de link chamado Link do material (ou dos materiais)", () => {
    expect(temCampoDaPasta([{ nome: "Tema", tipo: "texto_curto" }, { nome: "Link do material", tipo: "link" }])).toBe(true);
    expect(temCampoDaPasta([{ nome: "Link dos materiais", tipo: "link" }])).toBe(true);
  });

  it("não as que não têm, nem as que têm só um campo de texto com esse nome", () => {
    expect(temCampoDaPasta([{ nome: "Pauta", tipo: "texto_longo" }])).toBe(false);
    expect(temCampoDaPasta([{ nome: "Link do material", tipo: "texto_curto" }])).toBe(false);
    expect(temCampoDaPasta([])).toBe(false);
  });
});

describe("a consulta que acha uma pasta pelo nome", () => {
  it("pede só pastas, dentro do pai, fora da lixeira", () => {
    expect(consultaDeBusca("EBD", "RAIZ")).toBe("name = 'EBD' and 'RAIZ' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
  });

  it("escapa aspas e barras do nome, para o título de um Evento nunca virar parte da consulta", () => {
    expect(consultaDeBusca("Culto d'Ana", "RAIZ")).toContain("name = 'Culto d\\'Ana'");
    expect(consultaDeBusca("a\\b", "RAIZ")).toContain("name = 'a\\\\b'");
    expect(consultaDeBusca("x' or name != '", "RAIZ")).toContain("name = 'x\\' or name != \\''");
  });
});
