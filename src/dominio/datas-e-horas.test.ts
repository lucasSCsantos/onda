import { describe, expect, it } from "vitest";
import {
  arredondarHora,
  dataParaExibir,
  destinoDoTeclado,
  dividirDataEHora,
  escolherNoIntervalo,
  estaNoIntervalo,
  formatarHora,
  horasDoDia,
  juntarDataEHora,
  lerData,
  lerDataDigitada,
  lerHora,
  lerHoraDigitada,
  montarGrade,
  mudarMes,
  paginaDeAnos,
  somarDiasA,
  somarMesesA,
} from "./datas-e-horas";

describe("grade do mês", () => {
  it("começa na segunda-feira e fecha em semanas inteiras", () => {
    // Outubro de 2026 começa numa quinta: a primeira semana traz seg 28/09 a qua 30/09.
    const grade = montarGrade(2026, 10);
    expect(grade.every((semana) => semana.length === 7)).toBe(true);
    expect(grade[0].map((c) => c.data)).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
    expect(grade.at(-1)!.at(-1)!.data).toBe("2026-11-01");
  });

  it("marca os dias de fora do mês", () => {
    const celulas = montarGrade(2026, 10).flat();
    expect(celulas.filter((c) => c.doMes)).toHaveLength(31);
    expect(celulas[0].doMes).toBe(false);
    expect(celulas.find((c) => c.data === "2026-10-01")!.doMes).toBe(true);
  });

  it("mês que começa na segunda não ganha dias antes; fevereiro de 2027 cabe em quatro semanas", () => {
    const grade = montarGrade(2027, 2);
    expect(grade).toHaveLength(4);
    expect(grade[0][0]).toEqual({ data: "2027-02-01", dia: 1, doMes: true });
  });

  it("mês que começa no domingo traz seis dias antes", () => {
    const grade = montarGrade(2026, 3);
    expect(grade[0][0].data).toBe("2026-02-23");
    expect(grade[0][6].data).toBe("2026-03-01");
  });

  it("ano bissexto tem 29 dias em fevereiro", () => {
    expect(montarGrade(2028, 2).flat().filter((c) => c.doMes)).toHaveLength(29);
  });
});

describe("navegação", () => {
  it("vira o ano ao mudar de mês", () => {
    expect(mudarMes(2026, 12, 1)).toEqual({ ano: 2027, mes: 1 });
    expect(mudarMes(2026, 1, -1)).toEqual({ ano: 2025, mes: 12 });
    expect(mudarMes(2026, 5, -17)).toEqual({ ano: 2024, mes: 12 });
  });

  it("soma dias e meses, ficando no fim de mês mais curto", () => {
    expect(somarDiasA("2026-10-31", 1)).toBe("2026-11-01");
    expect(somarDiasA("2026-01-01", -1)).toBe("2025-12-31");
    expect(somarMesesA("2026-01-31", 1)).toBe("2026-02-28");
    expect(somarMesesA("2026-03-15", -3)).toBe("2025-12-15");
  });

  it("anos em páginas de doze", () => {
    expect(paginaDeAnos(1995)).toHaveLength(12);
    expect(paginaDeAnos(1995)).toContain(1995);
    expect(paginaDeAnos(1995)[0] % 12).toBe(0);
  });
});

describe("datas", () => {
  it("lê só datas que existem", () => {
    expect(lerData("2026-10-27")).toEqual({ ano: 2026, mes: 10, dia: 27 });
    expect(lerData("2026-02-30")).toBeNull();
    expect(lerData("2026-13-01")).toBeNull();
    expect(lerData("")).toBeNull();
  });

  it("mostra em dia/mês/ano; vazio e inválido ficam vazios", () => {
    expect(dataParaExibir("2026-10-27")).toBe("27/10/2026");
    expect(dataParaExibir("")).toBe("");
    expect(dataParaExibir("lixo")).toBe("");
  });

  it("lê o que se digita; vazio é vazio e erro é nulo", () => {
    expect(lerDataDigitada("27/10/2026")).toBe("2026-10-27");
    expect(lerDataDigitada("1/2/1995")).toBe("1995-02-01");
    expect(lerDataDigitada("27102026")).toBe("2026-10-27");
    expect(lerDataDigitada("1995-05-10")).toBe("1995-05-10");
    expect(lerDataDigitada("1995-02-30")).toBeNull();
    expect(lerDataDigitada("")).toBe("");
    expect(lerDataDigitada("31/02/2026")).toBeNull();
    expect(lerDataDigitada("abc")).toBeNull();
  });
});

describe("intervalo", () => {
  it("o primeiro toque define o início; o segundo, o fim", () => {
    const a = escolherNoIntervalo({ inicio: "", fim: "" }, "2026-10-10");
    expect(a).toEqual({ inicio: "2026-10-10", fim: "" });
    expect(escolherNoIntervalo(a, "2026-10-20")).toEqual({ inicio: "2026-10-10", fim: "2026-10-20" });
  });

  it("fim antes do início vira o novo início; mesmo dia vale um dia só", () => {
    const a = { inicio: "2026-10-10", fim: "" };
    expect(escolherNoIntervalo(a, "2026-10-05")).toEqual({ inicio: "2026-10-05", fim: "" });
    expect(escolherNoIntervalo(a, "2026-10-10")).toEqual({ inicio: "2026-10-10", fim: "2026-10-10" });
  });

  it("com o intervalo completo, um toque recomeça", () => {
    expect(escolherNoIntervalo({ inicio: "2026-10-10", fim: "2026-10-20" }, "2026-11-01")).toEqual({ inicio: "2026-11-01", fim: "" });
  });

  it("diz se o dia está dentro, pontas inclusive", () => {
    const i = { inicio: "2026-10-10", fim: "2026-10-20" };
    expect(estaNoIntervalo("2026-10-10", i)).toBe(true);
    expect(estaNoIntervalo("2026-10-20", i)).toBe(true);
    expect(estaNoIntervalo("2026-10-21", i)).toBe(false);
    expect(estaNoIntervalo("2026-10-10", { inicio: "2026-10-10", fim: "" })).toBe(true);
    expect(estaNoIntervalo("2026-10-11", { inicio: "2026-10-10", fim: "" })).toBe(false);
    expect(estaNoIntervalo("2026-10-11", { inicio: "", fim: "" })).toBe(false);
  });
});

describe("hora", () => {
  it("lê HH:MM; vazio é dia inteiro (nulo) e hora inexistente também", () => {
    expect(lerHora("09:30")).toBe(570);
    expect(lerHora("")).toBeNull();
    expect(lerHora("24:00")).toBeNull();
    expect(lerHora("09:60")).toBeNull();
    expect(formatarHora(570)).toBe("09:30");
  });

  it("passos de 5 e de 15 minutos", () => {
    expect(horasDoDia(15)).toHaveLength(96);
    expect(horasDoDia(5)).toHaveLength(288);
    expect(horasDoDia(15)[37]).toBe("09:15");
    expect(horasDoDia(60).at(-1)).toBe("23:00");
  });

  it("arredonda ao passo mais próximo sem passar do fim do dia", () => {
    expect(arredondarHora(9 * 60 + 7, 5)).toBe(9 * 60 + 5);
    expect(arredondarHora(9 * 60 + 8, 5)).toBe(9 * 60 + 10);
    expect(arredondarHora(9 * 60 + 8, 15)).toBe(9 * 60 + 15);
    expect(arredondarHora(23 * 60 + 58, 15)).toBe(23 * 60 + 45);
  });

  it("lê a digitação em vários formatos e vazio como sem horário", () => {
    expect(lerHoraDigitada("9")).toBe("09:00");
    expect(lerHoraDigitada("09:10")).toBe("09:10");
    expect(lerHoraDigitada("930")).toBe("09:30");
    expect(lerHoraDigitada("0930")).toBe("09:30");
    expect(lerHoraDigitada("9h30")).toBe("09:30");
    expect(lerHoraDigitada("15h")).toBe("15:00");
    expect(lerHoraDigitada("  ")).toBe("");
    expect(lerHoraDigitada("25:00")).toBeNull();
    expect(lerHoraDigitada("9:75")).toBeNull();
    expect(lerHoraDigitada("abc")).toBeNull();
  });
});

describe("data e hora juntas", () => {
  it("divide e junta no formato do campo", () => {
    expect(dividirDataEHora("2026-10-27T09:30")).toEqual({ data: "2026-10-27", hora: "09:30" });
    expect(dividirDataEHora("")).toEqual({ data: "", hora: "" });
    expect(juntarDataEHora("2026-10-27", "09:30")).toBe("2026-10-27T09:30");
    expect(juntarDataEHora("2026-10-27", "")).toBe("2026-10-27T00:00");
    expect(juntarDataEHora("", "09:30")).toBe("");
  });
});

describe("teclado no calendário", () => {
  const grade = montarGrade(2026, 10);

  it("setas andam um dia ou uma semana, atravessando o mês", () => {
    expect(destinoDoTeclado(grade, "2026-10-15", "ArrowRight", false)).toBe("2026-10-16");
    expect(destinoDoTeclado(grade, "2026-10-15", "ArrowLeft", false)).toBe("2026-10-14");
    expect(destinoDoTeclado(grade, "2026-10-15", "ArrowDown", false)).toBe("2026-10-22");
    expect(destinoDoTeclado(grade, "2026-10-01", "ArrowUp", false)).toBe("2026-09-24");
    expect(destinoDoTeclado(grade, "2026-10-31", "ArrowRight", false)).toBe("2026-11-01");
  });

  it("Home e End vão às pontas da semana, de segunda a domingo", () => {
    expect(destinoDoTeclado(grade, "2026-10-15", "Home", false)).toBe("2026-10-12");
    expect(destinoDoTeclado(grade, "2026-10-15", "End", false)).toBe("2026-10-18");
  });

  it("PageUp e PageDown mudam o mês, e com Shift o ano", () => {
    expect(destinoDoTeclado(grade, "2026-10-31", "PageDown", false)).toBe("2026-11-30");
    expect(destinoDoTeclado(grade, "2026-10-15", "PageUp", false)).toBe("2026-09-15");
    expect(destinoDoTeclado(grade, "2026-10-15", "PageDown", true)).toBe("2027-10-15");
  });

  it("outras teclas não movem nada", () => {
    expect(destinoDoTeclado(grade, "2026-10-15", "a", false)).toBeNull();
    expect(destinoDoTeclado(grade, "2026-10-15", "Enter", false)).toBeNull();
  });
});
