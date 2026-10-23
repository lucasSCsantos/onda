import { describe, expect, it } from "vitest";
import type { Pessoa } from "./acesso";
import { CATALOGO_INICIAL, type CampoCadastrado, type CampoDaCategoria } from "./catalogo";
import { agruparPorDia, camposDaCriacao, lerEvento, podeVerTodosOsEventos, rotuloDaData, type EntradaDeEvento } from "./eventos";

const campo = (id: string, tipo: CampoDaCategoria["tipo"], obrigatorio = false, opcoes: string[] = []): CampoCadastrado => ({
  id,
  nome: id,
  tipo,
  obrigatorio,
  opcoes,
});

const culto = { nome: "Culto", campos: [campo("quem-prega", "texto_curto")] };

const LIDERANCA = ["lucas", "carol"];

const entrada = (mudancas: Partial<EntradaDeEvento> = {}): EntradaDeEvento => ({
  titulo: "Culto de adolescentes",
  data: "2026-10-24",
  hora: "19:30",
  dataFim: "",
  horaFim: "",
  local: "Templo",
  responsavel: "lucas",
  status: "planejado",
  observacoes: "",
  link: "",
  campos: {},
  ...mudancas,
});

const erro = (resultado: ReturnType<typeof lerEvento>) => ("erro" in resultado ? resultado.erro : null);
const evento = (resultado: ReturnType<typeof lerEvento>) => {
  if ("erro" in resultado) throw new Error(resultado.erro);
  return resultado.evento;
};

describe("Responsável", () => {
  it("um Rascunho pode ficar sem Responsável", () => {
    expect(evento(lerEvento(entrada({ status: "rascunho", responsavel: "" }), culto, LIDERANCA)).responsavel).toBeNull();
  });

  it("qualquer outro Status exige Responsável", () => {
    for (const status of ["planejado", "confirmado", "cancelado", "adiado"]) {
      expect(erro(lerEvento(entrada({ status, responsavel: "" }), culto, LIDERANCA)), status).toBe(
        "Escolha o Responsável, ou salve como Rascunho.",
      );
    }
  });

  it("é qualquer pessoa da Liderança, e só dela", () => {
    expect(evento(lerEvento(entrada({ responsavel: "carol" }), culto, LIDERANCA)).responsavel).toBe("carol");
    expect(erro(lerEvento(entrada({ responsavel: "paulo-professor" }), culto, LIDERANCA))).toBe(
      "O Responsável precisa ser da Liderança.",
    );
  });
});

describe("campos comuns", () => {
  it("guarda título, local, observações e link, sem espaços nas pontas", () => {
    const lido = evento(
      lerEvento(
        entrada({ titulo: " Culto ", local: " Templo ", observacoes: " Levar som ", link: " https://onda.app/culto " }),
        culto,
        LIDERANCA,
      ),
    );
    expect(lido).toMatchObject({ titulo: "Culto", local: "Templo", observacoes: "Levar som", link: "https://onda.app/culto" });
  });

  it("o título é obrigatório", () => {
    expect(erro(lerEvento(entrada({ titulo: "  " }), culto, LIDERANCA))).toBe("Dê um título ao Evento.");
  });

  it("local, observações e link são opcionais", () => {
    const lido = evento(lerEvento(entrada({ local: "", observacoes: "", link: "" }), culto, LIDERANCA));
    expect(lido).toMatchObject({ local: "", observacoes: "", link: null });
  });

  it("o link precisa ser um endereço da web", () => {
    expect(erro(lerEvento(entrada({ link: "drive da igreja" }), culto, LIDERANCA))).toBe(
      "O link precisa começar com http:// ou https://.",
    );
  });
});

describe("campos específicos da Categoria", () => {
  const ebd = {
    nome: "EBD",
    campos: [campo("tema", "texto_curto", true), campo("professor", "pessoa"), campo("material", "link")],
  };
  const comCampos = (campos: Record<string, string>, categoria = ebd) =>
    lerEvento(entrada({ campos }), categoria, LIDERANCA);

  it("os obrigatórios precisam ser preenchidos", () => {
    expect(erro(comCampos({}))).toBe("Preencha “tema”.");
    expect(erro(comCampos({ tema: "   " }))).toBe("Preencha “tema”.");
  });

  it("os opcionais vazios ficam de fora", () => {
    expect(evento(comCampos({ tema: "Davi", professor: "", material: "" })).campos).toEqual({ tema: "Davi" });
  });

  it("ignoram o que não é campo da Categoria", () => {
    expect(evento(comCampos({ tema: "Davi", intruso: "x" })).campos).toEqual({ tema: "Davi" });
  });

  it("texto curto e texto longo guardam o texto", () => {
    const categoria = { nome: "Culto", campos: [campo("prega", "texto_curto"), campo("liturgia", "texto_longo")] };
    expect(evento(comCampos({ prega: " Pr. João ", liturgia: "Abertura\nLouvor" }, categoria)).campos).toEqual({
      prega: "Pr. João",
      liturgia: "Abertura\nLouvor",
    });
  });

  it("link precisa ser um endereço da web", () => {
    expect(evento(comCampos({ tema: "Davi", material: "https://drive.google.com/x" })).campos.material).toBe(
      "https://drive.google.com/x",
    );
    expect(erro(comCampos({ tema: "Davi", material: "pasta do drive" }))).toBe(
      "“material” precisa começar com http:// ou https://.",
    );
  });

  it("valor em reais é guardado em centavos", () => {
    const categoria = { nome: "Evento extra", campos: [campo("valor", "valor")] };
    for (const [texto, centavos] of [
      ["35", 3500],
      ["35,50", 3550],
      ["R$ 1.234,5", 123450],
      ["0", 0],
    ] as const) {
      expect(evento(comCampos({ valor: texto }, categoria)).campos.valor, texto).toBe(centavos);
    }
    for (const texto of ["trinta", "-10", "10,555", "1,2,3"]) {
      expect(erro(comCampos({ valor: texto }, categoria)), texto).toBe("“valor” precisa ser um valor em reais, como 35,00.");
    }
  });

  it("data e data e hora precisam existir", () => {
    const categoria = { nome: "X", campos: [campo("prazo", "data"), campo("encontro", "data_hora")] };
    expect(evento(comCampos({ prazo: "2026-11-01", encontro: "2026-11-02T08:30" }, categoria)).campos).toEqual({
      prazo: "2026-11-01",
      encontro: "2026-11-02T08:30",
    });
    expect(erro(comCampos({ prazo: "2026-13-01" }, categoria))).toBe("“prazo” precisa ser uma data.");
    expect(erro(comCampos({ encontro: "2026-11-02" }, categoria))).toBe("“encontro” precisa ser uma data e hora.");
  });

  it("escolha aceita só uma das opções", () => {
    const postagem = { nome: "Postagem", campos: [campo("plataforma", "escolha", true, ["Instagram", "YouTube"])] };
    expect(evento(comCampos({ plataforma: "YouTube" }, postagem)).campos.plataforma).toBe("YouTube");
    expect(erro(comCampos({ plataforma: "TikTok" }, postagem))).toBe("Escolha uma das opções de “plataforma”.");
  });

  it("lista guarda um item por linha, sem linhas vazias", () => {
    const categoria = { nome: "Evento extra", campos: [campo("levar", "lista", true)] };
    expect(evento(comCampos({ levar: "Bíblia\n\n  Garrafa d’água \n" }, categoria)).campos.levar).toEqual([
      "Bíblia",
      "Garrafa d’água",
    ]);
    expect(erro(comCampos({ levar: "\n \n" }, categoria))).toBe("Preencha “levar”.");
  });

  it("pessoa é alguém da Liderança", () => {
    expect(evento(comCampos({ tema: "Davi", professor: "carol" })).campos.professor).toBe("carol");
    expect(erro(comCampos({ tema: "Davi", professor: "desconhecido" }))).toBe("Escolha uma pessoa da Liderança em “professor”.");
  });

  it("o checklist não é preenchido no formulário", () => {
    const acampamento = { nome: "Acampamento", campos: [campo("tarefas", "checklist")] };
    expect(evento(comCampos({ tarefas: "Reservar ônibus" }, acampamento)).campos).toEqual({});
  });

  it("o formulário de criação mostra todos os campos, menos o checklist", () => {
    const acampamento = { nome: "Acampamento", campos: [campo("tema", "texto_curto"), campo("tarefas", "checklist")] };
    expect(camposDaCriacao(acampamento).map((c) => c.id)).toEqual(["tema"]);
  });
});

describe("início e fim, no fuso America/Bahia", () => {
  it("com hora, o início é aquele horário em Salvador", () => {
    const lido = evento(lerEvento(entrada({ data: "2026-10-24", hora: "19:30" }), culto, LIDERANCA));
    expect(lido.inicio.toISOString()).toBe("2026-10-24T22:30:00.000Z");
    expect(lido.diaInteiro).toBe(false);
    expect(lido.fim).toBeNull();
  });

  it("sem hora, o Evento é de dia inteiro e começa à meia-noite de Salvador", () => {
    const lido = evento(lerEvento(entrada({ data: "2026-10-24", hora: "" }), culto, LIDERANCA));
    expect(lido.diaInteiro).toBe(true);
    expect(lido.inicio.toISOString()).toBe("2026-10-24T03:00:00.000Z");
  });

  it("sem data, não há Evento", () => {
    expect(erro(lerEvento(entrada({ data: "" }), culto, LIDERANCA))).toBe("Informe a data do Evento.");
    expect(erro(lerEvento(entrada({ data: "2026-02-30" }), culto, LIDERANCA))).toBe("Informe a data do Evento.");
    expect(erro(lerEvento(entrada({ hora: "25:00" }), culto, LIDERANCA))).toBe("Informe uma hora válida.");
  });

  it("o fim é opcional e, só com a hora, é no mesmo dia do início", () => {
    const lido = evento(lerEvento(entrada({ hora: "19:30", horaFim: "21:00" }), culto, LIDERANCA));
    expect(lido.fim?.toISOString()).toBe("2026-10-25T00:00:00.000Z");
  });

  it("o fim pode ser em outro dia", () => {
    const lido = evento(lerEvento(entrada({ hora: "19:30", dataFim: "2026-10-25", horaFim: "08:00" }), culto, LIDERANCA));
    expect(lido.fim?.toISOString()).toBe("2026-10-25T11:00:00.000Z");
  });

  it("com hora no início, o fim noutro dia também precisa de hora", () => {
    expect(erro(lerEvento(entrada({ hora: "19:30", dataFim: "2026-10-25" }), culto, LIDERANCA))).toBe(
      "Informe a hora do fim.",
    );
  });

  it("um Evento de dia inteiro de vários dias termina num dia, sem hora", () => {
    const acampamento = evento(lerEvento(entrada({ data: "2026-11-13", hora: "", dataFim: "2026-11-15" }), culto, LIDERANCA));
    expect(acampamento.diaInteiro).toBe(true);
    expect(acampamento.fim?.toISOString()).toBe("2026-11-15T03:00:00.000Z");
    expect(erro(lerEvento(entrada({ hora: "", dataFim: "2026-10-25", horaFim: "10:00" }), culto, LIDERANCA))).toBe(
      "Um Evento de dia inteiro termina num dia, sem hora.",
    );
  });

  it("o fim não vem antes do início", () => {
    expect(erro(lerEvento(entrada({ hora: "19:30", horaFim: "18:00" }), culto, LIDERANCA))).toBe(
      "O fim não pode ser antes do início.",
    );
    expect(erro(lerEvento(entrada({ data: "2026-10-24", hora: "", dataFim: "2026-10-23" }), culto, LIDERANCA))).toBe(
      "O fim não pode ser antes do início.",
    );
  });
});

describe("Status", () => {
  it("um Evento novo começa em Rascunho, Planejado, Confirmado, Cancelado ou Adiado", () => {
    for (const status of ["rascunho", "planejado", "confirmado", "cancelado", "adiado"]) {
      expect(evento(lerEvento(entrada({ status }), culto, LIDERANCA)).status).toBe(status);
    }
  });

  it("não começa Realizado: isso só acontece depois do fim (ticket 05)", () => {
    expect(erro(lerEvento(entrada({ status: "realizado" }), culto, LIDERANCA))).toBe("Escolha o Status.");
  });

  it("recusa um Status desconhecido", () => {
    expect(erro(lerEvento(entrada({ status: "feito" }), culto, LIDERANCA))).toBe("Escolha o Status.");
  });
});

describe("Postagem", () => {
  it("a data do Evento é a data de publicação", () => {
    expect(rotuloDaData({ nome: "Postagem" })).toBe("Publicação");
    expect(rotuloDaData({ nome: "Culto" })).toBe("Data");
  });

  it("não tem um campo extra de data no catálogo inicial", () => {
    const postagem = CATALOGO_INICIAL.categorias.find((c) => c.nome === "Postagem")!;
    expect(postagem.campos.filter((c) => c.tipo === "data" || c.tipo === "data_hora")).toEqual([]);
  });
});

describe("quem lê a lista de Eventos", () => {
  const pessoa = (nivel: Pessoa["nivel"], ativo = true): Pessoa => ({ id: nivel, nivel, ativo });

  it("toda a Liderança lê todos os Eventos, de todas as Áreas", () => {
    expect(podeVerTodosOsEventos(pessoa("admin"))).toBe(true);
    expect(podeVerTodosOsEventos(pessoa("lider"))).toBe(true);
  });

  it("Pendente, Professor e desativados não leem", () => {
    expect(podeVerTodosOsEventos(pessoa("pendente"))).toBe(false);
    expect(podeVerTodosOsEventos(pessoa("professor"))).toBe(false);
    expect(podeVerTodosOsEventos(pessoa("lider", false))).toBe(false);
  });
});

describe("lista cronológica", () => {
  const em = (iso: string, diaInteiro = false) => ({ id: iso, inicio: new Date(iso), diaInteiro });

  it("agrupa por dia no fuso America/Bahia, em ordem, com o dia inteiro no topo", () => {
    const dias = agruparPorDia([
      em("2026-10-25T09:00:00-03:00"),
      em("2026-10-24T22:30:00-03:00"), // já é 25/10 em UTC, mas ainda 24/10 em Salvador
      em("2026-10-25T00:00:00-03:00", true),
      em("2026-10-24T08:00:00-03:00"),
    ]);
    expect(dias.map((d) => [d.dia, d.eventos.map((e) => e.id)])).toEqual([
      ["2026-10-24", ["2026-10-24T08:00:00-03:00", "2026-10-24T22:30:00-03:00"]],
      ["2026-10-25", ["2026-10-25T00:00:00-03:00", "2026-10-25T09:00:00-03:00"]],
    ]);
  });

  it("um Evento de dia inteiro vem antes de um à meia-noite do mesmo dia", () => {
    const [dia] = agruparPorDia([em("2026-10-25T00:00:00-03:00"), em("2026-10-25T00:00:00.000-03:00", true)]);
    expect(dia.eventos.map((e) => e.diaInteiro)).toEqual([true, false]);
  });
});
