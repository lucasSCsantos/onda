import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * Gera as imagens da página /sobre (public/sobre/*.jpg): `pnpm gerar:capturas`.
 *
 * O banco de desenvolvimento acumula milhares de linhas dos testes e tem gente de verdade, então as capturas saem de um
 * Supabase à parte, limpo, com só os dados fictícios daqui. Para subir um (portas 556xx, sem tocar no 553xx):
 *   1. copie `supabase/` para uma pasta nova (sem `.temp`) e, no `config.toml` da cópia, troque `project_id` e as portas;
 *   2. `pnpm exec supabase start --workdir <pasta>`;
 *   3. `CAPTURAS_SUPABASE_WORKDIR=<pasta> pnpm gerar:capturas`.
 * O gerador só semeia um banco vazio: para repetir, `pnpm exec supabase db reset --workdir <pasta>` antes.
 * A marca do ONDA é trocada por "Mural" no próprio navegador, só na hora da foto; o app não muda.
 */

const WORKDIR = process.env.CAPTURAS_SUPABASE_WORKDIR ?? "";
const saida = execSync(`pnpm exec supabase status -o env --workdir "${WORKDIR}"`, { encoding: "utf8" });
const lerAmbiente = (nome: string) => saida.match(new RegExp(`^${nome}="?([^"\r\n]*)"?`, "m"))?.[1] ?? "";
const admin = createClient(lerAmbiente("API_URL"), lerAmbiente("SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SENHA = "senha-das-capturas-123";
const FUSO = "-03:00";

const dia = (base: Date, somar: number) => {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + somar);
  return d.toISOString().slice(0, 10);
};
const quando = (data: string, hora: string) => new Date(`${data}T${hora}:00${FUSO}`).toISOString();

async function criarConta(nome: string, email: string, nivel: "admin" | "lider" | "professor" | "pendente", nascimento: string, genero: "masculino" | "feminino") {
  const { data } = await admin.auth.admin.createUser({ email, password: SENHA, email_confirm: true, user_metadata: { nome } });
  const id = data.user!.id;
  await admin.from("perfis").update({ nome, nivel, data_nascimento: nascimento, genero }).eq("id", id).throwOnError();
  return id;
}

async function semear() {
  const hoje = new Date();
  const domingoPassado = dia(hoje, -((hoje.getUTCDay() + 7) % 7 || 7));

  const marina = await criarConta("Marina Costa", "marina@mural.exemplo", "admin", "1990-04-12", "feminino");
  const rafael = await criarConta("Rafael Nogueira", "rafael@mural.exemplo", "lider", "1994-08-03", "masculino");
  const beatriz = await criarConta("Beatriz Lima", "beatriz@mural.exemplo", "lider", "1996-01-21", "feminino");
  const tiago = await criarConta("Tiago Ferraz", "tiago@mural.exemplo", "lider", "1998-11-09", "masculino");
  await criarConta("Carolina Reis", "carolina@mural.exemplo", "pendente", "1997-02-17", "feminino");
  const helena = await criarConta("Helena Duarte", "helena@mural.exemplo", "professor", "1992-06-30", "feminino");

  const funcoes = (await admin.from("funcoes").select("id, nome").throwOnError()).data!;
  const funcao = (nome: string) => funcoes.find((f) => f.nome === nome)!.id;
  await admin.from("funcoes_das_pessoas").insert([
    { pessoa_id: marina, funcao_id: funcao("Líder do ministério") },
    { pessoa_id: rafael, funcao_id: funcao("Líder do louvor") },
    { pessoa_id: beatriz, funcao_id: funcao("Líder do ensino") },
    { pessoa_id: tiago, funcao_id: funcao("Líder de comunicação e mídia") },
  ]).throwOnError();

  const categorias = (await admin.from("categorias").select("id, nome").throwOnError()).data!;
  const categoria = (nome: string) => categorias.find((c) => c.nome === nome)!.id;
  const campos = (await admin.from("campos_das_categorias").select("id, nome, categoria_id").throwOnError()).data!;
  const campo = (cat: string, nome: string) => campos.find((c) => c.categoria_id === categoria(cat) && c.nome === nome)!.id;

  // Adolescentes fictícios; nenhum nome vem de gente real.
  const nomes: [string, string, "masculino" | "feminino"][] = [
    ["Ana Clara Moura", "2011-03-14", "feminino"], ["Davi Salgado", "2010-09-02", "masculino"], ["Isabela Prado", "2011-12-25", "feminino"],
    ["Lucas Menezes", "2009-05-18", "masculino"], ["Sofia Tavares", "2010-01-30", "feminino"], ["Pedro Henrique Alves", "2011-07-11", "masculino"],
    ["Laura Figueiredo", "2009-10-08", "feminino"], ["Gabriel Rocha", "2010-04-22", "masculino"], ["Maria Eduarda Silva", "2011-02-05", "feminino"],
    ["Miguel Barreto", "2009-11-19", "masculino"], ["Júlia Cardoso", "2010-08-27", "feminino"], ["Enzo Carvalho", "2011-06-09", "masculino"],
  ];
  const adolescentes = (await admin.from("adolescentes").insert(nomes.map(([nome, nascimento, genero]) => ({ nome, nascimento, genero }))).select("id").throwOnError()).data!;

  // EBD semanal: 3 aulas passadas com Chamada, a de hoje ou a próxima e mais algumas à frente, numeradas na ordem das datas.
  const serie = (await admin.from("series").insert({
    categoria_id: categoria("EBD"), regra: { dias: [0], termino: { ocorrencias: 8 }, frequencia: "semanal" }, primeiro_dia: dia(new Date(`${domingoPassado}T12:00:00Z`), -21), criado_por: marina,
  }).select("id").single().throwOnError()).data!;
  const temas = ["Quem é Jesus?", "O fruto do Espírito", "Amizade e verdade", "Fé na prática", "Perdão", "Coragem", "Servir com alegria", "Gratidão"];
  const primeiro = new Date(`${domingoPassado}T12:00:00Z`);
  const aulas = [];
  for (let i = 0; i < 8; i++) {
    const data = dia(primeiro, 7 * (i - 3));
    const passada = i < 4;
    aulas.push({
      titulo: "Aula de EBD", categoria_id: categoria("EBD"), inicio: quando(data, "09:00"), fim: quando(data, "10:00"), local: "Sala dos adolescentes",
      responsavel_id: beatriz, status: passada ? "confirmado" : i === 4 ? "confirmado" : "planejado",
      campos: { [campo("EBD", "Tema")]: temas[i], [campo("EBD", "Professor")]: helena },
      criado_por: marina, serie_id: serie.id, numero_da_ocorrencia: i + 1,
    });
  }
  const ebds = (await admin.from("eventos").insert(aulas).select("id, inicio, numero_da_ocorrencia").order("inicio").throwOnError()).data!;

  // Um Evento novo não nasce Realizado: as quatro primeiras aulas já passaram e são marcadas agora.
  await admin.from("eventos").update({ status: "realizado" }).in("id", ebds.slice(0, 4).map((a) => a.id)).throwOnError();

  // Chamadas das aulas já realizadas: cada Adolescente com suas Marcações, para o Ranking ter história.
  const marcacoes = (await admin.from("marcacoes").select("id, nome").throwOnError()).data!;
  const marcacao = (nome: string) => marcacoes.find((m) => m.nome === nome)!.id;
  for (const [i, aula] of ebds.slice(0, 4).entries()) {
    const presentes = adolescentes.filter((_, k) => (k * 7 + i * 3) % 10 !== 0);
    const presencas = (await admin.from("presencas").insert(presentes.map((a) => ({ evento_id: aula.id, adolescente_id: a.id, registrado_por: helena }))).select("id, adolescente_id").throwOnError()).data!;
    const itens = presencas.flatMap((p, k) => [
      { presenca_id: p.id, marcacao_id: marcacao("Presente") },
      ...((k + i) % 2 === 0 ? [{ presenca_id: p.id, marcacao_id: marcacao("Trouxe bíblia") }] : []),
      ...((k + i) % 3 === 0 ? [{ presenca_id: p.id, marcacao_id: marcacao("Fez atividade") }] : []),
      ...(k === 2 ? [{ presenca_id: p.id, marcacao_id: marcacao("Trouxe visitante"), visitante: "Caio" }] : []),
    ]);
    await admin.from("marcacoes_das_presencas").insert(itens).throwOnError();
  }

  // O resto do calendário: um pouco de cada Categoria, em Status variados.
  await admin.from("eventos").insert(
    [
    { titulo: "Culto de jovens", categoria_id: categoria("Culto"), inicio: quando(dia(hoje, 3), "19:30"), fim: quando(dia(hoje, 3), "21:00"), local: "Templo principal", responsavel_id: rafael, status: "confirmado", criado_por: marina },
    { titulo: "Ensaio do louvor", categoria_id: categoria("Ensaio de louvor"), inicio: quando(dia(hoje, 1), "19:00"), fim: quando(dia(hoje, 1), "20:30"), local: "Sala de música", responsavel_id: rafael, status: "planejado", criado_por: marina },
    { titulo: "Pequeno grupo · Norte", categoria_id: categoria("Pequeno grupo"), inicio: quando(dia(hoje, 4), "15:00"), local: "Casa do anfitrião", campos: { [campo("Pequeno grupo", "Grupo")]: "Grupo único" }, responsavel_id: beatriz, status: "planejado", criado_por: marina },
    { titulo: "Reunião de liderança", categoria_id: categoria("Reunião de liderança"), inicio: quando(dia(hoje, 2), "20:00"), local: "Online", responsavel_id: marina, status: "confirmado", criado_por: marina },
    { titulo: "Post: convite do acampamento", categoria_id: categoria("Postagem"), inicio: quando(dia(hoje, 1), "12:00"), campos: { [campo("Postagem", "Plataforma")]: "Instagram" }, responsavel_id: tiago, status: "planejado", criado_por: marina },
    { titulo: "Post: versículo da semana", categoria_id: categoria("Postagem"), inicio: quando(dia(hoje, 3), "08:00"), campos: { [campo("Postagem", "Plataforma")]: "Instagram" }, status: "rascunho", criado_por: marina },
    { titulo: "Gincana de integração", categoria_id: categoria("Evento extra"), inicio: quando(dia(hoje, 13), "16:00"), fim: quando(dia(hoje, 13), "19:00"), local: "Quadra da igreja", campos: { [campo("Evento extra", "Tipo")]: "Gincana", [campo("Evento extra", "O que levar")]: ["Garrafa de água", "Tênis"] }, responsavel_id: marina, status: "planejado", criado_por: marina },
    { titulo: "Acampamento de verão", categoria_id: categoria("Acampamento"), inicio: quando(dia(hoje, 35), "08:00"), fim: quando(dia(hoje, 37), "17:00"), local: "Sítio Recanto", responsavel_id: marina, status: "planejado", criado_por: marina },
  ].map((e) => ({ campos: {}, ...e })),
  ).throwOnError();

  await admin.from("eventos").update({ status: "adiado" }).eq("titulo", "Gincana de integração").throwOnError();

  await admin.from("notificacoes").insert([
    { pessoa_id: marina, tipo: "evento_lembrete", titulo: "Aula de EBD · 5 é domingo", texto: "Tema: Perdão. Professora: Helena Duarte.", url: "/calendario", estado: "enviada" },
    { pessoa_id: marina, tipo: "evento_sem_responsavel", titulo: "Evento sem Responsável", texto: "Post: versículo da semana ainda é Rascunho.", url: "/calendario", estado: "enviada" },
    { pessoa_id: marina, tipo: "evento_adiado", titulo: "Gincana de integração foi adiada", texto: "Marque uma nova data para voltar a Planejado.", url: "/calendario", estado: "enviada" },
  ]).throwOnError();

  return { ultimaAula: ebds[3].id };
}

/** Troca a marca do ONDA pela do Mural no navegador, na hora da foto. */
async function neutralizar(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll('[role="img"][aria-label="ONDA"]').forEach((el) => {
      el.removeAttribute("aria-label");
      el.innerHTML = '<span style="font-weight:700;font-size:1.25rem;letter-spacing:-0.02em">Mural</span>';
    });
    document.querySelector("footer")?.remove();
    const passeio = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = passeio.nextNode(); n; n = passeio.nextNode()) if (n.nodeValue?.includes("ONDA")) n.nodeValue = n.nodeValue.replaceAll("ONDA", "Mural");
  });
}

test("gera as capturas da página /sobre", async ({ page }) => {
  test.setTimeout(240_000);
  const { ultimaAula } = await semear();
  mkdirSync("public/sobre", { recursive: true });
  // Mais alta que o celular de verdade: a página mostra cada tela dentro de uma moldura, e a parte útil vem logo abaixo do cabeçalho.
  await page.setViewportSize({ width: 393, height: 900 });

  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill("marina@mural.exemplo");
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Próximos eventos" })).toBeVisible();

  const telas: [string, string, string][] = [
    ["inicio", "/", "Esta semana"],
    ["calendario", "/calendario?visao=semana", ""],
    ["chamada", `/eventos/${ultimaAula}/chamada`, "Chamada"],
    ["ranking", "/ranking", "Ranking"],
    ["acesso", "/admin/usuarios", "Usuários"],
    ["avisos", "/notificacoes", "Notificações"],
  ];
  for (const [nome, caminho, titulo] of telas) {
    await page.goto(caminho);
    if (titulo) await expect(page.getByRole("heading", { name: new RegExp(titulo) }).first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    await neutralizar(page);
    await page.screenshot({ path: `public/sobre/${nome}.jpg`, type: "jpeg", quality: 82 });
  }
});
