import { describe, expect, it } from "vitest";
import { admin, anonimo, comFuncoes, contaNova } from "./ambiente";

const base = { nome: "Bia", nascimento: "2010-05-10" };
const generoDe = async (id: string) => (await admin.from("adolescentes").select("genero").eq("id", id).single().throwOnError()).data!.genero;

/** Um Adolescente "antigo": a coluna é nula e o gatilho de INSERT só vale para quem entra agora. */
async function adolescenteAntigo(nome: string) {
  const { data } = await admin.from("adolescentes").insert({ ...base, nome, genero: "feminino" }).select("id").single().throwOnError();
  return data!.id as string;
}

describe("Gênero dos Adolescentes: cadastro", () => {
  it("o novo precisa do Gênero: sem ele ou com valor inválido, o banco recusa", async () => {
    const lider = await comFuncoes("Carol", "lider", ["Líder do louvor"]);
    for (const genero of [undefined, null, "", "outro"]) {
      const { error } = await lider.cliente.from("adolescentes").insert({ ...base, genero } as never);
      expect(error).not.toBeNull();
    }
    const feito = await lider.cliente.from("adolescentes").insert({ ...base, genero: "masculino" }).select("id, genero").single();
    expect(feito.error).toBeNull();
    expect(feito.data!.genero).toBe("masculino");
  });

  it("Líder e Admin editam o Gênero de qualquer Adolescente", async () => {
    const id = await adolescenteAntigo("Lia");
    for (const quem of [await comFuncoes("Carol", "lider", ["Líder do louvor"]), await contaNova("Admin", "admin")]) {
      for (const genero of ["masculino", "feminino"]) {
        const { data } = await quem.cliente.from("adolescentes").update({ genero }).eq("id", id).select("genero");
        expect(data).toEqual([{ genero }]);
      }
    }
    expect(await generoDe(id)).toBe("feminino");
  });

  it("valor fora de masculino/feminino é recusado também na edição", async () => {
    const id = await adolescenteAntigo("Lia");
    const lider = await comFuncoes("Carol", "lider", ["Líder do louvor"]);
    expect((await lider.cliente.from("adolescentes").update({ genero: "x" }).eq("id", id)).error).not.toBeNull();
    expect(await generoDe(id)).toBe("feminino");
  });
});

describe("Gênero dos Adolescentes: registros antigos", () => {
  it("sem Gênero seguem válidos, e inativar, reativar e editar o nome continuam funcionando", async () => {
    const lider = await comFuncoes("Carol", "lider", ["Líder do louvor"]);
    const { data } = await admin.from("adolescentes").insert({ ...base, nome: "Antiga", genero: "feminino" }).select("id").single().throwOnError();
    await admin.from("adolescentes").update({ genero: null }).eq("id", data!.id).throwOnError(); // volta ao estado de antes da coluna
    expect(await generoDe(data!.id)).toBeNull();

    const lido = await lider.cliente.from("adolescentes").select("id, genero").eq("id", data!.id).single();
    expect(lido.data).toEqual({ id: data!.id, genero: null });

    for (const mudanca of [{ ativo: false }, { ativo: true }, { nome: "Antiga Renomeada" }]) {
      const { data: feito, error } = await lider.cliente.from("adolescentes").update(mudanca).eq("id", data!.id).select("id");
      expect(error).toBeNull();
      expect(feito).toHaveLength(1);
    }
    expect(await generoDe(data!.id)).toBeNull();
  });
});

describe("Gênero dos Adolescentes: quem lê e escreve", () => {
  it("Professor, Pendente, desativado e anônimo não leem nem editam", async () => {
    const id = await adolescenteAntigo("Lia");
    const professor = await contaNova("Paulo", "professor");
    const pendente = await contaNova("Novato");
    const desativado = await comFuncoes("Saiu", "lider", ["Líder do louvor"], false);

    for (const quem of [professor.cliente, pendente.cliente, desativado.cliente, anonimo()]) {
      const { data } = await quem.from("adolescentes").select("id, genero").eq("id", id);
      expect(data ?? []).toEqual([]);
      const edicao = await quem.from("adolescentes").update({ genero: "masculino" }).eq("id", id).select("id");
      expect(edicao.data ?? []).toEqual([]);
      expect((await quem.from("adolescentes").insert({ ...base, genero: "masculino" })).error).not.toBeNull();
    }
    expect(await generoDe(id)).toBe("feminino");
  });
});

describe("Gênero dos Adolescentes: Log", () => {
  it("a mudança vira Log só com o fato, sem o valor", async () => {
    const lider = await comFuncoes("Carol", "lider", ["Líder do louvor"]);
    const { data } = await lider.cliente.from("adolescentes").insert({ ...base, genero: "feminino" }).select("id").single().throwOnError();
    await lider.cliente.from("adolescentes").update({ genero: "masculino" }).eq("id", data.id).throwOnError();

    const { data: logs } = await admin.from("logs").select("acao, detalhes").eq("objeto_id", data.id).order("id").throwOnError();
    expect(logs!.map((l) => l.acao)).toEqual(["adolescente.cadastrado", "adolescente.editado"]);
    expect(logs![1].detalhes).toEqual({ mudancas: [{ rotulo: "Gênero", tipo: "oculto" }] });
    expect(JSON.stringify(logs)).not.toMatch(/masculino|feminino/);
  });
});
