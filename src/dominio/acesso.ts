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

export function eLideranca(pessoa: Pessoa) {
  const nivel = nivelEfetivo(pessoa);
  return nivel === "admin" || nivel === "lider";
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
