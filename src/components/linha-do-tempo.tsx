import { CircleX, LogIn, Pencil, Plus, Trash2, TriangleAlert, UserCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { horaLocal } from "@/dominio/fuso";
import {
  agruparLogsPorDia,
  alertaDoLog,
  definicaoDaAcao,
  detalhesDoLog,
  fraseDoLog,
  linkDoObjeto,
  NOMES_DAS_SEVERIDADES,
  NOMES_DOS_MODULOS,
  visualDoLog,
  type Log,
  type Visual,
} from "@/dominio/logs";

const VISUAIS: Record<Visual, { icone: LucideIcon; cor: string; rotulo: string }> = {
  criacao: { icone: Plus, cor: "text-sucesso", rotulo: "Criação" },
  edicao: { icone: Pencil, cor: "text-marca", rotulo: "Edição" },
  exclusao: { icone: Trash2, cor: "text-texto-suave", rotulo: "Exclusão" },
  aprovacao: { icone: UserCheck, cor: "text-sucesso", rotulo: "Aprovação" },
  acesso: { icone: LogIn, cor: "text-texto-suave", rotulo: "Acesso" },
  alerta: { icone: TriangleAlert, cor: "text-aviso", rotulo: "Alerta" },
  erro: { icone: CircleX, cor: "text-erro", rotulo: "Erro" },
};

/**
 * Os logs em cartões agrupados por dia ("Hoje", "Ontem", "20 de outubro"), com hora, ícone e cor por tipo. Tocar num
 * cartão abre o que mudou, o que fazer (nos alertas), o link para o objeto e, recolhido, o detalhe técnico. Sem JS.
 * `existentes` são os Eventos que ainda existem: um excluído não ganha link.
 */
export function LinhaDoTempo({ logs, agora, existentes }: { logs: Log[]; agora: Date; existentes: Set<string> }) {
  return (
    <ol className="flex flex-col gap-6">
      {agruparLogsPorDia(logs, agora).map(({ dia, rotulo, logs: doDia }) => (
        <li key={dia} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-texto-suave uppercase">{rotulo}</h2>
          <ul className="flex flex-col gap-2">
            {doDia.map((log) => (
              <li key={log.id}>
                <CartaoDoLog log={log} existentes={existentes} />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function CartaoDoLog({ log, existentes }: { log: Log; existentes: Set<string> }) {
  const visual = VISUAIS[visualDoLog(log)];
  const Icone = visual.icone;
  const detalhes = detalhesDoLog(log);
  const alerta = alertaDoLog(log);
  const link = log.objetoTipo === "evento" && !existentes.has(log.objetoId ?? "") ? null : linkDoObjeto(log);
  const tecnico = [
    ["Código da ação", log.acao],
    ["Módulo", NOMES_DOS_MODULOS[log.modulo] ?? log.modulo],
    ["Severidade", NOMES_DAS_SEVERIDADES[log.severidade]],
    ["Origem", log.origem === "sistema" ? "Sistema (agendamento ou banco)" : "Interface do Mural"],
    ...(typeof log.detalhes.codigo === "string" ? [["Código do erro", log.detalhes.codigo]] : []),
    ...(typeof log.detalhes.mensagem === "string" ? [["Mensagem do erro", log.detalhes.mensagem]] : []),
    ["Registro nº", String(log.id)],
  ];

  return (
    <details className="group rounded-2xl border border-borda bg-superficie shadow-sm open:shadow-md">
      <summary className="toque flex cursor-pointer list-none items-start gap-3 rounded-2xl p-3 hover:bg-fundo [&::-webkit-details-marker]:hidden">
        <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-fundo ${visual.cor}`}>
          <Icone aria-hidden className="size-4" />
          <span className="sr-only">{visual.rotulo}</span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="break-words">
            {fraseDoLog(log).map((trecho, i) =>
              typeof trecho === "string" ? (
                <span key={i}>{trecho}</span>
              ) : (
                <em key={i} className="font-semibold not-italic">
                  {trecho.destaque}
                </em>
              ),
            )}
          </span>
          <span className="text-xs text-texto-suave">
            {horaLocal(log.feitoEm)} · {definicaoDaAcao(log.acao).nome}
            {log.resultado === "falha" && <span className="font-semibold text-erro"> · Falhou</span>}
          </span>
        </span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-borda px-3 py-3 text-sm">
        {alerta && (
          <div className="flex flex-col gap-1 rounded-xl bg-fundo p-3">
            <p className="font-semibold">{alerta.titulo}</p>
            <p className="text-texto-suave">{alerta.oQueFazer}</p>
          </div>
        )}
        {detalhes.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {detalhes.map((linha, i) => (
              <li key={i} className="break-words">
                {linha}
              </li>
            ))}
          </ul>
        ) : (
          !alerta && <p className="text-texto-suave">Sem mais detalhes.</p>
        )}
        {link && (
          <Link href={link} className="self-start font-medium text-marca underline">
            Abrir
          </Link>
        )}
        <details className="text-xs text-texto-suave">
          <summary className="cursor-pointer">Detalhe técnico</summary>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {tecnico.map(([rotulo, valor]) => (
              <div key={rotulo} className="contents">
                <dt>{rotulo}</dt>
                <dd className="break-all">{valor}</dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </details>
  );
}
