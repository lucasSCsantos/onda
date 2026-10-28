import { ArrowRight, Bell, CalendarDays, ClipboardCheck, ShieldCheck, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import type { CSSProperties } from "react";
import { Marca } from "@/components/marca";
import { Efeitos } from "./efeitos";
import "./sobre.css";
import { Vitrine, type Passo } from "./vitrine";

// A página de apresentação é a única parte do site que os buscadores podem ler (o resto tem dados de menores).
export const metadata: Metadata = {
  title: { absolute: "Mural EBD: a escola bíblica e o ministério de adolescentes num só calendário" },
  description: "Aula de EBD com professor, chamada pelo celular e ranking, e todo o resto do ministério com responsável, status e avisos.",
  robots: { index: true, follow: true },
};

/** Onde falar com quem fez. Novos canais entram aqui. */
const CONTATOS = [
  { nome: "LinkedIn", href: "https://www.linkedin.com/in/lucas-sc-santos" },
  { nome: "GitHub", href: "https://github.com/lucasSCsantos" },
];

const TELAS = {
  inicio: { src: "/sobre/inicio.jpg", alt: "Tela inicial do Mural EBD no celular, com os eventos da semana e os que precisam de atenção." },
  calendario: { src: "/sobre/calendario.jpg", alt: "Calendário do Mural EBD na visão semanal, com os eventos de cada dia coloridos por Categoria." },
  chamada: { src: "/sobre/chamada.jpg", alt: "Chamada de uma aula no celular, com as Marcações de presença de cada adolescente." },
  ranking: { src: "/sobre/ranking.jpg", alt: "Ranking anual dos adolescentes pela soma dos pontos das Marcações." },
  acesso: { src: "/sobre/acesso.jpg", alt: "Lista de usuários com o nível de acesso e as Funções de cada pessoa da liderança." },
  avisos: { src: "/sobre/avisos.jpg", alt: "Central de notificações do Mural EBD, com avisos de aulas e de eventos sem responsável." },
} as const;

const ICONE = "size-6";

const PASSOS: Passo[] = [
  {
    icone: <CalendarDays aria-hidden className={ICONE} />,
    titulo: "Calendário com Eventos, Séries e Status",
    texto: "Todo Evento tem Categoria, Responsável e Status: de Rascunho a Realizado, passando por Cancelado e Adiado.",
    itens: [
      "A EBD semanal é uma Série: cada aula é uma Ocorrência numerada, que pode ser editada ou cancelada sozinha.",
      "Atalhos de filtro ligam e desligam na hora: Meus eventos, Hoje, Sem Responsável, Aula sem Professor, Atrasados.",
      "O que passou da data sem decisão fica parado com alerta até o Responsável resolver.",
    ],
    tela: TELAS.calendario,
  },
  {
    icone: <ClipboardCheck aria-hidden className={ICONE} />,
    titulo: "Chamada e Marcações, pelo celular",
    texto: "O Professor faz a Chamada da aula tocando nas Marcações de cada adolescente. Tudo é salvo na hora.",
    itens: [
      "Presente, Trouxe bíblia, Trouxe visitante, Fez atividade: cada Marcação vale pontos, e a Liderança ajusta o catálogo.",
      "O Alerta de ausência avisa quem faltou a várias aulas seguidas.",
      "Errou um toque? Dá para corrigir depois.",
    ],
    tela: TELAS.chamada,
  },
  {
    icone: <Trophy aria-hidden className={ICONE} />,
    titulo: "Ranking anual, calculado na hora",
    texto: "A soma dos pontos das Marcações vira a classificação do ano, sem ninguém fazer conta.",
    itens: [
      "Usa a pontuação de agora: mudar os pontos refaz também os anos anteriores.",
      "No empate, fica na frente quem tem mais da Marcação de desempate.",
      "Só a Liderança vê.",
    ],
    tela: TELAS.ranking,
  },
  {
    icone: <ShieldCheck aria-hidden className={ICONE} />,
    titulo: "Acesso por Áreas e Funções",
    texto: "Cada pessoa vê e cria só o que é do seu papel no ministério.",
    itens: [
      "A Função de uma pessoa pertence a uma Área (Ensino, Louvor, Comunicação…) e libera os Eventos das Categorias dessa Área.",
      "O Professor vê só as aulas em que foi colocado e faz a Chamada delas.",
      "Quem cria conta sem convite fica Pendente, sem ver nenhum dado, até um Admin aprovar.",
    ],
    tela: TELAS.acesso,
  },
  {
    icone: <Bell aria-hidden className={ICONE} />,
    titulo: "Avisos, assinatura de calendário e Drive",
    texto: "As informações chegam a quem precisa, sem ninguém ter de abrir o app para descobrir.",
    itens: [
      "Notificações por push, guardadas também numa central dentro do app.",
      "A Assinatura de calendário põe os Eventos de cada pessoa no calendário do celular.",
      "A Pasta do Evento de cada aula e pequeno grupo é criada sozinha no Drive; o app nunca apaga nada de lá.",
    ],
    tela: TELAS.avisos,
  },
];

/**
 * Volume que o banco usado nos testes automatizados já guarda (contagem de 28/10/2026, arredondada para baixo; refaça com
 * `select count(*)` em perfis, eventos e adolescentes) e um limite real do produto (10 aparelhos por pessoa no push, em
 * supabase/migrations/20261023120000_push.sql). Não é promessa de "sem limite": a API devolve até 1.000 linhas por consulta.
 */
const NUMEROS: { valor: number; sufixo?: string; unidade: string; rotulo: string }[] = [
  { valor: 3500, sufixo: "+", unidade: "contas", rotulo: "de voluntários, entre Liderança e Professores, cadastradas no banco de testes" },
  { valor: 1400, sufixo: "+", unidade: "Eventos", rotulo: "criados no mesmo banco, em Séries e avulsos, de aula de EBD a acampamento" },
  { valor: 460, sufixo: "+", unidade: "adolescentes", rotulo: "cadastrados, prontos para Chamada, pontos no Ranking e Observações" },
  { valor: 10, unidade: "aparelhos", rotulo: "por pessoa recebendo os avisos por push, entre celular e computador" },
];

const TECNOLOGIAS = ["Next.js 16", "React", "TypeScript", "Supabase", "Postgres", "Políticas por linha", "Vitest", "Playwright", "Tailwind CSS", "PWA instalável", "Web Push", "Google Drive"];

const BASTIDORES = [
  {
    titulo: "Processo de construção",
    texto:
      "Cada funcionalidade nasce de uma entrevista, vira spec e tickets em markdown e é construída em fatias verticais, uma por vez, com revisão antes de cada commit. O vocabulário do ministério fica num glossário e as decisões difíceis de desfazer, em ADRs.",
  },
  {
    titulo: "Testes e segurança",
    texto:
      "A regra de negócio mora num módulo de domínio em TypeScript puro, testado sem banco. As políticas por linha do Postgres têm testes próprios, e a fumaça no Playwright usa um celular simulado. O Log só aceita inserção e é gravado pelo banco; dados de adolescentes, como Gênero e Observações, ficam fora de notificações, calendário assinado e exportações.",
  },
  {
    titulo: "Stack e arquitetura",
    texto:
      "Next.js 16 no front, Supabase (Postgres, autenticação e políticas por linha) no banco, Tailwind CSS e um PWA instalável com push. A interface é fina: não tem regra de negócio própria, só chama o domínio.",
  },
];

const COMANDOS: [string, string][] = [
  ["pnpm test:dominio", "regra de negócio, sem banco"],
  ["pnpm test:rls", "políticas por linha, no Postgres"],
  ["pnpm test:fumaca", "ponta a ponta, num celular simulado"],
  ["pnpm typecheck && pnpm lint", ""],
];

/** Atraso escalonado dos efeitos de entrada. */
const atraso = (ms: number) => ({ "--atraso": `${ms}ms` }) as CSSProperties;

export default function Sobre() {
  return (
    <div className="s-raiz" id="inicio" data-sobre>
      <Efeitos />
      <div className="s-aurora" aria-hidden />
      <div className="s-grade" aria-hidden />
      <div className="s-progresso" aria-hidden />

      <header className="s-cabecalho">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <a href="#inicio" aria-label="Início">
              <Marca qual="logotipo" rotulo="ONDA" className="s-logo h-10 w-16 text-[var(--s-texto)]" />
            </a>
          <nav aria-label="Seções" className="flex items-center gap-6">
            <a href="#funcionalidades" className={`s-link hidden sm:inline`}>
              Funcionalidades
            </a>
            <a href="#bastidores" className={`s-link hidden sm:inline`}>
              Por trás do produto
            </a>
            <a href="#contato" className={`s-botao s-vidro !min-h-10 !px-4 text-sm`}>
              Contato
            </a>
          </nav>
        </div>
      </header>

      <main>
        <div className="mx-auto w-full max-w-6xl px-4">
          <section className="grid items-center gap-6 pb-10 pt-12 lg:grid-cols-[1.05fr_1fr] lg:pb-20 lg:pt-20">
            <div>
              <span className="s-etiqueta" data-revelar>
                <span className="s-ponto" aria-hidden />
                Projeto de demonstração
              </span>
              <h1 className="mt-6 text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl" data-revelar style={atraso(100)}>
                Da EBD ao acampamento, tudo com <span className="s-brilho-texto">alguém responsável.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-[var(--s-suave)] sm:text-xl" data-revelar style={atraso(220)}>
                O Mural EBD começa pela aula de domingo, com professor, chamada e ranking, e leva junto cultos, ensaios, postagens e acampamentos, tudo no celular de quem lidera. Cada Evento tem responsável e status, e ninguém descobre na véspera que a aula está sem professor.
              </p>
              <div className="mt-9 flex flex-wrap gap-3" data-revelar style={atraso(340)}>
                <a href="#contato" className={`s-botao s-primario`}>
                  Falar com quem fez
                  <ArrowRight aria-hidden className="size-5" />
                </a>
                <a href="#funcionalidades" className={`s-botao s-vidro`}>
                  Ver funcionando
                </a>
              </div>
            </div>

            <div className="s-palco" data-palco data-revelar style={atraso(200)}>
              <div className="s-halo" aria-hidden />
              <div className={`s-celular s-lado s-esquerda`}>
                <Image src={TELAS.calendario.src} alt={TELAS.calendario.alt} width={786} height={1800} sizes="200px" />
              </div>
              <div className={`s-celular s-lado s-direita`}>
                <Image src={TELAS.chamada.src} alt={TELAS.chamada.alt} width={786} height={1800} sizes="200px" />
              </div>
              <div className={`s-celular s-heroi`}>
                <Image src={TELAS.inicio.src} alt={TELAS.inicio.alt} width={786} height={1800} sizes="270px" priority />
              </div>
            </div>
          </section>
        </div>

        <section aria-label="O Mural EBD em números" className="s-numeros">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-4 pb-6 pt-12 lg:grid-cols-4">
            {NUMEROS.map(({ valor, sufixo, unidade, rotulo }, i) => (
              <div key={rotulo} data-revelar style={atraso(i * 110)}>
                <div className="s-numero s-brilho-texto flex flex-col gap-1">
                  <span>
                    <span data-contar={valor}>{valor.toLocaleString("pt-BR")}</span>
                    {sufixo}
                  </span>
                  <span className="text-[0.4em] font-semibold tracking-normal">{unidade}</span>
                </div>
                <p className="mt-3 text-sm text-[var(--s-suave)]">{rotulo}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-[var(--s-suave)] opacity-70">
            Volume do banco dos testes automatizados em 28/10/2026, com as regras de acesso valendo; o limite de aparelhos é do produto.
          </p>
        </section>

        <div className={`s-faixa py-8`} aria-hidden>
          <div className="s-trilho">
            {[...TECNOLOGIAS, ...TECNOLOGIAS].map((t, i) => (
              <span key={i} className="s-selo">
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="mx-auto w-full max-w-6xl px-4">
          <section id="funcionalidades" className="scroll-mt-16 pb-8 pt-16">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--s-azul)]" data-revelar>
              O que ele faz
            </p>
            <Vitrine passos={PASSOS} />
          </section>

          <section id="bastidores" className="scroll-mt-16 py-20">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--s-azul)]" data-revelar>
              Para quem avalia o código
            </p>
            <h2 className="mt-3 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl" data-revelar style={atraso(80)}>
              Por trás do produto
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-[var(--s-suave)]" data-revelar style={atraso(160)}>
              Para quem quer saber como foi feito, e não só como funciona.
            </p>

            <div className="mt-12 grid items-start gap-6 lg:grid-cols-[1fr_1.1fr]">
              <div className="s-terminal" data-gatilho data-revelar>
                <div className="s-barra" aria-hidden>
                  <i />
                  <i />
                  <i />
                </div>
                <div className="flex flex-col gap-2 p-5 text-[var(--s-texto)]">
                  {COMANDOS.map(([comando, nota], i) => (
                    <span key={comando} className="s-linha" style={{ "--quando": `${i * 1.3}s` } as CSSProperties}>
                      <span className="text-[var(--s-claro)]">$</span> {comando}
                      {nota && <span className="text-[var(--s-suave)]">{`  # ${nota}`}</span>}
                    </span>
                  ))}
                  <span>
                    <span className="text-[var(--s-claro)]">$</span> <span className="s-cursor" />
                  </span>
                </div>
              </div>

              <div className="grid gap-4">
                {BASTIDORES.map(({ titulo, texto }, i) => (
                  <article key={titulo} className="s-cartao" data-brilho data-revelar style={atraso(i * 120)}>
                    <h3 className="text-xl font-semibold">{titulo}</h3>
                    <p className="mt-2 text-[var(--s-suave)]">{texto}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section id="contato" className={`s-final mb-16 scroll-mt-16 px-6 py-16 text-center sm:py-24`} data-revelar>
            <h2 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">Quer saber como foi feito?</h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-[var(--s-suave)]">O Mural EBD é um projeto de demonstração, não está à venda. Mas é um bom assunto: fale comigo.</p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              {CONTATOS.map(({ nome, href }) => (
                <a key={nome} href={href} className={`s-botao s-primario`} rel="noopener">
                  {nome}
                  <ArrowRight aria-hidden className="size-5" />
                </a>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
