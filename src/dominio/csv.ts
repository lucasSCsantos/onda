export type Celula = string | number | boolean | null | undefined;

const BOM = "﻿";
// Ponto e vírgula é o separador que o Excel em pt-BR espera.
const SEPARADOR = ";";

const textoDaCelula = (valor: Celula): string => {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "boolean") return valor ? "sim" : "não";
  if (typeof valor === "number") return String(valor);
  // Texto que o Excel leria como fórmula vira texto comum.
  return /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
};

const escapada = (texto: string) => (/[;"\r\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto);

/** CSV legível no Excel: BOM para os acentos, `;` entre colunas e CRLF entre linhas. */
export function gerarCsv(cabecalho: string[], linhas: Celula[][]): string {
  const linha = (celulas: Celula[]) => celulas.map((c) => escapada(textoDaCelula(c))).join(SEPARADOR);
  return BOM + [cabecalho, ...linhas].map((l) => `${linha(l)}\r\n`).join("");
}
