import { describe, expect, it } from "vitest";
import { classificar, type PontosDaMarcacao } from "@/dominio/ranking";
import { admin, anonimo, cadastrar, categoria, comFuncoes, contaNova, eventoDe } from "./ambiente";

/** Um ano só deste teste, para não somar com as presenças dos outros. */
const anoDoTeste = () => 2100 + Math.floor(Math.random() * 800);

async function marcacoes() {
  const { data } = await admin.from("marcacoes").select("id, nome").throwOnError();
  const id = (nome: string) => data.find((m) => m.nome === nome)!.id as string;
  return { presente: id("Presente"), biblia: id("Trouxe bíblia"), visitante: id("Trouxe visitante"), atividade: id("Fez atividade") };
}

/**
 * Uma aula de EBD no instante dado, com presenças gravadas direto no banco (a Chamada de verdade só vale a partir do dia
 * da aula, e aqui as aulas são de outros anos).
 */
async function aulaCom(inicio: string, presencas: { adolescente: string; marcacoes: string[] }[], mudancas: Record<string, unknown> = {}) {
  const lucas = await contaNova("Lucas", "admin");
  const ebd = await categoria("EBD");
  const { data: aula } = await admin
    .from("eventos")
    .insert({ ...eventoDe(ebd.id, lucas.id, { inicio, fim: null, campos: { [ebd.campo("Tema")]: "Tema" }, ...mudancas }), criado_por: lucas.id })
    .select("id")
    .single()
    .throwOnError();
  for (const p of presencas) {
    const { data } = await admin
      .from("presencas")
      .insert({ evento_id: aula.id, adolescente_id: p.adolescente, registrado_por: lucas.id })
      .select("id")
      .single()
      .throwOnError();
    await admin.from("marcacoes_das_presencas").insert(p.marcacoes.map((m) => ({ presenca_id: data.id, marcacao_id: m }))).throwOnError();
  }
  return aula.id as string;
}

async function adolescente(nome: string) {
  const { data } = await admin.from("adolescentes").insert({ nome, nascimento: "2011-05-10", genero: "feminino" }).select("id").single().throwOnError();
  return data.id as string;
}

/** `pontos_do_ano` no formato do domínio, só dos Adolescentes dados. */
async function pontos(cliente: typeof admin, ano: number, de: string[]): Promise<PontosDaMarcacao[]> {
  const { data } = await cliente.rpc("pontos_do_ano", { ano }).throwOnError();
  return (data as { adolescente_id: string; nome: string; ativo: boolean; marcacao_id: string; quantas: number; pontos: number }[])
    .filter((l) => de.includes(l.adolescente_id))
    .map((l) => ({ adolescente: l.adolescente_id, nome: l.nome, ativo: l.ativo, marcacao: l.marcacao_id, quantas: l.quantas, pontos: l.pontos }));
}

describe("pontos do ano", () => {
  it("soma as Marcações do ano com os pontos de cada uma, e o domínio classifica com o desempate", async () => {
    const ano = anoDoTeste();
    const m = await marcacoes();
    const ana = await adolescente("Ana");
    const bia = await adolescente("Bia");
    await aulaCom(`${ano}-03-01T12:00:00Z`, [
      { adolescente: ana, marcacoes: [m.presente, m.visitante] },
      { adolescente: bia, marcacoes: [m.presente, m.biblia, m.atividade] },
    ]);
    await aulaCom(`${ano}-03-08T12:00:00Z`, [{ adolescente: bia, marcacoes: [m.presente] }]);

    const lider = await comFuncoes("Carol", "lider", ["Líder do louvor"]);
    const linhas = await pontos(lider.cliente, ano, [ana, bia]);
    // Ana: 1 + 3 = 4. Bia: 2 presenças (2) + bíblia (1) + atividade (2) = 5.
    expect(classificar(linhas, m.presente).map((r) => [r.adolescente.nome, r.pontos, r.desempate])).toEqual([
      ["Bia", 5, 2],
      ["Ana", 4, 1],
    ]);
  });

  it("o ano é o do fuso do Mural, e aulas Canceladas não contam", async () => {
    const ano = anoDoTeste();
    const m = await marcacoes();
    const ana = await adolescente("Ana");
    // 31/12 às 23h em Salvador já é 1º/01 em UTC, mas conta no ano que termina.
    await aulaCom(`${ano}-12-31T23:00:00-03:00`, [{ adolescente: ana, marcacoes: [m.presente] }]);
    await aulaCom(`${ano}-06-01T12:00:00Z`, [{ adolescente: ana, marcacoes: [m.presente, m.visitante] }], { status: "cancelado" });

    expect(await pontos(admin, ano, [ana])).toEqual([expect.objectContaining({ marcacao: m.presente, quantas: 1, pontos: 1 })]);
    expect(await pontos(admin, ano + 1, [ana])).toEqual([]);
  });

  it("mudar os pontos de uma Marcação vale também para o passado; o histórico não muda", async () => {
    const ano = anoDoTeste();
    const lucas = await contaNova("Lucas", "admin");
    const ana = await adolescente("Ana");
    const { data: extra } = await admin.from("marcacoes").insert({ nome: `Louvou ${crypto.randomUUID().slice(0, 6)}`, pontos: 2 }).select("id").single().throwOnError();
    await aulaCom(`${ano}-05-01T12:00:00Z`, [{ adolescente: ana, marcacoes: [extra.id] }]);
    expect((await pontos(admin, ano, [ana]))[0].pontos).toBe(2);

    await lucas.cliente.from("marcacoes").update({ pontos: 5 }).eq("id", extra.id).throwOnError();
    expect((await pontos(admin, ano, [ana]))[0]).toMatchObject({ quantas: 1, pontos: 5 });
  });

  it("os anos com presença aparecem para o seletor", async () => {
    const ano = anoDoTeste();
    await aulaCom(`${ano}-04-01T12:00:00Z`, [{ adolescente: await adolescente("Ana"), marcacoes: [(await marcacoes()).presente] }]);
    const { data } = await admin.rpc("anos_com_presenca").throwOnError();
    expect(data).toContain(ano);
  });
});

describe("quem vê o ranking", () => {
  it("só a Liderança: Professor, Pendente, desativado e anônimo não veem pontos", async () => {
    const ano = anoDoTeste();
    const ana = await adolescente("Ana");
    await aulaCom(`${ano}-02-01T12:00:00Z`, [{ adolescente: ana, marcacoes: [(await marcacoes()).presente] }]);
    expect(await pontos((await comFuncoes("Carol", "lider", ["Líder do louvor"])).cliente, ano, [ana])).toHaveLength(1);

    for (const quem of [(await contaNova("Paulo", "professor")).cliente, (await cadastrar("Novato")).cliente, (await comFuncoes("Saiu", "lider", ["Líder do ensino"], false)).cliente]) {
      const { data } = await quem.rpc("pontos_do_ano", { ano });
      expect(data ?? []).toEqual([]);
    }
    expect((await anonimo().rpc("pontos_do_ano", { ano })).error).not.toBeNull();
  });
});

describe("regra de desempate", () => {
  it("começa em Presente; só o Admin muda, e a mudança vira log com os nomes", async () => {
    const m = await marcacoes();
    const { data: atual } = await admin.from("configuracoes").select("desempate_por").single().throwOnError();
    expect(atual.desempate_por).toBe(m.presente);

    const lider = await comFuncoes("Carol", "lider", ["Co-líder do ministério"]);
    expect((await lider.cliente.from("configuracoes").update({ desempate_por: m.atividade }).eq("id", true).select("id")).data ?? []).toEqual([]);

    const lucas = await contaNova("Lucas", "admin");
    await lucas.cliente.from("configuracoes").update({ desempate_por: m.atividade }).eq("id", true).throwOnError();
    try {
      const { data } = await admin.from("logs").select("acao, detalhes").eq("usuario_id", lucas.id).eq("acao", "ranking.desempate_alterado").throwOnError();
      expect(data).toEqual([{ acao: "ranking.desempate_alterado", detalhes: { chave: "desempate_por", antes: "Presente", depois: "Fez atividade" } }]);
    } finally {
      await admin.from("configuracoes").update({ desempate_por: m.presente }).eq("id", true).throwOnError();
    }
  });
});
