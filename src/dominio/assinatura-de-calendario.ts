import type { Pessoa } from "./acesso";
import { diaDoAniversario } from "./adolescentes";
import { podeVerAniversarios } from "./aniversarios";
import { diaDe, fimDoEvento, tituloDeExibicao, type Status } from "./eventos";
import { dataLocal, somarDias } from "./fuso";

// A Assinatura de calendário: o arquivo `.ics` que mostra os Eventos no calendário do celular. Aqui fica só a geração
// do texto e a leitura das opções; a rota busca os dados e o banco guarda o endereço (hash do token, limite de consultas).

/** Quantos dias para trás o arquivo vai: o calendário do celular não precisa de todo o histórico. */
export const DIAS_PARA_TRAS = 90;
/** Quantos dias para frente vão os aniversários (os Eventos vão até onde existirem). */
export const DIAS_PARA_FRENTE = 365;

/** De quando o arquivo traz Eventos: quem busca no banco usa este instante como começo. */
export const inicioDaJanela = (agora: Date): Date => somarDias(agora, -DIAS_PARA_TRAS);

export type Escopo = "todos" | "meus";

/** O que cada pessoa escolhe na própria assinatura. Sem Categorias escolhidas, valem todas. */
export type OpcoesDaAssinatura = { escopo: Escopo; categorias: string[]; aniversarios: boolean };

export const OPCOES_PADRAO: OpcoesDaAssinatura = { escopo: "todos", categorias: [], aniversarios: false };

/**
 * Confere e ajusta o que o formulário enviou. O Professor recebe só as próprias aulas e nunca aniversários; Categorias
 * que não existem caem, e todas marcadas é o mesmo que nenhuma. `categoriasExistentes` são os ids das Categorias.
 */
export function lerOpcoes(
  entrada: { escopo: string; categorias: readonly string[]; aniversarios: boolean },
  quem: Pessoa,
  categoriasExistentes: readonly string[],
): OpcoesDaAssinatura {
  const escolhidas = categoriasExistentes.filter((id) => entrada.categorias.includes(id));
  return {
    escopo: quem.nivel === "professor" ? "meus" : entrada.escopo === "meus" ? "meus" : "todos",
    categorias: escolhidas.length === categoriasExistentes.length ? [] : escolhidas,
    aniversarios: entrada.aniversarios && podeVerAniversarios(quem),
  };
}

/** O que o feed precisa saber de um Evento. `envolvidos` são o Responsável, o Professor e o Auxiliar; `professores`, só os dois últimos. */
export type EventoDoFeed = {
  id: string;
  titulo: string;
  numero: number | null;
  inicio: Date;
  fim: Date | null;
  diaInteiro: boolean;
  /** Já vazio quando a Categoria oculta o local. */
  local: string;
  status: Status;
  /** Já nulo quando a Categoria oculta o link. */
  link: string | null;
  categoriaId: string;
  envolvidos: string[];
  professores: string[];
};

export type AniversarianteDoFeed = { id: string; nome: string; nascimento: string };

/** Os Status que aparecem: Cancelado e Rascunho ficam de fora. */
const STATUS_NO_FEED: readonly Status[] = ["planejado", "confirmado", "realizado", "adiado"];

const DOMINIO_DOS_IDENTIFICADORES = "mural.onda";

export function gerarFeed({
  quem,
  opcoes,
  eventos,
  aniversariantes,
  agora,
}: {
  quem: Pessoa;
  opcoes: OpcoesDaAssinatura;
  eventos: readonly EventoDoFeed[];
  aniversariantes: readonly AniversarianteDoFeed[];
  agora: Date;
}): string {
  const ativo = quem.ativo && quem.nivel !== "pendente";
  const dosEventos = ativo ? eventos.filter((e) => entra(e, quem, opcoes)).map((e) => vevento(e, agora)) : [];
  const dosAniversarios = ativo && opcoes.aniversarios && podeVerAniversarios(quem) ? aniversarios(aniversariantes, agora) : [];
  return linhasParaTexto([
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ONDA//Mural ONDA//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Mural ONDA",
    "X-WR-TIMEZONE:America/Bahia",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...FUSO_BAHIA,
    ...dosEventos.flat(),
    ...dosAniversarios.flat(),
    "END:VCALENDAR",
  ]);
}

/** O fuso do Mural, sem horário de verão desde 2012: UTC-3 o ano todo. */
const FUSO_BAHIA = [
  "BEGIN:VTIMEZONE",
  "TZID:America/Bahia",
  "BEGIN:STANDARD",
  "DTSTART:19700101T000000",
  "TZOFFSETFROM:-0300",
  "TZOFFSETTO:-0300",
  "TZNAME:-03",
  "END:STANDARD",
  "END:VTIMEZONE",
];

function entra(evento: EventoDoFeed, quem: Pessoa, opcoes: OpcoesDaAssinatura): boolean {
  if (!STATUS_NO_FEED.includes(evento.status)) return false;
  // O Professor lê só as aulas em que foi colocado (`podeVerEvento`), e por isso sempre vale "meus".
  if (quem.nivel === "professor") return evento.professores.includes(quem.id);
  if (opcoes.escopo === "meus" && !evento.envolvidos.includes(quem.id)) return false;
  return opcoes.categorias.length === 0 || opcoes.categorias.includes(evento.categoriaId);
}

function vevento(evento: EventoDoFeed, agora: Date): string[] {
  const titulo = tituloDeExibicao({ titulo: evento.titulo, numero: evento.numero });
  return [
    "BEGIN:VEVENT",
    `UID:evento-${evento.id}@${DOMINIO_DOS_IDENTIFICADORES}`,
    `DTSTAMP:${instanteUtc(agora)}`,
    ...periodo(evento),
    `SUMMARY:${escapar(evento.status === "adiado" ? `[Adiado] ${titulo}` : titulo)}`,
    ...(evento.local ? [`LOCATION:${escapar(evento.local)}`] : []),
    ...(evento.link ? [`DESCRIPTION:${escapar(`Link: ${evento.link}`)}`] : []),
    "END:VEVENT",
  ];
}

function periodo({ inicio, fim, diaInteiro }: Pick<EventoDoFeed, "inicio" | "fim" | "diaInteiro">): string[] {
  if (diaInteiro) {
    return [`DTSTART;VALUE=DATE:${dataCompacta(diaDe(inicio))}`, `DTEND;VALUE=DATE:${dataCompacta(diaDe(fimDoEvento({ inicio, fim, diaInteiro })))}`];
  }
  return [`DTSTART;TZID=America/Bahia:${dataEHoraLocal(inicio)}`, ...(fim ? [`DTEND;TZID=America/Bahia:${dataEHoraLocal(fim)}`] : [])];
}

/** Um evento de dia inteiro por aniversário, com o primeiro nome só, dentro da janela. */
function aniversarios(pessoas: readonly AniversarianteDoFeed[], agora: Date): string[][] {
  const de = diaDe(inicioDaJanela(agora));
  const ate = diaDe(somarDias(agora, DIAS_PARA_FRENTE));
  const anos = Array.from({ length: Number(ate.slice(0, 4)) - Number(de.slice(0, 4)) + 1 }, (_, i) => Number(de.slice(0, 4)) + i);
  return pessoas.flatMap(({ id, nome, nascimento }) =>
    anos.flatMap((ano) => {
      const dia = diaDoAniversario(nascimento, ano);
      if (dia < de || dia > ate) return [];
      return [
        [
          "BEGIN:VEVENT",
          `UID:aniversario-${id}-${ano}@${DOMINIO_DOS_IDENTIFICADORES}`,
          `DTSTAMP:${instanteUtc(agora)}`,
          `DTSTART;VALUE=DATE:${dataCompacta(dia)}`,
          `DTEND;VALUE=DATE:${dataCompacta(diaSeguinte(dia))}`,
          `SUMMARY:${escapar(`Aniversário de ${nome.trim().split(/\s+/)[0]}`)}`,
          "END:VEVENT",
        ],
      ];
    }),
  );
}

// Formatos do iCalendar ---------------------------------------------------------------------------------------

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** `AAAA-MM-DD` como `AAAAMMDD`. */
const dataCompacta = (dia: string) => dia.replaceAll("-", "");

/** O dia civil seguinte a `AAAA-MM-DD`. */
function diaSeguinte(dia: string): string {
  const [ano, mes, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, d + 1)).toISOString().slice(0, 10);
}

/** `AAAAMMDDTHHMMSS`, no fuso do Mural. */
function dataEHoraLocal(instante: Date): string {
  const { ano, mes, dia } = dataLocal(instante);
  const hora = new Date(instante.getTime() - 3 * 60 * 60 * 1000);
  return `${ano}${doisDigitos(mes)}${doisDigitos(dia)}T${doisDigitos(hora.getUTCHours())}${doisDigitos(hora.getUTCMinutes())}${doisDigitos(hora.getUTCSeconds())}`;
}

/** `AAAAMMDDTHHMMSSZ`, em UTC. */
const instanteUtc = (instante: Date) => instante.toISOString().replace(/[-:]|\.\d{3}/g, "");

/** Texto de um valor: barra, vírgula, ponto e vírgula e quebra de linha têm significado no formato. */
const escapar = (texto: string) => texto.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const LIMITE_DA_LINHA = 75;

/** As linhas do arquivo, com CRLF no fim de cada uma e as longas dobradas em 75 bytes (a continuação começa com um espaço). */
function linhasParaTexto(linhas: string[]): string {
  return linhas.map((linha) => `${dobrar(linha)}\r\n`).join("");
}

function dobrar(linha: string): string {
  const pedacos: string[] = [];
  let atual = "";
  let bytes = 0;
  for (const caractere of linha) {
    const tamanho = new TextEncoder().encode(caractere).length;
    // A continuação gasta um byte com o espaço inicial.
    const limite = pedacos.length === 0 ? LIMITE_DA_LINHA : LIMITE_DA_LINHA - 1;
    if (bytes + tamanho > limite) {
      pedacos.push(atual);
      atual = "";
      bytes = 0;
    }
    atual += caractere;
    bytes += tamanho;
  }
  pedacos.push(atual);
  return pedacos.join("\r\n ");
}
