import { describe, expect, it } from "vitest";
import { anonimo, contaNova } from "./ambiente";

describe("perfis", () => {
  it("cada pessoa lê só o próprio perfil", async () => {
    const ana = await contaNova("Ana");
    const bia = await contaNova("Bia");

    const { data, error } = await ana.cliente.from("perfis").select("id, nome");

    expect(error).toBeNull();
    expect(data).toEqual([{ id: ana.id, nome: "Ana" }]);
    expect(data?.some((p) => p.id === bia.id)).toBe(false);
  });

  it("quem não entrou não lê nenhum perfil", async () => {
    await contaNova("Carla");

    const { data } = await anonimo().from("perfis").select("id");

    expect(data).toEqual([]);
  });
});
