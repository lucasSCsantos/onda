"use client";

import { useActionState } from "react";
import { BotaoEnviar, CaixaDeMarcar, Campo, CampoDeTextoLongo, Mensagens, Selecao, type Opcao } from "@/components/formulario";
import type { CampoDaCategoria } from "@/dominio/catalogo";
import { salvarCampo, salvarCategoria, salvarFuncao } from "@/lib/catalogo/acoes";

/** Cria (sem `funcao`) ou edita uma Função. */
export function FormularioFuncao({ funcao, areas }: { funcao?: { id: string; nome: string; area_id: string }; areas: Opcao[] }) {
  const [estado, acao] = useActionState(salvarFuncao.bind(null, funcao?.id ?? null), {});
  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
      <Campo rotulo="Nome" name="nome" defaultValue={funcao?.nome} required />
      <Selecao rotulo="Área" name="area" opcoes={areas} defaultValue={funcao?.area_id} vazia={funcao ? undefined : "Escolha a Área"} required />
      <BotaoEnviar pendente="Salvando…">{funcao ? "Salvar" : "Criar"}</BotaoEnviar>
      <div className="sm:col-span-3">
        <Mensagens estado={estado} />
      </div>
    </form>
  );
}

/** Cria (sem `categoria`) ou edita nome, Área e cor de uma Categoria. */
export function FormularioCategoria({
  categoria,
  areas,
}: {
  categoria?: { id: string; nome: string; area_id: string; cor: string };
  areas: Opcao[];
}) {
  const [estado, acao] = useActionState(salvarCategoria.bind(null, categoria?.id ?? null), {});
  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_5rem_auto] sm:items-end">
      <Campo rotulo="Nome" name="nome" defaultValue={categoria?.nome} required />
      <Selecao rotulo="Área" name="area" opcoes={areas} defaultValue={categoria?.area_id} vazia={categoria ? undefined : "Escolha a Área"} required />
      <Campo rotulo="Cor" name="cor" type="color" defaultValue={categoria?.cor ?? "#459ac8"} required />
      <BotaoEnviar pendente="Salvando…">{categoria ? "Salvar" : "Criar"}</BotaoEnviar>
      <div className="sm:col-span-4">
        <Mensagens estado={estado} />
      </div>
    </form>
  );
}

/** Cria (sem `campo`) ou edita um campo específico de uma Categoria. */
export function FormularioCampo({
  categoria,
  campo,
  tipos,
}: {
  categoria: string;
  campo?: CampoDaCategoria & { id: string };
  tipos: Opcao[];
}) {
  const [estado, acao] = useActionState(salvarCampo.bind(null, categoria, campo?.id ?? null), {});
  return (
    <form action={acao} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Nome" name="nome" defaultValue={campo?.nome} required />
        <Selecao rotulo="Tipo" name="tipo" opcoes={tipos} defaultValue={campo?.tipo ?? "texto_curto"} required />
      </div>
      <CampoDeTextoLongo
        rotulo="Opções (só para escolha de uma opção; uma por linha)"
        name="opcoes"
        rows={3}
        defaultValue={campo?.opcoes.join("\n")}
      />
      <CaixaDeMarcar rotulo="Obrigatório" name="obrigatorio" defaultChecked={campo?.obrigatorio} />
      <Mensagens estado={estado} />
      <BotaoEnviar pendente="Salvando…">{campo ? "Salvar campo" : "Adicionar campo"}</BotaoEnviar>
    </form>
  );
}
