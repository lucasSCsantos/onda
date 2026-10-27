export const GENEROS = ["masculino", "feminino"] as const;
export type Genero = (typeof GENEROS)[number];

export const NOMES_DOS_GENEROS: Record<Genero, string> = { masculino: "Masculino", feminino: "Feminino" };

/** O Gênero de um campo de formulário ou do banco; qualquer outra coisa é "não informado". */
export function lerGenero(valor: unknown): Genero | null {
  return GENEROS.find((g) => g === valor) ?? null;
}

/** Cadastro novo (auto-cadastro ou convite) exige o Gênero; perfis antigos seguem sem ele. */
export function erroNoGenero(valor: unknown): string | null {
  return lerGenero(valor) ? null : "Escolha o Gênero.";
}

/** Quem está sem Gênero ganha o selo de "cadastro incompleto". */
export const cadastroIncompleto = (genero: Genero | null) => genero === null;
