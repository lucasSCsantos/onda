"use client";

import { useFormStatus } from "react-dom";

export type EstadoFormulario = { erro?: string; aviso?: string };

export type Opcao = { valor: string; texto: string };

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

export function Selecao({
  rotulo,
  opcoes,
  vazia,
  ...props
}: {
  rotulo: string;
  opcoes: Opcao[];
  /** Texto da opção vazia, quando o campo é opcional. */
  vazia?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {rotulo}
      <select
        {...props}
        className="rounded-lg border border-borda bg-superficie px-3 py-2.5 text-base font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/30"
      >
        {vazia !== undefined && <option value="">{vazia}</option>}
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.texto}
          </option>
        ))}
      </select>
    </label>
  );
}

export function BotaoEnviar({ children, pendente }: { children: React.ReactNode; pendente: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-marca px-4 py-3 font-semibold text-marca-texto disabled:opacity-60"
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
