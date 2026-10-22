"use client";

import { Check, CircleX, LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";
import { IconeDaMarcacao } from "@/components/icone-da-marcacao";
import { buscarPorNome } from "@/dominio/adolescentes";
import { alternarMarcacao, estevePresente, resumoDaAula, type Marcacao, type PresencaNaAula } from "@/dominio/presenca";
import { salvarPresenca } from "@/lib/presenca/acoes";

type Linha = { marcacoes: string[]; visitante: string };
type Situacao = "salvando" | "salvo" | "erro";

/**
 * A Chamada no celular: um cartão por Adolescente ativo, um toque por Marcação, e cada toque já é salvo (as gravações de
 * um mesmo Adolescente vão em fila, na ordem dos toques). O resumo no topo acompanha. Sem permissão, só leitura.
 */
export function Chamada({
  eventoId,
  adolescentes,
  marcacoes,
  iniciais,
  pode,
}: {
  eventoId: string;
  adolescentes: { id: string; nome: string }[];
  /** Só as ativas: as desativadas que já estavam numa presença ficam gravadas, mas não aparecem aqui. */
  marcacoes: Marcacao[];
  iniciais: PresencaNaAula[];
  pode: boolean;
}) {
  const ativas = new Set(marcacoes.map((m) => m.id));
  const [linhas, setLinhas] = useState<Record<string, Linha>>(() =>
    Object.fromEntries(iniciais.map((p) => [p.adolescente, { marcacoes: p.marcacoes.filter((id) => ativas.has(id)), visitante: p.visitante ?? "" }])),
  );
  const [situacoes, setSituacoes] = useState<Record<string, Situacao>>({});
  const [busca, setBusca] = useState("");
  const filas = useRef<Record<string, Promise<void>>>({});

  const linhaDe = (id: string): Linha => linhas[id] ?? { marcacoes: [], visitante: "" };
  const pedeVisitante = (ids: string[]) => ids.some((id) => marcacoes.find((m) => m.id === id)?.pedeVisitante);

  function gravar(adolescente: string, linha: Linha) {
    setLinhas((atuais) => ({ ...atuais, [adolescente]: linha }));
    setSituacoes((atuais) => ({ ...atuais, [adolescente]: "salvando" }));
    const anterior = filas.current[adolescente] ?? Promise.resolve();
    filas.current[adolescente] = anterior.then(async () => {
      let situacao: Situacao = "erro";
      try {
        const { erro } = await salvarPresenca(eventoId, adolescente, linha.marcacoes, linha.visitante || null);
        situacao = erro ? "erro" : "salvo";
      } catch {
        // Sem conexão: fica como erro, com o botão para tentar de novo.
      }
      setSituacoes((atuais) => ({ ...atuais, [adolescente]: situacao }));
    });
  }

  function tocar(adolescente: string, marcacao: string) {
    const atual = linhaDe(adolescente);
    const proximas = alternarMarcacao(atual.marcacoes, marcacao, marcacoes);
    gravar(adolescente, { marcacoes: proximas, visitante: pedeVisitante(proximas) ? atual.visitante : "" });
  }

  const resumo = resumoDaAula(
    Object.entries(linhas).map(([adolescente, l]) => ({ adolescente, marcacoes: l.marcacoes, visitante: l.visitante || null })),
    marcacoes,
    adolescentes.length,
  );
  const visiveis = buscarPorNome(adolescentes, busca);

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Resumo da aula" className="flex flex-wrap gap-2 rounded-2xl border border-borda bg-superficie p-3 text-sm">
        <span className="rounded-full bg-fundo px-3 py-1 font-semibold">
          {resumo.presentes} de {resumo.ativos} presentes
        </span>
        {resumo.porMarcacao
          .filter(({ marcacao }) => !marcacao.contaPresenca)
          .map(({ marcacao, quantos }) => (
            <span key={marcacao.id} className="inline-flex items-center gap-1 rounded-full bg-fundo px-3 py-1">
              <IconeDaMarcacao icone={marcacao.icone} className="size-4" />
              {marcacao.nome}: {quantos}
            </span>
          ))}
      </section>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Procurar Adolescente
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="rounded-lg border border-borda bg-superficie px-3 py-2.5 text-base font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/30"
        />
      </label>

      {adolescentes.length === 0 && <p className="text-texto-suave">Nenhum Adolescente ativo no cadastro.</p>}
      {adolescentes.length > 0 && visiveis.length === 0 && <p className="text-texto-suave">Ninguém com esse nome.</p>}

      <ul className="flex flex-col gap-3">
        {visiveis.map((a) => {
          const linha = linhaDe(a.id);
          const situacao = situacoes[a.id];
          const presente = estevePresente(linha.marcacoes, marcacoes);
          return (
            <li key={a.id} className={`flex flex-col gap-3 rounded-2xl border bg-superficie p-3 ${presente ? "border-sucesso/60" : "border-borda"}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{a.nome}</p>
                <span aria-live="polite" className="flex items-center gap-1 text-xs text-texto-suave">
                  {situacao === "salvando" && (
                    <>
                      <LoaderCircle aria-hidden className="size-4 animate-spin" /> Salvando…
                    </>
                  )}
                  {situacao === "salvo" && (
                    <>
                      <Check aria-hidden className="size-4 text-sucesso" /> Salvo
                    </>
                  )}
                  {situacao === "erro" && (
                    <button type="button" onClick={() => gravar(a.id, linha)} className="botao-discreto text-erro">
                      <CircleX aria-hidden className="size-4" /> Não salvou. Tentar de novo
                    </button>
                  )}
                </span>
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label={`Marcações de ${a.nome}`}>
                {marcacoes.map((m) => {
                  const ligada = linha.marcacoes.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={ligada}
                      disabled={!pode}
                      onClick={() => tocar(a.id, m.id)}
                      className="toque inline-flex min-h-11 items-center gap-2 rounded-xl border border-borda px-3 text-sm font-medium text-texto-suave aria-pressed:border-marca aria-pressed:bg-marca aria-pressed:text-marca-texto disabled:opacity-70"
                    >
                      <IconeDaMarcacao icone={m.icone} />
                      {m.nome}
                    </button>
                  );
                })}
              </div>
              {pedeVisitante(linha.marcacoes) && (
                <label className="flex flex-col gap-1 text-sm">
                  Nome do visitante (opcional)
                  <input
                    type="text"
                    maxLength={80}
                    disabled={!pode}
                    defaultValue={linha.visitante}
                    onBlur={(e) => {
                      const visitante = e.target.value.trim();
                      if (visitante !== linha.visitante) gravar(a.id, { ...linha, visitante });
                    }}
                    className="rounded-lg border border-borda bg-superficie px-3 py-2 text-base outline-none focus:border-marca focus:ring-2 focus:ring-marca/30"
                  />
                </label>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
