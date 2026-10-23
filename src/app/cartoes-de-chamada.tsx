import { CircleAlert, CircleCheck, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import type { EstadoDoCartao } from "@/dominio/cartao-de-chamada";
import type { EventoListado } from "@/lib/eventos/consultas";
import { hora } from "./lista-de-eventos";

const ESTADOS: Record<EstadoDoCartao, { titulo: string; borda: string; texto: string; Icone: typeof ClipboardCheck }> = {
  "de-hoje": { titulo: "Chamada de hoje", borda: "border-marca", texto: "text-marca", Icone: ClipboardCheck },
  feita: { titulo: "Chamada feita ✓", borda: "border-sucesso", texto: "text-sucesso", Icone: CircleCheck },
  pendente: { titulo: "Chamada pendente", borda: "border-aviso", texto: "text-aviso", Icone: CircleAlert },
};

/** Os cartões de Chamada do Professor e do Auxiliar: "Chamada de hoje · EBD · tema · horário", com o botão para a Chamada da aula. */
export function CartoesDeChamada({ cartoes }: { cartoes: { aula: EventoListado; estado: EstadoDoCartao }[] }) {
  if (cartoes.length === 0) return null;
  return (
    <section aria-label="Chamada" className="flex flex-col gap-3">
      {cartoes.map(({ aula, estado }) => {
        const { titulo, borda, texto, Icone } = ESTADOS[estado];
        return (
          <article key={aula.id} data-estado={estado} className={`flex flex-col gap-3 rounded-2xl border-2 bg-superficie p-4 ${borda}`}>
            <div className="flex flex-col gap-0.5">
              <h2 className={`flex items-center gap-2 font-semibold ${texto}`}>
                <Icone aria-hidden className="size-5" />
                {titulo}
              </h2>
              <p className="text-sm text-texto-suave">
                {aula.categoria.nome} · {aula.titulo} · {aula.diaInteiro ? "Dia inteiro" : hora(aula.inicio)}
              </p>
            </div>
            <Link href={`/eventos/${aula.id}/chamada`} className={estado === "feita" ? "botao-secundario toque" : "botao-primario"}>
              {estado === "feita" ? "Ver a Chamada" : "Fazer a Chamada"}
            </Link>
          </article>
        );
      })}
    </section>
  );
}
