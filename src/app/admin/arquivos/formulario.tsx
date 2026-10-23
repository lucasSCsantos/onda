"use client";

import { useActionState } from "react";
import { BotaoEnviar, CaixaDeMarcar, Campo, Mensagens } from "@/components/formulario";
import { ICONES_DE_ATALHO } from "@/components/icone-do-atalho";
import { ICONES_DOS_ATALHOS, NOMES_DOS_ICONES_DOS_ATALHOS, TAMANHO_MAXIMO_DO_NOME_DO_ATALHO } from "@/dominio/arquivos";
import { linkDaPasta } from "@/dominio/drive";
import { salvarAtalho } from "@/lib/arquivos/acoes";
import type { AtalhoDeArquivos } from "@/lib/arquivos/consultas";

/** Cria (sem `atalho`) ou edita um atalho de Arquivos: nome, ícone, pasta e as Funções que o veem. */
export function FormularioDeAtalho({
  atalho,
  funcoes,
  marcadas = [],
}: {
  atalho?: AtalhoDeArquivos;
  funcoes: { id: string; nome: string }[];
  marcadas?: string[];
}) {
  const [estado, acao] = useActionState(salvarAtalho.bind(null, atalho?.id ?? null), {});
  return (
    <form action={acao} className="flex flex-col gap-4">
      <Campo rotulo="Nome" name="nome" defaultValue={atalho?.nome} maxLength={TAMANHO_MAXIMO_DO_NOME_DO_ATALHO} required />
      <Campo
        rotulo="Pasta no Drive (endereço ou ID)"
        name="pasta"
        defaultValue={atalho ? linkDaPasta(atalho.pastaId) : ""}
        placeholder="https://drive.google.com/drive/folders/…"
        autoComplete="off"
        required
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Ícone</legend>
        <div className="flex flex-wrap gap-2">
          {ICONES_DOS_ATALHOS.map((icone) => {
            const Icone = ICONES_DE_ATALHO[icone];
            return (
              <label
                key={icone}
                className="toque flex size-11 cursor-pointer items-center justify-center rounded-xl border border-borda has-checked:border-marca has-checked:bg-marca has-checked:text-marca-texto has-focus-visible:ring-2 has-focus-visible:ring-marca/40"
              >
                <input type="radio" name="icone" value={icone} defaultChecked={(atalho?.icone ?? "folder") === icone} className="sr-only" />
                <Icone aria-hidden className="size-5" />
                <span className="sr-only">{NOMES_DOS_ICONES_DOS_ATALHOS[icone]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Quem vê</legend>
        <p className="text-sm text-texto-suave">
          Sem nenhuma Função marcada, o atalho aparece para toda a Liderança. O Admin e quem tem Função Geral veem todos os atalhos.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {funcoes.map((f) => (
            <CaixaDeMarcar key={f.id} rotulo={f.nome} name="funcao" value={f.id} defaultChecked={marcadas.includes(f.id)} />
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <BotaoEnviar pendente="Salvando…">{atalho ? "Salvar" : "Criar atalho"}</BotaoEnviar>
        <Mensagens estado={estado} />
      </div>
    </form>
  );
}
