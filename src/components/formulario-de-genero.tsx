"use client";

import { useActionState } from "react";
import { BotaoEnviar, GrupoDeRadio, Mensagens } from "@/components/formulario";
import { GENEROS, NOMES_DOS_GENEROS, type Genero } from "@/dominio/genero";
import { definirGenero } from "@/lib/contas/acoes";

/** Só o Gênero de uma pessoa com conta: Minha conta (a própria pessoa) e a tela de usuários (o Admin). */
export function FormularioDeGenero({ pessoa, genero, legenda = "Gênero" }: { pessoa: string; genero: Genero | null; legenda?: string }) {
  const [estado, acao] = useActionState(definirGenero.bind(null, pessoa), {});
  return (
    <form action={acao} className="flex flex-col gap-3">
      <GrupoDeRadio
        legenda={legenda}
        name="genero"
        variante="segmentado"
        required
        defaultValue={genero ?? undefined}
        opcoes={GENEROS.map((g) => ({ valor: g, texto: NOMES_DOS_GENEROS[g] }))}
      />
      <div className="flex flex-col gap-2">
        <BotaoEnviar pendente="Salvando…">Salvar Gênero</BotaoEnviar>
        <Mensagens estado={estado} />
      </div>
    </form>
  );
}
