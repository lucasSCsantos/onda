# 05: Filtros avançados e filtros expostos

**What to build:** a reorganização dos demais filtros. Área e Categoria ficam expostas na barra, ao lado dos atalhos. Dia, Status e várias Categorias vão para "Filtros avançados", um painel que abre por baixo. O botão mostra um contador quando há filtro ligado lá dentro, para não esquecer nada escondido. O bloco recolhível com o botão "Filtrar" deixa de existir, e tudo é aplicado na hora.

**Blocked by:** 04 (Atalhos de filtro).

**Status:** ready-for-agent

- [ ] Área e Categoria são controles compactos e expostos, aplicados na hora.
- [ ] "Filtros avançados" abre e fecha, com acessibilidade (rótulo, estado, foco), e contém Dia, Status (todos os seis) e a seleção de várias Categorias.
- [ ] O botão de filtros avançados mostra um contador dos filtros ligados dentro dele, e o painel abre sozinho se vier da URL com algum ligado.
- [ ] Os filtros avançados também são aplicados na hora e ficam na URL, ao lado dos atalhos e dos filtros expostos, e combinam entre si.
- [ ] O bloco antigo `<details>` com o botão "Filtrar" é removido, e "Limpar" continua à mostra quando há filtro ativo.
- [ ] No celular o painel avançado cabe sem rolagem horizontal e tem toque de 44px ou mais.
- [ ] Os testes de domínio de filtros continuam passando, sem mudar o contrato dos parâmetros de URL existentes.
- [ ] Funciona nos temas claro e escuro.
