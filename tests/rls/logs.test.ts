import { describe, expect, it } from "vitest";
import { admin, anonimo, cadastrar, categoria, comFuncoes, contaNova, eventoDe, funcao, SENHA } from "./ambiente";

type LinhaDeLog = {
  id: number;
  acao: string;
  usuario_id: string | null;
  usuario_nome: string | null;
  modulo: string;
  objeto_tipo: string | null;
  objeto_id: string | null;
  objeto_rotulo: string | null;
  resultado: string;
  severidade: string;
  origem: string;
  detalhes: Record<string, unknown> & { mudancas?: unknown[] };
};

/** Os logs de um objeto, em ordem, lidos pela chave de serviço (sem as políticas por linha). */
async function logsDo(objetoId: string): Promise<LinhaDeLog[]> {
  const { data } = await admin.from("logs").select("*").eq("objeto_id", objetoId).order("id").throwOnError();
  return data as LinhaDeLog[];
}

const acoes = (logs: LinhaDeLog[]) => logs.map((l) => l.acao);

const MARIANA = "Líder de integração e programação";
const HORA_MS = 60 * 60 * 1000;
const daqui = (horas: number) => new Date(Date.now() + horas * HORA_MS).toISOString();

/** As colunas de uma Ocorrência como `criar_serie` as recebe. */
function ocorrencia(responsavel: string, inicio: string) {
  const colunas: Record<string, unknown> = eventoDe("", responsavel, { inicio, fim: null });
  delete colunas.categoria_id;
  return colunas;
}

/** A Ocorrência gravada como `editar_eventos` a recebe, com as mudanças por cima. */
const alteracao = (o: Record<string, unknown>, mudancas: Record<string, unknown> = {}) => {
  const { id, titulo, inicio, fim, dia_inteiro, local, responsavel_id, status, observacoes, link, campos } = o;
  return { id, titulo, inicio, fim, dia_inteiro, local, responsavel_id, status, observacoes, link, campos, ...mudancas };
};

describe("logs de Eventos", () => {
  it("criar, editar, mudar Status, cancelar e excluir geram um log cada, com quem fez e o que mudou", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const mariana = await comFuncoes("Mariana", "lider", [MARIANA]);
    const denize = await comFuncoes("Denize", "lider", [MARIANA]);
    const culto = await categoria("Culto");
    const { data: criado } = await mariana.cliente.from("eventos").insert(eventoDe(culto.id, mariana.id)).select("id").single().throwOnError();
    const id = criado.id as string;

    await mariana.cliente.from("eventos").update({ titulo: "Culto jovem", local: "Salão", responsavel_id: denize.id }).eq("id", id).throwOnError();
    await denize.cliente.from("eventos").update({ status: "confirmado" }).eq("id", id).throwOnError();
    await denize.cliente.from("eventos").update({ status: "cancelado" }).eq("id", id).throwOnError();
    await lucas.cliente.from("eventos").delete().eq("id", id).throwOnError();

    const logs = await logsDo(id);
    expect(acoes(logs)).toEqual(["evento.criado", "evento.editado", "evento.status_alterado", "evento.cancelado", "evento.excluido"]);
    expect(logs[0]).toMatchObject({
      usuario_id: mariana.id,
      usuario_nome: "Mariana",
      modulo: "eventos",
      objeto_tipo: "evento",
      objeto_rotulo: "Evento de teste",
      resultado: "sucesso",
      severidade: "info",
      origem: "interface",
      detalhes: { categoria: "Culto", inicio: "2026-10-24T22:00:00+00:00", dia_inteiro: false },
    });
    expect(logs[1].objeto_rotulo).toBe("Culto jovem");
    expect(logs[1].detalhes.mudancas).toEqual([
      { rotulo: "Título", tipo: "texto", antes: "Evento de teste", depois: "Culto jovem" },
      { rotulo: "Local", tipo: "texto", antes: "Templo", depois: "Salão" },
      { rotulo: "Responsável", tipo: "pessoa", antes: "Mariana", depois: "Denize" },
    ]);
    expect(logs[2]).toMatchObject({ usuario_id: denize.id });
    expect(logs[2].detalhes.mudancas).toEqual([{ rotulo: "Status", tipo: "status", antes: "planejado", depois: "confirmado" }]);
    expect(logs[4]).toMatchObject({ usuario_id: lucas.id, objeto_rotulo: "Culto jovem" });
  });

  it("os campos específicos aparecem pelo nome que têm na Categoria, e as pessoas pelo nome", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const professor = await contaNova("Paulo", "professor");
    const ebd = await categoria("EBD");
    const { data } = await lucas.cliente
      .from("eventos")
      .insert(eventoDe(ebd.id, lucas.id, { campos: { [ebd.campo("Tema")]: "Semeador" } }))
      .select("id")
      .single()
      .throwOnError();
    await lucas.cliente
      .from("eventos")
      .update({ campos: { [ebd.campo("Tema")]: "Talentos", [ebd.campo("Professor")]: professor.id } })
      .eq("id", data.id)
      .throwOnError();

    const [, edicao] = await logsDo(data.id);
    expect(edicao.detalhes.mudancas).toEqual([
      { rotulo: "Tema", tipo: "texto_curto", antes: "Semeador", depois: "Talentos" },
      { rotulo: "Professor", tipo: "pessoa", antes: null, depois: "Paulo" },
    ]);
  });

  it("o Realizado automático fica como feito pelo Sistema", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const culto = await categoria("Culto");
    const { data } = await admin
      .from("eventos")
      .insert({ ...eventoDe(culto.id, lucas.id, { inicio: daqui(-3), fim: daqui(-2), status: "confirmado" }), criado_por: lucas.id })
      .select("id")
      .single()
      .throwOnError();
    await admin.rpc("realizar_confirmados").throwOnError();

    const logs = await logsDo(data.id);
    expect(logs.at(-1)).toMatchObject({ acao: "evento.status_alterado", usuario_id: null, usuario_nome: null, origem: "sistema" });
  });
});

describe("logs de Séries", () => {
  it("criar, editar toda a série, encerrar e excluir geram um log cada para a Série, e nenhum por Ocorrência", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const mariana = await comFuncoes("Mariana", "lider", [MARIANA]);
    const culto = await categoria("Culto");
    const { data: serie } = await mariana.cliente
      .rpc("criar_serie", {
        categoria: culto.id,
        regra: { frequencia: "semanal", dias: [0], termino: { ocorrencias: 3 } },
        primeiro_dia: daqui(24).slice(0, 10),
        ocorrencias: [24, 24 * 8, 24 * 15].map((h) => ocorrencia(mariana.id, daqui(h))),
      })
      .throwOnError();
    const id = serie as string;
    const { data: ocorrencias } = await admin.from("eventos").select("*").eq("serie_id", id).order("inicio").throwOnError();

    await mariana.cliente
      .rpc("editar_serie", { serie: id, escopo: "toda", alteracoes: ocorrencias.map((o) => alteracao(o, { local: "Salão" })) })
      .throwOnError();
    await mariana.cliente
      .rpc("encerrar_serie", { serie: id, ate: "2026-11-10", alteracoes: [alteracao(ocorrencias[2], { status: "cancelado" })] })
      .throwOnError();
    await lucas.cliente.from("series").delete().eq("id", id).throwOnError();

    const logs = await logsDo(id);
    expect(acoes(logs)).toEqual(["serie.criada", "serie.editada", "serie.encerrada", "serie.excluida"]);
    expect(logs[0]).toMatchObject({ usuario_id: mariana.id, objeto_tipo: "serie", objeto_rotulo: "Evento de teste", detalhes: { categoria: "Culto", ocorrencias: 3 } });
    expect(logs[1].detalhes).toMatchObject({ escopo: "toda", ocorrencias: 3 });
    expect(logs[1].detalhes.mudancas).toEqual([{ rotulo: "Local", tipo: "texto", antes: "Templo", depois: "Salão" }]);
    expect(logs[2].detalhes).toMatchObject({ encerrada_em: "2026-11-10" });
    expect(logs[3]).toMatchObject({ usuario_id: lucas.id, detalhes: { ocorrencias: 3 } });
    for (const o of ocorrencias) expect(await logsDo(o.id), "Ocorrência").toEqual([]);
  });

  it("uma Ocorrência editada só ela também vira o log da Série, com o escopo", async () => {
    const mariana = await comFuncoes("Mariana", "lider", [MARIANA]);
    const culto = await categoria("Culto");
    const { data: serie } = await mariana.cliente
      .rpc("criar_serie", {
        categoria: culto.id,
        regra: { frequencia: "semanal", dias: [0], termino: { ocorrencias: 2 } },
        primeiro_dia: daqui(24).slice(0, 10),
        ocorrencias: [24, 24 * 8].map((h) => ocorrencia(mariana.id, daqui(h))),
      })
      .throwOnError();
    const { data: ocorrencias } = await admin.from("eventos").select("*").eq("serie_id", serie).order("inicio").throwOnError();
    await mariana.cliente
      .rpc("editar_serie", { serie, escopo: "esta", alteracoes: [alteracao(ocorrencias[0], { titulo: "Só esta", editada: true })] })
      .throwOnError();

    const logs = await logsDo(serie as string);
    expect(logs.at(-1)).toMatchObject({ acao: "serie.editada", detalhes: { escopo: "esta", ocorrencias: 1 } });
    expect(await logsDo(ocorrencias[0].id)).toEqual([]);
  });

  it("editar_serie segue as permissões de editar_eventos e recusa escopo desconhecido", async () => {
    const mariana = await comFuncoes("Mariana", "lider", [MARIANA]);
    const beythel = await comFuncoes("Beythel", "lider", ["Líder do louvor"]);
    const culto = await categoria("Culto");
    const { data: serie } = await mariana.cliente
      .rpc("criar_serie", {
        categoria: culto.id,
        regra: { frequencia: "semanal", dias: [0], termino: { ocorrencias: 1 } },
        primeiro_dia: daqui(24).slice(0, 10),
        ocorrencias: [ocorrencia(mariana.id, daqui(24))],
      })
      .throwOnError();
    const { data: ocorrencias } = await admin.from("eventos").select("*").eq("serie_id", serie).throwOnError();
    const alteracoes = ocorrencias.map((o) => alteracao(o, { local: "Invadido" }));

    expect((await beythel.cliente.rpc("editar_serie", { serie, escopo: "toda", alteracoes })).error?.code).toBe("42501");
    expect((await mariana.cliente.rpc("editar_serie", { serie, escopo: "qualquer", alteracoes })).error).not.toBeNull();
    expect(acoes(await logsDo(serie as string))).toEqual(["serie.criada"]);
  });
});

describe("logs de Adolescentes", () => {
  it("cadastrar, editar, inativar e reativar; da data de nascimento fica só que mudou", async () => {
    const lider = await comFuncoes("Carol", "lider", ["Líder do louvor"]);
    const { data } = await lider.cliente.from("adolescentes").insert({ nome: "Bia", nascimento: "2010-05-10" }).select("id").single().throwOnError();
    await lider.cliente.from("adolescentes").update({ nome: "Beatriz", nascimento: "2010-06-11" }).eq("id", data.id).throwOnError();
    await lider.cliente.from("adolescentes").update({ ativo: false }).eq("id", data.id).throwOnError();
    await lider.cliente.from("adolescentes").update({ ativo: true }).eq("id", data.id).throwOnError();

    const logs = await logsDo(data.id);
    expect(acoes(logs)).toEqual(["adolescente.cadastrado", "adolescente.editado", "adolescente.inativado", "adolescente.reativado"]);
    expect(logs[0]).toMatchObject({ usuario_id: lider.id, modulo: "adolescentes", objeto_rotulo: "Bia" });
    expect(logs[1].detalhes.mudancas).toEqual([
      { rotulo: "Nome", tipo: "texto", antes: "Bia", depois: "Beatriz" },
      { rotulo: "Data de nascimento", tipo: "oculto" },
    ]);
    expect(JSON.stringify(logs)).not.toMatch(/2010|05-10|06-11/);
  });
});

describe("logs de contas", () => {
  it("cadastro sem convite, aprovação com a Função (num log só), mudança de nível, desativação e reativação", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const novo = await cadastrar("Beythel");
    const id = novo.id!;
    expect(await logsDo(id)).toMatchObject([{ acao: "conta.cadastrada", usuario_id: id, objeto_rotulo: "Beythel", detalhes: { nivel: "pendente" } }]);

    await lucas.cliente.rpc("aprovar_pendente", { pessoa: id, novo_nivel: "lider", funcao: await funcao("Líder do louvor") }).throwOnError();
    await lucas.cliente.rpc("promover_a_admin", { pessoa: id }).throwOnError();
    await lucas.cliente.from("perfis").update({ ativo: false }).eq("id", id).throwOnError();
    await lucas.cliente.from("perfis").update({ ativo: true }).eq("id", id).throwOnError();

    const logs = await logsDo(id);
    expect(acoes(logs)).toEqual(["conta.cadastrada", "conta.aprovada", "conta.nivel_alterado", "conta.desativada", "conta.reativada"]);
    expect(logs[1]).toMatchObject({ usuario_id: lucas.id, detalhes: { nivel: "lider", funcoes: ["Líder do louvor"] } });
    expect(logs[2].detalhes).toEqual({ antes: "lider", depois: "admin" });
  });

  it("recusar um Pendente fica registrado mesmo com a conta apagada", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const intruso = await cadastrar("Intruso");
    await lucas.cliente.rpc("recusar_pendente", { pessoa: intruso.id }).throwOnError();
    const logs = await logsDo(intruso.id!);
    expect(acoes(logs)).toEqual(["conta.cadastrada", "conta.recusada"]);
    expect(logs[1]).toMatchObject({ usuario_id: lucas.id, objeto_rotulo: "Intruso" });
  });

  it("convite gerado, usado junto com o cadastro (num log só) e revogado", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const { data: convite } = await lucas.cliente
      .from("convites")
      .insert({ nivel: "lider", funcao_id: await funcao("Líder do louvor") })
      .select("id, codigo")
      .single()
      .throwOnError();
    const beythel = await cadastrar("Beythel", convite.codigo);

    expect(await logsDo(convite.id)).toMatchObject([{ acao: "convite.criado", usuario_id: lucas.id, detalhes: { nivel: "lider", funcao: "Líder do louvor" } }]);
    expect(await logsDo(beythel.id!)).toMatchObject([{ acao: "convite.usado", usuario_id: beythel.id, detalhes: { nivel: "lider", funcoes: ["Líder do louvor"] } }]);

    const { data: outro } = await lucas.cliente.from("convites").insert({ nivel: "professor" }).select("id").single().throwOnError();
    await lucas.cliente.from("convites").update({ revogado_em: new Date().toISOString() }).eq("id", outro.id).throwOnError();
    expect(acoes(await logsDo(outro.id))).toEqual(["convite.criado", "convite.revogado"]);
  });

  it("o convite que vence sem uso é registrado uma vez só, pelo Sistema", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const { data: convite } = await admin
      .from("convites")
      .insert({ nivel: "professor", criado_por: lucas.id, criado_em: daqui(-2), expira_em: new Date(Date.now() - 1000).toISOString() })
      .select("id")
      .single()
      .throwOnError();
    await admin.rpc("registrar_convites_vencidos").throwOnError();
    await admin.rpc("registrar_convites_vencidos").throwOnError();
    expect(await logsDo(convite.id)).toMatchObject([{ acao: "convite.criado" }, { acao: "convite.expirado", usuario_id: null, origem: "sistema" }]);
  });

  it("dar e tirar Funções vira log em nome do Admin", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const carol = await comFuncoes("Carol", "lider", ["Líder do louvor"]);
    await lucas.cliente.rpc("definir_funcoes", { pessoa: carol.id, novas_funcoes: [await funcao("Líder do ensino")] }).throwOnError();
    const logs = (await logsDo(carol.id)).filter((l) => l.usuario_id === lucas.id);
    expect(logs.map((l) => [l.acao, l.detalhes.funcao]).sort()).toEqual([
      ["conta.funcao_adicionada", "Líder do ensino"],
      ["conta.funcao_removida", "Líder do louvor"],
    ]);
  });
});

describe("registro pela interface (registrar_log)", () => {
  it("entrar, sair e trocar a senha ficam em nome de quem está logado", async () => {
    const carol = await contaNova("Carol", "lider");
    for (const acao of ["acesso.login", "acesso.senha_redefinida", "acesso.logout"]) {
      await carol.cliente.rpc("registrar_log", { acao }).throwOnError();
    }
    const logs = (await logsDo(carol.id)).filter((l) => l.acao.startsWith("acesso."));
    expect(logs).toMatchObject([
      { acao: "acesso.login", usuario_id: carol.id, objeto_rotulo: "Carol", modulo: "contas", origem: "interface" },
      { acao: "acesso.senha_redefinida", usuario_id: carol.id },
      { acao: "acesso.logout", usuario_id: carol.id },
    ]);
  });

  it("a tentativa de login com falha acha a conta pelo e-mail, sem gravar o e-mail, e conta as tentativas", async () => {
    const carol = await contaNova("Carol", "lider");
    const quem = anonimo();
    for (let i = 0; i < 3; i++) {
      await quem.rpc("registrar_log", { acao: "acesso.login_falhou", resultado: "falha", email: ` ${carol.email.toUpperCase()} `, codigo: "invalid_credentials" }).throwOnError();
    }
    const logs = (await logsDo(carol.id)).filter((l) => l.acao === "acesso.login_falhou");
    expect(logs.map((l) => l.detalhes.tentativas)).toEqual([1, 2, 3]);
    expect(logs[2]).toMatchObject({ usuario_id: null, objeto_rotulo: "Carol", resultado: "falha", severidade: "aviso", origem: "interface" });
    expect(JSON.stringify(logs)).not.toContain(carol.email.split("@")[0]);

    // Sem conta, fica só o domínio do e-mail.
    await quem.rpc("registrar_log", { acao: "acesso.senha_pedida", email: "fulano.secreto@exemplo.com" }).throwOnError();
    const { data } = await admin
      .from("logs")
      .select("objeto_rotulo, detalhes")
      .eq("acao", "acesso.senha_pedida")
      .is("objeto_id", null)
      .order("id", { ascending: false })
      .limit(1)
      .single()
      .throwOnError();
    expect(data).toEqual({ objeto_rotulo: "@exemplo.com", detalhes: { conta_existe: false } });
  });

  it("não registra sucesso de outra ação, nem sem entrar; a falha fica em nome de quem chamou", async () => {
    const carol = await contaNova("Carol", "lider");
    expect((await carol.cliente.rpc("registrar_log", { acao: "evento.excluido" })).error).not.toBeNull();
    expect((await anonimo().rpc("registrar_log", { acao: "acesso.login" })).error).not.toBeNull();
    expect((await anonimo().rpc("registrar_log", { acao: "evento.editado", resultado: "falha" })).error).not.toBeNull();
    expect((await carol.cliente.rpc("registrar_log", { acao: "nada disso" })).error).not.toBeNull();

    const alvo = crypto.randomUUID();
    await carol.cliente
      .rpc("registrar_log", { acao: "evento.editado", resultado: "falha", objeto_tipo: "evento", objeto_id: alvo, objeto_rotulo: "Culto", mensagem: "permission denied", codigo: "42501" })
      .throwOnError();
    expect(await logsDo(alvo)).toMatchObject([
      { usuario_id: carol.id, resultado: "falha", severidade: "aviso", detalhes: { codigo: "42501", mensagem: "permission denied" } },
    ]);
  });

  it("a função interna de gravação não é chamável de fora", async () => {
    const lucas = await contaNova("Lucas", "admin");
    expect((await lucas.cliente.rpc("gravar_log", { acao: "evento.criado" })).error).not.toBeNull();
    expect((await anonimo().rpc("gravar_log", { acao: "evento.criado" })).error).not.toBeNull();
  });
});

describe("os logs são só de inserção e só o Admin lê", () => {
  it("ninguém insere, edita ou apaga direto: nem o Admin, nem a chave de serviço", async () => {
    const lucas = await contaNova("Lucas", "admin");
    await lucas.cliente.rpc("registrar_log", { acao: "acesso.login" }).throwOnError();
    const [alvo] = (await logsDo(lucas.id)).filter((l) => l.acao === "acesso.login");

    expect((await lucas.cliente.from("logs").insert({ acao: "evento.criado", modulo: "eventos", origem: "interface" })).error).not.toBeNull();
    const edicao = await lucas.cliente.from("logs").update({ acao: "acesso.logout" }).eq("id", alvo.id).select("id");
    expect(edicao.data ?? []).toEqual([]);
    await lucas.cliente.from("logs").delete().eq("id", alvo.id);
    expect((await admin.from("logs").update({ acao: "acesso.logout" }).eq("id", alvo.id)).error).not.toBeNull();
    expect((await admin.from("logs").delete().eq("id", alvo.id)).error).not.toBeNull();

    const { data } = await admin.from("logs").select("acao").eq("id", alvo.id).single().throwOnError();
    expect(data.acao).toBe("acesso.login");
  });

  it("o Admin lê; Líder, Professor, Pendente, Admin desativado e anônimo não leem", async () => {
    const lucas = await contaNova("Lucas", "admin");
    await lucas.cliente.rpc("registrar_log", { acao: "acesso.login" }).throwOnError();
    const [alvo] = (await logsDo(lucas.id)).filter((l) => l.acao === "acesso.login");

    const { data: doAdmin } = await (await contaNova("Outro Admin", "admin")).cliente.from("logs").select("id").eq("id", alvo.id);
    expect(doAdmin).toEqual([{ id: alvo.id }]);

    const lider = await comFuncoes("Carol", "lider", ["Co-líder do ministério"]);
    const professor = await contaNova("Paulo", "professor");
    const pendente = await cadastrar("Novato");
    const desativado = await comFuncoes("Saiu", "admin", ["Líder do ministério"], false);
    for (const quem of [lider.cliente, professor.cliente, pendente.cliente, desativado.cliente, anonimo()]) {
      const { data } = await quem.from("logs").select("id").eq("id", alvo.id);
      expect(data ?? []).toEqual([]);
    }
  });

  it("se o Admin ligar, o líder lê o histórico dos Eventos que pode editar, e só deles", async () => {
    const mariana = await comFuncoes("Mariana", "lider", [MARIANA]);
    const beythel = await comFuncoes("Beythel", "lider", ["Líder do louvor"]);
    const culto = await categoria("Culto");
    const { data: evento } = await mariana.cliente.from("eventos").insert(eventoDe(culto.id, mariana.id)).select("id").single().throwOnError();
    await mariana.cliente.rpc("registrar_log", { acao: "acesso.login" }).throwOnError();
    const historico = (quem: typeof mariana) => quem.cliente.from("logs").select("acao").eq("objeto_id", evento.id);

    expect((await historico(mariana)).data).toEqual([]);

    await admin.from("configuracoes").update({ lideres_veem_historico_do_evento: true }).eq("id", true).throwOnError();
    try {
      expect((await historico(mariana)).data).toEqual([{ acao: "evento.criado" }]);
      expect((await historico(beythel)).data).toEqual([]);
      const { data: outros } = await mariana.cliente.from("logs").select("acao").eq("usuario_id", mariana.id).neq("objeto_tipo", "evento");
      expect(outros).toEqual([]);
    } finally {
      await admin.from("configuracoes").update({ lideres_veem_historico_do_evento: false }).eq("id", true).throwOnError();
    }
  });
});

describe("configurações e retenção", () => {
  it("só o Admin muda as configurações, e cada mudança vira log", async () => {
    const lucas = await contaNova("Lucas", "admin");
    const lider = await comFuncoes("Carol", "lider", ["Co-líder do ministério"]);

    const { data: doLider } = await lider.cliente.from("configuracoes").update({ retencao_dos_logs_meses: 1 }).eq("id", true).select("id");
    expect(doLider ?? []).toEqual([]);
    expect((await lucas.cliente.from("configuracoes").update({ logs_desde: new Date().toISOString() }).eq("id", true)).error).not.toBeNull();

    await lucas.cliente.from("configuracoes").update({ retencao_dos_logs_meses: 6 }).eq("id", true).throwOnError();
    try {
      const { data } = await admin
        .from("logs")
        .select("acao, usuario_id, detalhes")
        .eq("acao", "logs.retencao_alterada")
        .eq("usuario_id", lucas.id)
        .throwOnError();
      expect(data).toEqual([{ acao: "logs.retencao_alterada", usuario_id: lucas.id, detalhes: { chave: "retencao_dos_logs_meses", antes: 12, depois: 6 } }]);
    } finally {
      await admin.from("configuracoes").update({ retencao_dos_logs_meses: 12 }).eq("id", true).throwOnError();
    }
  });

  it("a limpeza apaga só os logs mais velhos que a retenção, e registra quantos saíram", async () => {
    const velho = crypto.randomUUID();
    const recente = crypto.randomUUID();
    const umMes = 31 * 24 * HORA_MS;
    await admin
      .from("logs")
      .insert([
        { acao: "acesso.login", modulo: "contas", origem: "sistema", objeto_id: velho, feito_em: new Date(Date.now() - 13 * umMes).toISOString() },
        { acao: "acesso.login", modulo: "contas", origem: "sistema", objeto_id: recente, feito_em: new Date(Date.now() - umMes).toISOString() },
      ])
      .throwOnError();

    const { data: quantos } = await admin.rpc("limpar_logs").throwOnError();
    expect(quantos).toBeGreaterThanOrEqual(1);
    expect(await logsDo(velho)).toEqual([]);
    expect(await logsDo(recente)).toHaveLength(1);
    const { data } = await admin.from("logs").select("acao, detalhes").eq("acao", "logs.limpeza").order("id", { ascending: false }).limit(1).single().throwOnError();
    expect(data.detalhes).toMatchObject({ removidos: quantos, meses: 12 });
  });
});

describe("dados proibidos", () => {
  it("nenhum log guarda senha, e-mail ou data de nascimento", async () => {
    const inicio = new Date(Date.now() - 1000).toISOString();
    const lucas = await contaNova("Lucas", "admin");
    const novo = await cadastrar("Beythel");
    await admin.auth.admin.updateUserById(novo.id!, { email: `trocado-${crypto.randomUUID()}@teste.onda` });
    await anonimo().auth.signInWithPassword({ email: novo.email, password: "senha-digitada-errada" });
    await anonimo().rpc("registrar_log", { acao: "acesso.login_falhou", resultado: "falha", email: novo.email }).throwOnError();
    await anonimo().rpc("registrar_log", { acao: "acesso.senha_pedida", email: novo.email }).throwOnError();
    const { data: adolescente } = await lucas.cliente.from("adolescentes").insert({ nome: "Lia", nascimento: "2011-03-04" }).select("id").single().throwOnError();
    await lucas.cliente.from("adolescentes").update({ nascimento: "2011-04-03" }).eq("id", adolescente.id).throwOnError();

    const { data } = await admin.from("logs").select("*").gte("feito_em", inicio).throwOnError();
    const texto = JSON.stringify(data);
    expect(data!.length).toBeGreaterThan(4);
    expect(texto).not.toContain(SENHA);
    expect(texto).not.toContain("senha-digitada-errada");
    // Do e-mail que não tem mais conta fica só o domínio; o endereço em si nunca.
    expect(texto).not.toMatch(/[\w-]+@teste\.onda/);
    expect(texto).not.toMatch(/2000-05-10|2011-03-04|2011-04-03/);
    expect((await logsDo(novo.id!)).map((l) => l.acao)).toContain("conta.editada");
  });
});
