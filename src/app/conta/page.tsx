import type { Metadata } from "next";
import { Cabecalho } from "@/components/cabecalho";
import { podeGerenciarContas } from "@/dominio/acesso";
import { podeVerAniversarios } from "@/dominio/aniversarios";
import { podeVerTodosOsEventos } from "@/dominio/eventos";
import { podeCadastrarProfessor } from "@/dominio/professores";
import { assinaturaDa } from "@/lib/calendario/consultas";
import { exigirMural } from "@/lib/contas/perfil";
import { areasDaPessoa, categorias } from "@/lib/eventos/consultas";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { PainelDoCalendario } from "./painel-do-calendario";

export const metadata: Metadata = { title: "Minha conta" };

/** A página de cada pessoa aprovada: por ora, a Assinatura de calendário. Nenhum dado de cadastro novo. */
export default async function PaginaMinhaConta() {
  const eu = await exigirMural();
  const supabase = await supabaseDoServidor();
  const professor = eu.nivel === "professor";
  const [assinatura, todas, areas] = await Promise.all([
    assinaturaDa(supabase, eu.id),
    // O Professor não escolhe Categorias, e só lê as das aulas dele.
    professor ? [] : categorias(supabase),
    areasDaPessoa(supabase, eu.id),
  ]);

  return (
    <>
      <Cabecalho admin={podeGerenciarContas(eu)} lideranca={podeVerTodosOsEventos(eu)} calendario professores={podeCadastrarProfessor(eu, areas)} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8">
        <h1 className="text-2xl font-semibold">Minha conta</h1>
        <section aria-labelledby="calendario" className="flex flex-col gap-4 rounded-2xl border border-borda bg-superficie p-6">
          <h2 id="calendario" className="text-xl font-semibold">
            Calendário
          </h2>
          <p className="text-sm text-texto-suave">
            Veja os Eventos do Mural no calendário do celular. O endereço é pessoal e funciona como uma senha de leitura: mostramos
            uma única vez, e você pode regerar ou revogar quando quiser. Mudanças no Mural aparecem sozinhas, sem assinar de novo.
          </p>
          <PainelDoCalendario
            assinatura={
              assinatura && {
                ...assinatura,
                criadoEm: assinatura.criadoEm.toISOString(),
                usadoEm: assinatura.usadoEm?.toISOString() ?? null,
              }
            }
            categorias={todas.map((c) => ({ valor: c.id, texto: c.nome }))}
            professor={professor}
            podeAniversarios={podeVerAniversarios(eu)}
          />
        </section>
      </main>
    </>
  );
}
