import { describe, expect, it } from "vitest";
import { lerEdicao, lerEvento, type EntradaDeEvento } from "./eventos";
import {
  HORARIOS_PADRAO_INICIAIS,
  horarioDoBanco,
  lerHorarioPadrao,
  mudouOHorarioPadrao,
  valoresIniciaisDoHorario,
  type HorarioPadrao,
} from "./horarios-padrao";

const categoria = (nome: string, horarioPadrao?: HorarioPadrao, nativos: { fim?: "oculto" | "visivel" | "obrigatorio" } = {}) => ({
  nome,
  campos: [],
  horarioPadrao,
  nativos,
});

describe("valores iniciais do formulário de Evento novo", () => {
  it("traz o início padrão da Categoria", () => {
    expect(valoresIniciaisDoHorario(categoria("EBD", { inicio: "09:00", duracaoMinutos: null }))).toEqual({ hora: "09:00" });
  });

  it("com duração e o campo de fim à mostra, traz também o fim", () => {
    expect(valoresIniciaisDoHorario(categoria("Culto", { inicio: "19:00", duracaoMinutos: 90 }))).toEqual({ hora: "19:00", hora_fim: "20:30" });
    expect(valoresIniciaisDoHorario(categoria("Culto", { inicio: "19:00", duracaoMinutos: 90 }, { fim: "obrigatorio" }))).toEqual({
      hora: "19:00",
      hora_fim: "20:30",
    });
  });

  it("sem o campo de fim, a duração não preenche nada além do início", () => {
    expect(valoresIniciaisDoHorario(categoria("Culto", { inicio: "19:00", duracaoMinutos: 90 }, { fim: "oculto" }))).toEqual({ hora: "19:00" });
  });

  it("duração sem início não preenche nada", () => {
    expect(valoresIniciaisDoHorario(categoria("Culto", { inicio: null, duracaoMinutos: 90 }))).toEqual({});
  });

  it("fim que passaria da meia-noite fica em branco, para a pessoa decidir o dia", () => {
    expect(valoresIniciaisDoHorario(categoria("Culto", { inicio: "23:00", duracaoMinutos: 120 }))).toEqual({ hora: "23:00" });
  });

  it("Categoria sem padrão abre como hoje", () => {
    expect(valoresIniciaisDoHorario(categoria("Serviço"))).toEqual({});
    expect(valoresIniciaisDoHorario(categoria("Serviço", { inicio: null, duracaoMinutos: null }))).toEqual({});
  });

  it("a Postagem usa a data de publicação e nunca ganha horário", () => {
    expect(valoresIniciaisDoHorario(categoria("Postagem", { inicio: "10:00", duracaoMinutos: 30 }))).toEqual({});
  });
});

describe("padrão vindo do formulário do Admin", () => {
  it("lê início e duração, e vazio limpa", () => {
    expect(lerHorarioPadrao({ inicio: "09:00", duracao: "" })).toEqual({ inicio: "09:00", duracaoMinutos: null });
    expect(lerHorarioPadrao({ inicio: "15:30", duracao: "90" })).toEqual({ inicio: "15:30", duracaoMinutos: 90 });
    expect(lerHorarioPadrao({ inicio: "", duracao: "" })).toEqual({ inicio: null, duracaoMinutos: null });
  });

  it("recusa hora inexistente e duração fora de 1 a 1439", () => {
    expect(lerHorarioPadrao({ inicio: "25:00", duracao: "" })).toEqual({ erro: expect.stringContaining("hora") });
    expect(lerHorarioPadrao({ inicio: "09:00", duracao: "0" })).toEqual({ erro: expect.stringContaining("duração") });
    expect(lerHorarioPadrao({ inicio: "09:00", duracao: "1440" })).toEqual({ erro: expect.stringContaining("duração") });
    expect(lerHorarioPadrao({ inicio: "09:00", duracao: "1,5" })).toEqual({ erro: expect.stringContaining("duração") });
  });
});

describe("catálogo inicial", () => {
  it("EBD às 09:00 e Pequeno grupo às 15:00, sem duração", () => {
    expect(HORARIOS_PADRAO_INICIAIS).toEqual({
      EBD: { inicio: "09:00", duracaoMinutos: null },
      "Pequeno grupo": { inicio: "15:00", duracaoMinutos: null },
    });
  });
});

describe("o padrão só vale para o formulário de Evento novo", () => {
  const entrada: EntradaDeEvento = {
    titulo: "Aula",
    data: "2026-10-25",
    hora: "",
    dataFim: "",
    horaFim: "",
    local: "Sala 1",
    responsavel: "lucas",
    status: "planejado",
    observacoes: "",
    link: "",
    campos: {},
  };
  const ebd = { nome: "EBD", campos: [], horarioPadrao: { inicio: "09:00", duracaoMinutos: 60 } };

  it("salvar sem hora continua sendo dia inteiro: o padrão não entra na gravação", () => {
    const lido = lerEvento(entrada, ebd, ["lucas"]);
    expect("evento" in lido && lido.evento.diaInteiro).toBe(true);
  });

  it("a edição de um Evento antigo não ganha o padrão", () => {
    const anterior = lerEvento(entrada, ebd, ["lucas"]);
    if (!("evento" in anterior)) throw new Error("evento inválido");
    const quem = { id: "lucas", nivel: "admin" as const, ativo: true };
    const editado = lerEdicao({ ...entrada, titulo: "Aula 2" }, ebd, ["lucas"], { anterior: anterior.evento, quem, agora: new Date("2026-10-20T12:00:00Z") });
    expect("evento" in editado && editado.evento.diaInteiro).toBe(true);
  });
});

describe("conversão e comparação com o banco", () => {
  it("o banco devolve segundos; o domínio fala HH:MM", () => {
    expect(horarioDoBanco("09:00:00")).toBe("09:00");
    expect(horarioDoBanco(null)).toBeNull();
  });

  it("só há o que gravar quando algo mudou", () => {
    const atual = { horario_padrao: "09:00:00", duracao_padrao_minutos: null };
    expect(mudouOHorarioPadrao(atual, { inicio: "09:00", duracaoMinutos: null })).toBe(false);
    expect(mudouOHorarioPadrao(atual, { inicio: "09:30", duracaoMinutos: null })).toBe(true);
    expect(mudouOHorarioPadrao(atual, { inicio: "09:00", duracaoMinutos: 60 })).toBe(true);
    expect(mudouOHorarioPadrao(atual, { inicio: null, duracaoMinutos: null })).toBe(true);
    expect(mudouOHorarioPadrao(undefined, { inicio: null, duracaoMinutos: null })).toBe(true);
  });
});
