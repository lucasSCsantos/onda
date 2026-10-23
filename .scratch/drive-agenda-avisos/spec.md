Status: ready-for-agent

# Campos por Categoria, Drive, semana, calendário e avisos

Usa o vocabulário de `CONTEXT.md` e respeita os ADRs 0001 a 0008. Sete alterações em um app já em produção, com dados reais, entregues nesta ordem e sem mudar o que já funciona: (1) link de Professores, (2) campos nativos por Categoria e numeração das Séries, (3) Pastas do Evento no Drive, (4) Arquivos, (5) tela principal "Esta semana" e Chamada do Professor, (6) Assinatura de calendário, (7) Notificações push. Toda mudança de esquema é uma migração nova, só de adições, com políticas por linha para cada tabela nova. Toda feature nova grava Logs no sistema existente.

## Problem Statement

A Liderança do ONDA enfrenta seis problemas no Mural:

- O item "Professores" do menu do Admin leva a uma tela que perde a barra lateral e não fica marcado como ativo, e parece fora do lugar.
- Todo Evento mostra os mesmos campos nativos (local, fim, observações, link), mesmo onde não fazem sentido, como em uma Postagem. Os títulos das aulas de uma Série são todos iguais, sem como distingui-los.
- O material de cada aula e de cada Pequeno grupo vive no Drive, mas alguém precisa criar a pasta e colar o link à mão, e a Liderança não consegue ver os arquivos do ministério (logos, imagens do acampamento) sem sair do Mural.
- A tela principal não responde "o que eu tenho esta semana?" nem lembra o Professor de fazer a Chamada no dia da aula, e o Professor não consegue fazer a Chamada da própria aula se não tiver Função na Área.
- Quem quer ver os Eventos no calendário do celular precisa abrir o Mural.
- Ninguém é avisado quando vira Responsável, quando um Evento seu muda ou é cancelado, nem antes de um Evento acontecer.

## Solution

- O Admin e os líderes de Ensino abrem Professores com a mesma tela, dentro do Admin (com barra lateral e item ativo) ou fora dele.
- Cada Categoria passa a mostrar só os campos que a descrevem: o Admin escolhe, por Categoria, se local, fim, observações e link ficam ocultos, visíveis ou obrigatórios (inclusive ao criar a Categoria). A Postagem usa só o início, rotulado "Publicação". As Ocorrências de uma Série passam a ter número sequencial ("Aula de EBD · 3"), e a Série fica limitada a no máximo semanal, por até 6 meses.
- Ao criar um Evento de EBD ou Pequeno grupo, o Mural cria sozinho a Pasta do Evento no Drive do ministério e coloca o link em "Link do material". Se o Drive falhar ou estiver desligado, o Evento nasce normalmente e o campo continua preenchível à mão.
- Uma seção "Arquivos", só de leitura e só para a Liderança, mostra o Drive do ministério dentro do Mural, com atalhos que o Admin escolhe, navegação por pastas, busca, miniaturas, abrir no Drive, copiar link e baixar.
- A tela principal abre com os Eventos da semana de quem entra e o cartão de Chamada no dia da aula, e o Professor e o Auxiliar fazem a Chamada da própria aula.
- Cada pessoa gera, regera e revoga em "Minha conta" o endereço `.ics` que mostra os Eventos no calendário do celular.
- Líderes e Professores recebem Notificações push (e as veem na central dentro do app) sobre o que lhes diz respeito, sem nunca expor dados de Adolescentes.

## User Stories

### Alteração 1: Professores no Admin

1. Como Admin, quero abrir Professores pelo menu do Admin e continuar com a barra lateral à vista, para navegar entre as seções sem me perder.
2. Como Admin, quero ver o item Professores marcado como ativo quando estou nele, para saber onde estou.
3. Como líder de Ensino sem acesso ao Admin, quero continuar abrindo Professores pelo menu do cabeçalho, para cadastrar professores como hoje.
4. Como Admin que abre o endereço antigo de Professores direto, quero ser levado ao endereço dentro do Admin, para não ver duas versões da tela.
5. Como desenvolvedor, quero um teste que garanta o destino de cada link de Professores por perfil, para a correção não regredir.

### Alteração 2: campos por Categoria e Séries

6. Como Admin, quero escolher, para cada Categoria, quais campos nativos (local, fim, observações, link) ficam ocultos, visíveis ou obrigatórios, para que o formulário mostre só o que descreve aquela Categoria.
7. Como Admin, quero fazer essa escolha também ao criar uma Categoria nova, para não precisar voltar depois.
8. Como Admin, quero que os valores antigos de campos que passaram a ficar ocultos continuem no banco, para não perder dado.
9. Como Admin, quero que a lista de Eventos que têm valor em campo oculto apareça no resumo da entrega, para decidir se limpo algo.
10. Como líder, quero que uma Postagem peça só a data e hora de publicação, rotulada "Publicação", sem fim nem local, para não preencher o que não existe.
11. Como líder, quero que o calendário, a lista e o Painel do dia usem a data de publicação das Postagens, para vê-las no dia certo.
12. Como líder, quero que o Pequeno grupo tenha "Link do material", para guardar a pasta como na EBD.
13. Como líder, quero que o formulário valide por Categoria (obrigatórios exigidos, ocultos ignorados), para não gravar dado fora do lugar.
14. Como líder, quero criar uma Série no máximo semanal e de até 6 meses, para não gerar centenas de aulas de uma vez.
15. Como líder, quero ver o limite explicado no formulário da Série ("repete no máximo toda semana, por até 6 meses"), para entender o motivo de um bloqueio.
16. Como líder, quero que cada Ocorrência tenha número sequencial na ordem das datas ("Aula de EBD · 3"), para distinguir as aulas de uma Série.
17. Como líder, quero que o número não mude se outra Ocorrência for cancelada, para não confundir quem já falou "aula 3".
18. Como líder, quero que o número apareça no calendário, na lista, no Painel do dia, no iCal e nas Notificações, para ser o mesmo em todo lugar.
19. Como líder, quero que Eventos avulsos continuem só com o título que digitei, para não ganhar número sem sentido.

### Alteração 3: Pasta do Evento no Drive

20. Como líder, quero que um Evento de EBD ou Pequeno grupo ganhe sua pasta no Drive sozinho, para não criar e colar o link à mão.
21. Como Admin, quero ligar outras Categorias para ter pasta automática, para estender o recurso sem mudar código.
22. Como líder, quero que a pasta fique em `<raiz>/<Categoria>/<Ano>/<AAAA-MM-DD · título>`, para achar o material por data.
23. Como líder, quero que as pastas de Categoria e de ano sejam criadas se não existirem, para não depender de preparo manual.
24. Como líder, quero que cada Ocorrência de uma Série ganhe sua pasta, para cada aula ter seu material.
25. Como líder, quero que a criação da Série não espere o Drive, para não ficar com a tela travada.
26. Como líder, quero que falhas do Drive sejam tentadas de novo sozinhas, para um erro passageiro não deixar aula sem pasta.
27. Como líder, quero ver na tela do Evento se a pasta está criada, pendente ou com erro, e um botão "Criar pasta agora", para resolver sem ajuda.
28. Como líder, quero que um link digitado à mão no "Link do material" nunca seja sobrescrito, para controlar quando já tenho uma pasta.
29. Como líder, quero que um Evento nunca ganhe duas pastas, para não ficar com material espalhado.
30. Como líder, quero que mudar título ou data renomeie a pasta, para o nome continuar certo.
31. Como líder, quero que cancelar o Evento não toque na pasta, para não perder material.
32. Como Admin, quero que o Mural nunca apague nada no Drive, para não haver perda por engano.
33. Como Admin, quero ligar e desligar a integração, informar a pasta raiz e escolher as Categorias em Configurações, para fazer deploy sem credenciais prontas.
34. Como Admin, quero que cada mudança dessas configurações vire Log, para saber quem mexeu.
35. Como líder, quero um aviso claro quando o Drive não está configurado ou falha, e que o Evento seja criado mesmo assim, para não perder trabalho.
36. Como líder, quero ser avisado de que o link da pasta só abre para quem tem acesso no Drive, para não me surpreender quando alguém não conseguir abrir.
37. Como Admin, quero que falhas e criações de pasta apareçam nos Logs, para investigar problemas.

### Alteração 4: Arquivos

38. Como líder, quero uma seção "Arquivos" no menu, para ver o Drive do ministério sem sair do Mural.
39. Como Admin, quero cadastrar atalhos (nome, ícone, ID da pasta) e escolher quais Funções os veem, para destacar identidade visual e acampamento.
40. Como líder, quero ver no topo só os atalhos que minhas Funções permitem (e todos os sem Função marcada), para não ver o que não é meu.
41. Como Admin e como líder da Função Geral, quero ver todos os atalhos, para ter visão completa.
42. Como líder, quero navegar pelas pastas com breadcrumb, para saber onde estou e voltar.
43. Como líder, quero ordenar por nome e por data, para achar o mais recente.
44. Como líder, quero buscar por nome em toda a raiz, para achar uma logo sem saber a pasta.
45. Como líder, quero alternar entre grade com miniaturas e lista, para escolher o melhor modo no celular.
46. Como líder, quero ampliar uma imagem para pré-visualizar, para confirmar que é a certa.
47. Como líder, quero ver ícone por tipo, nome, tamanho e data nos outros arquivos, para distinguir documentos.
48. Como líder, quero abrir no Drive, copiar o link e baixar, para usar o arquivo onde precisar.
49. Como Admin, quero um limite de tamanho para o download (padrão 4 MB), para não estourar a hospedagem; arquivos maiores só têm "Abrir no Drive".
50. Como líder, quero que o link do material de um Evento abra direto no painel, na pasta certa, para não procurar.
51. Como líder, quero atualizar a listagem por um botão, para ver arquivos que acabei de enviar ao Drive.
52. Como líder, quero que as listagens carreguem por páginas, para a seção ser rápida no celular.
53. Como líder, quero um estado claro quando o Drive está desligado ou com erro, para não ver tela quebrada.
54. Como Admin, quero que o Mural impeça o acesso a qualquer item fora da pasta raiz, para que o Drive todo não seja exposto.
55. Como Admin, quero que Professores e Pendentes não vejam Arquivos, para manter só a Liderança.
56. Como Admin, quero que nenhum token, credencial ou URL de acesso direto vá para o navegador, para não vazar acesso ao Drive.

### Alteração 5: tela principal e Chamada

57. Como líder, quero ver "Meus eventos desta semana" no topo, para saber minha semana.
58. Como líder, quero ver o dia de hoje destacado, a Categoria (cor e ícone), horário, local e Status em cada cartão, para decidir de relance.
59. Como Professor ou Auxiliar, quero ver as aulas que ministro nesta semana junto dos Eventos em que sou Responsável, para uma lista só.
60. Como líder, quero ver "Esta semana no ONDA" com todos os Eventos da semana e a opção "só os meus", para saber o que acontece no ministério.
61. Como líder, quero ver alertas de Eventos da semana sem Responsável ou em Rascunho, com atalho para corrigir, para evitar que algo fique sem dono.
62. Como líder, quero ver os aniversariantes da semana, para lembrar de parabenizar.
63. Como líder, quero estados vazios claros ("Você não tem eventos nesta semana"), para entender que não é erro.
64. Como líder, quero que "Próximos eventos" mostre só o que vem depois desta semana, para não ver o mesmo Evento duas vezes.
65. Como Professor ou Auxiliar, quero um cartão "Chamada de hoje · EBD · tema · horário" no dia da aula, para ir direto à Chamada.
66. Como Professor ou Auxiliar, quero que o cartão fique visível do início do dia da aula até o fim do dia seguinte (janela configurável), para ter tempo se esquecer.
67. Como Professor ou Auxiliar, quero ver "Chamada feita ✓" depois de concluída, para saber que acabou.
68. Como Professor ou Auxiliar, quero ver "Chamada pendente" como alerta quando o horário da aula já passou sem Chamada, para não esquecer.
69. Como Professor ou Auxiliar, quero fazer e corrigir a Chamada da minha aula mesmo sem Função na Área, para cumprir meu papel.
70. Como Professor ou Auxiliar, quero ver só nome e identificador dos Adolescentes ativos, nunca a data de nascimento, para fazer a Chamada sem acessar dados além do necessário.
71. Como Admin, quero que o Professor só consiga fazer Chamada daquela aula, a partir do dia dela, para que o acesso não vaze para outras aulas.
72. Como Admin, quero que a Chamada feita ou corrigida vire Log, para saber quem fez.
73. Como Admin, quero que o Professor-nível Professor continue sem ver Adolescentes, aniversários e Ranking fora da Chamada, para manter a regra de privacidade.

### Alteração 6: Assinatura de calendário

74. Como pessoa da Liderança ou Professor, quero gerar meu endereço `.ics` em "Minha conta", para assinar no calendário do celular.
75. Como pessoa, quero que o endereço seja mostrado uma vez só, para tratá-lo como senha.
76. Como pessoa, quero regerar o endereço (invalidando o anterior) e revogá-lo, para cortar acesso se vazar.
77. Como pessoa, quero escolher todos os Eventos ou só os meus (Responsável ou Professor), para receber só o que importa.
78. Como pessoa, quero filtrar por Categorias, para receber só as que me interessam.
79. Como líder, quero incluir aniversários, só se eu optar, com apenas o primeiro nome do Adolescente, para lembrar sem expor dados.
80. Como Professor, quero receber só as minhas aulas, nunca aniversários, para ver só o que me cabe.
81. Como pessoa, quero que mudanças no Mural apareçam na assinatura sozinhas, para não reassinar.
82. Como pessoa, quero que Eventos Cancelados e Rascunhos não apareçam, e que Adiados apareçam marcados com "[Adiado]", para o calendário ficar limpo e honesto.
83. Como pessoa, quero que cada Ocorrência da Série apareça como Evento individual, respeitando as edições, para ver cada aula no dia certo.
84. Como pessoa, quero horários em America/Bahia, para o calendário bater com a realidade.
85. Como pessoa, quero que cada Evento tenha identificador estável, para atualizar sem duplicar no calendário.
86. Como pessoa, quero ver título (com número da Série), local quando existir e o link do material na descrição, para ter o contexto no calendário.
87. Como pessoa, quero que Postagens apareçam na data de publicação, para vê-las no dia certo.
88. Como Admin, quero que o endereço seja guardado só como hash, com limite de requisições, para reduzir o dano se o banco vazar.
89. Como Admin, quero que gerar, regerar e revogar virem Log, e que o token e o endereço nunca apareçam nos Logs, para auditar sem expor.

### Alteração 7: Notificações push

90. Como pessoa da Liderança ou Professor, quero ativar as Notificações em "Minha conta", só depois de tocar num botão, para dar consentimento consciente.
91. Como usuário de iPhone ou iPad, quero ser orientado a "Compartilhar → Adicionar à Tela de Início" antes de ativar, para que o push funcione.
92. Como pessoa, quero ver o estado do dispositivo (ativo, bloqueado com instrução, não suportado), para saber o que fazer.
93. Como pessoa, quero ver a lista dos meus dispositivos, desativar um ou todos, para controlar onde recebo.
94. Como pessoa, quero que sair da conta remova a inscrição daquele dispositivo, para não receber o aviso de outra pessoa no mesmo aparelho.
95. Como pessoa, quero ligar e desligar cada tipo de Notificação e definir uma janela de horário (padrão 8h às 21h), para não ser incomodada fora de hora.
96. Como pessoa, quero que Notificações fora da janela esperem abrir, exceto as urgentes (mudança ou cancelamento de Evento que começa em menos de 12 h), para não perder o que não pode esperar.
97. Como pessoa, quero ser avisada quando me tornarem Responsável por um Evento, ou Professor ou Auxiliar de uma aula, para saber na hora.
98. Como pessoa, quero lembretes 1 dia e 2 horas antes dos meus Eventos, para me preparar.
99. Como pessoa, quero ser avisada quando um Evento meu mudar de data, hora ou local, ou for cancelado, para não ir ao lugar errado.
100. Como líder, quero um resumo semanal (domingo às 19h) com meus Eventos, para planejar.
101. Como Professor ou Auxiliar, quero ser avisado quando a aula já passou e a Chamada está pendente, para não esquecer.
102. Como Admin, quero ser avisado dos Eventos dos próximos 7 dias sem Responsável, para corrigir a tempo.
103. Como pessoa, quero que o texto seja curto, com nome, data, hora e local (exceto Pequeno grupo, que omite o local), para ler na tela bloqueada sem expor ninguém.
104. Como pessoa, quero que a Notificação nunca traga dados de Adolescentes, para não vazar nada na tela bloqueada.
105. Como pessoa, quero que tocar na Notificação abra o app direto no Evento (ou na Chamada), reaproveitando a janela aberta, para ir direto ao ponto.
106. Como pessoa, quero que um lembrete atualizado substitua o anterior em vez de empilhar, e que lembretes velhos expirem, para não receber avisos enganosos.
107. Como pessoa, quero uma central de Notificações dentro do app, com não lidas destacadas, marcação de lida e link para o Evento, para ver o que perdi se o push falhar.
108. Como pessoa, quero um indicador de não lidas no menu, para notar novidades.
109. Como Admin, quero ligar e desligar o canal, ver a fila (pendentes, enviadas, falhas), editar os horários dos lembretes e do resumo semanal, e ver quantas pessoas têm um dispositivo ativo, para operar o canal.
110. Como Admin, quero enviar uma notificação de teste para mim, para confirmar que está tudo certo.
111. Como Admin, quero um modo de teste (dry-run) que registre o que seria enviado sem enviar, para validar em produção sem incomodar ninguém.
112. Como Admin, quero que a mesma Notificação nunca seja enviada duas vezes, mesmo que o agendador rode em duplicidade, para não irritar as pessoas.
113. Como Admin, quero retentativas com espera crescente e limite para falhas passageiras, com falhas definitivas nos Logs, para não perder avisos nem insistir à toa.
114. Como Admin, quero que uma inscrição expirada (404/410) seja removida sozinha, para a lista de dispositivos não crescer com lixo.
115. Como Admin, quero que o envio a cada dispositivo seja independente, para uma falha não impedir os outros.
116. Como Admin, quero que as Notificações antigas sejam apagadas depois de 30 dias (configurável), para não acumular dados.
117. Como Admin, quero que endpoints, chaves de inscrição e chaves VAPID nunca apareçam em Logs, telas ou exportações, para proteger as inscrições.

## Implementation Decisions

### Decisões gerais

- **Esquema:** só migrações novas e aditivas (colunas opcionais ou com valor padrão, tabelas novas), cada tabela nova com políticas por linha; sem apagar nem renomear nada. Cada alteração indica como reverter.
- **Permissões** valem no banco (políticas por linha, funções `security definer`, gatilhos), e a interface continua fina, como no projeto.
- **Logs:** reaproveita o sistema existente. Módulos novos (drive, notificacoes, calendario) exigem estender a lista de módulos permitidos e os textos das ações. Nenhum Log guarda token, endereço do feed, endpoint, chave de inscrição, chave VAPID, e-mail ou dados de Adolescentes.
- **Segredos:** credenciais do Google, chaves VAPID privada e service-role, e `CRON_SECRET` só como variáveis de ambiente do servidor; a chave pública VAPID é a única exposta ao navegador. As variáveis novas entram no `.env.example` e no README.
- **Chave service-role (primeira do projeto, ADR 0007):** usada somente pelas rotas de agendador, de feed `.ics` e de envio de push.
- **Agendador (ADR 0007):** `pg_cron` do Supabase chama com `pg_net` rotas do app protegidas por `CRON_SECRET`; as rotas processam as filas do banco. A hospedagem é Vercel (ou Cloudflare Pages), sem depender do cron da plataforma.
- **Configurações do Admin:** reaproveita a tela e a tabela de Configurações existentes (cada mudança vira Log). Nela ficam: integração do Drive ligada ou desligada, ID da pasta raiz, Categorias com pasta automática, limite de download, janela da Chamada, horários de lembrete e do resumo semanal, limite de urgência, retenção da central, canal de Notificações ligado ou desligado.
- **Idioma e fuso:** pt-BR; todo horário em America/Bahia.
- **Dependências novas:** apenas uma biblioteca de envio de push (`web-push`) e o cliente HTTP do Drive (a API é chamada direto, com assinatura JWT da service account feita com o módulo de criptografia do Node, para evitar um pacote grande, a menos que o desenho mostre vantagem clara). Nada de bibliotecas de formulário ou validação, que o projeto não usa.

### Alteração 1

- A tela de Professores passa a ter duas entradas que compartilham o mesmo conteúdo: dentro do Admin (com o layout e a barra lateral do Admin e o item ativo) e fora dele (para líderes de Ensino, como hoje). O Admin que abre a entrada de fora é redirecionado para a de dentro.
- A lista única de destinos do Admin passa a apontar para a entrada de dentro, e o cabeçalho continua apontando para a de fora para quem não é Admin. A revalidação de cache cobre as duas.
- A premissa do pedido original (apontar para o catálogo) estava errada: o catálogo gerencia Funções, Categorias e campos, não professores. O resumo da entrega registra a diferença.

### Alteração 2

- **Campos nativos por Categoria (ADR 0008):** configuração aditiva na Categoria, com o estado de cada campo nativo (local, fim, observações, link): oculto, visível ou obrigatório; padrão é "visível", para que as Categorias existentes não mudem. Editável pelo Admin na tela de Categorias e já no formulário de criação.
- **Valores iniciais** (derivados da tabela proposta, ajustados ao que existe): Postagem oculta local e fim e usa o início como "Publicação"; as demais seguem a tabela do pedido (local obrigatório onde fizer sentido, como em Evento extra e Acampamento, será decidido na auditoria e registrado na migração). Valores antigos em campos que ficaram ocultos permanecem no banco; a entrega lista os Eventos afetados.
- **Auditoria campo a campo:** cada Categoria é comparada com a tabela proposta. Diferenças já conhecidas: o Pequeno grupo ganha o campo "Link do material"; a Culto já tem "Observações da liturgia"; o Acampamento já tem os campos pedidos.
- **Formulário, validação, cartões e telas de detalhe** são guiados por essa configuração e pela definição de campos já existente (ADR 0002). O gatilho de validação do banco passa a respeitar os campos nativos ocultos e obrigatórios.
- **Séries:** a regra aceita no máximo repetição semanal, por até 6 meses a partir do primeiro dia, com teto de segurança de 52 Ocorrências. Não existem Séries em produção, então a regra vale para todas. O formulário explica o limite.
- **Número da Ocorrência:** coluna opcional nova no Evento, preenchida na criação da Série na ordem das datas, vazia nos Eventos avulsos e nos existentes. Cancelar não renumera. Uma função de título de exibição compõe "Título · número" e é usada em todas as telas, exportações, iCal e Notificações.
- Título automático por modelo foi descartado.

### Alteração 3

- **Cliente do Drive (adaptador):** interface pequena (criar pasta dentro de uma pasta, listar filhos, obter pais e metadados, baixar conteúdo) com uma implementação sobre a API v3 e uma falsa em memória para testes. Inclui a checagem de ascendência até a pasta raiz, compartilhada com a Alteração 4.
- **Credenciais:** service account em variável de ambiente do servidor; a pasta raiz vem de Configurações. A integração desligada ou sem credenciais nunca quebra a criação de Eventos.
- **Estrutura:** caminho padrão configurável `<raiz>/<Categoria>/<Ano>/<AAAA-MM-DD · título>`; pastas de Categoria e ano criadas só se faltarem. O título usado é o de exibição (com número da Série).
- **Fila:** tabela de tarefas de pasta (Evento, estado, tentativas, próxima tentativa, erro), processada por rota chamada pelo agendador, com chave de idempotência por Evento. A criação de Evento ou Série só enfileira, nunca espera o Drive; cada Ocorrência de uma Série ganha sua tarefa.
- **Evento:** colunas opcionais novas para o ID da pasta e o estado da criação. Se "Link do material" já tiver valor digitado no momento da criação, não há tarefa nem sobrescrita. Se o campo for preenchido à mão depois, o link manual prevalece.
- **Mudanças:** renomear a pasta quando título ou data mudarem (tarefa de renomear); cancelar o Evento não faz nada; nunca apagar. Botão "Criar pasta agora" para reprocessar uma falha ou um Evento criado antes da integração.
- **Aviso na interface:** o link só abre para quem tem acesso à pasta no Drive.
- **ADR 0006:** a service account é dona das pastas criadas, por falta de Drive compartilhado; isso é uma limitação registrada.

### Alteração 4

- **Seção "Arquivos"** só para a Liderança (Professores e Pendentes não têm acesso, nem no banco nem na interface).
- **Atalhos:** tabela nova (nome, ícone, ID da pasta, ordem) e tabela de ligação com Funções; atalho sem Função marcada vale para toda a Liderança; o Admin e a Função Geral veem todos. Cadastro e edição na administração, com Log.
- **Navegação:** listagem paginada de uma pasta (grade com miniaturas ou lista), breadcrumb até a raiz ou o atalho, ordenação por nome e data, cache de poucos minutos e botão "Atualizar". Busca por nome na raiz inteira com índice em cache de 5 minutos, com teto de pastas percorridas (se estourar, avisa e usa só a pasta atual).
- **Segurança:** todo pedido passa pelo servidor e confere que o item está dentro da pasta raiz pela cadeia de pais; atalho só é aceito se permitido à pessoa. Miniaturas, pré-visualização e download saem de endpoints do próprio app, com checagem de permissão e cache; nenhum token ou URL do Drive vai ao navegador.
- **Ações:** abrir no Drive, copiar link e baixar, com limite de tamanho configurável (padrão 4 MB); maiores só "Abrir no Drive".
- **Link do Evento:** quando a Pasta do Evento está dentro da raiz, o link do Evento oferece "Abrir em Arquivos" na pasta certa.
- **Estados:** Drive desligado ou com erro mostra uma mensagem clara, sem tela quebrada.

### Alteração 5

- **Tela principal:** nova ordem (cartão de Chamada quando houver, "Meus eventos desta semana", alertas, "Esta semana no ONDA" com a opção "só os meus", "Próximos eventos" reduzido ao grupo "Depois", aniversariantes). Reaproveita os filtros, a semana (a mesma do atalho "Esta semana") e a lógica de alertas existentes, sem consultas novas duplicadas.
- **Eventos do usuário:** os em que é Responsável e as aulas em que é Professor ou Auxiliar. O Professor de nível Professor segue vendo só as aulas dele ("Suas aulas") e ganha o cartão de Chamada.
- **Cartão de Chamada:** estado calculado em código puro a partir da aula, do relógio e da janela configurável (início do dia da aula até o fim do dia seguinte): "de hoje", "feita ✓" ou "pendente" (horário da aula passado sem Chamada). Aparece só para o Professor e o Auxiliar da aula.
- **Permissão no banco:** a função que decide quem pode fazer a Chamada passa a incluir o Professor e o Auxiliar daquela aula (ligados pelos campos "Professor" e "Auxiliar" do Evento), a partir do dia da aula. Uma função `security definer` devolve ao Professor apenas nome e identificador dos Adolescentes ativos da Chamada daquela aula, nunca nascimento; a tabela de Adolescentes continua restrita à Liderança. Salvar e corrigir a Chamada respeita a mesma regra, e vira Log.
- Não existe ligação entre professor e catálogo: o Professor é um usuário. O resumo registra que a ligação do pedido original não se aplica.

### Alteração 6

- **Endereço pessoal:** tabela nova de assinaturas (uma por pessoa), com hash do token, filtros (todos ou meus, Categorias, aniversários), datas de criação e de uso. O token longo e aleatório é mostrado uma só vez; regerar substitui, revogar apaga. Políticas: só o dono.
- **Feed `.ics`:** rota pública autenticada pelo token, que consulta pelo hash com a chave service-role, aplica o limite de requisições por token (padrão 60 por hora) e devolve 429 acima disso. Gerar, regerar e revogar viram Log; token e endereço nunca são registrados.
- **Conteúdo:** Eventos Planejados, Confirmados, Realizados e Adiados (com "[Adiado]" no título); exclui Cancelados e Rascunhos. Cada Ocorrência vira um evento individual, respeitando as edições. Identificador estável por Evento. America/Bahia nos horários (Postagem na data de publicação). Título de exibição (com número da Série), local quando existir e link do material na descrição. O Professor de nível Professor recebe só as aulas dele. Aniversários só para a Liderança, por opção, só com o primeiro nome do Adolescente.
- **Geração:** função pura que, dado uma lista de Eventos e as opções, produz o texto `.ics`; a rota só busca os dados e chama essa função.

### Alteração 7

- **Inscrições:** tabela nova por dispositivo (usuário, endpoint, chaves, nome amigável, criação, último uso); políticas estritas (só o dono e o servidor), sem leitura de endpoint e chaves pela interface. Cadastro e remoção por ação do próprio usuário.
- **Service worker:** o `sw.js` existente é estendido com tratamento de `push` (exibe com título, texto, `tag` e dados mínimos) e `notificationclick` (reaproveita uma janela aberta ou abre o Evento ou a Chamada); sem segundo service worker.
- **Fila (ADR 0007):** tabela de Notificações com chave única (tipo + Evento + pessoa + janela), conteúdo mínimo, estado, tentativas, próxima tentativa, `tag`, validade (TTL), lida e criação; serve também de central dentro do app. Geradores no banco ou na rota de agendador produzem os avisos devidos (designação, lembretes, mudança ou cancelamento, resumo semanal, Chamada pendente, Eventos sem Responsável para o Admin).
- **Entrega:** a rota do agendador lê a fila, respeita a janela de horário da pessoa e as urgências, envia a cada dispositivo ativo separadamente, remove inscrições com 404 ou 410, e faz retentativas com espera crescente e limite. O envio é um adaptador com uma versão falsa para testes; um modo de teste (dry-run) por variável de ambiente só registra.
- **Conteúdo:** modelos de texto em um mapa no código, em pt-BR, curtos. Título de exibição, data, hora e local (omitido no Pequeno grupo). O conteúdo nunca inclui dados de Adolescentes; o texto é montado a partir de campos permitidos, nunca de campos livres de Adolescentes.
- **Quem recebe:** Liderança e Professores (só sobre as próprias aulas); resumo semanal e alertas de gestão só para a Liderança; o aviso de Eventos sem Responsável só para o Admin.
- **"Minha conta":** página nova para todas as pessoas aprovadas, aberta pelo menu do cabeçalho, com as seções "Notificações" (ativação após um toque, orientação de instalação em iPhone, estado do dispositivo, lista de dispositivos, tipos e janela de horário) e "Calendário" (Alteração 6). Sair da conta remove a inscrição daquele dispositivo.
- **Central e indicador:** lista das Notificações da pessoa, com não lidas em destaque e marcação de lida, e contador no menu. Retenção configurável (padrão 30 dias), com limpeza agendada.
- **Administração:** canal ligado ou desligado, fila (pendentes, enviadas, falhas), horários dos lembretes e do resumo, limite de urgência, quantas pessoas têm dispositivo ativo e um botão de notificação de teste.
- **VAPID:** documentação de como gerar e rotacionar as chaves; a pública no navegador e a privada só no servidor.

## Testing Decisions

- **O que é um bom teste:** exercita comportamento visível (entradas e saídas do código de domínio, resultado das políticas do banco, efeito no adaptador falso), não detalhes de implementação. Cada teste novo segue o estilo dos existentes.
- **`src/dominio/` (vitest `dominio`, sem banco):**
  - visibilidade e validação dos campos nativos por Categoria (obrigatórios exigidos, ocultos ignorados, compatibilidade com Eventos existentes);
  - limites das Séries (no máximo semanal, até 6 meses, teto de 52) e numeração (ordem das datas, sem renumerar ao cancelar);
  - montagem da tela principal e semana (Meus eventos, Esta semana, "só os meus", alertas, estados vazios, grupo "Depois");
  - estado do cartão de Chamada (dia certo, só Professor e Auxiliar, janela, "feita", "pendente");
  - geração do `.ics` (identificador estável, America/Bahia, Cancelados e Rascunhos fora, Adiado marcado, filtros, aniversários só com primeiro nome, descrição com título, local e link);
  - regras de Notificação (chave de idempotência, janela de horário, urgência de 12 h, modelos de texto, payload sem dados de Adolescentes, Pequeno grupo sem local);
  - planejamento de pasta (nome, caminho, título de exibição) e a checagem de que um item está dentro da raiz pela cadeia de pais;
  - destino dos links de Professores por perfil.
- **`tests/rls/` (exige Supabase local):**
  - tabelas e funções novas: Professor e Auxiliar fazendo Chamada só daquela aula e a partir do dia dela, sem acesso à data de nascimento nem a outras aulas; inscrições de push visíveis só ao dono; fila de Notificações com chave única; feed por hash com revogação e limite; atalhos de Arquivos visíveis só às Funções permitidas; configuração dos campos nativos; Série e numeração; Professores e Pendentes sem Arquivos.
- **Adaptadores com falsos em memória:**
  - Drive: criação de pasta sem duplicar, ordem Categoria/Ano/título, falha com nova tentativa e esgotamento, integração desligada ou sem credenciais, renomear sem apagar, bloqueio de item fora da raiz, listagem e erro da integração;
  - Push: vários dispositivos, remoção por 404 e 410, falha de um dispositivo sem afetar os outros, dry-run, opt-in e opt-out, ausência de dados de Adolescentes e de endpoints nos Logs.
- **Playwright (`tests/fumaca/`), só o essencial:** barra lateral e item ativo em Professores dentro do Admin, cartões da tela principal e a página "Minha conta". O clique da Notificação no service worker é verificação manual, descrita no resumo.
- **Prior art:** `src/dominio/*.test.ts` (regras puras), `tests/rls/*.test.ts` (políticas por linha, em especial presença e professores) e `tests/fumaca/fluxos.spec.ts`.
- **Linha de base:** `pnpm typecheck`, `pnpm lint`, `pnpm test` e a fumaça passam antes de começar e depois de cada alteração.

## Out of Scope

- Upload de arquivos pelo app (Arquivos é só leitura).
- Acesso dos Adolescentes ao app e Notificações para Adolescentes ou pais.
- Notificações por WhatsApp, SMS ou e-mail (apenas push e a central).
- Checklists novos, modelos de Evento, painéis de relatório e qualquer melhoria não listada.
- Drive compartilhado (o ministério não tem Workspace; o desenho permite trocar depois, ADR 0006).
- Título automático por modelo, descartado em favor do número da Ocorrência.
- Migrar local e observações para campos por Categoria (ADR 0008).
- Séries mais frequentes que semanal ou mais longas que 6 meses.
- Apagar ou mover qualquer coisa no Drive.

## Further Notes

- Ordem de entrega: 1 → 2 → 3 → 4 → 5 → 6 → 7. Dependências: 2 antes de 3, 5 e 6 (campos e numeração); 3 antes de 4 (cliente do Drive e raiz); 5 (Chamada do Professor) antes do aviso de "Chamada pendente" da 7; 6 e 7 são independentes entre si e compartilham a página "Minha conta".
- Há uma chave service-role nova, só no servidor, para o agendador, o feed e o envio (ADR 0007).
- A hospedagem não está confirmada nos documentos ("Vercel ou Cloudflare Pages"); o desenho com `pg_cron` e `pg_net` independe dela. O limite de resposta de funções serverless motiva o teto de 4 MB do download.
- Limitações a registrar nos resumos: pastas do Drive pertencem à service account (sem Workspace); o clique da Notificação no service worker é teste manual; Eventos existentes com valor em campo nativo que ficou oculto continuam com o dado no banco.
- Variáveis de ambiente novas: credenciais da service account do Google, `CRON_SECRET`, chave service-role, VAPID pública e privada, e o interruptor do modo de teste das Notificações. ID da pasta raiz e demais opções ficam em Configurações do Admin.
- Cada alteração vira um ou mais commits em `develop`, no estilo dos tickets anteriores, e termina com um resumo curto (o que foi feito, decisões, suposições, limitações, como testar à mão e como reverter).
