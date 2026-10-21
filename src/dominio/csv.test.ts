import { describe, expect, it } from "vitest";
import { gerarCsv } from "./csv";

const BOM = "﻿";

describe("gerarCsv", () => {
  it("começa com BOM para o Excel ler os acentos, separa por ponto e vírgula e termina linhas com CRLF", () => {
    const csv = gerarCsv(["nome", "idade"], [["Conceição", 16]]);
    expect(csv).toBe(`${BOM}nome;idade\r\nConceição;16\r\n`);
  });

  it("só o cabeçalho quando não há linhas", () => {
    expect(gerarCsv(["a", "b"], [])).toBe(`${BOM}a;b\r\n`);
  });

  it("entre aspas quando o valor tem ponto e vírgula, aspas ou quebra de linha; aspas são dobradas", () => {
    const csv = gerarCsv(["x"], [["a;b"], ['diz "oi"'], ["linha1\nlinha2"]]);
    expect(csv).toBe(`${BOM}x\r\n"a;b"\r\n"diz ""oi"""\r\n"linha1\nlinha2"\r\n`);
  });

  it("nulo e indefinido viram vazio; booleanos viram sim e não", () => {
    expect(gerarCsv(["a", "b", "c"], [[null, undefined, true], [false, "", 0]])).toBe(`${BOM}a;b;c\r\n;;sim\r\nnão;;0\r\n`);
  });

  it("texto que o Excel leria como fórmula ganha um apóstrofo na frente", () => {
    const csv = gerarCsv(["x"], [["=SOMA(A1)"], ["+1"], ["-1+2"], ["@cmd"], ["\tabc"]]);
    expect(csv).toBe(`${BOM}x\r\n'=SOMA(A1)\r\n'+1\r\n'-1+2\r\n'@cmd\r\n'\tabc\r\n`);
  });

  it("números negativos de verdade não são tratados como fórmula", () => {
    expect(gerarCsv(["x"], [[-5]])).toBe(`${BOM}x\r\n-5\r\n`);
  });
});
