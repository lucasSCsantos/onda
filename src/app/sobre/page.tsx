import { ArrowRight, CalendarDays, ClipboardCheck, Bell, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import type { ReactNode } from "react";

// A página de apresentação é a única parte do site que os buscadores podem ler (o resto tem dados de menores).
export const metadata: Metadata = {
  title: { absolute: "Mural: o calendário do ministério de adolescentes" },
  description: "Eventos com responsável e status, chamada pelo celular, ranking, acesso por Áreas e avisos, num só lugar.",
  robots: { index: true, follow: true },
};

/** Onde falar com quem fez. Novos canais entram aqui. */
const CONTATOS = [{ nome: "GitHub", href: "https://github.com/lucasSCsantos" }];

const TELAS = {
  inicio: { src: "/sobre/inicio.jpg", alt: "Tela inicial do Mural no celular, com os eventos da semana e os que precisam de atenção." },
  calendario: { src: "/sobre/calendario.jpg", alt: "Calendário do Mural na visão semanal, com os eventos de cada dia coloridos por Categoria." },
  chamada: { src: "/sobre/chamada.jpg", alt: "Chamada de uma aula no celular, com as Marcações de presença de cada adolescente." },
  ranking: { src: "/sobre/ranking.jpg", alt: "Ranking anual dos adolescentes pela soma dos pontos das Marcações." },
  acesso: { src: "/sobre/acesso.jpg", alt: "Lista de usuários com o nível de acesso e as Funções de cada pessoa da liderança." },
  avisos: { src: "/sobre/avisos.jpg", alt: "Central de notificações do Mural, com avisos de aulas e de eventos sem responsável." },
} as const;

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

/** Uma tela do produto numa moldura de celular; a imagem é mais alta que a moldura, e o recorte mostra o topo. */
function Celular({ tela }: { tela: keyof typeof TELAS }) {
  const { src, alt } = TELAS[tela];
  return (
    <div className="mx-auto aspect-[9/17] w-56 shrink-0 overflow-hidden rounded-[2rem] border-[6px] border-texto bg-superficie shadow-xl sm:w-64">
      <Image src={src} alt={alt} width={786} height={1800} className="h-full w-full object-cover object-top" sizes="256px" />
    </div>
  );
}

function Bloco({ icone, titulo, texto, itens, telas, invertido }: { icone: ReactNode; titulo: string; texto: string; itens: string[]; telas: (keyof typeof TELAS)[]; invertido?: boolean }) {
  return (
    <section className="grid items-center gap-10 py-14 md:grid-cols-2 md:gap-14">
      <div className={invertido ? "md:order-2" : ""}>
        <span className="inline-flex size-11 items-center justify-center rounded-xl bg-marca text-marca-texto">{icone}</span>
        <h2 className="mt-4 text-2xl font-semibold sm:text-3xl">{titulo}</h2>
        <p className="mt-3 text-texto-suave">{texto}</p>
        <ul className="mt-5 flex flex-col gap-2">
          {itens.map((item) => (
            <li key={item} className="flex gap-3">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-destaque" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex justify-center gap-4">
        {telas.map((t) => (
          <Celular key={t} tela={t} />
        ))}
      </div>
    </section>
  );
}

export default function Sobre() {
  return (
    <>
      <header className="border-b border-borda bg-superficie">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-xl font-bold tracking-tight">Mural</span>
          <nav aria-label="Seções" className="flex items-center gap-5 text-sm">
            <a href="#bastidores" className="hidden text-texto-suave hover:text-texto sm:inline">
              Por trás do produto
            </a>
            <a href="#contato" className="botao-secundario">
              Contato
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4">
        <section className="grid items-center gap-10 py-14 md:grid-cols-[1.2fr_1fr] md:py-20">
          <div>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">O calendário do ministério, com um responsável por cada atividade.</h1>
            <p className="mt-5 max-w-xl text-lg text-texto-suave">
              O Mural reúne aulas, cultos, ensaios, postagens e acampamentos num só lugar, no celular de quem lidera. Cada Evento tem responsável e
              status, e ninguém descobre na véspera que a aula está sem professor.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#contato" className="botao-primario">
                Falar com quem fez
                <ArrowRight aria-hidden className="size-5" />
              </a>
              <a href="#bastidores" className="botao-secundario">
                Ver por dentro
              </a>
            </div>
          </div>
          <Celular tela="inicio" />
        </section>

        <div className="divide-y divide-borda border-t border-borda">
          <Bloco
            icone={<CalendarDays aria-hidden className="size-6" />}
            titulo="Calendário com Eventos, Séries e Status"
            texto="Todo Evento tem Categoria, Responsável e Status: de Rascunho a Realizado, passando por Cancelado e Adiado."
            itens={[
              "A EBD semanal é uma Série: cada aula é uma Ocorrência numerada, que pode ser editada ou cancelada sozinha.",
              "Atalhos de filtro ligam e desligam na hora: Meus eventos, Hoje, Sem Responsável, Aula sem Professor, Atrasados.",
              "O que passou da data sem decisão fica parado com alerta até o Responsável resolver.",
            ]}
            telas={["calendario"]}
          />
          <Bloco
            icone={<ClipboardCheck aria-hidden className="size-6" />}
            titulo="Chamada, Marcações e Ranking"
            texto="O Professor faz a Chamada da aula pelo celular, tocando nas Marcações de cada adolescente."
            itens={[
              "Presente, Trouxe bíblia, Trouxe visitante, Fez atividade: cada Marcação vale pontos, e a Liderança ajusta o catálogo.",
              "O Alerta de ausência avisa quem faltou a várias aulas seguidas.",
              "O Ranking anual é calculado na hora, com a pontuação de agora, e só a Liderança o vê.",
            ]}
            telas={["chamada", "ranking"]}
            invertido
          />
          <Bloco
            icone={<ShieldCheck aria-hidden className="size-6" />}
            titulo="Acesso por Áreas e Funções"
            texto="Cada pessoa vê e cria só o que é do seu papel no ministério."
            itens={[
              "A Função de uma pessoa pertence a uma Área (Ensino, Louvor, Comunicação…) e libera os Eventos das Categorias dessa Área.",
              "O Professor vê só as aulas em que foi colocado e faz a Chamada delas.",
              "Quem cria conta sem convite fica Pendente, sem ver nenhum dado, até um Admin aprovar.",
            ]}
            telas={["acesso"]}
          />
          <Bloco
            icone={<Bell aria-hidden className="size-6" />}
            titulo="Avisos, assinatura de calendário e Drive"
            texto="As informações chegam a quem precisa, sem ninguém ter de abrir o app para descobrir."
            itens={[
              "Notificações por push, guardadas também numa central dentro do app.",
              "A Assinatura de calendário põe os Eventos de cada pessoa no calendário do celular.",
              "A Pasta do Evento de cada aula e pequeno grupo é criada sozinha no Drive; o app nunca apaga nada de lá.",
            ]}
            telas={["avisos"]}
            invertido
          />
        </div>

        <section id="bastidores" className="scroll-mt-4 border-t border-borda py-14">
          <h2 className="text-2xl font-semibold sm:text-3xl">Por trás do produto</h2>
          <p className="mt-3 max-w-2xl text-texto-suave">Para quem quer saber como foi feito, e não só como funciona.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {BASTIDORES.map(({ titulo, texto }) => (
              <article key={titulo} className="rounded-2xl border border-borda bg-superficie p-5">
                <h3 className="text-lg font-semibold">{titulo}</h3>
                <p className="mt-2 text-sm text-texto-suave">{texto}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="contato" className="scroll-mt-4 mb-14 rounded-3xl bg-marca px-6 py-12 text-center text-marca-texto">
          <h2 className="text-2xl font-semibold sm:text-3xl">Quer saber como foi feito?</h2>
          <p className="mx-auto mt-3 max-w-xl opacity-90">O Mural é um projeto de demonstração, não está à venda. Mas é um bom assunto: fale comigo.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {CONTATOS.map(({ nome, href }) => (
              <a key={nome} href={href} className="botao-secundario" rel="noopener">
                {nome}
              </a>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
