import { Marca } from "./marca";

/** Moldura das telas de entrada e senha: logotipo do ONDA e um cartão central. */
export function CartaoAcesso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-10">
      <Marca qual="logotipo" rotulo="ONDA" className="mx-auto h-24 w-40 text-texto" />
      <section className="flex flex-col gap-5 rounded-2xl border border-borda bg-superficie p-6 shadow-sm">
        <h1 className="text-xl font-semibold">{titulo}</h1>
        {children}
      </section>
    </main>
  );
}
