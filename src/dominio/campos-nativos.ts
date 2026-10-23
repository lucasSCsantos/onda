/** Os campos que todo Evento tem como coluna e que cada Categoria mostra, exige ou esconde (ADR 0008). */
export const CAMPOS_NATIVOS = ["local", "fim", "observacoes", "link"] as const;

export type CampoNativo = (typeof CAMPOS_NATIVOS)[number];

export const NOMES_DOS_NATIVOS: Record<CampoNativo, string> = {
  local: "Local",
  fim: "Fim",
  observacoes: "Observações",
  link: "Link",
};

/** Oculto não aparece nem é lido; visível é opcional; obrigatório precisa de valor. */
export const VISIBILIDADES = ["oculto", "visivel", "obrigatorio"] as const;

export type Visibilidade = (typeof VISIBILIDADES)[number];

export const NOMES_DAS_VISIBILIDADES: Record<Visibilidade, string> = {
  oculto: "Oculto",
  visivel: "Visível",
  obrigatorio: "Obrigatório",
};

export type NativosDaCategoria = Record<CampoNativo, Visibilidade>;

/** O padrão de toda Categoria: nada muda para quem já existe. */
export const NATIVOS_VISIVEIS: NativosDaCategoria = { local: "visivel", fim: "visivel", observacoes: "visivel", link: "visivel" };

/** A configuração de uma Categoria; o que faltar fica visível. */
export function nativosDe(categoria: { nativos?: Partial<NativosDaCategoria> }): NativosDaCategoria {
  return { ...NATIVOS_VISIVEIS, ...categoria.nativos };
}

/**
 * O que a auditoria do catálogo inicial definiu (a migração `campos_nativos` grava o mesmo conteúdo, e
 * `tests/rls/campos-nativos.test.ts` confere que o banco e este mapa batem). Só aparece o que difere de visível.
 *
 * - Link oculto onde a Categoria já tem o próprio campo de link (material, repertório, ata, arte, inscrição);
 *   Culto e Serviço não têm, então mantêm o link.
 * - Observações ocultas onde a Categoria já tem o próprio texto longo (liturgia, observações do ensaio, anotações,
 *   descrição da ação). A EBD fica com as observações, que o Professor edita.
 * - Postagem usa só o início, a data de publicação: sem local nem fim.
 * - Local obrigatório em Evento extra e Acampamento, que acontecem em algum lugar a combinar.
 */
export const NATIVOS_INICIAIS: Record<string, Partial<NativosDaCategoria>> = {
  EBD: { link: "oculto" },
  "Pequeno grupo": { link: "oculto" },
  Culto: { observacoes: "oculto" },
  "Ensaio de louvor": { observacoes: "oculto", link: "oculto" },
  "Reunião de liderança": { link: "oculto" },
  Postagem: { local: "oculto", fim: "oculto", link: "oculto" },
  "Evento extra": { local: "obrigatorio", link: "oculto" },
  Acampamento: { local: "obrigatorio", observacoes: "oculto", link: "oculto" },
  Serviço: { observacoes: "oculto" },
};

/** A configuração que o formulário da Categoria enviou, campo a campo; o que faltar fica visível. */
export function lerNativos(textos: Partial<Record<CampoNativo, string>>): NativosDaCategoria {
  const lidos = { ...NATIVOS_VISIVEIS };
  for (const campo of CAMPOS_NATIVOS) {
    const texto = textos[campo];
    if (texto !== undefined && texto !== "") lidos[campo] = texto as Visibilidade;
  }
  return lidos;
}

/** O que impede salvar a configuração; `null` se nada impede. O banco confere o mesmo. */
export function erroNosNativos(nativos: NativosDaCategoria): string | null {
  for (const campo of CAMPOS_NATIVOS) {
    if (!VISIBILIDADES.includes(nativos[campo])) {
      return `Escolha oculto, visível ou obrigatório para “${NOMES_DOS_NATIVOS[campo]}”.`;
    }
  }
  return null;
}
