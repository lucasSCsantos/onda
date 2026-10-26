import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

/** Fumaça da tela de administração das Notificações, no tamanho de tela de um celular. */

const saida = execSync("pnpm exec supabase status -o env", { encoding: "utf8" });
const lerAmbiente = (nome: string) => saida.match(new RegExp(`^${nome}="?([^"\r\n]*)"?`, "m"))?.[1] ?? "";
const admin = createClient(lerAmbiente("API_URL"), lerAmbiente("SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SENHA = "senha-de-teste-123";

async function cadastrar(page: Page, nome: string, convite: string) {
  await page.goto(`/cadastro?convite=${convite}`);
  await page.getByLabel("Nome").fill(nome);
  await page.getByLabel("E-mail").fill(`${crypto.randomUUID()}@teste.onda`);
  await page.getByLabel("Data de nascimento").fill("1995-05-10");
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("button", { name: "Abrir menu" })).toBeVisible();
}

test("Notificações no Admin: a tela está no menu, mostra a fila e salva os horários; o Líder não entra", async ({ page }) => {
  const antes = await admin.from("configuracoes").select("*").single().throwOnError();
  try {
    const convite = await admin.from("convites").insert({ nivel: "admin" }).select("codigo").single().throwOnError();
    await cadastrar(page, "Admin das Notificações", convite.data.codigo);

    await page.getByRole("button", { name: "Abrir menu" }).click();
    await page.getByRole("link", { name: "Administração" }).click();
    await page.getByRole("region", { name: "Seções" }).getByRole("link", { name: /Notificações/ }).click();
    await expect(page).toHaveURL(/\/admin\/notificacoes$/);
    await expect(page.getByRole("heading", { name: "Notificações", exact: true })).toBeVisible();

    const situacao = page.getByRole("region", { name: "Situação" });
    await expect(situacao.getByText("Canal")).toBeVisible();
    await expect(situacao.getByText(/pessoas? com dispositivo/)).toBeVisible();
    for (const titulo of ["Pendentes", "Enviadas", "Falhas"]) {
      await expect(page.getByRole("heading", { name: new RegExp(`^${titulo}`) })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Enviar notificação de teste para mim" })).toBeVisible();

    await page.getByLabel("Primeiro lembrete, quantas horas antes do Evento").fill("36");
    await page.getByLabel("Segundo lembrete, quantas horas antes do Evento").fill("3");
    await page.getByLabel("Resumo da semana: hora de domingo (0 a 23)").fill("9");
    await page.getByLabel("Canal de Notificações ligado").uncheck();
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Configurações salvas.")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Primeiro lembrete, quantas horas antes do Evento")).toHaveValue("36");
    await expect(page.getByLabel("Canal de Notificações ligado")).not.toBeChecked();
    await expect(situacao.getByText("Desligado")).toBeVisible();

    // Um segundo lembrete que não sai depois do primeiro é recusado.
    await page.getByLabel("Segundo lembrete, quantas horas antes do Evento").fill("40");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(/precisa sair depois do primeiro/)).toBeVisible();

    const larguraExcedida = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(larguraExcedida).toBeLessThanOrEqual(0);
  } finally {
    await admin
      .from("configuracoes")
      .update({
        notificacoes_ligadas: antes.data.notificacoes_ligadas,
        lembrete_longo_horas: antes.data.lembrete_longo_horas,
        lembrete_curto_horas: antes.data.lembrete_curto_horas,
        hora_do_resumo_semanal: antes.data.hora_do_resumo_semanal,
      })
      .eq("id", true);
  }
});

test("Notificações no Admin: quem é só Líder volta para o início", async ({ page }) => {
  const funcao = await admin.from("funcoes").select("id").eq("nome", "Líder do louvor").single().throwOnError();
  const convite = await admin.from("convites").insert({ nivel: "lider", funcao_id: funcao.data.id }).select("codigo").single().throwOnError();
  await cadastrar(page, "Líder sem Admin", convite.data.codigo);
  await page.goto("/admin/notificacoes");
  await expect(page).toHaveURL(/\/$/);
});
