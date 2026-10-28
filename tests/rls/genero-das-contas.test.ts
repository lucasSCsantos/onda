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

  it("a pessoa aprovada edita os próprios dados pessoais (nome, nascimento e Gênero)", async () => {
    const lider = await contaNova("Carol", "lider");
    const editar = (mudancas: Partial<{ novo_nome: string; novo_nascimento: string | null; novo_genero: string | null }> = {}) =>
      lider.cliente.rpc("editar_meus_dados", { novo_nome: "Carolina", novo_nascimento: "1990-05-10", novo_genero: "feminino", ...mudancas });

    expect((await editar()).error).toBeNull();
    const perfil = await admin.from("perfis").select("nome, data_nascimento, genero").eq("id", lider.id).single().throwOnError();
    expect(perfil.data).toEqual({ nome: "Carolina", data_nascimento: "1990-05-10", genero: "feminino" });

    for (const invalido of [{ novo_genero: "outro" }, { novo_genero: null }, { novo_nome: "  " }, { novo_nascimento: null }, { novo_nascimento: "2999-01-01" }]) {
      expect((await editar(invalido)).error, JSON.stringify(invalido)).not.toBeNull();
    }
    expect((await admin.from("perfis").select("nome, genero").eq("id", lider.id).single().throwOnError()).data).toEqual({ nome: "Carolina", genero: "feminino" });
  });

  it("a função só edita quem está logado: ninguém, nem o Admin, edita os dados de outra pessoa", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const outra = await contaNova("Outra", "professor");
    // A função não recebe a pessoa: a chamada do Admin só alcança o próprio perfil.
    expect((await lucas.cliente.rpc("editar_meus_dados", { novo_nome: "Lucas S.", novo_nascimento: "1980-01-01", novo_genero: "masculino" })).error).toBeNull();
    expect((await admin.from("perfis").select("nome, data_nascimento, genero").eq("id", outra.id).single().throwOnError()).data).toEqual({ nome: "Outra", data_nascimento: null, genero: null });
    // A função antiga, que deixava o Admin definir o Gênero de outra pessoa, não existe mais.
    const antiga = await lucas.cliente.rpc("definir_genero", { pessoa: outra.id, novo_genero: "masculino" });
    expect(antiga.error).not.toBeNull();
    expect(await generoDe(outra.id)).toBeNull();
  });

  it("nem a pessoa nem o Admin escrevem nos perfis direto", async () => {
    const carol = await contaNova("Carol", "lider");
    const lucas = await contaNova("Lucas", "admin");
    for (const quem of [carol, lucas]) {
      for (const mudanca of [{ genero: "masculino" }, { nome: "Outro nome" }, { data_nascimento: "1990-01-01" }]) {
        const direto = await quem.cliente.from("perfis").update(mudanca).eq("id", carol.id).select("id");
        expect(direto.error !== null || direto.data?.length === 0).toBe(true);
      }
    }
    expect((await admin.from("perfis").select("nome, genero").eq("id", carol.id).single().throwOnError()).data).toEqual({ nome: "Carol", genero: null });
  });

  it("o Pendente não edita os dados", async () => {
    const pendente = await contaNova("Pendente");
    expect((await pendente.cliente.rpc("editar_meus_dados", { novo_nome: "X", novo_nascimento: "1990-01-01", novo_genero: "masculino" })).error).not.toBeNull();
    expect(await generoDe(pendente.id)).toBeNull();
  });

  it("a conta desativada não edita os dados", async () => {
    const lider = await contaNova("Saiu", "lider");
    await admin.from("perfis").update({ ativo: false }).eq("id", lider.id).throwOnError();
    expect((await lider.cliente.rpc("editar_meus_dados", { novo_nome: "X", novo_nascimento: "1990-01-01", novo_genero: "masculino" })).error).not.toBeNull();
  });

  it("o Professor lê só o próprio perfil; Pendente e Professor não veem o Gênero dos outros", async () => {
    const lider = await contaNova("Carol", "lider");
    await lider.cliente.rpc("editar_meus_dados", { novo_nome: "Carol", novo_nascimento: "1990-05-10", novo_genero: "feminino" });
    const professor = await contaNova("Prof", "professor");
    const pendente = await contaNova("Pendente");
    for (const quem of [professor, pendente]) {
      const { data } = await quem.cliente.from("perfis").select("id, genero").eq("id", lider.id);
      expect(data).toEqual([]);
    }
  });

  it("o Log registra o nome e só diz que a data de nascimento e o Gênero mudaram, sem os valores", async () => {
    const lider = await contaNova("Carol", "lider");
    await funcao("Líder do louvor");
    await lider.cliente.rpc("editar_meus_dados", { novo_nome: "Carolina", novo_nascimento: "1990-05-10", novo_genero: "feminino" }).throwOnError();

    const { data } = await admin.from("logs").select("acao, detalhes").eq("objeto_id", lider.id).eq("acao", "conta.editada").throwOnError();
    expect(data).toHaveLength(1);
    expect(data![0].detalhes).toEqual({
      mudancas: [
        { rotulo: "Nome", tipo: "texto", antes: "Carol", depois: "Carolina" },
        { rotulo: "Data de nascimento", tipo: "oculto" },
        { rotulo: "Gênero", tipo: "oculto" },
      ],
    });
    expect(JSON.stringify(data)).not.toContain("feminino");
    expect(JSON.stringify(data)).not.toContain("1990");
  });
});
