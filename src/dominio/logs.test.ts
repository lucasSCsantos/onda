import { describe, expect, it } from "vitest";
import { gerarCsv } from "./csv";
import {
  ACOES,
  agruparLogsPorDia,
  alertaDoLog,
  contarFiltrosDosLogs,
  descreverMudanca,
  detalhesDoLog,
  formatarValor,
  fraseDoLog,
  intervaloDosLogs,
  lerFiltrosDosLogs,
  linkDoObjeto,
  moduloDaAcao,
  parametrosDosLogs,
  podeVerHistoricoDoEvento,
  rotuloDoDia,
  tabelaDosLogs,
  termoDeBusca,
  textoDaFrase,
  visualDoLog,
  type Log,
} from "./logs";

// quinta-feira, 22/10/2026, 10h em Salvador
const agora = new Date("2026-10-22T10:00:00-03:00");

const log = (mudancas: Partial<Log> = {}): Log => ({
  id: 1,
  feitoEm: agora,
  usuarioId: "u1",
  usuarioNome: "Carol Leal",
  acao: "evento.criado",
  modulo: "eventos",
  objetoTipo: "evento",
  objetoId: "e1",
  objetoRotulo: "A parábola do semeador",
  resultado: "sucesso",
  severidade: "info",
  detalhes: { categoria: "EBD", inicio: "2026-10-25T12:00:00Z", dia_inteiro: false },
  origem: "interface",
  ...mudancas,
});

const frase = (l: Log) => textoDaFrase(fraseDoLog(l));

describe("fraseDoLog", () => {
  it("diz quem criou qual Evento e quando ele acontece", () => {
    expect(fraseDoLog(log())).toEqual(["Carol Leal", " ", "criou o evento ", { destaque: "EBD · A parábola do semeador" }, " (25/10, 9h)"]);
  });

  it("o Evento de dia inteiro mostra só o dia, e o de outro ano mostra o ano", () => {
    expect(frase(log({ detalhes: { categoria: "Acampamento", inicio: "2027-01-10T03:00:00Z", dia_inteiro: true } }))).toBe(
      "Carol Leal criou o evento Acampamento · A parábola do semeador (10/01/2027)",
    );
  });

  it("a aprovação diz o nível e a Função", () => {
    const aprovacao = log({
      usuarioNome: "Lucas",
      acao: "conta.aprovada",
      modulo: "contas",
      objetoTipo: "conta",
      objetoRotulo: "Beythel",
      detalhes: { nivel: "lider", funcoes: ["Líder do louvor"] },
    });
    expect(frase(aprovacao)).toBe("Lucas aprovou a conta de Beythel como Líder (Líder do louvor)");
  });

  it("o que o próprio Mural faz é do Sistema; a tentativa de quem não entrou é de Alguém", () => {
    const realizado = log({
      usuarioId: null,
      usuarioNome: null,
      origem: "sistema",
      acao: "evento.status_alterado",
      detalhes: { categoria: "Culto", inicio: "2026-10-18T22:00:00Z", mudancas: [{ rotulo: "Status", tipo: "status", antes: "confirmado", depois: "realizado" }] },
    });
    expect(frase(realizado)).toBe("Sistema mudou o Status do evento Culto · A parábola do semeador (18/10, 19h) para Realizado");

    const tentativa = log({
      usuarioId: null,
      usuarioNome: null,
      acao: "acesso.login_falhou",
      objetoTipo: "conta",
      objetoRotulo: "Carol",
      resultado: "falha",
      severidade: "aviso",
      detalhes: { tentativas: 1, conta_existe: true },
    });
    expect(frase(tentativa)).toBe("Alguém tentou entrar na conta de Carol e não conseguiu");
  });

  it("uma falha diz o que a pessoa tentou fazer", () => {
    const falha = log({ acao: "evento.editado", resultado: "falha", severidade: "erro", detalhes: { codigo: "XX000" } });
    expect(frase(falha)).toBe("Carol Leal tentou editar o evento A parábola do semeador, mas não conseguiu");
  });

  it("a edição de série diz o escopo e quantas Ocorrências", () => {
    const serie = (escopo: string, ocorrencias: number) =>
      frase(log({ acao: "serie.editada", objetoTipo: "serie", detalhes: { categoria: "EBD", escopo, ocorrencias } }));
    expect(serie("toda", 12)).toBe("Carol Leal editou toda a série EBD · A parábola do semeador (12 Ocorrências)");
    expect(serie("esta_e_seguintes", 1)).toBe("Carol Leal editou uma Ocorrência e as seguintes da série EBD · A parábola do semeador (1 Ocorrência)");
    expect(serie("esta", 1)).toBe("Carol Leal editou só uma Ocorrência da série EBD · A parábola do semeador");
  });

  it("a configuração aparece pelo nome, com os valores", () => {
    const retencao = log({ acao: "logs.retencao_alterada", modulo: "administracao", detalhes: { antes: 12, depois: 6 } });
    expect(frase(retencao)).toBe("Carol Leal mudou por quanto tempo os logs são guardados, de 12 meses para 6 meses");
    const opcao = log({ acao: "configuracao.alterada", detalhes: { chave: "lideres_veem_historico_do_evento", antes: false, depois: true } });
    expect(frase(opcao)).toBe("Carol Leal mudou a configuração Líderes veem o histórico dos Eventos de não para sim");
  });

  it("toda ação conhecida tem frase e tentativa, e uma desconhecida não quebra a tela", () => {
    for (const acao of Object.keys(ACOES)) {
      expect(frase(log({ acao, detalhes: {} })).length, acao).toBeGreaterThan(10);
      expect(frase(log({ acao, detalhes: {}, resultado: "falha" })).length, acao).toBeGreaterThan(10);
    }
    expect(frase(log({ acao: "algo.novo" }))).toContain("algo.novo");
  });
});

describe("detalhesDoLog", () => {
  it("mostra o que mudou em linguagem natural", () => {
    const edicao = log({
      acao: "evento.editado",
      detalhes: {
        dia_inteiro: false,
        mudancas: [
          { rotulo: "Início", tipo: "instante", antes: "2026-10-25T12:00:00Z", depois: "2026-10-25T13:00:00Z" },
          { rotulo: "Responsável", tipo: "pessoa", antes: "Mariana", depois: "Denize" },
          { rotulo: "Status", tipo: "status", antes: "planejado", depois: "confirmado" },
          { rotulo: "Valor", tipo: "valor", antes: null, depois: 123456 },
          { rotulo: "O que levar", tipo: "lista", antes: ["Bíblia"], depois: ["Bíblia", "Caderno"] },
        ],
      },
    });
    expect(detalhesDoLog(edicao)).toEqual([
      "Horário: 9h → 10h",
      "Responsável: Mariana → Denize",
      "Status: Planejado → Confirmado",
      "Valor: (vazio) → R$ 1.234,56",
      "O que levar: Bíblia → Bíblia, Caderno",
    ]);
  });

  it("a data de nascimento aparece só como alterada, sem os valores", () => {
    const edicao = log({
      acao: "adolescente.editado",
      detalhes: { mudancas: [{ rotulo: "Nome", tipo: "texto", antes: "Bia", depois: "Beatriz" }, { rotulo: "Data de nascimento", tipo: "oculto" }] },
    });
    expect(detalhesDoLog(edicao)).toEqual(["Nome: Bia → Beatriz", "Data de nascimento: alterada"]);
  });

  it("um início que muda de dia mostra a data", () => {
    expect(
      descreverMudanca({ rotulo: "Início", tipo: "instante", antes: "2026-10-25T12:00:00Z", depois: "2026-11-01T12:30:00Z" }, { ano: 2026 }),
    ).toBe("Início: 25/10, 9h → 01/11, 9h30");
  });

  it("formata os tipos dos campos específicos", () => {
    expect(formatarValor("booleano", true)).toBe("sim");
    expect(formatarValor("data", "2026-12-25")).toBe("25/12/2026");
    expect(formatarValor("data_hora", "2026-12-25T19:30")).toBe("25/12/2026 19:30");
    expect(formatarValor("checklist", [{ texto: "a", feito: true }, { texto: "b", feito: false }])).toBe("2 tarefas, 1 feita");
    expect(formatarValor("texto", "x".repeat(200))).toHaveLength(80);
    expect(formatarValor("texto", "")).toBe("(vazio)");
  });
});

describe("alertaDoLog", () => {
  const falhaDeLogin = (tentativas: number, conta_existe = true) =>
    log({ acao: "acesso.login_falhou", usuarioId: null, usuarioNome: null, resultado: "falha", severidade: "aviso", objetoRotulo: "Carol", detalhes: { tentativas, conta_existe } });

  it("várias tentativas de login falhas na mesma conta pedem para confirmar com a pessoa", () => {
    expect(alertaDoLog(falhaDeLogin(4))!.titulo).toBe("Várias tentativas de login falharam para esta conta (4 na última hora).");
    expect(alertaDoLog(falhaDeLogin(4))!.oQueFazer).toMatch(/Confirme se é a própria pessoa/);
    expect(alertaDoLog(falhaDeLogin(1))!.titulo).toBe("Uma tentativa de entrar com senha errada.");
    expect(alertaDoLog(falhaDeLogin(1, false))!.titulo).toMatch(/e-mail que não tem conta/);
  });

  it("falta de permissão e erro do sistema têm mensagens diferentes", () => {
    const semPermissao = log({ acao: "evento.excluido", resultado: "falha", severidade: "aviso", detalhes: { codigo: "42501" } });
    expect(alertaDoLog(semPermissao)!.titulo).toBe("Carol Leal tentou excluir o evento “A parábola do semeador”, mas não tem permissão para isso.");
    const erro = log({ acao: "evento.excluido", resultado: "falha", severidade: "erro", detalhes: { codigo: "XX000", mensagem: "timeout" } });
    expect(alertaDoLog(erro)!.titulo).toBe("O Mural não conseguiu excluir o evento “A parábola do semeador” para Carol Leal.");
  });

  it("um log comum não é alerta", () => {
    expect(alertaDoLog(log())).toBeNull();
  });

  it("a cor segue o resultado e a severidade antes da ação", () => {
    expect(visualDoLog(log())).toBe("criacao");
    expect(visualDoLog(log({ resultado: "falha", severidade: "erro" }))).toBe("erro");
    expect(visualDoLog(falhaDeLogin(1))).toBe("alerta");
    expect(visualDoLog(log({ acao: "evento.excluido" }))).toBe("exclusao");
  });
});

describe("linha do tempo", () => {
  it("agrupa por dia no fuso do Mural, com Hoje, Ontem e a data por extenso", () => {
    const logs = [
      log({ id: 4, feitoEm: new Date("2026-10-22T09:00:00-03:00") }),
      // 23h30 em Salvador do dia 21, já dia 22 em UTC
      log({ id: 3, feitoEm: new Date("2026-10-21T23:30:00-03:00") }),
      log({ id: 2, feitoEm: new Date("2026-10-20T08:00:00-03:00") }),
      log({ id: 1, feitoEm: new Date("2025-12-31T08:00:00-03:00") }),
    ];
    expect(agruparLogsPorDia(logs, agora).map((d) => [d.rotulo, d.logs.map((l) => l.id)])).toEqual([
      ["Hoje", [4]],
      ["Ontem", [3]],
      ["20 de outubro", [2]],
      ["31 de dezembro de 2025", [1]],
    ]);
    expect(rotuloDoDia("2026-10-22", agora)).toBe("Hoje");
  });

  it("leva ao objeto quando há para onde levar", () => {
    expect(linkDoObjeto(log())).toBe("/eventos/e1");
    expect(linkDoObjeto(log({ objetoTipo: "adolescente", objetoRotulo: "Ana Lu" }))).toBe("/adolescentes?q=Ana%20Lu&inativos=1");
    expect(linkDoObjeto(log({ objetoTipo: "serie" }))).toBeNull();
    expect(linkDoObjeto(log({ objetoId: null }))).toBeNull();
  });
});

describe("filtros", () => {
  it("sem parâmetros, mostra a atividade dos últimos 30 dias", () => {
    const filtros = lerFiltrosDosLogs({});
    expect(filtros.aba).toBe("atividade");
    expect(filtros.periodo).toBe("30d");
    expect(parametrosDosLogs(filtros)).toEqual([]);
    expect(intervaloDosLogs(filtros, agora)).toEqual({ desde: new Date("2026-09-23T00:00:00-03:00"), ate: null });
  });

  it("combina os filtros e ignora o que não é válido", () => {
    const filtros = lerFiltrosDosLogs({
      aba: "alertas",
      periodo: "7d",
      usuario: "11111111-1111-1111-1111-111111111111",
      acao: "evento.criado",
      modulo: "eventos",
      resultado: "falha",
      severidade: "nada",
      busca: "  Carol ",
    });
    expect(filtros).toMatchObject({ aba: "alertas", periodo: "7d", modulo: "eventos", resultado: "falha", severidade: "", busca: "Carol" });
    expect(contarFiltrosDosLogs(filtros)).toBe(4);
    expect(intervaloDosLogs(filtros, agora).desde).toEqual(new Date("2026-10-16T00:00:00-03:00"));
    expect(lerFiltrosDosLogs({ usuario: "1; drop table", acao: "x" })).toMatchObject({ usuario: "", acao: "" });
    expect(lerFiltrosDosLogs({ usuario: "sistema" }).usuario).toBe("sistema");
  });

  it("o intervalo personalizado inclui o último dia inteiro, mesmo com as datas trocadas", () => {
    const filtros = lerFiltrosDosLogs({ periodo: "intervalo", de: "2026-10-10", ate: "2026-10-01" });
    expect(intervaloDosLogs(filtros, agora)).toEqual({
      desde: new Date("2026-10-01T00:00:00-03:00"),
      ate: new Date("2026-10-11T00:00:00-03:00"),
    });
    expect(lerFiltrosDosLogs({ de: "2026-10-10" }).de).toBe("");
  });

  it("a busca perde o que a consulta usaria como sintaxe", () => {
    expect(termoDeBusca("Carol, (Leal)*")).toBe("Carol Leal");
    expect(termoDeBusca("%%")).toBe("");
  });
});

describe("exportação", () => {
  it("usa os mesmos textos da tela, sem JSON e sem dados proibidos", () => {
    const logs = [
      log({
        acao: "adolescente.editado",
        modulo: "adolescentes",
        objetoTipo: "adolescente",
        objetoRotulo: "Bia",
        detalhes: { mudancas: [{ rotulo: "Data de nascimento", tipo: "oculto" }] },
      }),
      log({ usuarioId: null, usuarioNome: null, origem: "sistema", acao: "logs.limpeza", modulo: "administracao", detalhes: { removidos: 3, meses: 12 } }),
    ];
    const { cabecalho, linhas } = tabelaDosLogs(logs);
    expect(cabecalho).toEqual(["Data", "Hora", "Quem", "O que aconteceu", "Detalhes", "Módulo", "Resultado", "Severidade", "Origem"]);
    expect(linhas[0]).toEqual(["22/10/2026", "10:00", "Carol Leal", "Carol Leal editou o cadastro de Bia", "Data de nascimento: alterada", "Adolescentes", "Sucesso", "Informação", "Interface"]);
    expect(linhas[1][3]).toBe("Sistema apagou 3 logs antigos, com mais de 12 meses");
    const csv = gerarCsv(cabecalho, linhas);
    expect(csv).not.toMatch(/[{}]/);
  });
});

describe("quem vê o histórico do Evento", () => {
  const evento = { categoria: { area: "Ensino" }, responsavel: null };
  it("o Admin sempre; o líder que edita, só se o Admin ligar; quem só lê, nunca", () => {
    const adminSemFuncao = { id: "a", nivel: "admin" as const, ativo: true };
    const doEnsino = { id: "l", nivel: "lider" as const, ativo: true };
    expect(podeVerHistoricoDoEvento(adminSemFuncao, [], evento, false)).toBe(true);
    expect(podeVerHistoricoDoEvento(doEnsino, ["Ensino"], evento, false)).toBe(false);
    expect(podeVerHistoricoDoEvento(doEnsino, ["Ensino"], evento, true)).toBe(true);
    expect(podeVerHistoricoDoEvento(doEnsino, ["Louvor"], evento, true)).toBe(false);
    expect(podeVerHistoricoDoEvento({ ...adminSemFuncao, ativo: false }, [], evento, true)).toBe(false);
  });
});

describe("módulos", () => {
  it("o módulo sai do prefixo da ação, como no banco", () => {
    expect(moduloDaAcao("acesso.login")).toBe("contas");
    expect(moduloDaAcao("serie.editada")).toBe("eventos");
    expect(moduloDaAcao("marcacao.criada")).toBe("presenca");
    expect(moduloDaAcao("funcao.criada")).toBe("administracao");
  });
});
