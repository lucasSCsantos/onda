# 01: Controles de escolha (checkbox, radio, select único e múltiplo)

**What to build:** a Liderança passa a ver checkbox, radio e select com visual moderno e coerente com o app, em todas as telas, sem que nenhum formulário mude de comportamento. Sem dependência nova; os componentes próprios estendem a biblioteca de formulário que já existe e enviam o valor com os mesmos nomes de campo (campo oculto), preservando `<form action>`, Server Actions e validação no domínio.

- **Checkbox:** caixa própria com estado marcado, desmarcado e indeterminado e animação discreta.
- **Radio:** grupo com formato de cartão ou segmentado, indicador claro do item marcado. Os radios `sr-only` de ícone (Marcações, Atalhos de arquivos) viram radios visuais acessíveis.
- **Select único:** painel estilizado (cantos arredondados, sombra suave, opção atual e opção focada em destaque, ícone de selecionado), rolagem interna com altura máxima, estados vazio e carregando, busca dentro do painel quando houver mais de 8 opções, painel inferior no celular e flutuante no desktop.
- **Select múltiplo:** com chips removíveis; substitui, nos filtros de Eventos, a lista de checkboxes de Categorias sem mudar o que o filtro faz.
- Estados padrão, hover, foco visível, desabilitado, erro (mensagem ligada ao campo e anunciada) e carregando; áreas de toque de pelo menos 44 px; tokens e tema claro e escuro do app.
- Substitui todos os usos nativos de `select`, radio e checkbox (Evento, repetição e Série, filtros de Eventos e de Arquivos, Adolescentes, Minha conta, e todas as telas de administração: Logs, Catálogo, Configurações, Notificações, Convites, Usuários, Arquivos, Marcações). Qualquer uso mantido de propósito é listado no resumo, com o motivo.
- Antes de começar, rodar `pnpm test`, `pnpm typecheck`, `pnpm lint` e o build e guardar o resultado como linha de base; repetir ao final.
- Branch `feat/alt-1-componentes` a partir de `develop`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Linha de base de testes, tipos, lint e build registrada antes da primeira mudança e comparada ao final
- [ ] Nenhum `<select>`, `input type="radio"` ou `input type="checkbox"` nativo visível restou no app, exceto os mantidos de propósito e listados com o motivo
- [ ] Os formulários existentes enviam os mesmos campos e valores de antes e a validação e as mensagens continuam as mesmas
- [ ] Navegação por teclado completa (setas, Enter, Esc, Tab e digitação para buscar), foco visível e atributos de acessibilidade (papel, rótulo, estado, erro associado ao campo)
- [ ] Select com busca acima de 8 opções, estados vazio e carregando, e painel inferior no celular
- [ ] Select múltiplo com chips nos filtros de Eventos, com o mesmo resultado de filtragem
- [ ] Testes de fumaça (Playwright, celular simulado): abertura e fechamento, seleção única e múltipla, valor enviado no formulário e atributos de acessibilidade
- [ ] Modo claro e escuro respeitados e áreas de toque de pelo menos 44 px
