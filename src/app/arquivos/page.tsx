import { ChevronRight, FolderOpen, LayoutGrid, List, RefreshCw, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho } from "@/components/cabecalho";
import { IconeDoAtalho } from "@/components/icone-do-atalho";
import { podeGerenciarContas } from "@/dominio/acesso";
import {
  abrirPasta,
  buscarArquivos,
  enderecoDeArquivos,
  formatarTamanho,
  lerModo,
  lerOrdem,
  lerPagina,
  NOMES_DAS_ORDENS,
  ORDENS,
  situacaoDeArquivos,
  type ItemDeBusca,
  type ItemDeListagem,
  type ModoDeVista,
} from "@/dominio/arquivos";
import { FUSO } from "@/dominio/fuso";
import { atualizarArquivos } from "@/lib/arquivos/acoes";
import { atalhosVisiveis, atalhoVisivel, type AtalhoDeArquivos } from "@/lib/arquivos/consultas";
import { configuracoes } from "@/lib/configuracoes/consultas";
import { exigirLideranca } from "@/lib/contas/perfil";
import { clienteDeArquivos, indiceDeArquivos } from "@/lib/drive/servidor";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { AcoesDoItem } from "./acoes-do-item";
import { IconeDoItem } from "./icone-do-item";

// O Drive do ministério: só para a Liderança, e nunca em buscadores.
export const metadata: Metadata = { title: "Arquivos", robots: { index: false, follow: false } };

const formatarData = (data: Date | null) => (data ? data.toLocaleDateString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" }) : "");

const detalhesDe = (item: ItemDeListagem) => [formatarTamanho(item.tamanho), formatarData(item.modificadoEm)].filter(Boolean).join(" · ");

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div role="status" className="flex flex-col gap-1 rounded-2xl border border-borda bg-superficie p-4">
      <h2 className="font-semibold">{titulo}</h2>
      <p className="text-sm text-texto-suave">{children}</p>
    </div>
  );
}

export default async function PaginaDeArquivos(props: PageProps<"/arquivos">) {
  const eu = await exigirLideranca();
  const admin = podeGerenciarContas(eu);
  const parametros = await props.searchParams;
  const um = (chave: string) => (typeof parametros[chave] === "string" ? (parametros[chave] as string) : undefined);
  const ordem = lerOrdem(um("ordem"));
  const modo = lerModo(um("modo"));
  const pagina = lerPagina(um("pagina"));
  const pastaPedida = um("pasta") ?? null;
  const atalhoPedido = um("atalho") ?? null;
  const termo = (um("q") ?? "").slice(0, 100).trim();

  const supabase = await supabaseDoServidor();
  const [config, atalhos] = await Promise.all([configuracoes(supabase), atalhosVisiveis(supabase)]);
  const cliente = clienteDeArquivos();
  const obterIndice = indiceDeArquivos();
  const raizId = config.drive.pastaRaizId;
  const limiteDeDownloadBytes = config.drive.limiteDeDownloadMb * 1024 * 1024;
  const atalho: AtalhoDeArquivos | null = atalhoPedido ? await atalhoVisivel(supabase, atalhoPedido) : null;
  const situacao = situacaoDeArquivos({
    driveLigado: config.drive.ligado,
    raizId,
    temCliente: cliente !== null,
    atalhoPedido: atalhoPedido !== null,
    atalhoVisivel: atalho !== null,
  });
  const ligado = situacao !== "desligado";
  const atalhoNegado = situacao === "atalho-negado";
  const pronto = situacao === "pronto" && cliente !== null && obterIndice !== null && raizId !== null;

  const buscando = termo !== "";
  const resultado = pronto && !buscando ? await abrirPasta({ cliente, raizId, atalho, pastaId: pastaPedida, ordem, pagina, limiteDeDownloadBytes }) : null;
  const busca = pronto && buscando ? await buscarArquivos({ cliente, raizId, atalho, pastaId: pastaPedida, termo, limiteDeDownloadBytes, obterIndice }) : null;

  const endereco = (mudancas: { atalho?: string | null; pasta?: string | null; ordem?: typeof ordem; modo?: ModoDeVista; pagina?: string | null; busca?: string | null }) =>
    enderecoDeArquivos({ atalho: atalho?.id ?? null, pasta: pastaPedida, ordem, modo, pagina: null, busca: null, ...mudancas });
  const doItem = (item: ItemDeListagem, acao: "miniatura" | "ver" | "baixar") => {
    const parametrosDoItem = new URLSearchParams({ acao });
    if (atalho) parametrosDoItem.set("atalho", atalho.id);
    return `/arquivos/item/${encodeURIComponent(item.id)}?${parametrosDoItem}`;
  };
  const entradaDe = (item: ItemDeListagem, onde?: { nome: string; href: string }) => (
    <Entrada
      item={item}
      modo={modo}
      abrirPasta={item.pasta ? endereco({ pasta: item.id }) : null}
      miniatura={item.previa ? doItem(item, "miniatura") : null}
      ampliar={item.previa ? doItem(item, "ver") : null}
      baixar={item.baixavel ? doItem(item, "baixar") : null}
      onde={onde}
    />
  );
  const classeDaLista = modo === "grade" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" : "flex flex-col divide-y divide-borda rounded-2xl border border-borda bg-superficie";

  const estadoDoDrive = !ligado
    ? "desligado"
    : atalhoNegado || resultado?.estado === "bloqueado" || busca?.estado === "bloqueado"
      ? "bloqueado"
      : resultado?.estado === "erro" || busca?.estado === "erro"
        ? "erro"
        : null;
  const pilula =
    "toque flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-borda bg-superficie px-4 text-sm aria-[current=page]:border-marca aria-[current=page]:bg-marca aria-[current=page]:text-marca-texto";

  return (
    <>
      <Cabecalho admin={admin} lideranca />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 py-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Arquivos</h1>
          <p className="text-sm text-texto-suave">O Drive do ministério, só para ver. Para guardar algo novo, use o próprio Drive.</p>
        </div>

        {estadoDoDrive === "desligado" && (
          <Aviso titulo="Arquivos ainda não está disponível">
            O Drive do ministério está desligado ou sem configuração.
            {admin ? (
              <>
                {" "}
                Ligue-o e informe a pasta raiz em <Link href="/admin/configuracoes" className="underline">Configurações</Link>.
              </>
            ) : (
              " Avise quem administra o Mural."
            )}
          </Aviso>
        )}
        {estadoDoDrive === "bloqueado" && (
          <Aviso titulo="Essa pasta não está disponível">
            Ela não existe ou você não tem acesso a ela por aqui. <Link href="/arquivos" className="underline">Voltar ao início de Arquivos</Link>.
          </Aviso>
        )}
        {estadoDoDrive === "erro" && (
          <Aviso titulo="Não foi possível falar com o Drive agora">Tente de novo em instantes. Se continuar, avise quem administra o Mural.</Aviso>
        )}

        {ligado && atalhos.length > 0 && (
          <nav aria-label="Atalhos" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <Link href="/arquivos" aria-current={!atalho ? "page" : undefined} className={pilula}>
              <FolderOpen aria-hidden className="size-4" />
              Tudo
            </Link>
            {atalhos.map((a) => (
              <Link key={a.id} href={enderecoDeArquivos({ atalho: a.id, ordem, modo })} aria-current={atalho?.id === a.id ? "page" : undefined} className={pilula}>
                <IconeDoAtalho icone={a.icone} className="size-4" />
                {a.nome}
              </Link>
            ))}
          </nav>
        )}

        {pronto && (
          <form action="/arquivos" role="search" className="flex gap-2">
            {atalho && <input type="hidden" name="atalho" value={atalho.id} />}
            {pastaPedida && <input type="hidden" name="pasta" value={pastaPedida} />}
            {ordem !== "nome" && <input type="hidden" name="ordem" value={ordem} />}
            {modo === "lista" && <input type="hidden" name="modo" value="lista" />}
            <label className="flex-1">
              <span className="sr-only">Buscar pelo nome</span>
              <input
                type="search"
                name="q"
                defaultValue={termo}
                placeholder={atalho ? `Buscar em ${atalho.nome}` : "Buscar pelo nome em todo o Drive"}
                maxLength={100}
                className="min-h-11 w-full rounded-lg border border-borda bg-superficie px-3 text-base outline-none focus:border-marca focus:ring-2 focus:ring-marca/30"
              />
            </label>
            <button type="submit" className="toque flex min-h-11 items-center gap-2 rounded-lg border border-borda px-4 text-sm">
              <Search aria-hidden className="size-4" />
              Buscar
            </button>
          </form>
        )}

        {busca?.estado === "termo-curto" && <Aviso titulo="Escreva um pouco mais">Use pelo menos duas letras para buscar.</Aviso>}

        {busca?.estado === "ok" && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-semibold">{busca.resultados.length === 0 ? "Nada encontrado" : `Resultados para “${termo}”`}</h2>
              <Link href={endereco({})} className="toque inline-flex min-h-11 items-center text-sm underline">
                Limpar busca
              </Link>
            </div>
            {busca.somentePastaAtual && (
              <Aviso titulo="A busca em todo o Drive passou do limite">Há pastas demais para olhar de uma vez, então a busca valeu só para esta pasta.</Aviso>
            )}
            {busca.cortada && <p className="text-sm text-texto-suave">Mostrando os 100 primeiros. Use mais palavras para afinar.</p>}
            <ul className={classeDaLista}>
              {busca.resultados.map((item: ItemDeBusca) => (
                <li key={item.id}>{entradaDe(item, { nome: item.paiNome, href: endereco({ pasta: item.paiId }) })}</li>
              ))}
            </ul>
          </>
        )}

        {resultado?.estado === "ok" && (
          <>
            <nav aria-label="Caminho" className="flex flex-wrap items-center gap-1 text-sm">
              {resultado.caminho.map((parte, i) => {
                const ultimo = i === resultado.caminho.length - 1;
                return (
                  <span key={parte.id} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight aria-hidden className="size-4 text-texto-suave" />}
                    {ultimo ? (
                      <span aria-current="page" className="font-semibold">
                        {parte.nome}
                      </span>
                    ) : (
                      <Link
                        href={endereco({ pasta: i === 0 ? null : parte.id })}
                        className="toque inline-flex min-h-9 items-center rounded-md px-1 underline decoration-borda underline-offset-4"
                      >
                        {parte.nome}
                      </Link>
                    )}
                  </span>
                );
              })}
            </nav>

            <div className="flex flex-wrap items-center gap-2">
              <form className="flex items-center gap-2" action="/arquivos">
                {atalho && <input type="hidden" name="atalho" value={atalho.id} />}
                {pastaPedida && <input type="hidden" name="pasta" value={pastaPedida} />}
                {modo === "lista" && <input type="hidden" name="modo" value="lista" />}
                <label className="flex items-center gap-2 text-sm">
                  <span className="sr-only sm:not-sr-only">Ordenar</span>
                  <select
                    name="ordem"
                    defaultValue={ordem}
                    className="min-h-11 rounded-lg border border-borda bg-superficie px-3 text-sm outline-none focus:border-marca focus:ring-2 focus:ring-marca/30"
                  >
                    {ORDENS.map((o) => (
                      <option key={o} value={o}>
                        {NOMES_DAS_ORDENS[o]}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="toque min-h-11 rounded-lg border border-borda px-3 text-sm">
                  Aplicar
                </button>
              </form>
              <div className="ml-auto flex items-center gap-2">
                <div role="group" aria-label="Modo de exibição" className="flex overflow-hidden rounded-lg border border-borda">
                  <Link
                    href={endereco({ modo: "grade" })}
                    aria-label="Grade"
                    aria-current={modo === "grade" ? "true" : undefined}
                    className="toque flex size-11 items-center justify-center aria-[current=true]:bg-marca aria-[current=true]:text-marca-texto"
                  >
                    <LayoutGrid aria-hidden className="size-5" />
                  </Link>
                  <Link
                    href={endereco({ modo: "lista" })}
                    aria-label="Lista"
                    aria-current={modo === "lista" ? "true" : undefined}
                    className="toque flex size-11 items-center justify-center aria-[current=true]:bg-marca aria-[current=true]:text-marca-texto"
                  >
                    <List aria-hidden className="size-5" />
                  </Link>
                </div>
                <form action={atualizarArquivos}>
                  <button type="submit" className="toque flex min-h-11 items-center gap-2 rounded-lg border border-borda px-3 text-sm">
                    <RefreshCw aria-hidden className="size-4" />
                    Atualizar
                  </button>
                </form>
              </div>
            </div>

            {resultado.itens.length === 0 ? (
              <p className="rounded-2xl border border-borda bg-superficie p-4 text-sm text-texto-suave">Esta pasta está vazia.</p>
            ) : (
              <ul className={classeDaLista}>
                {resultado.itens.map((item) => (
                  <li key={item.id}>{entradaDe(item)}</li>
                ))}
              </ul>
            )}

            {resultado.proxima && (
              <Link
                href={endereco({ pagina: resultado.proxima })}
                className="toque flex min-h-12 items-center justify-center rounded-xl border border-borda bg-superficie px-4 text-sm font-medium"
              >
                Ver mais
              </Link>
            )}
            {pagina && (
              <Link href={endereco({ pagina: null })} className="text-center text-sm underline">
                Voltar ao começo desta pasta
              </Link>
            )}
          </>
        )}
      </main>
    </>
  );
}

/**
 * Um item em grade ou em lista. Pasta é um link para dentro dela; arquivo mostra a miniatura (quando é imagem) e as
 * ações. Os endereços de miniatura, ampliação e download são do próprio app; só o link "Abrir no Drive" sai.
 */
function Entrada({
  item,
  modo,
  abrirPasta,
  miniatura,
  ampliar,
  baixar,
  onde,
}: {
  item: ItemDeListagem;
  modo: ModoDeVista;
  abrirPasta: string | null;
  miniatura: string | null;
  ampliar: string | null;
  baixar: string | null;
  /** Nas buscas: a pasta onde o item mora, com o caminho para abri-la. */
  onde?: { nome: string; href: string };
}) {
  const grade = modo === "grade";
  const imagem = (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-fundo text-marca ${grade ? "aspect-[4/3] w-full" : "size-14"}`}>
      {miniatura ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={miniatura} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <IconeDoItem tipo={item.tipo} className={grade ? "size-10" : "size-6"} />
      )}
    </span>
  );
  const texto = (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className={`break-words font-medium ${grade ? "line-clamp-2 text-sm" : ""}`}>{item.nome}</span>
      <span className="text-xs text-texto-suave">{detalhesDe(item)}</span>
    </span>
  );
  const ondeEsta = onde && (
    <Link href={onde.href} className="toque inline-flex min-h-9 items-center text-xs underline">
      em {onde.nome}
    </Link>
  );
  const classe = grade ? "flex h-full flex-col gap-2 rounded-2xl border border-borda bg-superficie p-3" : "flex flex-col gap-2 p-3";

  if (abrirPasta) {
    return (
      <div className={classe}>
        <Link href={abrirPasta} className={`toque flex ${grade ? "flex-col gap-2" : "min-h-14 items-center gap-3"}`}>
          {imagem}
          {texto}
        </Link>
        {ondeEsta}
      </div>
    );
  }
  return (
    <div className={classe}>
      <div className={`flex ${grade ? "flex-col gap-2" : "items-center gap-3"}`}>
        {imagem}
        {texto}
      </div>
      {ondeEsta}
      <AcoesDoItem nome={item.nome} link={item.link} baixar={baixar} ampliar={ampliar} />
    </div>
  );
}
