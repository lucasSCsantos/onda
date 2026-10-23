import { describe, expect, it } from "vitest";
import { nativosDe, NATIVOS_INICIAIS, NATIVOS_VISIVEIS, type NativosDaCategoria } from "@/dominio/campos-nativos";
import { admin, comFuncoes, eventoDe } from "./ambiente";

type Linha = { nativo_local: string; nativo_fim: string; nativo_observacoes: string; nativo_link: string };

const doBanco = ({ nativo_local, nativo_fim, nativo_observacoes, nativo_link }: Linha): NativosDaCategoria => ({
  local: nativo_local as NativosDaCategoria["local"],
  fim: nativo_fim as NativosDaCategoria["fim"],
  observacoes: nativo_observacoes as NativosDaCategoria["observacoes"],
  link: nativo_link as NativosDaCategoria["link"],
});

const COLUNAS = "nativo_local, nativo_fim, nativo_observacoes, nativo_link";

/** Uma Categoria nova na Área Geral, com a configuração dada; os campos comuns que faltarem ficam visíveis. */
async function categoriaNova(config: Partial<NativosDaCategoria> = {}) {
  const { data: area } = await admin.from("areas").select("id").eq("nome", "Geral").single().throwOnError();
  const { data } = await admin
    .from("categorias")
    .insert({
      nome: `Teste ${crypto.randomUUID()}`,
      area_id: area.id,
      cor: "#112233",
      nativo_local: config.local,
      nativo_fim: config.fim,
      nativo_observacoes: config.observacoes,
      nativo_link: config.link,
    })
    .select("id")
    .single()
    .throwOnError();
  return data.id as string;
}

const mudarConfig = (categoria: string, config: Partial<Record<string, string>>) =>
  admin.from("categorias").update(config).eq("id", categoria).throwOnError();

const lider = () => comFuncoes("Líder", "lider", ["Líder do ministério"]);

describe("configuração dos campos comuns", () => {
  it("as Categorias do catálogo inicial seguem a auditoria", async () => {
    const { data } = await admin.from("categorias").select(`nome, ${COLUNAS}`).throwOnError();
    for (const [nome, nativos] of Object.entries(NATIVOS_INICIAIS)) {
      const linha = data.find((c) => c.nome === nome)!;
      expect(doBanco(linha as unknown as Linha), nome).toEqual(nativosDe({ nativos }));
    }
  });

  it("uma Categoria nova fica com tudo visível", async () => {
    const id = await categoriaNova();
    const { data } = await admin.from("categorias").select(COLUNAS).eq("id", id).single().throwOnError();
    expect(doBanco(data as Linha)).toEqual(NATIVOS_VISIVEIS);
  });

  it("recusa um valor que não é oculto, visível ou obrigatório", async () => {
    const id = await categoriaNova();
    const { error } = await admin.from("categorias").update({ nativo_local: "talvez" }).eq("id", id);
    expect(error).not.toBeNull();
  });

  it("só o Admin muda a configuração, e a mudança vira Log com os valores legíveis", async () => {
    const id = await categoriaNova();
    const lucas = await comFuncoes("Lucas", "admin", []);
    const carol = await lider();

    const barrada = await carol.cliente.from("categorias").update({ nativo_local: "oculto" }).eq("id", id).select("id");
    expect(barrada.data).toEqual([]);

    const feita = await lucas.cliente.from("categorias").update({ nativo_local: "obrigatorio", nativo_fim: "oculto" }).eq("id", id).select("id");
    expect(feita.data).toHaveLength(1);

    const { data: logs } = await admin.from("logs").select("acao, usuario_id, detalhes").eq("objeto_id", id).eq("acao", "categoria.editada").throwOnError();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ acao: "categoria.editada", usuario_id: lucas.id });
    const mudancas = (logs[0].detalhes as { mudancas: { rotulo: string; antes: string; depois: string }[] }).mudancas;
    expect(mudancas).toEqual(
      expect.arrayContaining([
        { rotulo: "Campo Local", tipo: "texto", antes: "Visível", depois: "Obrigatório" },
        { rotulo: "Campo Fim", tipo: "texto", antes: "Visível", depois: "Oculto" },
      ]),
    );
  });

  it("o Admin define a configuração já ao criar a Categoria", async () => {
    const lucas = await comFuncoes("Lucas", "admin", []);
    const { data: area } = await admin.from("areas").select("id").eq("nome", "Geral").single().throwOnError();
    const { data, error } = await lucas.cliente
      .from("categorias")
      .insert({ nome: `Criada ${crypto.randomUUID()}`, area_id: area.id, cor: "#445566", nativo_local: "obrigatorio", nativo_link: "oculto" })
      .select(COLUNAS)
      .single();
    expect(error).toBeNull();
    expect(doBanco(data as Linha)).toEqual({ ...NATIVOS_VISIVEIS, local: "obrigatorio", link: "oculto" });
  });
});

describe("campo obrigatório no banco", () => {
  it("recusa o Evento novo sem o valor e aceita com ele", async () => {
    const categoria = await categoriaNova({ local: "obrigatorio", fim: "obrigatorio", observacoes: "obrigatorio", link: "obrigatorio" });
    const { cliente, id: eu } = await lider();
    const completo = { local: "Templo", observacoes: "Levar som", link: "https://onda.app/x" };
    const tenta = (mudancas: Record<string, unknown>) =>
      cliente.from("eventos").insert(eventoDe(categoria, eu, { ...completo, ...mudancas })).select("id").single();

    expect((await tenta({})).error).toBeNull();
    expect((await tenta({ local: "  " })).error?.message).toContain("Local");
    expect((await tenta({ fim: null })).error?.message).toContain("Fim");
    expect((await tenta({ observacoes: "" })).error?.message).toContain("Observações");
    expect((await tenta({ link: null })).error?.message).toContain("Link");
  });

  it("uma edição só confere o que mudou: um Evento antigo sem o valor ainda aceita outras mudanças", async () => {
    const categoria = await categoriaNova();
    const { cliente, id: eu } = await lider();
    const { data: antigo } = await cliente.from("eventos").insert(eventoDe(categoria, eu, { local: "" })).select("id").single();
    await mudarConfig(categoria, { nativo_local: "obrigatorio" });

    const outraMudanca = await cliente.from("eventos").update({ titulo: "Novo título" }).eq("id", antigo!.id).select("id");
    expect(outraMudanca.error).toBeNull();
    expect(outraMudanca.data).toHaveLength(1);

    const limpando = await cliente.from("eventos").update({ local: " " }).eq("id", antigo!.id).select("id");
    expect(limpando.error?.message).toContain("Local");
    const preenchido = await cliente.from("eventos").update({ local: "Salão" }).eq("id", antigo!.id).select("local");
    expect(preenchido.data).toEqual([{ local: "Salão" }]);
    const apagando = await cliente.from("eventos").update({ local: "" }).eq("id", antigo!.id).select("id");
    expect(apagando.error?.message).toContain("Local");
  });
});

describe("campo oculto no banco", () => {
  it("é ignorado ao criar", async () => {
    const categoria = await categoriaNova({ local: "oculto", fim: "oculto", observacoes: "oculto", link: "oculto" });
    const { cliente, id: eu } = await lider();
    const { data, error } = await cliente
      .from("eventos")
      .insert(eventoDe(categoria, eu, { local: "Templo", observacoes: "Levar som", link: "https://onda.app/x" }))
      .select("local, observacoes, link, fim")
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({ local: "", observacoes: "", link: null, fim: null });
  });

  it("mantém, sem apagar, o valor que o Evento já tinha antes de a Categoria ocultar o campo", async () => {
    const categoria = await categoriaNova();
    const { cliente, id: eu } = await lider();
    const { data: criado } = await cliente
      .from("eventos")
      .insert(eventoDe(categoria, eu, { local: "Templo", observacoes: "Levar som", link: "https://onda.app/x" }))
      .select("id, fim")
      .single();
    await mudarConfig(categoria, { nativo_local: "oculto", nativo_fim: "oculto", nativo_observacoes: "oculto", nativo_link: "oculto" });

    const { data, error } = await cliente
      .from("eventos")
      .update({ titulo: "Novo título", local: "", observacoes: "", link: null, fim: null })
      .eq("id", criado!.id)
      .select("titulo, local, observacoes, link, fim")
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({
      titulo: "Novo título",
      local: "Templo",
      observacoes: "Levar som",
      link: "https://onda.app/x",
      fim: new Date(criado!.fim!).toISOString().replace(".000Z", "+00:00"),
    });
  });

  it("remarcar o Evento troca o fim antigo pelo que o app calculou", async () => {
    const categoria = await categoriaNova();
    const { cliente, id: eu } = await lider();
    const { data: criado } = await cliente.from("eventos").insert(eventoDe(categoria, eu)).select("id").single();
    await mudarConfig(categoria, { nativo_fim: "oculto" });

    const semRemarcar = await cliente.from("eventos").update({ titulo: "Outro", fim: null }).eq("id", criado!.id).select("fim").single();
    expect(semRemarcar.data!.fim).not.toBeNull();

    const { data } = await cliente
      .from("eventos")
      .update({ inicio: "2026-11-30T22:00:00Z", fim: null })
      .eq("id", criado!.id)
      .select("inicio, fim")
      .single();
    expect(data).toEqual({ inicio: "2026-11-30T22:00:00+00:00", fim: null });
  });
});
