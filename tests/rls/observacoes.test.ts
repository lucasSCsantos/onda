import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { admin, anonimo, comFuncoes, contaNova, type Cliente } from "./ambiente";

const lider = (nome = "Carol") => comFuncoes(nome, "lider", ["Líder do louvor"]);

async function adolescente(nome = "Bia") {
  const { data } = await admin
    .from("adolescentes")
    .insert({ nome, nascimento: "2010-05-10", genero: "feminino" })
    .select("id")
    .single()
    .throwOnError();
  return data!.id as string;
}

/** Uma Observação escrita por `autor` pelo próprio cliente, como o app faz. */
async function escrever(autor: { cliente: Cliente }, adolescenteId: string, texto = "Gosta de violão") {
  const { data, error } = await autor.cliente.from("observacoes").insert({ adolescente_id: adolescenteId, texto }).select("*").single();
  if (error) throw error;
  return data;
}

const doBanco = async (id: string) => (await admin.from("observacoes").select("*").eq("id", id).maybeSingle().throwOnError()).data;
const logsDe = async (adolescenteId: string) =>
  (await admin.from("logs").select("*").eq("objeto_id", adolescenteId).like("acao", "observacao.%").order("id").throwOnError()).data ?? [];

/** Quem não pode nada com Observações: Professor, Pendente, Líder desativado e anônimo. */
async function semAcesso() {
  return [
    (await contaNova("Paulo", "professor")).cliente,
    (await contaNova("Novato")).cliente,
    (await comFuncoes("Saiu", "lider", ["Líder do louvor"], false)).cliente,
    anonimo(),
  ];
}

describe("Observações: quem lê e quem escreve", () => {
  it("Admin e Líder leem e adicionam", async () => {
    const id = await adolescente();
    const chefe = await contaNova("Admin", "admin");
    const carol = await lider();
    await escrever(carol, id, "da Carol");
    await escrever(chefe, id, "do Admin");

    for (const quem of [carol, chefe]) {
      const { data } = await quem.cliente.from("observacoes").select("texto").eq("adolescente_id", id).order("criado_em");
      expect(data!.map((o) => o.texto)).toEqual(["da Carol", "do Admin"]);
    }
  });

  it("Professor, Pendente, desativado e anônimo não leem nem criam", async () => {
    const id = await adolescente();
    const existente = await escrever(await lider(), id);
    for (const cliente of await semAcesso()) {
      const { data } = await cliente.from("observacoes").select("id").eq("id", existente.id);
      expect(data ?? []).toEqual([]);
      expect((await cliente.from("observacoes").insert({ adolescente_id: id, texto: "x" })).error).not.toBeNull();
    }
    const { data } = await admin.from("observacoes").select("id").eq("adolescente_id", id).throwOnError();
    expect(data).toHaveLength(1);
  });

  it("Observação de Adolescente inativo segue visível e aceita novas", async () => {
    const id = await adolescente();
    const carol = await lider();
    await escrever(carol, id, "antes de sair");
    await admin.from("adolescentes").update({ ativo: false }).eq("id", id).throwOnError();

    await escrever(carol, id, "depois de sair");
    const { data } = await carol.cliente.from("observacoes").select("texto").eq("adolescente_id", id).order("criado_em");
    expect(data!.map((o) => o.texto)).toEqual(["antes de sair", "depois de sair"]);
  });
});

describe("Observações: autoria", () => {
  it("o autor vem da sessão e não pode ser forjado", async () => {
    const id = await adolescente();
    const carol = await lider("Carol");
    const outra = await lider("Outra");

    const criada = await escrever(carol, id);
    expect(criada.autor_id).toBe(carol.id);

    const forjada = await carol.cliente.from("observacoes").insert({ adolescente_id: id, texto: "x", autor_id: outra.id });
    expect(forjada.error).not.toBeNull();

    const trocada = await carol.cliente.from("observacoes").update({ autor_id: outra.id }).eq("id", criada.id).select("id");
    expect(trocada.error).not.toBeNull();
    expect((await doBanco(criada.id))!.autor_id).toBe(carol.id);
  });

  it("as datas não vêm do formulário", async () => {
    const id = await adolescente();
    const carol = await lider();
    const { error } = await carol.cliente.from("observacoes").insert({ adolescente_id: id, texto: "x", criado_em: "2020-01-01T00:00:00Z" });
    expect(error).not.toBeNull();
  });

  it("editar muda a data da última edição e mantém a de criação", async () => {
    const id = await adolescente();
    const carol = await lider();
    const criada = await escrever(carol, id);
    await new Promise((r) => setTimeout(r, 1100));

    const { data } = await carol.cliente.from("observacoes").update({ texto: "novo texto" }).eq("id", criada.id).select("*").single();
    expect(data!.texto).toBe("novo texto");
    expect(data!.criado_em).toBe(criada.criado_em);
    expect(Date.parse(data!.editado_em)).toBeGreaterThan(Date.parse(criada.editado_em) + 1000);
  });
});

describe("Observações: editar e apagar", () => {
  it("o autor edita e apaga a própria", async () => {
    const id = await adolescente();
    const carol = await lider();
    const criada = await escrever(carol, id);
    const edicao = await carol.cliente.from("observacoes").update({ texto: "editada" }).eq("id", criada.id).select("id");
    expect(edicao.data).toHaveLength(1);
    const exclusao = await carol.cliente.from("observacoes").delete().eq("id", criada.id).select("id");
    expect(exclusao.data).toHaveLength(1);
    expect(await doBanco(criada.id)).toBeNull();
  });

  it("outro Líder não edita nem apaga", async () => {
    const id = await adolescente();
    const criada = await escrever(await lider("Carol"), id);
    const outro = await lider("Outro");

    const edicao = await outro.cliente.from("observacoes").update({ texto: "invadida" }).eq("id", criada.id).select("id");
    expect(edicao.data ?? []).toEqual([]);
    const exclusao = await outro.cliente.from("observacoes").delete().eq("id", criada.id).select("id");
    expect(exclusao.data ?? []).toEqual([]);
    expect((await doBanco(criada.id))!.texto).toBe("Gosta de violão");
  });

  it("o Admin edita e apaga a de qualquer Líder, e o autor continua o mesmo", async () => {
    const id = await adolescente();
    const carol = await lider();
    const criada = await escrever(carol, id);
    const chefe = await contaNova("Admin", "admin");

    const edicao = await chefe.cliente.from("observacoes").update({ texto: "moderada" }).eq("id", criada.id).select("id");
    expect(edicao.data).toHaveLength(1);
    expect(await doBanco(criada.id)).toMatchObject({ texto: "moderada", autor_id: carol.id });
    const exclusao = await chefe.cliente.from("observacoes").delete().eq("id", criada.id).select("id");
    expect(exclusao.data).toHaveLength(1);
  });

  it("Professor, Pendente, desativado e anônimo não editam nem apagam", async () => {
    const id = await adolescente();
    const criada = await escrever(await lider(), id);
    for (const cliente of await semAcesso()) {
      expect((await cliente.from("observacoes").update({ texto: "x" }).eq("id", criada.id).select("id")).data ?? []).toEqual([]);
      expect((await cliente.from("observacoes").delete().eq("id", criada.id).select("id")).data ?? []).toEqual([]);
    }
    expect((await doBanco(criada.id))!.texto).toBe("Gosta de violão");
  });

  it("um Líder desativado não edita nem apaga nem a própria", async () => {
    const id = await adolescente();
    const carol = await lider();
    const criada = await escrever(carol, id);
    await admin.from("perfis").update({ ativo: false }).eq("id", carol.id).throwOnError();
    expect((await carol.cliente.from("observacoes").update({ texto: "x" }).eq("id", criada.id).select("id")).data ?? []).toEqual([]);
    expect((await carol.cliente.from("observacoes").delete().eq("id", criada.id).select("id")).data ?? []).toEqual([]);
  });
});

describe("Observações: limites do texto", () => {
  it("vazio, só espaços e mais de 2.000 caracteres são recusados; 2.000 passa", async () => {
    const id = await adolescente();
    const carol = await lider();
    for (const texto of ["", "   \n ", "a".repeat(2001)]) {
      expect((await carol.cliente.from("observacoes").insert({ adolescente_id: id, texto })).error).not.toBeNull();
    }
    expect((await carol.cliente.from("observacoes").insert({ adolescente_id: id, texto: "a".repeat(2000) })).error).toBeNull();
  });

  it("a edição também respeita o limite", async () => {
    const id = await adolescente();
    const carol = await lider();
    const criada = await escrever(carol, id);
    for (const texto of ["", "a".repeat(2001)]) {
      expect((await carol.cliente.from("observacoes").update({ texto }).eq("id", criada.id)).error).not.toBeNull();
    }
    expect((await doBanco(criada.id))!.texto).toBe("Gosta de violão");
  });
});

describe("Observações: Logs sem o texto", () => {
  it("adicionar, editar e apagar geram Log com o Adolescente e quem fez, e o texto não aparece em nenhum Log", async () => {
    const id = await adolescente("Beatriz");
    const carol = await lider("Carol");
    const marca = `SEGREDO-ZXQ-${crypto.randomUUID()}`;

    const criada = await escrever(carol, id, `${marca} criada`);
    await carol.cliente.from("observacoes").update({ texto: `${marca} editada` }).eq("id", criada.id).throwOnError();
    await carol.cliente.from("observacoes").delete().eq("id", criada.id).throwOnError();

    const logs = await logsDe(id);
    expect(logs.map((l) => l.acao)).toEqual(["observacao.adicionada", "observacao.editada", "observacao.apagada"]);
    for (const log of logs) {
      expect(log).toMatchObject({
        modulo: "adolescentes",
        objeto_tipo: "adolescente",
        objeto_rotulo: "Beatriz",
        usuario_id: carol.id,
        usuario_nome: "Carol",
        resultado: "sucesso",
      });
      expect(log.detalhes).toEqual({});
    }

    // Procura o texto em cada campo (detalhes e rótulos incluídos) de todos os Logs.
    const todos = (await admin.from("logs").select("*").throwOnError()).data ?? [];
    expect(JSON.stringify(todos)).not.toContain(marca);
  });

  it("editar sem mudar o texto não gera Log", async () => {
    const id = await adolescente();
    const carol = await lider();
    const criada = await escrever(carol, id);
    await carol.cliente.from("observacoes").update({ texto: criada.texto }).eq("id", criada.id).throwOnError();
    expect((await logsDe(id)).map((l) => l.acao)).toEqual(["observacao.adicionada"]);
  });

  it("o texto não aparece em Notificações nem no histórico de exportações", async () => {
    const id = await adolescente();
    const marca = `SEGREDO-NOTIF-${crypto.randomUUID()}`;
    await escrever(await lider(), id, marca);
    for (const tabela of ["notificacoes", "exportacoes", "logs"] as const) {
      const { data } = await admin.from(tabela).select("*").throwOnError();
      expect(JSON.stringify(data), tabela).not.toContain(marca);
    }
  });
});

describe("Observações: preservação", () => {
  it("a Liderança não apaga Adolescente (só inativa), então nada apaga as Observações", async () => {
    const id = await adolescente();
    const carol = await lider();
    const criada = await escrever(carol, id);
    const exclusao = await carol.cliente.from("adolescentes").delete().eq("id", id).select("id");
    expect(exclusao.data ?? []).toEqual([]);
    expect(await doBanco(criada.id)).not.toBeNull();
  });

  it("a remoção de um Adolescente (só pelo banco) leva as Observações junto e gera Log de cada", async () => {
    const id = await adolescente("Removido");
    await escrever(await lider(), id);
    await admin.from("adolescentes").delete().eq("id", id).throwOnError();
    expect((await admin.from("observacoes").select("id").eq("adolescente_id", id).throwOnError()).data).toEqual([]);
    expect((await logsDe(id)).map((l) => l.acao)).toEqual(["observacao.adicionada", "observacao.apagada"]);
  });
});

describe("Observações: fora dos canais públicos", () => {
  const raiz = join(__dirname, "..", "..", "src");
  // O Evento tem o próprio campo "observações" (coluna de `eventos`): o que não pode aparecer é a tabela nova ou o módulo.
  const TABELA_DAS_OBSERVACOES = /from\(\s*["']observacoes["']|observacoes\s*\(|dominio\/observacoes|autor_id/i;
  const arquivos = (caminho: string): string[] =>
    statSync(caminho).isDirectory() ? readdirSync(caminho).flatMap((nome) => arquivos(join(caminho, nome))) : [caminho];

  it("o código do feed .ics, das exportações CSV, das Notificações e da busca nunca toca nas Observações", () => {
    const alvo = ["lib/calendario", "lib/exportacao", "lib/notificacoes", "lib/push", "app/api", "app/feed", "dominio/exportacao.ts", "dominio/csv.ts", "dominio/assinatura-de-calendario.ts", "dominio/adolescentes.ts"]
      .map((p) => join(raiz, p))
      .flatMap(arquivos)
      .filter((a) => !/\.test\.tsx?$/.test(a));
    expect(alvo.length).toBeGreaterThan(5);
    for (const arquivo of alvo) expect(readFileSync(arquivo, "utf8").toLowerCase(), arquivo).not.toMatch(TABELA_DAS_OBSERVACOES);
  });
});
