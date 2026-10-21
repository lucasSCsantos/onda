import { describe, expect, it } from "vitest";
import { CATALOGO_INICIAL } from "@/dominio/catalogo";
import { podeEditarEvento, podeExcluirEvento, statusNoMomento, type Status } from "@/dominio/eventos";
import { admin, categoria, comFuncoes, contaNova, eventoDe, type Cliente } from "./ambiente";

const HORA_MS = 60 * 60 * 1000;
const daqui = (horas: number) => new Date(Date.now() + horas * HORA_MS).toISOString();

/** Grava um Evento direto pelo banco, como se `criador` o tivesse criado, e devolve o id. */
async function gravar(criador: string, evento: ReturnType<typeof eventoDe>) {
  const { data } = await admin.from("eventos").insert({ ...evento, criado_por: criador }).select("id").single().throwOnError();
  return data.id as string;
}

async function salvo(id: string) {
  const { data } = await admin.from("eventos").select("*").eq("id", id).maybeSingle().throwOnError();
  return data;
}

/** Edita e diz se o banco aceitou: uma linha fora da política some do resultado, sem erro. */
async function editou(cliente: Cliente, id: string, mudancas: Record<string, unknown>) {
  const { data, error } = await cliente.from("eventos").update(mudancas).eq("id", id).select("id");
  return error === null && data.length === 1;
}

const areaDa = (f: string) => CATALOGO_INICIAL.funcoes.find((x) => x.nome === f)!.area;

describe("editar Evento", () => {
  it("o banco concorda com o módulo de domínio sobre quem edita", async () => {
    const beythel = await comFuncoes("Beythel", "lider", ["Líder do louvor"]);
    const pessoas = [
      await comFuncoes("Admin sem Função", "admin", []),
      await comFuncoes("Mariana", "lider", ["Líder de integração e programação"]),
      await comFuncoes("Carol Leal", "lider", ["Co-líder do ministério"]),
      await comFuncoes("Carol França", "lider", ["Líder de comunicação e mídia"]),
      beythel,
      await comFuncoes("Paulo", "professor", []),
      await comFuncoes("Novato", "pendente", []),
      await comFuncoes("Saiu", "lider", ["Líder do ministério"], false),
    ];
    const culto = await categoria("Culto");

    for (const quem of pessoas) {
      const id = await gravar(beythel.id, eventoDe(culto.id, beythel.id));
      const esperado = podeEditarEvento(quem.pessoa, quem.funcoes.map(areaDa), { categoria: culto, responsavel: beythel.id });
      const nome = quem.funcoes.join(" + ") || quem.pessoa.nivel;
      expect(await editou(quem.cliente, id, { titulo: "Mudado", status: "confirmado" }), `${nome} edita`).toBe(esperado);
      expect((await salvo(id))!.titulo, nome).toBe(esperado ? "Mudado" : "Evento de teste");
    }
  });

  it("o Responsável edita mesmo sem Função na Área, e pode passar o Evento a outra pessoa", async () => {
    const beythel = await comFuncoes("Beythel", "lider", ["Líder do louvor"]);
    const mariana = await comFuncoes("Mariana", "lider", ["Líder de integração e programação"]);
    const culto = await categoria("Culto");
    const id = await gravar(mariana.id, eventoDe(culto.id, beythel.id));

    expect(await editou(beythel.cliente, id, { responsavel_id: mariana.id })).toBe(true);
    expect(await editou(beythel.cliente, id, { titulo: "Já não é meu" })).toBe(false);
  });

  it("guarda quem editou por último e quando, sem deixar forjar", async () => {
    const mariana = await comFuncoes("Mariana", "lider", ["Líder de integração e programação"]);
    const denize = await comFuncoes("Denize", "lider", ["Co-líder de integração e programação"]);
    const culto = await categoria("Culto");
    const id = await gravar(mariana.id, eventoDe(culto.id, mariana.id));
    expect((await salvo(id))!.editado_por).toBeNull();

    expect(await editou(denize.cliente, id, { local: "Salão" })).toBe(true);
    const depois = await salvo(id);
    expect(depois!.editado_por).toBe(denize.id);
    expect(Date.now() - new Date(depois!.editado_em).getTime()).toBeLessThan(60_000);
    expect(await editou(denize.cliente, id, { editado_por: mariana.id })).toBe(false);
  });

  it("a Categoria e quem criou não mudam", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const culto = await categoria("Culto");
    const servico = await categoria("Serviço");
    const id = await gravar(lucas.id, eventoDe(culto.id, lucas.id));

    expect(await editou(lucas.cliente, id, { categoria_id: servico.id })).toBe(false);
    expect(await editou(lucas.cliente, id, { criado_por: crypto.randomUUID() })).toBe(false);
  });

  it("confere o Responsável e os campos como na criação", async () => {
    const carol = await comFuncoes("Carol França", "lider", ["Líder de comunicação e mídia"]);
    const paulo = await contaNova("Paulo", "professor");
    const postagem = await categoria("Postagem");
    const plataforma = postagem.campo("Plataforma");
    const id = await gravar(carol.id, eventoDe(postagem.id, carol.id, { campos: { [plataforma]: "Instagram" } }));

    expect(await editou(carol.cliente, id, { responsavel_id: null })).toBe(false);
    expect(await editou(carol.cliente, id, { responsavel_id: paulo.id })).toBe(false);
    expect(await editou(carol.cliente, id, { campos: { [plataforma]: "TikTok" } })).toBe(false);
    expect(await editou(carol.cliente, id, { campos: {} })).toBe(false);
    expect(await editou(carol.cliente, id, { campos: { [plataforma]: "Instagram", [crypto.randomUUID()]: "intruso" } })).toBe(false);
    expect(await editou(carol.cliente, id, { campos: { [plataforma]: "YouTube" } })).toBe(true);
  });

  it("um Responsável desativado pode ficar, mas ninguém escolhe um desativado", async () => {
    const mariana = await comFuncoes("Mariana", "lider", ["Líder de integração e programação"]);
    const saiu = await comFuncoes("Saiu", "lider", ["Co-líder de integração e programação"]);
    const culto = await categoria("Culto");
    const deQuemSaiu = await gravar(mariana.id, eventoDe(culto.id, saiu.id));
    const outro = await gravar(mariana.id, eventoDe(culto.id, mariana.id));
    await admin.from("perfis").update({ ativo: false }).eq("id", saiu.id).throwOnError();

    expect(await editou(mariana.cliente, deQuemSaiu, { titulo: "Mudado" })).toBe(true);
    expect(await editou(mariana.cliente, outro, { responsavel_id: saiu.id })).toBe(false);
  });
});

describe("Status", () => {
  it("muda livremente entre Rascunho, Planejado, Confirmado, Cancelado e Adiado", async () => {
    const mariana = await comFuncoes("Mariana", "lider", ["Líder de integração e programação"]);
    const culto = await categoria("Culto");
    const id = await gravar(mariana.id, eventoDe(culto.id, mariana.id, { inicio: daqui(48), fim: null }));

    for (const status of ["adiado", "rascunho", "confirmado", "cancelado", "planejado", "adiado", "confirmado"]) {
      expect(await editou(mariana.cliente, id, { status }), status).toBe(true);
    }
  });

  it("Realizado manual só para o Admin e o Responsável, depois do fim", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const beythel = await comFuncoes("Beythel", "lider", ["Líder do louvor"]);
    const mariana = await comFuncoes("Mariana", "lider", ["Líder de integração e programação"]);
    const culto = await categoria("Culto");
    const passado = { inicio: daqui(-3), fim: daqui(-1) };
    const futuro = { inicio: daqui(1), fim: daqui(3) };
    const novo = async (periodo: Record<string, unknown>) => gravar(mariana.id, eventoDe(culto.id, beythel.id, periodo));

    expect(await editou(beythel.cliente, await novo(futuro), { status: "realizado" })).toBe(false);
    expect(await editou(lucas.cliente, await novo(futuro), { status: "realizado" })).toBe(false);
    expect(await editou(mariana.cliente, await novo(passado), { status: "realizado" })).toBe(false);
    expect(await editou(beythel.cliente, await novo(passado), { status: "realizado" })).toBe(true);
    expect(await editou(lucas.cliente, await novo(passado), { status: "realizado" })).toBe(true);
  });

  it("quem se põe como Responsável não marca Realizado na mesma edição", async () => {
    const beythel = await comFuncoes("Beythel", "lider", ["Líder do louvor"]);
    const mariana = await comFuncoes("Mariana", "lider", ["Líder de integração e programação"]);
    const culto = await categoria("Culto");
    const id = await gravar(mariana.id, eventoDe(culto.id, beythel.id, { inicio: daqui(-3), fim: daqui(-1) }));

    expect(await editou(mariana.cliente, id, { responsavel_id: mariana.id, status: "realizado" })).toBe(false);
  });

  it("um Realizado segue Realizado quando outra pessoa edita outro campo, e pode voltar a outro Status", async () => {
    const beythel = await comFuncoes("Beythel", "lider", ["Líder do louvor"]);
    const mariana = await comFuncoes("Mariana", "lider", ["Líder de integração e programação"]);
    const culto = await categoria("Culto");
    const id = await gravar(mariana.id, eventoDe(culto.id, beythel.id, { inicio: daqui(-3), fim: daqui(-1) }));
    expect(await editou(beythel.cliente, id, { status: "realizado" })).toBe(true);

    expect(await editou(mariana.cliente, id, { observacoes: "Foi ótimo" })).toBe(true);
    expect((await salvo(id))!.status).toBe("realizado");
    expect(await editou(mariana.cliente, id, { status: "cancelado" })).toBe(true);
  });

  it("um Confirmado que terminou já é Realizado, mesmo antes da transição automática", async () => {
    const beythel = await comFuncoes("Beythel", "lider", ["Líder do louvor"]);
    const mariana = await comFuncoes("Mariana", "lider", ["Líder de integração e programação"]);
    const culto = await categoria("Culto");
    const id = await gravar(mariana.id, eventoDe(culto.id, beythel.id, { status: "confirmado", inicio: daqui(-3), fim: daqui(-1) }));

    expect(await editou(mariana.cliente, id, { status: "realizado", observacoes: "Foi ótimo" })).toBe(true);
  });

  it("nenhum Evento fica Realizado antes do fim, nem levado para depois de agora", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const culto = await categoria("Culto");
    const id = await gravar(lucas.id, eventoDe(culto.id, lucas.id, { inicio: daqui(-3), fim: daqui(-1) }));
    expect(await editou(lucas.cliente, id, { status: "realizado" })).toBe(true);

    expect(await editou(lucas.cliente, id, { inicio: daqui(1), fim: daqui(3) })).toBe(false);
  });

  it("Confirmado vira Realizado sozinho depois do fim, com e sem horário de fim, como no módulo de domínio", async () => {
    const mariana = await comFuncoes("Mariana", "lider", ["Líder de integração e programação"]);
    const culto = await categoria("Culto");
    const ontem = new Date(Date.now() - 24 * HORA_MS);
    const meiaNoiteDeOntem = new Date(`${ontem.toLocaleDateString("en-CA", { timeZone: "America/Bahia" })}T00:00:00-03:00`);
    const casos: { status: Status; inicio: string; fim: string | null; dia_inteiro?: boolean }[] = [
      { status: "confirmado", inicio: daqui(-3), fim: daqui(-1) },
      { status: "confirmado", inicio: daqui(-3), fim: daqui(1) },
      { status: "confirmado", inicio: daqui(-30), fim: null },
      { status: "confirmado", inicio: meiaNoiteDeOntem.toISOString(), fim: null, dia_inteiro: true },
      { status: "confirmado", inicio: daqui(2), fim: null },
      { status: "planejado", inicio: daqui(-30), fim: daqui(-29) },
      { status: "rascunho", inicio: daqui(-30), fim: null },
      { status: "adiado", inicio: daqui(-30), fim: null },
    ];
    const ids = [];
    for (const caso of casos) ids.push(await gravar(mariana.id, eventoDe(culto.id, mariana.id, caso)));

    await admin.rpc("realizar_confirmados").throwOnError();
    const agora = new Date();
    for (const [i, caso] of casos.entries()) {
      const depois = await salvo(ids[i]);
      const esperado = statusNoMomento({ status: caso.status, inicio: new Date(caso.inicio), fim: caso.fim ? new Date(caso.fim) : null, diaInteiro: !!caso.dia_inteiro }, agora);
      expect(depois!.status, JSON.stringify(caso)).toBe(esperado);
    }
    expect((await salvo(ids[0]))!.status).toBe("realizado");
    expect((await salvo(ids[0]))!.editado_por).toBeNull();
  });

  it("só o próprio Mural roda a transição automática", async () => {
    const lucas = await contaNova("Lucas", "admin");
    expect((await lucas.cliente.rpc("realizar_confirmados")).error).not.toBeNull();
  });

  it("remarcar um Adiado volta o Evento a Planejado; editar outro campo o mantém Adiado", async () => {
    const mariana = await comFuncoes("Mariana", "lider", ["Líder de integração e programação"]);
    const culto = await categoria("Culto");
    const id = await gravar(mariana.id, eventoDe(culto.id, mariana.id, { status: "adiado" }));

    expect(await editou(mariana.cliente, id, { local: "Salão" })).toBe(true);
    expect((await salvo(id))!.status).toBe("adiado");
    expect(await editou(mariana.cliente, id, { inicio: "2026-11-07T22:00:00Z", fim: "2026-11-08T00:00:00Z" })).toBe(true);
    expect((await salvo(id))!.status).toBe("planejado");
  });
});

describe("excluir Evento", () => {
  it("só o Admin exclui, como no módulo de domínio", async () => {
    const pessoas = [
      await comFuncoes("Lucas", "admin", []),
      await comFuncoes("Mariana", "lider", ["Líder de integração e programação"]),
      await comFuncoes("Carol Leal", "lider", ["Co-líder do ministério"]),
      await comFuncoes("Paulo", "professor", []),
    ];
    const culto = await categoria("Culto");

    for (const quem of pessoas) {
      const id = await gravar(pessoas[1].id, eventoDe(culto.id, quem.pessoa.nivel === "professor" ? pessoas[1].id : quem.id));
      await quem.cliente.from("eventos").delete().eq("id", id);
      expect((await salvo(id)) === null, quem.pessoa.nivel).toBe(podeExcluirEvento(quem.pessoa));
    }
  });
});

describe("registro de alterações", () => {
  async function registro(cliente: Cliente | typeof admin, evento: string) {
    const { data } = await cliente.from("alteracoes_dos_eventos").select("*").eq("evento_id", evento).order("id");
    return data ?? [];
  }

  it("grava a criação, cada edição e a exclusão, com quem, quando e o que mudou", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const mariana = await comFuncoes("Mariana", "lider", ["Líder de integração e programação"]);
    const culto = await categoria("Culto");
    const { data } = await mariana.cliente.from("eventos").insert(eventoDe(culto.id, mariana.id)).select("id").single().throwOnError();

    expect(await editou(mariana.cliente, data.id, { titulo: "Culto de primavera", local: "Salão" })).toBe(true);
    expect(await editou(mariana.cliente, data.id, { titulo: "Culto de primavera" })).toBe(true);
    await lucas.cliente.from("eventos").delete().eq("id", data.id).throwOnError();

    const linhas = await registro(lucas.cliente, data.id);
    expect(linhas.map((l) => [l.operacao, l.feito_por])).toEqual([
      ["criacao", mariana.id],
      ["edicao", mariana.id],
      ["exclusao", lucas.id],
    ]);
    expect(linhas[0].mudancas.titulo).toEqual({ antes: null, depois: "Evento de teste" });
    expect(linhas[1].mudancas).toEqual({
      titulo: { antes: "Evento de teste", depois: "Culto de primavera" },
      local: { antes: "Templo", depois: "Salão" },
    });
    expect(linhas[2].mudancas.titulo).toEqual({ antes: "Culto de primavera", depois: null });
    for (const l of linhas) expect(Date.now() - new Date(l.feito_em).getTime()).toBeLessThan(60_000);
  });

  it("grava o Realizado automático como feito pelo Mural", async () => {
    const mariana = await comFuncoes("Mariana", "lider", ["Líder de integração e programação"]);
    const culto = await categoria("Culto");
    const id = await gravar(mariana.id, eventoDe(culto.id, mariana.id, { status: "confirmado", inicio: daqui(-3), fim: daqui(-1) }));

    await admin.rpc("realizar_confirmados").throwOnError();
    expect((await registro(admin, id)).at(-1)).toMatchObject({
      operacao: "edicao",
      feito_por: null,
      mudancas: { status: { antes: "confirmado", depois: "realizado" } },
    });
  });

  it("só o Admin lê, e ninguém escreve no registro", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const mariana = await comFuncoes("Mariana", "lider", ["Líder de integração e programação"]);
    const culto = await categoria("Culto");
    const { data } = await mariana.cliente.from("eventos").insert(eventoDe(culto.id, mariana.id)).select("id").single().throwOnError();

    expect(await registro(mariana.cliente, data.id)).toEqual([]);
    expect(await registro(lucas.cliente, data.id)).toHaveLength(1);
    for (const quem of [lucas.cliente, mariana.cliente]) {
      const tabela = () => quem.from("alteracoes_dos_eventos");
      expect((await tabela().insert({ evento_id: data.id, operacao: "edicao", mudancas: {} })).error).not.toBeNull();
      await tabela().update({ mudancas: {} }).eq("evento_id", data.id);
      await tabela().delete().eq("evento_id", data.id);
    }
    expect((await registro(admin, data.id))[0].mudancas).not.toEqual({});
  });
});
