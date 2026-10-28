import { afterEach, describe, expect, it } from "vitest";
import { admin, anonimo, categoria, contaNova, eventoDe } from "./ambiente";

const DIA_MS = 24 * 60 * 60 * 1000;
const diaLocal = (dias = 0) => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Bahia" }).format(new Date(Date.now() + dias * DIA_MS));

/** Uma aula de EBD num dia (hoje, por padrão), com o Professor dado, gravada direto no banco. */
async function aula(dias: number, professor: string) {
  const lucas = await contaNova("Lucas", "admin");
  const ebd = await categoria("EBD");
  const { data } = await admin
    .from("eventos")
    .insert({
      ...eventoDe(ebd.id, lucas.id, { inicio: `${diaLocal(dias)}T00:01:00-03:00`, fim: null, campos: { [ebd.campo("Tema")]: "Semeador", [ebd.campo("Professor")]: professor } }),
      criado_por: lucas.id,
    })
    .select("id")
    .single()
    .throwOnError();
  return data.id as string;
}

async function marcarPresenca(evento: string) {
  const { data: aluno } = await admin.from("adolescentes").insert({ nome: "Ana do Cartão", nascimento: "2011-05-10", genero: "feminino" }).select("id").single().throwOnError();
  const { data: marca } = await admin.from("marcacoes").select("id").eq("nome", "Presente").single().throwOnError();
  const { data: quem } = await admin.from("eventos").select("criado_por").eq("id", evento).single().throwOnError();
  const { data: presenca } = await admin
    .from("presencas")
    .insert({ evento_id: evento, adolescente_id: aluno.id, registrado_por: quem.criado_por })
    .select("id")
    .single()
    .throwOnError();
  await admin.from("marcacoes_das_presencas").insert({ presenca_id: presenca.id, marcacao_id: marca.id }).throwOnError();
}

afterEach(async () => {
  await admin.from("configuracoes").update({ janela_da_chamada_dias: 1 }).eq("id", true).throwOnError();
});

describe("a janela do cartão de Chamada", () => {
  it("vale 1 dia por padrão e qualquer pessoa aprovada a lê, até o Professor", async () => {
    const professor = await contaNova("Paulo", "professor");
    const lider = await contaNova("Lia", "lider");
    for (const quem of [professor, lider]) expect((await quem.cliente.rpc("janela_da_chamada_dias")).data).toBe(1);
  });

  it("quem não é aprovado e quem não entrou não a leem", async () => {
    const pendente = await contaNova("Pedro", "pendente");
    expect((await pendente.cliente.rpc("janela_da_chamada_dias")).data ?? null).toBeNull();
    expect((await anonimo().rpc("janela_da_chamada_dias")).error).not.toBeNull();
  });

  it("só o Admin a altera, de 0 a 7 dias, e a mudança vira log", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const lider = await contaNova("Lia", "lider");
    const professor = await contaNova("Paulo", "professor");

    expect((await lider.cliente.from("configuracoes").update({ janela_da_chamada_dias: 3 }).eq("id", true).select("id")).data ?? []).toEqual([]);
    expect((await professor.cliente.from("configuracoes").update({ janela_da_chamada_dias: 3 }).eq("id", true).select("id")).data ?? []).toEqual([]);
    expect((await lucas.cliente.from("configuracoes").update({ janela_da_chamada_dias: 8 }).eq("id", true)).error).not.toBeNull();
    expect((await lucas.cliente.from("configuracoes").update({ janela_da_chamada_dias: -1 }).eq("id", true)).error).not.toBeNull();

    await lucas.cliente.from("configuracoes").update({ janela_da_chamada_dias: 3 }).eq("id", true).throwOnError();
    expect((await professor.cliente.rpc("janela_da_chamada_dias")).data).toBe(3);

    const { data } = await admin
      .from("logs")
      .select("acao, usuario_id, detalhes")
      .eq("objeto_id", "janela_da_chamada_dias")
      .order("id", { ascending: false })
      .limit(1)
      .throwOnError();
    expect(data?.[0]).toMatchObject({ acao: "configuracao.alterada", usuario_id: lucas.id, detalhes: { chave: "janela_da_chamada_dias", antes: 1, depois: 3 } });
  });
});

describe("as Chamadas feitas, para o cartão", () => {
  it("o Professor sabe que a Chamada da aula dele foi feita, e só ela", async () => {
    const professor = await contaNova("Paulo", "professor");
    const feita = await aula(0, professor.id);
    const aberta = await aula(0, professor.id);
    await marcarPresenca(feita);

    const { data } = await professor.cliente.rpc("chamadas_feitas", { eventos: [feita, aberta] });
    expect(data).toEqual([feita]);
  });

  it("não diz nada sobre a aula de outro nem sobre aula que ainda não chegou ao dia", async () => {
    const professor = await contaNova("Paulo", "professor");
    const outro = await contaNova("Outro", "professor");
    const dele = await aula(0, professor.id);
    const futura = await aula(1, professor.id);
    await marcarPresenca(dele);
    await marcarPresenca(futura);

    expect((await outro.cliente.rpc("chamadas_feitas", { eventos: [dele, futura] })).data ?? []).toEqual([]);
    expect((await professor.cliente.rpc("chamadas_feitas", { eventos: [futura] })).data ?? []).toEqual([]);
    expect((await anonimo().rpc("chamadas_feitas", { eventos: [dele] })).error).not.toBeNull();
  });

  it("não abre as presenças nem os Adolescentes para ele", async () => {
    const professor = await contaNova("Paulo", "professor");
    const evento = await aula(0, professor.id);
    await marcarPresenca(evento);
    await professor.cliente.rpc("chamadas_feitas", { eventos: [evento] });
    expect((await professor.cliente.from("presencas").select("id")).data ?? []).toEqual([]);
    expect((await professor.cliente.from("adolescentes").select("id")).data ?? []).toEqual([]);
  });
});
