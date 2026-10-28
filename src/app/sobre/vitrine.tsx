"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";

export type Passo = {
  icone: ReactNode;
  titulo: string;
  texto: string;
  itens: string[];
  tela: { src: string; alt: string };
};

const IMAGEM = { width: 786, height: 1800 };

/**
 * A vitrine das funcionalidades. No computador, o celular fica fixo ao lado e troca de tela conforme o passo que
 * cruza o meio da janela; no celular, cada passo leva a sua própria tela logo abaixo do texto.
 */
export function Vitrine({ passos }: { passos: Passo[] }) {
  const [ativo, setAtivo] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) if (e.isIntersecting) setAtivo(Number((e.target as HTMLElement).dataset.i));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && observador.observe(el));
    return () => observador.disconnect();
  }, []);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_320px] lg:gap-20">
      <div>
        {passos.map((p, i) => (
          <article
            key={p.titulo}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-i={i}
            data-ativo={ativo === i}
            className="s-passo flex flex-col justify-center gap-8 py-12 lg:min-h-[80vh]"
          >
            <div data-revelar>
              <span className="s-icone">{p.icone}</span>
              <h2 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{p.titulo}</h2>
              <p className="mt-4 max-w-xl text-lg text-[var(--s-suave)]">{p.texto}</p>
              <ul className="mt-6 flex max-w-xl flex-col gap-3">
                {p.itens.map((item) => (
                  <li key={item} className="flex gap-3 text-[var(--s-texto)]">
                    <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-[var(--s-azul)] shadow-[0_0_10px_var(--s-azul)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="s-celular mx-auto w-56 sm:w-64 lg:hidden" data-revelar>
              <Image src={p.tela.src} alt={p.tela.alt} {...IMAGEM} sizes="256px" />
            </div>
          </article>
        ))}
      </div>

      <div className="hidden lg:block">
        <div className="sticky top-[11vh]">
          <div className="s-celular mx-auto w-[300px]">
            {passos.map((p, i) => (
              <div key={p.tela.src} className="s-tela" data-ativa={ativo === i}>
                <Image src={p.tela.src} alt={p.tela.alt} {...IMAGEM} sizes="300px" />
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-center gap-2" aria-hidden>
            {passos.map((p, i) => (
              <span key={p.titulo} className="s-indicador" data-ativo={ativo === i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
