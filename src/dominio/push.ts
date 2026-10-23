// Notificações push: o que se decide sem rede nem banco. Estado do dispositivo na tela, validação da inscrição que o
// navegador devolve, o conteúdo mínimo da notificação e a entrega por dispositivo. O envio de verdade (web-push) entra
// pelo adaptador `EnviadorDePush`, que os testes trocam por um falso. Endpoint e chaves nunca saem daqui para telas ou Logs.

/** Nome do cookie (só do servidor) com o hash do endpoint deste aparelho: serve para sair da conta removendo a inscrição certa. */
export const COOKIE_DO_DISPOSITIVO = "onda_push";

export type PermissaoDoNavegador = "default" | "granted" | "denied";

export type Ambiente = {
  /** Service worker, PushManager e Notification existem neste navegador. */
  suportado: boolean;
  /** iPhone ou iPad, onde o push só funciona com o app instalado na Tela de Início. */
  apple: boolean;
  instalado: boolean;
  permissao: PermissaoDoNavegador;
  /** O navegador tem uma inscrição de push e o Mural a conhece (este aparelho está na lista). */
  inscrito: boolean;
};

export type EstadoDoPush = "nao_suportado" | "instalar" | "bloqueado" | "ativo" | "inativo";

/** O que a seção "Notificações" mostra neste aparelho. */
export function estadoDoPush(a: Ambiente): EstadoDoPush {
  // iPhone e iPad só têm push (e a API) depois de instalado: a orientação vem antes de qualquer botão.
  if (a.apple && !a.instalado) return "instalar";
  if (!a.suportado) return "nao_suportado";
  if (a.permissao === "denied") return "bloqueado";
  if (a.permissao === "granted" && a.inscrito) return "ativo";
  return "inativo";
}

export type InscricaoRecebida = { endpoint: string; p256dh: string; auth: string };

const BASE64_URL = /^[A-Za-z0-9_-]+={0,2}$/;

/** A inscrição que o navegador devolve (`PushSubscription.toJSON()`), conferida; `null` se não serve. */
export function lerInscricao(bruto: unknown): InscricaoRecebida | null {
  if (typeof bruto !== "object" || bruto === null) return null;
  const { endpoint, keys } = bruto as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } | null };
  if (typeof endpoint !== "string" || endpoint.length > 2000) return null;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  // Serviços de push falam só HTTPS; o resto seria o servidor do Mural chamando um endereço qualquer.
  if (url.protocol !== "https:") return null;
  const p256dh = keys?.p256dh;
  const auth = keys?.auth;
  if (typeof p256dh !== "string" || typeof auth !== "string") return null;
  if (!BASE64_URL.test(p256dh) || !BASE64_URL.test(auth) || p256dh.length > 200 || auth.length > 100) return null;
  return { endpoint, p256dh, auth };
}

/** Um nome amigável para a lista de dispositivos, tirado do navegador; nunca do endpoint. */
export function nomeDoDispositivo(userAgent: string): string {
  const sistema = /iPhone/.test(userAgent)
    ? "iPhone"
    : /iPad/.test(userAgent)
      ? "iPad"
      : /Android/.test(userAgent)
        ? "Android"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Macintosh|Mac OS X/.test(userAgent)
            ? "Mac"
            : /Linux|X11/.test(userAgent)
              ? "Linux"
              : "Aparelho";
  const navegador = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\/|Opera/.test(userAgent)
      ? "Opera"
      : /SamsungBrowser/.test(userAgent)
        ? "Samsung Internet"
        : /Firefox|FxiOS/.test(userAgent)
          ? "Firefox"
          : /Chrome|CriOS/.test(userAgent)
            ? "Chrome"
            : /Safari/.test(userAgent)
              ? "Safari"
              : null;
  return navegador ? `${sistema} · ${navegador}` : sistema;
}

/** O que o service worker recebe: só texto curto, uma `tag` e um caminho do próprio app. Nada de dados de Adolescentes. */
export type ConteudoDaNotificacao = { titulo: string; texto: string; tag: string; url: string };

const corta = (texto: string, limite: number) => (texto.length > limite ? `${texto.slice(0, limite - 1)}…` : texto);

export function montarConteudo(c: ConteudoDaNotificacao): ConteudoDaNotificacao {
  return {
    titulo: corta(c.titulo.trim() || "Mural Onda", 80),
    texto: corta(c.texto.trim(), 160),
    tag: corta(c.tag.trim() || "mural", 60),
    // Só caminho dentro do app: "//outro.site" e "https://…" viram a página inicial.
    url: /^\/(?!\/)/.test(c.url) ? c.url : "/",
  };
}

export const NOTIFICACAO_DE_TESTE: ConteudoDaNotificacao = montarConteudo({
  titulo: "Mural Onda",
  texto: "Notificação de teste: está tudo certo neste aparelho.",
  tag: "teste",
  url: "/conta",
});

export type Dispositivo = { id: string; endpoint: string; p256dh: string; auth: string };

/** O resultado de enviar a um dispositivo: `status` é o HTTP do serviço de push, quando houve resposta. */
export type ResultadoDoEnvio = { ok: true } | { ok: false; status?: number };

export type EnviadorDePush = (dispositivo: Dispositivo, carga: string, opcoes: { ttl: number }) => Promise<ResultadoDoEnvio>;

export type Entrega = {
  enviados: string[];
  /** Inscrições que o serviço de push disse não existirem mais (404 ou 410): saem do banco. */
  expirados: string[];
  falhas: string[];
};

/** O tempo, em segundos, que o serviço de push guarda a notificação se o aparelho estiver desligado. */
export const TTL_PADRAO = 60 * 60;

/**
 * Envia o conteúdo a cada dispositivo separadamente: a falha (ou o erro lançado) de um não atrapalha os outros.
 * Devolve só ids, para quem chama gravar contagens sem endpoint nem chave.
 */
export async function entregar(
  dispositivos: Dispositivo[],
  conteudo: ConteudoDaNotificacao,
  enviar: EnviadorDePush,
  ttl = TTL_PADRAO,
): Promise<Entrega> {
  const carga = JSON.stringify(montarConteudo(conteudo));
  const resultados = await Promise.all(
    dispositivos.map(async (d): Promise<[Dispositivo, ResultadoDoEnvio]> => {
      try {
        return [d, await enviar(d, carga, { ttl })];
      } catch {
        return [d, { ok: false }];
      }
    }),
  );
  const entrega: Entrega = { enviados: [], expirados: [], falhas: [] };
  for (const [d, r] of resultados) {
    if (r.ok) entrega.enviados.push(d.id);
    else if (r.status === 404 || r.status === 410) entrega.expirados.push(d.id);
    else entrega.falhas.push(d.id);
  }
  return entrega;
}
