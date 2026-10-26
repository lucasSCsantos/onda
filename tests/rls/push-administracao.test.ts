import { describe, expect, it } from "vitest";
import { admin, comFuncoes, contaNova } from "./ambiente";

const chaves = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };

/** As configurações como o banco as tem, e a volta ao que era (a linha é única e compartilhada entre os testes). */
async function configuracaoAtual() {
  const { data } = await admin.from("configuracoes").select("*").single().throwOnError();
  return data;
}

describe("administração das Notificações: configurações", () => {
  it("só o Admin altera o canal e os horários, e cada mudança vira Log", async () => {
    const antes = await configuracaoAtual();
    const adm = await contaNova("Admin das Notificações", "admin");
    const lider = await comFuncoes("Líder sem acesso", "lider", ["Líder do louvor"]);
    try {
      const novos = { notificacoes_ligadas: false, lembrete_longo_horas: 30, lembrete_curto_horas: 3, hora_do_resumo_semanal: 8 };

      const negado = await lider.cliente.from("configuracoes").update(novos).eq("id", true).select("id");
      expect(negado.data ?? []).toHaveLength(0);

      const feito = await adm.cliente.from("configuracoes").update(novos).eq("id", true).select("id").throwOnError();
      expect(feito.data).toHaveLength(1);
      expect(await configuracaoAtual()).toMatchObject(novos);

      const { data: logs } = await admin.from("logs").select("detalhes").eq("usuario_id", adm.id).eq("acao", "configuracao.alterada").throwOnError();
      const chavesLogadas = (logs ?? []).map((l) => (l.detalhes as { chave: string }).chave).sort();
      expect(chavesLogadas).toEqual(["hora_do_resumo_semanal", "lembrete_curto_horas", "lembrete_longo_horas", "notificacoes_ligadas"]);
    } finally {
      await admin
        .from("configuracoes")
        .update({
          notificacoes_ligadas: antes.notificacoes_ligadas,
          lembrete_longo_horas: antes.lembrete_longo_horas,
          lembrete_curto_horas: antes.lembrete_curto_horas,
          hora_do_resumo_semanal: antes.hora_do_resumo_semanal,
        })
        .eq("id", true)
        .throwOnError();
    }
  });

  it("o banco recusa um segundo lembrete que não sai depois do primeiro", async () => {
    const adm = await contaNova("Admin dos lembretes", "admin");
    const { error } = await adm.cliente.from("configuracoes").update({ lembrete_longo_horas: 5, lembrete_curto_horas: 5 }).eq("id", true);
    expect(error).not.toBeNull();
  });
});

describe("administração das Notificações: fila e dispositivos", () => {
  it("só o Admin lê o resumo, a fila e a contagem de pessoas com dispositivo", async () => {
    const lider = await comFuncoes("Líder da fila", "lider", ["Líder do louvor"]);
    expect((await lider.cliente.rpc("resumo_da_fila_de_notificacoes")).error).not.toBeNull();
    expect((await lider.cliente.rpc("fila_de_notificacoes", { situacao: "pendente" })).error).not.toBeNull();
    expect((await lider.cliente.rpc("pessoas_com_dispositivo")).error).not.toBeNull();

    const adm = await contaNova("Admin da fila", "admin");
    expect((await adm.cliente.rpc("resumo_da_fila_de_notificacoes")).error).toBeNull();
    expect((await adm.cliente.rpc("fila_de_notificacoes", { situacao: "falha" })).error).toBeNull();
    expect((await adm.cliente.rpc("fila_de_notificacoes", { situacao: "dispensada" })).error).not.toBeNull();
  });

  it("a fila traz o tipo, a pessoa e os tempos, e nunca o texto, o endpoint nem as chaves", async () => {
    const pessoa = await comFuncoes("Pessoa da fila", "lider", ["Líder do louvor"]);
    const adm = await contaNova("Admin lendo a fila", "admin");
    const criado = await admin
      .from("notificacoes")
      .insert({ pessoa_id: pessoa.id, tipo: "lembrete_2h", janela: crypto.randomUUID(), titulo: "Texto que o Admin não vê", texto: "nem este", estado: "falha", tentativas: 5 })
      .select("id")
      .single()
      .throwOnError();

    const { data } = await adm.cliente.rpc("fila_de_notificacoes", { situacao: "falha", limite: 100 }).throwOnError();
    const linha = (data as Record<string, unknown>[]).find((l) => l.id === criado.data.id);
    expect(linha).toMatchObject({ tipo: "lembrete_2h", estado: "falha", pessoa: "Pessoa da fila", tentativas: 5 });
    expect(Object.keys(linha!).sort()).toEqual(["criada_em", "enviada_em", "estado", "id", "pessoa", "proxima_tentativa", "tentativas", "tipo", "urgente"]);
    expect(JSON.stringify(data)).not.toContain("Texto que o Admin não vê");

    const { data: totais } = await adm.cliente.rpc("resumo_da_fila_de_notificacoes").throwOnError();
    expect((totais as { estado: string; total: number }[]).find((t) => t.estado === "falha")!.total).toBeGreaterThanOrEqual(1);
  });

  it("conta cada pessoa com conta ativa uma vez, qualquer que seja o número de dispositivos", async () => {
    const adm = await contaNova("Admin dos dispositivos", "admin");
    const { data: antes } = await adm.cliente.rpc("pessoas_com_dispositivo").throwOnError();

    const pessoa = await comFuncoes("Pessoa com dois aparelhos", "lider", ["Líder do louvor"]);
    for (const apelido of ["Celular", "Tablet"]) {
      await pessoa.cliente
        .rpc("registrar_inscricao_de_push", { endereco: `https://push.exemplo.test/${crypto.randomUUID()}`, chave_p256dh: chaves.p256dh, chave_auth: chaves.auth, apelido })
        .throwOnError();
    }
    const { data: depois } = await adm.cliente.rpc("pessoas_com_dispositivo").throwOnError();
    expect((depois as number) - (antes as number)).toBe(1);

    await admin.from("perfis").update({ ativo: false }).eq("id", pessoa.id).throwOnError();
    const { data: semAtiva } = await adm.cliente.rpc("pessoas_com_dispositivo").throwOnError();
    expect(semAtiva).toBe(antes);
  });
});
