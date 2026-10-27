"use client";

import { useActionState } from "react";
import { BotaoEnviar, Campo, CampoDeHora, Mensagens } from "@/components/formulario";
import { DURACAO_MAXIMA_EM_MINUTOS, type HorarioPadrao } from "@/dominio/horarios-padrao";
import { salvarHorariosPadrao } from "@/lib/horarios/acoes";

export type LinhaDeHorario = { id: string; nome: string; cor: string; padrao: HorarioPadrao };

/** Uma linha por Categoria: início e duração padrão, ambos opcionais. Deixar em branco limpa o padrão. */
export function FormularioDeHorarios({ categorias }: { categorias: LinhaDeHorario[] }) {
  const [estado, acao] = useActionState(salvarHorariosPadrao, {});
  return (
    <form action={acao} className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {categorias.map((c) => (
          <li key={c.id} className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
            <input type="hidden" name="categoria" value={c.id} />
            <h2 className="flex items-center gap-2 font-medium">
              <span aria-hidden className="size-3 rounded-full" style={{ backgroundColor: c.cor }} />
              {c.nome}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <CampoDeHora rotulo={`Início de ${c.nome}`} name={`inicio_${c.id}`} defaultValue={c.padrao.inicio ?? ""} />
              <Campo
                rotulo={`Duração de ${c.nome} (min)`}
                name={`duracao_${c.id}`}
                type="number"
                inputMode="numeric"
                min={1}
                max={DURACAO_MAXIMA_EM_MINUTOS}
                placeholder="Sem duração"
                defaultValue={c.padrao.duracaoMinutos ?? ""}
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2">
        <BotaoEnviar pendente="Salvando…">Salvar horários</BotaoEnviar>
        <Mensagens estado={estado} />
      </div>
    </form>
  );
}
