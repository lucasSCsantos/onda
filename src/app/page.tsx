import { redirect } from "next/navigation";
import { Cabecalho } from "@/components/cabecalho";
import { podeGerenciarContas, telaInicial } from "@/dominio/acesso";
import { perfilAtual } from "@/lib/contas/perfil";

export default async function Inicio() {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/entrar");
  const tela = telaInicial(perfil);

  return (
    <>
      <Cabecalho admin={podeGerenciarContas(perfil)} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-semibold">Olá{perfil.nome ? `, ${perfil.nome}` : ""}!</h1>
        {tela === "aguardando-aprovacao" && (
          <p className="mt-2 text-texto-suave">
            Seu cadastro está aguardando a aprovação de um Admin. Você não precisa fazer nada: assim que houver a
            aprovação, o Mural aparece aqui.
          </p>
        )}
        {tela === "conta-desativada" && (
          <p className="mt-2 text-texto-suave">Sua conta foi desativada. Fale com um Admin se precisar de acesso.</p>
        )}
        {tela === "mural" && <p className="mt-2 text-texto-suave">O calendário do ministério vai aparecer aqui.</p>}
      </main>
    </>
  );
}
