import type { NivelDeAcesso, Pessoa } from "./acesso";

/** A Área Geral é a liderança geral do ministério: quem tem Função nela cria todas as Categorias. */
export const AREA_GERAL = "Geral";

/** Os dez tipos fixos de campo específico de uma Categoria (ADR 0002). */
export const TIPOS_DE_CAMPO = [
  "texto_curto",
  "texto_longo",
  "link",
  "valor",
  "data",
  "data_hora",
  "escolha",
  "lista",
  "pessoa",
  "checklist",
] as const;

export type TipoDeCampo = (typeof TIPOS_DE_CAMPO)[number];

export const NOMES_DOS_TIPOS: Record<TipoDeCampo, string> = {
  texto_curto: "Texto curto",
  texto_longo: "Texto longo",
  link: "Link",
  valor: "Valor em reais",
  data: "Data",
  data_hora: "Data e hora",
  escolha: "Escolha de uma opção",
  lista: "Lista de itens",
  pessoa: "Pessoa",
  checklist: "Checklist",
};

/** Um campo específico de uma Categoria. `opcoes` só vale para o tipo escolha. */
export type CampoDaCategoria = { nome: string; tipo: TipoDeCampo; obrigatorio: boolean; opcoes: string[] };

/** Um campo específico já gravado, com o id que identifica o valor dele num Evento. */
export type CampoCadastrado = CampoDaCategoria & { id: string };

export type Categoria = { nome: string; area: string; cor: string; campos: CampoDaCategoria[] };

const campo = (nome: string, tipo: TipoDeCampo, obrigatorio = false, opcoes: string[] = []): CampoDaCategoria => ({
  nome,
  tipo,
  obrigatorio,
  opcoes,
});

/**
 * O que o sistema traz no primeiro dia. A migração `catalogo` grava o mesmo conteúdo,
 * e `tests/rls/catalogo.test.ts` confere que o banco e este catálogo batem.
 */
export const CATALOGO_INICIAL = {
  areas: [AREA_GERAL, "Ensino", "Programação", "Comunicação", "Louvor", "Acampamento"],
  funcoes: [
    { nome: "Líder do ministério", area: AREA_GERAL },
    { nome: "Co-líder do ministério", area: AREA_GERAL },
    { nome: "Líder do ensino", area: "Ensino" },
    { nome: "Líder do louvor", area: "Louvor" },
    { nome: "Líder do louvor dos adolescentes", area: "Louvor" },
    { nome: "Líder de comunicação e mídia", area: "Comunicação" },
    { nome: "Líder de integração e programação", area: "Programação" },
    { nome: "Co-líder de integração e programação", area: "Programação" },
  ],
  categorias: [
    {
      nome: "EBD",
      area: "Ensino",
      cor: "#2f6fb5",
      campos: [
        campo("Tema", "texto_curto", true),
        campo("Professor", "pessoa"),
        campo("Auxiliar", "pessoa"),
        campo("Link do material", "link"),
      ],
    },
    {
      nome: "Pequeno grupo",
      area: "Ensino",
      cor: "#2a9d8f",
      campos: [campo("Grupo", "escolha", true, ["Grupo único"]), campo("Anfitrião", "texto_curto"), campo("Tema", "texto_curto")],
    },
    {
      nome: "Culto",
      area: "Programação",
      cor: "#6a4c93",
      campos: [campo("Quem prega", "texto_curto"), campo("Observações da liturgia", "texto_longo")],
    },
    {
      nome: "Ensaio de louvor",
      area: "Louvor",
      cor: "#c2407a",
      campos: [campo("Repertório", "link"), campo("Observações", "texto_longo")],
    },
    {
      nome: "Reunião de liderança",
      area: AREA_GERAL,
      cor: "#1d3557",
      campos: [campo("Pauta", "texto_longo"), campo("Link da ata", "link")],
    },
    {
      nome: "Postagem",
      area: "Comunicação",
      cor: "#e07a3f",
      campos: [
        campo("Plataforma", "escolha", true, ["Instagram", "WhatsApp", "YouTube", "Outra"]),
        campo("Link da arte ou do post", "link"),
      ],
    },
    {
      nome: "Evento extra",
      area: "Programação",
      cor: "#c9a227",
      campos: [
        campo("Tipo", "escolha", true, ["Gincana", "Intercâmbio", "Campeonato", "Outro"]),
        campo("Parceiro", "texto_curto"),
        campo("Valor", "valor"),
        campo("Link de inscrição", "link"),
        campo("O que levar", "lista", true),
      ],
    },
    {
      nome: "Acampamento",
      area: "Acampamento",
      cor: "#3a7d44",
      campos: [
        campo("Tema", "texto_curto"),
        campo("Valor", "valor"),
        campo("Link de inscrição", "link"),
        campo("Link da autorização dos pais", "link"),
        campo("Itens a levar", "lista"),
        campo("Checklist", "checklist"),
        campo("Anotações", "texto_longo"),
        campo("Link dos materiais", "link"),
      ],
    },
    {
      nome: "Serviço",
      area: "Programação",
      cor: "#8d6e63",
      campos: [campo("Descrição da ação", "texto_longo", true)],
    },
  ] satisfies Categoria[],
};

const normalizado = (texto: string) => texto.trim().toLocaleLowerCase("pt-BR");

/** O que impede salvar um campo específico; `null` se nada impede. O banco confere o tipo e as opções. */
export function erroNoCampo(campo: CampoDaCategoria): string | null {
  if (!campo.nome.trim()) return "Dê um nome ao campo.";
  if (!TIPOS_DE_CAMPO.includes(campo.tipo)) return "Escolha um tipo de campo.";
  if (campo.tipo !== "escolha") return campo.opcoes.length > 0 ? "Só o tipo escolha tem opções." : null;
  if (campo.opcoes.length === 0) return "Uma escolha precisa de pelo menos uma opção.";
  if (campo.opcoes.some((opcao) => !opcao.trim())) return "Preencha todas as opções.";
  if (new Set(campo.opcoes.map(normalizado)).size !== campo.opcoes.length) return "As opções não podem se repetir.";
  return null;
}

/** Os campos de uma Categoria, cada um válido e sem nomes repetidos. */
export function erroNosCampos(campos: CampoDaCategoria[]): string | null {
  const vistos = new Set<string>();
  for (const campo of campos) {
    const erro = erroNoCampo(campo);
    if (erro) return erro;
    const nome = normalizado(campo.nome);
    if (vistos.has(nome)) return `Já existe um campo chamado “${nome}”.`;
    vistos.add(nome);
  }
  return null;
}

const COR = /^#[0-9a-f]{6}$/i;

/** O que impede salvar uma Categoria (sem os campos); `null` se nada impede. */
export function erroNaCategoria(categoria: { nome: string; area: string; cor: string }): string | null {
  if (!categoria.nome.trim()) return "Dê um nome à Categoria.";
  if (!categoria.area) return "Escolha a Área da Categoria.";
  if (!COR.test(categoria.cor)) return "Escolha uma cor válida.";
  return null;
}

/**
 * O que impede dar estas Funções a uma pessoa; `null` se nada impede. Só a Liderança tem Funções,
 * e um Líder precisa de ao menos uma para criar Eventos. A função `public.definir_funcoes` confere a mesma regra.
 */
export function erroNasFuncoes(nivel: NivelDeAcesso, funcoes: readonly string[]): string | null {
  if (nivel === "lider" && funcoes.length === 0) return "Um Líder precisa de uma Função.";
  if (!temFuncoes(nivel) && funcoes.length > 0) return "Só a Liderança tem Funções.";
  return null;
}

/** Só a Liderança (Admin e Líder) tem Funções. */
export function temFuncoes(nivel: NivelDeAcesso): boolean {
  return nivel === "admin" || nivel === "lider";
}

/** O que impede salvar uma Função; `null` se nada impede. */
export function erroNaFuncao(funcao: { nome: string; area: string }): string | null {
  if (!funcao.nome.trim()) return "Dê um nome à Função.";
  if (!funcao.area) return "Escolha a Área da Função.";
  return null;
}

/**
 * Quem cria Evento (e Série) de uma Categoria (ADR 0001): o Admin cria todas; o Líder cria as Categorias
 * das Áreas das suas Funções, e uma Função Geral cria todas. Professor, Pendente e desativados não criam.
 * `areas` são as Áreas das Funções da pessoa. A função `public.pode_criar_evento` no banco segue a mesma regra.
 */
export function podeCriarEvento(quem: Pessoa, areas: readonly string[], categoria: { area: string }): boolean {
  if (!quem.ativo) return false;
  if (quem.nivel === "admin") return true;
  if (quem.nivel !== "lider") return false;
  return areas.includes(AREA_GERAL) || areas.includes(categoria.area);
}

export function categoriasQuePodeCriar<C extends { area: string }>(quem: Pessoa, areas: readonly string[], categorias: C[]): C[] {
  return categorias.filter((categoria) => podeCriarEvento(quem, areas, categoria));
}
