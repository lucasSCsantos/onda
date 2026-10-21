import { describe, expect, it } from "vitest";
import { admin, anonimo, cadastrar, comFuncoes, contaNova } from "./ambiente";

describe("Exportações: o Admin registra e lê", () => {
  it("cada exportação grava quem e quando; só o Admin a vê", async () => {
    const chefe = await contaNova("Lucas", "admin");
    const outro = await contaNova("Outro Admin", "admin");
    const antes = Date.now();

    for (const tabela of ["eventos", "adolescentes", "usuarios"] as const) {
      const { error } = await chefe.cliente.from("exportacoes").insert({ tabela });
      expect(error).toBeNull();
    }

    const { data } = await chefe.cliente.from("exportacoes").select("tabela, feito_por, feito_em").eq("feito_por", chefe.id);
    expect(data!.map((e) => e.tabela).sort()).toEqual(["adolescentes", "eventos", "usuarios"]);
    for (const e of data!) {
      expect(e.feito_por).toBe(chefe.id);
      expect(Date.parse(e.feito_em)).toBeGreaterThan(antes - 60_000);
    }

    // Outro Admin vê o histórico inteiro.
    const { data: doOutro } = await outro.cliente.from("exportacoes").select("id").eq("feito_por", chefe.id);
    expect(doOutro).toHaveLength(3);
  });

  it("o Admin não registra a exportação em nome de outra pessoa", async () => {
    const chefe = await contaNova("Lucas", "admin");
    const outro = await contaNova("Outro", "admin");
    const { error } = await chefe.cliente.from("exportacoes").insert({ tabela: "eventos", feito_por: outro.id });
    expect(error).not.toBeNull();
  });

  it("o registro é imutável: nem o Admin edita ou apaga", async () => {
    const chefe = await contaNova("Lucas", "admin");
    const { data } = await chefe.cliente.from("exportacoes").insert({ tabela: "eventos" }).select("id").single().throwOnError();

    const edicao = await chefe.cliente.from("exportacoes").update({ tabela: "usuarios" }).eq("id", data.id).select("id");
    expect(edicao.data ?? []).toEqual([]);
    await chefe.cliente.from("exportacoes").delete().eq("id", data.id);

    const { data: depois } = await admin.from("exportacoes").select("tabela").eq("id", data.id).single().throwOnError();
    expect(depois.tabela).toBe("eventos");
  });
});

describe("Exportações: quem não é Admin", () => {
  it("Pendente, Professor, Líder, Admin desativado e anônimo não exportam nem leem o histórico", async () => {
    const chefe = await contaNova("Lucas", "admin");
    await chefe.cliente.from("exportacoes").insert({ tabela: "eventos" }).throwOnError();

    const pendente = await cadastrar("Novato");
    const professor = await contaNova("Paulo", "professor");
    const lider = await comFuncoes("Carol", "lider", ["Líder do louvor"]);
    const desativado = await comFuncoes("Saiu", "admin", ["Líder do ministério"], false);

    for (const quem of [pendente.cliente, professor.cliente, lider.cliente, desativado.cliente, anonimo()]) {
      for (const tabela of ["eventos", "adolescentes", "usuarios"] as const) {
        expect((await quem.from("exportacoes").insert({ tabela })).error).not.toBeNull();
      }
      const { data } = await quem.from("exportacoes").select("id");
      expect(data ?? []).toEqual([]);
    }
  });
});
