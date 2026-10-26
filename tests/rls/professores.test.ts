import { describe, expect, it } from "vitest";
import { podeEditarSoAsObservacoes, podeVerEvento } from "@/dominio/professores";
import { admin, cadastrar, categoria, comFuncoes, contaNova, criar, eventoDe, funcao, type Cliente } from "./ambiente";

/** Grava uma aula de EBD direto pelo banco, com o Professor e o Auxiliar dados (ids ou nada), e devolve o id. */
async function aula(criador: string, professor: string | null, auxiliar: string | null = null, mudancas: Record<string, unknown> = {}) {
  const ebd = await categoria("EBD");
  const campos = {
    [ebd.campo("Tema")]: "Davi",
    ...(professor ? { [ebd.campo("Professor")]: professor } : {}),
    ...(auxiliar ? { [ebd.campo("Auxiliar")]: auxiliar } : {}),
  };
  const evento = eventoDe(ebd.id, criador, { titulo: "EBD de teste", campos, ...mudancas });
  const { data } = await admin.from("eventos").insert({ ...evento, criado_por: criador }).select("id").single().throwOnError();
  return data.id as string;
}

async function salvo(id: string) {
  const { data } = await admin.from("eventos").select("*").eq("id", id).single().throwOnError();
  return data;
}

async function editou(cliente: Cliente, id: string, mudancas: Record<string, unknown>) {
  const { data, error } = await cliente.from("eventos").update(mudancas).eq("id", id).select("id");
  return error === null && data.length === 1;
}

const ids = async (cliente: Cliente, tabela: string) => ((await cliente.from(tabela).select("id")).data ?? []).map((l) => l.id as string);

describe("cadastro de Professor e convite", () => {
  it("o Admin e quem tem Função em Ensino geram convite de Professor; os demais não", async () => {
    const quem = [
      { conta: await contaNova("Lucas", "admin"), pode: true },
      { conta: await comFuncoes("Líder do ensino", "lider", ["Líder do ensino"]), pode: true },
      { conta: await comFuncoes("Beythel", "lider", ["Líder do louvor"]), pode: false },
      { conta: await comFuncoes("Paulo", "professor", []), pode: false },
      { conta: await contaNova("Novato"), pode: false },
      { conta: await comFuncoes("Saiu", "lider", ["Líder do ensino"], false), pode: false },
    ];
    for (const { conta, pode } of quem) {
      const { error } = await conta.cliente.from("convites").insert({ nivel: "professor" });
      expect(error === null, conta.email).toBe(pode);
    }
  });

  it("quem tem Função em Ensino só gera convite de Professor, nunca de Líder, Admin ou com Função", async () => {
    const ensino = await comFuncoes("Líder do ensino", "lider", ["Líder do ensino"]);
    expect((await ensino.cliente.from("convites").insert({ nivel: "lider", funcao_id: await funcao("Líder do ensino") })).error).not.toBeNull();
    expect((await ensino.cliente.from("convites").insert({ nivel: "admin" })).error).not.toBeNull();
    expect((await ensino.cliente.from("convites").insert({ nivel: "professor", funcao_id: await funcao("Líder do ensino") })).error).not.toBeNull();
  });

  it("quem se cadastra pelo convite entra como Professor, sem Função", async () => {
    const ensino = await comFuncoes("Líder do ensino", "lider", ["Líder do ensino"]);
    const { data: convite } = await ensino.cliente.from("convites").insert({ nivel: "professor" }).select("codigo").single().throwOnError();

    const paulo = await cadastrar("Paulo", convite.codigo);
    expect(paulo.error).toBeNull();
    const perfil = await paulo.cliente.from("perfis").select("nivel").eq("id", paulo.id!).single();
    expect(perfil.data?.nivel).toBe("professor");
    const funcoes = await paulo.cliente.from("funcoes_das_pessoas").select("funcao_id").eq("pessoa_id", paulo.id!);
    expect(funcoes.data).toEqual([]);

    const usado = await ensino.cliente.from("convites").select("usado_por").eq("codigo", convite.codigo).single();
    expect(usado.data?.usado_por).toBe(paulo.id);
  });

  it("quem tem Função em Ensino lê e revoga convites de Professor, e não vê os de outros níveis", async () => {
    const ensino = await comFuncoes("Líder do ensino", "lider", ["Líder do ensino"]);
    const lucas = await contaNova("Lucas", "admin");
    const { data: dele } = await ensino.cliente.from("convites").insert({ nivel: "professor" }).select("id").single().throwOnError();
    const { data: doAdmin } = await lucas.cliente.from("convites").insert({ nivel: "admin" }).select("id").single().throwOnError();
    const { data: professorDoAdmin } = await lucas.cliente.from("convites").insert({ nivel: "professor" }).select("id").single().throwOnError();

    const visiveis = await ids(ensino.cliente, "convites");
    expect(visiveis).toContain(dele.id);
    expect(visiveis).toContain(professorDoAdmin.id);
    expect(visiveis).not.toContain(doAdmin.id);

    const revoga = await ensino.cliente.from("convites").update({ revogado_em: new Date().toISOString() }).eq("id", dele.id).select("id");
    expect(revoga.data).toHaveLength(1);
    const outro = await ensino.cliente.from("convites").update({ revogado_em: new Date().toISOString() }).eq("id", doAdmin.id).select("id");
    expect(outro.data).toEqual([]);
  });

  it("só o Admin inativa um Professor", async () => {
    const ensino = await comFuncoes("Líder do ensino", "lider", ["Líder do ensino"]);
    const lucas = await contaNova("Lucas", "admin");
    const paulo = await contaNova("Paulo", "professor");

    const pelaLideranca = await ensino.cliente.from("perfis").update({ ativo: false }).eq("id", paulo.id).select("id");
    expect(pelaLideranca.data).toEqual([]);
    const peloProprio = await paulo.cliente.from("perfis").update({ ativo: false }).eq("id", paulo.id).select("id");
    expect(peloProprio.data ?? []).toEqual([]);
    expect((await admin.from("perfis").select("ativo").eq("id", paulo.id).single()).data?.ativo).toBe(true);

    const peloAdmin = await lucas.cliente.from("perfis").update({ ativo: false }).eq("id", paulo.id).select("id");
    expect(peloAdmin.data).toHaveLength(1);
  });

  it("a Liderança lê a tabela de Professores ativos para escolher", async () => {
    const ensino = await comFuncoes("Líder do ensino", "lider", ["Líder do ensino"]);
    const paulo = await contaNova("Paulo", "professor");
    const lidos = await ensino.cliente.from("perfis").select("id").eq("nivel", "professor").eq("ativo", true).eq("id", paulo.id);
    expect(lidos.data?.map((p) => p.id)).toEqual([paulo.id]);
  });
});

describe("escolher Professor e Auxiliar na aula", () => {
  const novaAula = async (autor: Cliente, responsavel: string, campos: Record<string, string>) => {
    const ebd = await categoria("EBD");
    const porNome = Object.fromEntries(Object.entries(campos).map(([nome, valor]) => [ebd.campo(nome), valor]));
    return criar(autor, eventoDe(ebd.id, responsavel, { campos: { [ebd.campo("Tema")]: "Davi", ...porNome } }));
  };

  it("Professor e Auxiliar saem da tabela de Professores ou da Liderança", async () => {
    const ensino = await comFuncoes("Líder do ensino", "lider", ["Líder do ensino"]);
    const paulo = await contaNova("Paulo", "professor");
    const carol = await contaNova("Carol", "lider");

    expect((await novaAula(ensino.cliente, ensino.id, { Professor: paulo.id, Auxiliar: carol.id })).error).toBeNull();
    expect((await novaAula(ensino.cliente, ensino.id, { Professor: carol.id, Auxiliar: paulo.id })).error).toBeNull();
    expect((await novaAula(ensino.cliente, ensino.id, {})).error).toBeNull();
  });

  it("recusa Professor desativado, Pendente e quem não existe", async () => {
    const ensino = await comFuncoes("Líder do ensino", "lider", ["Líder do ensino"]);
    const saiu = await comFuncoes("Saiu", "professor", [], false);
    const novato = await contaNova("Novato");

    for (const id of [saiu.id, novato.id, crypto.randomUUID()]) {
      expect((await novaAula(ensino.cliente, ensino.id, { Professor: id })).error).not.toBeNull();
    }
  });

  it("uma aula sem Professor pode sair de Rascunho, ficando Planejada", async () => {
    const ensino = await comFuncoes("Líder do ensino", "lider", ["Líder do ensino"]);
    const id = await aula(ensino.id, null, null, { status: "rascunho", responsavel_id: null });
    expect(await editou(ensino.cliente, id, { status: "planejado", responsavel_id: ensino.id })).toBe(true);
    expect((await salvo(id)).campos).not.toHaveProperty("Professor");
  });
});

describe("o que o Professor vê", () => {
  it("lê só as aulas em que foi colocado como Professor ou Auxiliar, e concorda com o módulo de domínio", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const paulo = await contaNova("Paulo", "professor");
    const bia = await contaNova("Bia", "professor");
    const ebd = await categoria("EBD");
    const campos = (professor: string | null, auxiliar: string | null) => ({
      ...(professor ? { [ebd.campo("Professor")]: professor } : {}),
      ...(auxiliar ? { [ebd.campo("Auxiliar")]: auxiliar } : {}),
    });
    const definicoes = ["Tema", "Professor", "Auxiliar", "Link do material"].map((nome) => ({ id: ebd.campo(nome), nome, tipo: nome === "Professor" || nome === "Auxiliar" ? "pessoa" : "x" }));

    const comoProfessor = await aula(lucas.id, paulo.id);
    const comoAuxiliar = await aula(lucas.id, bia.id, paulo.id);
    const dosOutros = await aula(lucas.id, bia.id);
    const semNinguem = await aula(lucas.id, null);
    const culto = await categoria("Culto");
    const { data: umCulto } = await admin.from("eventos").insert({ ...eventoDe(culto.id, lucas.id), criado_por: lucas.id }).select("id").single().throwOnError();

    const visiveis = await ids(paulo.cliente, "eventos");
    expect(visiveis).toContain(comoProfessor);
    expect(visiveis).toContain(comoAuxiliar);
    for (const alheio of [dosOutros, semNinguem, umCulto.id]) expect(visiveis).not.toContain(alheio);

    // O mesmo critério do domínio, aula por aula.
    const casos = [
      { id: comoProfessor, campos: campos(paulo.id, null) },
      { id: comoAuxiliar, campos: campos(bia.id, paulo.id) },
      { id: dosOutros, campos: campos(bia.id, null) },
      { id: semNinguem, campos: campos(null, null) },
    ];
    for (const { id, campos: doEvento } of casos) {
      const esperado = podeVerEvento({ id: paulo.id, nivel: "professor", ativo: true }, { campos: doEvento, definicoes });
      expect(visiveis.includes(id), id).toBe(esperado);
    }
  });

  it("lê a Categoria, os campos e a Área das aulas dele, e nada mais do catálogo", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const paulo = await contaNova("Paulo", "professor");
    await aula(lucas.id, paulo.id);

    const categorias = await paulo.cliente.from("categorias").select("nome, areas(nome), campos_das_categorias(nome)");
    expect(categorias.data?.map((c) => c.nome)).toEqual(["EBD"]);
    expect(categorias.data?.[0].campos_das_categorias.map((c) => c.nome)).toEqual(expect.arrayContaining(["Tema", "Professor", "Auxiliar"]));
    expect((await paulo.cliente.from("areas").select("nome")).data).toEqual([{ nome: "Ensino" }]);
    expect((await paulo.cliente.from("funcoes").select("id")).data).toEqual([]);
  });

  it("não vê Adolescentes, aniversários, outras contas, séries nem o registro de alterações", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const paulo = await contaNova("Paulo", "professor");
    await admin.from("adolescentes").insert({ nome: "Davi", nascimento: "2010-03-04" }).throwOnError();
    await aula(lucas.id, paulo.id);

    expect(await ids(paulo.cliente, "adolescentes")).toEqual([]);
    expect(await ids(paulo.cliente, "series")).toEqual([]);
    expect(await ids(paulo.cliente, "convites")).toEqual([]);
    expect(await ids(paulo.cliente, "perfis")).toEqual([paulo.id]);
    expect((await paulo.cliente.from("alteracoes_dos_eventos").select("id")).data).toEqual([]);
  });

  it("descobre quem está na aula dele (nome e situação), mas não na dos outros", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const paulo = await contaNova("Paulo", "professor");
    const bia = await contaNova("Bia", "professor");
    const minha = await aula(lucas.id, paulo.id, bia.id);
    const alheia = await aula(lucas.id, bia.id);

    const nomes = await paulo.cliente.rpc("pessoas_da_aula", { evento: minha });
    expect((nomes.data as { nome: string }[]).map((p) => p.nome).sort()).toEqual(["Bia", "Lucas", "Paulo"]);
    expect((nomes.data as Record<string, unknown>[])[0]).not.toHaveProperty("email");
    expect((await paulo.cliente.rpc("pessoas_da_aula", { evento: alheia })).data).toEqual([]);
  });

  it("perde tudo ao ser desativado, e Pendente nunca lê aulas", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const paulo = await comFuncoes("Paulo", "professor", []);
    const novato = await contaNova("Novato");
    const id = await aula(lucas.id, paulo.id);
    expect(await ids(paulo.cliente, "eventos")).toContain(id);

    await admin.from("perfis").update({ ativo: false }).eq("id", paulo.id).throwOnError();
    expect(await ids(paulo.cliente, "eventos")).toEqual([]);
    expect(await ids(novato.cliente, "eventos")).toEqual([]);
  });
});

describe("o que o Professor edita", () => {
  it("edita as observações das aulas dele, como Professor e como Auxiliar", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const paulo = await contaNova("Paulo", "professor");
    const bia = await contaNova("Bia", "professor");
    const minha = await aula(lucas.id, paulo.id);
    const comoAuxiliar = await aula(lucas.id, bia.id, paulo.id);

    expect(await editou(paulo.cliente, minha, { observacoes: "Faltaram quatro." })).toBe(true);
    expect((await salvo(minha)).observacoes).toBe("Faltaram quatro.");
    expect(await editou(paulo.cliente, comoAuxiliar, { observacoes: "Levei o mapa." })).toBe(true);
    expect((await salvo(comoAuxiliar)).editado_por).toBe(paulo.id);
  });

  it("não muda Status, data, Responsável nem nenhum outro campo", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const carol = await contaNova("Carol", "lider");
    const paulo = await contaNova("Paulo", "professor");
    const id = await aula(lucas.id, paulo.id);
    const ebd = await categoria("EBD");
    const antes = await salvo(id);

    const tentativas: Record<string, unknown>[] = [
      { status: "confirmado" },
      { status: "cancelado" },
      { inicio: "2026-10-31T22:00:00Z", fim: "2026-11-01T00:00:00Z" },
      { responsavel_id: carol.id },
      { responsavel_id: null },
      { titulo: "Outro título" },
      { local: "Outro lugar" },
      { link: "https://exemplo.com" },
      { campos: { ...antes.campos, [ebd.campo("Tema")]: "Outro tema" } },
      { campos: { ...antes.campos, [ebd.campo("Professor")]: carol.id } },
      // Junto com uma observação válida, a mudança proibida derruba a edição inteira.
      { observacoes: "ok", status: "confirmado" },
    ];
    for (const mudanca of tentativas) {
      expect(await editou(paulo.cliente, id, mudanca), JSON.stringify(mudanca)).toBe(false);
    }
    const depois = await salvo(id);
    expect({ ...depois, observacoes: "", editado_em: null }).toEqual({ ...antes, observacoes: "", editado_em: null });
    expect(depois.observacoes).toBe("");
  });

  it("não edita aulas dos outros, nem Eventos que não são aula, e não cria nem exclui", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const paulo = await contaNova("Paulo", "professor");
    const bia = await contaNova("Bia", "professor");
    const alheia = await aula(lucas.id, bia.id);
    const minha = await aula(lucas.id, paulo.id);
    const culto = await categoria("Culto");
    const { data: umCulto } = await admin.from("eventos").insert({ ...eventoDe(culto.id, lucas.id), criado_por: lucas.id }).select("id").single().throwOnError();

    expect(await editou(paulo.cliente, alheia, { observacoes: "Intrometido" })).toBe(false);
    expect(await editou(paulo.cliente, umCulto.id, { observacoes: "Intrometido" })).toBe(false);
    expect((await criar(paulo.cliente, eventoDe(culto.id, paulo.id))).error).not.toBeNull();
    expect((await paulo.cliente.from("eventos").delete().eq("id", minha).select("id")).data).toEqual([]);
    expect(await salvo(minha)).not.toBeNull();
  });

  it("escreve as observações de uma aula já Realizada de uma Série, mas não muda mais nada", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const paulo = await contaNova("Paulo", "professor");
    const ebd = await categoria("EBD");
    const { data: serie } = await admin
      .from("series")
      .insert({ categoria_id: ebd.id, regra: { frequencia: "semanal" }, primeiro_dia: "2026-01-04", criado_por: lucas.id })
      .select("id")
      .single()
      .throwOnError();
    const id = await aula(lucas.id, paulo.id, null, {
      serie_id: serie.id,
      status: "confirmado",
      inicio: "2026-01-04T12:00:00Z",
      fim: "2026-01-04T14:00:00Z",
    });

    // Um Evento novo não nasce Realizado: o Confirmado que terminou passa a Realizado (pelo agendamento, simulado aqui).
    await admin.from("eventos").update({ status: "realizado" }).eq("id", id).throwOnError();

    expect(await editou(paulo.cliente, id, { observacoes: "Foi ótima." })).toBe(true);
    expect(await editou(paulo.cliente, id, { status: "planejado" })).toBe(false);
    expect((await salvo(id)).observacoes).toBe("Foi ótima.");
  });

  it("concorda com o módulo de domínio e deixa a Liderança editar como antes", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const paulo = await contaNova("Paulo", "professor");
    const ensino = await comFuncoes("Líder do ensino", "lider", ["Líder do ensino"]);
    const id = await aula(lucas.id, paulo.id);
    const ebd = await categoria("EBD");
    const doProfessor = { campos: { [ebd.campo("Professor")]: paulo.id }, definicoes: [{ id: ebd.campo("Professor"), nome: "Professor", tipo: "pessoa" }] };

    expect(await editou(paulo.cliente, id, { observacoes: "Anotação" })).toBe(
      podeEditarSoAsObservacoes({ id: paulo.id, nivel: "professor", ativo: true }, doProfessor),
    );
    expect(await editou(ensino.cliente, id, { titulo: "Título novo", status: "confirmado" })).toBe(true);
    expect((await salvo(id)).titulo).toBe("Título novo");
  });
});
