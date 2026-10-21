import { describe, expect, it } from "vitest";
import { CATALOGO_INICIAL } from "@/dominio/catalogo";
import { podeEditarEvento } from "@/dominio/eventos";
import { admin, categoria, comFuncoes, eventoDe, type Cliente } from "./ambiente";

const areaDa = (f: string) => CATALOGO_INICIAL.funcoes.find((x) => x.nome === f)!.area;

const tarefas = [
  { texto: "Reservar ônibus", feito: false },
  { texto: "Comprar lanches", feito: true },
];

async function acampamento(responsavel: string) {
  const cat = await categoria("Acampamento");
  const campo = cat.campo("Checklist");
  const { data } = await admin
    .from("eventos")
    .insert({ ...eventoDe(cat.id, responsavel, { campos: { [campo]: tarefas }, fim: "2026-10-27T00:00:00Z" }), criado_por: responsavel })
    .select("id")
    .single()
    .throwOnError();
  return { id: data.id as string, campo, categoria: cat };
}

/** Grava o checklist como `cliente` e diz se o banco aceitou: uma linha fora da política some do resultado, sem erro. */
async function gravou(cliente: Cliente, id: string, campo: string, valor: unknown) {
  const { data, error } = await cliente.from("eventos").update({ campos: { [campo]: valor } }).eq("id", id).select("id");
  return error === null && data.length === 1;
}

const checklistSalvo = async (id: string, campo: string) =>
  (await admin.from("eventos").select("campos").eq("id", id).single().throwOnError()).data!.campos[campo];

describe("checklist do Evento", () => {
  it("quem edita o Evento marca, desmarca, adiciona e remove tarefas", async () => {
    const lider = await comFuncoes("Líder do acampamento", "lider", ["Líder do ministério"]);
    const { id, campo } = await acampamento(lider.id);

    const marcado = tarefas.map((t, i) => (i === 0 ? { ...t, feito: true } : t));
    expect(await gravou(lider.cliente, id, campo, marcado)).toBe(true);
    expect(await checklistSalvo(id, campo)).toEqual(marcado);

    const desmarcado = marcado.map((t) => ({ ...t, feito: false }));
    expect(await gravou(lider.cliente, id, campo, desmarcado)).toBe(true);

    const comNova = [...desmarcado, { texto: "Imprimir autorizações", feito: false }];
    expect(await gravou(lider.cliente, id, campo, comNova)).toBe(true);
    expect(await gravou(lider.cliente, id, campo, comNova.slice(1))).toBe(true);
    expect(await checklistSalvo(id, campo)).toEqual(comNova.slice(1));
  });

  it("o banco concorda com o módulo de domínio sobre quem marca", async () => {
    const dono = await comFuncoes("Responsável", "lider", ["Líder do louvor"]);
    const pessoas = [
      await comFuncoes("Admin", "admin", []),
      await comFuncoes("Geral", "lider", ["Co-líder do ministério"]),
      await comFuncoes("Louvor", "lider", ["Líder do louvor dos adolescentes"]),
      dono,
      await comFuncoes("Professor", "professor", []),
      await comFuncoes("Pendente", "pendente", []),
      await comFuncoes("Saiu", "lider", ["Líder do ministério"], false),
    ];
    const { id, campo, categoria: cat } = await acampamento(dono.id);

    let atual: unknown = tarefas;
    for (const quem of pessoas) {
      const esperado = podeEditarEvento(quem.pessoa, quem.funcoes.map(areaDa), { categoria: { area: cat.area }, responsavel: dono.id });
      const nome = quem.funcoes.join(" + ") || quem.pessoa.nivel;
      const novo = [{ texto: `Marcada por ${nome}`, feito: true }];
      expect(await gravou(quem.cliente, id, campo, novo), nome).toBe(esperado);
      if (esperado) atual = novo;
      expect(await checklistSalvo(id, campo), nome).toEqual(atual);
    }
  });

  it("o Professor não marca checklist", async () => {
    const dono = await comFuncoes("Responsável", "lider", ["Líder do ministério"]);
    const professor = await comFuncoes("Paulo", "professor", []);
    const { id, campo } = await acampamento(dono.id);

    expect(await gravou(professor.cliente, id, campo, tarefas.map((t) => ({ ...t, feito: true })))).toBe(false);
    expect(await checklistSalvo(id, campo)).toEqual(tarefas);
  });

  it("recusa um checklist fora do formato", async () => {
    const lider = await comFuncoes("Líder", "lider", ["Líder do ministério"]);
    const { id, campo } = await acampamento(lider.id);

    for (const invalido of ["texto solto", [{ texto: "", feito: false }], [{ texto: "x" }], [{ texto: "x", feito: "sim" }], ["x"], { texto: "x", feito: true }]) {
      expect(await gravou(lider.cliente, id, campo, invalido), JSON.stringify(invalido)).toBe(false);
    }
    expect(await checklistSalvo(id, campo)).toEqual(tarefas);
  });

  it("o checklist nunca é obrigatório e um Evento nasce sem ele", async () => {
    const lider = await comFuncoes("Líder", "lider", ["Líder do ministério"]);
    const cat = await categoria("Acampamento");
    const criado = await lider.cliente.from("eventos").insert(eventoDe(cat.id, lider.id)).select("id").single();
    expect(criado.error).toBeNull();
  });

  it("o checklist pode ser adicionado a outra Categoria pela configuração", async () => {
    const lider = await comFuncoes("Líder", "lider", ["Líder do ministério"]);
    const culto = await categoria("Culto");
    const novo = await admin
      .from("campos_das_categorias")
      .insert({ categoria_id: culto.id, nome: "Providências", tipo: "checklist", ordem: 9 })
      .select("id")
      .single()
      .throwOnError();
    const campo = novo.data.id as string;

    const { data } = await lider.cliente
      .from("eventos")
      .insert(eventoDe(culto.id, lider.id, { campos: { [campo]: [{ texto: "Ligar o som", feito: false }] } }))
      .select("id")
      .single();
    expect(data).not.toBeNull();
    expect(await gravou(lider.cliente, data!.id, campo, [{ texto: "Ligar o som", feito: true }])).toBe(true);

    await admin.from("campos_das_categorias").delete().eq("id", campo);
  });
});
