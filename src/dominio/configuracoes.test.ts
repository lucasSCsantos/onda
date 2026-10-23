import { describe, expect, it } from "vitest";
import { lerConfiguracoes } from "./configuracoes";

describe("lerConfiguracoes", () => {
  it("aceita a retenção em meses inteiros, de 1 a 120, e a opção do histórico", () => {
    expect(lerConfiguracoes({ retencao: "6", lideresVeemHistorico: "on", faltasParaAlerta: "3", desempate: "", janelaDaChamada: "1" })).toEqual({
      retencao_dos_logs_meses: 6,
      lideres_veem_historico_do_evento: true,
      faltas_para_alerta: 3,
      desempate_por: null,
      janela_da_chamada_dias: 1,
    });
    expect(lerConfiguracoes({ retencao: "120", lideresVeemHistorico: "", faltasParaAlerta: "52", desempate: "11111111-1111-1111-1111-111111111111", janelaDaChamada: "1" })).toMatchObject({ lideres_veem_historico_do_evento: false, desempate_por: "11111111-1111-1111-1111-111111111111" });
  });

  it("recusa retenção fora dos limites ou quebrada", () => {
    for (const retencao of ["0", "121", "1.5", "", "doze"]) {
      expect(lerConfiguracoes({ retencao, lideresVeemHistorico: "", faltasParaAlerta: "3", desempate: "", janelaDaChamada: "1" }), retencao).toHaveProperty("erro");
    }
  });

  it("recusa um desempate que não é uma Marcação", () => {
    expect(lerConfiguracoes({ retencao: "12", lideresVeemHistorico: "", faltasParaAlerta: "3", desempate: "x", janelaDaChamada: "1" })).toHaveProperty("erro");
  });

  it("recusa alerta de ausência fora de 1 a 52 aulas", () => {
    for (const faltasParaAlerta of ["0", "53", "", "2.5"]) {
      expect(lerConfiguracoes({ retencao: "12", lideresVeemHistorico: "", faltasParaAlerta, desempate: "", janelaDaChamada: "1" }), faltasParaAlerta).toHaveProperty("erro");
    }
  });

  it("aceita a janela do cartão de Chamada de 0 a 7 dias e recusa o resto", () => {
    const base = { retencao: "12", lideresVeemHistorico: "", faltasParaAlerta: "3", desempate: "" };
    expect(lerConfiguracoes({ ...base, janelaDaChamada: "0" })).toMatchObject({ janela_da_chamada_dias: 0 });
    expect(lerConfiguracoes({ ...base, janelaDaChamada: "7" })).toMatchObject({ janela_da_chamada_dias: 7 });
    for (const janelaDaChamada of ["-1", "8", "", "1.5", "dois"]) {
      expect(lerConfiguracoes({ ...base, janelaDaChamada }), janelaDaChamada).toHaveProperty("erro");
    }
  });
});
