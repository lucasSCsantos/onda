"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  DIAS_DA_SEMANA,
  NOMES_DOS_MESES,
  dataParaExibir,
  dividirDataEHora,
  escolherNoIntervalo,
  estaNoIntervalo,
  formatarData,
  horasDoDia,
  juntarDataEHora,
  lerData,
  lerDataDigitada,
  lerHoraDigitada,
  montarGrade,
  mudarMes,
  paginaDeAnos,
  somarDiasA,
  somarMesesA,
  arredondarHora,
  lerHora,
  formatarHora,
  type Intervalo,
} from "@/dominio/datas-e-horas";
import { dataLocal } from "@/dominio/fuso";
import { Erro, Painel, useFecharAoTocarFora } from "./selecao";

const CAIXA =
  "flex min-h-11 w-full items-stretch rounded-lg border bg-superficie text-base font-normal transition-colors focus-within:border-marca focus-within:ring-2 focus-within:ring-marca/30 has-disabled:opacity-60";
const ENTRADA = "min-w-0 flex-1 rounded-lg bg-transparent px-3 py-2 outline-none disabled:cursor-not-allowed";
const BOTAO_DA_CAIXA =
  "toque flex min-w-11 shrink-0 items-center justify-center rounded-lg text-texto-suave outline-none hover:text-texto focus-visible:ring-2 focus-visible:ring-marca/40 disabled:cursor-not-allowed";

/** Hoje, no fuso do Mural. */
function hojeLocal() {
  return formatarData(dataLocal(new Date()));
}

const nomeDoMes = (mes: number) => NOMES_DOS_MESES[mes - 1];

function porExtenso(data: string) {
  const d = lerData(data);
  return d ? `${d.dia} de ${nomeDoMes(d.mes)} de ${d.ano}` : data;
}

/** Volta ao valor inicial quando o formulário é limpo (os formulários com Server Action limpam ao terminar). */
function useAoLimparFormulario(ref: React.RefObject<HTMLElement | null>, restaurar: () => void) {
  useEffect(() => {
    const formulario = ref.current?.closest("form");
    if (!formulario) return;
    formulario.addEventListener("reset", restaurar);
    return () => formulario.removeEventListener("reset", restaurar);
  }, [ref, restaurar]);
}

/** A superfície do seletor: painel inferior no celular e painel flutuante no desktop. Esc fecha. */
function Superficie({ rotulo, aoFechar, children }: { rotulo: string; aoFechar: () => void; children: React.ReactNode }) {
  return (
    <>
      <div aria-hidden className="fixed inset-0 z-40 bg-black/40 sm:hidden" onClick={aoFechar} />
      <div
        role="dialog"
        aria-label={rotulo}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          e.preventDefault();
          e.stopPropagation();
          aoFechar();
        }}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col gap-2 overflow-y-auto rounded-t-2xl border border-borda bg-superficie p-3 pb-5 shadow-2xl sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:bottom-auto sm:mt-1 sm:w-[21rem] sm:rounded-xl sm:p-2 sm:pb-2 sm:shadow-lg"
      >
        <div aria-hidden className="mx-auto h-1 w-10 shrink-0 rounded-full bg-borda sm:hidden" />
        {children}
      </div>
    </>
  );
}

type Vista = "dias" | "meses" | "anos";

/**
 * O calendário: dias em pt-BR com a semana na segunda-feira, hoje destacado, dias de fora do mês esmaecidos, mês e ano
 * navegáveis (toque no título) e atalho "Hoje". No modo `intervalo`, dois toques marcam início e fim.
 */
function Calendario({
  modo,
  valor,
  intervalo,
  aoEscolher,
  aoLimpar,
}: {
  modo: "data" | "intervalo";
  valor: string;
  intervalo: Intervalo;
  aoEscolher: (data: string) => void;
  aoLimpar?: () => void;
}) {
  const hoje = hojeLocal();
  const referencia = (modo === "data" ? valor : intervalo.inicio) || hoje;
  const inicial = lerData(referencia) ?? lerData(hoje)!;
  const [visivel, setVisivel] = useState({ ano: inicial.ano, mes: inicial.mes });
  const [foco, setFoco] = useState(referencia);
  const [vista, setVista] = useState<Vista>("dias");
  const [paginaDosAnos, setPaginaDosAnos] = useState(inicial.ano);
  const grade = montarGrade(visivel.ano, visivel.mes);
  const celulas = grade.flat();
  const tabela = useRef<HTMLTableElement>(null);
  const moverFoco = useRef(true);
  const painelDeAnos = useRef<HTMLDivElement>(null);

  // Só uma célula entra na ordem de Tab (a do foco, ou o dia 1 se o foco saiu do mês mostrado).
  const focavel = celulas.some((c) => c.data === foco) ? foco : formatarData({ ano: visivel.ano, mes: visivel.mes, dia: 1 });

  useEffect(() => {
    if (vista === "dias" && moverFoco.current) {
      tabela.current?.querySelector<HTMLElement>(`[data-data="${focavel}"]`)?.focus();
      moverFoco.current = false;
    }
    if (vista !== "dias") painelDeAnos.current?.querySelector<HTMLElement>("[data-atual='true']")?.focus();
  }, [focavel, vista, visivel]);

  function irPara(data: string) {
    const d = lerData(data);
    if (!d) return;
    moverFoco.current = true;
    setFoco(data);
    setVisivel({ ano: d.ano, mes: d.mes });
  }

  function aoTeclar(e: React.KeyboardEvent) {
    const passos: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const semana = grade.find((s) => s.some((c) => c.data === focavel)) ?? grade[0];
    let destino: string | null = null;
    if (e.key in passos) destino = somarDiasA(focavel, passos[e.key]);
    else if (e.key === "Home") destino = semana[0].data;
    else if (e.key === "End") destino = semana[6].data;
    else if (e.key === "PageUp") destino = somarMesesA(focavel, e.shiftKey ? -12 : -1);
    else if (e.key === "PageDown") destino = somarMesesA(focavel, e.shiftKey ? 12 : 1);
    if (!destino) return;
    e.preventDefault();
    irPara(destino);
  }

  function mudarVisivel(delta: number) {
    setVisivel((v) => mudarMes(v.ano, v.mes, delta));
  }

  const rotuloDoMes = `${nomeDoMes(visivel.mes)} de ${visivel.ano}`;
  const BOTAO_DE_NAVEGAR = "toque flex size-11 items-center justify-center rounded-lg hover:bg-fundo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca/40";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          aria-label={vista === "anos" ? "Anos anteriores" : vista === "meses" ? "Ano anterior" : "Mês anterior"}
          onClick={() => {
            if (vista === "anos") setPaginaDosAnos((a) => a - 12);
            else if (vista === "meses") setVisivel((v) => ({ ...v, ano: v.ano - 1 }));
            else mudarVisivel(-1);
          }}
          className={BOTAO_DE_NAVEGAR}
        >
          <ChevronLeft aria-hidden className="size-5" />
        </button>
        <button
          type="button"
          aria-live="polite"
          aria-expanded={vista !== "dias"}
          aria-label={vista === "dias" ? `${rotuloDoMes}, escolher mês e ano` : rotuloDoMes}
          onClick={() => {
            setPaginaDosAnos(visivel.ano);
            setVista(vista === "dias" ? "anos" : "dias");
          }}
          className="toque min-h-11 flex-1 rounded-lg px-2 text-base font-semibold capitalize hover:bg-fundo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca/40"
        >
          {vista === "anos" ? `${paginaDeAnos(paginaDosAnos)[0]} – ${paginaDeAnos(paginaDosAnos)[11]}` : vista === "meses" ? visivel.ano : rotuloDoMes}
        </button>
        <button
          type="button"
          aria-label={vista === "anos" ? "Próximos anos" : vista === "meses" ? "Próximo ano" : "Próximo mês"}
          onClick={() => {
            if (vista === "anos") setPaginaDosAnos((a) => a + 12);
            else if (vista === "meses") setVisivel((v) => ({ ...v, ano: v.ano + 1 }));
            else mudarVisivel(1);
          }}
          className={BOTAO_DE_NAVEGAR}
        >
          <ChevronRight aria-hidden className="size-5" />
        </button>
      </div>

      {vista === "dias" ? (
        <table ref={tabela} role="grid" aria-label={rotuloDoMes} onKeyDown={aoTeclar} className="w-full border-separate border-spacing-0 text-center">
          <thead>
            <tr>
              {DIAS_DA_SEMANA.map((dia) => (
                <th key={dia} scope="col" className="h-8 text-xs font-medium uppercase text-texto-suave">
                  {dia}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grade.map((semana) => (
              <tr key={semana[0].data}>
                {semana.map((celula) => {
                  const noPeriodo = modo === "intervalo" && estaNoIntervalo(celula.data, intervalo);
                  const ponta = modo === "intervalo" ? celula.data === intervalo.inicio || celula.data === intervalo.fim : celula.data === valor;
                  const eHoje = celula.data === hoje;
                  return (
                    <td key={celula.data} role="gridcell" aria-selected={ponta || noPeriodo} className={`p-0 ${noPeriodo && !ponta ? "bg-marca/15" : ""}`}>
                      <button
                        type="button"
                        data-data={celula.data}
                        tabIndex={celula.data === focavel ? 0 : -1}
                        aria-label={`${porExtenso(celula.data)}${eHoje ? ", hoje" : ""}`}
                        aria-current={eHoje ? "date" : undefined}
                        onClick={() => {
                          setFoco(celula.data);
                          aoEscolher(celula.data);
                        }}
                        className={`toque mx-auto flex size-11 items-center justify-center rounded-lg text-base outline-none focus-visible:ring-2 focus-visible:ring-marca/60 ${
                          ponta
                            ? "bg-marca font-semibold text-marca-texto"
                            : `hover:bg-fundo ${celula.doMes ? "" : "text-texto-suave/60"} ${eHoje ? "font-semibold text-marca ring-1 ring-marca" : ""}`
                        }`}
                      >
                        {celula.dia}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div ref={painelDeAnos} className="grid grid-cols-3 gap-1">
          {vista === "anos"
            ? paginaDeAnos(paginaDosAnos).map((ano) => (
                <button
                  key={ano}
                  type="button"
                  data-atual={ano === visivel.ano}
                  aria-pressed={ano === visivel.ano}
                  onClick={() => {
                    setVisivel((v) => ({ ...v, ano }));
                    setVista("meses");
                  }}
                  className="toque min-h-11 rounded-lg text-base hover:bg-fundo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca/40 aria-pressed:bg-marca aria-pressed:font-semibold aria-pressed:text-marca-texto"
                >
                  {ano}
                </button>
              ))
            : NOMES_DOS_MESES.map((nome, i) => (
                <button
                  key={nome}
                  type="button"
                  data-atual={i + 1 === visivel.mes}
                  aria-pressed={i + 1 === visivel.mes}
                  onClick={() => {
                    moverFoco.current = true;
                    setVisivel((v) => ({ ...v, mes: i + 1 }));
                    setFoco(formatarData({ ano: visivel.ano, mes: i + 1, dia: 1 }));
                    setVista("dias");
                  }}
                  className="toque min-h-11 rounded-lg text-base capitalize hover:bg-fundo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca/40 aria-pressed:bg-marca aria-pressed:font-semibold aria-pressed:text-marca-texto"
                >
                  {nome.slice(0, 3)}
                </button>
              ))}
        </div>
      )}

      <div className="mt-1 flex items-center justify-between gap-2 border-t border-borda pt-2">
        <button type="button" onClick={() => aoEscolher(hoje)} className="botao-discreto">
          Hoje
        </button>
        {aoLimpar && (
          <button type="button" onClick={aoLimpar} className="botao-discreto">
            Limpar
          </button>
        )}
      </div>
    </div>
  );
}

type ComumDeData = {
  rotulo: string;
  required?: boolean;
  disabled?: boolean;
  /** Mensagem de erro, ligada ao campo e anunciada. */
  erro?: string;
};

/**
 * Data: campo digitável (`dd/mm/aaaa`) com calendário em painel. Envia `AAAA-MM-DD` num campo com o mesmo `name`, como o
 * `type="date"` de antes; vazio é vazio. Controlado (`value` + `onChange`) ou solto (`defaultValue`).
 */
export function CampoDeData({
  rotulo,
  name,
  defaultValue = "",
  value,
  onChange,
  required,
  disabled,
  erro,
  autoComplete,
  aoFocar,
}: ComumDeData & {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (data: string) => void;
  autoComplete?: string;
  aoFocar?: () => void;
}) {
  const [data, setData] = useState(value ?? defaultValue);
  const [texto, setTexto] = useState(dataParaExibir(value ?? defaultValue));
  const [invalida, setInvalida] = useState(false);
  // Um `value` que muda por fora (a URL, por exemplo) vale; entre uma escolha e essa volta, o campo já mostra a escolha.
  const [valorAnterior, setValorAnterior] = useState(value);
  if (value !== valorAnterior) {
    setValorAnterior(value);
    if (value !== undefined && value !== data) {
      setData(value);
      setTexto(dataParaExibir(value));
      setInvalida(false);
    }
  }
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const id = useId();
  const idDoErro = `${id}-erro`;

  const fechar = useCallback(() => setAberto(false), []);
  useFecharAoTocarFora(aberto, raiz, fechar);
  useAoLimparFormulario(raiz, () => {
    const inicial = value ?? defaultValue;
    setData(inicial);
    setTexto(dataParaExibir(inicial));
    setInvalida(false);
  });

  const mensagem = erro ?? (invalida ? "Data inválida. Escreva dia/mês/ano, como 27/10/2026." : undefined);

  // O aviso nativo de "preencha este campo" cobre o vazio; uma data digitada errada ganha o próprio aviso.
  useEffect(() => {
    entrada.current?.setCustomValidity(invalida ? "Data inválida. Escreva dia/mês/ano, como 27/10/2026." : "");
  }, [invalida]);

  function mudar(proxima: string) {
    setData(proxima);
    onChange?.(proxima);
  }

  function digitar(digitado: string) {
    setTexto(digitado);
    const lida = lerDataDigitada(digitado);
    if (lida !== null) {
      setInvalida(false);
      mudar(lida);
    } else if (data) {
      mudar("");
    }
  }

  function escolher(proxima: string) {
    mudar(proxima);
    setTexto(dataParaExibir(proxima));
    setInvalida(false);
    setAberto(false);
    botao.current?.focus();
  }

  return (
    <div ref={raiz} className="relative flex flex-col gap-1.5 text-sm font-medium">
      <label htmlFor={`${id}-campo`}>{rotulo}</label>
      <div className={`${CAIXA} ${mensagem ? "border-erro" : "border-borda"}`}>
        <input
          id={`${id}-campo`}
          ref={entrada}
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          autoComplete={autoComplete}
          value={texto}
          required={required}
          disabled={disabled}
          aria-invalid={mensagem ? true : undefined}
          aria-describedby={mensagem ? idDoErro : undefined}
          onFocus={aoFocar}
          onChange={(e) => digitar(e.target.value)}
          onBlur={() => {
            const lida = lerDataDigitada(texto);
            setInvalida(lida === null);
            if (lida) setTexto(dataParaExibir(lida));
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && !disabled) {
              e.preventDefault();
              setAberto(true);
            }
          }}
          className={ENTRADA}
        />
        <button
          ref={botao}
          type="button"
          aria-label="Abrir calendário"
          aria-haspopup="dialog"
          aria-expanded={aberto}
          disabled={disabled}
          onClick={() => setAberto(!aberto)}
          className={BOTAO_DA_CAIXA}
        >
          <CalendarDays aria-hidden className="size-5" />
        </button>
      </div>
      {name && <input type="hidden" name={name} value={data} disabled={disabled} />}
      {aberto && (
        <Superficie
          rotulo={`Calendário de ${rotulo}`}
          aoFechar={() => {
            setAberto(false);
            botao.current?.focus();
          }}
        >
          <Calendario
            modo="data"
            valor={data}
            intervalo={{ inicio: "", fim: "" }}
            aoEscolher={escolher}
            aoLimpar={required ? undefined : () => escolher("")}
          />
        </Superficie>
      )}
      <Erro id={idDoErro} erro={mensagem} />
    </div>
  );
}

/**
 * Período (início e fim) num único calendário. Envia as duas datas em campos com os nomes dados; vazio é vazio. Dois
 * toques marcam o período e fecham o painel.
 */
export function CampoDeIntervalo({
  rotulo,
  nomeDoInicio,
  nomeDoFim,
  defaultInicio = "",
  defaultFim = "",
  disabled,
  erro,
}: Omit<ComumDeData, "required"> & {
  nomeDoInicio: string;
  nomeDoFim: string;
  defaultInicio?: string;
  defaultFim?: string;
}) {
  const [intervalo, setIntervalo] = useState<Intervalo>({ inicio: defaultInicio, fim: defaultFim });
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const id = useId();
  const idDoErro = `${id}-erro`;

  const fechar = useCallback(() => setAberto(false), []);
  useFecharAoTocarFora(aberto, raiz, fechar);
  useAoLimparFormulario(raiz, () => setIntervalo({ inicio: defaultInicio, fim: defaultFim }));

  function escolher(data: string) {
    const proximo = escolherNoIntervalo(intervalo, data);
    setIntervalo(proximo);
    if (proximo.fim) {
      setAberto(false);
      botao.current?.focus();
    }
  }

  const { inicio, fim } = intervalo;
  const resumo = inicio ? `${dataParaExibir(inicio)} até ${dataParaExibir(fim || inicio)}` : "";

  return (
    <div ref={raiz} className="relative flex flex-col gap-1.5 text-sm font-medium">
      <span id={`${id}-rotulo`}>{rotulo}</span>
      <button
        ref={botao}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-labelledby={`${id}-rotulo ${id}-valor`}
        aria-describedby={erro ? idDoErro : undefined}
        disabled={disabled}
        onClick={() => setAberto(!aberto)}
        className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border bg-superficie px-3 py-2 text-left text-base font-normal outline-none transition-colors hover:border-texto-suave focus-visible:border-marca focus-visible:ring-2 focus-visible:ring-marca/30 disabled:cursor-not-allowed disabled:opacity-60 ${erro ? "border-erro" : "border-borda"}`}
      >
        <span id={`${id}-valor`} className={resumo ? "" : "text-texto-suave"}>
          {resumo || "Qualquer período"}
        </span>
        <CalendarDays aria-hidden className="size-5 shrink-0 text-texto-suave" />
      </button>
      <input type="hidden" name={nomeDoInicio} value={inicio} disabled={disabled} />
      <input type="hidden" name={nomeDoFim} value={fim || inicio} disabled={disabled} />
      {aberto && (
        <Superficie
          rotulo={`Calendário de ${rotulo}`}
          aoFechar={() => {
            setAberto(false);
            botao.current?.focus();
          }}
        >
          <p className="px-1 text-sm text-texto-suave" role="status">
            {inicio && !fim ? "Agora escolha o último dia." : "Escolha o primeiro e o último dia."}
          </p>
          <Calendario
            modo="intervalo"
            valor=""
            intervalo={intervalo}
            aoEscolher={escolher}
            aoLimpar={() => {
              setIntervalo({ inicio: "", fim: "" });
              setAberto(false);
              botao.current?.focus();
            }}
          />
        </Superficie>
      )}
      <Erro id={idDoErro} erro={erro} />
    </div>
  );
}

/**
 * Hora: campo digitável (`hh:mm`, ou "9", "930", "9h30") e lista em passos de 5 ou 15 minutos, com "Sem horário"
 * quando o campo é opcional. Envia `HH:MM` ou vazio, e vazio segue significando dia inteiro.
 */
export function CampoDeHora({
  rotulo,
  name,
  defaultValue = "",
  value,
  onChange,
  passo = 15,
  required,
  disabled,
  erro,
}: ComumDeData & {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (hora: string) => void;
  passo?: 5 | 15;
}) {
  const [hora, setHora] = useState(value ?? defaultValue);
  const [texto, setTexto] = useState(value ?? defaultValue);
  const [invalida, setInvalida] = useState(false);
  const [valorAnterior, setValorAnterior] = useState(value);
  if (value !== valorAnterior) {
    setValorAnterior(value);
    if (value !== undefined && value !== hora) {
      setHora(value);
      setTexto(value);
      setInvalida(false);
    }
  }
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const id = useId();
  const idDoErro = `${id}-erro`;

  const fechar = useCallback(() => setAberto(false), []);
  useFecharAoTocarFora(aberto, raiz, fechar);
  useAoLimparFormulario(raiz, () => {
    const inicial = value ?? defaultValue;
    setHora(inicial);
    setTexto(inicial);
    setInvalida(false);
  });

  const mensagem = erro ?? (invalida ? "Hora inválida. Escreva como 09:30." : undefined);
  useEffect(() => {
    entrada.current?.setCustomValidity(invalida ? "Hora inválida. Escreva como 09:30." : "");
  }, [invalida]);

  function mudar(proxima: string) {
    setHora(proxima);
    onChange?.(proxima);
  }

  function digitar(digitado: string) {
    setTexto(digitado);
    const lida = lerHoraDigitada(digitado);
    if (lida !== null) {
      setInvalida(false);
      mudar(lida);
    } else if (hora) {
      mudar("");
    }
  }

  const horas = horasDoDia(passo);
  const opcoes = [...(required ? [] : [{ valor: "", texto: "Sem horário" }]), ...horas.map((h) => ({ valor: h, texto: h }))];
  // A lista abre perto da hora digitada, mesmo quando ela não cai num passo (09:10 em passos de 15).
  const minutos = lerHora(hora);
  const proxima = minutos === null ? "" : formatarHora(arredondarHora(minutos, passo));

  return (
    <div ref={raiz} className="relative flex flex-col gap-1.5 text-sm font-medium">
      <label htmlFor={`${id}-campo`}>{rotulo}</label>
      <div className={`${CAIXA} ${mensagem ? "border-erro" : "border-borda"}`}>
        <input
          id={`${id}-campo`}
          ref={entrada}
          type="text"
          inputMode="numeric"
          placeholder={required ? "hh:mm" : "Sem horário"}
          value={texto}
          required={required}
          disabled={disabled}
          aria-invalid={mensagem ? true : undefined}
          aria-describedby={mensagem ? idDoErro : undefined}
          onChange={(e) => digitar(e.target.value)}
          onBlur={() => {
            const lida = lerHoraDigitada(texto);
            setInvalida(lida === null);
            if (lida !== null) setTexto(lida);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && !disabled) {
              e.preventDefault();
              setAberto(true);
            }
          }}
          className={ENTRADA}
        />
        <button
          ref={botao}
          type="button"
          aria-label="Escolher a hora"
          aria-haspopup="listbox"
          aria-expanded={aberto}
          disabled={disabled}
          onClick={() => setAberto(!aberto)}
          className={BOTAO_DA_CAIXA}
        >
          <Clock aria-hidden className="size-5" />
        </button>
      </div>
      {name && <input type="hidden" name={name} value={hora} disabled={disabled} />}
      {aberto && (
        <Painel
          opcoes={opcoes}
          multipla={false}
          selecionados={[hora]}
          inicial={proxima}
          aoEscolher={(escolhida) => {
            mudar(escolhida);
            setTexto(escolhida);
            setInvalida(false);
            setAberto(false);
            botao.current?.focus();
          }}
          aoFechar={() => {
            setAberto(false);
            botao.current?.focus();
          }}
          rotulo={`Hora de ${rotulo}`}
          idDaLista={`${id}-lista`}
        />
      )}
      <Erro id={idDoErro} erro={mensagem} />
    </div>
  );
}

/**
 * Data e hora juntas (campo específico "data e hora" de uma Categoria). Envia `AAAA-MM-DDTHH:MM` num campo com o mesmo
 * `name`; sem hora, vale meia-noite.
 */
export function CampoDeDataEHora({
  rotulo,
  name,
  defaultValue = "",
  required,
  disabled,
  erro,
}: ComumDeData & { name: string; defaultValue?: string }) {
  const inicial = dividirDataEHora(defaultValue);
  const [data, setData] = useState(inicial.data);
  const [hora, setHora] = useState(inicial.hora);
  const raiz = useRef<HTMLFieldSetElement>(null);
  useAoLimparFormulario(raiz, () => {
    setData(inicial.data);
    setHora(inicial.hora);
  });
  return (
    <fieldset ref={raiz} className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
      <legend className="mb-1.5 p-0 text-sm font-medium">{rotulo}</legend>
      <div className="grid grid-cols-2 gap-3">
        <CampoDeData rotulo="Dia" value={data} onChange={setData} required={required} disabled={disabled} erro={erro} />
        <CampoDeHora rotulo="Hora" value={hora} onChange={setHora} disabled={disabled} />
      </div>
      <input type="hidden" name={name} value={juntarDataEHora(data, hora)} disabled={disabled} />
    </fieldset>
  );
}
