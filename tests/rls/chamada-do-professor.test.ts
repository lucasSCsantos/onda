import { describe, expect, it } from "vitest";
import { admin, anonimo, comFuncoes, contaNova, categoria, eventoDe, type Cliente } from "./ambiente";

const DIA_MS = 24 * 60 * 60 * 1000;
const diaLocal = (dias = 0) => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Bahia" }).format(new Date(Date.now() + dias * DIA_MS));

/** Uma aula de EBD num dia (hoje, por padrão), com o Professor e o Auxiliar dados, gravada direto no banco. */
async function aula(dias = 0, quem: { professor?: string; auxiliar?: string } = {}, mudancas: Record<string, unknown> = {}) {
  const lucas = await contaNova("Lucas", "admin");
  const ebd = await categoria("EBD");
  const campos: Record<string, string> = { [ebd.campo("Tema")]: "Semeador" };
  if (quem.professor) campos[ebd.campo("Professor")] = quem.professor;
  if (quem.auxiliar) campos[ebd.campo("Auxiliar")] = quem.auxiliar;
  const { data } = await admin
    .from("eventos")
    .insert({ ...eventoDe(ebd.id, lucas.id, { inicio: `${diaLocal(dias)}T00:01:00-03:00`, fim: null, campos, ...mudancas }), criado_por: lucas.id })
    .select("id")
    .single()
    .throwOnError();
  return data.id as string;
}

async function adolescente(nome = "Ana", ativo = true) {
  const { data } = await admin.from("adolescentes").insert({ nome, nascimento: "2011-05-10", genero: "feminino", ativo }).select("id").single().throwOnError();
  return data.id as string;
}

async function presente() {
  const { data } = await admin.from("marcacoes").select("id").eq("nome", "Presente").single().throwOnError();
  return data.id as string;
}

const salvar = (quem: Cliente, evento: string, aluno: string, ids: string[]) =>
  quem.rpc("salvar_presenca", { evento, adolescente: aluno, marcacoes: ids, visitante: null });

describe("a Chamada do Professor e do Auxiliar", () => {
  it("fazem a Chamada da aula deles, no dia dela, sem Função na Área", async () => {
    const professor = await contaNova("Paulo", "professor");
    const auxiliar = await contaNova("Ari", "professor");
    const evento = await aula(0, { professor: professor.id, auxiliar: auxiliar.id });
    const [ana, bia] = [await adolescente("Ana"), await adolescente("Bia")];
    const marca = await presente();

    expect((await professor.cliente.rpc("pode_fazer_chamada", { evento })).data).toBe(true);
    expect((await salvar(professor.cliente, evento, ana, [marca])).error).toBeNull();
    expect((await salvar(auxiliar.cliente, evento, bia, [marca])).error).toBeNull();

    const { data } = await admin.from("presencas").select("adolescente_id, registrado_por").eq("evento_id", evento).throwOnError();
    expect(data).toEqual(expect.arrayContaining([
      { adolescente_id: ana, registrado_por: professor.id },
      { adolescente_id: bia, registrado_por: auxiliar.id },
    ]));
  });

  it("corrigem depois do dia da aula, e a correção vira log com quem fez", async () => {
    const professor = await contaNova("Paulo", "professor");
    const evento = await aula(-7, { professor: professor.id });
    const ana = await adolescente("Ana Corrigida");
    const marca = await presente();
    const { data: extra } = await admin.from("marcacoes").select("id").eq("nome", "Fez atividade").single().throwOnError();

    await salvar(professor.cliente, evento, ana, [marca]).throwOnError();
    await salvar(professor.cliente, evento, ana, [marca, extra.id]).throwOnError();

    const { data: logs } = await admin.from("logs").select("acao, usuario_id").eq("objeto_id", evento).like("acao", "presenca.%").order("id").throwOnError();
    expect(logs).toEqual([
      { acao: "presenca.chamada_corrigida", usuario_id: professor.id },
      { acao: "presenca.chamada_corrigida", usuario_id: professor.id },
    ]);
  });

  it("no dia da aula, a Chamada vira um log de Chamada registrada", async () => {
    const professor = await contaNova("Paulo", "professor");
    const evento = await aula(0, { professor: professor.id });
    await salvar(professor.cliente, evento, await adolescente(), [await presente()]).throwOnError();
    const { data } = await admin.from("logs").select("acao, usuario_id").eq("objeto_id", evento).like("acao", "presenca.%").throwOnError();
    expect(data).toEqual([{ acao: "presenca.chamada_registrada", usuario_id: professor.id }]);
  });

  it("não fazem a Chamada de outra aula, nem de aula que ainda não chegou ao dia, nem de aula Cancelada", async () => {
    const professor = await contaNova("Paulo", "professor");
    const outro = await contaNova("Outro", "professor");
    const aluno = await adolescente();
    const marca = await presente();

    const deOutro = await aula(0, { professor: outro.id });
    const futura = await aula(1, { professor: professor.id });
    const cancelada = await aula(0, { professor: professor.id }, { status: "cancelado" });
    const semProfessor = await aula(0);
    for (const evento of [deOutro, futura, cancelada, semProfessor]) {
      expect((await salvar(professor.cliente, evento, aluno, [marca])).error?.code).toBe("42501");
      expect((await professor.cliente.rpc("pode_fazer_chamada", { evento })).data).toBe(false);
    }
    const { data } = await admin.from("presencas").select("id").eq("adolescente_id", aluno).throwOnError();
    expect(data).toEqual([]);
  });

  it("o Professor desativado depois de escolhido na aula não faz a Chamada", async () => {
    const inativo = await contaNova("Saiu", "professor");
    const evento = await aula(0, { professor: inativo.id });
    await admin.from("perfis").update({ ativo: false }).eq("id", inativo.id).throwOnError();
    const aluno = await adolescente();
    expect((await salvar(inativo.cliente, evento, aluno, [await presente()])).error?.code).toBe("42501");
  });

  it("um líder escolhido como Professor, sem Função em Ensino, também faz a Chamada da aula dele", async () => {
    const lider = await comFuncoes("Carol", "lider", ["Líder do louvor"]);
    const dele = await aula(0, { professor: lider.id });
    const dela = await aula(0);
    const aluno = await adolescente();
    expect((await salvar(lider.cliente, dele, aluno, [await presente()])).error).toBeNull();
    expect((await salvar(lider.cliente, dela, aluno, [await presente()])).error?.code).toBe("42501");
  });
});

describe("o que o Professor vê na Chamada", () => {
  it("só nome e identificador dos Adolescentes ativos, sem nascimento", async () => {
    const professor = await contaNova("Paulo", "professor");
    const evento = await aula(0, { professor: professor.id });
    const ativo = await adolescente("Ativa Chamada");
    const inativo = await adolescente("Inativo Chamada", false);

    const { data, error } = await professor.cliente.rpc("adolescentes_da_chamada", { evento });
    expect(error).toBeNull();
    const nossos = (data as Record<string, unknown>[]).filter((a) => a.id === ativo || a.id === inativo);
    expect(nossos).toEqual([{ id: ativo, nome: "Ativa Chamada" }]);
    expect(JSON.stringify(data)).not.toContain("2011-05-10");
    expect(Object.keys((data as Record<string, unknown>[])[0]).sort()).toEqual(["id", "nome"]);
  });

  it("a tabela de Adolescentes segue fechada para ele", async () => {
    const professor = await contaNova("Paulo", "professor");
    await aula(0, { professor: professor.id });
    await adolescente("Fechada");
    expect((await professor.cliente.from("adolescentes").select("id, nome")).data ?? []).toEqual([]);
    expect((await professor.cliente.from("presencas").select("id")).data ?? []).toEqual([]);
    expect((await professor.cliente.from("marcacoes").select("id")).data ?? []).toEqual([]);
  });

  it("recebe as Marcações ativas e a Chamada já feita daquela aula, sem pontos", async () => {
    const professor = await contaNova("Paulo", "professor");
    const evento = await aula(0, { professor: professor.id });
    const ana = await adolescente("Ana Feita");
    await salvar(professor.cliente, evento, ana, [await presente()]).throwOnError();

    const { data: marcacoes } = await professor.cliente.rpc("marcacoes_da_chamada", { evento });
    expect((marcacoes as { nome: string }[]).map((m) => m.nome)).toEqual(expect.arrayContaining(["Presente", "Trouxe bíblia"]));
    expect(Object.keys((marcacoes as Record<string, unknown>[])[0])).not.toContain("pontos");

    const { data: presencas } = await professor.cliente.rpc("presencas_da_chamada", { evento });
    expect(presencas as { adolescente_id: string }[]).toHaveLength(1);
    expect((presencas as { adolescente_id: string }[])[0].adolescente_id).toBe(ana);
  });

  it("nada disso vem de outra aula, de antes do dia nem de quem não é da aula", async () => {
    const professor = await contaNova("Paulo", "professor");
    const outro = await contaNova("Outro", "professor");
    const dele = await aula(0, { professor: professor.id });
    const futura = await aula(1, { professor: professor.id });
    await adolescente("Escondido");

    for (const funcao of ["adolescentes_da_chamada", "marcacoes_da_chamada", "presencas_da_chamada"]) {
      expect((await outro.cliente.rpc(funcao, { evento: dele })).data ?? []).toEqual([]);
      expect((await professor.cliente.rpc(funcao, { evento: futura })).data ?? []).toEqual([]);
      expect((await anonimo().rpc(funcao, { evento: dele })).error).not.toBeNull();
    }
  });

  it("o Professor continua sem ver os Adolescentes fora da Chamada da aula dele", async () => {
    const professor = await contaNova("Paulo", "professor");
    await aula(0, { professor: professor.id });
    await adolescente("Aniversariante");
    const { data } = await professor.cliente.from("adolescentes").select("nascimento");
    expect(data ?? []).toEqual([]);
  });
});
