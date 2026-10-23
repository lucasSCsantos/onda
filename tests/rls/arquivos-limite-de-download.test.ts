import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, comFuncoes, contaNova } from "./ambiente";

const ler = async () => (await admin.from("configuracoes").select("drive_limite_de_download_mb").eq("id", true).single().throwOnError()).data!.drive_limite_de_download_mb as number;

let original = 4;

beforeAll(async () => {
  original = await ler();
});

afterAll(async () => {
  await admin.from("configuracoes").update({ drive_limite_de_download_mb: original }).eq("id", true);
});

describe("limite de download de Arquivos", () => {
  it("começa em 4 MB", () => {
    expect(original).toBe(4);
  });

  it("o Admin ajusta, e a mudança vira Log do módulo drive", async () => {
    const boss = await contaNova("Admin do limite", "admin");
    const { data, error } = await boss.cliente.from("configuracoes").update({ drive_limite_de_download_mb: 10 }).eq("id", true).select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(await ler()).toBe(10);

    const logs = (
      await admin
        .from("logs")
        .select("acao, modulo, usuario_id, detalhes")
        .eq("objeto_tipo", "configuracao")
        .eq("objeto_id", "drive_limite_de_download_mb")
        .eq("usuario_id", boss.id)
        .throwOnError()
    ).data!;
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ acao: "drive.configuracao_alterada", modulo: "drive", detalhes: { antes: 4, depois: 10 } });
  });

  it("recusa menos de 1 MB e mais de 50 MB", async () => {
    const boss = await contaNova("Admin do limite 2", "admin");
    for (const valor of [0, -1, 51]) {
      const { error } = await boss.cliente.from("configuracoes").update({ drive_limite_de_download_mb: valor }).eq("id", true);
      expect(error, String(valor)).not.toBeNull();
    }
  });

  it("líder e professor não mudam o limite", async () => {
    const lider = await comFuncoes("Líder do limite", "lider", ["Líder do louvor"]);
    const professor = await comFuncoes("Professor do limite", "professor", []);
    for (const quem of [lider, professor]) {
      await quem.cliente.from("configuracoes").update({ drive_limite_de_download_mb: 40 }).eq("id", true);
    }
    expect(await ler()).not.toBe(40);
  });
});
