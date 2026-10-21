import { NOMES_DOS_STATUS, type Status } from "@/dominio/eventos";

/**
 * Como o Status aparece em qualquer visão: Rascunho com borda tracejada e em itálico, Cancelado riscado e esmaecido,
 * Adiado com a marca ⏸ na cor de aviso. Só usa as cores do tema, então vale nos modos claro e escuro.
 */
export const visualDoStatus = (status: Status) => ({
  borda: status === "rascunho" ? "border-dashed border-texto-suave" : "border-borda",
  titulo: status === "cancelado" ? "line-through opacity-70" : status === "rascunho" ? "italic" : "",
  marca: status === "adiado" ? "⏸" : null,
});

export function SeloDoStatus({ status }: { status: Status }) {
  const cor = status === "adiado" ? "border-aviso text-aviso" : status === "rascunho" ? "border-dashed border-texto-suave" : "border-borda";
  return (
    <span className={`h-fit shrink-0 rounded-full border px-2 py-0.5 text-xs ${cor}`}>
      {status === "adiado" && <span aria-hidden>⏸ </span>}
      {NOMES_DOS_STATUS[status]}
    </span>
  );
}
