/** Valor de texto de um campo de formulário, sem espaços nas pontas. */
export const campoTexto = (dados: FormData, campo: string) => String(dados.get(campo) ?? "").trim();
