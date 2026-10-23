import { describe, expect, it } from "vitest";
import { admin, categoria, comFuncoes, eventoDe } from "./ambiente";

const HORA_MS = 60 * 60 * 1000;
const daqui = (horas: number) => new Date(Date.now() + horas * HORA_MS).toISOString();

const REGRA = { frequencia: "semanal", dias: [0], termino: { ocorrencias: 3 } };

/** As colunas de uma Ocorrência como `criar_serie` as recebe. */
const ocorrencia = (responsavel: string | null, mudancas: Record<string, unknown> = {}) => {
  const colunas: Record<string, unknown> = eventoDe("", responsavel, mudancas);
  delete colunas.categoria_id;
  return colunas;
};

const tresDomingos = (responsavel: string | null) =>
  [0, 7, 14].map((dias) => ocorrencia(responsavel, { inicio: daqui(24 * (dias + 1)), fim: null }));

async function ocorrenciasDa(serie: string) {
  const { data } = await admin.from("eventos").select("*").eq("serie_id", serie).order("inicio").throwOnError();
  return data;
}

/** A Ocorrência gravada como `editar_eventos` a recebe, com as mudanças por cima. */
const alteracao = (o: Record<string, unknown>, mudancas: Record<string, unknown> = {}) => {
  const { id, titulo, inicio, fim, dia_inteiro, local, responsavel_id, status, observacoes, link, campos } = o;
  return { id, titulo, inicio, fim, dia_inteiro, local, responsavel_id, status, observacoes, link, campos, ...mudancas };
};

const MARIANA = "Líder de integração e programação";

/** Uma Série de Culto com três Ocorrências, criada pela Mariana. */
async function umaSerie() {
  const mariana = await comFuncoes("Mariana", "lider", [MARIANA]);
  const culto = await categoria("Culto");
  const { data } = await mariana.cliente
    .rpc("criar_serie", { categoria: culto.id, regra: REGRA, primeiro_dia: daqui(24).slice(0, 10), ocorrencias: tresDomingos(mariana.id) })
    .throwOnError();
  const id = data as string;
  return { mariana, culto, id, ocorrencias: await ocorrenciasDa(id) };
}

describe("criar Série", () => {
  it("quem tem Função na Área da Categoria cria a Série com todas as Ocorrências", async () => {
    const beythel = await comFuncoes("Beythel", "lider", ["Líder do louvor"]);
    const ensaio = await categoria("Ensaio de louvor");

    const { data: id, error } = await beythel.cliente.rpc("criar_serie", {
      categoria: ensaio.id,
      regra: REGRA,
      primeiro_dia: daqui(24).slice(0, 10),
      ocorrencias: tresDomingos(beythel.id),
    });
    expect(error).toBeNull();

    const criadas = await ocorrenciasDa(id);
    expect(criadas).toHaveLength(3);
    expect(criadas.every((o) => o.categoria_id === ensaio.id && o.editada === false && o.criado_por === beythel.id)).toBe(true);
  });

  it("quem não tem Função na Área não cria, e nada fica gravado", async () => {
    const beythel = await comFuncoes("Beythel", "lider", ["Líder do louvor"]);
    const culto = await categoria("Culto");
    const titulo = `Série ${crypto.randomUUID()}`;

    const { error } = await beythel.cliente.rpc("criar_serie", {
      categoria: culto.id,
      regra: REGRA,
      primeiro_dia: daqui(24).slice(0, 10),
      ocorrencias: tresDomingos(beythel.id).map((o) => ({ ...o, titulo })),
    });
    expect(error).not.toBeNull();

    const { data } = await admin.from("eventos").select("id").eq("titulo", titulo).throwOnError();
    expect(data).toHaveLength(0);
  });

  it("uma Ocorrência inválida desfaz a Série inteira", async () => {
    const mariana = await comFuncoes("Mariana", "lider", [MARIANA]);
    const culto = await categoria("Culto");
    const titulo = `Série ${crypto.randomUUID()}`;
    const ocorrencias: Record<string, unknown>[] = tresDomingos(mariana.id).map((o) => ({ ...o, titulo }));
    ocorrencias[2] = { ...ocorrencias[2], status: "realizado" }; // um Evento novo não nasce Realizado

    const { error } = await mariana.cliente.rpc("criar_serie", {
      categoria: culto.id,
      regra: REGRA,
      primeiro_dia: daqui(24).slice(0, 10),
      ocorrencias,
    });
    expect(error).not.toBeNull();
    const { data } = await admin.from("eventos").select("id").eq("titulo", titulo).throwOnError();
    expect(data).toHaveLength(0);
  });

  it("um Evento não entra na Série de outra Categoria", async () => {
    const mariana = await comFuncoes("Mariana", "lider", [MARIANA]);
    const culto = await categoria("Culto");
    const reuniao = await categoria("Reunião de liderança");
    const { data: serie } = await admin
      .from("series")
      .insert({ categoria_id: culto.id, regra: REGRA, primeiro_dia: daqui(24).slice(0, 10), criado_por: mariana.id })
      .select("id")
      .single()
      .throwOnError();

    const { error } = await admin.from("eventos").insert({ ...eventoDe(reuniao.id, mariana.id), serie_id: serie.id, criado_por: mariana.id });
    expect(error).not.toBeNull();
  });
});

describe("limites e numeração da Série", () => {
  const LIMITE = /no máximo toda semana, por até 6 meses/;

  /** `n` Ocorrências semanais a partir de amanhã. */
  const semanais = (responsavel: string | null, n: number) =>
    Array.from({ length: n }, (_, i) => ocorrencia(responsavel, { inicio: daqui(24 * (1 + 7 * i)), fim: null }));

  const criarComo = async (n: number, regra: Record<string, unknown> = REGRA, primeiroDia = daqui(24).slice(0, 10)) => {
    const mariana = await comFuncoes("Mariana", "lider", [MARIANA]);
    const culto = await categoria("Culto");
    return mariana.cliente.rpc("criar_serie", {
      categoria: culto.id,
      regra,
      primeiro_dia: primeiroDia,
      ocorrencias: semanais(mariana.id, n),
    });
  };

  it("numera as Ocorrências na ordem das datas, mesmo se chegarem fora de ordem", async () => {
    const mariana = await comFuncoes("Mariana", "lider", [MARIANA]);
    const culto = await categoria("Culto");
    const { data } = await mariana.cliente
      .rpc("criar_serie", {
        categoria: culto.id,
        regra: REGRA,
        primeiro_dia: daqui(24).slice(0, 10),
        ocorrencias: [...semanais(mariana.id, 3)].reverse().map((o) => ({ ...o, numero_da_ocorrencia: 99 })),
      })
      .throwOnError();
    const criadas = await ocorrenciasDa(data as string);
    expect(criadas.map((o) => o.numero_da_ocorrencia)).toEqual([1, 2, 3]);
  });

  it("cancelar uma Ocorrência não renumera as outras", async () => {
    const { mariana, ocorrencias } = await umaSerie();
    await mariana.cliente.rpc("editar_eventos", { alteracoes: [alteracao(ocorrencias[1], { status: "cancelado" })] }).throwOnError();
    const { data } = await admin.from("eventos").select("numero_da_ocorrencia").eq("serie_id", ocorrencias[0].serie_id).order("inicio").throwOnError();
    expect(data.map((o) => o.numero_da_ocorrencia)).toEqual([1, 2, 3]);
  });

  it("Evento avulso fica sem número", async () => {
    const mariana = await comFuncoes("Mariana", "lider", [MARIANA]);
    const culto = await categoria("Culto");
    const { data } = await admin.from("eventos").insert({ ...eventoDe(culto.id, mariana.id), criado_por: mariana.id }).select("numero_da_ocorrencia").single().throwOnError();
    expect(data.numero_da_ocorrencia).toBeNull();
  });

  it("só uma Ocorrência de Série leva número", async () => {
    const mariana = await comFuncoes("Mariana", "lider", [MARIANA]);
    const culto = await categoria("Culto");
    const { error } = await admin.from("eventos").insert({ ...eventoDe(culto.id, mariana.id), criado_por: mariana.id, numero_da_ocorrencia: 1 });
    expect(error).not.toBeNull();
  });

  it("aceita até 6 meses a partir do primeiro dia", async () => {
    const { error } = await criarComo(26); // a 26ª semanal começa 25 semanas depois do primeiro dia
    expect(error).toBeNull();
  });

  it("recusa Ocorrência além de 6 meses, e nada fica gravado", async () => {
    const { error } = await criarComo(30);
    expect(error?.message).toMatch(LIMITE);
  });

  it("recusa mais de 52 Ocorrências", async () => {
    const mariana = await comFuncoes("Mariana", "lider", [MARIANA]);
    const culto = await categoria("Culto");
    const mesmoDia = Array.from({ length: 53 }, (_, i) => ocorrencia(mariana.id, { inicio: daqui(24 + i), fim: null }));
    const { error } = await mariana.cliente.rpc("criar_serie", { categoria: culto.id, regra: REGRA, primeiro_dia: daqui(24).slice(0, 10), ocorrencias: mesmoDia });
    expect(error?.message).toMatch(LIMITE);
  });

  it("recusa repetição mais frequente que semanal", async () => {
    for (const regra of [
      { frequencia: "quinzenal", dias: [0], termino: { ocorrencias: 3 } },
      { frequencia: "mensal", posicao: 1, diaDaSemana: 0, termino: { ocorrencias: 3 } },
      { frequencia: "semanal", dias: [0, 3], termino: { ocorrencias: 3 } },
    ]) {
      const { error } = await criarComo(3, regra);
      expect(error, JSON.stringify(regra)).not.toBeNull();
    }
  });
});

describe("editar Ocorrências", () => {
  it("quem edita a Categoria grava várias de uma vez e marca a editada", async () => {
    const { mariana, ocorrencias } = await umaSerie();
    const { error } = await mariana.cliente.rpc("editar_eventos", {
      alteracoes: [alteracao(ocorrencias[0], { local: "Quadra", editada: true }), alteracao(ocorrencias[1], { local: "Quadra" })],
    });
    expect(error).toBeNull();

    const depois = await Promise.all(ocorrencias.map((o) => admin.from("eventos").select("local, editada").eq("id", o.id).single()));
    expect(depois.map((r) => r.data)).toEqual([
      { local: "Quadra", editada: true },
      { local: "Quadra", editada: false },
      { local: "Templo", editada: false },
    ]);
  });

  it("o Responsável de uma Ocorrência não altera as outras, e nada é gravado", async () => {
    const { id, ocorrencias } = await umaSerie();
    const beythel = await comFuncoes("Beythel", "lider", ["Líder do louvor"]);
    await admin.from("eventos").update({ responsavel_id: beythel.id }).eq("id", ocorrencias[0].id).throwOnError();

    const { error } = await beythel.cliente.rpc("editar_eventos", {
      alteracoes: [
        alteracao({ ...ocorrencias[0], responsavel_id: beythel.id }, { local: "Quadra" }),
        alteracao(ocorrencias[1], { local: "Quadra" }),
      ],
    });
    expect(error?.code).toBe("42501");
    expect((await ocorrenciasDa(id)).map((o) => o.local)).toEqual(["Templo", "Templo", "Templo"]);
  });

  it("uma Ocorrência Cancelada só o Admin edita", async () => {
    const { mariana, ocorrencias } = await umaSerie();
    await admin.from("eventos").update({ status: "cancelado" }).eq("id", ocorrencias[0].id).throwOnError();
    const edicao = { alteracoes: [alteracao(ocorrencias[0], { status: "cancelado", local: "Quadra" })] };

    const deLider = await mariana.cliente.rpc("editar_eventos", edicao);
    expect(deLider.error?.code).toBe("42501");

    const lucas = await comFuncoes("Admin", "admin", []);
    const doAdmin = await lucas.cliente.rpc("editar_eventos", edicao);
    expect(doAdmin.error).toBeNull();
  });

  it("um Evento fora de Série continua editável como antes, mesmo Cancelado", async () => {
    const mariana = await comFuncoes("Mariana", "lider", [MARIANA]);
    const culto = await categoria("Culto");
    const { data } = await admin
      .from("eventos")
      .insert({ ...eventoDe(culto.id, mariana.id, { status: "cancelado" }), criado_por: mariana.id })
      .select("id")
      .single()
      .throwOnError();
    const { data: editado } = await mariana.cliente.from("eventos").update({ local: "Quadra" }).eq("id", data.id).select("id");
    expect(editado).toHaveLength(1);
  });
});

describe("encerrar e excluir Série", () => {
  it("encerrar guarda o dia final e cancela as indicadas", async () => {
    const { mariana, id, ocorrencias } = await umaSerie();

    const { error } = await mariana.cliente.rpc("encerrar_serie", {
      serie: id,
      ate: "2026-11-10",
      alteracoes: [alteracao(ocorrencias[2], { status: "cancelado" })],
    });
    expect(error).toBeNull();

    const { data: serie } = await admin.from("series").select("encerrada_em").eq("id", id).single();
    expect(serie?.encerrada_em).toBe("2026-11-10");
    expect((await ocorrenciasDa(id)).map((o) => o.status)).toEqual(["planejado", "planejado", "cancelado"]);
  });

  it("quem não tem Função na Área não encerra, e nada é cancelado", async () => {
    const { id, ocorrencias } = await umaSerie();
    const beythel = await comFuncoes("Beythel", "lider", ["Líder do louvor"]);

    const { error } = await beythel.cliente.rpc("encerrar_serie", {
      serie: id,
      ate: "2026-11-10",
      alteracoes: [alteracao(ocorrencias[2], { status: "cancelado" })],
    });
    expect(error?.code).toBe("42501");
    expect((await ocorrenciasDa(id)).map((o) => o.status)).toEqual(["planejado", "planejado", "planejado"]);
  });

  it("só o Admin exclui a Série, que leva as Ocorrências junto", async () => {
    const { mariana, id } = await umaSerie();
    const lucas = await comFuncoes("Admin", "admin", []);

    const deLider = await mariana.cliente.from("series").delete().eq("id", id).select("id");
    expect(deLider.data).toHaveLength(0);
    expect(await ocorrenciasDa(id)).toHaveLength(3);

    const doAdmin = await lucas.cliente.from("series").delete().eq("id", id).select("id");
    expect(doAdmin.data).toHaveLength(1);
    expect(await ocorrenciasDa(id)).toHaveLength(0);
  });
});
