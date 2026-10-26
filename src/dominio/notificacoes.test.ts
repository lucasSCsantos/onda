import { describe, expect, it } from "vitest";
import {
  chaveDaNotificacao,
  conteudoDaNotificacao,
  dataEHora,
  dentroDaJanela,
  depoisDaFalha,
  desfechoDoEnvio,
  JANELA_PADRAO,
  LIMITE_DE_TENTATIVAS,
  lerConfiguracaoDasNotificacoes,
  lerJanela,
  lerPreferencias,
  planejarEnvio,
  TIPOS_DE_NOTIFICACAO,
  proximaAbertura,
  type EventoDaNotificacao,
} from "./notificacoes";

// Salvador é UTC-3 o ano todo: 19h em Salvador são 22h UTC.
const salvador = (iso: string) => new Date(`${iso}-03:00`);

const evento = (parte: Partial<EventoDaNotificacao> = {}): EventoDaNotificacao => ({
  id: "ev-1",
  titulo: "Aula de EBD",
  numero: 3,
  inicio: salvador("2026-10-24T19:00:00"),
  diaInteiro: false,
  local: "Sala 2",
  categoria: "EBD",
  ...parte,
});

describe("janela de horário", () => {
  it("abre às 8h em ponto e fecha às 21h em ponto", () => {
    expect(dentroDaJanela(salvador("2026-10-24T07:59:00"), JANELA_PADRAO)).toBe(false);
    expect(dentroDaJanela(salvador("2026-10-24T08:00:00"), JANELA_PADRAO)).toBe(true);
    expect(dentroDaJanela(salvador("2026-10-24T20:59:00"), JANELA_PADRAO)).toBe(true);
    expect(dentroDaJanela(salvador("2026-10-24T21:00:00"), JANELA_PADRAO)).toBe(false);
  });

  it("conta a hora no fuso do Mural, não em UTC", () => {
    // 23h UTC é 20h em Salvador: dentro da janela, embora seja "noite" em UTC.
    expect(dentroDaJanela(new Date("2026-10-24T23:00:00Z"), JANELA_PADRAO)).toBe(true);
    // 10h UTC é 7h em Salvador: ainda fechada.
    expect(dentroDaJanela(new Date("2026-10-24T10:00:00Z"), JANELA_PADRAO)).toBe(false);
  });

  it("a próxima abertura é agora, hoje cedo ou amanhã", () => {
    const aberta = salvador("2026-10-24T12:00:00");
    expect(proximaAbertura(aberta, JANELA_PADRAO)).toEqual(aberta);
    expect(proximaAbertura(salvador("2026-10-24T06:30:00"), JANELA_PADRAO)).toEqual(salvador("2026-10-24T08:00:00"));
    expect(proximaAbertura(salvador("2026-10-24T22:00:00"), JANELA_PADRAO)).toEqual(salvador("2026-10-25T08:00:00"));
  });

  it("respeita a janela que a pessoa escolheu", () => {
    const tarde = { inicio: 14, fim: 18 };
    expect(dentroDaJanela(salvador("2026-10-24T10:00:00"), tarde)).toBe(false);
    expect(proximaAbertura(salvador("2026-10-24T10:00:00"), tarde)).toEqual(salvador("2026-10-24T14:00:00"));
  });

  it("só aceita uma janela que abre antes de fechar, entre 0h e 24h", () => {
    expect(lerJanela("8", "21")).toEqual({ inicio: 8, fim: 21 });
    expect(lerJanela("0", "24")).toEqual({ inicio: 0, fim: 24 });
    expect(lerJanela("21", "8")).toHaveProperty("erro");
    expect(lerJanela("8", "8")).toHaveProperty("erro");
    expect(lerJanela("-1", "8")).toHaveProperty("erro");
    expect(lerJanela("8", "25")).toHaveProperty("erro");
    expect(lerJanela("", "21")).toHaveProperty("erro");
    expect(lerJanela("8.5", "21")).toHaveProperty("erro");
  });
});

describe("texto das Notificações", () => {
  it("o aviso de Responsável traz o título com o número, o dia, a hora e o local", () => {
    expect(conteudoDaNotificacao("designacao_responsavel", evento())).toEqual({
      titulo: "Você foi definido(a) como Responsável",
      texto: "Aula de EBD · 3 · sáb., 24/10 às 19h · Sala 2",
      tag: "designacao_responsavel:ev-1",
      url: "/eventos/ev-1",
    });
  });

  it("o aviso de aula leva ao Evento, com minutos quando há", () => {
    const c = conteudoDaNotificacao("designacao_aula", evento({ inicio: salvador("2026-10-24T09:30:00"), numero: null }));
    expect(c.titulo).toBe("Você foi escalado(a) em uma aula");
    expect(c.texto).toBe("Aula de EBD · sáb., 24/10 às 9h30 · Sala 2");
  });

  it("o Pequeno grupo omite o local", () => {
    const c = conteudoDaNotificacao("designacao_responsavel", evento({ titulo: "Pequeno grupo", numero: null, categoria: "Pequeno grupo", local: "Casa da Ana, Rua X 12" }));
    expect(c.texto).toBe("Pequeno grupo · sáb., 24/10 às 19h");
    expect(JSON.stringify(c)).not.toContain("Casa da Ana");
  });

  it("sem local, não sobra separador", () => {
    expect(conteudoDaNotificacao("designacao_responsavel", evento({ local: "  " })).texto).toBe("Aula de EBD · 3 · sáb., 24/10 às 19h");
  });

  it("Evento de dia inteiro diz que é o dia inteiro", () => {
    expect(dataEHora(salvador("2026-10-24T00:00:00"), true)).toBe("sáb., 24/10, dia inteiro");
  });

  it("usa só os campos permitidos do Evento: observações e dados de Adolescentes nunca entram", () => {
    // O que passa do tipo (observações, nomes) é ignorado: o modelo só lê título, número, data, hora, local e categoria.
    const suspeito = { ...evento(), observacoes: "Trazer o João Silva (nasc. 2011-03-04)", campos: { Anfitriao: "Maria" } } as EventoDaNotificacao;
    const c = JSON.stringify(conteudoDaNotificacao("designacao_aula", suspeito));
    expect(c).not.toContain("João");
    expect(c).not.toContain("2011");
    expect(c).not.toContain("Maria");
  });

  it("o texto é curto e o caminho é do próprio app", () => {
    const c = conteudoDaNotificacao("designacao_responsavel", evento({ titulo: "x".repeat(400), local: "y".repeat(400) }));
    expect(c.texto.length).toBeLessThanOrEqual(160);
    expect(c.url).toBe("/eventos/ev-1");
  });
});

describe("idempotência", () => {
  it("a mesma Notificação tem sempre a mesma chave; outra pessoa, Evento ou janela, outra chave", () => {
    const base = { tipo: "designacao_responsavel", eventoId: "ev-1", pessoaId: "p-1", janela: "2026-10-23" };
    expect(chaveDaNotificacao(base)).toBe(chaveDaNotificacao({ ...base }));
    expect(chaveDaNotificacao({ ...base, pessoaId: "p-2" })).not.toBe(chaveDaNotificacao(base));
    expect(chaveDaNotificacao({ ...base, eventoId: "ev-2" })).not.toBe(chaveDaNotificacao(base));
    expect(chaveDaNotificacao({ ...base, janela: "2026-10-24" })).not.toBe(chaveDaNotificacao(base));
    expect(chaveDaNotificacao({ ...base, tipo: "designacao_aula" })).not.toBe(chaveDaNotificacao(base));
  });
});

describe("plano de envio", () => {
  const agora = salvador("2026-10-24T12:00:00");
  const devida = { urgente: false, tipo: "designacao_responsavel", validaAte: salvador("2026-10-26T12:00:00") };
  const contexto = { agora, janela: JANELA_PADRAO, tiposDesligados: [] as string[], dispositivos: 2 };

  it("envia dentro da janela, com a validade como TTL (no máximo um dia)", () => {
    expect(planejarEnvio(devida, contexto)).toEqual({ acao: "enviar", ttl: 24 * 60 * 60 });
    expect(planejarEnvio({ ...devida, validaAte: salvador("2026-10-24T12:10:00") }, contexto)).toEqual({ acao: "enviar", ttl: 600 });
  });

  it("fora da janela, espera abrir", () => {
    const noite = { ...contexto, agora: salvador("2026-10-24T22:30:00") };
    expect(planejarEnvio(devida, noite)).toEqual({ acao: "esperar", ate: salvador("2026-10-25T08:00:00") });
  });

  it("a urgente não espera a janela", () => {
    const noite = { ...contexto, agora: salvador("2026-10-24T22:30:00") };
    expect(planejarEnvio({ ...devida, urgente: true }, noite)).toMatchObject({ acao: "enviar" });
  });

  it("vencida, expira; e expira também se a janela só abriria depois da validade", () => {
    expect(planejarEnvio({ ...devida, validaAte: agora }, contexto)).toEqual({ acao: "expirar" });
    const noite = { ...contexto, agora: salvador("2026-10-24T22:30:00") };
    expect(planejarEnvio({ ...devida, validaAte: salvador("2026-10-25T06:00:00") }, noite)).toEqual({ acao: "expirar" });
  });

  it("dispensa o tipo que a pessoa desligou e quem não tem dispositivo", () => {
    expect(planejarEnvio(devida, { ...contexto, tiposDesligados: ["designacao_responsavel"] })).toEqual({ acao: "dispensar", motivo: "tipo_desligado" });
    expect(planejarEnvio(devida, { ...contexto, dispositivos: 0 })).toEqual({ acao: "dispensar", motivo: "sem_dispositivo" });
  });
});

describe("retentativas", () => {
  const agora = salvador("2026-10-24T12:00:00");

  it("a espera cresce a cada falha", () => {
    const espera = (n: number) => {
      const r = depoisDaFalha(n, agora);
      return r.definitiva ? null : (r.proximaTentativa.getTime() - agora.getTime()) / 60_000;
    };
    expect([1, 2, 3, 4].map(espera)).toEqual([5, 15, 45, 135]);
  });

  it("no limite, a falha é definitiva", () => {
    expect(depoisDaFalha(LIMITE_DE_TENTATIVAS, agora)).toEqual({ definitiva: true });
  });

  it("uma falha de um dispositivo não repete o envio aos que já receberam", () => {
    const d = desfechoDoEnvio({ tentativas: 0, entregueA: [] }, { enviados: ["a"], expirados: [], falhas: ["b"] }, agora);
    expect(d).toMatchObject({ estado: "pendente", tentativas: 1, entregueA: ["a"], falhasDefinitivas: [] });
    expect(d.proximaTentativa).toEqual(new Date(agora.getTime() + 5 * 60_000));

    // Na rodada seguinte, só "b" é tentado de novo; "a" continua registrado.
    const depois = desfechoDoEnvio({ tentativas: 1, entregueA: ["a"] }, { enviados: ["b"], expirados: [], falhas: [] }, agora);
    expect(depois).toMatchObject({ estado: "enviada", entregueA: ["a", "b"] });
  });

  it("esgotadas as tentativas: falha se nenhum recebeu, enviada se algum recebeu; os que falharam vão para os Logs", () => {
    const nenhum = desfechoDoEnvio({ tentativas: LIMITE_DE_TENTATIVAS - 1, entregueA: [] }, { enviados: [], expirados: [], falhas: ["a", "b"] }, agora);
    expect(nenhum).toMatchObject({ estado: "falha", tentativas: LIMITE_DE_TENTATIVAS, falhasDefinitivas: ["a", "b"] });
    const algum = desfechoDoEnvio({ tentativas: LIMITE_DE_TENTATIVAS - 1, entregueA: ["a"] }, { enviados: [], expirados: [], falhas: ["b"] }, agora);
    expect(algum).toMatchObject({ estado: "enviada", falhasDefinitivas: ["b"] });
  });

  it("inscrição expirada (404 ou 410) não é falha; se era a única, a Notificação só fica na central", () => {
    expect(desfechoDoEnvio({ tentativas: 0, entregueA: [] }, { enviados: ["a"], expirados: ["b"], falhas: [] }, agora).estado).toBe("enviada");
    expect(desfechoDoEnvio({ tentativas: 0, entregueA: [] }, { enviados: [], expirados: ["b"], falhas: [] }, agora).estado).toBe("dispensada");
  });
});

describe("configuração das Notificações", () => {
  const entrada = { canalLigado: "on", retencaoDias: "30", limiteDeUrgenciaHoras: "12", lembreteLongoHoras: "24", lembreteCurtoHoras: "2", horaDoResumo: "19" };
  const pronta = {
    notificacoes_ligadas: true,
    retencao_das_notificacoes_dias: 30,
    limite_de_urgencia_horas: 12,
    lembrete_longo_horas: 24,
    lembrete_curto_horas: 2,
    hora_do_resumo_semanal: 19,
  };

  it("lê o que o Admin envia, com a caixa do canal como \"on\" ou vazia", () => {
    expect(lerConfiguracaoDasNotificacoes(entrada)).toEqual(pronta);
    expect(lerConfiguracaoDasNotificacoes({ ...entrada, canalLigado: "" })).toEqual({ ...pronta, notificacoes_ligadas: false });
  });

  it("retenção da central: de 1 a 365 dias", () => {
    expect(lerConfiguracaoDasNotificacoes({ ...entrada, retencaoDias: "1" })).toMatchObject({ retencao_das_notificacoes_dias: 1 });
    expect(lerConfiguracaoDasNotificacoes({ ...entrada, retencaoDias: "365" })).toMatchObject({ retencao_das_notificacoes_dias: 365 });
    for (const retencaoDias of ["0", "366", "", "1.5", "um mês"]) {
      expect(lerConfiguracaoDasNotificacoes({ ...entrada, retencaoDias }), retencaoDias).toHaveProperty("erro");
    }
  });

  it("limite de urgência: de 1 a 72 horas", () => {
    expect(lerConfiguracaoDasNotificacoes({ ...entrada, limiteDeUrgenciaHoras: "72" })).toMatchObject({ limite_de_urgencia_horas: 72 });
    for (const limiteDeUrgenciaHoras of ["0", "73", "", "2.5"]) {
      expect(lerConfiguracaoDasNotificacoes({ ...entrada, limiteDeUrgenciaHoras }), limiteDeUrgenciaHoras).toHaveProperty("erro");
    }
  });

  it("lembretes: o primeiro de 3 a 72 horas, o segundo de 1 a 12, e o segundo sai depois do primeiro", () => {
    expect(lerConfiguracaoDasNotificacoes({ ...entrada, lembreteLongoHoras: "3", lembreteCurtoHoras: "1" })).toMatchObject({ lembrete_longo_horas: 3, lembrete_curto_horas: 1 });
    for (const lembreteLongoHoras of ["2", "73", "", "x"]) {
      expect(lerConfiguracaoDasNotificacoes({ ...entrada, lembreteLongoHoras }), lembreteLongoHoras).toHaveProperty("erro");
    }
    for (const lembreteCurtoHoras of ["0", "13", "", "x"]) {
      expect(lerConfiguracaoDasNotificacoes({ ...entrada, lembreteCurtoHoras }), lembreteCurtoHoras).toHaveProperty("erro");
    }
    expect(lerConfiguracaoDasNotificacoes({ ...entrada, lembreteLongoHoras: "4", lembreteCurtoHoras: "4" })).toHaveProperty("erro");
    expect(lerConfiguracaoDasNotificacoes({ ...entrada, lembreteLongoHoras: "3", lembreteCurtoHoras: "5" })).toHaveProperty("erro");
  });

  it("hora do resumo semanal: de 0h a 23h", () => {
    expect(lerConfiguracaoDasNotificacoes({ ...entrada, horaDoResumo: "0" })).toMatchObject({ hora_do_resumo_semanal: 0 });
    expect(lerConfiguracaoDasNotificacoes({ ...entrada, horaDoResumo: "23" })).toMatchObject({ hora_do_resumo_semanal: 23 });
    for (const horaDoResumo of ["24", "-1", "", "7h"]) {
      expect(lerConfiguracaoDasNotificacoes({ ...entrada, horaDoResumo }), horaDoResumo).toHaveProperty("erro");
    }
  });
});

describe("preferências", () => {
  it("o que a pessoa não marcou fica desligado", () => {
    expect(lerPreferencias({ tiposLigados: TIPOS_DE_NOTIFICACAO.filter((t) => t !== "designacao_responsavel"), inicio: "9", fim: "20", nivel: "lider" })).toEqual({
      tiposDesligados: ["designacao_responsavel"],
      janela: { inicio: 9, fim: 20 },
    });
    expect(lerPreferencias({ tiposLigados: [...TIPOS_DE_NOTIFICACAO, "inventado"], inicio: "8", fim: "21", nivel: "lider" })).toMatchObject({ tiposDesligados: [] });
    // O Professor só vê os tipos dele: o que não está no formulário não vira "desligado".
    expect(lerPreferencias({ tiposLigados: [], inicio: "8", fim: "21", nivel: "professor" })).toMatchObject({
      tiposDesligados: ["designacao_aula", "evento_alterado", "evento_cancelado", "chamada_pendente"],
    });
  });

  it("recusa a janela inválida", () => {
    expect(lerPreferencias({ tiposLigados: [], inicio: "21", fim: "8", nivel: "lider" })).toHaveProperty("erro");
  });
});
