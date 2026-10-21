# 09: Cadastro de Adolescentes

**What to build:** a lista do ministério. Qualquer Admin ou Líder cria, edita e inativa Adolescentes (nome e data de nascimento), busca por nome e ordena por próximo aniversário. Adolescente inativo sai das listas sem perder o histórico. Os dados ficam restritos à Liderança aprovada, fora de buscadores, e o cadastro é separado do de usuários, sem login (ADR 0003).

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Criar, editar e inativar Adolescentes; reativar traz de volta
- [ ] Busca por nome e ordenação por próximo aniversário
- [ ] Pendente e Professor não leem nenhum dado de Adolescente (testado nas políticas por linha)
- [ ] Páginas fora de buscadores (sem indexação)
- [ ] Teste do cálculo de próximo aniversário, incluindo 29/02
