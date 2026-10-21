/** Nível de acesso de uma conta. Admin e Líder compõem a Liderança. */
export type NivelDeAcesso = "admin" | "lider" | "professor" | "pendente";

export type Pessoa = { id: string; nivel: NivelDeAcesso; ativo: boolean };

export const NOMES_DOS_NIVEIS: Record<NivelDeAcesso, string> = {
  admin: "Admin",
  lider: "Líder",
  professor: "Professor",
  pendente: "Pendente",
};

/** Níveis que um convite ou uma aprovação podem conceder. */
export const NIVEIS_CONCEDIVEIS = ["lider", "professor", "admin"] as const satisfies NivelDeAcesso[];

/** Quem foi desativado perde o acesso, mas a conta fica para o histórico. */
function nivelEfetivo(pessoa: Pessoa): NivelDeAcesso | null {
  return pessoa.ativo ? pessoa.nivel : null;
}

export function telaInicial(pessoa: Pessoa): "mural" | "aguardando-aprovacao" | "conta-desativada" {
  const nivel = nivelEfetivo(pessoa);
  if (nivel === null) return "conta-desativada";
  if (nivel === "pendente") return "aguardando-aprovacao";
  return "mural";
}

/** Quem enxerga qual conta. As políticas por linha de `public.perfis` seguem a mesma regra. */
export function podeVerPessoa(quem: Pessoa, alvo: Pessoa): boolean {
  if (quem.id === alvo.id) return true;
  const nivel = nivelEfetivo(quem);
  if (nivel === "admin") return true;
  if (nivel === "lider") return alvo.nivel !== "pendente";
  return false;
}

/** Convidar, aprovar, recusar, desativar e promover a Admin. */
export function podeGerenciarContas(quem: Pessoa): boolean {
  return nivelEfetivo(quem) === "admin";
}

/**
 * Desativar, reativar e promover a Admin valem para quem já foi aprovado; o Pendente é aprovado ou recusado.
 * O Admin não muda o próprio acesso, para não se trancar fora. As políticas de `public.perfis` seguem a mesma regra.
 */
export function podeMudarAcesso(quem: Pessoa, alvo: Pessoa): boolean {
  return podeGerenciarContas(quem) && quem.id !== alvo.id && alvo.nivel !== "pendente";
}

/**
 * O que impede conceder um nível com uma Função, num convite ou numa aprovação; `null` se nada impede.
 * Um Líder precisa de Função para criar Eventos; um Professor não é da Liderança e não tem Função.
 * O banco confere a mesma regra.
 */
export function erroNaConcessao(nivel: NivelDeAcesso, funcao: string | null): string | null {
  if (nivel === "lider" && !funcao) return "Um Líder precisa de uma Função.";
  if (nivel === "professor" && funcao) return "Um Professor não tem Função.";
  return null;
}
