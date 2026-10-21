import { describe, expect, it } from "vitest";
import { CATALOGO_INICIAL, podeCriarEvento } from "@/dominio/catalogo";
import { cadastrar, categoria, comFuncoes, contaNova, criar, eventoDe } from "./ambiente";

describe("criar Evento: só quem tem Função na Área da Categoria", () => {
  it("Mariana cria Culto, e o banco registra quem criou e quando", async () => {
    const mariana = await comFuncoes("Mariana", "lider", ["Líder de integração e programação"]);
    const culto = await categoria("Culto");

    const { data, error } = await criar(mariana.cliente, eventoDe(culto.id, mariana.id));
    expect(error).toBeNull();
    expect(data!.criado_por).toBe(mariana.id);
    expect(Date.now() - new Date(data!.criado_em).getTime()).toBeLessThan(60_000);
  });

  it("ninguém registra outra pessoa como criadora", async () => {
    const mariana = await comFuncoes("Mariana", "lider", ["Líder de integração e programação"]);
    const denize = await comFuncoes("Denize", "lider", ["Co-líder de integração e programação"]);
    const culto = await categoria("Culto");

    const { error } = await mariana.cliente.from("eventos").insert({ ...eventoDe(culto.id, mariana.id), criado_por: denize.id });
    expect(error).not.toBeNull();
  });

  it("o banco concorda com o módulo de domínio para cada Função, Professor e Pendente", async () => {
    const pessoas = [
      await comFuncoes("Carol França", "lider", ["Líder de comunicação e mídia"]),
      await comFuncoes("Beythel", "lider", ["Líder do louvor"]),
      await comFuncoes("Carol Leal", "lider", ["Co-líder do ministério"]),
      await comFuncoes("Admin sem Função", "admin", []),
      await comFuncoes("Paulo", "professor", []),
      await comFuncoes("Novato", "pendente", []),
      await comFuncoes("Saiu", "lider", ["Líder do ministério"], false),
    ];
    const lider = await comFuncoes("Responsável", "lider", ["Líder do louvor"]);
    const areaDa = (f: string) => CATALOGO_INICIAL.funcoes.find((x) => x.nome === f)!.area;

    for (const nome of ["Culto", "Postagem", "Ensaio de louvor", "Reunião de liderança", "Serviço"]) {
      const c = await categoria(nome);
      // Os obrigatórios do catálogo inicial preenchidos, para que só a permissão decida.
      const obrigatorio = { Postagem: ["Plataforma", "Instagram"], Serviço: ["Descrição da ação", "Distribuir lanches"] }[nome];
      const campos = obrigatorio ? { [c.campo(obrigatorio[0])]: obrigatorio[1] } : {};

      for (const quem of pessoas) {
        const { error } = await criar(quem.cliente, eventoDe(c.id, lider.id, { campos }));
        const esperado = podeCriarEvento(quem.pessoa, quem.funcoes.map(areaDa), { area: c.area });
        expect(error === null, `${quem.funcoes.join(" + ") || quem.pessoa.nivel} cria ${nome}`).toBe(esperado);
      }
    }
  });
});

describe("Responsável", () => {
  it("um Rascunho pode ficar sem Responsável; os outros Status, não", async () => {
    const mariana = await comFuncoes("Mariana", "lider", ["Líder de integração e programação"]);
    const culto = await categoria("Culto");

    expect((await criar(mariana.cliente, eventoDe(culto.id, null, { status: "rascunho" }))).error).toBeNull();
    for (const status of ["planejado", "confirmado", "cancelado", "adiado"]) {
      expect((await criar(mariana.cliente, eventoDe(culto.id, null, { status }))).error, status).not.toBeNull();
    }
  });

  it("é qualquer pessoa da Liderança, mesmo sem Função na Área; nunca um Professor ou Pendente", async () => {
    const mariana = await comFuncoes("Mariana", "lider", ["Líder de integração e programação"]);
    const beythel = await comFuncoes("Beythel", "lider", ["Líder do louvor"]);
    const paulo = await contaNova("Paulo", "professor");
    const novo = await cadastrar("Novato");
    const culto = await categoria("Culto");

    expect((await criar(mariana.cliente, eventoDe(culto.id, beythel.id))).error).toBeNull();
    expect((await criar(mariana.cliente, eventoDe(culto.id, paulo.id))).error).not.toBeNull();
    expect((await criar(mariana.cliente, eventoDe(culto.id, novo.id!))).error).not.toBeNull();
  });
});

describe("campos do Evento", () => {
  it("o banco recusa Evento sem um campo específico obrigatório ou com opção que não existe", async () => {
    const carol = await comFuncoes("Carol França", "lider", ["Líder de comunicação e mídia"]);
    const postagem = await categoria("Postagem");
    const plataforma = postagem.campo("Plataforma");

    expect((await criar(carol.cliente, eventoDe(postagem.id, carol.id))).error).not.toBeNull();
    expect((await criar(carol.cliente, eventoDe(postagem.id, carol.id, { campos: { [plataforma]: "  " } }))).error).not.toBeNull();
    expect((await criar(carol.cliente, eventoDe(postagem.id, carol.id, { campos: { [plataforma]: "TikTok" } }))).error).not.toBeNull();
    expect((await criar(carol.cliente, eventoDe(postagem.id, carol.id, { campos: { [plataforma]: "Instagram" } }))).error).toBeNull();
  });

  it("o banco recusa campos que não são da Categoria", async () => {
    const carol = await comFuncoes("Carol França", "lider", ["Líder de comunicação e mídia"]);
    const postagem = await categoria("Postagem");
    const campos = { [postagem.campo("Plataforma")]: "Instagram", [crypto.randomUUID()]: "intruso" };

    expect((await criar(carol.cliente, eventoDe(postagem.id, carol.id, { campos }))).error).not.toBeNull();
  });

  it("o banco confere o tipo de cada campo específico, como o módulo de domínio", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const paulo = await contaNova("Paulo", "professor");
    const novato = await contaNova("Novato");
    const extra = await categoria("Evento extra");
    const ebd = await categoria("EBD");
    const extraValido = { [extra.campo("Tipo")]: "Gincana", [extra.campo("O que levar")]: ["Bíblia"] };
    const ebdValida = { [ebd.campo("Tema")]: "Davi" };
    const comCampos = (c: { id: string }, campos: Record<string, unknown>) => criar(lucas.cliente, eventoDe(c.id, lucas.id, { campos }));

    expect((await comCampos(extra, { ...extraValido, [extra.campo("Valor")]: 3550 })).error).toBeNull();
    expect((await comCampos(ebd, { ...ebdValida, [ebd.campo("Professor")]: lucas.id })).error).toBeNull();
    // Professor e Auxiliar também aceitam um Professor ativo (ticket 11); os demais campos pessoa, só a Liderança.
    expect((await comCampos(ebd, { ...ebdValida, [ebd.campo("Professor")]: paulo.id })).error).toBeNull();
    for (const [nome, campos] of [
      ["valor como texto", { ...extraValido, [extra.campo("Valor")]: "trinta" }],
      ["valor negativo", { ...extraValido, [extra.campo("Valor")]: -100 }],
      ["valor com fração de centavo", { ...extraValido, [extra.campo("Valor")]: 10.5 }],
      ["lista como texto", { ...extraValido, [extra.campo("O que levar")]: "Bíblia" }],
      ["link que não é da web", { ...extraValido, [extra.campo("Link de inscrição")]: "pasta do drive" }],
      ["texto que não é texto", { ...ebdValida, [ebd.campo("Tema")]: 42 }],
      ["pessoa que não é da Liderança nem Professor", { ...ebdValida, [ebd.campo("Professor")]: novato.id }],
    ] as const) {
      const c = nome.startsWith("texto") || nome.startsWith("pessoa") ? ebd : extra;
      expect((await comCampos(c, campos)).error, nome).not.toBeNull();
    }
  });

  it("dia inteiro começa à meia-noite de Salvador, e o fim é opcional", async () => {
    const mariana = await comFuncoes("Mariana", "lider", ["Líder de integração e programação"]);
    const culto = await categoria("Culto");

    const diaInteiro = { dia_inteiro: true, inicio: "2026-10-24T03:00:00Z", fim: null };
    expect((await criar(mariana.cliente, eventoDe(culto.id, mariana.id, diaInteiro))).error).toBeNull();
    const foraDaMeiaNoite = { dia_inteiro: true, inicio: "2026-10-24T13:00:00Z", fim: null };
    expect((await criar(mariana.cliente, eventoDe(culto.id, mariana.id, foraDaMeiaNoite))).error).not.toBeNull();
  });

  it("o fim não vem antes do início", async () => {
    const mariana = await comFuncoes("Mariana", "lider", ["Líder de integração e programação"]);
    const culto = await categoria("Culto");

    const invertido = { inicio: "2026-10-24T22:00:00Z", fim: "2026-10-24T21:00:00Z" };
    expect((await criar(mariana.cliente, eventoDe(culto.id, mariana.id, invertido))).error).not.toBeNull();
  });

  it("um Evento novo não nasce Realizado", async () => {
    const mariana = await comFuncoes("Mariana", "lider", ["Líder de integração e programação"]);
    const culto = await categoria("Culto");

    expect((await criar(mariana.cliente, eventoDe(culto.id, mariana.id, { status: "realizado" }))).error).not.toBeNull();
  });
});

describe("ler Eventos", () => {
  it("toda a Liderança lê os Eventos de todas as Áreas; Professor e Pendente não leem nenhum", async () => {
    const mariana = await comFuncoes("Mariana", "lider", ["Líder de integração e programação"]);
    const beythel = await comFuncoes("Beythel", "lider", ["Líder do louvor"]);
    const lucas = await contaNova("Lucas", "admin");
    const paulo = await contaNova("Paulo", "professor");
    const novo = await cadastrar("Novato");
    const culto = await categoria("Culto");
    const { data } = await criar(mariana.cliente, eventoDe(culto.id, mariana.id));

    for (const quem of [beythel.cliente, lucas.cliente]) {
      expect((await quem.from("eventos").select("id").eq("id", data!.id)).data).toHaveLength(1);
    }
    for (const quem of [paulo.cliente, novo.cliente]) {
      expect((await quem.from("eventos").select("id")).data).toEqual([]);
    }
  });
});
