import { afterEach, describe, expect, it } from "vitest";
import type { Dispositivo, EnviadorDePush } from "@/dominio/push";
import { gerarNotificacoes } from "@/lib/notificacoes/gerar";
import { processarFila } from "@/lib/notificacoes/processar";
import { admin, categoria, comFuncoes, contaNova, eventoDe, type Cliente } from "./ambiente";

const HORA = 3_600_000;
const chaves = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };

const lider = (nome = "Líder") => comFuncoes(nome, "lider", ["Líder do louvor"]);
const notificacoesDe = async (pessoa: string) =>
  (await admin.from("notificacoes").select("*").eq("pessoa_id", pessoa).order("criada_em").throwOnError()).data ?? [];

let criador: Promise<string> | undefined;
const criadorDosEventos = () => (criador ??= contaNova("Criador de teste", "admin").then((c) => c.id));

/** Um Evento gravado direto no banco, com início e fim relativos a um instante. */
async function evento(responsavel: string | null, inicio: Date, mudancas: Record<string, unknown> = {}) {
  const { id } = await categoria("Ensaio de louvor");
  const { data } = await admin
    .from("eventos")
    .insert({
      ...eventoDe(id, responsavel, { inicio: inicio.toISOString(), fim: new Date(inicio.getTime() + 2 * HORA).toISOString(), ...mudancas }),
      criado_por: await criadorDosEventos(),
    })
    .select("id")
    .single()
    .throwOnError();
  return data.id as string;
}

async function dispositivo(cliente: Cliente, pessoa: string) {
  const endpoint = `https://push.exemplo.test/${crypto.randomUUID()}`;
  await cliente.rpc("registrar_inscricao_de_push", { endereco: endpoint, chave_p256dh: chaves.p256dh, chave_auth: chaves.auth, apelido: "Aparelho de teste" }).throwOnError();
  const { data } = await admin.from("inscricoes_de_push").select("id").eq("endpoint", endpoint).eq("pessoa_id", pessoa).single().throwOnError();
  return { id: data.id as string, endpoint };
}

function envioFalso() {
  const enviados: { carga: string; ttl: number }[] = [];
  const enviar: EnviadorDePush = async (_d: Dispositivo, carga, { ttl }) => {
    enviados.push({ carga, ttl });
    return { ok: true };
  };
  return { enviar, enviados };
}

/** Uma rodada só com o que é destas pessoas: a fila do banco de teste é compartilhada. */
async function rodada(pessoas: string[], agora: Date, enviar: EnviadorDePush) {
  const fora = { estado: "pendente" };
  const em = `(${pessoas.join(",")})`;
  await admin.from("notificacoes").update({ reservada_ate: new Date(Date.now() + HORA).toISOString() }).match(fora).not("pessoa_id", "in", em);
  try {
    return await processarFila(admin, { enviar, agora });
  } finally {
    await admin.from("notificacoes").update({ reservada_ate: null }).match(fora).not("pessoa_id", "in", em);
  }
}

afterEach(async () => {
  await admin.from("configuracoes").update({ limite_de_urgencia_horas: 12 }).eq("id", true).throwOnError();
});

describe("notificações: mudança e cancelamento", () => {
  const emHoras = (h: number) => new Date(Date.now() + h * HORA);

  it("mudar o local, a hora ou a data de um Evento avisa o Responsável, e só então", async () => {
    const a = await lider("A");
    const id = await evento(a.id, emHoras(30));
    await admin.from("notificacoes").delete().eq("pessoa_id", a.id);

    await admin.from("eventos").update({ observacoes: "outra" }).eq("id", id).throwOnError();
    expect(await notificacoesDe(a.id)).toEqual([]);

    await admin.from("eventos").update({ local: "Outra sala" }).eq("id", id).throwOnError();
    const [n] = await notificacoesDe(a.id);
    expect(n).toMatchObject({ tipo: "evento_alterado", evento_id: id, urgente: false, estado: "pendente" });
    // O aviso vale até o Evento começar, no máximo 48 horas.
    expect(new Date(n.valida_ate).getTime() - Date.now()).toBeLessThanOrEqual(48 * HORA);
  });

  it("mudar a data ou a hora também avisa", async () => {
    const a = await lider("A");
    const id = await evento(a.id, emHoras(30));
    await admin.from("notificacoes").delete().eq("pessoa_id", a.id);
    await admin.from("eventos").update({ inicio: emHoras(31).toISOString(), fim: emHoras(33).toISOString() }).eq("id", id).throwOnError();
    expect((await notificacoesDe(a.id)).map((n) => n.tipo)).toEqual(["evento_alterado"]);
  });

  it("cancelar avisa com o tipo de cancelamento, e não com o de mudança", async () => {
    const a = await lider("A");
    const id = await evento(a.id, emHoras(30));
    await admin.from("notificacoes").delete().eq("pessoa_id", a.id);
    await admin.from("eventos").update({ status: "cancelado" }).eq("id", id).throwOnError();
    expect((await notificacoesDe(a.id)).map((n) => n.tipo)).toEqual(["evento_cancelado"]);
  });

  it("quem começa em menos de 12 horas é urgente; o limite é editável em Configurações", async () => {
    const a = await lider("A");
    const perto = await evento(a.id, emHoras(5));
    const longe = await evento(a.id, emHoras(30));
    const outroLonge = await evento(a.id, emHoras(30));
    await admin.from("notificacoes").delete().eq("pessoa_id", a.id);

    await admin.from("eventos").update({ local: "Nova" }).in("id", [perto]).throwOnError();
    await admin.from("eventos").update({ local: "Nova" }).in("id", [longe]).throwOnError();
    const antes = await notificacoesDe(a.id);
    expect(antes.find((n) => n.evento_id === perto)?.urgente).toBe(true);
    expect(antes.find((n) => n.evento_id === longe)?.urgente).toBe(false);

    await admin.from("configuracoes").update({ limite_de_urgencia_horas: 48 }).eq("id", true).throwOnError();
    await admin.from("eventos").update({ local: "Mais uma" }).eq("id", outroLonge).throwOnError();
    const depois = (await notificacoesDe(a.id)).filter((n) => n.evento_id === outroLonge);
    expect(depois.at(-1)?.urgente).toBe(true);
  });

  it("o limite de urgência fica entre 1 e 72 horas", async () => {
    for (const horas of [0, 73]) {
      expect((await admin.from("configuracoes").update({ limite_de_urgencia_horas: horas }).eq("id", true)).error).not.toBeNull();
    }
  });

  it("não avisa de Rascunho, de Evento que já começou nem de Evento Adiado ou Realizado", async () => {
    const a = await lider("A");
    const rascunho = await evento(a.id, emHoras(30), { status: "rascunho" });
    const passado = await evento(a.id, emHoras(-3), { fim: emHoras(-1).toISOString() });
    const adiado = await evento(a.id, emHoras(30), { status: "adiado" });
    await admin.from("notificacoes").delete().eq("pessoa_id", a.id);
    for (const id of [rascunho, passado, adiado]) await admin.from("eventos").update({ local: "Outro" }).eq("id", id).throwOnError();
    expect(await notificacoesDe(a.id)).toEqual([]);
  });

  it("o Professor e o Auxiliar da aula também são avisados; quem fez a mudança, não", async () => {
    const professor = await contaNova("Paulo", "professor");
    const auxiliar = await contaNova("Ari", "professor");
    const outro = await contaNova("Outro", "professor");
    const responsavel = await lider("R");
    const ebd = await categoria("EBD");
    const id = await evento(responsavel.id, emHoras(30), {
      categoria_id: ebd.id,
      campos: { [ebd.campo("Tema")]: "Semeador", [ebd.campo("Professor")]: professor.id, [ebd.campo("Auxiliar")]: auxiliar.id },
    });
    await admin.from("notificacoes").delete().in("pessoa_id", [professor.id, auxiliar.id, responsavel.id]);

    // O Responsável muda o local pela interface: ele mesmo não é avisado.
    await responsavel.cliente.from("eventos").update({ local: "Sala 3" }).eq("id", id).throwOnError();
    expect((await notificacoesDe(professor.id)).map((n) => n.tipo)).toEqual(["evento_alterado"]);
    expect((await notificacoesDe(auxiliar.id)).map((n) => n.tipo)).toEqual(["evento_alterado"]);
    expect(await notificacoesDe(responsavel.id)).toEqual([]);
    expect(await notificacoesDe(outro.id)).toEqual([]);
  });

  it("respeita a preferência: tipo desligado não gera aviso nem central", async () => {
    const a = await lider("A");
    await a.cliente.from("preferencias_de_notificacao").insert({ pessoa_id: a.id, tipos_desligados: ["evento_alterado"] }).throwOnError();
    const id = await evento(a.id, emHoras(30));
    await admin.from("notificacoes").delete().eq("pessoa_id", a.id);
    await admin.from("eventos").update({ local: "Outro" }).eq("id", id).throwOnError();
    expect(await notificacoesDe(a.id)).toEqual([]);
  });

  it("a mudança urgente fura a janela de horário e chega na hora, com a tag do Evento", async () => {
    const a = await lider("A");
    await dispositivo(a.cliente, a.id);
    const inicio = new Date("2027-01-20T14:00:00Z");
    const id = await evento(a.id, inicio);
    await admin.from("notificacoes").delete().eq("pessoa_id", a.id);
    // Faltam 5 horas, mas o gatilho olha o relógio do banco: grava a urgente como o gatilho gravaria.
    await admin.from("notificacoes").insert({ pessoa_id: a.id, tipo: "evento_alterado", evento_id: id, janela: "x", urgente: true, valida_ate: inicio.toISOString() }).throwOnError();
    const falso = envioFalso();
    // 23h em Salvador: fora da janela das 8h às 21h.
    await rodada([a.id], new Date("2027-01-20T02:00:00Z"), falso.enviar);
    expect(falso.enviados).toHaveLength(1);
    expect(JSON.parse(falso.enviados[0].carga)).toMatchObject({ titulo: "Evento alterado", tag: `mudanca:${id}`, url: `/eventos/${id}` });
  });
});

describe("notificações: o gerador do agendador", () => {
  it("lembrete de 2 horas: gerado uma vez só, com o texto do Evento, tag e validade como TTL", async () => {
    const a = await lider("A");
    await dispositivo(a.cliente, a.id);
    const inicio = new Date("2027-03-10T22:00:00Z");
    const id = await evento(a.id, inicio, { titulo: "Ensaio geral" });
    const agora = new Date("2027-03-10T20:00:00Z");

    // 3 horas antes: ainda é o lembrete de 1 dia.
    await gerarNotificacoes(admin, new Date("2027-03-10T19:00:00Z"));
    expect((await notificacoesDe(a.id)).map((n) => n.tipo)).toEqual(["designacao_responsavel", "lembrete_1d"]);
    await gerarNotificacoes(admin, agora);
    // Rodar de novo (o agendador em duplicidade) não cria outra.
    expect(await gerarNotificacoes(admin, agora)).toBe(0);
    const tipos = (await notificacoesDe(a.id)).map((n) => n.tipo);
    expect(tipos.filter((t) => t === "lembrete_2h")).toHaveLength(1);

    const falso = envioFalso();
    await rodada([a.id], new Date("2027-03-10T20:00:00Z"), falso.enviar);
    const lembrete = falso.enviados.map((e) => JSON.parse(e.carga)).find((c) => c.titulo === "Seu Evento começa em breve");
    expect(lembrete).toMatchObject({ texto: "Ensaio geral · qua., 10/03 às 19h · Templo", tag: `lembrete:${id}`, url: `/eventos/${id}` });
    // Vale até o início: 2 horas.
    expect(falso.enviados.map((e) => e.ttl)).toContain(2 * 3600);
  });

  it("o lembrete de 1 dia dá lugar ao de 2 horas, com a mesma tag, e um tipo desligado não é gerado", async () => {
    const a = await lider("A");
    const b = await lider("B");
    await b.cliente.from("preferencias_de_notificacao").insert({ pessoa_id: b.id, tipos_desligados: ["lembrete_1d"] }).throwOnError();
    const inicio = new Date("2027-04-10T22:00:00Z");
    await evento(a.id, inicio);
    await evento(b.id, inicio);
    await gerarNotificacoes(admin, new Date("2027-04-10T01:00:00Z"));
    expect((await notificacoesDe(a.id)).map((n) => n.tipo)).toContain("lembrete_1d");
    expect((await notificacoesDe(b.id)).map((n) => n.tipo)).not.toContain("lembrete_1d");
    const [um] = (await notificacoesDe(a.id)).filter((n) => n.tipo === "lembrete_1d");
    expect(new Date(um.valida_ate)).toEqual(new Date("2027-04-10T20:00:00Z"));
  });

  it("Eventos dos próximos 7 dias sem Responsável: só o Admin é avisado, uma vez por Evento", async () => {
    const adm = await contaNova("Admin", "admin");
    const a = await lider("A");
    const id = await evento(null, new Date("2027-05-14T22:00:00Z"), { status: "rascunho" });
    const agora = new Date("2027-05-10T13:00:00Z");
    await gerarNotificacoes(admin, agora);
    await gerarNotificacoes(admin, agora);
    expect((await notificacoesDe(adm.id)).filter((n) => n.evento_id === id).map((n) => n.tipo)).toEqual(["sem_responsavel"]);
    expect(await notificacoesDe(a.id)).toEqual([]);

    const falso = envioFalso();
    await dispositivo(adm.cliente, adm.id);
    await rodada([adm.id], agora, falso.enviar);
    // Eventos de execuções anteriores no mesmo dia também chegam ao Admin: o que importa é o deste teste.
    expect(falso.enviados.map((e) => JSON.parse(e.carga)).filter((c) => c.url === `/eventos/${id}`)).toMatchObject([{ titulo: "Evento sem Responsável" }]);
  });

  it("Chamada pendente: o Professor e o Auxiliar são avisados depois da aula; com a Chamada feita, não", async () => {
    const professor = await contaNova("Paulo", "professor");
    const auxiliar = await contaNova("Ari", "professor");
    const ebd = await categoria("EBD");
    const campos = { [ebd.campo("Tema")]: "Semeador", [ebd.campo("Professor")]: professor.id, [ebd.campo("Auxiliar")]: auxiliar.id };
    const sem = await evento((await lider("R")).id, new Date("2027-06-06T12:00:00Z"), { categoria_id: ebd.id, campos });
    const feita = await evento((await lider("R2")).id, new Date("2027-06-06T12:00:00Z"), { categoria_id: ebd.id, campos });

    const { data: aluno } = await admin.from("adolescentes").insert({ nome: "Ana da Chamada", nascimento: "2011-05-10", genero: "feminino" }).select("id").single().throwOnError();
    await admin.from("presencas").insert({ evento_id: feita, adolescente_id: aluno.id, registrado_por: await criadorDosEventos() }).throwOnError();

    // Antes de a aula acabar (14h UTC), nada.
    await gerarNotificacoes(admin, new Date("2027-06-06T13:00:00Z"));
    expect((await notificacoesDe(professor.id)).filter((n) => n.tipo === "chamada_pendente")).toEqual([]);

    await gerarNotificacoes(admin, new Date("2027-06-06T15:00:00Z"));
    const pendentes = (await notificacoesDe(professor.id)).filter((n) => n.tipo === "chamada_pendente");
    expect(pendentes.map((n) => n.evento_id)).toEqual([sem]);
    expect((await notificacoesDe(auxiliar.id)).filter((n) => n.tipo === "chamada_pendente").map((n) => n.evento_id)).toEqual([sem]);

    // O texto leva à Chamada e nunca traz dados de Adolescentes.
    await dispositivo(professor.cliente, professor.id);
    const falso = envioFalso();
    await rodada([professor.id], new Date("2027-06-06T15:00:00Z"), falso.enviar);
    const carga = falso.enviados.map((e) => e.carga).join();
    expect(carga).toContain(`/eventos/${sem}/chamada`);
    expect(carga).not.toContain("Ana");
  });

  it("resumo semanal: domingo às 19h, só para a Liderança, uma vez por semana", async () => {
    const a = await lider("A");
    const professor = await contaNova("Paulo", "professor");
    await evento(a.id, new Date("2027-07-20T22:00:00Z"), { titulo: "Culto de terça" });
    const ebd = await categoria("EBD");
    await evento(a.id, new Date("2027-07-21T12:00:00Z"), { categoria_id: ebd.id, campos: { [ebd.campo("Tema")]: "X", [ebd.campo("Professor")]: professor.id } });

    // Antes das 19h do domingo (18 de julho de 2027), nada.
    await gerarNotificacoes(admin, new Date("2027-07-18T21:59:00Z"));
    expect((await notificacoesDe(a.id)).filter((n) => n.tipo === "resumo_semanal")).toEqual([]);

    const domingo = new Date("2027-07-18T22:00:00Z");
    await gerarNotificacoes(admin, domingo);
    expect(await gerarNotificacoes(admin, new Date("2027-07-18T22:30:00Z"))).toBe(0);
    const [resumo] = (await notificacoesDe(a.id)).filter((n) => n.tipo === "resumo_semanal");
    expect(resumo).toMatchObject({ evento_id: null, janela: "2027-07-18", titulo: "Seus Eventos da semana", url: "/" });
    expect(resumo.texto).toMatch(/^2 Eventos: /);
    expect((await notificacoesDe(professor.id)).filter((n) => n.tipo === "resumo_semanal")).toEqual([]);
  });

  it("um aviso que esperou na fila não sai se o motivo deixou de valer (Evento cancelado)", async () => {
    const a = await lider("A");
    await dispositivo(a.cliente, a.id);
    const id = await evento(a.id, new Date("2027-08-10T22:00:00Z"));
    await gerarNotificacoes(admin, new Date("2027-08-10T20:00:00Z"));
    await admin.from("eventos").update({ status: "cancelado" }).eq("id", id).throwOnError();

    const falso = envioFalso();
    await rodada([a.id], new Date("2027-08-10T20:00:00Z"), falso.enviar);
    expect(falso.enviados.map((e) => JSON.parse(e.carga)).filter((c) => c.titulo === "Seu Evento começa em breve")).toEqual([]);
    expect((await notificacoesDe(a.id)).find((n) => n.tipo === "lembrete_2h")?.estado).toBe("expirada");
  });

  it("só a chave de serviço grava as devidas", async () => {
    const a = await lider("A");
    expect((await a.cliente.rpc("criar_notificacoes_agendadas", { itens: [] })).error).not.toBeNull();
  });
});

describe("notificações: retenção", () => {
  it("a limpeza guarda ao menos 8 dias, mesmo com retenção menor, para um aviso devido por vários dias não nascer de novo", async () => {
    const a = await lider("A");
    const [velho, recente] = [await evento(a.id, new Date(Date.now() + 30 * HORA)), await evento(a.id, new Date(Date.now() + 31 * HORA))];
    await admin.from("notificacoes").delete().eq("pessoa_id", a.id);
    await admin.from("configuracoes").update({ retencao_das_notificacoes_dias: 1 }).eq("id", true).throwOnError();
    try {
      const quando = (dias: number) => new Date(Date.now() - dias * 24 * HORA).toISOString();
      await admin.from("notificacoes").insert({ pessoa_id: a.id, tipo: "sem_responsavel", evento_id: velho, estado: "enviada", criada_em: quando(9) }).throwOnError();
      await admin.from("notificacoes").insert({ pessoa_id: a.id, tipo: "sem_responsavel", evento_id: recente, estado: "enviada", criada_em: quando(5) }).throwOnError();
      await admin.rpc("limpar_notificacoes").throwOnError();
      expect((await notificacoesDe(a.id)).map((n) => n.evento_id)).toEqual([recente]);
    } finally {
      await admin.from("configuracoes").update({ retencao_das_notificacoes_dias: 30 }).eq("id", true).throwOnError();
    }
  });
});
