import { describe, expect, it } from "vitest";
import { nomeDoArquivo, tabelaDeAdolescentes, tabelaDeEventos, tabelaDeUsuarios, tabelaExportada } from "./exportacao";

const agora = new Date("2026-10-21T22:00:00-03:00");

describe("tabelaExportada", () => {
  it("só aceita as três tabelas", () => {
    expect(tabelaExportada("eventos")).toBe("eventos");
    expect(tabelaExportada("adolescentes")).toBe("adolescentes");
    expect(tabelaExportada("usuarios")).toBe("usuarios");
    expect(tabelaExportada("perfis")).toBeNull();
    expect(tabelaExportada("")).toBeNull();
  });
});

describe("nomeDoArquivo", () => {
  it("leva a tabela e a data de hoje no fuso do Mural", () => {
    expect(nomeDoArquivo("eventos", agora)).toBe("onda-eventos-2026-10-21.csv");
  });
});

describe("tabelaDeEventos", () => {
  const evento = {
    titulo: "EBD",
    categorias: { nome: "EBD" },
    inicio: "2026-10-24T22:00:00Z",
    fim: "2026-10-25T00:00:00Z",
    dia_inteiro: false,
    local: "Templo",
    responsavel: { nome: "Carol" },
    status: "planejado",
    observacoes: "Trazer bíblia",
    link: null,
    serie_id: "s1",
    criado_em: "2026-10-20T12:00:00Z",
  };

  it("a Ocorrência de Série sai com o título de exibição; o avulso, com o digitado", () => {
    const titulos = tabelaDeEventos([{ ...evento, numero_da_ocorrencia: 3 }, { ...evento, numero_da_ocorrencia: null }], agora).linhas.map((l) => l[0]);
    expect(titulos).toEqual(["EBD · 3", "EBD"]);
  });

  it("mostra datas e horas no fuso do Mural e o Status por extenso", () => {
    const { cabecalho, linhas } = tabelaDeEventos([evento], agora);
    expect(cabecalho).toEqual([
      "Título", "Categoria", "Início", "Fim", "Dia inteiro", "Local", "Responsável", "Status", "Observações", "Link", "Em série", "Criado em",
    ]);
    expect(linhas).toEqual([
      ["EBD", "EBD", "24/10/2026 19:00", "24/10/2026 21:00", false, "Templo", "Carol", "Planejado", "Trazer bíblia", null, true, "20/10/2026 09:00"],
    ]);
  });

  it("Evento de dia inteiro mostra só as datas; sem Responsável fica vazio; Confirmado vencido sai como Realizado", () => {
    const { linhas } = tabelaDeEventos(
      [{ ...evento, dia_inteiro: true, inicio: "2026-10-01T03:00:00Z", fim: "2026-10-02T03:00:00Z", responsavel: null, status: "confirmado", serie_id: null }],
      agora,
    );
    expect(linhas[0].slice(2, 4)).toEqual(["01/10/2026", "02/10/2026"]);
    expect(linhas[0][6]).toBe("");
    expect(linhas[0][7]).toBe("Realizado");
    expect(linhas[0][10]).toBe(false);
  });
});

describe("tabelaDeAdolescentes", () => {
  it("nascimento em dd/mm/aaaa e situação por extenso", () => {
    const { cabecalho, linhas } = tabelaDeAdolescentes([
      { nome: "Lia", nascimento: "2010-05-09", ativo: true, criado_em: "2026-01-02T15:00:00Z" },
      { nome: "Bia", nascimento: "2011-12-31", ativo: false, criado_em: "2026-01-02T15:00:00Z" },
    ]);
    expect(cabecalho).toEqual(["Nome", "Nascimento", "Situação", "Cadastrado em"]);
    expect(linhas).toEqual([
      ["Lia", "09/05/2010", "Ativo", "02/01/2026 12:00"],
      ["Bia", "31/12/2011", "Inativo", "02/01/2026 12:00"],
    ]);
  });
});

describe("tabelaDeUsuarios", () => {
  it("nível por extenso, Funções juntas e conta desativada", () => {
    const { cabecalho, linhas } = tabelaDeUsuarios([
      {
        nome: "Carol",
        email: "c@x.com",
        data_nascimento: "1990-03-04",
        nivel: "lider",
        ativo: true,
        criado_em: "2026-01-02T15:00:00Z",
        funcoes_das_pessoas: [{ funcoes: { nome: "Líder do louvor" } }, { funcoes: { nome: "Co-líder" } }],
      },
      { nome: "Saiu", email: "s@x.com", data_nascimento: null, nivel: "professor", ativo: false, criado_em: "2026-01-02T15:00:00Z", funcoes_das_pessoas: [] },
    ]);
    expect(cabecalho).toEqual(["Nome", "E-mail", "Nascimento", "Nível de acesso", "Situação", "Funções", "Cadastrado em"]);
    expect(linhas).toEqual([
      ["Carol", "c@x.com", "04/03/1990", "Líder", "Ativo", "Líder do louvor, Co-líder", "02/01/2026 12:00"],
      ["Saiu", "s@x.com", "", "Professor", "Desativado", "", "02/01/2026 12:00"],
    ]);
  });
});
