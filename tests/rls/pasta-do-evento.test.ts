import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ErroDoDrive } from "@/dominio/drive";
import { processarFilaDePastas } from "@/lib/drive/fila";
import { driveFalso } from "@/lib/drive/falso";
import { admin, anonimo, categoria, comFuncoes, criar, eventoDe } from "./ambiente";

const RAIZ = "RAIZ1234567890abcdef";
const LINK_MANUAL = "https://exemplo.com/minha-pasta";

const configurar = (mudancas: Record<string, unknown>) => admin.from("configuracoes").update(mudancas).eq("id", true).throwOnError();
const ligar = () => configurar({ drive_ligado: true, drive_pasta_raiz_id: RAIZ });

/** Quem cria aulas de EBD: a Função do Ensino. */
const liderDoEnsino = () => comFuncoes("Líder do ensino", "lider", ["Líder do ensino"]);

type Linha = { pasta_id: string | null; pasta_estado: string | null; campos: Record<string, unknown> };

/** Cria um Evento e devolve o id com o campo "Link do material" da Categoria. */
async function eventoNovo(nome: "EBD" | "Culto" | "Pequeno grupo", mudancas: Record<string, unknown> = {}) {
  const lider = await comFuncoes("Líder", "lider", ["Líder do ministério"]);
  const cat = await categoria(nome);
  const obrigatorios = {
    EBD: () => ({ [cat.campo("Tema")]: "Tema de teste" }),
    "Pequeno grupo": () => ({ [cat.campo("Grupo")]: "Grupo único" }),
    Culto: () => ({}),
  };
  const campos = { ...obrigatorios[nome](), ...((mudancas.campos as Record<string, unknown> | undefined) ?? {}) };
  const { data, error } = await criar(lider.cliente, eventoDe(cat.id, lider.id, { titulo: "Aula de teste", ...mudancas, campos }));
  if (error) throw error;
  return { id: data!.id as string, cat, link: nome === "Culto" ? null : cat.campo("Link do material") };
}

const eventoLido = async (id: string) =>
  (await admin.from("eventos").select("pasta_id, pasta_estado, campos").eq("id", id).single().throwOnError()).data as Linha;

const tarefaDe = async (evento: string) =>
  (await admin.from("tarefas_de_pasta").select("*").eq("evento_id", evento).maybeSingle().throwOnError()).data;

const reservar = async (evento: string) => {
  const { data } = await admin.rpc("reservar_tarefas_de_pasta", { limite: 500 }).throwOnError();
  return (data as { tarefa_id: string; evento_id: string; categoria: string; titulo: string; tentativas: number; raiz: string }[]).find(
    (t) => t.evento_id === evento,
  );
};

const logsDe = async (objeto: string) =>
  (await admin.from("logs").select("acao, resultado, severidade, origem, detalhes").eq("objeto_id", objeto).throwOnError()).data!;

beforeAll(async () => {
  // Tarefas que ficaram de outras execuções não entram na conta destes testes.
  await admin.from("tarefas_de_pasta").delete().neq("id", "00000000-0000-0000-0000-000000000000").throwOnError();
});

afterAll(async () => {
  await configurar({ drive_ligado: false, drive_pasta_raiz_id: null });
});

describe("configuração do Drive", () => {
  it("nasce desligada, e as Categorias com pasta automática são a EBD e o Pequeno grupo", async () => {
    const { data } = await admin.from("configuracoes").select("drive_ligado, drive_categorias").single().throwOnError();
    const ebd = await categoria("EBD");
    const grupo = await categoria("Pequeno grupo");
    expect(data.drive_ligado).toBe(false);
    expect([...data.drive_categorias].sort()).toEqual([ebd.id, grupo.id].sort());
  });

  it("só o Admin muda, e a mudança vira Log com as Categorias pelo nome", async () => {
    const lucas = await comFuncoes("Lucas", "admin", []);
    const carol = await liderDoEnsino();
    const culto = await categoria("Culto");
    const ebd = await categoria("EBD");

    const barrada = await carol.cliente.from("configuracoes").update({ drive_ligado: true }).eq("id", true).select("id");
    expect(barrada.data).toEqual([]);

    const antes = (await admin.from("logs").select("id").eq("acao", "drive.configuracao_alterada")).data!.length;
    const feita = await lucas.cliente
      .from("configuracoes")
      .update({ drive_ligado: true, drive_pasta_raiz_id: RAIZ, drive_categorias: [ebd.id, culto.id] })
      .eq("id", true)
      .select("id");
    expect(feita.data).toHaveLength(1);

    const { data: logs } = await admin
      .from("logs")
      .select("modulo, detalhes")
      .eq("acao", "drive.configuracao_alterada")
      .order("id", { ascending: false })
      .limit(3);
    expect(logs!.length).toBeGreaterThan(0);
    expect((await admin.from("logs").select("id").eq("acao", "drive.configuracao_alterada")).data!.length).toBeGreaterThan(antes);
    expect(logs!.every((l) => l.modulo === "drive")).toBe(true);
    const categorias = logs!.find((l) => (l.detalhes as { chave: string }).chave === "drive_categorias")!.detalhes as { depois: string[] };
    expect([...categorias.depois].sort()).toEqual(["Culto", "EBD"]);

    // Volta ao padrão para os outros testes.
    const grupo = await categoria("Pequeno grupo");
    await configurar({ drive_ligado: false, drive_pasta_raiz_id: null, drive_categorias: [ebd.id, grupo.id] });
  });

  it("recusa uma pasta raiz em branco ou estranha quando o Drive está ligado", async () => {
    expect((await admin.from("configuracoes").update({ drive_ligado: true, drive_pasta_raiz_id: "" }).eq("id", true)).error).not.toBeNull();
    expect((await admin.from("configuracoes").update({ drive_ligado: true, drive_pasta_raiz_id: null }).eq("id", true)).error).not.toBeNull();
    expect((await admin.from("configuracoes").update({ drive_pasta_raiz_id: "tem espaço" }).eq("id", true)).error).not.toBeNull();
  });
});

describe("quando um Evento ganha uma tarefa de pasta", () => {
  it("com o Drive ligado, uma aula avulsa de EBD entra na fila e fica com a pasta pendente", async () => {
    await ligar();
    const { id } = await eventoNovo("EBD");

    const tarefa = await tarefaDe(id);
    expect(tarefa).toMatchObject({ estado: "pendente", tentativas: 0 });
    expect((await eventoLido(id)).pasta_estado).toBe("pendente");
  });

  it("o Pequeno grupo também, pelo campo Link do material que ele ganhou", async () => {
    await ligar();
    const { id } = await eventoNovo("Pequeno grupo", { campos: {} });
    expect(await tarefaDe(id)).toMatchObject({ estado: "pendente" });
  });

  it("com o Drive desligado, nada entra na fila e o Evento nasce normal", async () => {
    await configurar({ drive_ligado: false });
    const { id } = await eventoNovo("EBD");

    expect(await tarefaDe(id)).toBeNull();
    expect(await eventoLido(id)).toMatchObject({ pasta_id: null, pasta_estado: null });
  });

  it("Categoria fora da lista do Admin não entra", async () => {
    await ligar();
    const { id } = await eventoNovo("Culto");
    expect(await tarefaDe(id)).toBeNull();
  });

  it("um link digitado à mão na criação dispensa a pasta", async () => {
    await ligar();
    const ebd = await categoria("EBD");
    const { id } = await eventoNovo("EBD", { campos: { [ebd.campo("Link do material")]: LINK_MANUAL } });

    expect(await tarefaDe(id)).toBeNull();
    expect(await eventoLido(id)).toMatchObject({ pasta_estado: null });
  });

  it("uma Ocorrência de Série também entra na fila (as pastas das Séries têm o teste próprio em pastas-das-series)", async () => {
    await ligar();
    const lucas = await comFuncoes("Lucas", "admin", []);
    const ebd = await categoria("EBD");
    const { data: serie } = await admin
      .from("series")
      .insert({ categoria_id: ebd.id, regra: { frequencia: "semanal" }, primeiro_dia: "2026-11-01", criado_por: lucas.id })
      .select("id")
      .single()
      .throwOnError();
    const { id } = await eventoNovo("EBD", { serie_id: serie.id });

    expect(await tarefaDe(id)).toMatchObject({ operacao: "criar" });
  });
});

describe("a fila é só do servidor", () => {
  it("ninguém da interface lê a tabela, nem anônimo, e as funções do agendador estão fechadas", async () => {
    await ligar();
    const carol = await liderDoEnsino();
    const lucas = await comFuncoes("Lucas", "admin", []);
    await eventoNovo("EBD");

    for (const cliente of [carol.cliente, lucas.cliente, anonimo()]) {
      const { data } = await cliente.from("tarefas_de_pasta").select("id");
      expect(data ?? []).toEqual([]);
    }
    for (const cliente of [carol.cliente, lucas.cliente, anonimo()]) {
      expect((await cliente.rpc("reservar_tarefas_de_pasta", { limite: 5 })).error).not.toBeNull();
      expect((await cliente.rpc("concluir_tarefa_de_pasta", { tarefa: crypto.randomUUID(), pasta: "x", link: "https://x.com" })).error).not.toBeNull();
      expect(
        (await cliente.rpc("falhar_tarefa_de_pasta", { tarefa: crypto.randomUUID(), erro: "x", definitiva: true, depois_de_minutos: 1 })).error,
      ).not.toBeNull();
    }
  });

  it("as colunas da pasta no Evento não se escrevem pela interface", async () => {
    await ligar();
    const { id } = await eventoNovo("EBD");
    const lucas = await comFuncoes("Lucas", "admin", []);
    const tentativa = await lucas.cliente.from("eventos").update({ pasta_estado: "criada", pasta_id: "falso" }).eq("id", id);
    expect(tentativa.error).not.toBeNull();
  });
});

describe("o agendador processa a fila", () => {
  it("reserva a tarefa uma vez só, com o que precisa para montar o caminho", async () => {
    await ligar();
    const { id } = await eventoNovo("EBD", { titulo: "Aula 7" });

    const primeira = await reservar(id);
    expect(primeira).toMatchObject({ categoria: "EBD", titulo: "Aula 7", tentativas: 1, raiz: RAIZ });
    expect(await reservar(id)).toBeUndefined();
  });

  it("com o Drive desligado, nada é reservado, e a tarefa espera", async () => {
    await ligar();
    const { id } = await eventoNovo("EBD");
    await configurar({ drive_ligado: false });

    expect(await reservar(id)).toBeUndefined();
    expect(await tarefaDe(id)).toMatchObject({ estado: "pendente", tentativas: 0 });
  });

  it("concluir grava o link no Link do material, a pasta e o Log, sem contar como edição de pessoa", async () => {
    await ligar();
    const { id, link } = await eventoNovo("EBD");
    const tarefa = (await reservar(id))!;

    const { error } = await admin.rpc("concluir_tarefa_de_pasta", {
      tarefa: tarefa.tarefa_id,
      pasta: "PASTA123456",
      link: "https://drive.google.com/drive/folders/PASTA123456",
    });
    expect(error).toBeNull();

    const evento = await eventoLido(id);
    expect(evento).toMatchObject({ pasta_id: "PASTA123456", pasta_estado: "criada" });
    expect(evento.campos[link!]).toBe("https://drive.google.com/drive/folders/PASTA123456");
    expect(await tarefaDe(id)).toMatchObject({ estado: "feita", erro: null });
    const log = (await logsDe(id)).find((l) => l.acao === "drive.pasta_criada");
    expect(log).toMatchObject({ resultado: "sucesso", origem: "sistema" });
    const { data: editado } = await admin.from("eventos").select("editado_por").eq("id", id).single().throwOnError();
    expect(editado.editado_por).toBeNull();
  });

  it("concluir nunca sobrescreve um link que alguém digitou enquanto a tarefa esperava", async () => {
    await ligar();
    const { id, link } = await eventoNovo("EBD");
    const tarefa = (await reservar(id))!;
    await admin.from("eventos").update({ campos: { ...(await eventoLido(id)).campos, [link!]: LINK_MANUAL } }).eq("id", id).throwOnError();

    await admin.rpc("concluir_tarefa_de_pasta", { tarefa: tarefa.tarefa_id, pasta: "PASTA999", link: "https://drive.google.com/drive/folders/PASTA999" }).throwOnError();

    const evento = await eventoLido(id);
    expect(evento.campos[link!]).toBe(LINK_MANUAL);
    expect(evento).toMatchObject({ pasta_id: "PASTA999", pasta_estado: "criada" });
  });

  it("concluir uma tarefa que já foi feita não mexe em nada", async () => {
    await ligar();
    const { id, link } = await eventoNovo("EBD");
    const tarefa = (await reservar(id))!;
    await admin.rpc("concluir_tarefa_de_pasta", { tarefa: tarefa.tarefa_id, pasta: "PRIMEIRA11", link: "https://drive.google.com/drive/folders/PRIMEIRA11" }).throwOnError();
    await admin.rpc("concluir_tarefa_de_pasta", { tarefa: tarefa.tarefa_id, pasta: "SEGUNDA222", link: "https://drive.google.com/drive/folders/SEGUNDA222" }).throwOnError();

    const evento = await eventoLido(id);
    expect(evento.pasta_id).toBe("PRIMEIRA11");
    expect(evento.campos[link!]).toBe("https://drive.google.com/drive/folders/PRIMEIRA11");
  });

  it("uma falha passageira adia a tarefa, guarda o erro e registra um aviso", async () => {
    await ligar();
    const { id } = await eventoNovo("EBD");
    const tarefa = (await reservar(id))!;

    await admin.rpc("falhar_tarefa_de_pasta", { tarefa: tarefa.tarefa_id, erro: "Drive fora do ar", definitiva: false, depois_de_minutos: 5 }).throwOnError();

    const depois = await tarefaDe(id);
    expect(depois).toMatchObject({ estado: "pendente", erro: "Drive fora do ar" });
    expect(new Date(depois.proxima_tentativa).getTime()).toBeGreaterThan(Date.now() + 4 * 60_000);
    expect((await eventoLido(id)).pasta_estado).toBe("pendente");
    expect((await logsDe(id)).find((l) => l.acao === "drive.pasta_falhou")).toMatchObject({ resultado: "falha", severidade: "aviso" });
    expect(await reservar(id)).toBeUndefined();
  });

  it("uma falha definitiva fecha a tarefa, marca a pasta com erro e registra um erro", async () => {
    await ligar();
    const { id } = await eventoNovo("EBD");
    const tarefa = (await reservar(id))!;

    await admin.rpc("falhar_tarefa_de_pasta", { tarefa: tarefa.tarefa_id, erro: "pasta raiz sem acesso", definitiva: true, depois_de_minutos: 0 }).throwOnError();

    expect(await tarefaDe(id)).toMatchObject({ estado: "falhou", erro: "pasta raiz sem acesso" });
    expect((await eventoLido(id)).pasta_estado).toBe("falhou");
    expect((await logsDe(id)).find((l) => l.acao === "drive.pasta_falhou")).toMatchObject({ resultado: "falha", severidade: "erro" });
  });

  it("uma tarefa que gastou as tentativas sem nunca receber resposta fecha com erro na próxima reserva", async () => {
    await ligar();
    const { id } = await eventoNovo("EBD");
    // A rota caiu depois de reservar, cinco vezes seguidas: a tarefa voltou a ficar devida sem nunca ter falhado no Drive.
    await admin
      .from("tarefas_de_pasta")
      .update({ tentativas: 5, proxima_tentativa: new Date(Date.now() - 1000).toISOString() })
      .eq("evento_id", id)
      .throwOnError();

    expect(await reservar(id)).toBeUndefined();

    expect(await tarefaDe(id)).toMatchObject({ estado: "falhou", erro: "a rodada do agendador não respondeu" });
    expect((await eventoLido(id)).pasta_estado).toBe("falhou");
    const log = (await logsDe(id)).find((l) => l.acao === "drive.pasta_falhou")!;
    expect(log).toMatchObject({ resultado: "falha", severidade: "erro", detalhes: { definitiva: true, tentativa: 5 } });
  });

  it("chamar o agendador sem segredo e sem URL configurados não faz nada e não dá erro", async () => {
    const { error } = await admin.rpc("processar_pastas_do_drive");
    expect(error).toBeNull();
  });
});

describe("o Admin e o Evento", () => {
  it("o Evento mostra a pasta a quem lê Eventos, e a Liderança vê o estado", async () => {
    await ligar();
    const { id } = await eventoNovo("EBD");
    const carol = await liderDoEnsino();
    const { data } = await carol.cliente.from("eventos").select("pasta_estado").eq("id", id).single();
    expect(data).toEqual({ pasta_estado: "pendente" });
  });
});

// O processador da fila, ligando o banco real a um Drive em memória. O banco local é compartilhado: outros testes
// podem criar aulas de EBD enquanto o Drive está ligado, então estes testes olham só para os próprios Eventos.

/** Uma aula avulsa de EBD com título único, em 24/10/2026; devolve o id, o campo do link e o nome esperado da pasta. */
async function aula(rotulo: string) {
  const titulo = `${rotulo} ${crypto.randomUUID().slice(0, 8)}`;
  const { id, cat, link } = await eventoNovo("EBD", { titulo, fim: null });
  return { id, titulo, link: link!, cat, pasta: `2026-10-24 · ${titulo}` };
}

describe("processar a fila de pastas", () => {
  beforeEach(async () => {
    await admin.from("tarefas_de_pasta").delete().neq("id", "00000000-0000-0000-0000-000000000000").throwOnError();
    await ligar();
  });

  it("cria Categoria/Ano/pasta do Evento e põe o link no Link do material", async () => {
    const drive = driveFalso();
    const { id, link, pasta } = await aula("Aula 1");

    const contagem = await processarFilaDePastas(admin, drive.cliente);

    expect(contagem.criadas).toBeGreaterThanOrEqual(1);
    expect(drive.caminhoDe(pasta)).toEqual(["EBD", "2026", pasta]);
    const evento = await eventoLido(id);
    const criada = drive.pastas.find((p) => p.nome === pasta)!;
    expect(evento).toMatchObject({ pasta_id: criada.id, pasta_estado: "criada" });
    expect(evento.campos[link]).toBe(`https://drive.google.com/drive/folders/${criada.id}`);
    expect(await tarefaDe(id)).toMatchObject({ estado: "feita", tentativas: 1 });
  });

  it("rodar de novo não cria outra pasta: a tarefa já foi feita", async () => {
    const drive = driveFalso();
    const { id, pasta } = await aula("Aula 2");
    await processarFilaDePastas(admin, drive.cliente);

    await processarFilaDePastas(admin, drive.cliente);

    expect(drive.pastas.filter((p) => p.nome === pasta)).toHaveLength(1);
    expect((await tarefaDe(id)).tentativas).toBe(1);
  });

  it("uma falha do Drive adia a tarefa; na rodada seguinte ela é refeita e dá certo", async () => {
    const drive = driveFalso();
    const { id, pasta } = await aula("Aula 3");
    drive.falharAoMexerEm(pasta, new Error("Drive fora do ar"));

    await processarFilaDePastas(admin, drive.cliente);
    expect(await tarefaDe(id)).toMatchObject({ estado: "pendente", erro: "Drive fora do ar", tentativas: 1 });
    expect((await eventoLido(id)).pasta_estado).toBe("pendente");
    expect(drive.pastas.find((p) => p.nome === pasta)).toBeUndefined();

    // A espera passou (aqui, adiantada à força).
    await admin.from("tarefas_de_pasta").update({ proxima_tentativa: new Date(Date.now() - 1000).toISOString() }).eq("evento_id", id).throwOnError();
    await processarFilaDePastas(admin, drive.cliente);
    expect(await tarefaDe(id)).toMatchObject({ estado: "feita", tentativas: 2, erro: null });
    expect((await eventoLido(id)).pasta_estado).toBe("criada");
    expect(drive.pastas.filter((p) => p.nome === pasta)).toHaveLength(1);
  });

  it("um erro permanente (raiz sem acesso) fecha a tarefa na primeira tentativa e o campo continua preenchível à mão", async () => {
    const drive = driveFalso();
    const { id, link, pasta } = await aula("Aula 4");
    drive.falharAoMexerEm(pasta, new ErroDoDrive("pasta raiz não encontrada ou sem acesso", { permanente: true }));

    await processarFilaDePastas(admin, drive.cliente);

    expect(await tarefaDe(id)).toMatchObject({ estado: "falhou", tentativas: 1 });
    const evento = await eventoLido(id);
    expect(evento.pasta_estado).toBe("falhou");
    expect(evento.campos[link]).toBeUndefined();
  });

  it("esgotadas as tentativas, a falha passageira também fecha a tarefa", async () => {
    const drive = driveFalso();
    const { id, pasta } = await aula("Aula 5");
    drive.falharAoMexerEm(pasta, ...Array.from({ length: 5 }, () => new Error("Drive fora do ar")));

    for (let rodada = 1; rodada <= 5; rodada++) {
      await processarFilaDePastas(admin, drive.cliente);
      await admin.from("tarefas_de_pasta").update({ proxima_tentativa: new Date(Date.now() - 1000).toISOString() }).eq("evento_id", id).eq("estado", "pendente").throwOnError();
    }

    expect(await tarefaDe(id)).toMatchObject({ estado: "falhou", tentativas: 5 });
    expect((await eventoLido(id)).pasta_estado).toBe("falhou");
  });

  it("se o banco não aceita a resposta, a rodada conta e segue: a tarefa continua pendente e a pasta, reaproveitada depois", async () => {
    const drive = driveFalso();
    const { id, pasta } = await aula("Aula 5b");
    const semResposta = {
      rpc: (nome: string, args: Record<string, unknown>) =>
        nome === "concluir_tarefa_de_pasta" ? Promise.resolve({ data: null, error: { message: "banco fora do ar" } }) : admin.rpc(nome, args),
    } as unknown as typeof admin;

    const contagem = await processarFilaDePastas(semResposta, drive.cliente);

    expect(contagem.semResposta).toBeGreaterThanOrEqual(1);
    expect(contagem.criadas).toBe(0);
    expect(await tarefaDe(id)).toMatchObject({ estado: "pendente", tentativas: 1 });

    // A reserva vence (aqui, adiantada à força) e a rodada seguinte acha a pasta que já existe, sem criar outra.
    await admin.from("tarefas_de_pasta").update({ proxima_tentativa: new Date(Date.now() - 1000).toISOString() }).eq("evento_id", id).throwOnError();
    await processarFilaDePastas(admin, drive.cliente);
    expect(await tarefaDe(id)).toMatchObject({ estado: "feita" });
    expect(drive.pastas.filter((p) => p.nome === pasta)).toHaveLength(1);
  });

  it("com o Drive desligado, a fila espera e nada vai ao Drive; ligar de novo retoma", async () => {
    const drive = driveFalso();
    const { id, pasta } = await aula("Aula 6");
    await configurar({ drive_ligado: false });

    const parada = await processarFilaDePastas(admin, drive.cliente);
    expect(parada.reservadas).toBe(0);
    expect(drive.pastas).toHaveLength(0);
    expect(await tarefaDe(id)).toMatchObject({ estado: "pendente", tentativas: 0 });

    await ligar();
    await processarFilaDePastas(admin, drive.cliente);
    expect(drive.pastas.some((p) => p.nome === pasta)).toBe(true);
  });

  it("aulas do mesmo ano e Categoria dividem as pastas de Categoria e de ano", async () => {
    const drive = driveFalso();
    const a = await aula("Aula 7");
    const b = await aula("Aula 8");

    await processarFilaDePastas(admin, drive.cliente);

    expect(drive.pastas.filter((p) => p.nome === "EBD")).toHaveLength(1);
    expect(drive.pastas.filter((p) => p.nome === "2026")).toHaveLength(1);
    expect(drive.caminhoDe(a.pasta)).toEqual(["EBD", "2026", a.pasta]);
    expect(drive.caminhoDe(b.pasta)).toEqual(["EBD", "2026", b.pasta]);
  });
});
