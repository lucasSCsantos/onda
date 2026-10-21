import { describe, expect, it } from "vitest";
import { CATALOGO_INICIAL, podeCriarEvento } from "@/dominio/catalogo";
import { admin, cadastrar, comFuncoes, contaNova, funcao } from "./ambiente";

type CategoriaDoBanco = {
  id: string;
  nome: string;
  cor: string;
  areas: { nome: string };
  campos_das_categorias: { nome: string; tipo: string; obrigatorio: boolean; opcoes: string[]; ordem: number }[];
};

async function categoriasDoBanco(): Promise<CategoriaDoBanco[]> {
  const { data } = await admin
    .from("categorias")
    .select("id, nome, cor, areas(nome), campos_das_categorias(nome, tipo, obrigatorio, opcoes, ordem)")
    .overrideTypes<CategoriaDoBanco[], { merge: false }>()
    .throwOnError();
  return data;
}

const areaDa = (nome: string) => CATALOGO_INICIAL.funcoes.find((f) => f.nome === nome)!.area;

async function podeCriar(cliente: Awaited<ReturnType<typeof contaNova>>["cliente"], categoria: string) {
  const { data, error } = await cliente.rpc("pode_criar_evento", { categoria });
  if (error) throw error;
  // Estritamente true ou false: nulo também negaria, mas não seria a resposta do domínio.
  expect(typeof data).toBe("boolean");
  return data as boolean;
}

describe("catálogo inicial", () => {
  it("traz as Áreas, as Funções e suas Áreas conforme a spec", async () => {
    const areas = await admin.from("areas").select("nome").throwOnError();
    expect(areas.data.map((a) => a.nome).sort()).toEqual([...CATALOGO_INICIAL.areas].sort());

    const funcoes = await admin.from("funcoes").select("nome, areas(nome)").throwOnError();
    const doBanco = funcoes.data.map((f) => ({ nome: f.nome, area: (f.areas as unknown as { nome: string }).nome }));
    expect(doBanco).toEqual(expect.arrayContaining(CATALOGO_INICIAL.funcoes));
  });

  it("traz as Categorias com Área, cor e campos conforme a spec", async () => {
    const categorias = await categoriasDoBanco();
    for (const esperada of CATALOGO_INICIAL.categorias) {
      const noBanco = categorias.find((c) => c.nome === esperada.nome);
      expect(noBanco, esperada.nome).toBeDefined();
      expect({
        nome: noBanco!.nome,
        area: noBanco!.areas.nome,
        cor: noBanco!.cor,
        campos: noBanco!.campos_das_categorias
          .sort((a, b) => a.ordem - b.ordem)
          .map(({ nome, tipo, obrigatorio, opcoes }) => ({ nome, tipo, obrigatorio, opcoes })),
      }).toEqual(esperada);
    }
  });

  it("a Liderança lê as Categorias e os campos; Professor e Pendente não", async () => {
    const carol = await contaNova("Carol", "lider");
    const paulo = await contaNova("Paulo", "professor");
    const novo = await cadastrar("Novato");

    const daCarol = await carol.cliente.from("categorias").select("nome, campos_das_categorias(nome)");
    expect(daCarol.data?.length).toBeGreaterThanOrEqual(CATALOGO_INICIAL.categorias.length);
    for (const quem of [paulo.cliente, novo.cliente]) {
      expect((await quem.from("categorias").select("id")).data).toEqual([]);
      expect((await quem.from("campos_das_categorias").select("id")).data).toEqual([]);
    }
  });
});

describe("quem pode criar Evento de qual Categoria: o banco concorda com o módulo de domínio", () => {
  it("para a Liderança da spec, para Professor, Pendente e desativado", async () => {
    const pessoas = [
      await comFuncoes("Lucas", "admin", ["Líder do ministério", "Líder do ensino"]),
      await comFuncoes("Carol Leal", "lider", ["Co-líder do ministério", "Líder do louvor dos adolescentes"]),
      await comFuncoes("Beythel", "lider", ["Líder do louvor"]),
      await comFuncoes("Carol França", "lider", ["Líder de comunicação e mídia"]),
      await comFuncoes("Mariana", "lider", ["Líder de integração e programação"]),
      await comFuncoes("Denize", "lider", ["Co-líder de integração e programação"]),
      await comFuncoes("Admin sem Função", "admin", []),
      await comFuncoes("Ensino e louvor", "lider", ["Líder do ensino", "Líder do louvor"]),
      await comFuncoes("Paulo", "professor", []),
      await comFuncoes("Novato", "pendente", []),
      await comFuncoes("Saiu", "lider", ["Líder do ministério"], false),
    ];
    const categorias = (await categoriasDoBanco()).filter((c) => CATALOGO_INICIAL.categorias.some((i) => i.nome === c.nome));

    for (const quem of pessoas) {
      const noBanco: string[] = [];
      for (const c of categorias) if (await podeCriar(quem.cliente, c.id)) noBanco.push(c.nome);
      const noDominio = categorias
        .filter((c) => podeCriarEvento(quem.pessoa, quem.funcoes.map(areaDa), { area: c.areas.nome }))
        .map((c) => c.nome);
      expect(noBanco.sort(), quem.funcoes.join(" + ") || quem.pessoa.nivel).toEqual(noDominio.sort());
    }
  });
});

describe("Funções", () => {
  it("o Admin cria uma Função e a edita, mudando nome e Área", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const nome = `Líder de acampamento ${crypto.randomUUID()}`;
    const acampamento = await admin.from("areas").select("id").eq("nome", "Acampamento").single().throwOnError();
    const ensino = await admin.from("areas").select("id").eq("nome", "Ensino").single().throwOnError();

    const criacao = await lucas.cliente.from("funcoes").insert({ nome, area_id: acampamento.data.id }).select("id").single();
    expect(criacao.error).toBeNull();

    const edicao = await lucas.cliente
      .from("funcoes")
      .update({ nome: `${nome} e ensino`, area_id: ensino.data.id })
      .eq("id", criacao.data!.id);
    expect(edicao.error).toBeNull();
    const salva = await admin.from("funcoes").select("nome, area_id").eq("id", criacao.data!.id).single();
    expect(salva.data).toEqual({ nome: `${nome} e ensino`, area_id: ensino.data.id });
  });

  it("Líder e Professor não criam nem editam Funções", async () => {
    const louvor = await funcao("Líder do louvor");
    for (const nivel of ["lider", "professor"] as const) {
      const pessoa = await contaNova(`Sem permissão (${nivel})`, nivel);
      const geral = await admin.from("areas").select("id").eq("nome", "Geral").single().throwOnError();

      const criacao = await pessoa.cliente.from("funcoes").insert({ nome: crypto.randomUUID(), area_id: geral.data.id });
      expect(criacao.error).not.toBeNull();
      await pessoa.cliente.from("funcoes").update({ area_id: geral.data.id }).eq("id", louvor);
      const salva = await admin.from("funcoes").select("areas(nome)").eq("id", louvor).single();
      expect(salva.data?.areas).toEqual({ nome: "Louvor" });
    }
  });

  it("o Admin dá várias Funções à mesma pessoa e ela cria a união das Categorias", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const carol = await comFuncoes("Carol", "lider", ["Líder do louvor"]);
    const categorias = await categoriasDoBanco();
    const id = (nome: string) => categorias.find((c) => c.nome === nome)!.id;
    expect(await podeCriar(carol.cliente, id("Postagem"))).toBe(false);

    const atribuicao = await lucas.cliente.rpc("definir_funcoes", {
      pessoa: carol.id,
      novas_funcoes: [await funcao("Líder do louvor"), await funcao("Líder de comunicação e mídia")],
    });
    expect(atribuicao.error).toBeNull();

    const funcoes = await carol.cliente.from("funcoes_das_pessoas").select("funcoes(nome)").eq("pessoa_id", carol.id);
    expect(funcoes.data?.map((f) => (f.funcoes as unknown as { nome: string }).nome).sort()).toEqual([
      "Líder de comunicação e mídia",
      "Líder do louvor",
    ]);
    expect(await podeCriar(carol.cliente, id("Postagem"))).toBe(true);
    expect(await podeCriar(carol.cliente, id("Ensaio de louvor"))).toBe(true);
    expect(await podeCriar(carol.cliente, id("Culto"))).toBe(false);
  });

  it("o Admin troca as Funções de alguém, mas um Líder não fica sem Função", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const carol = await comFuncoes("Carol", "lider", ["Líder do louvor", "Líder do ensino"]);

    const troca = await lucas.cliente.rpc("definir_funcoes", { pessoa: carol.id, novas_funcoes: [await funcao("Líder do ensino")] });
    expect(troca.error).toBeNull();
    const vazia = await lucas.cliente.rpc("definir_funcoes", { pessoa: carol.id, novas_funcoes: [] });
    expect(vazia.error).not.toBeNull();

    const funcoes = await admin.from("funcoes_das_pessoas").select("funcao_id").eq("pessoa_id", carol.id);
    expect(funcoes.data).toEqual([{ funcao_id: await funcao("Líder do ensino") }]);
  });

  it("Professor e Pendente não recebem Função", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const paulo = await contaNova("Paulo", "professor");
    const novo = await cadastrar("Novato");
    const ensino = await funcao("Líder do ensino");

    for (const pessoa of [paulo.id, novo.id!]) {
      const atribuicao = await lucas.cliente.rpc("definir_funcoes", { pessoa, novas_funcoes: [ensino] });
      expect(atribuicao.error).not.toBeNull();
    }
  });

  it("só o Admin atribui Funções, nem diretamente na tabela", async () => {
    const carol = await comFuncoes("Carol", "lider", ["Líder do louvor"]);
    const geral = await funcao("Líder do ministério");

    const pelaFuncao = await carol.cliente.rpc("definir_funcoes", { pessoa: carol.id, novas_funcoes: [geral] });
    expect(pelaFuncao.error).not.toBeNull();
    const direto = await carol.cliente.from("funcoes_das_pessoas").insert({ pessoa_id: carol.id, funcao_id: geral });
    expect(direto.error).not.toBeNull();
    const lucas = await contaNova("Lucas", "admin");
    const diretoDoAdmin = await lucas.cliente.from("funcoes_das_pessoas").insert({ pessoa_id: carol.id, funcao_id: geral });
    expect(diretoDoAdmin.error).not.toBeNull();
  });
});

describe("Categorias", () => {
  async function areaId(nome: string) {
    const { data } = await admin.from("areas").select("id").eq("nome", nome).single().throwOnError();
    return data.id as string;
  }

  it("o Admin cria uma Categoria com campos, sem mudar a estrutura do banco, e muda sua Área", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const beythel = await comFuncoes("Beythel", "lider", ["Líder do louvor"]);
    const nome = `Retiro de louvor ${crypto.randomUUID()}`;

    const criacao = await lucas.cliente
      .from("categorias")
      .insert({ nome, area_id: await areaId("Acampamento"), cor: "#123abc" })
      .select("id")
      .single();
    expect(criacao.error).toBeNull();
    const categoria = criacao.data!.id;

    const campos = await lucas.cliente.from("campos_das_categorias").insert([
      { categoria_id: categoria, nome: "Tema", tipo: "texto_curto", obrigatorio: true, ordem: 0 },
      { categoria_id: categoria, nome: "Turno", tipo: "escolha", opcoes: ["Manhã", "Tarde"], ordem: 1 },
      { categoria_id: categoria, nome: "Tarefas", tipo: "checklist", ordem: 2 },
    ], { defaultToNull: false });
    expect(campos.error).toBeNull();
    expect(await podeCriar(beythel.cliente, categoria)).toBe(false);

    const mudanca = await lucas.cliente.from("categorias").update({ area_id: await areaId("Louvor"), cor: "#abcdef" }).eq("id", categoria);
    expect(mudanca.error).toBeNull();
    expect(await podeCriar(beythel.cliente, categoria)).toBe(true);

    const lida = await beythel.cliente.from("categorias").select("cor, campos_das_categorias(nome)").eq("id", categoria).single();
    expect(lida.data?.cor).toBe("#abcdef");
    expect(lida.data?.campos_das_categorias).toHaveLength(3);
  });

  it("o Admin edita e remove campos", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const { data: categoria } = await admin
      .from("categorias")
      .insert({ nome: `Teste ${crypto.randomUUID()}`, area_id: await areaId("Ensino"), cor: "#000000" })
      .select("id")
      .single()
      .throwOnError();
    const { data: campo } = await admin
      .from("campos_das_categorias")
      .insert({ categoria_id: categoria.id, nome: "Tema", tipo: "texto_curto" })
      .select("id")
      .single()
      .throwOnError();

    const edicao = await lucas.cliente
      .from("campos_das_categorias")
      .update({ nome: "Assunto", tipo: "texto_longo", obrigatorio: true })
      .eq("id", campo.id);
    expect(edicao.error).toBeNull();
    const remocao = await lucas.cliente.from("campos_das_categorias").delete().eq("id", campo.id).select("id");
    expect(remocao.data).toEqual([{ id: campo.id }]);
  });

  it("o banco recusa tipo desconhecido, escolha sem opções, opções fora da escolha, nome repetido (de campo e de Categoria) e cor inválida", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const { data: categoria } = await lucas.cliente
      .from("categorias")
      .insert({ nome: `Teste ${crypto.randomUUID()}`, area_id: await areaId("Ensino"), cor: "#000000" })
      .select("id")
      .single()
      .throwOnError();
    const campo = (extra: Record<string, unknown>) =>
      lucas.cliente.from("campos_das_categorias").insert({ categoria_id: categoria.id, nome: "Campo", tipo: "texto_curto", ...extra });

    expect((await campo({ tipo: "anexo" })).error).not.toBeNull();
    expect((await campo({ tipo: "escolha" })).error).not.toBeNull();
    expect((await campo({ opcoes: ["A"] })).error).not.toBeNull();
    expect((await campo({ nome: " " })).error).not.toBeNull();
    expect((await campo({})).error).toBeNull();
    expect((await campo({ nome: "campo " })).error).not.toBeNull();

    const nomeRepetido = await lucas.cliente.from("categorias").insert({ nome: "culto ", area_id: await areaId("Ensino"), cor: "#000000" });
    expect(nomeRepetido.error).not.toBeNull();

    const corRuim = await lucas.cliente.from("categorias").insert({ nome: crypto.randomUUID(), area_id: await areaId("Ensino"), cor: "azul" });
    expect(corRuim.error).not.toBeNull();
  });

  it("Líder e Professor não criam nem editam Categorias e campos", async () => {
    const culto = (await categoriasDoBanco()).find((c) => c.nome === "Culto")!;
    for (const nivel of ["lider", "professor"] as const) {
      const pessoa = await comFuncoes(`Sem permissão (${nivel})`, nivel, nivel === "lider" ? ["Líder do ministério"] : []);

      const criacao = await pessoa.cliente.from("categorias").insert({ nome: crypto.randomUUID(), area_id: await areaId("Geral"), cor: "#000000" });
      expect(criacao.error).not.toBeNull();
      await pessoa.cliente.from("categorias").update({ area_id: await areaId("Geral"), cor: "#000000" }).eq("id", culto.id);
      const campo = await pessoa.cliente.from("campos_das_categorias").insert({ categoria_id: culto.id, nome: "Intruso", tipo: "link" });
      expect(campo.error).not.toBeNull();
      await pessoa.cliente.from("campos_das_categorias").delete().eq("categoria_id", culto.id);
    }

    const depois = (await categoriasDoBanco()).find((c) => c.nome === "Culto")!;
    expect(depois.areas.nome).toBe("Programação");
    expect(depois.cor).toBe(culto.cor);
    expect(depois.campos_das_categorias).toHaveLength(culto.campos_das_categorias.length);
  });
});
