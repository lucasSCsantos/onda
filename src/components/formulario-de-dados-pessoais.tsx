"use client";

import { useActionState } from "react";
import { BotaoEnviar, Campo, CampoDeData, GrupoDeRadio, Mensagens } from "@/components/formulario";
import { GENEROS, NOMES_DOS_GENEROS, type Genero } from "@/dominio/genero";
import { editarMeusDados } from "@/lib/contas/acoes";

/** Os Dados pessoais de quem está logado (Minha conta): nome, data de nascimento e Gênero. Só a própria pessoa edita. */
export function FormularioDeDadosPessoais({ nome, nascimento, genero }: { nome: string; nascimento: string | null; genero: Genero | null }) {
  const [estado, acao] = useActionState(editarMeusDados, {});
  return (
    <form action={acao} className="flex flex-col gap-3">
      <Campo rotulo="Nome" name="nome" defaultValue={nome} required />
      <CampoDeData rotulo="Data de nascimento" name="nascimento" defaultValue={nascimento ?? undefined} required />
      <GrupoDeRadio
        legenda="Gênero"
        name="genero"
        variante="segmentado"
        required
        defaultValue={genero ?? undefined}
        opcoes={GENEROS.map((g) => ({ valor: g, texto: NOMES_DOS_GENEROS[g] }))}
      />
      <div className="flex flex-col gap-2">
        <BotaoEnviar pendente="Salvando…">Salvar dados</BotaoEnviar>
        <Mensagens estado={estado} />
      </div>
    </form>
  );
}
