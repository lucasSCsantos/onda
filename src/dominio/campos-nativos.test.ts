import { describe, expect, it } from "vitest";
import {
  CAMPOS_NATIVOS,
  erroNosNativos,
  lerNativos,
  nativosDe,
  NATIVOS_INICIAIS,
  NATIVOS_VISIVEIS,
  type NativosDaCategoria,
} from "./campos-nativos";
import { CATALOGO_INICIAL } from "./catalogo";
import { lerEdicao, lerEvento, type CategoriaDoEvento, type EntradaDeEvento, type Evento } from "./eventos";

const LIDERANCA = ["lucas"];

const categoria = (nativos: Partial<NativosDaCategoria>): CategoriaDoEvento => ({
  nome: "Teste",
  campos: [],
  nativos: { ...NATIVOS_VISIVEIS, ...nativos },
});

const entrada = (mudancas: Partial<EntradaDeEvento> = {}): EntradaDeEvento => ({
  titulo: "Evento",
  data: "2026-10-24",
  hora: "19:30",
  dataFim: "",
  horaFim: "",
  local: "Templo",
  responsavel: "lucas",
  status: "planejado",
  observacoes: "Levar som",
  link: "https://onda.app/x",
  campos: {},
  ...mudancas,
});

const ler = (resultado: ReturnType<typeof lerEvento>) => {
  if ("erro" in resultado) throw new Error(resultado.erro);
  return resultado.evento;
};
const erro = (resultado: ReturnType<typeof lerEvento>) => ("erro" in resultado ? resultado.erro : null);

describe("nativosDe", () => {
  it("sem configuração, todos os campos ficam visíveis", () => {
    expect(nativosDe({})).toEqual(NATIVOS_VISIVEIS);
  });

  it("completa o que faltar com visível", () => {
    expect(nativosDe({ nativos: { local: "obrigatorio" } })).toEqual({ ...NATIVOS_VISIVEIS, local: "obrigatorio" });
  });
});

describe("campo oculto", () => {
  const oculta = categoria({ local: "oculto", fim: "oculto", observacoes: "oculto", link: "oculto" });

  it("é ignorado ao criar, mesmo que o formulário o envie", () => {
    const lido = ler(lerEvento(entrada({ dataFim: "2026-10-24", horaFim: "21:00" }), oculta, LIDERANCA));
    expect(lido).toMatchObject({ local: "", observacoes: "", link: null, fim: null });
  });

  it("mantém o valor antigo ao editar, sem apagar", () => {
    const anterior: Evento = {
      ...ler(lerEvento(entrada(), categoria({}), LIDERANCA)),
      fim: new Date("2026-10-24T23:00:00Z"),
    };
    const editado = lerEdicao(
      entrada({ titulo: "Novo título", local: "", observacoes: "", link: "" }),
      oculta,
      LIDERANCA,
      { anterior, quem: { id: "lucas", nivel: "admin", ativo: true }, agora: new Date("2026-10-01T12:00:00Z") },
    );
    expect(ler(editado)).toMatchObject({
      titulo: "Novo título",
      local: "Templo",
      observacoes: "Levar som",
      link: "https://onda.app/x",
      fim: anterior.fim,
    });
  });

  it("o fim antigo não sobrevive a uma mudança de data que o deixaria antes do início", () => {
    const anterior: Evento = {
      ...ler(lerEvento(entrada(), categoria({}), LIDERANCA)),
      fim: new Date("2026-10-24T23:00:00Z"),
    };
    const editado = lerEdicao(entrada({ data: "2026-11-30" }), oculta, LIDERANCA, {
      anterior,
      quem: { id: "lucas", nivel: "admin", ativo: true },
      agora: new Date("2026-10-01T12:00:00Z"),
    });
    expect(ler(editado).fim).toBeNull();
  });
});

describe("campo obrigatório", () => {
  const exigente = categoria({ local: "obrigatorio", fim: "obrigatorio", observacoes: "obrigatorio", link: "obrigatorio" });
  const completa = entrada({ horaFim: "21:00" });

  it("aceita quando tudo está preenchido", () => {
    expect(ler(lerEvento(completa, exigente, LIDERANCA))).toMatchObject({ local: "Templo", observacoes: "Levar som" });
  });

  it.each([
    [{ local: "  " }, "Preencha “Local”."],
    [{ horaFim: "" }, "Preencha “Fim”."],
    [{ observacoes: "" }, "Preencha “Observações”."],
    [{ link: "" }, "Preencha “Link”."],
  ] as const)("recusa %j", (mudanca, mensagem) => {
    expect(erro(lerEvento({ ...completa, ...mudanca }, exigente, LIDERANCA))).toBe(mensagem);
  });
});

describe("campo visível", () => {
  it("continua opcional", () => {
    const lido = ler(lerEvento(entrada({ local: "", observacoes: "", link: "" }), categoria({}), LIDERANCA));
    expect(lido).toMatchObject({ local: "", observacoes: "", link: null });
  });
});

describe("configuração vinda do formulário", () => {
  it("lê um valor por campo e usa visível quando falta", () => {
    expect(lerNativos({ local: "obrigatorio", fim: "oculto" })).toEqual({
      ...NATIVOS_VISIVEIS,
      local: "obrigatorio",
      fim: "oculto",
    });
  });

  it("recusa um valor desconhecido", () => {
    expect(erroNosNativos(lerNativos({ local: "talvez" }))).toBe("Escolha oculto, visível ou obrigatório para “Local”.");
    expect(erroNosNativos(NATIVOS_VISIVEIS)).toBeNull();
  });
});

describe("auditoria das Categorias do catálogo inicial", () => {
  it("só configura Categorias que existem e campos nativos conhecidos", () => {
    const nomes = CATALOGO_INICIAL.categorias.map((c) => c.nome);
    for (const [nome, nativos] of Object.entries(NATIVOS_INICIAIS)) {
      expect(nomes, nome).toContain(nome);
      for (const campo of Object.keys(nativos)) expect(CAMPOS_NATIVOS as readonly string[], campo).toContain(campo);
    }
  });

  it("a Postagem usa só o início: sem local e sem fim", () => {
    expect(nativosDe({ nativos: NATIVOS_INICIAIS["Postagem"] })).toMatchObject({ local: "oculto", fim: "oculto" });
  });

  it("Evento extra e Acampamento exigem o local", () => {
    expect(NATIVOS_INICIAIS["Evento extra"].local).toBe("obrigatorio");
    expect(NATIVOS_INICIAIS["Acampamento"].local).toBe("obrigatorio");
  });

  it("não oculta o link onde a Categoria não tem outro campo de link", () => {
    for (const c of CATALOGO_INICIAL.categorias) {
      if (NATIVOS_INICIAIS[c.nome]?.link === "oculto") {
        expect(
          c.campos.some((campo) => campo.tipo === "link"),
          `${c.nome} oculta o link sem outro campo de link`,
        ).toBe(true);
      }
    }
  });

  it("não oculta as observações onde a Categoria não tem outro campo de texto longo", () => {
    for (const c of CATALOGO_INICIAL.categorias) {
      if (NATIVOS_INICIAIS[c.nome]?.observacoes === "oculto") {
        expect(
          c.campos.some((campo) => campo.tipo === "texto_longo"),
          `${c.nome} oculta as observações sem outro texto longo`,
        ).toBe(true);
      }
    }
  });

  it("o Pequeno grupo tem Link do material", () => {
    const pequenoGrupo = CATALOGO_INICIAL.categorias.find((c) => c.nome === "Pequeno grupo")!;
    expect(pequenoGrupo.campos.some((c) => c.nome === "Link do material" && c.tipo === "link")).toBe(true);
  });
});
