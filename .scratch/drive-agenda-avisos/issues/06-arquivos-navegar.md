# 06: Arquivos: navegar

**Spec:** `../spec.md` (Alteração 4)

**What to build:** Uma seção "Arquivos", só de leitura e só para a Liderança, que mostra o Drive do ministério dentro do Mural. O Admin cadastra atalhos (nome, ícone, pasta) e escolhe quais Funções os veem. A pessoa navega pelas pastas com breadcrumb, ordenação, grade e lista, com carregamento por páginas, cache e botão "Atualizar". Todo acesso passa pelo servidor e confere que o item está dentro da raiz.

**Blocked by:** 04 (Pasta do Evento para Eventos avulsos, que traz o cliente do Drive e a pasta raiz)

**Status:** ready-for-agent

- [ ] Tabelas de atalhos e de ligação com Funções, com políticas por linha; cadastro e edição na administração, com Log
- [ ] Atalho sem Função marcada vale para toda a Liderança; Admin e Função Geral veem todos; Professores e Pendentes não veem a seção (no banco e na interface)
- [ ] Listagem de uma pasta paginada, em grade e em lista, com breadcrumb até a raiz ou o atalho, ordenação por nome e data, cache de poucos minutos e botão "Atualizar"
- [ ] Toda listagem confere pela cadeia de pais que a pasta pedida está dentro da raiz autorizada e que o atalho é permitido à pessoa; itens fora da raiz são bloqueados
- [ ] Nenhum token, credencial ou URL de acesso direto ao Drive vai ao navegador
- [ ] Drive desligado ou com erro mostra um estado claro, sem tela quebrada
- [ ] Mobile-first, grade adequada ao celular
- [ ] Estende o cliente do Drive do ticket 04 (hoje só acha e cria pasta) com listar, obter pais e metadados e baixar, e o Drive falso (`src/lib/drive/falso.ts`) com o mesmo
- [ ] Testes com o Drive falso (bloqueio fora da raiz, permissão por atalho, erro da integração) e do banco (políticas dos atalhos)
