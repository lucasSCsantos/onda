import { describe, expect, it } from "vitest";
import { hashDoToken, novoToken } from "@/lib/calendario/token";
import { admin, anonimo, comFuncoes, contaNova, type Cliente } from "./ambiente";

const novoHash = () => hashDoToken(novoToken());

/** Gera a assinatura de quem está logado, como a ação do app faz. */
async function gerar(cliente: Cliente, pessoa: string, mudancas: Record<string, unknown> = {}) {
  const hash = novoHash();
  const { error } = await cliente.from("assinaturas_de_calendario").insert({ pessoa_id: pessoa, token_hash: hash, ...mudancas });
  return { hash, error };
}

type Aberto = { estado: string; pessoa_id: string | null; escopo: string | null; categorias: string[] | null; aniversarios: boolean | null; espera: number | null };

/** O feed aberto pela chave de serviço, como a rota faz. */
async function abrir(hash: string, limite?: number): Promise<Aberto> {
  const { data, error } = await admin.rpc("abrir_feed", limite === undefined ? { hash } : { hash, limite });
  if (error) throw error;
  return (data as Aberto[])[0];
}

const logsDe = async (pessoa: string) =>
  (await admin.from("logs").select("*").eq("objeto_tipo", "assinatura").eq("objeto_id", pessoa).order("id").throwOnError()).data ?? [];

const lider = (nome = "Líder") => comFuncoes(nome, "lider", ["Líder do louvor"]);

describe("assinatura de calendário: quem tem e o que vê", () => {
  it("Admin, Líder e Professor geram a própria; Pendente e desativado não", async () => {
    const quem = [
      { conta: await contaNova("Admin", "admin"), pode: true, mudancas: {} },
      { conta: await lider(), pode: true, mudancas: {} },
      { conta: await comFuncoes("Paulo", "professor", []), pode: true, mudancas: { escopo: "meus" } },
      { conta: await contaNova("Novato"), pode: false, mudancas: {} },
      { conta: await comFuncoes("Saiu", "lider", ["Líder do louvor"], false), pode: false, mudancas: {} },
    ];
    for (const { conta, pode, mudancas } of quem) {
      const { error } = await gerar(conta.cliente, conta.id, mudancas);
      expect(error === null, conta.email).toBe(pode);
    }
  });

  it("ninguém gera a assinatura de outra pessoa", async () => {
    const [a, b] = [await lider("A"), await lider("B")];
    expect((await gerar(a.cliente, b.id)).error).not.toBeNull();
  });

  it("só o dono lê a própria assinatura, e o hash não volta nem para ele", async () => {
    const [a, b] = [await lider("A"), await lider("B")];
    await gerar(a.cliente, a.id);

    const minha = await a.cliente.from("assinaturas_de_calendario").select("pessoa_id, escopo, criado_em, usado_em");
    expect(minha.data).toHaveLength(1);
    expect((await b.cliente.from("assinaturas_de_calendario").select("pessoa_id")).data).toEqual([]);
    expect((await a.cliente.from("assinaturas_de_calendario").select("token_hash")).error).not.toBeNull();
    expect((await a.cliente.from("assinaturas_de_calendario").select("*")).error).not.toBeNull();
  });

  it("ninguém, nem o Admin, lê, edita ou revoga a de outra pessoa", async () => {
    const dona = await lider("Dona");
    const outro = await contaNova("Outro Admin", "admin");
    await gerar(dona.cliente, dona.id);
    expect((await outro.cliente.from("assinaturas_de_calendario").select("pessoa_id")).data).toEqual([]);
    const edicao = await outro.cliente.from("assinaturas_de_calendario").update({ escopo: "meus" }).eq("pessoa_id", dona.id).select("pessoa_id");
    expect(edicao.data ?? []).toHaveLength(0);
    const exclusao = await outro.cliente.from("assinaturas_de_calendario").delete().eq("pessoa_id", dona.id).select("pessoa_id");
    expect(exclusao.data ?? []).toHaveLength(0);
    expect((await admin.from("assinaturas_de_calendario").select("pessoa_id").eq("pessoa_id", dona.id)).data).toHaveLength(1);
  });

  it("quem não entrou não lê nada", async () => {
    expect((await anonimo().from("assinaturas_de_calendario").select("pessoa_id")).error).not.toBeNull();
  });

  it("é uma por pessoa", async () => {
    const eu = await lider("Eu");
    await gerar(eu.cliente, eu.id);
    expect((await gerar(eu.cliente, eu.id)).error).not.toBeNull();
  });
});

describe("assinatura de calendário: o que cada nível escolhe", () => {
  it("o Professor recebe só as próprias aulas, sem aniversários", async () => {
    const paulo = await comFuncoes("Paulo", "professor", []);
    expect((await gerar(paulo.cliente, paulo.id, { escopo: "todos" })).error).not.toBeNull();
    expect((await gerar(paulo.cliente, paulo.id, { escopo: "meus", aniversarios: true })).error).not.toBeNull();
    expect((await gerar(paulo.cliente, paulo.id, { escopo: "meus" })).error).toBeNull();
  });

  it("a Liderança pode ligar aniversários, e as Categorias e o escopo ficam gravados", async () => {
    const eu = await lider();
    const categoria = (await admin.from("categorias").select("id").eq("nome", "Culto").single().throwOnError()).data!.id;
    const { error } = await gerar(eu.cliente, eu.id, { escopo: "meus", categorias: [categoria], aniversarios: true });
    expect(error).toBeNull();
    const { data } = await eu.cliente.from("assinaturas_de_calendario").select("escopo, categorias, aniversarios").single();
    expect(data).toEqual({ escopo: "meus", categorias: [categoria], aniversarios: true });
  });

  it("o hash precisa ser um SHA-256 em hexadecimal: um token em texto puro é recusado", async () => {
    const eu = await lider();
    const { error } = await eu.cliente.from("assinaturas_de_calendario").insert({ pessoa_id: eu.id, token_hash: novoToken() });
    expect(error).not.toBeNull();
  });
});

describe("assinatura de calendário: regerar e revogar", () => {
  it("regerar invalida o endereço anterior, e o novo passa a valer", async () => {
    const eu = await lider();
    const { hash: antigo } = await gerar(eu.cliente, eu.id);
    expect((await abrir(antigo)).estado).toBe("ok");

    const novo = novoHash();
    const { error } = await eu.cliente.from("assinaturas_de_calendario").update({ token_hash: novo }).eq("pessoa_id", eu.id);
    expect(error).toBeNull();
    expect((await abrir(antigo)).estado).toBe("invalido");
    expect(await abrir(novo)).toMatchObject({ estado: "ok", pessoa_id: eu.id });
  });

  it("regerar zera o uso e a contagem de consultas", async () => {
    const eu = await lider();
    const { hash } = await gerar(eu.cliente, eu.id);
    await abrir(hash, 2);
    await abrir(hash, 2);
    expect((await abrir(hash, 2)).estado).toBe("limite");

    const novo = novoHash();
    await eu.cliente.from("assinaturas_de_calendario").update({ token_hash: novo }).eq("pessoa_id", eu.id).throwOnError();
    const { data } = await eu.cliente.from("assinaturas_de_calendario").select("usado_em").single();
    expect(data?.usado_em).toBeNull();
    expect((await abrir(novo, 2)).estado).toBe("ok");
  });

  it("mudar só os filtros não troca o endereço", async () => {
    const eu = await lider();
    const { hash } = await gerar(eu.cliente, eu.id);
    await abrir(hash);
    await eu.cliente.from("assinaturas_de_calendario").update({ escopo: "meus" }).eq("pessoa_id", eu.id).throwOnError();
    expect(await abrir(hash)).toMatchObject({ estado: "ok", escopo: "meus" });
  });

  it("revogar apaga a assinatura, e o endereço deixa de valer", async () => {
    const eu = await lider();
    const { hash } = await gerar(eu.cliente, eu.id);
    await eu.cliente.from("assinaturas_de_calendario").delete().eq("pessoa_id", eu.id).throwOnError();
    expect((await abrir(hash)).estado).toBe("invalido");
    expect((await admin.from("assinaturas_de_calendario").select("pessoa_id").eq("pessoa_id", eu.id)).data).toEqual([]);
  });

  it("quem é desativado deixa de abrir o feed, e reativado volta a abrir", async () => {
    const eu = await lider();
    const { hash } = await gerar(eu.cliente, eu.id);
    await admin.from("perfis").update({ ativo: false }).eq("id", eu.id).throwOnError();
    expect((await abrir(hash)).estado).toBe("invalido");
    await admin.from("perfis").update({ ativo: true }).eq("id", eu.id).throwOnError();
    expect((await abrir(hash)).estado).toBe("ok");
  });
});

describe("assinatura de calendário: abrir o feed", () => {
  it("só a chave de serviço chama a função: nem quem entrou, nem quem não entrou", async () => {
    const eu = await lider();
    const { hash } = await gerar(eu.cliente, eu.id);
    expect((await eu.cliente.rpc("abrir_feed", { hash })).error).not.toBeNull();
    expect((await anonimo().rpc("abrir_feed", { hash })).error).not.toBeNull();
  });

  it("um hash desconhecido é inválido, sem dizer nada sobre ninguém", async () => {
    expect(await abrir(novoHash())).toEqual({ estado: "invalido", pessoa_id: null, escopo: null, categorias: null, aniversarios: null, espera: null });
  });

  it("devolve a pessoa e as opções, e marca o uso", async () => {
    const eu = await lider();
    const { hash } = await gerar(eu.cliente, eu.id, { escopo: "meus", aniversarios: true });
    expect(await abrir(hash)).toMatchObject({ estado: "ok", pessoa_id: eu.id, escopo: "meus", categorias: [], aniversarios: true });
    const { data } = await eu.cliente.from("assinaturas_de_calendario").select("usado_em").single();
    expect(data?.usado_em).not.toBeNull();
  });

  it("acima do limite por hora, recusa com o tempo de espera, e consulta recusada não conta", async () => {
    const eu = await lider();
    const { hash } = await gerar(eu.cliente, eu.id);
    for (let i = 0; i < 3; i++) expect((await abrir(hash, 3)).estado).toBe("ok");
    const recusada = await abrir(hash, 3);
    expect(recusada.estado).toBe("limite");
    expect(recusada.espera).toBeGreaterThan(0);
    expect(recusada.espera).toBeLessThanOrEqual(3600);
    expect((await abrir(hash, 3)).estado).toBe("limite");
    const { data } = await admin.from("assinaturas_de_calendario").select("consultas_na_janela").eq("pessoa_id", eu.id).single();
    expect(data?.consultas_na_janela).toBe(3);
  });

  it("o limite padrão é de 60 consultas por hora", async () => {
    const eu = await lider();
    const { hash } = await gerar(eu.cliente, eu.id);
    await admin.from("assinaturas_de_calendario").update({ janela_inicio: new Date().toISOString(), consultas_na_janela: 59 }).eq("pessoa_id", eu.id).throwOnError();
    expect((await abrir(hash)).estado).toBe("ok");
    expect((await abrir(hash)).estado).toBe("limite");
  });

  it("passada uma hora, a janela recomeça", async () => {
    const eu = await lider();
    const { hash } = await gerar(eu.cliente, eu.id);
    await abrir(hash, 1);
    expect((await abrir(hash, 1)).estado).toBe("limite");
    const haDuasHoras = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    await admin.from("assinaturas_de_calendario").update({ janela_inicio: haDuasHoras }).eq("pessoa_id", eu.id).throwOnError();
    expect((await abrir(hash, 1)).estado).toBe("ok");
  });

  it("o limite é de cada token, não de todos juntos", async () => {
    const [a, b] = [await lider("A"), await lider("B")];
    const [{ hash: ha }, { hash: hb }] = [await gerar(a.cliente, a.id), await gerar(b.cliente, b.id)];
    await abrir(ha, 1);
    expect((await abrir(ha, 1)).estado).toBe("limite");
    expect((await abrir(hb, 1)).estado).toBe("ok");
  });
});

describe("assinatura de calendário: logs", () => {
  it("gerar, regerar e revogar viram Log, sem token, hash nem endereço", async () => {
    const mariana = await lider("Mariana");
    const { hash } = await gerar(mariana.cliente, mariana.id);
    const novo = novoHash();
    await mariana.cliente.from("assinaturas_de_calendario").update({ token_hash: novo }).eq("pessoa_id", mariana.id).throwOnError();
    await mariana.cliente.from("assinaturas_de_calendario").update({ escopo: "meus" }).eq("pessoa_id", mariana.id).throwOnError();
    await abrir(novo);
    await mariana.cliente.from("assinaturas_de_calendario").delete().eq("pessoa_id", mariana.id).throwOnError();

    const logs = await logsDe(mariana.id);
    expect(logs.map((l) => l.acao)).toEqual(["calendario.gerado", "calendario.regerado", "calendario.revogado"]);
    expect(logs[0]).toMatchObject({ usuario_id: mariana.id, usuario_nome: "Mariana", objeto_rotulo: "Mariana", modulo: "administracao", origem: "interface" });
    const tudo = JSON.stringify(logs);
    for (const segredo of [hash, novo]) expect(tudo).not.toContain(segredo);
  });
});
