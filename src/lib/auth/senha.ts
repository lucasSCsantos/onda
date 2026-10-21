/** Tamanho mínimo de senha; o mesmo valor está em `minimum_password_length` do supabase/config.toml. */
export const SENHA_MINIMA = 8;

/** Mensagem para uma senha curta demais, ou `null` se ela serve. */
export const erroDeSenha = (senha: string) =>
  senha.length < SENHA_MINIMA ? `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` : null;
