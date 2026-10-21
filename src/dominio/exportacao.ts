import { NOMES_DOS_NIVEIS, type NivelDeAcesso } from "./acesso";
import type { Celula } from "./csv";
import { NOMES_DOS_STATUS, statusNoMomento, type Status } from "./eventos";
import { dataLocal, horaLocal } from "./fuso";

export const TABELAS_EXPORTADAS = ["eventos", "adolescentes", "usuarios"] as const;
export type TabelaExportada = (typeof TABELAS_EXPORTADAS)[number];

export const NOMES_DAS_TABELAS: Record<TabelaExportada, string> = {
  eventos: "Eventos",
  adolescentes: "Adolescentes",
  usuarios: "Usuários",
};

export type TabelaCsv = { cabecalho: string[]; linhas: Celula[][] };

/** A tabela pedida na rota, ou `null` se não for uma das três. */
export const tabelaExportada = (texto: string): TabelaExportada | null =>
  (TABELAS_EXPORTADAS as readonly string[]).includes(texto) ? (texto as TabelaExportada) : null;

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** Dia civil de um instante no fuso do Mural, como `DD/MM/AAAA`. */
function dataDoInstante(instante: Date) {
  const { ano, mes, dia } = dataLocal(instante);
  return `${doisDigitos(dia)}/${doisDigitos(mes)}/${ano}`;
}

/** `onda-eventos-2026-10-21.csv`, com a data de hoje no fuso do Mural. */
export function nomeDoArquivo(tabela: TabelaExportada, agora: Date) {
  const { ano, mes, dia } = dataLocal(agora);
  return `onda-${tabela}-${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}.csv`;
}

/** `AAAA-MM-DD` como `DD/MM/AAAA`. */
const dataBr = (dia: string) => dia.split("-").reverse().join("/");

const dataEHora = (iso: string) => {
  const instante = new Date(iso);
  return `${dataDoInstante(instante)} ${horaLocal(instante)}`;
};

type EventoDoBanco = {
  titulo: string;
  categorias: { nome: string };
  inicio: string;
  fim: string | null;
  dia_inteiro: boolean;
  local: string;
  responsavel: { nome: string } | null;
  status: string;
  observacoes: string;
  link: string | null;
  serie_id: string | null;
  criado_em: string;
};

export function tabelaDeEventos(eventos: EventoDoBanco[], agora: Date): TabelaCsv {
  const quando = (iso: string, diaInteiro: boolean) => (diaInteiro ? dataDoInstante(new Date(iso)) : dataEHora(iso));
  return {
    cabecalho: ["Título", "Categoria", "Início", "Fim", "Dia inteiro", "Local", "Responsável", "Status", "Observações", "Link", "Em série", "Criado em"],
    linhas: eventos.map((e) => {
      const periodo = { inicio: new Date(e.inicio), fim: e.fim ? new Date(e.fim) : null, diaInteiro: e.dia_inteiro };
      const status = statusNoMomento({ ...periodo, status: e.status as Status }, agora);
      return [
        e.titulo,
        e.categorias.nome,
        quando(e.inicio, e.dia_inteiro),
        e.fim ? quando(e.fim, e.dia_inteiro) : "",
        e.dia_inteiro,
        e.local,
        e.responsavel?.nome ?? "",
        NOMES_DOS_STATUS[status],
        e.observacoes,
        e.link,
        e.serie_id !== null,
        dataEHora(e.criado_em),
      ];
    }),
  };
}

export function tabelaDeAdolescentes(
  adolescentes: { nome: string; nascimento: string; ativo: boolean; criado_em: string }[],
): TabelaCsv {
  return {
    cabecalho: ["Nome", "Nascimento", "Situação", "Cadastrado em"],
    linhas: adolescentes.map((a) => [a.nome, dataBr(a.nascimento), a.ativo ? "Ativo" : "Inativo", dataEHora(a.criado_em)]),
  };
}

export function tabelaDeUsuarios(
  usuarios: {
    nome: string;
    email: string;
    data_nascimento: string | null;
    nivel: NivelDeAcesso;
    ativo: boolean;
    criado_em: string;
    funcoes_das_pessoas: { funcoes: { nome: string } }[];
  }[],
): TabelaCsv {
  return {
    cabecalho: ["Nome", "E-mail", "Nascimento", "Nível de acesso", "Situação", "Funções", "Cadastrado em"],
    linhas: usuarios.map((u) => [
      u.nome,
      u.email,
      u.data_nascimento ? dataBr(u.data_nascimento) : "",
      NOMES_DOS_NIVEIS[u.nivel],
      u.ativo ? "Ativo" : "Desativado",
      u.funcoes_das_pessoas.map((f) => f.funcoes.nome).join(", "),
      dataEHora(u.criado_em),
    ]),
  };
}
