"use client";

import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { alternarValor, buscarPorDigitacao, filtrarOpcoes, indiceDoValor, moverIndice, temBusca, type Opcao } from "@/dominio/opcoes";

const CAIXA =
  "flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border bg-superficie px-3 py-2 text-left text-base font-normal outline-none transition-colors hover:border-texto-suave focus-visible:border-marca focus-visible:ring-2 focus-visible:ring-marca/30 disabled:cursor-not-allowed disabled:opacity-60";

type Comum = {
  rotulo: string;
  opcoes: Opcao[];
  name?: string;
  required?: boolean;
  disabled?: boolean;
  /** Mensagem de erro, ligada ao campo e anunciada. */
  erro?: string;
  /** As opções ainda estão chegando. */
  carregando?: boolean;
};

/** O painel de opções: busca (com mais de 8 opções), lista com teclado completo e, no celular, painel inferior. */
function Painel({
  opcoes,
  multipla,
  selecionados,
  aoEscolher,
  aoFechar,
  rotulo,
  carregando,
  idDaLista,
}: {
  opcoes: Opcao[];
  multipla: boolean;
  selecionados: string[];
  aoEscolher: (valor: string) => void;
  aoFechar: () => void;
  rotulo: string;
  carregando?: boolean;
  idDaLista: string;
}) {
  const [busca, setBusca] = useState("");
  const comBusca = temBusca(opcoes.length);
  const visiveis = filtrarOpcoes(opcoes, busca);
  const [ativo, setAtivo] = useState(() => Math.max(0, indiceDoValor(opcoes, selecionados[0] ?? "")));
  const lista = useRef<HTMLUListElement>(null);
  const campoDeBusca = useRef<HTMLInputElement>(null);
  const digitado = useRef({ texto: "", ate: 0 });
  const indiceAtivo = Math.min(ativo, visiveis.length - 1);

  useEffect(() => {
    (campoDeBusca.current ?? lista.current)?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    lista.current?.children[indiceAtivo]?.scrollIntoView({ block: "nearest" });
  }, [indiceAtivo]);

  function aoTeclar(e: React.KeyboardEvent) {
    const teclas: Record<string, "baixo" | "cima" | "inicio" | "fim"> = { ArrowDown: "baixo", ArrowUp: "cima", Home: "inicio", End: "fim" };
    if (teclas[e.key]) {
      e.preventDefault();
      setAtivo(moverIndice(indiceAtivo, visiveis.length, teclas[e.key]));
    } else if (e.key === "Enter" || (e.key === " " && !comBusca)) {
      e.preventDefault();
      if (visiveis[indiceAtivo]) aoEscolher(visiveis[indiceAtivo].valor);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      aoFechar();
    } else if (e.key === "Tab") {
      aoFechar();
    } else if (!comBusca && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Sem busca no painel, digitar salta para a opção que começa com o que foi digitado.
      const agora = e.timeStamp;
      const anterior = agora < digitado.current.ate ? digitado.current.texto : "";
      digitado.current = { texto: anterior + e.key, ate: agora + 700 };
      setAtivo(buscarPorDigitacao(visiveis, digitado.current.texto, indiceAtivo));
    }
  }

  return (
    <>
      <div aria-hidden className="fixed inset-0 z-40 bg-black/40 sm:hidden" onClick={aoFechar} />
      <div
        onKeyDown={aoTeclar}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[70dvh] flex-col gap-2 rounded-t-2xl border border-borda bg-superficie p-2 pb-4 shadow-2xl sm:absolute sm:inset-x-auto sm:left-0 sm:right-0 sm:top-full sm:bottom-auto sm:mt-1 sm:max-h-72 sm:rounded-xl sm:p-1 sm:pb-1 sm:shadow-lg"
      >
        <div aria-hidden className="mx-auto h-1 w-10 shrink-0 rounded-full bg-borda sm:hidden" />
        {comBusca && (
          <input
            ref={campoDeBusca}
            type="search"
            role="combobox"
            aria-expanded
            aria-controls={idDaLista}
            aria-activedescendant={visiveis[indiceAtivo] ? `${idDaLista}-${indiceAtivo}` : undefined}
            aria-label={`Buscar em ${rotulo}`}
            placeholder="Buscar…"
            autoComplete="off"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setAtivo(0);
            }}
            className="min-h-11 shrink-0 rounded-lg border border-borda bg-fundo px-3 text-base outline-none focus:border-marca focus:ring-2 focus:ring-marca/30"
          />
        )}
        <ul
          ref={lista}
          id={idDaLista}
          role="listbox"
          tabIndex={comBusca ? undefined : -1}
          aria-label={rotulo}
          aria-multiselectable={multipla || undefined}
          aria-busy={carregando || undefined}
          aria-activedescendant={!comBusca && visiveis[indiceAtivo] ? `${idDaLista}-${indiceAtivo}` : undefined}
          // Tocar numa opção não tira o foco da lista (o teclado segue valendo, com Esc inclusive).
          onMouseDown={(e) => e.preventDefault()}
          className="min-h-0 flex-1 overflow-y-auto outline-none"
        >
          {visiveis.map((opcao, i) => {
            const marcada = selecionados.includes(opcao.valor);
            return (
              <li
                key={opcao.valor}
                id={`${idDaLista}-${i}`}
                role="option"
                aria-selected={marcada}
                onPointerMove={() => setAtivo(i)}
                onClick={() => aoEscolher(opcao.valor)}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-base ${
                  i === indiceAtivo ? "bg-marca/10" : ""
                } ${marcada ? "font-medium text-marca" : ""}`}
              >
                <span>{opcao.texto}</span>
                {marcada && <Check aria-hidden className="size-4 shrink-0" />}
              </li>
            );
          })}
        </ul>
        {carregando && (
          <p role="status" className="flex min-h-11 items-center gap-2 px-3 text-sm text-texto-suave">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Carregando…
          </p>
        )}
        {!carregando && visiveis.length === 0 && (
          <p role="status" className="flex min-h-11 items-center px-3 text-sm text-texto-suave">
            {busca ? "Nada encontrado." : "Sem opções."}
          </p>
        )}
      </div>
    </>
  );
}

/** Fecha o painel ao tocar fora dele. */
function useFecharAoTocarFora(aberto: boolean, raiz: React.RefObject<HTMLElement | null>, fechar: () => void) {
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) fechar();
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto, raiz, fechar]);
}

function Erro({ id, erro }: { id: string; erro?: string }) {
  if (!erro) return null;
  return (
    <p id={id} role="alert" className="text-sm font-normal text-erro">
      {erro}
    </p>
  );
}

/**
 * Select único: no lugar do `<select>`, com painel estilizado. Envia o valor num campo com o mesmo `name` (que também
 * carrega o `required`), então `<form action>` e as Server Actions seguem como antes. Sem `vazia`, o primeiro item vale
 * como o escolhido por padrão, como no select nativo.
 */
export function Selecao({
  rotulo,
  opcoes,
  vazia,
  name,
  defaultValue,
  value,
  onChange,
  required,
  disabled,
  erro,
  carregando,
}: Comum & {
  /** Texto da opção vazia, quando o campo é opcional. */
  vazia?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (valor: string) => void;
}) {
  const todas = vazia === undefined ? opcoes : [{ valor: "", texto: vazia }, ...opcoes];
  const inicial = defaultValue ?? (vazia === undefined ? (opcoes[0]?.valor ?? "") : "");
  const [interno, setInterno] = useState(value ?? inicial);
  // Um `value` que muda por fora (a URL, por exemplo) vale; entre uma escolha e essa volta, o campo já mostra a escolha.
  const [valorAnterior, setValorAnterior] = useState(value);
  if (value !== valorAnterior) {
    setValorAnterior(value);
    if (value !== undefined) setInterno(value);
  }
  const atual = interno;
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const id = useId();
  const idDoRotulo = `${id}-rotulo`;
  const idDoErro = `${id}-erro`;

  const fechar = useCallback(() => setAberto(false), []);
  useFecharAoTocarFora(aberto, raiz, fechar);

  // Voltar ao valor inicial quando o formulário é limpo (os formulários com Server Action limpam ao terminar).
  useEffect(() => {
    const formulario = campo.current?.form;
    if (!formulario) return;
    const limpar = () => setInterno(value ?? inicial);
    formulario.addEventListener("reset", limpar);
    return () => formulario.removeEventListener("reset", limpar);
  }, [inicial, value]);

  function escolher(valor: string) {
    setInterno(valor);
    onChange?.(valor);
    setAberto(false);
    botao.current?.focus();
  }

  const escolhida = todas.find((o) => o.valor === atual);
  const semValor = escolhida === undefined || escolhida.valor === "";

  return (
    <div ref={raiz} className="relative flex flex-col gap-1.5 text-sm font-medium">
      <label id={idDoRotulo} htmlFor={`${id}-botao`}>
        {rotulo}
      </label>
      <button
        id={`${id}-botao`}
        ref={botao}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={aberto ? `${id}-lista` : undefined}
        aria-labelledby={`${idDoRotulo} ${id}-valor`}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? idDoErro : undefined}
        aria-required={required || undefined}
        aria-busy={carregando || undefined}
        disabled={disabled}
        onClick={() => setAberto(!aberto)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setAberto(true);
          }
        }}
        className={`${CAIXA} ${erro ? "border-erro" : "border-borda"}`}
      >
        <span id={`${id}-valor`} className={semValor ? "text-texto-suave" : ""}>
          {escolhida?.texto || (carregando ? "Carregando…" : "Selecione")}
        </span>
        {carregando ? (
          <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-texto-suave" />
        ) : (
          <ChevronDown aria-hidden className={`size-4 shrink-0 text-texto-suave transition-transform ${aberto ? "rotate-180" : ""}`} />
        )}
      </button>
      {/* O campo que vai no formulário. Fica por cima do botão, invisível e fora da ordem de foco, para o aviso de
          "campo obrigatório" do navegador aparecer no lugar certo. */}
      <input
        ref={campo}
        name={name}
        value={atual}
        onChange={() => {}}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 h-11 w-full opacity-0"
        onFocus={() => botao.current?.focus()}
      />
      {aberto && (
        <Painel
          opcoes={todas}
          multipla={false}
          selecionados={[atual]}
          aoEscolher={escolher}
          aoFechar={() => {
            setAberto(false);
            botao.current?.focus();
          }}
          rotulo={rotulo}
          carregando={carregando}
          idDaLista={`${id}-lista`}
        />
      )}
      <Erro id={idDoErro} erro={erro} />
    </div>
  );
}

/**
 * Select múltiplo com chips removíveis. Cada valor escolhido vai ao formulário num campo com o mesmo `name`. Controlado
 * (`valores` + `onChange`) ou solto (`defaultValues`).
 */
export function SelecaoMultipla({
  rotulo,
  opcoes,
  name,
  defaultValues,
  valores,
  onChange,
  vazia = "Todas",
  disabled,
  erro,
  carregando,
}: Omit<Comum, "required"> & {
  defaultValues?: string[];
  valores?: string[];
  onChange?: (valores: string[]) => void;
  /** O que o campo mostra sem nenhuma opção escolhida. */
  vazia?: string;
}) {
  const [interno, setInterno] = useState(valores ?? defaultValues ?? []);
  // Os `valores` que mudam por fora (a URL, por exemplo) valem; entre uma escolha e essa volta, o campo já mostra a escolha.
  const [valoresAnteriores, setValoresAnteriores] = useState(valores);
  if (valores !== undefined && valoresAnteriores?.join(" ") !== valores.join(" ")) {
    setValoresAnteriores(valores);
    setInterno(valores);
  }
  const atuais = interno;
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const id = useId();
  const idDoRotulo = `${id}-rotulo`;
  const idDoErro = `${id}-erro`;

  const fechar = useCallback(() => setAberto(false), []);
  useFecharAoTocarFora(aberto, raiz, fechar);

  function mudar(proximos: string[]) {
    setInterno(proximos);
    onChange?.(proximos);
  }

  const escolhidas = atuais.map((valor) => opcoes.find((o) => o.valor === valor)).filter((o): o is Opcao => o !== undefined);

  return (
    <div ref={raiz} className="relative flex flex-col gap-1.5 text-sm font-medium">
      <label id={idDoRotulo} htmlFor={`${id}-botao`}>
        {rotulo}
      </label>
      <div className={`flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-lg border bg-superficie p-1.5 ${erro ? "border-erro" : "border-borda"}`}>
        {escolhidas.map((opcao) => (
          <span key={opcao.valor} className="inline-flex min-h-8 items-center gap-1 rounded-full bg-marca/10 pl-3 text-sm font-normal text-marca">
            {opcao.texto}
            <button
              type="button"
              disabled={disabled}
              aria-label={`Remover ${opcao.texto}`}
              onClick={() => {
                mudar(atuais.filter((v) => v !== opcao.valor));
                botao.current?.focus();
              }}
              className="toque flex size-8 items-center justify-center rounded-full hover:bg-marca/15"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          </span>
        ))}
        <button
          id={`${id}-botao`}
          ref={botao}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={aberto}
          aria-controls={aberto ? `${id}-lista` : undefined}
          aria-labelledby={`${idDoRotulo} ${id}-valor`}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? idDoErro : undefined}
          aria-busy={carregando || undefined}
          disabled={disabled}
          onClick={() => setAberto(!aberto)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setAberto(true);
            }
          }}
          className="flex min-h-11 min-w-24 flex-1 items-center justify-between gap-2 rounded-md px-2 text-left text-base font-normal outline-none focus-visible:ring-2 focus-visible:ring-marca/40 disabled:opacity-60"
        >
          <span id={`${id}-valor`} className={escolhidas.length ? "sr-only" : "text-texto-suave"}>
            {escolhidas.length ? `${escolhidas.length} escolhida${escolhidas.length === 1 ? "" : "s"}` : vazia}
          </span>
          {carregando ? (
            <Loader2 aria-hidden className="ml-auto size-4 shrink-0 animate-spin text-texto-suave" />
          ) : (
            <ChevronDown aria-hidden className={`ml-auto size-4 shrink-0 text-texto-suave transition-transform ${aberto ? "rotate-180" : ""}`} />
          )}
        </button>
      </div>
      {name && atuais.map((valor) => <input key={valor} type="hidden" name={name} value={valor} disabled={disabled} />)}
      {aberto && (
        <Painel
          opcoes={opcoes}
          multipla
          selecionados={atuais}
          aoEscolher={(valor) => mudar(alternarValor(atuais, valor))}
          aoFechar={() => {
            setAberto(false);
            botao.current?.focus();
          }}
          rotulo={rotulo}
          carregando={carregando}
          idDaLista={`${id}-lista`}
        />
      )}
      <Erro id={idDoErro} erro={erro} />
    </div>
  );
}
