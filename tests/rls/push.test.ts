import { describe, expect, it } from "vitest";
import { admin, anonimo, comFuncoes, contaNova, type Cliente } from "./ambiente";

const novoEndpoint = () => `https://push.exemplo.test/${crypto.randomUUID()}`;
const chaves = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };

/** Cadastra o dispositivo de quem está logado, como a ação do app faz. */
const cadastrar = (cliente: Cliente, endpoint = novoEndpoint(), nome = "Android · Chrome") =>
  cliente.rpc("registrar_inscricao_de_push", { endereco: endpoint, chave_p256dh: chaves.p256dh, chave_auth: chaves.auth, apelido: nome });

const lider = (nome = "Líder") => comFuncoes(nome, "lider", ["Líder do louvor"]);

const logsDe = async (pessoa: string) =>
  (await admin.from("logs").select("*").eq("objeto_tipo", "dispositivo").eq("usuario_id", pessoa).order("id").throwOnError()).data ?? [];

describe("push: quem ativa", () => {
  it("Admin, Líder e Professor ativam neste aparelho; Pendente, desativado e anônimo não", async () => {
    const quem = [
      { conta: await contaNova("Admin", "admin"), pode: true },
      { conta: await lider(), pode: true },
      { conta: await comFuncoes("Paulo", "professor", []), pode: true },
      { conta: await contaNova("Novato"), pode: false },
      { conta: await comFuncoes("Saiu", "lider", ["Líder do louvor"], false), pode: false },
    ];
    for (const { conta, pode } of quem) {
      const { error } = await cadastrar(conta.cliente);
      expect(error === null, conta.email).toBe(pode);
    }
    expect((await cadastrar(anonimo())).error).not.toBeNull();
  });

  it("a interface não insere nem edita direto: só pela função", async () => {
    const a = await lider("A");
    const direto = await a.cliente.from("inscricoes_de_push").insert({ pessoa_id: a.id, endpoint: novoEndpoint(), ...chaves });
    expect(direto.error).not.toBeNull();
    const { data } = await cadastrar(a.cliente);
    expect(data).toHaveLength(1);
    const edicao = await a.cliente.from("inscricoes_de_push").update({ nome: "Outro" }).eq("pessoa_id", a.id).select();
    expect(edicao.error ?? edicao.data).toBeTruthy();
    expect((await admin.from("inscricoes_de_push").select("nome").eq("pessoa_id", a.id).single()).data?.nome).toBe("Android · Chrome");
  });

  it("registrar duas vezes o mesmo aparelho atualiza em vez de duplicar", async () => {
    const a = await lider("A");
    const endpoint = novoEndpoint();
    await cadastrar(a.cliente, endpoint, "Primeiro nome");
    await cadastrar(a.cliente, endpoint, "Segundo nome");
    const { data } = await admin.from("inscricoes_de_push").select("nome").eq("pessoa_id", a.id);
    expect(data).toEqual([{ nome: "Segundo nome" }]);
  });

  it("aceita só endpoint HTTPS", async () => {
    const a = await lider("A");
    expect((await cadastrar(a.cliente, "http://push.exemplo.test/x")).error).not.toBeNull();
  });

  it("até 10 dispositivos por pessoa", async () => {
    const a = await lider("A");
    for (let i = 0; i < 10; i++) expect((await cadastrar(a.cliente)).error).toBeNull();
    expect((await cadastrar(a.cliente)).error).not.toBeNull();
  });
});

describe("push: vários dispositivos e privacidade", () => {
  it("cada pessoa vê só os próprios dispositivos, e nunca endpoint nem chaves", async () => {
    const [a, b] = [await lider("A"), await lider("B")];
    await cadastrar(a.cliente, novoEndpoint(), "Celular");
    await cadastrar(a.cliente, novoEndpoint(), "Notebook");
    await cadastrar(b.cliente, novoEndpoint(), "Tablet");

    const minha = await a.cliente.from("inscricoes_de_push").select("nome, endpoint_hash, criado_em, usado_em").order("nome");
    expect(minha.data?.map((d) => d.nome)).toEqual(["Celular", "Notebook"]);
    expect(minha.data?.every((d) => /^[0-9a-f]{64}$/.test(d.endpoint_hash))).toBe(true);

    for (const coluna of ["endpoint", "p256dh", "auth", "*"]) {
      expect((await a.cliente.from("inscricoes_de_push").select(coluna)).error, coluna).not.toBeNull();
    }
    // Nem filtrar pelo endpoint, para não adivinhar o de outra pessoa.
    expect((await a.cliente.from("inscricoes_de_push").select("id").eq("endpoint", "https://x.test/")).error).not.toBeNull();
  });

  it("nem o Admin lê os dispositivos de outra pessoa pela interface", async () => {
    const dona = await lider("Dona");
    const adm = await contaNova("Admin", "admin");
    await cadastrar(dona.cliente);
    expect((await adm.cliente.from("inscricoes_de_push").select("id")).data).toEqual([]);
    expect((await anonimo().from("inscricoes_de_push").select("id")).data ?? []).toEqual([]);
  });

  it("só o dono remove um dispositivo; desativar um não derruba os outros", async () => {
    const [a, b] = [await lider("A"), await lider("B")];
    await cadastrar(a.cliente, novoEndpoint(), "Celular");
    await cadastrar(a.cliente, novoEndpoint(), "Notebook");
    const celular = (await a.cliente.from("inscricoes_de_push").select("id, endpoint_hash").eq("nome", "Celular").single()).data!;

    await b.cliente.from("inscricoes_de_push").delete().eq("id", celular.id);
    expect((await admin.from("inscricoes_de_push").select("id").eq("pessoa_id", a.id)).data).toHaveLength(2);

    await a.cliente.from("inscricoes_de_push").delete().eq("endpoint_hash", celular.endpoint_hash);
    expect((await admin.from("inscricoes_de_push").select("nome").eq("pessoa_id", a.id)).data).toEqual([{ nome: "Notebook" }]);

    await a.cliente.from("inscricoes_de_push").delete().eq("pessoa_id", a.id);
    expect((await admin.from("inscricoes_de_push").select("id").eq("pessoa_id", a.id)).data).toEqual([]);
  });

  it("o aparelho que muda de conta passa para a nova dona, sem ficar com as duas", async () => {
    const [a, b] = [await lider("A"), await lider("B")];
    const endpoint = novoEndpoint();
    await cadastrar(a.cliente, endpoint);
    await cadastrar(b.cliente, endpoint);
    const { data } = await admin.from("inscricoes_de_push").select("pessoa_id").eq("endpoint", endpoint);
    expect(data).toEqual([{ pessoa_id: b.id }]);
  });

  it("apagar a conta remove os dispositivos", async () => {
    const a = await lider("A");
    await cadastrar(a.cliente);
    await admin.auth.admin.deleteUser(a.id);
    expect((await admin.from("inscricoes_de_push").select("id").eq("pessoa_id", a.id)).data).toEqual([]);
  });
});

describe("push: Logs", () => {
  it("ativar e desativar viram Log com o nome do dispositivo e sem endpoint nem chaves", async () => {
    const a = await lider("A");
    const endpoint = novoEndpoint();
    await cadastrar(a.cliente, endpoint, "iPhone · Safari");
    await a.cliente.from("inscricoes_de_push").delete().eq("pessoa_id", a.id);

    const logs = await logsDe(a.id);
    expect(logs.map((l) => l.acao)).toEqual(["push.ativado", "push.desativado"]);
    expect(logs.every((l) => l.objeto_rotulo === "iPhone · Safari" && l.modulo === "administracao")).toBe(true);
    const tudo = JSON.stringify(logs);
    expect(tudo).not.toContain(endpoint);
    expect(tudo).not.toContain(chaves.p256dh);
    expect(tudo).not.toContain(chaves.auth);
  });

  it("a remoção da chave de serviço (404 ou 410) vira \"expirado\"", async () => {
    const a = await lider("A");
    const { data } = await cadastrar(a.cliente);
    await admin.from("inscricoes_de_push").delete().eq("id", data[0].id).throwOnError();
    expect((await logsDe(a.id)).map((l) => l.acao)).toEqual(["push.ativado", "push.expirado"]);
  });

  it("a Notificação de teste vira Log só com contagens", async () => {
    const a = await lider("A");
    const { error } = await a.cliente.rpc("registrar_teste_de_push", { enviados: 2, falhas: 1 });
    expect(error).toBeNull();
    const { data } = await admin.from("logs").select("acao, detalhes").eq("usuario_id", a.id).eq("acao", "push.teste_enviado");
    expect(data).toEqual([{ acao: "push.teste_enviado", detalhes: { enviados: 2, falhas: 1 } }]);
    expect((await anonimo().rpc("registrar_teste_de_push", { enviados: 1, falhas: 0 })).error).not.toBeNull();
  });
});

describe("push: o servidor", () => {
  it("a chave de serviço lê endpoint e chaves para enviar e marca o último uso", async () => {
    const a = await lider("A");
    const endpoint = novoEndpoint();
    await cadastrar(a.cliente, endpoint);
    const { data } = await admin.from("inscricoes_de_push").select("id, endpoint, p256dh, auth").eq("pessoa_id", a.id).single();
    expect(data).toMatchObject({ endpoint, ...chaves });
    await admin.from("inscricoes_de_push").update({ usado_em: new Date().toISOString() }).eq("id", data!.id).throwOnError();
    const visto = await a.cliente.from("inscricoes_de_push").select("usado_em").single();
    expect(visto.data?.usado_em).not.toBeNull();
  });
});
