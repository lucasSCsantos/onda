import { describe, expect, it } from "vitest";
import type { Dispositivo, EnviadorDePush } from "@/dominio/push";
import { processarFila } from "@/lib/notificacoes/processar";
import { admin, anonimo, categoria, comFuncoes, contaNova, criar, eventoDe, type Cliente } from "./ambiente";

const novoEndpoint = () => `https://push.exemplo.test/${crypto.randomUUID()}`;
const chaves = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };

const lider = (nome = "Líder") => comFuncoes(nome, "lider", ["Líder do louvor"]);

/** Cadastra um dispositivo da pessoa e devolve o id e o endpoint. */
async function dispositivo(cliente: Cliente, pessoa: string) {
  const endpoint = novoEndpoint();
  await cliente.rpc("registrar_inscricao_de_push", { endereco: endpoint, chave_p256dh: chaves.p256dh, chave_auth: chaves.auth, apelido: "Aparelho de teste" }).throwOnError();
  const { data } = await admin.from("inscricoes_de_push").select("id").eq("endpoint", endpoint).eq("pessoa_id", pessoa).single().throwOnError();
  return { id: data.id as string, endpoint };
}

const notificacoesDe = async (pessoa: string) =>
  (await admin.from("notificacoes").select("*").eq("pessoa_id", pessoa).order("criada_em").throwOnError()).data ?? [];

/** Quem consta como criador dos Eventos gravados direto no banco (a coluna é obrigatória). */
let admDosEventos: Promise<string> | undefined;
const criadorDosEventos = () => (admDosEventos ??= contaNova("Criador de teste", "admin").then((c) => c.id));

/** Um Evento do Ensaio de louvor, com o Responsável dado, criado por quem está logado (ou direto no banco, sem ninguém logado). */
async function evento(responsavel: string, criador?: Cliente, mudancas: Record<string, unknown> = {}) {
  const { id } = await categoria("Ensaio de louvor");
  if (criador) {
    const { data, error } = await criar(criador, eventoDe(id, responsavel, mudancas));
    if (error) throw error;
    return data!.id as string;
  }
  const { data } = await admin.from("eventos").insert({ ...eventoDe(id, responsavel, mudancas), criado_por: await criadorDosEventos() }).select("id").single().throwOnError();
  return data.id as string;
}

/** O envio falso: registra o que recebeu e responde conforme o endpoint (status por endpoint, ou sucesso). */
function envioFalso(respostas: Record<string, number | "ok"> = {}) {
  const enviados: { endpoint: string; carga: string; ttl: number }[] = [];
  const enviar: EnviadorDePush = async (d: Dispositivo, carga, { ttl }) => {
    enviados.push({ endpoint: d.endpoint, carga, ttl });
    const resposta = respostas[d.endpoint] ?? "ok";
    return resposta === "ok" ? { ok: true } : { ok: false, status: resposta };
  };
  return { enviar, enviados };
}

/** Uma rodada só com o que é desta pessoa: a fila do banco de teste é compartilhada, então as outras são deixadas de lado. */
async function rodada(pessoas: string[], opcoes: Parameters<typeof processarFila>[1]) {
  // Reserva só as Notificações das pessoas do teste: as demais ficam para o teste a que pertencem.
  await admin.from("notificacoes").update({ reservada_ate: new Date(Date.now() + 3_600_000).toISOString() }).eq("estado", "pendente").not("pessoa_id", "in", `(${pessoas.join(",")})`);
  try {
    return await processarFila(admin, opcoes);
  } finally {
    await admin.from("notificacoes").update({ reservada_ate: null }).eq("estado", "pendente").not("pessoa_id", "in", `(${pessoas.join(",")})`);
  }
}

const meioDiaDeSalvador = new Date("2026-10-24T15:00:00Z");
const onzeDaNoiteEmSalvador = new Date("2026-10-25T02:00:00Z");

describe("notificações: designação", () => {
  it("quem foi definido Responsável recebe uma Notificação; quem se definiu sozinho não", async () => {
    const criador = await lider("Criador");
    const outro = await lider("Outro");
    const id = await evento(outro.id, criador.cliente);
    expect(await notificacoesDe(outro.id)).toMatchObject([{ tipo: "designacao_responsavel", evento_id: id, estado: "pendente", lida_em: null, titulo: null }]);

    await evento(criador.id, criador.cliente);
    expect(await notificacoesDe(criador.id)).toEqual([]);
  });

  it("trocar o Responsável avisa o novo; repetir no mesmo dia não duplica", async () => {
    const [a, b] = [await lider("A"), await lider("B")];
    const id = await evento(a.id);
    await admin.from("eventos").update({ responsavel_id: b.id }).eq("id", id).throwOnError();
    await admin.from("eventos").update({ responsavel_id: a.id }).eq("id", id).throwOnError();
    await admin.from("eventos").update({ responsavel_id: b.id }).eq("id", id).throwOnError();
    expect(await notificacoesDe(a.id)).toHaveLength(1);
    expect(await notificacoesDe(b.id)).toHaveLength(1);
  });

  it("a chave única (tipo, Evento, pessoa e janela) impede duas iguais, mas não duas de janelas diferentes", async () => {
    const a = await lider("A");
    const id = await evento(a.id);
    const base = { pessoa_id: a.id, tipo: "designacao_responsavel", evento_id: id };
    expect((await admin.from("notificacoes").insert({ ...base, janela: "" })).error).toBeNull();
    expect((await admin.from("notificacoes").insert({ ...base, janela: "" })).error?.code).toBe("23505");
    expect((await admin.from("notificacoes").insert({ ...base, janela: "1d" })).error).toBeNull();
    // Sem Evento (como o resumo semanal), a chave também vale.
    const semEvento = { pessoa_id: a.id, tipo: "resumo", janela: "2026-W43" };
    expect((await admin.from("notificacoes").insert(semEvento)).error).toBeNull();
    expect((await admin.from("notificacoes").insert(semEvento)).error?.code).toBe("23505");
  });

  it("o Professor e o Auxiliar escalados numa aula recebem o aviso; o Professor só vê o próprio", async () => {
    const professor = await contaNova("Paulo", "professor");
    const auxiliar = await contaNova("Ari", "professor");
    const alheio = await contaNova("Alheio", "professor");
    const ebd = await categoria("EBD");
    await evento((await lider("R")).id, undefined, {
      categoria_id: ebd.id,
      campos: { [ebd.campo("Tema")]: "Semeador", [ebd.campo("Professor")]: professor.id, [ebd.campo("Auxiliar")]: auxiliar.id },
    });

    const [p, a] = await Promise.all([professor.cliente.from("notificacoes").select("tipo"), auxiliar.cliente.from("notificacoes").select("tipo")]);
    expect(p.data).toEqual([{ tipo: "designacao_aula" }]);
    expect(a.data).toEqual([{ tipo: "designacao_aula" }]);
    expect((await alheio.cliente.from("notificacoes").select("id")).data).toEqual([]);
    expect((await anonimo().from("notificacoes").select("id")).data ?? []).toEqual([]);
  });

  it("trocar o Professor avisa só o novo", async () => {
    const [antigo, novo] = [await contaNova("Antigo", "professor"), await contaNova("Novo", "professor")];
    const ebd = await categoria("EBD");
    const id = await evento((await lider("R")).id, undefined, {
      categoria_id: ebd.id,
      campos: { [ebd.campo("Tema")]: "Semeador", [ebd.campo("Professor")]: antigo.id },
    });
    await admin.from("eventos").update({ campos: { [ebd.campo("Tema")]: "Semeador", [ebd.campo("Professor")]: novo.id } }).eq("id", id).throwOnError();
    expect(await notificacoesDe(antigo.id)).toHaveLength(1);
    expect(await notificacoesDe(novo.id)).toHaveLength(1);
  });

  it("uma mudança que atinge várias Ocorrências de uma Série na mesma transação avisa uma vez só", async () => {
    const a = await lider("A");
    const { id } = await categoria("Ensaio de louvor");
    const { data: serie } = await admin
      .from("series")
      .insert({ categoria_id: id, regra: { frequencia: "semanal", dias: [6] }, primeiro_dia: "2026-10-24", criado_por: await criadorDosEventos() })
      .select("id")
      .single()
      .throwOnError();
    const criador = await criadorDosEventos();
    const ocorrencias = [0, 1, 2].map((i) => ({ ...eventoDe(id, a.id, { serie_id: serie.id, inicio: new Date(Date.UTC(2026, 9, 24 + 7 * i, 22)).toISOString(), fim: null }), criado_por: criador }));
    await admin.from("eventos").insert(ocorrencias).throwOnError();
    expect(await notificacoesDe(a.id)).toHaveLength(1);
  });

  it("respeita as preferências: tipo desligado não gera aviso nem central", async () => {
    const a = await lider("A");
    await a.cliente.from("preferencias_de_notificacao").insert({ pessoa_id: a.id, tipos_desligados: ["designacao_responsavel"] }).throwOnError();
    await evento(a.id);
    expect(await notificacoesDe(a.id)).toEqual([]);
  });

  it("Eventos cancelados não avisam", async () => {
    const a = await lider("A");
    await evento(a.id, undefined, { status: "cancelado" });
    expect(await notificacoesDe(a.id)).toEqual([]);
  });
});

describe("notificações: central e políticas", () => {
  it("a pessoa lê só as próprias e só marca como lida: nada mais muda, nada é inserido nem apagado", async () => {
    const [a, b] = [await lider("A"), await lider("B")];
    await evento(a.id);
    await evento(b.id);

    const minhas = await a.cliente.from("notificacoes").select("id, pessoa_id");
    expect(minhas.data).toHaveLength(1);
    expect(minhas.data![0].pessoa_id).toBe(a.id);
    const [id] = [minhas.data![0].id];

    expect((await a.cliente.from("notificacoes").update({ lida_em: new Date().toISOString() }).eq("id", id)).error).toBeNull();
    expect((await a.cliente.from("notificacoes").select("lida_em").eq("id", id).single()).data?.lida_em).not.toBeNull();

    expect((await a.cliente.from("notificacoes").update({ estado: "enviada" }).eq("id", id)).error).not.toBeNull();
    expect((await a.cliente.from("notificacoes").update({ texto: "outro" }).eq("id", id)).error).not.toBeNull();
    expect((await a.cliente.from("notificacoes").insert({ pessoa_id: a.id, tipo: "designacao_responsavel" })).error).not.toBeNull();
    await a.cliente.from("notificacoes").delete().eq("id", id);
    expect(await notificacoesDe(a.id)).toHaveLength(1);

    // Marcar a de outra pessoa não faz nada.
    const deB = (await notificacoesDe(b.id))[0];
    await a.cliente.from("notificacoes").update({ lida_em: new Date().toISOString() }).eq("id", deB.id);
    expect((await notificacoesDe(b.id))[0].lida_em).toBeNull();
  });

  it("nem o Admin lê as Notificações de outra pessoa pela interface", async () => {
    const a = await lider("A");
    const adm = await contaNova("Admin", "admin");
    await evento(a.id);
    expect((await adm.cliente.from("notificacoes").select("id")).data).toEqual([]);
  });

  it("as preferências são só de cada pessoa, e a janela precisa abrir antes de fechar", async () => {
    const [a, b] = [await lider("A"), await lider("B")];
    expect((await a.cliente.from("preferencias_de_notificacao").insert({ pessoa_id: a.id, janela_inicio: 9, janela_fim: 20 })).error).toBeNull();
    expect((await a.cliente.from("preferencias_de_notificacao").insert({ pessoa_id: b.id })).error).not.toBeNull();
    expect((await a.cliente.from("preferencias_de_notificacao").update({ janela_inicio: 22, janela_fim: 8 }).eq("pessoa_id", a.id)).error).not.toBeNull();
    expect((await b.cliente.from("preferencias_de_notificacao").select("pessoa_id")).data).toEqual([]);
    await b.cliente.from("preferencias_de_notificacao").update({ janela_inicio: 1 }).eq("pessoa_id", a.id);
    expect((await admin.from("preferencias_de_notificacao").select("janela_inicio").eq("pessoa_id", a.id).single()).data?.janela_inicio).toBe(9);
  });

  it("mudar as preferências vira Log", async () => {
    const a = await lider("A");
    await a.cliente.from("preferencias_de_notificacao").insert({ pessoa_id: a.id, janela_inicio: 9, janela_fim: 20 }).throwOnError();
    const { data } = await admin.from("logs").select("acao, detalhes").eq("usuario_id", a.id).eq("acao", "notificacao.preferencias_alteradas");
    expect(data).toEqual([{ acao: "notificacao.preferencias_alteradas", detalhes: { tipos_desligados: [], janela_inicio: 9, janela_fim: 20 } }]);
  });

  it("a limpeza apaga o que passou da retenção e guarda o resto", async () => {
    const a = await lider("A");
    const [velha, nova] = [await evento(a.id), await evento(a.id)];
    await admin.from("notificacoes").delete().eq("pessoa_id", a.id);
    const antiga = new Date(Date.now() - 40 * 86_400_000).toISOString();
    await admin.from("notificacoes").insert({ pessoa_id: a.id, tipo: "designacao_responsavel", evento_id: velha, criada_em: antiga, estado: "enviada" }).throwOnError();
    await admin.from("notificacoes").insert({ pessoa_id: a.id, tipo: "designacao_responsavel", evento_id: nova }).throwOnError();

    await admin.rpc("limpar_notificacoes").throwOnError();
    expect((await notificacoesDe(a.id)).map((n) => n.evento_id)).toEqual([nova]);
  });
});

describe("notificações: o agendador", () => {
  it("só a chave de serviço reserva a fila; duas rodadas não pegam a mesma Notificação", async () => {
    const a = await lider("A");
    expect((await a.cliente.rpc("reservar_notificacoes")).error).not.toBeNull();
    expect((await anonimo().rpc("reservar_notificacoes")).error).not.toBeNull();

    await evento(a.id);
    const pessoas = [a.id];
    await admin.from("notificacoes").update({ reservada_ate: new Date(Date.now() + 3_600_000).toISOString() }).eq("estado", "pendente").not("pessoa_id", "in", `(${pessoas.join(",")})`);
    const primeira = await admin.rpc("reservar_notificacoes", { limite: 200 });
    const segunda = await admin.rpc("reservar_notificacoes", { limite: 200 });
    await admin.from("notificacoes").update({ reservada_ate: null }).eq("estado", "pendente").not("pessoa_id", "in", `(${pessoas.join(",")})`);
    expect(primeira.error).toBeNull();
    expect((primeira.data as { pessoa_id: string }[]).map((n) => n.pessoa_id)).toEqual([a.id]);
    expect(segunda.data).toEqual([]);
  });

  it("envia a cada dispositivo ativo com o texto montado, e nunca duas vezes, mesmo em rodadas repetidas", async () => {
    const a = await lider("A");
    const [d1, d2] = [await dispositivo(a.cliente, a.id), await dispositivo(a.cliente, a.id)];
    const id = await evento(a.id, undefined, { titulo: "Ensaio geral", local: "Templo" });
    const falso = envioFalso();

    const resumo = await rodada([a.id], { enviar: falso.enviar, agora: meioDiaDeSalvador });
    expect(resumo).toMatchObject({ reservadas: 1, enviadas: 1 });
    expect(falso.enviados.map((e) => e.endpoint).sort()).toEqual([d1.endpoint, d2.endpoint].sort());
    const carga = JSON.parse(falso.enviados[0].carga);
    expect(carga).toEqual({ titulo: "Você foi definido(a) como Responsável", texto: "Ensaio geral · sáb., 24/10 às 19h · Templo", tag: `designacao_responsavel:${id}`, url: `/eventos/${id}` });

    const [n] = await notificacoesDe(a.id);
    expect(n).toMatchObject({ estado: "enviada", titulo: carga.titulo, texto: carga.texto, entregue_a: expect.arrayContaining([d1.id, d2.id]), reservada_ate: null });
    expect(n.enviada_em).not.toBeNull();
    expect((await admin.from("inscricoes_de_push").select("usado_em").eq("id", d1.id).single()).data?.usado_em).not.toBeNull();

    await rodada([a.id], { enviar: falso.enviar, agora: meioDiaDeSalvador });
    await rodada([a.id], { enviar: falso.enviar, agora: meioDiaDeSalvador });
    expect(falso.enviados).toHaveLength(2);
  });

  it("a falha de um dispositivo não impede os outros, e a nova tentativa só envia ao que falhou", async () => {
    const a = await lider("A");
    const [bom, ruim] = [await dispositivo(a.cliente, a.id), await dispositivo(a.cliente, a.id)];
    await evento(a.id);

    const primeira = envioFalso({ [ruim.endpoint]: 503 });
    expect(await rodada([a.id], { enviar: primeira.enviar, agora: meioDiaDeSalvador })).toMatchObject({ novaTentativa: 1, enviadas: 0 });
    expect(primeira.enviados).toHaveLength(2);
    const [depois] = await notificacoesDe(a.id);
    expect(depois).toMatchObject({ estado: "pendente", tentativas: 1, entregue_a: [bom.id] });
    expect(new Date(depois.proxima_tentativa).getTime()).toBeGreaterThan(meioDiaDeSalvador.getTime() + 4 * 60_000);

    // Chegada a hora da nova tentativa, só o dispositivo que falhou é tentado.
    await admin.from("notificacoes").update({ proxima_tentativa: new Date().toISOString() }).eq("id", depois.id);
    const segunda = envioFalso();
    await rodada([a.id], { enviar: segunda.enviar, agora: meioDiaDeSalvador });
    expect(segunda.enviados.map((e) => e.endpoint)).toEqual([ruim.endpoint]);
    expect(await notificacoesDe(a.id)).toMatchObject([{ estado: "enviada", entregue_a: expect.arrayContaining([bom.id, ruim.id]) }]);
  });

  it("esgotadas as tentativas, a falha definitiva vai para os Logs como erro, sem endpoint nem chaves", async () => {
    const a = await lider("A");
    const d = await dispositivo(a.cliente, a.id);
    await evento(a.id);
    await admin.from("notificacoes").update({ tentativas: 4 }).eq("pessoa_id", a.id).throwOnError();
    const falso = envioFalso({ [d.endpoint]: 500 });

    expect(await rodada([a.id], { enviar: falso.enviar, agora: meioDiaDeSalvador })).toMatchObject({ falhas: 1 });
    expect(await notificacoesDe(a.id)).toMatchObject([{ estado: "falha", tentativas: 5 }]);

    const { data } = await admin.from("logs").select("*").eq("acao", "notificacao.falhou").eq("objeto_rotulo", "Você foi definido(a) como Responsável").order("id", { ascending: false }).limit(1);
    expect(data![0]).toMatchObject({ resultado: "falha", severidade: "erro", origem: "sistema", detalhes: { tipo: "designacao_responsavel", tentativas: 5, dispositivos: 1, desfecho: "falha" } });
    const tudo = JSON.stringify(data);
    expect(tudo).not.toContain(d.endpoint);
    expect(tudo).not.toContain(chaves.p256dh);
    expect(tudo).not.toContain(chaves.auth);
  });

  it("inscrição recusada com 404 ou 410 é removida e vira Log de expirada; os outros dispositivos recebem", async () => {
    const a = await lider("A");
    const [vivo, morto, gone] = [await dispositivo(a.cliente, a.id), await dispositivo(a.cliente, a.id), await dispositivo(a.cliente, a.id)];
    await evento(a.id);
    const falso = envioFalso({ [morto.endpoint]: 404, [gone.endpoint]: 410 });

    expect(await rodada([a.id], { enviar: falso.enviar, agora: meioDiaDeSalvador })).toMatchObject({ enviadas: 1 });
    expect((await admin.from("inscricoes_de_push").select("id").eq("pessoa_id", a.id)).data).toEqual([{ id: vivo.id }]);
    expect((await admin.from("logs").select("acao").eq("usuario_id", a.id).eq("acao", "push.expirado")).data).toHaveLength(2);
  });

  it("fora da janela de horário espera abrir; a urgente não espera", async () => {
    const a = await lider("A");
    await dispositivo(a.cliente, a.id);
    await evento(a.id);
    const falso = envioFalso();

    expect(await rodada([a.id], { enviar: falso.enviar, agora: onzeDaNoiteEmSalvador })).toMatchObject({ esperando: 1 });
    expect(falso.enviados).toEqual([]);
    const [esperando] = await notificacoesDe(a.id);
    expect(esperando).toMatchObject({ estado: "pendente", reservada_ate: null });
    expect(new Date(esperando.proxima_tentativa).toISOString()).toBe("2026-10-25T11:00:00.000Z");

    await admin.from("notificacoes").update({ proxima_tentativa: new Date().toISOString(), urgente: true }).eq("id", esperando.id);
    await rodada([a.id], { enviar: falso.enviar, agora: onzeDaNoiteEmSalvador });
    expect(falso.enviados).toHaveLength(1);
  });

  it("respeita a janela escolhida pela pessoa", async () => {
    const a = await lider("A");
    await a.cliente.from("preferencias_de_notificacao").insert({ pessoa_id: a.id, janela_inicio: 14, janela_fim: 18 }).throwOnError();
    await dispositivo(a.cliente, a.id);
    await evento(a.id);
    const falso = envioFalso();
    // Meio-dia em Salvador: dentro do padrão (8h às 21h), mas antes das 14h da pessoa.
    expect(await rodada([a.id], { enviar: falso.enviar, agora: meioDiaDeSalvador })).toMatchObject({ esperando: 1 });
    expect(falso.enviados).toEqual([]);
  });

  it("sem dispositivo ou com o tipo desligado depois, fica só na central; vencida, expira", async () => {
    const sem = await lider("Sem dispositivo");
    await evento(sem.id);
    const desligou = await lider("Desligou");
    await dispositivo(desligou.cliente, desligou.id);
    await evento(desligou.id);
    await desligou.cliente.from("preferencias_de_notificacao").insert({ pessoa_id: desligou.id, tipos_desligados: ["designacao_responsavel"] }).throwOnError();
    const vencida = await lider("Vencida");
    await dispositivo(vencida.cliente, vencida.id);
    await evento(vencida.id);
    await admin.from("notificacoes").update({ valida_ate: new Date(meioDiaDeSalvador.getTime() - 1000).toISOString() }).eq("pessoa_id", vencida.id).throwOnError();
    const falso = envioFalso();

    await rodada([sem.id, desligou.id, vencida.id], { enviar: falso.enviar, agora: meioDiaDeSalvador });
    expect((await notificacoesDe(sem.id))[0].estado).toBe("dispensada");
    expect((await notificacoesDe(desligou.id))[0].estado).toBe("dispensada");
    expect((await notificacoesDe(vencida.id))[0].estado).toBe("expirada");
    expect(falso.enviados).toEqual([]);
    // A central continua mostrando o que não foi enviado.
    expect((await sem.cliente.from("notificacoes").select("id")).data).toHaveLength(1);
  });

  it("no modo de teste (dry-run), registra o que seria enviado em Log, sem atualizar o último uso", async () => {
    const a = await lider("A");
    const d = await dispositivo(a.cliente, a.id);
    await evento(a.id);

    // O adaptador de teste só finge que enviou (como `criarEnviador` com PUSH_MODO_TESTE=1).
    await rodada([a.id], { enviar: async () => ({ ok: true }), simulado: true, agora: meioDiaDeSalvador });
    const { data } = await admin.from("logs").select("*").eq("acao", "notificacao.simulada").eq("objeto_rotulo", "Você foi definido(a) como Responsável").order("id", { ascending: false }).limit(1);
    expect(data![0]).toMatchObject({ severidade: "info", detalhes: { tipo: "designacao_responsavel", dispositivos: 1 } });
    expect(JSON.stringify(data)).not.toContain(d.endpoint);
    expect((await admin.from("inscricoes_de_push").select("usado_em").eq("id", d.id).single()).data?.usado_em).toBeNull();
  });

  it("a Notificação nunca leva dados de Adolescentes, mesmo que as observações do Evento os citem", async () => {
    const a = await lider("A");
    await dispositivo(a.cliente, a.id);
    await admin.from("adolescentes").insert({ nome: "Joãozinho Sigiloso", nascimento: "2011-03-04", genero: "feminino" }).throwOnError();
    await evento(a.id, undefined, { observacoes: "Falar com a mãe do Joãozinho Sigiloso (04/03/2011)", titulo: "Reunião" });
    const falso = envioFalso();

    await rodada([a.id], { enviar: falso.enviar, agora: meioDiaDeSalvador });
    const tudo = falso.enviados.map((e) => e.carga).join() + JSON.stringify(await notificacoesDe(a.id));
    expect(tudo).not.toContain("Joãozinho");
    expect(tudo).not.toContain("2011");
  });

  it("o Pequeno grupo omite o local no que é enviado", async () => {
    const a = await lider("A");
    await dispositivo(a.cliente, a.id);
    const pg = await categoria("Pequeno grupo");
    const { data } = await admin.from("eventos").insert({ ...eventoDe(pg.id, a.id, { titulo: "Pequeno grupo Alfa", local: "Casa da Maria, Rua 5", campos: { [pg.campo("Grupo")]: "Grupo único" } }), criado_por: await criadorDosEventos() }).select("id").single().throwOnError();
    const falso = envioFalso();

    await rodada([a.id], { enviar: falso.enviar, agora: meioDiaDeSalvador });
    expect(falso.enviados).toHaveLength(1);
    expect(falso.enviados[0].carga).not.toContain("Maria");
    expect(JSON.parse(falso.enviados[0].carga).url).toBe(`/eventos/${data.id}`);
  });
});
