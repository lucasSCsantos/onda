"use client";

import { Bell, CalendarDays, ClipboardCheck, FolderOpen, GraduationCap, LayoutDashboard, LogOut, Menu, Trophy, UserRound, Users, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { CAMINHO_DOS_PROFESSORES } from "@/dominio/professores";
import { sair } from "@/lib/auth/acoes";
import { PAINEL, SECOES_DE_ADMIN } from "./destinos-admin";

type Destino = { href: string; rotulo: string; icone: LucideIcon };

const CALENDARIO: Destino = { href: "/calendario", rotulo: "Calendário", icone: CalendarDays };
const ADOLESCENTES: Destino = { href: "/adolescentes", rotulo: "Adolescentes", icone: Users };
const PRESENCA: Destino = { href: "/presenca", rotulo: "Presença", icone: ClipboardCheck };
const ARQUIVOS: Destino = { href: "/arquivos", rotulo: "Arquivos", icone: FolderOpen };
const RANKING: Destino = { href: "/ranking", rotulo: "Ranking", icone: Trophy };
const PROFESSORES: Destino = { href: CAMINHO_DOS_PROFESSORES, rotulo: "Professores", icone: GraduationCap };
const NOTIFICACOES: Destino = { href: "/notificacoes", rotulo: "Notificações", icone: Bell };
const MINHA_CONTA: Destino = { href: "/conta", rotulo: "Minha conta", icone: UserRound };
const ADMINISTRACAO: Destino = { href: "/admin", rotulo: "Administração", icone: LayoutDashboard };

/** O número de Notificações não lidas, ao lado do item do menu. */
function Indicador({ quantas }: { quantas: number }) {
  return (
    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-marca px-1.5 text-xs font-semibold text-white">
      <span aria-hidden>{quantas > 99 ? "99+" : quantas}</span>
      <span className="sr-only">{quantas === 1 ? "não lida" : "não lidas"}: {quantas}</span>
    </span>
  );
}

/**
 * Menu do cabeçalho: hambúrguer com painel abaixo do header no celular e itens em linha, com cara de botão, a partir de
 * `md`. Quem vê cada destino vem de fora; aqui só se desenha.
 */
export function MenuDoCabecalho({
  admin,
  lideranca,
  calendario,
  professores,
  naoLidas = 0,
}: {
  admin: boolean;
  lideranca: boolean;
  calendario: boolean;
  professores: boolean;
  /** Notificações ainda não lidas, para o indicador. */
  naoLidas?: number;
}) {
  const destinos = [
    ...(calendario ? [CALENDARIO] : []),
    ...(lideranca ? [ADOLESCENTES, PRESENCA, RANKING, ARQUIVOS] : []),
    // O Admin chega a Professores pelo menu da administração, dentro do Admin.
    ...(professores && !admin ? [PROFESSORES] : []),
    ...(admin ? [ADMINISTRACAO] : []),
    NOTIFICACOES,
    MINHA_CONTA,
  ];
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const idDoPainel = useId();

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAberto(false);
      botao.current?.focus();
    };
    const aoTocarFora = (e: PointerEvent) => {
      if (raiz.current?.contains(e.target as Node)) return;
      setAberto(false);
      // O foco só volta ao botão se o toque não levou o foco a outro lugar (um campo, por exemplo).
      requestAnimationFrame(() => {
        if (document.activeElement === document.body) botao.current?.focus();
      });
    };
    document.addEventListener("keydown", aoTeclar);
    document.addEventListener("pointerdown", aoTocarFora);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("pointerdown", aoTocarFora);
    };
  }, [aberto]);

  // No celular, a navegação das telas de administração (a sidebar do desktop) vem junto no menu.
  const secoes = admin && (caminho === "/admin" || caminho.startsWith("/admin/")) ? [PAINEL, ...SECOES_DE_ADMIN] : [];
  const atual = (href: string) => caminho === href || caminho.startsWith(`${href}/`);
  // Dentro das seções, o Painel só é o atual na raiz (todas as outras também começam com `/admin`).
  const atualNaSecao = (href: string) => (href === PAINEL.href ? caminho === href : atual(href));
  const escolher = () => {
    setAberto(false);
    botao.current?.focus();
  };

  return (
    <div ref={raiz}>
      <button
        ref={botao}
        type="button"
        className="botao-secundario md:hidden"
        aria-expanded={aberto}
        aria-controls={idDoPainel}
        aria-label={`${aberto ? "Fechar menu" : "Abrir menu"}${naoLidas > 0 ? ` (${naoLidas} ${naoLidas === 1 ? "notificação não lida" : "notificações não lidas"})` : ""}`}
        onClick={() => setAberto((a) => !a)}
      >
        <span className="relative">
          {aberto ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
          {!aberto && naoLidas > 0 && <span aria-hidden className="absolute -top-1 -right-1 size-2.5 rounded-full bg-marca" />}
        </span>
      </button>

      <nav aria-label="Principal" className="hidden items-center gap-1 text-sm md:flex">
        {destinos.map(({ href, rotulo, icone: Icone }) => (
          <Link
            key={href}
            href={href}
            aria-current={atual(href) ? "page" : undefined}
            className="toque inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-texto-suave hover:bg-fundo hover:text-texto active:bg-borda aria-[current=page]:bg-fundo aria-[current=page]:font-semibold aria-[current=page]:text-texto"
          >
            <Icone aria-hidden className="size-4" />
            {rotulo}
            {href === NOTIFICACOES.href && naoLidas > 0 && <Indicador quantas={naoLidas} />}
          </Link>
        ))}
        <form action={sair}>
          <button
            type="submit"
            className="toque inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-texto-suave hover:bg-fundo hover:text-texto active:bg-borda"
          >
            <LogOut aria-hidden className="size-4" />
            Sair
          </button>
        </form>
      </nav>

      {aberto && (
        <nav
          id={idDoPainel}
          aria-label="Principal"
          className="absolute inset-x-0 top-full z-30 flex flex-col gap-1 border-b border-borda bg-superficie p-3 shadow-lg md:hidden"
        >
          {destinos.map(({ href, rotulo, icone: Icone }) => (
            <Link
              key={href}
              href={href}
              onClick={escolher}
              aria-current={atual(href) ? "page" : undefined}
              className="toque flex min-h-12 items-center gap-3 rounded-xl px-3 font-medium text-texto hover:bg-fundo active:bg-borda aria-[current=page]:bg-fundo aria-[current=page]:text-marca"
            >
              <Icone aria-hidden className="size-5" />
              {rotulo}
              {href === NOTIFICACOES.href && naoLidas > 0 && <Indicador quantas={naoLidas} />}
            </Link>
          ))}
          {secoes.length > 0 && (
            <div className="mt-1 flex flex-col gap-1 border-t border-borda pt-2">
              <p className="px-3 text-xs font-semibold tracking-wide text-texto-suave uppercase">Administração</p>
              {secoes.map(({ href, rotulo, icone: Icone }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={escolher}
                  aria-current={atualNaSecao(href) ? "page" : undefined}
                  className="toque flex min-h-12 items-center gap-3 rounded-xl px-3 font-medium text-texto hover:bg-fundo active:bg-borda aria-[current=page]:bg-fundo aria-[current=page]:text-marca"
                >
                  <Icone aria-hidden className="size-5" />
                  {rotulo}
                </Link>
              ))}
            </div>
          )}
          <form action={sair} className="mt-1 border-t border-borda pt-2">
            <button
              type="submit"
              className="toque flex min-h-12 w-full items-center gap-3 rounded-xl px-3 font-medium text-texto-suave hover:bg-fundo active:bg-borda"
            >
              <LogOut aria-hidden className="size-5" />
              Sair
            </button>
          </form>
        </nav>
      )}
    </div>
  );
}
