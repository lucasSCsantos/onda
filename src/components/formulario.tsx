"use client";

import { Check, Minus } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { useFormStatus } from "react-dom";
import type { Opcao } from "@/dominio/opcoes";

export { Selecao, SelecaoMultipla } from "./selecao";

export type EstadoFormulario = { erro?: string; aviso?: string };

export type { Opcao };

export function Campo({
  rotulo,
  ...props
}: { rotulo: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {rotulo}
      <input
        {...props}
        className="rounded-lg border border-borda bg-superficie px-3 py-2.5 text-base font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/30"
      />
    </label>
  );
}

export function CampoDeTextoLongo({
  rotulo,
  ...props
}: { rotulo: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {rotulo}
      <textarea
        {...props}
        className="rounded-lg border border-borda bg-superficie px-3 py-2.5 text-base font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/30"
      />
    </label>
  );
}

function MensagemDeErro({ id, erro }: { id: string; erro?: string }) {
  if (!erro) return null;
  return (
    <p id={id} role="alert" className="text-sm text-erro">
      {erro}
    </p>
  );
}

/** O `<input>` nativo cobre o rótulo inteiro, invisível: o toque cai nele, e o visual fica por conta dos irmãos (`peer-*`). */
const SOBRE_A_ESCOLHA = "peer absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed";
const ROTULO_DE_ESCOLHA = "toque relative flex min-h-11 cursor-pointer items-center gap-3 text-sm has-disabled:cursor-not-allowed has-disabled:opacity-60";
const FOCO_DA_ESCOLHA = "peer-focus-visible:ring-2 peer-focus-visible:ring-marca/40";

/** Checkbox com caixa própria: marcado, desmarcado e indeterminado. O `<input>` nativo fica fora da vista, mas é ele que vai no formulário. */
export function CaixaDeMarcar({
  rotulo,
  indeterminada,
  erro,
  ...props
}: { rotulo: string; indeterminada?: boolean; erro?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const id = useId();
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (campo.current) campo.current.indeterminate = Boolean(indeterminada);
  }, [indeterminada]);
  return (
    <div className="flex flex-col gap-1">
      <label className={ROTULO_DE_ESCOLHA}>
        <input
          ref={campo}
          type="checkbox"
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? id : undefined}
          {...props}
          className={SOBRE_A_ESCOLHA}
        />
        <span
          aria-hidden
          className={`relative flex size-5 shrink-0 items-center justify-center rounded-md border bg-superficie transition-colors peer-checked:border-marca peer-checked:bg-marca peer-indeterminate:border-marca peer-indeterminate:bg-marca peer-checked:[&_.marcado]:scale-100 peer-indeterminate:[&_.parcial]:scale-100 ${erro ? "border-erro" : "border-borda"} ${FOCO_DA_ESCOLHA}`}
        >
          <Check className="marcado size-3.5 scale-0 text-marca-texto transition-transform" strokeWidth={3} />
          <Minus className="parcial absolute size-3.5 scale-0 text-marca-texto transition-transform" strokeWidth={3} />
        </span>
        {rotulo}
      </label>
      <MensagemDeErro id={id} erro={erro} />
    </div>
  );
}

/** Um radio com bolinha própria. Quando o rótulo é só um ícone, passe `aria-label` e deixe `rotulo` de fora. */
export function Radio({ rotulo, ...props }: { rotulo?: React.ReactNode } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label className={ROTULO_DE_ESCOLHA}>
      <input type="radio" {...props} className={SOBRE_A_ESCOLHA} />
      <span
        aria-hidden
        className={`flex size-5 shrink-0 items-center justify-center rounded-full border border-borda bg-superficie transition-colors after:size-2.5 after:scale-0 after:rounded-full after:bg-marca after:transition-transform peer-checked:border-marca peer-checked:after:scale-100 ${FOCO_DA_ESCOLHA}`}
      />
      {rotulo}
    </label>
  );
}

/** Grupo de radios em cartões ou segmentado, com o item marcado em destaque. Setas e Tab são os do navegador (mesmo `name`). */
export function GrupoDeRadio({
  legenda,
  name,
  opcoes,
  defaultValue,
  value,
  onChange,
  variante = "cartao",
  required,
  disabled,
  erro,
}: {
  legenda: string;
  name: string;
  opcoes: (Opcao & { descricao?: string })[];
  defaultValue?: string;
  value?: string;
  onChange?: (valor: string) => void;
  variante?: "cartao" | "segmentado";
  required?: boolean;
  disabled?: boolean;
  erro?: string;
}) {
  const idDoErro = useId();
  const segmentado = variante === "segmentado";
  return (
    <fieldset aria-describedby={erro ? idDoErro : undefined} aria-invalid={erro ? true : undefined} className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
      <legend className="mb-1.5 p-0 text-sm font-medium">{legenda}</legend>
      <div className={segmentado ? "flex gap-1 rounded-xl border border-borda bg-fundo p-1" : "grid gap-2"}>
        {opcoes.map((opcao, i) => (
          <label
            key={opcao.valor}
            className={`toque relative flex min-h-11 cursor-pointer gap-3 text-sm transition-colors has-disabled:cursor-not-allowed has-disabled:opacity-60 has-focus-visible:ring-2 has-focus-visible:ring-marca/40 ${
              segmentado
                ? "flex-1 items-center justify-center rounded-lg px-3 py-2 text-center has-checked:bg-marca has-checked:text-marca-texto"
                : "items-start rounded-xl border bg-superficie p-3 has-checked:border-marca has-checked:bg-marca/10 " + (erro ? "border-erro" : "border-borda")
            }`}
          >
            <input
              type="radio"
              name={name}
              value={opcao.valor}
              required={required && i === 0}
              disabled={disabled}
              {...(value === undefined ? { defaultChecked: defaultValue === opcao.valor } : { checked: value === opcao.valor })}
              onChange={() => onChange?.(opcao.valor)}
              className={SOBRE_A_ESCOLHA}
            />
            {!segmentado && (
              <span
                aria-hidden
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-borda bg-superficie transition-colors after:size-2.5 after:scale-0 after:rounded-full after:bg-marca after:transition-transform peer-checked:border-marca peer-checked:after:scale-100"
              />
            )}
            <span className="flex flex-col">
              <span className={segmentado ? "font-medium" : ""}>{opcao.texto}</span>
              {opcao.descricao && <span className="text-texto-suave">{opcao.descricao}</span>}
            </span>
          </label>
        ))}
      </div>
      <MensagemDeErro id={idDoErro} erro={erro} />
    </fieldset>
  );
}

/** Radio visual de ícone (Marcações, Atalhos de arquivos): o ícone é o que se vê, o nome fica para o leitor de tela. */
export function RadioDeIcone({ nome, icone, ...props }: { nome: string; icone: React.ReactNode } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label className="toque relative flex size-11 cursor-pointer items-center justify-center rounded-xl border border-borda transition-colors has-checked:border-marca has-checked:bg-marca has-checked:text-marca-texto has-focus-visible:ring-2 has-focus-visible:ring-marca/40">
      <input type="radio" {...props} className={SOBRE_A_ESCOLHA} />
      <span aria-hidden>{icone}</span>
      <span className="sr-only">{nome}</span>
    </label>
  );
}

export function BotaoEnviar({ children, pendente }: { children: React.ReactNode; pendente: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="botao-primario"
    >
      {pending ? pendente : children}
    </button>
  );
}

export function Mensagens({ estado }: { estado: EstadoFormulario }) {
  if (estado.erro)
    return (
      <p role="alert" className="text-sm text-erro">
        {estado.erro}
      </p>
    );
  if (estado.aviso)
    return (
      <p role="status" className="text-sm text-sucesso">
        {estado.aviso}
      </p>
    );
  return null;
}
