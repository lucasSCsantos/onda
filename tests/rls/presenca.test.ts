import { describe, expect, it } from "vitest";
import { admin, anonimo, cadastrar, categoria, comFuncoes, contaNova, eventoDe, type Cliente } from "./ambiente";

const ENSINO = "Líder do ensino";
const DIA_MS = 24 * 60 * 60 * 1000;

/** `AAAA-MM-DD` de hoje (ou de `dias` depois) no fuso do Mural. */
const diaLocal = (dias = 0) => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Bahia" }).format(new Date(Date.now() + dias * DIA_MS));

/** Uma aula de EBD num dia (hoje, por padrão), gravada direto no banco. */
async function aula(dias = 0, mudancas: Record<string, unknown> = {}, nomeDaCategoria = "EBD") {
  const lucas = await contaNova("Lucas", "admin");
  const cat = await categoria(nomeDaCategoria);
  const campos = nomeDaCategoria === "EBD" ? { [cat.campo("Tema")]: "Semeador" } : {};
  const { data } = await admin
    .from("eventos")
    .insert({ ...eventoDe(cat.id, lucas.id, { inicio: `${diaLocal(dias)}T00:01:00-03:00`, fim: null, campos, ...mudancas }), criado_por: lucas.id })
    .select("id")
    .single()
    .throwOnError();
  return data.id as string;
}

async function adolescente(nome = "Ana", ativo = true) {
  const { data } = await admin.from("adolescentes").insert({ nome, nascimento: "2011-05-10", ativo }).select("id").single().throwOnError();
  return data.id as string;
}

async function marcacoes() {
  const { data } = await admin.from("marcacoes").select("id, nome").throwOnError();
  const id = (nome: string) => data.find((m) => m.nome === nome)!.id as string;
  return { presente: id("Presente"), biblia: id("Trouxe bíblia"), visitante: id("Trouxe visitante"), atividade: id("Fez atividade") };
}

/** As Marcações gravadas de um Adolescente numa aula, pelo nome, e o nome do visitante. */
async function gravadas(evento: string, aluno: string) {
  const { data } = await admin
    .from("presencas")
    .select("registrado_por, editado_por, editado_em, marcacoes_das_presencas(visitante, marcacoes(nome))")
    .eq("evento_id", evento)
    .eq("adolescente_id", aluno)
    .maybeSingle()
    .throwOnError();
  if (!data) return null;
  const linhas = data.marcacoes_das_presencas as unknown as { visitante: string | null; marcacoes: { nome: string } }[];
  return {
    ...data,
    nomes: linhas.map((l) => l.marcacoes.nome).sort(),
    visitante: linhas.find((l) => l.visitante)?.visitante ?? null,
  };
}

const salvar = (quem: Cliente, evento: string, aluno: string, ids: string[], visitante: string | null = null) =>
  quem.rpc("salvar_presenca", { evento, adolescente: aluno, marcacoes: ids, visitante });

async function logsDe(evento: string) {
  const { data } = await admin.from("logs").select("acao, usuario_id, detalhes").eq("objeto_id", evento).like("acao", "presenca.%").order("id").throwOnError();
  return data;
}

describe("quem faz a Chamada", () => {
  it("o Admin e quem tem Função em Ensino ou Geral registram; os demais não", async () => {
    const evento = await aula();
    const m = await marcacoes();
    const podem = [
      await contaNova("Admin sem Função", "admin"),
      await comFuncoes("Ensino", "lider", [ENSINO]),
      await comFuncoes("Geral", "lider", ["Co-líder do ministério"]),
    ];
    const naoPodem = [
      (await comFuncoes("Louvor", "lider", ["Líder do louvor"])).cliente,
      (await contaNova("Paulo", "professor")).cliente,
      (await cadastrar("Novato")).cliente,
      (await comFuncoes("Saiu", "lider", [ENSINO], false)).cliente,
      anonimo(),
    ];

    for (const [i, quem] of podem.entries()) {
      const aluno = await adolescente(`Pode ${i}`);
      expect((await salvar(quem.cliente, evento, aluno, [m.presente])).error).toBeNull();
      expect((await gravadas(evento, aluno))!.registrado_por).toBe(quem.id);
    }
    const alvo = await adolescente("Alvo");
    for (const quem of naoPodem) {
      expect((await salvar(quem, evento, alvo, [m.presente])).error).not.toBeNull();
    }
    expect(await gravadas(evento, alvo)).toBeNull();
  });

  it("não há Chamada em aula de outro dia que ainda não chegou, Cancelada ou de Categoria sem chamada", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const m = await marcacoes();
    const aluno = await adolescente();
    for (const evento of [await aula(1), await aula(0, { status: "cancelado" }), await aula(0, {}, "Culto")]) {
      expect((await salvar(lucas.cliente, evento, aluno, [m.presente])).error?.code).toBe("42501");
    }
  });

  it("ninguém escreve direto nas tabelas, nem o Admin", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const evento = await aula();
    const aluno = await adolescente();
    expect((await lucas.cliente.from("presencas").insert({ evento_id: evento, adolescente_id: aluno, registrado_por: lucas.id })).error).not.toBeNull();
    await salvar(lucas.cliente, evento, aluno, [(await marcacoes()).presente]).throwOnError();
    const { data } = await admin.from("presencas").select("id").eq("evento_id", evento).single().throwOnError();
    expect((await lucas.cliente.from("marcacoes_das_presencas").delete().eq("presenca_id", data.id).select("presenca_id")).data ?? []).toEqual([]);
    expect((await lucas.cliente.from("presencas").delete().eq("id", data.id).select("id")).data ?? []).toEqual([]);
  });
});

describe("as Marcações de uma presença", () => {
  it("marcar outra marca também a presença; o visitante só vai com a Marcação dele", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const evento = await aula();
    const aluno = await adolescente();
    const m = await marcacoes();

    await salvar(lucas.cliente, evento, aluno, [m.biblia, m.visitante], "  Rafa ").throwOnError();
    expect(await gravadas(evento, aluno)).toMatchObject({ nomes: ["Presente", "Trouxe bíblia", "Trouxe visitante"], visitante: "Rafa" });

    expect((await salvar(lucas.cliente, evento, aluno, [m.biblia], "Rafa")).error).not.toBeNull();

    await salvar(lucas.cliente, evento, aluno, []).throwOnError();
    expect(await gravadas(evento, aluno)).toMatchObject({ nomes: [] });
  });

  it("recusa Adolescente inativo e Marcação desativada, e mantém a desativada que já estava", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const evento = await aula();
    const m = await marcacoes();
    expect((await salvar(lucas.cliente, evento, await adolescente("Inativo", false), [m.presente])).error).not.toBeNull();

    const { data: extra } = await admin.from("marcacoes").insert({ nome: `Extra ${crypto.randomUUID().slice(0, 6)}`, pontos: 5 }).select("id, nome").single().throwOnError();
    const aluno = await adolescente();
    await salvar(lucas.cliente, evento, aluno, [m.presente, extra.id]).throwOnError();
    await admin.from("marcacoes").update({ ativa: false }).eq("id", extra.id).throwOnError();

    expect((await salvar(lucas.cliente, evento, aluno, [extra.id])).error).not.toBeNull();
    await salvar(lucas.cliente, evento, aluno, [m.presente, m.biblia]).throwOnError();
    expect((await gravadas(evento, aluno))!.nomes).toEqual([extra.nome, "Presente", "Trouxe bíblia"].sort());
  });
});

describe("correção e logs da Chamada", () => {
  it("no dia da aula, um log de Chamada registrada por pessoa, sem um por toque", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const carol = await comFuncoes("Carol", "lider", [ENSINO]);
    const evento = await aula();
    const m = await marcacoes();
    for (const nome of ["Ana", "Bia", "Caio"]) await salvar(lucas.cliente, evento, await adolescente(nome), [m.presente]).throwOnError();
    await salvar(carol.cliente, evento, await adolescente("Davi"), [m.presente, m.biblia]).throwOnError();

    expect(await logsDe(evento)).toMatchObject([
      { acao: "presenca.chamada_registrada", usuario_id: lucas.id },
      { acao: "presenca.chamada_registrada", usuario_id: carol.id },
    ]);
  });

  it("depois do dia, cada correção guarda quem e quando, e vira log com o Adolescente e o que mudou", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const carol = await comFuncoes("Carol", "lider", [ENSINO]);
    const evento = await aula(-7);
    const m = await marcacoes();
    const aluno = await adolescente("Ana Corrigida");

    await salvar(lucas.cliente, evento, aluno, [m.presente]).throwOnError();
    await salvar(carol.cliente, evento, aluno, [m.presente, m.atividade]).throwOnError();

    const presenca = await gravadas(evento, aluno);
    expect(presenca).toMatchObject({ registrado_por: lucas.id, editado_por: carol.id });
    expect(Date.now() - Date.parse(presenca!.editado_em!)).toBeLessThan(60_000);

    const logs = await logsDe(evento);
    expect(logs.map((l) => l.acao)).toEqual(["presenca.chamada_corrigida", "presenca.chamada_corrigida"]);
    expect(logs[1]).toMatchObject({
      usuario_id: carol.id,
      detalhes: { adolescente: "Ana Corrigida", mudancas: [{ rotulo: "Ana Corrigida", tipo: "lista", antes: ["Presente"], depois: ["Presente", "Fez atividade"] }] },
    });
    expect(JSON.stringify(logs)).not.toContain("2011-05-10");
  });

  it("o nome do visitante não vai para o log", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const evento = await aula(-7);
    const m = await marcacoes();
    await salvar(lucas.cliente, evento, await adolescente(), [m.visitante], "Visitante Secreto").throwOnError();
    expect(JSON.stringify(await logsDe(evento))).not.toContain("Visitante Secreto");
  });

  it("uma aula com Chamada não pode ser excluída; sem Chamada, pode", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const comChamada = await aula();
    await salvar(lucas.cliente, comChamada, await adolescente(), [(await marcacoes()).presente]).throwOnError();
    expect((await lucas.cliente.from("eventos").delete().eq("id", comChamada)).error?.code).toBe("23503");
    const semChamada = await aula();
    expect((await lucas.cliente.from("eventos").delete().eq("id", semChamada).select("id")).data).toHaveLength(1);
  });
});

describe("quem lê a presença", () => {
  it("a Liderança lê; Professor, Pendente, desativado e anônimo não", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const evento = await aula();
    await salvar(lucas.cliente, evento, await adolescente(), [(await marcacoes()).presente]).throwOnError();

    const lider = await comFuncoes("Carol", "lider", ["Líder do louvor"]);
    expect((await lider.cliente.from("presencas").select("id").eq("evento_id", evento)).data).toHaveLength(1);
    for (const quem of [(await contaNova("Paulo", "professor")).cliente, (await cadastrar("Novato")).cliente, (await comFuncoes("Saiu", "lider", [ENSINO], false)).cliente, anonimo()]) {
      expect((await quem.from("presencas").select("id").eq("evento_id", evento)).data ?? []).toEqual([]);
      expect((await quem.from("marcacoes_das_presencas").select("presenca_id")).data ?? []).toEqual([]);
    }
  });
});

describe("cadastro de Marcações", () => {
  it("vem com as quatro iniciais", async () => {
    const { data } = await admin.from("marcacoes").select("nome, pontos, conta_presenca, pede_visitante").in("nome", ["Presente", "Trouxe bíblia", "Trouxe visitante", "Fez atividade"]).order("ordem").throwOnError();
    expect(data).toEqual([
      { nome: "Presente", pontos: 1, conta_presenca: true, pede_visitante: false },
      { nome: "Trouxe bíblia", pontos: 1, conta_presenca: false, pede_visitante: false },
      { nome: "Trouxe visitante", pontos: 3, conta_presenca: false, pede_visitante: true },
      { nome: "Fez atividade", pontos: 2, conta_presenca: false, pede_visitante: false },
    ]);
  });

  it("só o Admin cria e edita; ninguém apaga; tudo vira log", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const lider = await comFuncoes("Carol", "lider", [ENSINO]);
    const nome = `Cantou ${crypto.randomUUID().slice(0, 6)}`;

    expect((await lider.cliente.from("marcacoes").insert({ nome, icone: "music" })).error).not.toBeNull();
    const { data } = await lucas.cliente.from("marcacoes").insert({ nome, icone: "music", pontos: 2 }).select("id").single().throwOnError();
    expect((await lider.cliente.from("marcacoes").update({ pontos: 50 }).eq("id", data.id).select("id")).data ?? []).toEqual([]);
    await lucas.cliente.from("marcacoes").update({ pontos: 4, icone: "star" }).eq("id", data.id).throwOnError();
    await lucas.cliente.from("marcacoes").update({ ativa: false }).eq("id", data.id).throwOnError();
    await lucas.cliente.from("marcacoes").delete().eq("id", data.id);
    expect((await admin.from("marcacoes").select("id").eq("id", data.id)).data).toHaveLength(1);

    const { data: logs } = await admin.from("logs").select("acao, usuario_id, detalhes").eq("objeto_id", data.id).order("id").throwOnError();
    expect(logs.map((l) => l.acao)).toEqual(["marcacao.criada", "ranking.pontuacao_alterada", "marcacao.editada", "marcacao.desativada"]);
    expect(logs[1]).toMatchObject({ usuario_id: lucas.id, detalhes: { antes: 2, depois: 4 } });
  });

  it("só uma Marcação conta presença, e o ícone vem da lista", async () => {
    const lucas = await contaNova("Lucas", "admin");
    expect((await lucas.cliente.from("marcacoes").insert({ nome: `Outra ${crypto.randomUUID().slice(0, 6)}`, conta_presenca: true })).error).not.toBeNull();
    expect((await lucas.cliente.from("marcacoes").insert({ nome: `Foguete ${crypto.randomUUID().slice(0, 6)}`, icone: "rocket" })).error).not.toBeNull();
  });
});
