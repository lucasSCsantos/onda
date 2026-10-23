import { describe, expect, it } from "vitest";
import {
  entregar,
  estadoDoPush,
  lerInscricao,
  montarConteudo,
  nomeDoDispositivo,
  NOTIFICACAO_DE_TESTE,
  type Ambiente,
  type Dispositivo,
  type EnviadorDePush,
} from "./push";

const ambiente = (parte: Partial<Ambiente> = {}): Ambiente => ({
  suportado: true,
  apple: false,
  instalado: false,
  permissao: "default",
  inscrito: false,
  ...parte,
});

describe("estadoDoPush", () => {
  it("oferece a ativação a quem ainda não decidiu", () => {
    expect(estadoDoPush(ambiente())).toBe("inativo");
  });

  it("mostra ativo só com permissão e inscrição", () => {
    expect(estadoDoPush(ambiente({ permissao: "granted", inscrito: true }))).toBe("ativo");
    expect(estadoDoPush(ambiente({ permissao: "granted", inscrito: false }))).toBe("inativo");
  });

  it("explica como liberar quando o navegador bloqueou", () => {
    expect(estadoDoPush(ambiente({ permissao: "denied" }))).toBe("bloqueado");
  });

  it("avisa que não há suporte", () => {
    expect(estadoDoPush(ambiente({ suportado: false }))).toBe("nao_suportado");
  });

  it("no iPhone e no iPad, orienta a instalar antes de qualquer outra coisa", () => {
    expect(estadoDoPush(ambiente({ apple: true, suportado: false }))).toBe("instalar");
    expect(estadoDoPush(ambiente({ apple: true, instalado: false, permissao: "denied" }))).toBe("instalar");
  });

  it("no iPhone com o app instalado, segue como qualquer outro", () => {
    expect(estadoDoPush(ambiente({ apple: true, instalado: true }))).toBe("inativo");
    expect(estadoDoPush(ambiente({ apple: true, instalado: true, permissao: "granted", inscrito: true }))).toBe("ativo");
  });
});

describe("lerInscricao", () => {
  const boa = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "BNc_x-1", auth: "s3cr_et" } };

  it("aceita a inscrição do navegador", () => {
    expect(lerInscricao(boa)).toEqual({ endpoint: boa.endpoint, p256dh: "BNc_x-1", auth: "s3cr_et" });
  });

  it("recusa o que não é HTTPS, não é endereço ou veio sem chaves", () => {
    expect(lerInscricao({ ...boa, endpoint: "http://fcm.googleapis.com/x" })).toBeNull();
    expect(lerInscricao({ ...boa, endpoint: "não é endereço" })).toBeNull();
    expect(lerInscricao({ endpoint: boa.endpoint })).toBeNull();
    expect(lerInscricao({ ...boa, keys: { p256dh: "BNc", auth: "com espaço" } })).toBeNull();
    expect(lerInscricao(null)).toBeNull();
    expect(lerInscricao("texto")).toBeNull();
  });
});

describe("nomeDoDispositivo", () => {
  it("combina sistema e navegador, sem nada do endpoint", () => {
    expect(nomeDoDispositivo("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Version/17.0 Mobile Safari/604.1")).toBe("iPhone · Safari");
    expect(nomeDoDispositivo("Mozilla/5.0 (Linux; Android 14) AppleWebKit Chrome/120 Mobile Safari/537.36")).toBe("Android · Chrome");
    expect(nomeDoDispositivo("Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537.36 Edg/120")).toBe("Windows · Edge");
    expect(nomeDoDispositivo("")).toBe("Aparelho");
  });
});

describe("montarConteudo", () => {
  it("encurta o texto e fica só com caminhos do próprio app", () => {
    const c = montarConteudo({ titulo: "t".repeat(200), texto: "x".repeat(500), tag: "evento-1", url: "/eventos/1" });
    expect(c.titulo.length).toBeLessThanOrEqual(80);
    expect(c.texto.length).toBeLessThanOrEqual(160);
    expect(c.url).toBe("/eventos/1");
    expect(montarConteudo({ titulo: "a", texto: "b", tag: "c", url: "https://outro.site" }).url).toBe("/");
    expect(montarConteudo({ titulo: "a", texto: "b", tag: "c", url: "//outro.site" }).url).toBe("/");
  });
});

describe("entregar", () => {
  const dispositivo = (id: string): Dispositivo => ({ id, endpoint: `https://push.exemplo/${id}`, p256dh: "k", auth: "a" });

  it("envia a cada dispositivo e conta quem recebeu", async () => {
    const enviados: string[] = [];
    const enviar: EnviadorDePush = async (d) => {
      enviados.push(d.id);
      return { ok: true };
    };
    const r = await entregar([dispositivo("celular"), dispositivo("notebook")], NOTIFICACAO_DE_TESTE, enviar);
    expect(r).toEqual({ enviados: ["celular", "notebook"], expirados: [], falhas: [] });
    expect(enviados).toEqual(["celular", "notebook"]);
  });

  it("separa 404 e 410 (inscrição expirada) das outras falhas, sem afetar quem recebeu", async () => {
    const respostas: Record<string, Awaited<ReturnType<EnviadorDePush>>> = {
      a: { ok: true },
      b: { ok: false, status: 404 },
      c: { ok: false, status: 410 },
      d: { ok: false, status: 500 },
      e: { ok: false },
    };
    const r = await entregar(["a", "b", "c", "d", "e"].map(dispositivo), NOTIFICACAO_DE_TESTE, async (d) => respostas[d.id]);
    expect(r).toEqual({ enviados: ["a"], expirados: ["b", "c"], falhas: ["d", "e"] });
  });

  it("um envio que lança erro vira falha daquele dispositivo", async () => {
    const r = await entregar([dispositivo("a"), dispositivo("b")], NOTIFICACAO_DE_TESTE, async (d) => {
      if (d.id === "a") throw new Error("rede caiu");
      return { ok: true };
    });
    expect(r).toEqual({ enviados: ["b"], expirados: [], falhas: ["a"] });
  });

  it("manda a carga já enxuta e o resultado só tem ids, nunca endpoint nem chave", async () => {
    let carga = "";
    const r = await entregar([dispositivo("a")], { titulo: "Teste", texto: "Oi", tag: "t", url: "https://fora.com" }, async (_, c) => {
      carga = c;
      return { ok: true };
    });
    expect(JSON.parse(carga)).toEqual({ titulo: "Teste", texto: "Oi", tag: "t", url: "/" });
    expect(JSON.stringify(r)).not.toContain("push.exemplo");
  });

  it("sem dispositivos, não há o que enviar", async () => {
    expect(await entregar([], NOTIFICACAO_DE_TESTE, async () => ({ ok: true }))).toEqual({ enviados: [], expirados: [], falhas: [] });
  });
});
