import { describe, expect, it } from "vitest";
import { admin, cadastrar, contaNova, funcao } from "./ambiente";

const generoDe = async (id: string) => (await admin.from("perfis").select("genero").eq("id", id).single().throwOnError()).data!.genero;

describe("Gênero das contas", () => {
  it("perfis antigos, sem Gênero, seguem válidos como 'não informado'", async () => {
    const lider = await contaNova("Antiga", "lider");
    expect(await generoDe(lider.id)).toBeNull();
    const perfil = await lider.cliente.from("perfis").select("id, genero").eq("id", lider.id).single();
    expect(perfil.data).toEqual({ id: lider.id, genero: null });
  });

  it("o cadastro grava o Gênero no perfil, com ou sem convite", async () => {
    const semConvite = await cadastrar("Nova", undefined, "feminino");
    expect(semConvite.error).toBeNull();
    expect(await generoDe(semConvite.id!)).toBe("feminino");

    const lucas = await contaNova("Lucas", "admin");
    const { data: convite } = await lucas.cliente
      .from("convites")
      .insert({ nivel: "professor", funcao_id: null })
      .select("codigo")
      .single()
      .throwOnError();
    const professor = await cadastrar("Prof", convite!.codigo, "masculino");
    expect(professor.error).toBeNull();
    expect(await generoDe(professor.id!)).toBe("masculino");
  });

  it("o fluxo de criação de contas não quebra com Gênero ausente ou inválido", async () => {
    const sem = await cadastrar("Sem");
    expect(sem.error).toBeNull();
    expect(await generoDe(sem.id!)).toBeNull();

    const invalido = await cadastrar("Invalido", undefined, "outro");
    expect(invalido.error).toBeNull();
    expect(await generoDe(invalido.id!)).toBeNull();
  });

  it("o perfil recusa um valor fora de masculino e feminino", async () => {
    const lider = await contaNova("Carol", "lider");
    const { error } = await admin.from("perfis").update({ genero: "outro" }).eq("id", lider.id);
    expect(error).not.toBeNull();
  });

  it("a pessoa aprovada define o próprio Gênero", async () => {
    const lider = await contaNova("Carol", "lider");
    expect((await lider.cliente.rpc("definir_genero", { pessoa: lider.id, novo_genero: "feminino" })).error).toBeNull();
    expect(await generoDe(lider.id)).toBe("feminino");
    expect((await lider.cliente.rpc("definir_genero", { pessoa: lider.id, novo_genero: "outro" })).error).not.toBeNull();
  });

  it("a pessoa não altera o Gênero de outra, nem escreve nos perfis direto", async () => {
    const carol = await contaNova("Carol", "lider");
    const outra = await contaNova("Outra", "professor");

    expect((await carol.cliente.rpc("definir_genero", { pessoa: outra.id, novo_genero: "masculino" })).error).not.toBeNull();
    expect(await generoDe(outra.id)).toBeNull();

    // Nenhum campo do perfil muda por escrita direta: o Gênero, o nível e o `ativo` próprios ficam como estão.
    const direto = await carol.cliente.from("perfis").update({ genero: "masculino" }).eq("id", carol.id).select("id");
    expect(direto.error !== null || direto.data?.length === 0).toBe(true);
    const nivel = await carol.cliente.from("perfis").update({ nivel: "admin" }).eq("id", carol.id).select("id");
    expect(nivel.error !== null || nivel.data?.length === 0).toBe(true);
    expect(await generoDe(carol.id)).toBeNull();
  });

  it("o Pendente não define o Gênero", async () => {
    const pendente = await contaNova("Pendente");
    expect((await pendente.cliente.rpc("definir_genero", { pessoa: pendente.id, novo_genero: "masculino" })).error).not.toBeNull();
    expect(await generoDe(pendente.id)).toBeNull();
  });

  it("o Admin completa o Gênero de qualquer pessoa", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const professor = await contaNova("Prof", "professor");
    expect((await lucas.cliente.rpc("definir_genero", { pessoa: professor.id, novo_genero: "masculino" })).error).toBeNull();
    expect(await generoDe(professor.id)).toBe("masculino");
    expect((await lucas.cliente.rpc("definir_genero", { pessoa: lucas.id, novo_genero: "feminino" })).error).toBeNull();
  });

  it("o Professor lê só o próprio perfil; Pendente e Professor não veem o Gênero dos outros", async () => {
    const lider = await contaNova("Carol", "lider");
    await lider.cliente.rpc("definir_genero", { pessoa: lider.id, novo_genero: "feminino" });
    const professor = await contaNova("Prof", "professor");
    const pendente = await contaNova("Pendente");
    for (const quem of [professor, pendente]) {
      const { data } = await quem.cliente.from("perfis").select("id, genero").eq("id", lider.id);
      expect(data).toEqual([]);
    }
  });

  it("o Log registra só que o Gênero mudou, sem o valor", async () => {
    const lider = await contaNova("Carol", "lider");
    await funcao("Líder do louvor");
    await lider.cliente.rpc("definir_genero", { pessoa: lider.id, novo_genero: "feminino" }).throwOnError();

    const { data } = await admin.from("logs").select("acao, detalhes").eq("objeto_id", lider.id).eq("acao", "conta.editada").throwOnError();
    expect(data).toHaveLength(1);
    expect(data![0].detalhes).toEqual({ mudancas: [{ rotulo: "Gênero", tipo: "oculto" }] });
    expect(JSON.stringify(data)).not.toContain("feminino");
  });
});
