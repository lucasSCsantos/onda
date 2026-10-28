import { describe, expect, it } from "vitest";
import { admin, anonimo, cadastrar, comFuncoes, contaNova, type Cliente } from "./ambiente";

const novo = (nome: string) => ({ nome, nascimento: "2010-05-10", genero: "feminino" });

async function cadastrarComo(cliente: Cliente, nome: string) {
  return cliente.from("adolescentes").insert(novo(nome)).select("id, nome, nascimento, ativo").single();
}

describe("Adolescentes: quem lê", () => {
  it("a Liderança (Admin e Líder) lê; Pendente, Professor, desativado e anônimo não leem nada", async () => {
    const { data: existente } = await admin.from("adolescentes").insert(novo("Lia")).select("id").single().throwOnError();
    const lider = await comFuncoes("Carol", "lider", ["Líder do louvor"]);
    const chefe = await comFuncoes("Lucas", "admin", ["Líder do ministério"]);
    const professor = await contaNova("Paulo", "professor");
    const pendente = await cadastrar("Novato");
    const desativado = await comFuncoes("Saiu", "lider", ["Líder do louvor"], false);

    for (const quem of [lider.cliente, chefe.cliente]) {
      const { data } = await quem.from("adolescentes").select("id").eq("id", existente!.id);
      expect(data).toEqual([{ id: existente!.id }]);
    }
    for (const quem of [professor.cliente, pendente.cliente, desativado.cliente, anonimo()]) {
      const { data } = await quem.from("adolescentes").select("id"); // o anônimo nem tem permissão: erro, sem dados
      expect(data ?? []).toEqual([]);
    }
  });
});

describe("Adolescentes: quem escreve", () => {
  it("Admin e Líder cadastram, editam, inativam e reativam", async () => {
    for (const quem of [await contaNova("Admin", "admin"), await comFuncoes("Líder", "lider", ["Líder do louvor"])]) {
      const criado = await cadastrarComo(quem.cliente, "Bia");
      expect(criado.error).toBeNull();
      expect(criado.data).toMatchObject({ nome: "Bia", nascimento: "2010-05-10", ativo: true });
      const id = criado.data!.id;

      const edicao = await quem.cliente.from("adolescentes").update({ nome: "Beatriz" }).eq("id", id).select("nome");
      expect(edicao.data).toEqual([{ nome: "Beatriz" }]);

      const inativo = await quem.cliente.from("adolescentes").update({ ativo: false }).eq("id", id).select("ativo");
      expect(inativo.data).toEqual([{ ativo: false }]);
      const volta = await quem.cliente.from("adolescentes").update({ ativo: true }).eq("id", id).select("ativo");
      expect(volta.data).toEqual([{ ativo: true }]);
    }
  });

  it("Professor, Pendente, desativado e anônimo não cadastram nem editam", async () => {
    const { data: alvo } = await admin.from("adolescentes").insert(novo("Alvo")).select("id").single().throwOnError();
    const professor = await contaNova("Paulo", "professor");
    const pendente = await cadastrar("Novato");
    const desativado = await comFuncoes("Saiu", "lider", ["Líder do louvor"], false);

    for (const quem of [professor.cliente, pendente.cliente, desativado.cliente, anonimo()]) {
      expect((await cadastrarComo(quem, "Intruso")).error).not.toBeNull();
      const edicao = await quem.from("adolescentes").update({ nome: "Invadido" }).eq("id", alvo!.id).select("id");
      expect(edicao.data ?? []).toEqual([]);
    }
    const { data } = await admin.from("adolescentes").select("nome").eq("id", alvo!.id).single().throwOnError();
    expect(data!.nome).toBe("Alvo");
  });

  it("ninguém apaga: inativar é o jeito de tirar da lista", async () => {
    const admins = await contaNova("Admin", "admin");
    const { data: criado } = await cadastrarComo(admins.cliente, "Fica");
    await admins.cliente.from("adolescentes").delete().eq("id", criado!.id);
    const { data } = await admin.from("adolescentes").select("id").eq("id", criado!.id);
    expect(data).toHaveLength(1);
  });

  it("recusa nome em branco e data de nascimento futura", async () => {
    const lider = await contaNova("Líder", "lider");
    expect((await lider.cliente.from("adolescentes").insert({ nome: "  ", nascimento: "2010-05-10", genero: "feminino" })).error).not.toBeNull();
    expect((await lider.cliente.from("adolescentes").insert({ nome: "Futuro", nascimento: "2999-01-01", genero: "feminino" })).error).not.toBeNull();
  });
});
