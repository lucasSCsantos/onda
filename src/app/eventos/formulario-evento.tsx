"use client";

import { useActionState } from "react";
import { BotaoEnviar, Campo, CampoDeTextoLongo, GrupoDeRadio, Mensagens, Selecao, type Opcao } from "@/components/formulario";
import { nativosDe } from "@/dominio/campos-nativos";
import type { CampoCadastrado } from "@/dominio/catalogo";
import { camposDaCriacao, NOMES_DOS_STATUS, type Status } from "@/dominio/eventos";
import { eCampoDeAula } from "@/dominio/professores";
import { NOMES_DOS_ESCOPOS, type EscopoDeEdicao } from "@/dominio/series";
import { nomeDoCampoEspecifico } from "@/lib/campos";
import type { EstadoDoEvento } from "@/lib/eventos/acoes";
import type { CategoriaComArea } from "@/lib/eventos/consultas";
import { Repeticao } from "./repeticao";

/**
 * Campos comuns e os específicos da Categoria, para criar e para editar. `iniciais` vai do nome do campo no
 * formulário ao valor com que ele começa; `status` são os Status que quem preenche pode escolher.
 */
export function FormularioEvento({
  acao: enviar,
  categoria,
  lideranca,
  professores = [],
  status,
  iniciais,
  rotuloDaData,
  botao,
  repete = false,
  escopos,
}: {
  acao: (anterior: EstadoDoEvento, dados: FormData) => Promise<EstadoDoEvento>;
  categoria: CategoriaComArea;
  lideranca: Opcao[];
  /** Os Professores que também podem ser escolhidos nos campos Professor e Auxiliar. */
  professores?: Opcao[];
  status: readonly Status[];
  iniciais: Record<string, string>;
  rotuloDaData: string;
  botao: { texto: string; pendente: string };
  /** Um Evento novo pode repetir, virando uma Série. */
  repete?: boolean;
  /** Ao editar uma Ocorrência, os escopos que quem edita pode escolher; "só esta" é o primeiro. */
  escopos?: EscopoDeEdicao[];
}) {
  const [estado, acao] = useActionState<EstadoDoEvento, FormData>(enviar, {});
  // Depois de um erro, o formulário volta com o que foi digitado.
  const valor = (nome: string) => estado.valores?.[nome] ?? iniciais[nome] ?? "";
  // Cada Categoria oculta, mostra ou exige os campos comuns que quiser (ADR 0008).
  const nativos = nativosDe(categoria);
  const exige = (campo: keyof typeof nativos) => nativos[campo] === "obrigatorio";

  return (
    <form key={estado.tentativa ?? 0} action={acao} className="flex flex-col gap-4">
      {escopos && <EscopoDaEdicao escopos={escopos} valor={valor("escopo")} />}

      <Campo rotulo="Título" name="titulo" defaultValue={valor("titulo")} required />

      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="mb-1.5 text-sm text-texto-suave">
          {nativos.fim === "oculto"
            ? "Sem hora, o Evento é de dia inteiro."
            : `Sem hora, o Evento é de dia inteiro. O fim é ${exige("fim") ? "obrigatório" : "opcional"}.`}
        </legend>
        <Campo rotulo={rotuloDaData} name="data" type="date" defaultValue={valor("data")} required />
        <Campo rotulo="Hora" name="hora" type="time" defaultValue={valor("hora")} />
        {nativos.fim !== "oculto" && (
          <>
            <Campo rotulo="Fim (data)" name="data_fim" type="date" defaultValue={valor("data_fim")} />
            <Campo rotulo="Fim (hora)" name="hora_fim" type="time" defaultValue={valor("hora_fim")} />
          </>
        )}
      </fieldset>

      {repete && <Repeticao valor={valor} />}

      {nativos.local !== "oculto" && <Campo rotulo="Local" name="local" defaultValue={valor("local")} required={exige("local")} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Selecao
          rotulo="Responsável"
          name="responsavel"
          opcoes={lideranca}
          vazia="Ninguém ainda (só Rascunho)"
          defaultValue={valor("responsavel")}
        />
        <Selecao
          rotulo="Status"
          name="status"
          opcoes={status.map((s) => ({ valor: s, texto: NOMES_DOS_STATUS[s] }))}
          defaultValue={valor("status")}
          required
        />
      </div>

      {camposDaCriacao(categoria).map((c) => (
        <CampoEspecifico
          key={c.id}
          campo={c}
          pessoas={eCampoDeAula(c) ? [...lideranca, ...professores] : lideranca}
          valor={valor(nomeDoCampoEspecifico(c.id))}
        />
      ))}

      {nativos.link !== "oculto" && (
        <Campo rotulo="Link" name="link" type="url" placeholder="https://" defaultValue={valor("link")} required={exige("link")} />
      )}
      {nativos.observacoes !== "oculto" && (
        <CampoDeTextoLongo rotulo="Observações" name="observacoes" rows={3} defaultValue={valor("observacoes")} required={exige("observacoes")} />
      )}

      <Mensagens estado={estado} />
      <BotaoEnviar pendente={botao.pendente}>{botao.texto}</BotaoEnviar>
    </form>
  );
}

/** O que a edição de uma Ocorrência altera: só ela, as daqui em diante ou todas as que ainda podem mudar. */
function EscopoDaEdicao({ escopos, valor }: { escopos: EscopoDeEdicao[]; valor: string }) {
  const escolhido = escopos.find((e) => e === valor) ?? "esta";
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-borda p-3">
      <GrupoDeRadio
        legenda="Este Evento é uma Ocorrência de uma Série. Alterar"
        name="escopo"
        defaultValue={escolhido}
        opcoes={escopos.map((escopo) => ({ valor: escopo, texto: NOMES_DOS_ESCOPOS[escopo] }))}
      />
      {escopos.length > 1 && (
        <p className="text-sm text-texto-suave">
          Para as seguintes ou toda a série, valem o horário e os campos que você mudou, não a data nem o Status. Ocorrências editadas à
          parte, Realizadas e Canceladas não são tocadas.
        </p>
      )}
    </div>
  );
}

/** Um campo específico, conforme o tipo. */
function CampoEspecifico({
  campo,
  pessoas,
  valor,
}: {
  campo: CampoCadastrado;
  pessoas: Opcao[];
  valor: string;
}) {
  const comum = { name: nomeDoCampoEspecifico(campo.id), defaultValue: valor, required: campo.obrigatorio };
  const rotulo = campo.obrigatorio ? campo.nome : `${campo.nome} (opcional)`;
  switch (campo.tipo) {
    case "texto_longo":
      return <CampoDeTextoLongo rotulo={rotulo} rows={3} {...comum} />;
    case "lista":
      return <CampoDeTextoLongo rotulo={`${rotulo}: um item por linha`} rows={3} {...comum} />;
    case "link":
      return <Campo rotulo={rotulo} type="url" placeholder="https://" {...comum} />;
    case "valor":
      return <Campo rotulo={`${rotulo}, em reais`} inputMode="decimal" placeholder="35,00" {...comum} />;
    case "data":
      return <Campo rotulo={rotulo} type="date" {...comum} />;
    case "data_hora":
      return <Campo rotulo={rotulo} type="datetime-local" {...comum} />;
    case "escolha":
      return (
        <Selecao rotulo={rotulo} opcoes={campo.opcoes.map((o) => ({ valor: o, texto: o }))} vazia="Escolha" {...comum} />
      );
    case "pessoa":
      return <Selecao rotulo={rotulo} opcoes={pessoas} vazia="Ninguém" {...comum} />;
    default:
      return <Campo rotulo={rotulo} {...comum} />;
  }
}
