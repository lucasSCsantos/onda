import { describe, expect, it } from "vitest";
import { lerConfiguracoes } from "./configuracoes";

describe("lerConfiguracoes", () => {
  it("aceita a retenção em meses inteiros, de 1 a 120, e a opção do histórico", () => {
    expect(lerConfiguracoes({ retencao: "6", lideresVeemHistorico: "on" })).toEqual({
      retencao_dos_logs_meses: 6,
      lideres_veem_historico_do_evento: true,
    });
    expect(lerConfiguracoes({ retencao: "120", lideresVeemHistorico: "" })).toMatchObject({ lideres_veem_historico_do_evento: false });
  });

  it("recusa retenção fora dos limites ou quebrada", () => {
    for (const retencao of ["0", "121", "1.5", "", "doze"]) {
      expect(lerConfiguracoes({ retencao, lideresVeemHistorico: "" }), retencao).toHaveProperty("erro");
    }
  });
});
