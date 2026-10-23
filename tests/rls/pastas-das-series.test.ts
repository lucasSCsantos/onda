import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ErroDoDrive, nomeDaPasta } from "@/dominio/drive";
import { tituloDeExibicao } from "@/dominio/eventos";
import { driveFalso } from "@/lib/drive/falso";
import { processarFilaDePastas } from "@/lib/drive/fila";
import { admin, anonimo, categoria, comFuncoes, criar, eventoDe } from "./ambiente";

// Ticket 05: pastas das Séries, renomear e "Criar pasta agora". O banco local é compartilhado com outros testes,
// então cada teste olha só para os próprios Eventos (títulos únicos).

const RAIZ = "RAIZ1234567890abcdef";
const LINK_MANUAL = "https://exemplo.com/minha-pasta";
const HORA_MS = 60 * 60 * 1000;
const NADA = "00000000-0000-0000-0000-000000000000";

const configurar = (mudancas: Record<string, unknown>) => admin.from("configuracoes").update(mudancas).eq("id", true).throwOnError();
const ligar = () => configurar({ drive_ligado: true, drive_pasta_raiz_id: RAIZ });
const liderDoEnsino = () => comFuncoes("Líder do ensino", "lider", ["Líder do ensino"]);

type Linha = { pasta_id: string | null; pasta_estado: string | null; campos: Record<string, unknown> };
const eventoLido = async (id: string) =>
  (await admin.from("eventos").select("pasta_id, pasta_estado, campos").eq("id", id).single().throwOnError()).data as Linha;
const tarefaDe = async (evento: string) =>
  (await admin.from("tarefas_de_pasta").select("*").eq("evento_id", evento).maybeSingle().throwOnError()).data;
const logsDe = async (objeto: string) => (await admin.from("logs").select("acao").eq("objeto_id", objeto).throwOnError()).data!;
const vencer = (evento: string) =>
  admin.from("tarefas_de_pasta").update({ proxima_tentativa: new Date(Date.now() - 1000).toISOString() }).eq("evento_id", evento).throwOnError();

/** Uma Série semanal de EBD com três Ocorrências, criada por quem cria aulas de EBD. */
async function umaSerieDeEbd() {
  const lider = await liderDoEnsino();
  const ebd = await categoria("EBD");
  const titulo = `Série ${crypto.randomUUID().slice(0, 8)}`;
  const ocorrencias = [1, 8, 15].map((dias) => {
    const colunas: Record<string, unknown> = eventoDe("", lider.id, {
      titulo,
      inicio: new Date(Date.now() + 24 * HORA_MS * dias).toISOString(),
      fim: null,
      campos: { [ebd.campo("Tema")]: "Tema" },
    });
    delete colunas.categoria_id;
    return colunas;
  });
  const { data, error } = await lider.cliente.rpc("criar_serie", {
    categoria: ebd.id,
    regra: { frequencia: "semanal", dias: [0], termino: { ocorrencias: 3 } },
    primeiro_dia: new Date(Date.now() + 24 * HORA_MS).toISOString().slice(0, 10),
    ocorrencias,
  });
  if (error) throw error;
  const { data: criadas } = await admin
    .from("eventos")
    .select("id, inicio, numero_da_ocorrencia")
    .eq("serie_id", data)
    .order("inicio")
    .throwOnError();
  return { titulo, ocorrencias: criadas! };
}

/** Uma aula avulsa de EBD, em 24/10/2026, com o Drive no estado em que estiver. */
async function aulaAvulsa(rotulo: string, campos: Record<string, unknown> = {}) {
  const lider = await liderDoEnsino();
  const ebd = await categoria("EBD");
  const titulo = `${rotulo} ${crypto.randomUUID().slice(0, 8)}`;
  const { data, error } = await criar(
    lider.cliente,
    eventoDe(ebd.id, lider.id, { titulo, fim: null, campos: { [ebd.campo("Tema")]: "Tema", ...campos } }),
  );
  if (error) throw error;
  return { lider, ebd, id: data!.id as string, titulo, link: ebd.campo("Link do material"), pasta: `2026-10-24 · ${titulo}` };
}

beforeEach(async () => {
  await admin.from("tarefas_de_pasta").delete().neq("id", NADA).throwOnError();
});

afterAll(async () => {
  await configurar({ drive_ligado: false, drive_pasta_raiz_id: null });
});

describe("pastas das Séries", () => {
  beforeEach(ligar);

  it("criar a Série só enfileira: uma tarefa e uma pasta pendente por Ocorrência", async () => {
    const { ocorrencias } = await umaSerieDeEbd();

    for (const o of ocorrencias) {
      expect(await tarefaDe(o.id)).toMatchObject({ estado: "pendente", operacao: "criar", tentativas: 0 });
      expect((await eventoLido(o.id)).pasta_estado).toBe("pendente");
    }
  });

  it("uma pasta por Ocorrência, com o número no nome; a falha de uma não impede as outras e é refeita sem duplicar", async () => {
    const drive = driveFalso();
    const { titulo, ocorrencias } = await umaSerieDeEbd();
    const [primeira, segunda, terceira] = ocorrencias;
    const nome = (o: (typeof ocorrencias)[number]) => nomeDaPasta({ inicio: new Date(o.inicio), titulo: tituloDeExibicao({ titulo, numero: o.numero_da_ocorrencia }) });
    drive.falharAoMexerEm(nome(segunda), new Error("Drive fora do ar"));

    await processarFilaDePastas(admin, drive.cliente);

    expect(ocorrencias.map((o) => o.numero_da_ocorrencia)).toEqual([1, 2, 3]);
    expect((await tarefaDe(primeira.id)).estado).toBe("feita");
    expect((await tarefaDe(terceira.id)).estado).toBe("feita");
    expect(await tarefaDe(segunda.id)).toMatchObject({ estado: "pendente", erro: "Drive fora do ar" });
    expect(drive.pastas.filter((p) => p.nome.includes(titulo)).map((p) => p.nome)).toEqual([nome(primeira), nome(terceira)]);

    await vencer(segunda.id);
    await processarFilaDePastas(admin, drive.cliente);
    expect(await tarefaDe(segunda.id)).toMatchObject({ estado: "feita", tentativas: 2 });
    expect(drive.pastas.filter((p) => p.nome.includes(titulo))).toHaveLength(3);
    expect((await eventoLido(segunda.id)).pasta_estado).toBe("criada");
  });
});

describe("renomear a pasta", () => {
  beforeEach(ligar);

  it("mudar o título renomeia a pasta existente, sem criar outra nem apagar nada, e o link continua", async () => {
    const drive = driveFalso();
    const { id, link, pasta } = await aulaAvulsa("Aula renomear");
    await processarFilaDePastas(admin, drive.cliente);
    const criada = drive.pastas.find((p) => p.nome === pasta)!;
    const antes = await eventoLido(id);

    await admin.from("eventos").update({ titulo: "Aula com outro nome" }).eq("id", id).throwOnError();
    expect(await tarefaDe(id)).toMatchObject({ estado: "pendente", operacao: "renomear", tentativas: 0 });
    const contagem = await processarFilaDePastas(admin, drive.cliente);

    expect(contagem.renomeadas).toBeGreaterThanOrEqual(1);
    expect(criada.nome).toBe("2026-10-24 · Aula com outro nome");
    expect(drive.pastas.filter((p) => p.id === criada.id)).toHaveLength(1);
    expect(await tarefaDe(id)).toMatchObject({ estado: "feita", operacao: "renomear" });
    expect(await eventoLido(id)).toEqual(antes);
    expect(antes.campos[link]).toContain(criada.id);
    expect((await logsDe(id)).some((l) => l.acao === "drive.pasta_renomeada")).toBe(true);
  });

  it("mudar a data renomeia; cancelar ou mudar outro campo não toca na pasta", async () => {
    const drive = driveFalso();
    const { id, pasta } = await aulaAvulsa("Aula data");
    await processarFilaDePastas(admin, drive.cliente);
    const criada = drive.pastas.find((p) => p.nome === pasta)!;

    await admin.from("eventos").update({ status: "cancelado", observacoes: "x" }).eq("id", id).throwOnError();
    expect(await tarefaDe(id)).toMatchObject({ estado: "feita", operacao: "criar" });
    await processarFilaDePastas(admin, drive.cliente);
    expect(criada.nome).toBe(pasta);

    await admin.from("eventos").update({ inicio: "2026-11-07T15:00:00Z" }).eq("id", id).throwOnError();
    await processarFilaDePastas(admin, drive.cliente);
    expect(criada.nome).toBe(pasta.replace("2026-10-24", "2026-11-07"));
  });

  it("editar antes de a pasta nascer não enfileira renomeação: a criação já usa o título de agora", async () => {
    const { id, ebd } = await aulaAvulsa("Aula antes");
    await admin.from("eventos").update({ titulo: "Aula antes, outro nome" }).eq("id", id).throwOnError();

    expect(await tarefaDe(id)).toMatchObject({ estado: "pendente", operacao: "criar" });
    const drive = driveFalso();
    await processarFilaDePastas(admin, drive.cliente);
    expect(drive.pastas.some((p) => p.nome === "2026-10-24 · Aula antes, outro nome")).toBe(true);
    expect(ebd.id).toBeTruthy();
  });

  it("uma edição no meio da rodada não se perde: a criação que partiu com o nome antigo pede a renomeação ao terminar", async () => {
    const drive = driveFalso();
    const { id, pasta } = await aulaAvulsa("Aula corrida");
    // O Drive demora: enquanto ele responde, a pessoa edita o título.
    const original = drive.cliente.criarPasta;
    drive.cliente.criarPasta = async (nome, pai) => {
      const criada = await original(nome, pai);
      if (nome === pasta) await admin.from("eventos").update({ titulo: "Aula corrida, renomeada" }).eq("id", id).throwOnError();
      return criada;
    };

    await processarFilaDePastas(admin, drive.cliente);
    expect(await tarefaDe(id)).toMatchObject({ estado: "pendente", operacao: "renomear" });
    expect((await eventoLido(id)).pasta_estado).toBe("criada");

    await processarFilaDePastas(admin, drive.cliente);
    expect(drive.pastas.map((p) => p.nome)).toContain("2026-10-24 · Aula corrida, renomeada");
    expect(drive.pastas.filter((p) => p.nome === pasta)).toHaveLength(0);
    expect(await tarefaDe(id)).toMatchObject({ estado: "feita", operacao: "renomear" });
  });

  it("uma edição durante a renomeação reabre a tarefa em vez de fechá-la", async () => {
    const drive = driveFalso();
    const { id, pasta } = await aulaAvulsa("Aula renomear corrida");
    await processarFilaDePastas(admin, drive.cliente);
    await admin.from("eventos").update({ titulo: "Primeiro nome novo" }).eq("id", id).throwOnError();
    const original = drive.cliente.renomearPasta;
    drive.cliente.renomearPasta = async (pastaId, nome) => {
      await original(pastaId, nome);
      await admin.from("eventos").update({ titulo: "Segundo nome novo" }).eq("id", id).throwOnError();
    };

    await processarFilaDePastas(admin, drive.cliente);
    expect(await tarefaDe(id)).toMatchObject({ estado: "pendente", operacao: "renomear" });

    drive.cliente.renomearPasta = original;
    await processarFilaDePastas(admin, drive.cliente);
    expect(drive.pastas.map((p) => p.nome)).toContain("2026-10-24 · Segundo nome novo");
    expect(drive.pastas.some((p) => p.nome === pasta)).toBe(false);
    expect(await tarefaDe(id)).toMatchObject({ estado: "feita" });
  });

  it("falha passageira tenta de novo e vira Log; a definitiva fecha a tarefa mas a pasta continua criada", async () => {
    const drive = driveFalso();
    const { id } = await aulaAvulsa("Aula falha renomear");
    await processarFilaDePastas(admin, drive.cliente);

    drive.falharAoMexerEm("2026-10-24 · Falha nova", new Error("Drive fora do ar"));
    await admin.from("eventos").update({ titulo: "Falha nova" }).eq("id", id).throwOnError();
    await processarFilaDePastas(admin, drive.cliente);
    expect(await tarefaDe(id)).toMatchObject({ estado: "pendente", operacao: "renomear", tentativas: 1, erro: "Drive fora do ar" });
    expect((await logsDe(id)).some((l) => l.acao === "drive.pasta_renomear_falhou")).toBe(true);

    await vencer(id);
    await processarFilaDePastas(admin, drive.cliente);
    expect(await tarefaDe(id)).toMatchObject({ estado: "feita" });

    drive.falharAoMexerEm("2026-10-24 · De novo", new ErroDoDrive("pasta sumiu", { permanente: true }));
    await admin.from("eventos").update({ titulo: "De novo" }).eq("id", id).throwOnError();
    await processarFilaDePastas(admin, drive.cliente);
    expect(await tarefaDe(id)).toMatchObject({ estado: "falhou", operacao: "renomear" });
    expect((await eventoLido(id)).pasta_estado).toBe("criada");
  });
});

describe("Criar pasta agora", () => {
  /** Eventos criados com o Drive desligado: nascem sem pasta, como os de antes da integração. */
  beforeEach(() => configurar({ drive_ligado: false, drive_pasta_raiz_id: null }));

  it("cria a pasta de um Evento sem pasta, pela fila e sem esperar o Drive", async () => {
    const { lider, id, link, pasta } = await aulaAvulsa("Aula antiga");
    expect(await tarefaDe(id)).toBeNull();
    await ligar();

    const { error } = await lider.cliente.rpc("criar_pasta_agora", { evento: id });
    expect(error).toBeNull();
    expect((await eventoLido(id)).pasta_estado).toBe("pendente");
    expect(await tarefaDe(id)).toMatchObject({ estado: "pendente", operacao: "criar", tentativas: 0 });

    const drive = driveFalso();
    await processarFilaDePastas(admin, drive.cliente);
    const evento = await eventoLido(id);
    expect(evento.pasta_estado).toBe("criada");
    expect(evento.campos[link]).toContain(drive.pastas.find((p) => p.nome === pasta)!.id);
    expect((await logsDe(id)).some((l) => l.acao === "drive.pasta_solicitada")).toBe(true);
  });

  it("respeita o link manual: a pasta nasce, mas o link não é trocado", async () => {
    const ebd = await categoria("EBD");
    const { lider, id, link, pasta } = await aulaAvulsa("Aula com link", { [ebd.campo("Link do material")]: LINK_MANUAL });
    await ligar();

    await lider.cliente.rpc("criar_pasta_agora", { evento: id }).throwOnError();
    const drive = driveFalso();
    await processarFilaDePastas(admin, drive.cliente);

    const evento = await eventoLido(id);
    expect(evento.pasta_estado).toBe("criada");
    expect(evento.campos[link]).toBe(LINK_MANUAL);
    expect(drive.pastas.filter((p) => p.nome === pasta)).toHaveLength(1);
  });

  it("reabre a tarefa fechada de um Evento com erro, zerando as tentativas", async () => {
    const { lider, id, pasta } = await aulaAvulsa("Aula com erro");
    await admin
      .from("tarefas_de_pasta")
      .insert({ evento_id: id, estado: "falhou", tentativas: 5, erro: "sem acesso", concluido_em: new Date().toISOString() })
      .throwOnError();
    await admin.from("eventos").update({ pasta_estado: "falhou" }).eq("id", id).throwOnError();
    await ligar();

    await lider.cliente.rpc("criar_pasta_agora", { evento: id }).throwOnError();
    expect(await tarefaDe(id)).toMatchObject({ estado: "pendente", tentativas: 0, erro: null, concluido_em: null });

    const drive = driveFalso();
    await processarFilaDePastas(admin, drive.cliente);
    expect((await eventoLido(id)).pasta_estado).toBe("criada");
    expect(drive.pastas.filter((p) => p.nome === pasta)).toHaveLength(1);
  });

  it("recusa com mensagem clara: Drive desligado, pasta já a caminho, sem permissão", async () => {
    const { lider, id } = await aulaAvulsa("Aula recusa");

    const desligado = await lider.cliente.rpc("criar_pasta_agora", { evento: id });
    expect(desligado.error?.message).toMatch(/Drive não está ligado/);

    await ligar();
    const estranho = await comFuncoes("Estranha", "lider", ["Líder do louvor"]);
    expect((await estranho.cliente.rpc("criar_pasta_agora", { evento: id })).error?.code).toBe("42501");
    expect((await anonimo().rpc("criar_pasta_agora", { evento: id })).error).not.toBeNull();

    await lider.cliente.rpc("criar_pasta_agora", { evento: id }).throwOnError();
    const repetido = await lider.cliente.rpc("criar_pasta_agora", { evento: id });
    expect(repetido.error?.message).toMatch(/já tem pasta/);
    expect(await tarefaDe(id)).toMatchObject({ estado: "pendente", operacao: "criar" });
  });
});
