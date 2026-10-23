import { describe, expect, it } from "vitest";
import { driveFalso } from "@/lib/drive/falso";
import { ErroDoDrive, MAXIMO_DE_TENTATIVAS, esperaEmMinutos } from "./drive";
import { criarPastaDoEvento, renomearPastaDoEvento } from "./pastas";

const RAIZ = "RAIZ";
const PASTA_DO_EVENTO = "2026-10-25 · Aula de EBD 3";

const tarefa = (sobre: Partial<Parameters<typeof criarPastaDoEvento>[0]["tarefa"]> = {}) => ({
  categoria: "EBD",
  inicio: new Date("2026-10-25T15:00:00Z"),
  titulo: "Aula de EBD 3",
  tentativas: 1,
  ...sobre,
});

describe("criar a pasta de um Evento", () => {
  it("cria Categoria, ano e a pasta do Evento dentro da raiz e devolve o link da última", async () => {
    const drive = driveFalso();
    const resultado = await criarPastaDoEvento({ tarefa: tarefa(), raizId: RAIZ, cliente: drive.cliente });

    expect(drive.pastas.map((p) => [p.nome, p.pai])).toEqual([
      ["EBD", RAIZ],
      ["2026", "PASTA000001"],
      [PASTA_DO_EVENTO, "PASTA000002"],
    ]);
    expect(resultado).toEqual({ estado: "criada", pastaId: "PASTA000003", link: "https://drive.google.com/drive/folders/PASTA000003" });
  });

  it("reaproveita as pastas de Categoria e de ano que já existem, sem duplicar", async () => {
    const drive = driveFalso();
    await criarPastaDoEvento({ tarefa: tarefa({ titulo: "Aula 1" }), raizId: RAIZ, cliente: drive.cliente });
    await criarPastaDoEvento({ tarefa: tarefa({ titulo: "Aula 2" }), raizId: RAIZ, cliente: drive.cliente });

    expect(drive.pastas.filter((p) => p.nome === "EBD")).toHaveLength(1);
    expect(drive.pastas.filter((p) => p.nome === "2026")).toHaveLength(1);
    expect(drive.pastas.map((p) => p.nome)).toContain("2026-10-25 · Aula 2");
  });

  it("repetir a mesma tarefa não cria uma segunda pasta para o mesmo Evento", async () => {
    const drive = driveFalso();
    const primeira = await criarPastaDoEvento({ tarefa: tarefa(), raizId: RAIZ, cliente: drive.cliente });
    const segunda = await criarPastaDoEvento({ tarefa: tarefa({ tentativas: 2 }), raizId: RAIZ, cliente: drive.cliente });

    expect(segunda).toEqual(primeira);
    expect(drive.pastas).toHaveLength(3);
  });

  it("uma falha passageira adia a tarefa com a espera da tentativa", async () => {
    const drive = driveFalso();
    drive.falharAoMexerEm("EBD", new Error("Drive fora do ar"));
    const resultado = await criarPastaDoEvento({ tarefa: tarefa({ tentativas: 2 }), raizId: RAIZ, cliente: drive.cliente });

    expect(resultado).toEqual({ estado: "adiada", erro: "Drive fora do ar", depoisDeMinutos: esperaEmMinutos(2) });
  });

  it("depois da nova tentativa, a pasta nasce e o erro some", async () => {
    const drive = driveFalso();
    drive.falharAoMexerEm("EBD", new Error("Drive fora do ar"));
    const primeira = await criarPastaDoEvento({ tarefa: tarefa(), raizId: RAIZ, cliente: drive.cliente });
    const segunda = await criarPastaDoEvento({ tarefa: tarefa({ tentativas: 2 }), raizId: RAIZ, cliente: drive.cliente });

    expect(primeira.estado).toBe("adiada");
    expect(segunda.estado).toBe("criada");
    expect(drive.caminhoDe(PASTA_DO_EVENTO)).toEqual(["EBD", "2026", PASTA_DO_EVENTO]);
  });

  it("esgotadas as tentativas, a tarefa falha de vez", async () => {
    const drive = driveFalso();
    drive.falharAoMexerEm("EBD", new Error("Drive fora do ar"));
    const resultado = await criarPastaDoEvento({ tarefa: tarefa({ tentativas: MAXIMO_DE_TENTATIVAS }), raizId: RAIZ, cliente: drive.cliente });

    expect(resultado).toEqual({ estado: "falhou", erro: "Drive fora do ar" });
  });

  it("um erro permanente (pasta raiz fora de alcance) falha de vez já na primeira tentativa", async () => {
    const drive = driveFalso();
    drive.falharAoMexerEm("EBD", new ErroDoDrive("pasta raiz não encontrada ou sem acesso", { permanente: true }));
    const resultado = await criarPastaDoEvento({ tarefa: tarefa(), raizId: RAIZ, cliente: drive.cliente });

    expect(resultado).toEqual({ estado: "falhou", erro: "pasta raiz não encontrada ou sem acesso" });
  });

  it("o erro guardado nunca leva segredo: só a mensagem curta", async () => {
    const drive = driveFalso();
    drive.falharAoMexerEm("EBD", new Error("x".repeat(600)));
    const resultado = await criarPastaDoEvento({ tarefa: tarefa(), raizId: RAIZ, cliente: drive.cliente });

    expect(resultado.estado).toBe("adiada");
    expect("erro" in resultado && resultado.erro.length).toBeLessThanOrEqual(300);
  });
});

describe("renomear a pasta de um Evento", () => {
  const renomear = (sobre: Partial<Parameters<typeof renomearPastaDoEvento>[0]["tarefa"]> = {}, drive = driveFalso()) =>
    renomearPastaDoEvento({
      tarefa: { pastaId: "PASTA000003", inicio: new Date("2026-11-01T15:00:00Z"), titulo: "Aula nova", tentativas: 1, ...sobre },
      cliente: drive.cliente,
    });

  const comPastaCriada = async () => {
    const drive = driveFalso();
    await criarPastaDoEvento({ tarefa: tarefa(), raizId: RAIZ, cliente: drive.cliente });
    return drive;
  };

  it("troca só o nome da pasta, pelo título e pela data de agora, e não cria nem apaga nada", async () => {
    const drive = await comPastaCriada();

    const resultado = await renomear({}, drive);

    expect(resultado).toEqual({ estado: "renomeada" });
    expect(drive.pastas.map((p) => p.nome)).toEqual(["EBD", "2026", "2026-11-01 · Aula nova"]);
    expect(drive.pastas).toHaveLength(3);
  });

  it("renomear duas vezes para o mesmo nome é inofensivo", async () => {
    const drive = await comPastaCriada();
    await renomear({}, drive);
    expect(await renomear({}, drive)).toEqual({ estado: "renomeada" });
    expect(drive.pastas).toHaveLength(3);
  });

  it("pasta que sumiu do Drive é falha definitiva, sem nova tentativa", async () => {
    const resultado = await renomear({ pastaId: "NAO_EXISTE" });
    expect(resultado).toMatchObject({ estado: "falhou" });
  });

  it("falha passageira espera e tenta de novo; a última tentativa desiste", async () => {
    const drive = await comPastaCriada();
    drive.falharAoMexerEm("2026-11-01 · Aula nova", new Error("Drive fora do ar"));
    expect(await renomear({ tentativas: 1 }, drive)).toEqual({ estado: "adiada", erro: "Drive fora do ar", depoisDeMinutos: esperaEmMinutos(1) });

    drive.falharAoMexerEm("2026-11-01 · Aula nova", new Error("Drive fora do ar"));
    expect(await renomear({ tentativas: MAXIMO_DE_TENTATIVAS }, drive)).toMatchObject({ estado: "falhou" });
  });
});
