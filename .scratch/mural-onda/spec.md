Status: ready-for-agent

# Mural ONDA — Spec do MVP

Usa o vocabulário de `CONTEXT.md` e respeita os ADRs 0001 a 0003. O que ficou para depois está em `docs/pos-mvp.md`. O escopo original está em `docs/escopo-mvp-mural-onda.md`; onde a spec e o escopo divergirem, vale a spec.

## Problem Statement

A Liderança do ONDA (seis pessoas) coordena Eventos e pessoas espalhados entre conversas de WhatsApp e uma tentativa de organização no Notion que não funcionou. Ninguém sabe com segurança quem é o Responsável por cada coisa, em que Status ela está, nem o que vem na semana. Os Professores da EBD dependem de mensagens soltas para saber suas aulas e onde está o material. Os dados dos Adolescentes (menores) não têm um lugar controlado.

## Solution

Um aplicativo web instalável (PWA), usado principalmente no celular, com um calendário único em que todo Evento tem Categoria, data, Responsável e Status. A Liderança cria Eventos e Séries conforme a Área da sua Função, filtra o que importa para si, recebe alertas dentro do app sobre o que está sem dono ou parado, e vê aniversários. Os Professores entram e veem só as aulas deles. O cadastro de Adolescentes fica restrito à Liderança.

## User Stories

### Contas e acesso
1. Como Admin, quero gerar um link de convite de uso único com nível, Função e validade, para que quem entrar por ele já esteja aprovado.
2. Como Admin, quero que a validade padrão do convite seja de 7 dias e editável, para que um link esquecido no WhatsApp não fique valendo para sempre.
3. Como pessoa convidada, quero me cadastrar com nome, e-mail, senha e data de nascimento pelo link, para entrar já com minha Função.
4. Como pessoa sem convite, quero me cadastrar mesmo assim e aguardar aprovação, para pedir acesso.
5. Como Pendente, quero uma tela clara dizendo que aguardo aprovação, para saber que não preciso fazer nada.
6. Como Pendente, quero não ver nenhum dado do ministério, para que ninguém de fora enxergue informações de menores.
7. Como Admin, quero ver a lista de Pendentes e aprová-los definindo nível e Função, ou recusá-los, para controlar quem entra.
8. Como Admin, quero desativar um usuário sem apagar o histórico dos Eventos dele, para que a saída de alguém não quebre o calendário.
9. Como Admin, quero promover outra pessoa a Admin, para não depender de uma única pessoa.
10. Como usuário, quero entrar, sair e recuperar minha senha, para não perder o acesso.
11. Como Admin, quero ver os usuários ativos com nível e Funções, para saber quem tem acesso.

### Áreas, Funções e Categorias (configuração)
12. Como Admin, quero cadastrar e editar Funções, cada uma ligada a uma Área, para ajustar permissões sem mexer em código.
13. Como Admin, quero atribuir várias Funções à mesma pessoa, para refletir quem tem mais de um papel (como Lucas e Carol Leal).
14. Como Admin, quero ver e editar a Área de cada Categoria, para mudar quem cria o quê.
15. Como Admin, quero criar uma Categoria nova definindo seus campos (nome, tipo, obrigatório), para o ministério crescer sem mudar o banco.
16. Como Admin, quero definir cor para cada Categoria, para que o calendário seja legível.
17. Como Admin, quero que os campos específicos aceitem texto curto, texto longo, link, valor em reais, data, data e hora, escolha de uma opção, lista de itens, pessoa e checklist, para cobrir todas as Categorias do escopo.
18. Como Admin, quero o catálogo inicial já carregado (Áreas, Funções, Categorias e campos do escopo), para começar a usar no primeiro dia.

### Eventos
19. Como líder com Função numa Área, quero criar um Evento de qualquer Categoria dessa Área, para organizar meu trabalho.
20. Como líder com Função Geral, quero criar Eventos de qualquer Categoria, inclusive Reunião de liderança, para coordenar o ministério.
21. Como líder, quero não conseguir criar Eventos de Categorias de outras Áreas, para evitar bagunça no calendário.
22. Como líder, quero informar título, Categoria, início, fim opcional, local, Responsável, Status, observações e link opcional, para descrever o Evento.
23. Como líder, quero deixar a hora vazia e ter um Evento de dia inteiro, para registrar o que não tem horário.
24. Como líder, quero preencher os campos específicos da Categoria, para guardar o que é próprio dela (tema, valor, pauta etc.).
25. Como líder, quero salvar um Evento como Rascunho sem Responsável, para registrar uma ideia antes de ter dono.
26. Como líder, quero ser impedido de tirar um Evento de Rascunho sem Responsável, para que nada fique sem dono.
27. Como líder, quero escolher qualquer pessoa da Liderança como Responsável, mesmo sem permissão de criar aquela Categoria, para delegar.
28. Como líder, quero um único Responsável por Evento, para ter clareza de quem responde.
29. Como Responsável, quero editar meu Evento e mudar seu Status, para mantê-lo atualizado.
30. Como líder com Função na Área da Categoria, quero editar Eventos dela e mudar seu Status, mesmo sem ser o Responsável, para cobrir o trabalho de outros.
31. Como líder, quero mudar o Status livremente entre Rascunho, Planejado, Confirmado, Cancelado e Adiado, sem ordem obrigatória, para refletir a realidade.
32. Como Responsável ou Admin, quero marcar um Evento como Realizado depois do horário de fim, para registrar o que aconteceu.
33. Como líder, quero que um Evento Confirmado vire Realizado sozinho após o horário de fim (ou no dia seguinte, se não houver fim), para não manter o calendário manualmente.
34. Como líder, quero que Rascunho e Planejado que passaram da data não virem Realizado sozinhos, para que alguém decida.
35. Como líder, quero ver Evento Cancelado riscado e Adiado mantendo sua data com marca própria, para distingui-los.
36. Como líder, quero remarcar um Adiado mudando a data e voltando-o a Planejado, para retomar o Evento.
37. Como Admin, quero excluir um Evento, para remover erros; os demais usam Cancelado.
38. Como líder, quero que o Evento mostre quem criou e quem editou por último, para saber a quem perguntar.
39. Como Admin, quero que todas as alterações de um Evento sejam gravadas (quem, quando, o que mudou), para auditoria futura.
40. Como líder, quero criar um Evento de Postagem cuja data é a de publicação, para não ter duas datas competindo.
41. Como líder, quero criar um Evento de Acampamento de vários dias, com tema, valor, link de inscrição, link de autorização dos pais, itens a levar, checklist, anotações e um link único para todos os materiais, para organizar o acampamento num só lugar.
42. Como líder, quero marcar itens do checklist como feitos, para acompanhar tarefas do Evento.
43. Como líder, quero criar um Evento extra com tipo (gincana, intercâmbio, campeonato, outro), parceiro, valor, link de inscrição e o que levar, para cobrir eventos fora da rotina.
44. Como líder, quero escolher o grupo no Pequeno grupo a partir de uma lista configurável, para que a divisão futura caiba sem retrabalho.

### Séries e Ocorrências
45. Como líder, quero criar um Evento como Série semanal, quinzenal ou mensal, para não cadastrar cada data.
46. Como líder, quero escolher os dias da semana da Série semanal e quinzenal, para cobrir mais de um dia.
47. Como líder, quero que a Série mensal seja pelo N-ésimo dia da semana ("primeiro domingo", "último sábado"), para refletir a rotina do ministério.
48. Como líder, quero encerrar a Série por data final ou por número de Ocorrências, para não gerar datas sem fim.
49. Como líder, quero editar uma Ocorrência individualmente (horário, Responsável, Professor, local), para tratar exceções.
50. Como líder, quero editar "só esta", "esta e as seguintes" ou "toda a série", para mudar uma rotina sem repetir o trabalho.
51. Como líder, quero que "esta e as seguintes" e "toda a série" alterem as Ocorrências sem tirá-las da Série nem dividi-la, para manter o vínculo.
52. Como líder, quero que Ocorrências editadas individualmente não sejam sobrescritas por uma edição em série, para não perder exceções.
53. Como líder, quero que Ocorrências Realizadas ou Canceladas fiquem congeladas diante de edições em série, para preservar o histórico.
54. Como líder, quero cancelar uma única Ocorrência sem afetar as outras, para pular uma data.
55. Como líder, quero encerrar a Série (as futuras deixam de existir) ou cancelar todas as futuras, para fechar um semestre.
56. Como Admin, quero excluir uma Série com todas as Ocorrências, para remover erros de cadastro.
57. Como líder, quero que só quem pode criar a Categoria crie a Série, para seguir a mesma regra.

### Calendário e navegação
58. Como líder, quero ver o calendário na visão mensal, semanal e em lista, para escolher a que me serve.
59. Como líder no celular, quero que a lista seja a visão padrão, para navegar com o polegar.
60. Como líder, quero que a semana vá de segunda a domingo, para a semana do ministério fazer sentido.
61. Como líder, quero cor por Categoria e Status indicado visualmente, para ler o calendário de relance.
62. Como líder, quero ver Rascunho com destaque visual, para não confundi-lo com algo confirmado.
63. Como líder, quero ver Eventos de dia inteiro no topo do dia, para separá-los dos que têm hora.
64. Como líder, quero filtrar por "meus eventos" (Responsável, Professor ou Auxiliar), para ver o meu.
65. Como líder, quero filtrar por esta semana, por um dia, por uma ou várias Categorias, por Área e por Status, e combinar os filtros, para achar o que preciso.
66. Como líder, quero uma tela inicial com Próximos eventos agrupados em hoje, esta semana e depois, para ver o que vem.
67. Como líder, quero os meus Eventos destacados nessa lista, para achá-los primeiro.
68. Como líder, quero alertas de Eventos sem Responsável, em Rascunho, Planejado ou Rascunho que passaram da data e aulas sem Professor, para cobrar o que está parado.
69. Como líder, quero ver todos os Eventos de todas as Áreas, para saber o que acontece em todo o ministério.
70. Como líder, quero ver todos os horários no fuso America/Bahia, para não haver confusão.
71. Como usuário, quero uma mensagem clara quando estiver sem internet, para saber que o app não conseguiu carregar.

### Adolescentes e aniversários
72. Como líder, quero cadastrar, editar e inativar Adolescentes (nome e data de nascimento), para manter a lista do ministério.
73. Como Admin, quero o mesmo acesso a Adolescentes que qualquer líder, para poder gerenciar tudo.
74. Como líder, quero buscar Adolescentes por nome e ordenar por próximo aniversário, para achar e preparar os parabéns.
75. Como líder, quero ver aniversários de Adolescentes ativos e de líderes no calendário, sem eles serem Eventos gravados, para não duplicar dados.
76. Como líder, quero ver o bloco de aniversariantes do mês na tela inicial, para lembrar das datas.
77. Como líder, quero que Adolescente inativo saia da lista e dos aniversários, para o calendário não poluir.
78. Como líder, quero que o 29/02 seja tratado de forma previsível, para aniversariantes desse dia não sumirem.
79. Como líder, quero que dados dos Adolescentes só apareçam para a Liderança aprovada e fiquem fora de buscadores, para proteger menores.

### Professores
80. Como líder com Função em Ensino, quero cadastrar um Professor e gerar seu convite, para dar acesso às aulas dele.
81. Como Admin, quero inativar um Professor, para encerrar o acesso sem perder o histórico.
82. Como líder, quero escolher Professor e Auxiliar de cada aula a partir da tabela de Professores, para designar quem dá a aula.
83. Como líder, quero escolher uma pessoa da Liderança como Professor ou Auxiliar sem outro cadastro, para os líderes que também dão aula.
84. Como líder, quero um Professor e um Auxiliar diferentes por Ocorrência, para refletir a escala real.
85. Como Professor, quero entrar e ver no calendário apenas as aulas em que fui colocado, para saber minha escala.
86. Como Professor, quero ver todos os campos das minhas aulas (tema, horário, local, link do material, observações), para me preparar.
87. Como Professor, quero editar as observações das minhas aulas, para registrar o que for necessário.
88. Como Professor, quero não ver Adolescentes, aniversários nem outros Eventos, para que dados de menores fiquem com a Liderança.
89. Como Professor, quero não poder mudar status, data ou responsável, para evitar alterações acidentais.
90. Como Auxiliar, quero o mesmo acesso do Professor às aulas em que fui colocado, para me preparar também.

### Administração e dados
91. Como Admin, quero exportar Eventos, Adolescentes e Usuários em CSV, para ter cópia fora do sistema.
92. Como Admin, quero que a exportação fique registrada (quem e quando), para rastrear acesso a dados de menores.
93. Como Admin, quero ver o registro de alterações de um Evento, para auditar mudanças (fora do MVP a tela; o registro já é gravado).

### PWA e identidade
94. Como usuário, quero instalar o app na tela inicial do celular, com ícone e tela de abertura do ONDA, para abri-lo como um aplicativo.
95. Como usuário, quero a interface em pt-BR, para entender tudo sem ajuda.
96. Como usuário, quero a identidade visual do ONDA (azuis das logos), para reconhecer o ministério.
97. Como usuário, quero alternar entre modo claro e escuro, para usar de dia ou de noite.
98. Como usuário, quero ver a logo da igreja no rodapé, para lembrar a que igreja pertencemos.

## Implementation Decisions

### Módulos
- **Módulo de domínio do Mural** (TypeScript puro, sem dependência de banco ou interface). Concentra as regras e é o ponto de teste principal. Interface pública, em termos do glossário:
  - decidir se uma pessoa pode criar, editar, mudar o status ou excluir um Evento (e Série);
  - expandir uma Série em Ocorrências a partir da frequência, dos dias, do N-ésimo dia da semana, do término e do fuso;
  - aplicar uma edição de Série ("só esta", "esta e as seguintes", "toda a série") respeitando Ocorrências editadas e congeladas;
  - calcular os alertas (sem Responsável, Rascunho e Planejado vencidos, aula sem Professor);
  - aplicar a transição automática para Realizado;
  - filtrar Eventos (meus, semana, dia, Categoria, Área, Status, combinados);
  - calcular aniversários e o bloco do mês;
  - resolver o que cada nível de acesso enxerga.
- **Políticas de acesso por linha no Postgres/Supabase**, o segundo ponto de teste. Expressam a mesma permissão do módulo de domínio.
- **Camada de interface** (Next.js, PWA): telas de início, calendário, criação e edição de Evento, Adolescentes, Professores, administração, convites e aprovação. Fica fina, sem regra de negócio própria.

### Acesso e permissões
- Níveis de acesso: Admin, Líder, Professor e Pendente. Admin e Líder compõem a Liderança. O sistema aceita vários Admins; hoje só Lucas.
- Permissão de criar Evento vem da Área da Função (ADR 0001). Uma pessoa pode ter várias Funções e recebe a união das Categorias das Áreas delas. A Área Geral cria todas as Categorias. Reunião de liderança pertence à Geral.
- Catálogo inicial:
  - Áreas: Geral, Ensino, Programação, Comunicação, Louvor, Acampamento.
  - Mapa Categoria → Área: EBD e Pequeno grupo → Ensino; Culto, Evento extra e Serviço → Programação; Postagem → Comunicação; Ensaio de louvor → Louvor; Acampamento → Acampamento; Reunião de liderança → Geral.
  - Funções: Líder do ministério e Co-líder do ministério (Geral), Líder do ensino (Ensino), Líder do louvor e Líder do louvor dos adolescentes (Louvor), Líder de comunicação e mídia (Comunicação), Líder e Co-líder de integração e programação (Programação).
  - Lucas: Líder do ministério + Líder do ensino. Carol Leal: Co-líder do ministério + Líder do louvor dos adolescentes. Beythel: Líder do louvor. Carol França: Líder de comunicação e mídia. Mariana e Denize: as Funções de integração e programação.
- Editar um Evento e mudar seu Status: Admin, quem tem Função na Área da Categoria do Evento (inclusive Geral), ou o Responsável. Excluir: só Admin.
- Gerenciar Adolescentes: qualquer Admin ou Líder. Cadastrar Professores e gerar convites de Professor: Admin e quem tem Função em Ensino. Inativar Professor: só Admin.
- Cadastro sem convite gera Pendente. O Admin aprova definindo nível e Função, ou recusa. Convite: uso único, validade padrão de 7 dias, editável.
- O Professor só lê as Ocorrências em que é Professor ou Auxiliar, e só escreve nas observações delas. Não lê Adolescentes, aniversários nem outros Eventos.

### Eventos
- Campos comuns: título, Categoria, início (data, hora opcional), fim opcional, local, Responsável, Status, observações, link opcional. Sem hora, o Evento é de dia inteiro. Guarda criador e último editor.
- Responsável: único, qualquer pessoa da Liderança, obrigatório para sair de Rascunho. Responsável desativado faz o Evento futuro contar como "sem Responsável".
- Status: Rascunho, Planejado, Confirmado, Realizado, Cancelado, Adiado, com transições livres. Realizado é automático para Confirmado após o fim (ou no dia seguinte, sem fim), ou manual do Admin e do Responsável depois do fim. Planejado e Rascunho vencidos ficam parados com alerta. Adiado mantém a data e não gera alerta. Remarcar volta o Evento a Planejado.
- Campos específicos por Categoria são configuração (ADR 0002), com dez tipos fixos: texto curto, texto longo, link, valor em reais, data, data e hora, escolha de uma opção, lista de itens, pessoa e checklist (lista simples de tarefas, texto + feito/não feito). O Admin define os campos.
- Campos específicos do catálogo inicial:
  - EBD: tema, Professor, Auxiliar, link do material (Professor e Auxiliar vêm da tabela de Professores ou da Liderança).
  - Pequeno grupo: grupo (escolha configurável), anfitrião, tema.
  - Culto: quem prega, observações da liturgia.
  - Ensaio de louvor: repertório (link), observações.
  - Reunião de liderança: pauta, link da ata.
  - Postagem: plataforma, link da arte/post (a data de publicação é a do Evento).
  - Evento extra: tipo, parceiro (opcional), valor (opcional), link de inscrição (opcional), o que levar.
  - Acampamento: tema, valor, link de inscrição, link da autorização dos pais, itens a levar, checklist, anotações e um link único para todos os materiais. Local e período vêm do próprio Evento.
  - Serviço: descrição da ação.
- Aula sem Professor entra no alerta, mas não impede sair de Rascunho. O Auxiliar é sempre opcional.
- Registro completo de alterações por Evento é gravado desde o MVP e só o Admin acessa. A tela de consulta fica fora do MVP.

### Séries
- Frequência: semanal, quinzenal (dias da semana escolhidos) ou mensal pelo N-ésimo dia da semana. Término por data ou número de Ocorrências.
- Cada Ocorrência é um Evento editável. Editar "esta e as seguintes" ou "toda a série" altera as Ocorrências afetadas sem dividir a Série nem retirá-las dela. Ocorrências editadas individualmente não são sobrescritas, e Realizadas ou Canceladas ficam congeladas (só o Admin as edita, individualmente).
- Encerrar Série define data final; as Ocorrências já geradas depois dela viram Canceladas. Há também "cancelar todas as futuras". Excluir Série e Ocorrências é só Admin.

### Calendário
- Visões mensal, semanal e lista; no celular a lista é a padrão. A semana vai de segunda a domingo. Fuso fixo America/Bahia.
- Eventos de dia inteiro aparecem no topo do dia. Cor por Categoria e Status visível: Rascunho com destaque, Cancelado riscado, Adiado com marca própria.
- Filtros combináveis: meus eventos (Responsável, Professor ou Auxiliar), esta semana, dia, Categoria (múltipla), Área, Status.
- Próximos eventos: hoje, esta semana e depois, com os meus destacados e alertas.
- Aniversários de líderes e Adolescentes ativos são calculados, sem nome extra além de nome e dia/mês, e nunca gravados como Eventos (ADR 0003). Não aparecem para o Professor.

### Adolescentes
- Cadastro separado dos Usuários, com nome, data de nascimento e ativo/inativo; sem login. Busca por nome e ordenação por próximo aniversário. Inativo sai das listas e dos aniversários, e o histórico fica guardado.

### Dados e privacidade
- Dados coletados: nome, data de nascimento, e-mail e senha. Senhas tratadas só pelo serviço de autenticação.
- Dados de menores só para a Liderança aprovada, fora de buscadores. A autorização dos pais fica fora do app.
- Exportação em CSV por tabela (Eventos, Adolescentes, Usuários), só pelo Admin, com registro de quem e quando.
- Nenhum upload de arquivo; tudo é link.

### Tecnologia e identidade
- Next.js com TypeScript, PWA, Supabase (Postgres, autenticação, políticas por linha), hospedagem Vercel ou Cloudflare Pages com deploy automático do GitHub. Backup é do plano do Supabase.
- Interface em pt-BR, mobile-first, instalável, com modo claro e escuro. Offline completo não é necessário, só mensagem clara sem internet.
- Paleta a partir de `#459ac8` e `#284995` (logos em `assets/`), com cores por Categoria harmônicas e distinguíveis. Logo do ONDA no app; logo da igreja no rodapé.

## Testing Decisions

- Um bom teste exercita comportamento externo pela interface pública do módulo, no vocabulário do glossário, sem espiar detalhes internos nem usar mocks de módulos internos.
- **Módulo de domínio** (ponto principal): tabela de casos por nível de acesso e Função para criar, editar, mudar status e excluir; expansão de Séries (semanal, quinzenal, mensal por N-ésimo dia, término por data e por contagem, mudança de horário de verão não aplicável em America/Bahia); edições "só esta", "esta e as seguintes", "toda a série" com Ocorrências editadas e congeladas; alertas; transição automática para Realizado com e sem horário de fim; filtros combinados; aniversários, inclusive 29/02 e Adolescente inativo; o que o Professor enxerga e edita.
- **Políticas por linha** (segundo ponto): contra um Postgres local do Supabase, com usuários de cada nível (Admin, Líder com Funções diferentes, Professor, Pendente), conferindo que leitura e escrita batem com o módulo de domínio. Casos centrais: Pendente não lê nada, Professor lê só as aulas dele e escreve só observações, só a Liderança lê Adolescentes, quem não tem Função na Área não cria nem edita.
- **Interface**: sem testes de componentes. No máximo um teste ponta a ponta de fumaça por fluxo crítico (login por convite, criar Evento, ver o calendário no celular).
- Não há código anterior, então não há prior art; os dois primeiros testes definem o padrão.

## Out of Scope

Tudo o que está em `docs/pos-mvp.md`: presença e ranking, divisão dos Pequenos grupos, iCal, pastas automáticas no Drive, acesso dos Adolescentes, avisos ativos (push e e-mail), tela do registro de alterações, mensal por dia fixo, responsável e prazo por item do checklist, professores convidados sem login e registro da autorização dos pais. Também ficam de fora upload de arquivos e migração do Notion.

## Further Notes

- Mariana e Denize passam a criar Culto, Evento extra e Serviço; isso muda o critério de aceite 2 do escopo.
- Critérios de aceite do MVP: um líder se cadastra por convite com a Função correta e outra pessoa sem convite fica Pendente; cada Função cria só as Categorias da sua Área; uma Série semanal de EBD permite cancelar uma só data; o calendário mostra as três visões com cor e Status; os filtros combinam; Próximos eventos destaca os meus e alerta o que está sem Responsável; aniversários aparecem no calendário e no bloco do mês; o Professor só vê suas aulas; o app é instalável como PWA e usável pelo celular.
- Ordem sugerida de construção (para `/to-tickets`): contas e permissões, Eventos e calendário, filtros e Séries, Adolescentes e aniversários, Professores, PWA e identidade.
