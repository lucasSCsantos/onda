import { describe, expect, it } from "vitest";
import { admin, anonimo, cadastrar, contaNova, funcao, SENHA } from "./ambiente";

describe("cadastro sem convite", () => {
  it("cria um Pendente, que lê só o próprio perfil e nenhum dado do ministério", async () => {
    await contaNova("Carol", "lider");
    const novo = await cadastrar("Novato");
    expect(novo.error).toBeNull();

    const perfis = await novo.cliente.from("perfis").select("id, nome, nivel, data_nascimento");
    expect(perfis.data).toEqual([{ id: novo.id, nome: "Novato", nivel: "pendente", data_nascimento: "2000-05-10" }]);

    const funcoes = await novo.cliente.from("funcoes").select("id");
    expect(funcoes.data).toEqual([]);
    const areas = await novo.cliente.from("areas").select("id");
    expect(areas.data).toEqual([]);
    const convites = await novo.cliente.from("convites").select("id");
    expect(convites.data).toEqual([]);
  });
});

describe("convites", () => {
  async function conviteDoAdmin(nivel: "lider" | "professor" | "admin", nomeDaFuncao?: string) {
    const lucas = await contaNova("Lucas", "admin");
    const funcao_id = nomeDaFuncao ? await funcao(nomeDaFuncao) : null;
    const { data, error } = await lucas.cliente
      .from("convites")
      .insert({ nivel, funcao_id })
      .select("id, codigo, expira_em, criado_em")
      .single();
    if (error) throw error;
    return { lucas, convite: data };
  }

  it("o Admin gera um convite que vale por 7 dias por padrão", async () => {
    const { convite } = await conviteDoAdmin("lider", "Líder do louvor");

    const dias = (Date.parse(convite.expira_em) - Date.parse(convite.criado_em)) / 86_400_000;
    expect(dias).toBe(7);
  });

  it("quem se cadastra pelo convite entra já com o nível e a Função dele", async () => {
    const { lucas, convite } = await conviteDoAdmin("lider", "Líder do louvor");

    const beythel = await cadastrar("Beythel", convite.codigo);
    expect(beythel.error).toBeNull();

    const perfil = await beythel.cliente.from("perfis").select("nivel").eq("id", beythel.id!).single();
    expect(perfil.data?.nivel).toBe("lider");
    const funcoes = await beythel.cliente.from("funcoes_das_pessoas").select("funcoes(nome)").eq("pessoa_id", beythel.id!);
    expect(funcoes.data).toEqual([{ funcoes: { nome: "Líder do louvor" } }]);

    const usado = await lucas.cliente.from("convites").select("usado_por, usado_em").eq("id", convite.id).single();
    expect(usado.data?.usado_por).toBe(beythel.id);
  });

  it("o segundo uso do convite é recusado", async () => {
    const { convite } = await conviteDoAdmin("lider", "Líder do louvor");
    await cadastrar("Primeira", convite.codigo);

    const segunda = await cadastrar("Segunda", convite.codigo);

    expect(segunda.error).not.toBeNull();
    expect(await situacao(convite.codigo)).toBe("usado");
  });

  it("o convite vencido é recusado", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const dezDiasAtras = new Date(Date.now() - 10 * 86_400_000);
    const { data: convite } = await admin
      .from("convites")
      .insert({
        nivel: "professor",
        criado_por: lucas.id,
        criado_em: dezDiasAtras.toISOString(),
        expira_em: new Date(dezDiasAtras.getTime() + 7 * 86_400_000).toISOString(),
      })
      .select("codigo")
      .single()
      .throwOnError();

    const tarde = await cadastrar("Atrasado", convite.codigo);

    expect(tarde.error).not.toBeNull();
    expect(await situacao(convite.codigo)).toBe("vencido");
  });

  it("o convite revogado pelo Admin é recusado", async () => {
    const { lucas, convite } = await conviteDoAdmin("professor");
    const revogacao = await lucas.cliente
      .from("convites")
      .update({ revogado_em: new Date().toISOString() })
      .eq("id", convite.id);
    expect(revogacao.error).toBeNull();

    const tarde = await cadastrar("Revogado", convite.codigo);

    expect(tarde.error).not.toBeNull();
    expect(await situacao(convite.codigo)).toBe("revogado");
  });

  it("um código que não existe é recusado", async () => {
    const intruso = await cadastrar("Intruso", crypto.randomUUID());
    expect(intruso.error).not.toBeNull();
  });

  it("só o Admin gera e lê convites", async () => {
    const { convite } = await conviteDoAdmin("professor");

    for (const nivel of ["lider", "professor", "pendente"] as const) {
      const pessoa = await contaNova(`Sem permissão (${nivel})`, nivel);
      const leitura = await pessoa.cliente.from("convites").select("id").eq("id", convite.id);
      expect(leitura.data).toEqual([]);
      const geracao = await pessoa.cliente.from("convites").insert({ nivel: "admin" });
      expect(geracao.error).not.toBeNull();
    }
  });
});

describe("aprovação de Pendentes", () => {
  it("o Admin vê o Pendente e o aprova com nível e Função; ele passa a ver o ministério", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const novo = await cadastrar("Mariana");

    const pendentes = await lucas.cliente.from("perfis").select("id").eq("nivel", "pendente").eq("id", novo.id!);
    expect(pendentes.data).toEqual([{ id: novo.id }]);

    const aprovacao = await lucas.cliente.rpc("aprovar_pendente", {
      pessoa: novo.id,
      novo_nivel: "lider",
      funcao: await funcao("Líder de integração e programação"),
    });
    expect(aprovacao.error).toBeNull();

    const perfil = await novo.cliente.from("perfis").select("nivel").eq("id", novo.id!).single();
    expect(perfil.data?.nivel).toBe("lider");
    const funcoes = await novo.cliente.from("funcoes").select("id");
    expect(funcoes.data?.length).toBeGreaterThan(0);
  });

  it("um Líder precisa de uma Função para ser aprovado", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const novo = await cadastrar("Sem função");

    const aprovacao = await lucas.cliente.rpc("aprovar_pendente", { pessoa: novo.id, novo_nivel: "lider" });

    expect(aprovacao.error).not.toBeNull();
  });

  it("um Professor não recebe Função, nem por aprovação nem por convite", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const novo = await cadastrar("Professor");
    const ensino = await funcao("Líder do ensino");

    const aprovacao = await lucas.cliente.rpc("aprovar_pendente", { pessoa: novo.id, novo_nivel: "professor", funcao: ensino });
    expect(aprovacao.error).not.toBeNull();
    const convite = await lucas.cliente.from("convites").insert({ nivel: "professor", funcao_id: ensino });
    expect(convite.error).not.toBeNull();
  });

  it("o Admin recusa o Pendente e a conta deixa de existir", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const novo = await cadastrar("Estranho");

    const recusa = await lucas.cliente.rpc("recusar_pendente", { pessoa: novo.id });
    expect(recusa.error).toBeNull();

    const perfil = await lucas.cliente.from("perfis").select("id").eq("id", novo.id!);
    expect(perfil.data).toEqual([]);
    const login = await anonimo().auth.signInWithPassword({ email: novo.email, password: SENHA });
    expect(login.error).not.toBeNull();
  });

  it("o Admin não recusa quem já foi aprovado", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const carol = await contaNova("Carol", "lider");

    const recusa = await lucas.cliente.rpc("recusar_pendente", { pessoa: carol.id });

    expect(recusa.error).not.toBeNull();
  });

  it("Líder, Professor e Pendente não aprovam nem recusam", async () => {
    for (const nivel of ["lider", "professor", "pendente"] as const) {
      const pessoa = await contaNova(`Sem permissão (${nivel})`, nivel);
      const novo = await cadastrar("Aguardando");

      const aprovacao = await pessoa.cliente.rpc("aprovar_pendente", { pessoa: novo.id, novo_nivel: "admin" });
      expect(aprovacao.error).not.toBeNull();
      const recusa = await pessoa.cliente.rpc("recusar_pendente", { pessoa: novo.id });
      expect(recusa.error).not.toBeNull();

      const perfil = await admin.from("perfis").select("nivel").eq("id", novo.id!).single();
      expect(perfil.data?.nivel).toBe("pendente");
    }
  });
});

describe("desativação", () => {
  it("o Admin desativa um usuário: ele perde o acesso, mas a conta continua no histórico", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const carol = await contaNova("Carol", "lider");
    const denize = await contaNova("Denize", "lider");

    const desativacao = await lucas.cliente.from("perfis").update({ ativo: false }).eq("id", denize.id);
    expect(desativacao.error).toBeNull();

    const outros = await denize.cliente.from("perfis").select("id").eq("id", carol.id);
    expect(outros.data).toEqual([]);
    const funcoes = await denize.cliente.from("funcoes").select("id");
    expect(funcoes.data).toEqual([]);

    const historico = await carol.cliente.from("perfis").select("nome, ativo").eq("id", denize.id).single();
    expect(historico.data).toEqual({ nome: "Denize", ativo: false });
  });

  it("o Admin não desativa um Pendente, que é aprovado ou recusado", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const novo = await cadastrar("Aguardando");

    await lucas.cliente.from("perfis").update({ ativo: false }).eq("id", novo.id!);

    const perfil = await admin.from("perfis").select("ativo").eq("id", novo.id!).single();
    expect(perfil.data?.ativo).toBe(true);
  });

  it("o Líder não desativa ninguém", async () => {
    const carol = await contaNova("Carol", "lider");
    const denize = await contaNova("Denize", "lider");

    await carol.cliente.from("perfis").update({ ativo: false }).eq("id", denize.id);

    const perfil = await admin.from("perfis").select("ativo").eq("id", denize.id).single();
    expect(perfil.data?.ativo).toBe(true);
  });
});

describe("promoção a Admin", () => {
  it("o Admin promove outra pessoa a Admin", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const carol = await contaNova("Carol", "lider");

    const promocao = await lucas.cliente.rpc("promover_a_admin", { pessoa: carol.id });
    expect(promocao.error).toBeNull();

    const perfil = await admin.from("perfis").select("nivel").eq("id", carol.id).single();
    expect(perfil.data?.nivel).toBe("admin");
  });

  it("ninguém além do Admin promove, nem a si mesmo", async () => {
    for (const nivel of ["lider", "professor", "pendente"] as const) {
      const pessoa = await contaNova(`Ambicioso (${nivel})`, nivel);
      const outra = await contaNova("Outra", "lider");

      await pessoa.cliente.rpc("promover_a_admin", { pessoa: pessoa.id });
      await pessoa.cliente.rpc("promover_a_admin", { pessoa: outra.id });
      await pessoa.cliente.from("perfis").update({ nivel: "admin" }).eq("id", pessoa.id);

      const niveis = await admin.from("perfis").select("id, nivel").in("id", [pessoa.id, outra.id]);
      expect(niveis.data).toEqual(
        expect.arrayContaining([
          { id: pessoa.id, nivel },
          { id: outra.id, nivel: "lider" },
        ]),
      );
    }
  });

  it("o Admin não muda o próprio acesso, para não se trancar fora", async () => {
    const lucas = await contaNova("Lucas", "admin");

    await lucas.cliente.from("perfis").update({ ativo: false }).eq("id", lucas.id);
    await lucas.cliente.rpc("promover_a_admin", { pessoa: lucas.id });

    const perfil = await admin.from("perfis").select("nivel, ativo").eq("id", lucas.id).single();
    expect(perfil.data).toEqual({ nivel: "admin", ativo: true });
  });

  it("o Admin não promove um Pendente, que passa pela aprovação", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const novo = await cadastrar("Apressado");

    const promocao = await lucas.cliente.rpc("promover_a_admin", { pessoa: novo.id });

    expect(promocao.error).not.toBeNull();
  });

  it("o Admin só muda o nível pela aprovação e pela promoção, nunca direto", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const novo = await cadastrar("Sem função");
    const carol = await contaNova("Carol", "lider");

    const atalho = await lucas.cliente.from("perfis").update({ nivel: "lider" }).eq("id", novo.id!);
    expect(atalho.error).not.toBeNull();
    const rebaixamento = await lucas.cliente.from("perfis").update({ nivel: "pendente" }).eq("id", carol.id);
    expect(rebaixamento.error).not.toBeNull();
  });

  it("o Admin não muda nome, e-mail nem data de nascimento por esta via", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const carol = await contaNova("Carol", "lider");

    const edicao = await lucas.cliente.from("perfis").update({ nome: "Outro nome" }).eq("id", carol.id);

    expect(edicao.error).not.toBeNull();
  });
});

describe("quem lê usuários, por nível de acesso", () => {
  it("Admin lê todos; Líder não lê Pendentes; Professor e Pendente leem só a si mesmos", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const carol = await contaNova("Carol", "lider");
    const paulo = await contaNova("Paulo", "professor");
    const novo = await contaNova("Novo", "pendente");
    const todos = [lucas, carol, paulo, novo];
    const ids = todos.map((p) => p.id);

    const visiveis = async (quem: (typeof todos)[number]) => {
      const { data } = await quem.cliente.from("perfis").select("id").in("id", ids);
      return new Set(data?.map((p) => p.id));
    };

    expect(await visiveis(lucas)).toEqual(new Set([lucas.id, carol.id, paulo.id, novo.id]));
    expect(await visiveis(carol)).toEqual(new Set([lucas.id, carol.id, paulo.id]));
    expect(await visiveis(paulo)).toEqual(new Set([paulo.id]));
    expect(await visiveis(novo)).toEqual(new Set([novo.id]));
  });

  it("ninguém, nem o Admin, cria ou apaga perfis diretamente", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const carol = await contaNova("Carol", "lider");

    const criacao = await lucas.cliente.from("perfis").insert({ id: crypto.randomUUID(), nome: "Fantasma" });
    expect(criacao.error).not.toBeNull();

    await lucas.cliente.from("perfis").delete().eq("id", carol.id);
    const ainda = await admin.from("perfis").select("id").eq("id", carol.id);
    expect(ainda.data).toEqual([{ id: carol.id }]);
  });
});

async function situacao(codigo: string) {
  const { data } = await anonimo().rpc("consultar_convite", { codigo }).single<{ situacao: string }>();
  return data?.situacao;
}
