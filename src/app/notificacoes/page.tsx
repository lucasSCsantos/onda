import type { Metadata } from "next";
import Link from "next/link";
import { BellRing } from "lucide-react";
import { Cabecalho } from "@/components/cabecalho";
import { podeGerenciarContas } from "@/dominio/acesso";
import { podeVerTodosOsEventos } from "@/dominio/eventos";
import { podeCadastrarProfessor } from "@/dominio/professores";
import { exigirMural } from "@/lib/contas/perfil";
import { areasDaPessoa } from "@/lib/eventos/consultas";
import { marcarComoLida, marcarTodasComoLidas } from "@/lib/notificacoes/acoes";
import { notificacoesDaPessoa } from "@/lib/notificacoes/consultas";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Notificações" };

const quando = (instante: Date) => instante.toLocaleString("pt-BR", { timeZone: "America/Bahia", dateStyle: "short", timeStyle: "short" });

/** A central: o que o Mural avisou à pessoa, com as não lidas em destaque. Serve de segunda via se o push não chegar. */
export default async function PaginaDeNotificacoes() {
  const eu = await exigirMural();
  const supabase = await supabaseDoServidor();
  const [itens, areas] = await Promise.all([notificacoesDaPessoa(supabase), areasDaPessoa(supabase, eu.id)]);
  const naoLidas = itens.filter((i) => !i.lida).length;

  return (
    <>
      <Cabecalho admin={podeGerenciarContas(eu)} lideranca={podeVerTodosOsEventos(eu)} calendario professores={podeCadastrarProfessor(eu, areas)} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Notificações</h1>
          {naoLidas > 0 && (
            <form action={marcarTodasComoLidas}>
              <button type="submit" className="botao-secundario">
                Marcar todas como lidas
              </button>
            </form>
          )}
        </div>
        {itens.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-borda p-8 text-center text-texto-suave">
            <BellRing aria-hidden className="size-6" />
            <p>Você não tem Notificações.</p>
            <p className="text-sm">Os avisos do Mural aparecem aqui, mesmo que o celular não os mostre. Ative o aviso no aparelho em Minha conta.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {itens.map((item) => (
              <li
                key={item.id}
                className={`flex flex-col gap-2 rounded-2xl border p-4 ${item.lida ? "border-borda bg-superficie" : "border-marca bg-fundo"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <p className={item.lida ? "font-medium" : "font-semibold"}>
                      {!item.lida && <span className="sr-only">Não lida: </span>}
                      {item.titulo}
                    </p>
                    {item.texto && <p className="text-sm">{item.texto}</p>}
                    <p className="text-xs text-texto-suave">{quando(item.criadaEm)}</p>
                  </div>
                  {!item.lida && <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full bg-marca" />}
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.url && (
                    <Link href={item.url} className="botao-secundario">
                      Abrir
                    </Link>
                  )}
                  {!item.lida && (
                    <form action={marcarComoLida}>
                      <input type="hidden" name="id" value={item.id} />
                      <button type="submit" className="botao-secundario">
                        Marcar como lida
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
