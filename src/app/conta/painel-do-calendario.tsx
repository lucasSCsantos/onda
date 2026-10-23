"use client";

import { useActionState } from "react";
import { CaixaDeMarcar, Mensagens, Selecao, type Opcao } from "@/components/formulario";
import { CopiarLink } from "@/app/admin/convites/copiar-link";
import type { AssinaturaDaPessoa } from "@/lib/calendario/consultas";
import { agirNaAssinatura } from "@/lib/calendario/acoes";

const dataEHora = (instante: Date) =>
  instante.toLocaleString("pt-BR", { timeZone: "America/Bahia", dateStyle: "short", timeStyle: "short" });

/**
 * Gerar, ajustar, regerar e revogar o endereço do calendário. O endereço novo só aparece aqui, na resposta da ação que o
 * criou: quem sai da página ou faz outra ação não o vê de novo.
 */
export function PainelDoCalendario({
  assinatura,
  categorias,
  professor,
  podeAniversarios,
}: {
  assinatura: { escopo: AssinaturaDaPessoa["escopo"]; categorias: string[]; aniversarios: boolean; criadoEm: string; usadoEm: string | null } | null;
  categorias: Opcao[];
  /** O Professor recebe só as aulas dele, sem escolher mais nada. */
  professor: boolean;
  podeAniversarios: boolean;
}) {
  const [estado, acao, pendente] = useActionState(agirNaAssinatura, {});

  return (
    <form action={acao} className="flex flex-col gap-5">
      {estado.endereco && (
        <div role="status" className="flex flex-col gap-3 rounded-xl border border-marca bg-fundo p-4">
          <p className="text-sm font-semibold">Copie agora: este endereço não aparece de novo.</p>
          <p className="text-sm text-texto-suave">
            Trate-o como uma senha: quem o tiver vê os seus Eventos. Se vazar, regere ou revogue.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <CopiarLink link={estado.endereco} rotulo="Endereço do calendário" />
          </div>
          <a href={estado.endereco.replace(/^https?:/, "webcal:")} className="botao-secundario self-start">
            Assinar no calendário do celular
          </a>
        </div>
      )}

      {!professor && (
        <>
          <Selecao
            rotulo="Quais Eventos"
            name="escopo"
            defaultValue={assinatura?.escopo ?? "todos"}
            opcoes={[
              { valor: "todos", texto: "Todos os Eventos" },
              { valor: "meus", texto: "Só os meus (onde sou Responsável, Professor ou Auxiliar)" },
            ]}
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Categorias</legend>
            <p className="text-sm text-texto-suave">Sem nenhuma marcada, vêm todas.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {categorias.map((c) => (
                <CaixaDeMarcar key={c.valor} rotulo={c.texto} name="categorias" value={c.valor} defaultChecked={assinatura?.categorias.includes(c.valor)} />
              ))}
            </div>
          </fieldset>
          {podeAniversarios && (
            <CaixaDeMarcar
              rotulo="Incluir aniversários (só o primeiro nome)"
              name="aniversarios"
              defaultChecked={assinatura?.aniversarios}
            />
          )}
        </>
      )}
      {professor && <p className="text-sm text-texto-suave">Você recebe só as aulas em que foi colocado como Professor ou Auxiliar.</p>}

      <Mensagens estado={estado} />

      {assinatura ? (
        <>
          <p className="text-sm text-texto-suave">
            Endereço criado em {dataEHora(new Date(assinatura.criadoEm))}.{" "}
            {assinatura.usadoEm ? `Último uso em ${dataEHora(new Date(assinatura.usadoEm))}.` : "Ainda não foi usado."}
          </p>
          <div className="flex flex-wrap gap-2">
            {!professor && (
              <button type="submit" name="acao" value="salvar" disabled={pendente} className="botao-primario">
                Salvar opções
              </button>
            )}
            <button type="submit" name="acao" value="regerar" disabled={pendente} className="botao-secundario">
              Regerar endereço
            </button>
            <button type="submit" name="acao" value="revogar" disabled={pendente} className="botao-secundario text-erro">
              Revogar
            </button>
          </div>
          <p className="text-sm text-texto-suave">
            Regerar cria um endereço novo e invalida o anterior. Revogar apaga o endereço: quem o usava para de receber.
          </p>
        </>
      ) : (
        <button type="submit" name="acao" value="gerar" disabled={pendente} className="botao-primario self-start">
          {pendente ? "Gerando…" : "Gerar meu endereço"}
        </button>
      )}
    </form>
  );
}
