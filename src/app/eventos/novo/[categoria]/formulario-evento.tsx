"use client";

import { useActionState } from "react";
import { BotaoEnviar, Campo, CampoDeTextoLongo, Mensagens, Selecao, type Opcao } from "@/components/formulario";
import type { CampoCadastrado } from "@/dominio/catalogo";
import { camposDaCriacao, NOMES_DOS_STATUS, STATUS_INICIAIS } from "@/dominio/eventos";
import { nomeDoCampoEspecifico } from "@/lib/campos";
import { criarEvento, type EstadoDoEvento } from "@/lib/eventos/acoes";
import type { CategoriaComArea } from "@/lib/eventos/consultas";

const OPCOES_DE_STATUS: Opcao[] = STATUS_INICIAIS.map((s) => ({ valor: s, texto: NOMES_DOS_STATUS[s] }));

/** Campos comuns e os específicos da Categoria. Quem cria é o Responsável sugerido. */
export function FormularioEvento({
  categoria,
  lideranca,
  eu,
  rotuloDaData,
}: {
  categoria: CategoriaComArea;
  lideranca: Opcao[];
  eu: string;
  rotuloDaData: string;
}) {
  const [estado, acao] = useActionState<EstadoDoEvento, FormData>(criarEvento.bind(null, categoria.id), {});
  // Depois de um erro, o formulário volta com o que foi digitado.
  const valor = (nome: string, inicial = "") => estado.valores?.[nome] ?? inicial;

  return (
    <form key={estado.tentativa ?? 0} action={acao} className="flex flex-col gap-4">
      <Campo rotulo="Título" name="titulo" defaultValue={valor("titulo")} required />

      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="mb-1.5 text-sm text-texto-suave">Sem hora, o Evento é de dia inteiro. O fim é opcional.</legend>
        <Campo rotulo={rotuloDaData} name="data" type="date" defaultValue={valor("data")} required />
        <Campo rotulo="Hora" name="hora" type="time" defaultValue={valor("hora")} />
        <Campo rotulo="Fim (data)" name="data_fim" type="date" defaultValue={valor("data_fim")} />
        <Campo rotulo="Fim (hora)" name="hora_fim" type="time" defaultValue={valor("hora_fim")} />
      </fieldset>

      <Campo rotulo="Local" name="local" defaultValue={valor("local")} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Selecao
          rotulo="Responsável"
          name="responsavel"
          opcoes={lideranca}
          vazia="Ninguém ainda (só Rascunho)"
          defaultValue={valor("responsavel", eu)}
        />
        <Selecao rotulo="Status" name="status" opcoes={OPCOES_DE_STATUS} defaultValue={valor("status", "planejado")} required />
      </div>

      {camposDaCriacao(categoria).map((c) => (
        <CampoEspecifico key={c.id} campo={c} lideranca={lideranca} valor={valor(nomeDoCampoEspecifico(c.id))} />
      ))}

      <Campo rotulo="Link" name="link" type="url" placeholder="https://" defaultValue={valor("link")} />
      <CampoDeTextoLongo rotulo="Observações" name="observacoes" rows={3} defaultValue={valor("observacoes")} />

      <Mensagens estado={estado} />
      <BotaoEnviar pendente="Criando…">Criar Evento</BotaoEnviar>
    </form>
  );
}

/** Um campo específico, conforme o tipo. */
function CampoEspecifico({
  campo,
  lideranca,
  valor,
}: {
  campo: CampoCadastrado;
  lideranca: Opcao[];
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
      return <Selecao rotulo={rotulo} opcoes={lideranca} vazia="Ninguém" {...comum} />;
    default:
      return <Campo rotulo={rotulo} {...comum} />;
  }
}
