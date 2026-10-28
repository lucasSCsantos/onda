"use client";

import { useEffect } from "react";

/**
 * Liga os efeitos da página /sobre, todos por atributos data-*: [data-revelar] e [data-gatilho] ganham data-visto ao
 * entrar na janela, [data-contar] conta até o valor, [data-palco] e [data-brilho] seguem o ponteiro. Sem JS (ou com
 * "reduzir movimento") a página aparece inteira e parada.
 */
export function Efeitos() {
  useEffect(() => {
    const raiz = document.querySelector<HTMLElement>("[data-sobre]");
    if (!raiz || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const limpezas: (() => void)[] = [];

    const contadores = [...raiz.querySelectorAll<HTMLElement>("[data-contar]")];
    contadores.forEach((el) => (el.textContent = "0"));
    const contar = (el: HTMLElement) => {
      const alvo = Number(el.dataset.contar);
      const inicio = performance.now();
      const passo = (agora: number) => {
        const t = Math.min((agora - inicio) / 1400, 1);
        el.textContent = Math.round(alvo * (1 - (1 - t) ** 4)).toLocaleString("pt-BR");
        if (t < 1) requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    };

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const { target, isIntersecting } of entradas) {
          if (!isIntersecting) continue;
          const el = target as HTMLElement;
          el.setAttribute("data-visto", "");
          if (el.dataset.contar) contar(el);
          observador.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    raiz.querySelectorAll("[data-revelar], [data-gatilho], [data-contar]").forEach((el) => observador.observe(el));
    raiz.setAttribute("data-pronto", "");
    limpezas.push(() => observador.disconnect());

    // Palco do herói: o ponteiro vira dois números de -1 a 1 que o CSS usa para inclinar e deslocar os celulares.
    raiz.querySelectorAll<HTMLElement>("[data-palco]").forEach((palco) => {
      const mexer = (e: PointerEvent) => {
        const r = palco.getBoundingClientRect();
        palco.style.setProperty("--px", String(Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1))));
        palco.style.setProperty("--py", String(Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1))));
      };
      const soltar = () => {
        palco.style.setProperty("--px", "0");
        palco.style.setProperty("--py", "0");
      };
      palco.addEventListener("pointermove", mexer);
      palco.addEventListener("pointerleave", soltar);
      limpezas.push(() => {
        palco.removeEventListener("pointermove", mexer);
        palco.removeEventListener("pointerleave", soltar);
      });
    });

    // Cartões: o foco de luz acompanha o ponteiro.
    raiz.querySelectorAll<HTMLElement>("[data-brilho]").forEach((cartao) => {
      const mexer = (e: PointerEvent) => {
        const r = cartao.getBoundingClientRect();
        cartao.style.setProperty("--mx", `${e.clientX - r.left}px`);
        cartao.style.setProperty("--my", `${e.clientY - r.top}px`);
      };
      cartao.addEventListener("pointermove", mexer);
      limpezas.push(() => cartao.removeEventListener("pointermove", mexer));
    });

    return () => {
      limpezas.forEach((l) => l());
      raiz.removeAttribute("data-pronto");
    };
  }, []);

  return null;
}
