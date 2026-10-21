/** Valor de texto de um campo de formulário, sem espaços nas pontas. */
export const campoTexto = (dados: FormData, campo: string) => String(dados.get(campo) ?? "").trim();

/** Nome, no formulário de Evento, de um campo específico da Categoria. */
export const nomeDoCampoEspecifico = (id: string) => `campo:${id}`;
