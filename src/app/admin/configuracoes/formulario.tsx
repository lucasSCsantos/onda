"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BotaoEnviar, CaixaDeMarcar, Campo, Mensagens, Selecao, type Opcao } from "@/components/formulario";
import { JANELA_MAXIMA, JANELA_MINIMA } from "@/dominio/cartao-de-chamada";
import { FALTAS_MAXIMAS, FALTAS_MINIMAS, RETENCAO_MAXIMA, RETENCAO_MINIMA } from "@/dominio/configuracoes";
import { salvarConfiguracoes } from "@/lib/configuracoes/acoes";

export type ValoresDasConfiguracoes = {
  retencaoDosLogsMeses: number;
  lideresVeemHistoricoDoEvento: boolean;
  faltasParaAlerta: number;
  desempatePor: string | null;
  janelaDaChamadaDias: number;
  drive: { ligado: boolean; pastaRaizId: string | null; categorias: string[] };
};

/** O que está no ambiente do servidor para o Drive e o agendador funcionarem (só sim ou não). */
export type AmbienteDoDrive = { google: boolean; servico: boolean; agendador: boolean };

/** `marcacoes`: as opções do desempate do ranking. `categoriasDoDrive`: as Categorias que podem ganhar pasta sozinhas. */
export function FormularioDeConfiguracoes({
  valores,
  marcacoes,
  categoriasDoDrive,
  ambienteDoDrive,
}: {
  valores: ValoresDasConfiguracoes;
  marcacoes: Opcao[];
  categoriasDoDrive: { id: string; nome: string }[];
  ambienteDoDrive: AmbienteDoDrive;
}) {
  const [estado, acao] = useActionState(salvarConfiguracoes, {});
  return (
    <form action={acao} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
        <legend className="px-1 font-semibold">Logs</legend>
        <Campo
          rotulo="Guardar os logs por quantos meses"
          name="retencao"
          type="number"
          inputMode="numeric"
          min={RETENCAO_MINIMA}
          max={RETENCAO_MAXIMA}
          defaultValue={valores.retencaoDosLogsMeses}
          required
        />
        <p className="text-sm text-texto-suave">Todo dia, de madrugada, os logs mais antigos que isso são apagados.</p>
        <CaixaDeMarcar
          rotulo="Líderes veem o histórico dos Eventos que podem editar, dentro do próprio Evento"
          name="lideres_veem_historico"
          defaultChecked={valores.lideresVeemHistoricoDoEvento}
        />
      </fieldset>
      <fieldset className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
        <legend className="px-1 font-semibold">Presença</legend>
        <Campo
          rotulo="Avisar quando um Adolescente faltar a quantas aulas seguidas"
          name="faltas_para_alerta"
          type="number"
          inputMode="numeric"
          min={FALTAS_MINIMAS}
          max={FALTAS_MAXIMAS}
          defaultValue={valores.faltasParaAlerta}
          required
        />
        <p className="text-sm text-texto-suave">
          O aviso aparece na tela de Presença. As Marcações e os pontos ficam em{" "}
          <Link href="/admin/marcacoes" className="underline">
            Marcações
          </Link>
          .
        </p>
      </fieldset>
      <fieldset className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
        <legend className="px-1 font-semibold">Cartão de Chamada</legend>
        <Campo
          rotulo="Manter o cartão à vista por quantos dias depois da aula"
          name="janela_da_chamada"
          type="number"
          inputMode="numeric"
          min={JANELA_MINIMA}
          max={JANELA_MAXIMA}
          defaultValue={valores.janelaDaChamadaDias}
          required
        />
        <p className="text-sm text-texto-suave">
          O Professor e o Auxiliar veem o cartão na tela principal do início do dia da aula até o fim do último desses dias. Com 1, até o fim do dia seguinte.
        </p>
      </fieldset>
      <fieldset className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
        <legend className="px-1 font-semibold">Ranking</legend>
        <Selecao
          rotulo="Desempate: no empate de pontos, fica na frente quem tem mais"
          name="desempate"
          defaultValue={valores.desempatePor ?? ""}
          opcoes={[...marcacoes, { valor: "", texto: "Nenhum: o empate divide a posição" }]}
        />
      </fieldset>
      <fieldset className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
        <legend className="px-1 font-semibold">Drive</legend>
        <p className="text-sm text-texto-suave">
          Com o Drive ligado, cada Evento novo das Categorias marcadas ganha sozinho uma pasta, dentro da pasta do ministério,
          e o link vai para o campo &ldquo;Link do material&rdquo;. O Mural nunca apaga nada no Drive, e um link digitado à mão vale mais que a
          pasta automática.
        </p>
        <CaixaDeMarcar rotulo="Criar as pastas no Drive" name="drive_ligado" defaultChecked={valores.drive.ligado} />
        <Campo
          rotulo="Pasta do ministério no Drive (endereço da pasta ou ID)"
          name="drive_pasta_raiz"
          defaultValue={valores.drive.pastaRaizId ?? ""}
          autoComplete="off"
          spellCheck={false}
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Categorias com pasta automática</legend>
          {categoriasDoDrive.map((categoria) => (
            <CaixaDeMarcar
              key={categoria.id}
              rotulo={categoria.nome}
              name="drive_categoria"
              value={categoria.id}
              defaultChecked={valores.drive.categorias.includes(categoria.id)}
            />
          ))}
          <p className="text-xs text-texto-suave">Só aparecem as Categorias que têm um campo de link para o material.</p>
        </fieldset>
        <ul aria-label="Estado do servidor" className="flex flex-col gap-1 text-sm">
          <ItemDoAmbiente pronto={ambienteDoDrive.google} rotulo="Credenciais do Google (GOOGLE_SERVICE_ACCOUNT_JSON)" />
          <ItemDoAmbiente pronto={ambienteDoDrive.servico} rotulo="Chave de serviço do Supabase (SUPABASE_SERVICE_ROLE_KEY)" />
          <ItemDoAmbiente pronto={ambienteDoDrive.agendador} rotulo="Segredo do agendador (CRON_SECRET)" />
        </ul>
        <p className="text-sm text-texto-suave">
          Estas três ficam só no servidor. Para configurá-las, rode <code>scripts/wizard-integracoes.sh</code>. O link da pasta só abre para quem
          tem acesso a ela no Drive.
        </p>
      </fieldset>
      <div className="flex flex-col gap-2">
        <BotaoEnviar pendente="Salvando…">Salvar</BotaoEnviar>
        <Mensagens estado={estado} />
      </div>
    </form>
  );
}

function ItemDoAmbiente({ pronto, rotulo }: { pronto: boolean; rotulo: string }) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden className={pronto ? "text-sucesso" : "text-aviso"}>
        {pronto ? "✓" : "✗"}
      </span>
      <span>
        {rotulo}: <span className="font-medium">{pronto ? "configurada" : "faltando"}</span>
      </span>
    </li>
  );
}
