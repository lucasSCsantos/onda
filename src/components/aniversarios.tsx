import type { Aniversario } from "@/dominio/aniversarios";

/** "21/10": o dia e o mês de um aniversário. */
export const diaEMes = (dia: string) => `${dia.slice(8)}/${dia.slice(5, 7)}`;

/** Um aniversário no calendário: só o nome e o dia, sem ano de nascimento nem idade. */
export function AniversarioNoDia({ aniversario, compacto }: { aniversario: Aniversario; compacto?: boolean }) {
  return (
    <li
      title={`Aniversário de ${aniversario.nome}`}
      className={`rounded-md border border-dashed border-borda bg-fundo px-1.5 py-0.5 text-xs leading-snug ${compacto ? "truncate" : "break-words"}`}
    >
      <span aria-hidden>🎂 </span>
      <span className="sr-only">Aniversário de </span>
      {aniversario.nome}
    </li>
  );
}
