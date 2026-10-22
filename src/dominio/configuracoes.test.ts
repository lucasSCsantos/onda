import { describe, expect, it } from "vitest";
import { lerConfiguracoes } from "./configuracoes";

describe("lerConfiguracoes", () => {
  it("aceita a retenção em meses inteiros, de 1 a 120, e a opção do histórico", () => {
    expect(lerConfiguracoes({ retencao: "6", lideresVeemHistorico: "on", faltasParaAlerta: "3" })).toEqual({
      retencao_dos_logs_meses: 6,
      lideres_veem_historico_do_evento: true,
      faltas_para_alerta: 3,
    });
    expect(lerConfiguracoes({ retencao: "120", lideresVeemHistorico: "", faltasParaAlerta: "52" })).toMatchObject({ lideres_veem_historico_do_evento: false });
  });

  it("recusa retenção fora dos limites ou quebrada", () => {
    for (const retencao of ["0", "121", "1.5", "", "doze"]) {
      expect(lerConfiguracoes({ retencao, lideresVeemHistorico: "", faltasParaAlerta: "3" }), retencao).toHaveProperty("erro");
    }
  });

  it("recusa alerta de ausência fora de 1 a 52 aulas", () => {
    for (const faltasParaAlerta of ["0", "53", "", "2.5"]) {
      expect(lerConfiguracoes({ retencao: "12", lideresVeemHistorico: "", faltasParaAlerta }), faltasParaAlerta).toHaveProperty("erro");
    }
  });
});
