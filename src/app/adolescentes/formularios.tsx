"use client";

import { useActionState } from "react";
import { BotaoEnviar, Campo, CampoDeData, GrupoDeRadio, Mensagens } from "@/components/formulario";
import type { Adolescente } from "@/dominio/adolescentes";
import { GENEROS, NOMES_DOS_GENEROS } from "@/dominio/genero";
import { salvarAdolescente } from "@/lib/adolescentes/acoes";

/** Cria (sem `adolescente`) ou edita nome, data de nascimento e Gênero (obrigatório só em cadastro novo). */
export function FormularioAdolescente({ adolescente }: { adolescente?: Adolescente }) {
  const [estado, acao] = useActionState(salvarAdolescente.bind(null, adolescente?.id ?? null), {});
  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] sm:items-end">
      <Campo rotulo="Nome" name="nome" defaultValue={adolescente?.nome} required />
      <CampoDeData rotulo="Data de nascimento" name="nascimento" defaultValue={adolescente?.nascimento} required />
      <div className="sm:col-span-2">
        <GrupoDeRadio
          legenda="Gênero"
          name="genero"
          variante="segmentado"
          required={!adolescente}
          defaultValue={adolescente?.genero ?? undefined}
          opcoes={GENEROS.map((g) => ({ valor: g, texto: NOMES_DOS_GENEROS[g] }))}
        />
      </div>
      <div className="sm:col-span-2">
        <BotaoEnviar pendente="Salvando…">{adolescente ? "Salvar" : "Cadastrar"}</BotaoEnviar>
      </div>
      <div className="sm:col-span-2">
        <Mensagens estado={estado} />
      </div>
    </form>
  );
}
