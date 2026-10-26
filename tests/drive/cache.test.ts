import { describe, expect, it } from "vitest";
import { ErroDoDrive } from "@/dominio/drive";
import { comCache } from "@/lib/drive/cache";
import { driveFalso } from "@/lib/drive/falso";

const opcoes = { ordem: "nome", pagina: null, tamanho: 40 } as const;

describe("cache do Drive", () => {
  it("não pergunta de novo ao Drive dentro da validade", async () => {
    const drive = driveFalso();
    const pasta = drive.pasta("Logos", "RAIZ");
    const { cliente } = comCache(drive.cliente);
    await cliente.obterItem(pasta);
    await cliente.obterItem(pasta);
    await cliente.listarFilhos(pasta, opcoes);
    await cliente.listarFilhos(pasta, opcoes);
    expect(drive.chamadas).toMatchObject({ obterItem: 1, listarFilhos: 1 });
  });

  it("pergunta de novo depois da validade", async () => {
    const drive = driveFalso();
    const pasta = drive.pasta("Logos", "RAIZ");
    let agora = 0;
    const { cliente } = comCache(drive.cliente, { validadeMs: 1000, agora: () => agora });
    await cliente.listarFilhos(pasta, opcoes);
    agora = 1001;
    drive.arquivo("nova.png", pasta);
    expect((await cliente.listarFilhos(pasta, opcoes)).itens.map((i) => i.nome)).toEqual(["nova.png"]);
  });

  it("listagens de ordens e páginas diferentes não se misturam", async () => {
    const drive = driveFalso();
    const pasta = drive.pasta("Logos", "RAIZ");
    const { cliente } = comCache(drive.cliente);
    await cliente.listarFilhos(pasta, opcoes);
    await cliente.listarFilhos(pasta, { ...opcoes, ordem: "data" });
    await cliente.listarFilhos(pasta, { ...opcoes, pagina: "40" });
    expect(drive.chamadas.listarFilhos).toBe(3);
  });

  it("\"Atualizar\" esquece tudo e mostra o que acabou de chegar ao Drive", async () => {
    const drive = driveFalso();
    const pasta = drive.pasta("Logos", "RAIZ");
    const { cliente, limpar } = comCache(drive.cliente);
    expect((await cliente.listarFilhos(pasta, opcoes)).itens).toHaveLength(0);
    drive.arquivo("nova.png", pasta);
    expect((await cliente.listarFilhos(pasta, opcoes)).itens).toHaveLength(0);
    limpar();
    expect((await cliente.listarFilhos(pasta, opcoes)).itens).toHaveLength(1);
  });

  it("erro do Drive não fica guardado", async () => {
    const drive = driveFalso();
    const pasta = drive.pasta("Logos", "RAIZ");
    drive.falharAoListar(new ErroDoDrive("Drive 500"));
    const { cliente } = comCache(drive.cliente);
    await expect(cliente.listarFilhos(pasta, opcoes)).rejects.toThrow("500");
    await expect(cliente.listarFilhos(pasta, opcoes)).resolves.toMatchObject({ itens: [] });
  });
});

describe("cache de outras respostas caras (o índice da busca)", () => {
  it("guarda por uma validade própria e o \"Atualizar\" também esquece", async () => {
    let agora = 0;
    const { lembrar, limpar } = comCache(driveFalso().cliente, { validadeMs: 1000, agora: () => agora });
    let chamadas = 0;
    const buscar = async () => ++chamadas;
    expect(await lembrar("indice", buscar, 5000)).toBe(1);
    agora = 4000;
    expect(await lembrar("indice", buscar, 5000)).toBe(1);
    agora = 5001;
    expect(await lembrar("indice", buscar, 5000)).toBe(2);
    limpar();
    expect(await lembrar("indice", buscar, 5000)).toBe(3);
  });
});

describe("pedidos iguais ao mesmo tempo", () => {
  it("esperam a mesma resposta, em vez de perguntar duas vezes", async () => {
    const { lembrar } = comCache(driveFalso().cliente);
    let chamadas = 0;
    const lento = async () => {
      chamadas++;
      await new Promise((ok) => setTimeout(ok, 20));
      return "indice";
    };
    expect(await Promise.all([lembrar("i", lento), lembrar("i", lento), lembrar("i", lento)])).toEqual(["indice", "indice", "indice"]);
    expect(chamadas).toBe(1);
  });

  it("um erro no pedido em andamento não fica preso", async () => {
    const { lembrar } = comCache(driveFalso().cliente);
    await expect(lembrar("i", async () => { throw new Error("falhou"); })).rejects.toThrow("falhou");
    await expect(lembrar("i", async () => "ok")).resolves.toBe("ok");
  });
});
