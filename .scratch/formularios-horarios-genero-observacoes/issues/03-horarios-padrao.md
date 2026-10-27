# 03: Horários padrão por Categoria

**What to build:** o Admin define, por Categoria, o horário de início e a duração padrão, e quem cria um Evento novo já vê o formulário preenchido.

- Colunas novas, opcionais e aditivas em Categorias: horário de início padrão e duração padrão em minutos. A migração define **EBD às 09:00** e **Pequeno grupo às 15:00**, sem duração; as demais Categorias ficam sem padrão (nada de durações inventadas). Reversão em comentário SQL, como nas migrações anteriores.
- Nova tela de administração "Horários padrão" (uma linha por Categoria, usando o seletor de hora do ticket 02), com entrada no painel do Admin. Só o Admin edita, garantido no banco por política e permissões de coluna. Cada mudança gera Log pelo mecanismo existente, e o Admin pode limpar um valor.
- Um módulo de domínio de TS puro calcula os valores iniciais do formulário de Evento novo a partir da Categoria (que vem da rota de criação): início padrão e, **somente** se houver duração e a Categoria mostrar o campo de fim, o fim. O usuário altera normalmente.
- Séries usam o horário do formulário, já preenchido pelo padrão; o modelo e as regras das Séries não mudam.
- O padrão vale só para Eventos **novos**: Eventos existentes e a edição de Eventos nunca são afetados, e mudar o padrão não altera nada já criado. Categorias sem início padrão e a Postagem (data de publicação) abrem como hoje.
- README atualizado e resumo da alteração. Branch `feat/alt-2-horarios-padrao` a partir de `develop` (após a Alteração 1).

**Blocked by:** 02 (Datas e horas)

**Status:** ready-for-agent

- [ ] Depois da migração, EBD tem início 09:00 e Pequeno grupo 15:00, sem duração, e as demais Categorias não têm padrão
- [ ] O Admin edita e limpa os padrões em `/admin/horarios`; Líder e demais perfis não conseguem editar (teste de RLS)
- [ ] Cada mudança no padrão aparece nos Logs
- [ ] Ao abrir o formulário de Evento novo de EBD, o início já vem às 09:00; com duração padrão, o fim vem preenchido só quando a Categoria mostra o campo de fim
- [ ] Alterar o horário preenchido funciona normalmente e o valor alterado é o que é salvo
- [ ] Uma Série nova usa o horário do formulário preenchido pelo padrão
- [ ] Eventos existentes e a edição de Eventos não mudam; mudar o padrão não altera Eventos já criados
- [ ] Categoria sem padrão e Postagem abrem como hoje
- [ ] Testes de domínio (preenchimento, duração, Categoria sem padrão, Postagem, Evento antigo intacto) e de RLS passando; `pnpm test`, `pnpm typecheck`, `pnpm lint` e build verdes
