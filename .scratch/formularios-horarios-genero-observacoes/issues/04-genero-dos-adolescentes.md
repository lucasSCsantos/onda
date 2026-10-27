# 04: Gênero dos Adolescentes (cadastro, filtro e totais)

**What to build:** a Liderança registra o Gênero (Masculino ou Feminino) de cada Adolescente, vê quem está sem ele e filtra e totaliza a lista por Gênero.

- Coluna nova, opcional e aditiva em Adolescentes, com os valores "masculino" e "feminino"; registros antigos ficam nulos ("não informado"). Privilégios de coluna passam a incluir o Gênero. Reversão em comentário SQL.
- Obrigatório em **novos** cadastros, garantido no banco por um gatilho de `INSERT` (nunca bloqueia atualização de registros antigos) e também validado no domínio e na ação do servidor.
- O radio de Gênero (ticket 01) entra nos formulários de criar e de editar Adolescente, para completar os antigos.
- Indicador discreto de "cadastro incompleto" em quem está sem Gênero.
- Lista de Adolescentes: filtro por Masculino, Feminino e "sem gênero informado" (usando os componentes do ticket 01) e totais por Gênero (com "não informado"), calculados sobre os Adolescentes ativos independentemente do filtro de Gênero escolhido.
- Privacidade: visível só para usuários autenticados e aprovados, pelas mesmas políticas das tabelas existentes; nunca em `.ics`, Notificações, páginas públicas ou exportações públicas. O Log da alteração registra só que o campo foi alterado, sem o valor.
- README atualizado e resumo. Branch `feat/alt-5-genero` a partir de `develop`.

**Blocked by:** 01 (Controles de escolha)

**Status:** ready-for-agent

- [ ] Adolescentes antigos continuam válidos e aparecem como "não informado" com o selo de cadastro incompleto
- [ ] Criar Adolescente sem Gênero é recusado no banco (teste de RLS) e no formulário com mensagem clara
- [ ] Atualizar um Adolescente antigo sem Gênero (por exemplo, inativar) continua funcionando
- [ ] Líder e Admin editam o Gênero de qualquer Adolescente; Professor e Pendente não leem nem editam
- [ ] O filtro por Masculino, Feminino e "sem gênero informado" funciona, e os totais por Gênero estão corretos e não mudam com o filtro de Gênero
- [ ] O Gênero não aparece no `.ics`, em Notificações nem em exportações; o Log registra só a alteração, sem o valor
- [ ] Testes de domínio e de RLS passando; `pnpm test`, `pnpm typecheck`, `pnpm lint` e build verdes
