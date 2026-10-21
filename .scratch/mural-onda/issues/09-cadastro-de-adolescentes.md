# 09: Cadastro de Adolescentes

**What to build:** a lista do ministério. Qualquer Admin ou Líder cria, edita e inativa Adolescentes (nome e data de nascimento), busca por nome e ordena por próximo aniversário. Adolescente inativo sai das listas sem perder o histórico. Os dados ficam restritos à Liderança aprovada, fora de buscadores, e o cadastro é separado do de usuários, sem login (ADR 0003).

**Blocked by:** 02

**Status:** ready-for-agent

- [x] Criar, editar e inativar Adolescentes; reativar traz de volta
- [x] Busca por nome e ordenação por próximo aniversário
- [x] Pendente e Professor não leem nenhum dado de Adolescente (testado nas políticas por linha)
- [x] Páginas fora de buscadores (sem indexação)
- [x] Teste do cálculo de próximo aniversário, incluindo 29/02

## Notes

- Quem nasceu em 29/02 comemora em 28/02 nos anos não bissextos (`proximoAniversario` em `src/dominio/adolescentes.ts`).
- `/adolescentes` é a lista (busca `?q=`, ordem `?ordem=nome`, `?inativos=1`); sem DELETE no banco, só inativar.
