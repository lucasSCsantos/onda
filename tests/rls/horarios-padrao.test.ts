import { describe, expect, it } from "vitest";
import { CATALOGO_INICIAL } from "@/dominio/catalogo";
import { HORARIOS_PADRAO_INICIAIS } from "@/dominio/horarios-padrao";
import { admin, comFuncoes, criar, eventoDe } from "./ambiente";

const COLUNAS = "horario_padrao, duracao_padrao_minutos";

async function categoriaNova() {
  const { data: area } = await admin.from("areas").select("id").eq("nome", "Geral").single().throwOnError();
  const { data } = await admin
    .from("categorias")
    .insert({ nome: `Teste ${crypto.randomUUID()}`, area_id: area.id, cor: "#112233" })
    .select("id")
    .single()
    .throwOnError();
  return data.id as string;
}

describe("horários padrão das Categorias", () => {
  it("depois da migração, EBD às 09:00 e Pequeno grupo às 15:00, sem duração; as demais sem padrão", async () => {
    const nomes = CATALOGO_INICIAL.categorias.map((c) => c.nome);
    const { data } = await admin.from("categorias").select(`nome, ${COLUNAS}`).in("nome", nomes).throwOnError();
    expect(data).toHaveLength(nomes.length);
    for (const categoria of data) {
      const esperado = HORARIOS_PADRAO_INICIAIS[categoria.nome as string];
      expect(
        { inicio: categoria.horario_padrao?.slice(0, 5) ?? null, duracaoMinutos: categoria.duracao_padrao_minutos },
        categoria.nome as string,
      ).toEqual(esperado ?? { inicio: null, duracaoMinutos: null });
    }
    expect(data.filter((c) => c.horario_padrao)).toHaveLength(Object.keys(HORARIOS_PADRAO_INICIAIS).length);
  });

  it("uma Categoria nova nasce sem padrão", async () => {
    const id = await categoriaNova();
    const { data } = await admin.from("categorias").select(COLUNAS).eq("id", id).single().throwOnError();
    expect(data).toEqual({ horario_padrao: null, duracao_padrao_minutos: null });
  });

  it("recusa duração fora de 1 a 1439 minutos", async () => {
    const id = await categoriaNova();
    for (const duracao of [0, -5, 1440]) {
      const { error } = await admin.from("categorias").update({ duracao_padrao_minutos: duracao }).eq("id", id);
      expect(error, String(duracao)).not.toBeNull();
    }
  });

  it("só o Admin edita e limpa; Líder e Professor não conseguem", async () => {
    const id = await categoriaNova();
    const lucas = await comFuncoes("Lucas", "admin", []);
    const carol = await comFuncoes("Carol", "lider", ["Líder do ministério"]);
    const paulo = await comFuncoes("Paulo", "professor", []);

    for (const outra of [carol, paulo]) {
      const barrada = await outra.cliente.from("categorias").update({ horario_padrao: "10:00", duracao_padrao_minutos: 60 }).eq("id", id).select("id");
      expect(barrada.data ?? []).toEqual([]);
    }

    const feita = await lucas.cliente.from("categorias").update({ horario_padrao: "10:00", duracao_padrao_minutos: 60 }).eq("id", id).select("id");
    expect(feita.data).toHaveLength(1);
    const { data } = await admin.from("categorias").select(COLUNAS).eq("id", id).single().throwOnError();
    expect(data).toEqual({ horario_padrao: "10:00:00", duracao_padrao_minutos: 60 });

    const limpa = await lucas.cliente.from("categorias").update({ horario_padrao: null, duracao_padrao_minutos: null }).eq("id", id).select("id");
    expect(limpa.data).toHaveLength(1);
    const { data: depois } = await admin.from("categorias").select(COLUNAS).eq("id", id).single().throwOnError();
    expect(depois).toEqual({ horario_padrao: null, duracao_padrao_minutos: null });
  });

  it("cada mudança vira Log, com a hora legível e quem mudou", async () => {
    const id = await categoriaNova();
    const lucas = await comFuncoes("Lucas", "admin", []);
    await lucas.cliente.from("categorias").update({ horario_padrao: "09:30", duracao_padrao_minutos: 90 }).eq("id", id).throwOnError();
    await lucas.cliente.from("categorias").update({ horario_padrao: null }).eq("id", id).throwOnError();

    const { data: logs } = await admin
      .from("logs")
      .select("usuario_id, detalhes")
      .eq("objeto_id", id)
      .eq("acao", "categoria.editada")
      .order("id")
      .throwOnError();
    expect(logs).toHaveLength(2);
    expect(logs[0].usuario_id).toBe(lucas.id);
    const mudancas = (i: number) => (logs[i].detalhes as { mudancas: { rotulo: string; antes: unknown; depois: unknown }[] }).mudancas;
    expect(mudancas(0)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rotulo: "Horário padrão", antes: null, depois: "09:30" }),
        expect.objectContaining({ rotulo: "Duração padrão (min)", antes: null, depois: 90 }),
      ]),
    );
    expect(mudancas(1)).toEqual([expect.objectContaining({ rotulo: "Horário padrão", antes: "09:30", depois: null })]);
  });

  it("mudar o padrão não altera os Eventos já criados", async () => {
    const id = await categoriaNova();
    const lucas = await comFuncoes("Lucas", "admin", []);
    const { data: evento } = await criar(lucas.cliente, eventoDe(id, lucas.id)).then((r) => ({ data: r.data }));
    const antes = await admin.from("eventos").select("inicio, fim, dia_inteiro").eq("id", evento!.id).single().throwOnError();
    await lucas.cliente.from("categorias").update({ horario_padrao: "07:00", duracao_padrao_minutos: 30 }).eq("id", id).throwOnError();
    const depois = await admin.from("eventos").select("inicio, fim, dia_inteiro").eq("id", evento!.id).single().throwOnError();
    expect(depois.data).toEqual(antes.data);
  });
});
