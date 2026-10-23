import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ICONES_DOS_ATALHOS } from "@/dominio/arquivos";
import { admin, anonimo, comFuncoes, contaNova, funcao, type Cliente } from "./ambiente";

const PASTA = "1AbCdEfGhIjKlMnOpQ";

const salvar = (cliente: Cliente, mudancas: { atalho?: string | null; nome?: string; icone?: string; pasta?: string; funcoes?: string[] } = {}) =>
  cliente.rpc("salvar_atalho", {
    atalho: mudancas.atalho ?? null,
    novo_nome: mudancas.nome ?? "Identidade visual",
    novo_icone: mudancas.icone ?? "palette",
    nova_pasta: mudancas.pasta ?? PASTA,
    novas_funcoes: mudancas.funcoes ?? [],
  });

const idsVisiveis = async (cliente: Cliente) => ((await cliente.from("atalhos_de_arquivos").select("id")).data ?? []).map((a) => a.id as string);

let boss: Awaited<ReturnType<typeof contaNova>>;
const criados: string[] = [];

/** Um atalho feito pelo Admin; `funcoes` pelo nome. */
async function atalho(funcoes: string[] = [], nome = "Atalho de teste") {
  const { data, error } = await salvar(boss.cliente, { nome, funcoes: await Promise.all(funcoes.map(funcao)) });
  if (error) throw error;
  criados.push(data as string);
  return data as string;
}

beforeAll(async () => {
  boss = await contaNova("Admin dos atalhos", "admin");
});

afterAll(async () => {
  if (criados.length) await admin.from("atalhos_de_arquivos").delete().in("id", criados);
});

describe("quem vê cada atalho", () => {
  it("sem Função marcada, toda a Liderança vê; Professor e Pendente não", async () => {
    const id = await atalho();
    const lider = await comFuncoes("Líder de louvor", "lider", ["Líder do louvor"]);
    const professor = await comFuncoes("Professor", "professor", []);
    const pendente = await contaNova("Pendente");

    expect(await idsVisiveis(lider.cliente)).toContain(id);
    expect(await idsVisiveis(boss.cliente)).toContain(id);
    expect(await idsVisiveis(professor.cliente)).toEqual([]);
    expect(await idsVisiveis(pendente.cliente)).toEqual([]);
    expect(await idsVisiveis(anonimo())).toEqual([]);
  });

  it("com Função marcada, só quem tem uma delas vê", async () => {
    const id = await atalho(["Líder do louvor", "Líder do ensino"]);
    const doLouvor = await comFuncoes("Louvor", "lider", ["Líder do louvor"]);
    const doEnsino = await comFuncoes("Ensino", "lider", ["Líder do ensino"]);
    const deOutraArea = await comFuncoes("Comunicação", "lider", ["Líder de comunicação e mídia"]);

    expect(await idsVisiveis(doLouvor.cliente)).toContain(id);
    expect(await idsVisiveis(doEnsino.cliente)).toContain(id);
    expect(await idsVisiveis(deOutraArea.cliente)).not.toContain(id);
  });

  it("o Admin e a Função Geral veem todos, marcados ou não", async () => {
    const id = await atalho(["Líder do louvor"]);
    const geral = await comFuncoes("Co-líder", "lider", ["Co-líder do ministério"]);
    expect(await idsVisiveis(geral.cliente)).toContain(id);
    expect(await idsVisiveis(boss.cliente)).toContain(id);
  });

  it("quem tem duas Funções vê pelo que uma delas permite", async () => {
    const id = await atalho(["Líder do louvor"]);
    const duas = await comFuncoes("Duas", "lider", ["Líder de comunicação e mídia", "Líder do louvor"]);
    expect(await idsVisiveis(duas.cliente)).toContain(id);
  });

  it("quem foi desativado deixa de ver", async () => {
    const id = await atalho();
    const desativado = await comFuncoes("Desativado", "lider", ["Líder do louvor"], false);
    expect(await idsVisiveis(desativado.cliente)).not.toContain(id);
  });

  it("só o Admin lê quais Funções cada atalho marca", async () => {
    const id = await atalho(["Líder do louvor"]);
    const lider = await comFuncoes("Louvor", "lider", ["Líder do louvor"]);
    expect((await boss.cliente.from("funcoes_dos_atalhos").select("funcao_id").eq("atalho_id", id)).data).toHaveLength(1);
    expect((await lider.cliente.from("funcoes_dos_atalhos").select("funcao_id")).data).toEqual([]);
  });
});

describe("cadastrar e editar", () => {
  it("o Admin cria e edita com as Funções juntas, e a nova entra no fim da ordem", async () => {
    const primeiro = await atalho();
    const segundo = await atalho();
    const { data } = await admin.from("atalhos_de_arquivos").select("id, ordem").in("id", [primeiro, segundo]);
    const ordem = (id: string) => data!.find((a) => a.id === id)!.ordem as number;
    expect(ordem(segundo)).toBeGreaterThan(ordem(primeiro));

    const { error } = await salvar(boss.cliente, { atalho: primeiro, nome: "Outro nome", icone: "tent", pasta: "ZyXwVuTsRqPoNmLkJi", funcoes: [await funcao("Líder do ensino")] });
    expect(error).toBeNull();
    const linha = (await admin.from("atalhos_de_arquivos").select("nome, icone, pasta_id").eq("id", primeiro).single().throwOnError()).data;
    expect(linha).toEqual({ nome: "Outro nome", icone: "tent", pasta_id: "ZyXwVuTsRqPoNmLkJi" });
    const ligadas = (await admin.from("funcoes_dos_atalhos").select("funcao_id").eq("atalho_id", primeiro).throwOnError()).data;
    expect(ligadas).toEqual([{ funcao_id: await funcao("Líder do ensino") }]);
  });

  it("editar tirando todas as Funções devolve o atalho a toda a Liderança", async () => {
    const id = await atalho(["Líder do louvor"]);
    await salvar(boss.cliente, { atalho: id, funcoes: [] }).then((r) => expect(r.error).toBeNull());
    const deOutraArea = await comFuncoes("Comunicação", "lider", ["Líder de comunicação e mídia"]);
    expect(await idsVisiveis(deOutraArea.cliente)).toContain(id);
  });

  it("líder, professor e pendente não criam, não editam e não removem", async () => {
    const id = await atalho();
    const lider = await comFuncoes("Líder", "lider", ["Líder do louvor"]);
    const professor = await comFuncoes("Professor", "professor", []);
    for (const quem of [lider, professor, await contaNova("Pendente")]) {
      expect((await salvar(quem.cliente)).error).not.toBeNull();
      expect((await salvar(quem.cliente, { atalho: id, nome: "Invadido" })).error).not.toBeNull();
      await quem.cliente.from("atalhos_de_arquivos").delete().eq("id", id);
      await quem.cliente.from("atalhos_de_arquivos").update({ nome: "Invadido" }).eq("id", id);
    }
    expect((await admin.from("atalhos_de_arquivos").select("nome").eq("id", id).single().throwOnError()).data!.nome).toBe("Atalho de teste");
    expect((await salvar(anonimo())).error).not.toBeNull();
  });

  it("recusa nome vazio, ícone fora da lista e pasta que não parece uma pasta", async () => {
    expect((await salvar(boss.cliente, { nome: "  " })).error).not.toBeNull();
    expect((await salvar(boss.cliente, { nome: "x".repeat(41) })).error).not.toBeNull();
    expect((await salvar(boss.cliente, { icone: "bomba" })).error).not.toBeNull();
    expect((await salvar(boss.cliente, { pasta: "curta" })).error).not.toBeNull();
    expect((await salvar(boss.cliente, { pasta: "https://drive.google.com/x" })).error).not.toBeNull();
  });

  it("o banco aceita todos os ícones que o domínio oferece", async () => {
    for (const icone of ICONES_DOS_ATALHOS) {
      const { data, error } = await salvar(boss.cliente, { icone });
      expect(error, icone).toBeNull();
      criados.push(data as string);
    }
  });

  it("não aceita editar um atalho que não existe", async () => {
    const { error } = await salvar(boss.cliente, { atalho: crypto.randomUUID() });
    expect(error).not.toBeNull();
  });

  it("o Admin remove, e as Funções ligadas vão junto", async () => {
    const id = await atalho(["Líder do louvor"]);
    expect((await boss.cliente.from("atalhos_de_arquivos").delete().eq("id", id).select("id")).data).toHaveLength(1);
    expect((await admin.from("funcoes_dos_atalhos").select("funcao_id").eq("atalho_id", id).throwOnError()).data).toEqual([]);
  });
});

describe("Logs do módulo drive", () => {
  const logsDe = async (id: string) =>
    (await admin.from("logs").select("acao, modulo, objeto_rotulo, detalhes, usuario_id").eq("objeto_id", id).order("id").throwOnError()).data!;

  it("registra criação, edição (com o que mudou) e remoção, em nome do Admin", async () => {
    const id = await atalho([], "Acampamento");
    await salvar(boss.cliente, { atalho: id, nome: "Acampamento 2027", funcoes: [await funcao("Líder do louvor")] });
    await boss.cliente.from("atalhos_de_arquivos").delete().eq("id", id);

    const logs = await logsDe(id);
    expect(logs.map((l) => l.acao)).toEqual(["drive.atalho_criado", "drive.atalho_editado", "drive.atalho_removido"]);
    expect(logs.every((l) => l.modulo === "drive" && l.usuario_id === boss.id)).toBe(true);
    const mudancas = (logs[1].detalhes as { mudancas: { rotulo: string; antes: unknown; depois: unknown }[] }).mudancas;
    expect(mudancas.map((m) => m.rotulo)).toEqual(["Nome", "Funções que veem"]);
    expect(mudancas[1]).toMatchObject({ antes: [], depois: ["Líder do louvor"] });
    expect(logs[2].objeto_rotulo).toBe("Acampamento 2027");
  });

  it("salvar sem mudar nada não gera Log de edição", async () => {
    const id = await atalho();
    await salvar(boss.cliente, { atalho: id, nome: "Atalho de teste" });
    expect((await logsDe(id)).map((l) => l.acao)).toEqual(["drive.atalho_criado"]);
  });
});
