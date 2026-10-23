import { describe, expect, it } from "vitest";
import type { Pessoa } from "./acesso";
import {
  gerarFeed,
  inicioDaJanela,
  lerOpcoes,
  OPCOES_PADRAO,
  type EventoDoFeed,
  type OpcoesDaAssinatura,
} from "./assinatura-de-calendario";
import type { Status } from "./eventos";

const AGORA = new Date("2026-10-23T15:00:00Z");

const LIDER: Pessoa = { id: "lider-1", nivel: "lider", ativo: true };
const ADMIN: Pessoa = { id: "admin-1", nivel: "admin", ativo: true };
const PROFESSOR: Pessoa = { id: "prof-1", nivel: "professor", ativo: true };

/** Um Evento das 19h às 21h de 24/10/2026 em Salvador. */
const evento = (mudancas: Partial<EventoDoFeed> = {}): EventoDoFeed => ({
  id: "ev-1",
  titulo: "Culto de jovens",
  numero: null,
  inicio: new Date("2026-10-24T22:00:00Z"),
  fim: new Date("2026-10-25T00:00:00Z"),
  diaInteiro: false,
  local: "Templo",
  status: "confirmado",
  link: null,
  categoriaId: "cat-culto",
  envolvidos: ["lider-1"],
  professores: [],
  ...mudancas,
});

const TODOS: OpcoesDaAssinatura = OPCOES_PADRAO;

const feed = (quem: Pessoa, eventos: EventoDoFeed[], opcoes: OpcoesDaAssinatura = TODOS, aniversariantes: { id: string; nome: string; nascimento: string }[] = [], agora = AGORA) =>
  gerarFeed({ quem, opcoes, eventos, aniversariantes, agora });

/** As linhas do arquivo, já sem as dobras de linha longa. */
const linhas = (texto: string) => texto.replace(/\r\n[ \t]/g, "").split("\r\n");
const eventosDoTexto = (texto: string) => texto.split("BEGIN:VEVENT").slice(1).map((e) => e.split("END:VEVENT")[0]);

describe("estrutura do arquivo", () => {
  it("é um calendário iCalendar com linhas separadas por CRLF e fuso America/Bahia", () => {
    const texto = feed(LIDER, [evento()]);
    expect(texto.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(texto.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(texto).toContain("VERSION:2.0\r\n");
    expect(texto).toContain("X-WR-TIMEZONE:America/Bahia\r\n");
    expect(texto).toContain("BEGIN:VTIMEZONE\r\nTZID:America/Bahia\r\n");
    expect(texto).not.toMatch(/[^\r]\n/);
  });

  it("sem Eventos, ainda é um calendário válido", () => {
    const texto = feed(LIDER, []);
    expect(texto).toContain("BEGIN:VCALENDAR");
    expect(eventosDoTexto(texto)).toHaveLength(0);
  });

  it("dobra as linhas longas em 75 bytes, sem quebrar um caractere acentuado", () => {
    const texto = feed(LIDER, [evento({ titulo: "Encontro de adolescentes com muita animação e louvor ".repeat(4) + "ççç" })]);
    for (const linha of texto.split("\r\n")) expect(Buffer.byteLength(linha)).toBeLessThanOrEqual(75);
    expect(linhas(texto).join("\n")).toContain("ççç");
  });
});

describe("horários", () => {
  it("usa o horário de Salvador, com o fuso nomeado", () => {
    const [e] = eventosDoTexto(feed(LIDER, [evento()]));
    expect(e).toContain("DTSTART;TZID=America/Bahia:20261024T190000\r\n");
    expect(e).toContain("DTEND;TZID=America/Bahia:20261024T210000\r\n");
  });

  it("sem fim, não inventa uma duração", () => {
    const [e] = eventosDoTexto(feed(LIDER, [evento({ fim: null })]));
    expect(e).toContain("DTSTART;TZID=America/Bahia:20261024T190000");
    expect(e).not.toContain("DTEND");
  });

  it("um Evento de dia inteiro vira um evento de data, que termina no dia seguinte ao último dia", () => {
    const [e] = eventosDoTexto(
      feed(LIDER, [evento({ inicio: new Date("2026-10-24T03:00:00Z"), fim: null, diaInteiro: true })]),
    );
    expect(e).toContain("DTSTART;VALUE=DATE:20261024\r\n");
    expect(e).toContain("DTEND;VALUE=DATE:20261025\r\n");
  });

  it("de dia inteiro e com vários dias, termina depois do último", () => {
    const [e] = eventosDoTexto(
      feed(LIDER, [evento({ inicio: new Date("2026-10-24T03:00:00Z"), fim: new Date("2026-10-26T03:00:00Z"), diaInteiro: true })]),
    );
    expect(e).toContain("DTSTART;VALUE=DATE:20261024\r\n");
    expect(e).toContain("DTEND;VALUE=DATE:20261027\r\n");
  });

  it("perto da meia-noite, o dia é o de Salvador, não o do UTC", () => {
    const [e] = eventosDoTexto(feed(LIDER, [evento({ inicio: new Date("2026-10-25T02:30:00Z"), fim: null })]));
    expect(e).toContain("DTSTART;TZID=America/Bahia:20261024T233000");
  });
});

describe("identificador", () => {
  it("é o mesmo do Evento, mesmo mudando título, horário e a hora da geração", () => {
    const antes = eventosDoTexto(feed(LIDER, [evento()]))[0].match(/UID:(.+)\r\n/)![1];
    const depois = eventosDoTexto(
      feed(LIDER, [evento({ titulo: "Outro título", inicio: new Date("2026-10-30T22:00:00Z"), fim: null })], TODOS, [], new Date("2026-10-24T09:00:00Z")),
    )[0].match(/UID:(.+)\r\n/)![1];
    expect(depois).toBe(antes);
    expect(antes).toContain("ev-1");
  });

  it("é diferente para cada Evento, inclusive para cada Ocorrência de uma Série", () => {
    const uids = eventosDoTexto(feed(LIDER, [evento({ id: "ev-1" }), evento({ id: "ev-2", numero: 2 })])).map((e) => e.match(/UID:(.+)\r\n/)![1]);
    expect(new Set(uids).size).toBe(2);
  });
});

describe("quais Eventos entram", () => {
  const status = (s: Status) => eventosDoTexto(feed(LIDER, [evento({ status: s })])).length;

  it("Planejado, Confirmado, Realizado e Adiado entram", () => {
    for (const s of ["planejado", "confirmado", "realizado", "adiado"] as const) expect(status(s)).toBe(1);
  });

  it("Cancelado e Rascunho ficam de fora", () => {
    expect(status("cancelado")).toBe(0);
    expect(status("rascunho")).toBe(0);
  });

  it("cada Ocorrência de uma Série é um Evento individual, com o número no título", () => {
    const texto = feed(LIDER, [
      evento({ id: "a", titulo: "EBD", numero: 1 }),
      evento({ id: "b", titulo: "EBD", numero: 2, inicio: new Date("2026-10-31T22:00:00Z"), fim: null }),
    ]);
    expect(linhas(texto)).toContain("SUMMARY:EBD · 1");
    expect(linhas(texto)).toContain("SUMMARY:EBD · 2");
  });

  it("o Adiado vem marcado no título", () => {
    expect(linhas(feed(LIDER, [evento({ status: "adiado", numero: 3, titulo: "EBD" })]))).toContain("SUMMARY:[Adiado] EBD · 3");
  });

  it("pessoa desativada ou ainda pendente não recebe nenhum Evento", () => {
    expect(eventosDoTexto(feed({ ...LIDER, ativo: false }, [evento()]))).toHaveLength(0);
    expect(eventosDoTexto(feed({ id: "p", nivel: "pendente", ativo: true }, [evento()]))).toHaveLength(0);
  });
});

describe("conteúdo do evento", () => {
  it("leva o local quando existe e não leva quando está vazio", () => {
    expect(linhas(feed(LIDER, [evento({ local: "Templo" })]))).toContain("LOCATION:Templo");
    expect(feed(LIDER, [evento({ local: "" })])).not.toContain("LOCATION");
  });

  it("põe o link do material na descrição e não cria descrição sem link", () => {
    expect(linhas(feed(LIDER, [evento({ link: "https://exemplo.org/aula" })]))).toContain("DESCRIPTION:Link: https://exemplo.org/aula");
    expect(feed(LIDER, [evento({ link: null })])).not.toContain("DESCRIPTION");
  });

  it("escapa vírgula, ponto e vírgula, barra e quebra de linha", () => {
    const texto = feed(LIDER, [evento({ titulo: "Louvor, oração; e \\ mais\numa linha" })]);
    expect(linhas(texto)).toContain("SUMMARY:Louvor\\, oração\\; e \\\\ mais\\numa linha");
  });

  it("não vaza observações, Responsável nem campos livres", () => {
    const texto = feed(LIDER, [evento()]);
    expect(texto).not.toMatch(/ATTENDEE|ORGANIZER|observa/i);
  });
});

describe("filtros", () => {
  const eventos = [
    evento({ id: "meu", categoriaId: "cat-culto", envolvidos: ["lider-1"] }),
    evento({ id: "alheio", categoriaId: "cat-culto", envolvidos: ["outra"] }),
    evento({ id: "ebd", categoriaId: "cat-ebd", envolvidos: ["outra"] }),
  ];
  const ids = (texto: string) => eventosDoTexto(texto).map((e) => e.match(/UID:evento-(.+)@/)![1]);

  it("todos entrega tudo", () => {
    expect(ids(feed(LIDER, eventos))).toEqual(["meu", "alheio", "ebd"]);
  });

  it("meus entrega só onde a pessoa é Responsável, Professor ou Auxiliar", () => {
    expect(ids(feed(LIDER, eventos, { ...TODOS, escopo: "meus" }))).toEqual(["meu"]);
  });

  it("Categorias escolhidas restringem; sem escolha, valem todas", () => {
    expect(ids(feed(LIDER, eventos, { ...TODOS, categorias: ["cat-ebd"] }))).toEqual(["ebd"]);
    expect(ids(feed(LIDER, eventos, { ...TODOS, categorias: [] }))).toHaveLength(3);
  });

  it("os filtros se combinam", () => {
    expect(ids(feed(LIDER, eventos, { escopo: "meus", categorias: ["cat-ebd"], aniversarios: false }))).toEqual([]);
  });
});

describe("Professor", () => {
  const aulas = [
    evento({ id: "dele", professores: ["prof-1"], envolvidos: ["lider-9", "prof-1"] }),
    evento({ id: "de-outro", professores: ["prof-2"], envolvidos: ["lider-9", "prof-2"] }),
    evento({ id: "sem-professor", professores: [], envolvidos: ["lider-9"] }),
  ];

  it("recebe só as aulas em que foi colocado, mesmo pedindo todos", () => {
    const texto = feed(PROFESSOR, aulas, { ...TODOS, escopo: "todos" });
    expect(eventosDoTexto(texto)).toHaveLength(1);
    expect(texto).toContain("UID:evento-dele@");
  });

  it("nunca recebe aniversários, mesmo com a opção ligada", () => {
    const texto = feed(PROFESSOR, aulas, { ...TODOS, aniversarios: true }, [{ id: "a1", nome: "Maria Souza", nascimento: "2010-10-25" }]);
    expect(texto).not.toContain("Maria");
  });
});

describe("aniversários", () => {
  const maria = { id: "a1", nome: "Maria da Silva Souza", nascimento: "2010-10-25" };
  const comAniversarios = { ...TODOS, aniversarios: true };

  it("só entram se a pessoa optou", () => {
    expect(feed(LIDER, [], TODOS, [maria])).not.toContain("Maria");
    expect(feed(LIDER, [], comAniversarios, [maria])).toContain("Maria");
  });

  it("mostram só o primeiro nome, sem sobrenome, idade nem ano de nascimento", () => {
    const texto = feed(LIDER, [], comAniversarios, [maria]);
    expect(linhas(texto)).toContain("SUMMARY:Aniversário de Maria");
    expect(texto).not.toMatch(/Silva|Souza|2010|idade/i);
  });

  it("são eventos de dia inteiro no dia da comemoração, com identificador estável por pessoa e ano", () => {
    const [e] = eventosDoTexto(feed(LIDER, [], comAniversarios, [maria]));
    expect(e).toContain("DTSTART;VALUE=DATE:20261025\r\n");
    expect(e).toContain("DTEND;VALUE=DATE:20261026\r\n");
    expect(e).toContain("UID:aniversario-a1-2026@");
    const depois = eventosDoTexto(feed(LIDER, [], comAniversarios, [maria], new Date("2026-10-24T10:00:00Z")))[0];
    expect(depois).toContain("UID:aniversario-a1-2026@");
  });

  it("cobrem o próximo ano, mas não o que já passou da janela", () => {
    const texto = feed(LIDER, [], comAniversarios, [maria, { id: "a2", nome: "João", nascimento: "2010-01-05" }, { id: "a3", nome: "Ana", nascimento: "2010-06-01" }]);
    expect(texto).toContain("UID:aniversario-a1-2026@");
    expect(texto).not.toContain("UID:aniversario-a1-2027@");
    expect(texto).toContain("UID:aniversario-a2-2027@");
    expect(texto).not.toContain("UID:aniversario-a3-2026@");
    expect(texto).toContain("UID:aniversario-a3-2027@");
  });

  it("quem nasceu em 29/02 comemora em 28/02 nos anos sem bissexto", () => {
    const texto = feed(LIDER, [], comAniversarios, [{ id: "b", nome: "Bia", nascimento: "2012-02-29" }]);
    const dia = (ano: number) => eventosDoTexto(texto).find((e) => e.includes(`aniversario-b-${ano}`))?.match(/DTSTART;VALUE=DATE:(\d+)/)?.[1];
    expect(dia(2027)).toBe("20270228");
  });

  it("o Admin também pode optar", () => {
    expect(feed(ADMIN, [], comAniversarios, [maria])).toContain("Maria");
  });
});

describe("janela", () => {
  it("começa 90 dias antes de agora", () => {
    expect(inicioDaJanela(AGORA).toISOString()).toBe("2026-07-25T15:00:00.000Z");
  });
});

describe("lerOpcoes", () => {
  const categorias = ["cat-culto", "cat-ebd", "cat-pg"];

  it("lê o que o formulário enviou", () => {
    expect(lerOpcoes({ escopo: "meus", categorias: ["cat-ebd"], aniversarios: true }, LIDER, categorias)).toEqual({
      escopo: "meus",
      categorias: ["cat-ebd"],
      aniversarios: true,
    });
  });

  it("um escopo desconhecido vira todos", () => {
    expect(lerOpcoes({ escopo: "qualquer", categorias: [], aniversarios: false }, LIDER, categorias).escopo).toBe("todos");
  });

  it("ignora Categorias que não existem e trata todas marcadas como sem filtro", () => {
    expect(lerOpcoes({ escopo: "todos", categorias: ["cat-ebd", "fantasma"], aniversarios: false }, LIDER, categorias).categorias).toEqual(["cat-ebd"]);
    expect(lerOpcoes({ escopo: "todos", categorias: categorias, aniversarios: false }, LIDER, categorias).categorias).toEqual([]);
  });

  it("o Professor fica só com as próprias aulas e sem aniversários", () => {
    expect(lerOpcoes({ escopo: "todos", categorias: [], aniversarios: true }, PROFESSOR, categorias)).toEqual({
      escopo: "meus",
      categorias: [],
      aniversarios: false,
    });
  });
});
