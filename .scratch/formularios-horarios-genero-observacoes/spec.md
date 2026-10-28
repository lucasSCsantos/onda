Status: ready-for-agent

# Formulários modernos, Horários padrão, Gênero e Observações

## Problem Statement

Os campos de seleção, de marcar e de data do Mural têm a aparência nativa do navegador e destoam do resto do app, sobretudo no celular, onde o seletor de data e de hora do sistema é pouco amigável. Quem cria um Evento precisa digitar o horário todo dia, mesmo que a EBD seja sempre às 9h e o Pequeno grupo sempre às 15h. A Liderança não registra o Gênero de Adolescentes e de pessoas com conta, e não tem onde guardar, de forma organizada e com autoria, o que sabe sobre cada Adolescente para cuidar melhor e passar a informação adiante.

## Solution

Quatro entregas, cada uma em sua própria branch a partir de `develop`, na ordem:

1. Um conjunto próprio de componentes de formulário (select, múltipla escolha, radio, checkbox, calendário de data, de intervalo e com hora), sem dependência nova, que substitui todos os controles nativos do app.
2. Horários padrão por Categoria, editáveis pelo Admin, que já vêm preenchidos ao criar um Evento novo.
3. Gênero (Masculino ou Feminino) nos cadastros de Adolescentes e de pessoas com conta, obrigatório nos novos, com filtro e totais na lista de Adolescentes.
4. Observações da Liderança na página de cada Adolescente, com autoria, permissões garantidas no banco e privacidade rigorosa.

## User Stories

### Componentes de formulário

1. Como Líder no celular, quero que o select abra como painel inferior com opções grandes, para escolher sem errar o toque.
2. Como Líder no desktop, quero que o select abra como painel flutuante com sombra suave e cantos arredondados, para ficar coerente com o resto do app.
3. Como pessoa que usa o teclado, quero abrir o select com Enter ou seta, percorrer com as setas, escolher com Enter e fechar com Esc, para preencher o formulário sem o mouse.
4. Como pessoa que usa leitor de tela, quero que o select, o radio, o checkbox e o calendário tenham rótulo, papel e estado anunciados, para entender o que cada controle faz.
5. Como Líder, quero ver a opção atual destacada e marcada com um ícone de selecionado no painel, para saber o que já escolhi.
6. Como Líder, quero digitar para buscar dentro do select quando houver mais de 8 opções, para achar uma pessoa ou categoria rápido.
7. Como Líder, quero ver um estado "sem opções" e um estado "carregando" no select, para entender por que a lista está vazia.
8. Como Líder, quero escolher várias opções em um filtro (por exemplo, categorias) e ver as escolhidas como chips que posso remover, para saber o que está filtrando.
9. Como Líder, quero escolher status, tipo de repetição ou término da série em radios com formato de cartão ou segmentado, para ver claramente qual está marcado.
10. Como Líder, quero checkboxes com caixa própria, estado marcado, desmarcado e indeterminado e uma animação discreta, para saber o que está ligado.
11. Como Líder, quero um calendário em português, com a semana começando na segunda-feira como o calendário principal, o dia de hoje destacado, o dia selecionado em evidência e os dias de fora do mês esmaecidos, para escolher a data sem confusão.
12. Como Líder, quero trocar de mês e de ano no calendário e um atalho "Hoje", para chegar rápido à data certa, inclusive a uma data de nascimento antiga.
13. Como Líder, quero escolher um período (início e fim) em um único calendário, para definir o término de uma Série ou filtrar os Logs por período.
14. Como Líder, quero escolher a hora com passos de 5 ou 15 minutos e também digitá-la, para marcar 09:00 ou 09:10 sem esforço.
15. Como Líder, quero poder deixar o horário em branco (Evento de dia inteiro), para registrar Eventos sem hora como hoje.
16. Como Líder, quero que o formulário seja enviado com os mesmos nomes de campo e valores de hoje, para que nada do que funciona pare de funcionar.
17. Como Líder, quero ver a mensagem de erro ligada ao campo (e anunciada ao leitor de tela), para corrigir o que está errado.
18. Como pessoa de qualquer perfil, quero áreas de toque de pelo menos 44 px e foco visível em todos os controles, para usar bem no celular e no teclado.
19. Como pessoa que usa o modo escuro, quero que os novos componentes sigam os tokens e o tema do app, para não ver cores fora do padrão.
20. Como Líder, quero que a grade do calendário principal tenha tipografia, cores e bordas coerentes com os novos componentes, sem mudar o que ela faz.
21. Como Admin, quero os selects, checkboxes e radios do Catálogo, de Configurações, dos Logs, dos Convites e dos Arquivos no mesmo estilo, para a administração não parecer outra aplicação.
22. Como Líder, quero escolher o ícone de uma Marcação ou de um Atalho de arquivos em radios visuais acessíveis, para ver o ícone marcado.
23. Como Líder, quero o seletor de data com hora no campo "data e hora" dos campos específicos de uma Categoria, para não depender do `datetime-local` do navegador.

### Horários padrão

24. Como Admin, quero uma tela "Horários padrão" com uma linha por Categoria, para ajustar quando cada tipo de Evento costuma começar.
25. Como Admin, quero definir por Categoria um horário de início padrão e uma duração padrão em minutos, ambos opcionais, para pré-preencher só o que a Categoria realmente tem.
26. Como Admin, quero que a EBD venha com início às 09:00 e o Pequeno grupo às 15:00 e as demais Categorias sem padrão, para começar certo sem inventar durações.
27. Como Admin, quero limpar um horário padrão, para a Categoria voltar a abrir sem horário.
28. Como Líder, quero que ao criar um Evento novo o formulário já venha com o horário de início da Categoria, para não digitar sempre o mesmo.
29. Como Líder, quero que o horário de fim venha preenchido quando a Categoria tem duração padrão e mostra o campo de fim, para ganhar tempo.
30. Como Líder, quero poder alterar o horário pré-preenchido como qualquer outro, para os casos fora do comum.
31. Como Líder, quero que Categorias sem horário padrão (e a Postagem, que usa a data de publicação) sigam abrindo como hoje, para não haver surpresa.
32. Como Líder, quero que uma Série nova use o horário do formulário, já pré-preenchido pelo padrão, para criar a EBD semanal sem digitar a hora.
33. Como Admin, quero que mudar o padrão nunca altere Eventos já criados, para não bagunçar o calendário.
34. Como Admin, quero que cada mudança nos Horários padrão vire um Log, para saber quem mudou.

### Gênero

35. Como Líder, quero escolher Masculino ou Feminino ao cadastrar um Adolescente, para a Liderança saber o público.
36. Como Líder, quero ser impedido de salvar um novo Adolescente sem Gênero, para o cadastro novo vir completo.
37. Como Líder, quero editar o Gênero de um Adolescente já cadastrado, para completar os registros antigos.
38. Como Líder, quero ver um indicador discreto de "cadastro incompleto" em quem não tem Gênero, para saber o que falta.
39. Como Líder, quero filtrar a lista de Adolescentes por Masculino, Feminino ou "sem gênero informado", para completar os que faltam.
40. Como Líder, quero ver o total de Adolescentes por Gênero (e sem informação) na lista, para ter a visão geral.
41. Como pessoa que se cadastra ou aceita um convite, quero escolher meu Gênero no formulário, que é obrigatório, para concluir a conta.
42. Como pessoa com conta, quero editar meu Gênero em Minha conta, para completar um perfil antigo.
43. Como Admin, quero completar o Gênero de qualquer pessoa na tela de usuários e ver quem está com cadastro incompleto, para organizar os perfis.
44. Como Admin, quero que Adolescentes e perfis antigos continuem válidos como "não informado", para nada quebrar em produção.
45. Como responsável pela privacidade, quero que o Gênero só seja visto por usuários autenticados e aprovados e nunca vá para Notificação, Assinatura de calendário ou exportação pública, para proteger menores.
46. Como Admin, quero que o Log registre apenas que o Gênero foi alterado, sem o valor, para manter o Log enxuto.

### Observações

47. Como Líder, quero ver, na página de um Adolescente, a lista de Observações em ordem cronológica, cada uma com texto, autor, data de criação e data da última edição, para saber o que a Liderança já sabe.
48. Como Líder, quero adicionar uma Observação com um contador de caracteres e o limite de 2.000, para registrar o que ajuda a cuidar.
49. Como Líder, quero editar e apagar as minhas próprias Observações, para corrigir ou retirar o que escrevi.
50. Como Admin, quero editar e apagar qualquer Observação, para moderar o conteúdo.
51. Como Líder, quero não poder editar nem apagar a Observação de outro Líder, para preservar a autoria.
52. Como Professor, quero não ver nenhuma Observação, para que só a Liderança tenha acesso.
53. Como Pendente, quero não ver nada, para que o cadastro sem aprovação não vaze dados.
54. Como Líder, quero um aviso discreto e permanente no topo da seção ("Visível apenas para a liderança. Registre só o que ajuda a cuidar do adolescente e evite dados de saúde ou informações sensíveis da família."), para lembrar do cuidado ao escrever.
55. Como Líder, quero que as Observações de um Adolescente inativo continuem existindo e visíveis, para não perder o histórico.
56. Como Admin, quero que o Log registre "observação adicionada, editada ou apagada para {adolescente} por {líder}" sem o texto, para auditar sem expor o conteúdo.
57. Como responsável pela privacidade, quero que o texto das Observações nunca apareça em Notificações, central, Assinatura de calendário, exportações, busca ou Logs, para proteger os menores.
58. Como responsável pela igreja, quero uma nota no README recomendando que a autorização dos pais cubra esse registro (LGPD), para estar em conformidade.

## Implementation Decisions

### Componentes de formulário

- Os componentes são próprios, **sem dependência nova**, e estendem a biblioteca de componentes já existente do projeto (a mesma que hoje envolve o select e o checkbox nativos). Os componentes existentes (`Selecao`, `CaixaDeMarcar`) mantêm a API de uso (nome, valor, opções, rótulo, erro) e passam a renderizar o novo visual, para que os formulários atuais mudem pouco.
- Cada componente envia o valor ao formulário por um campo oculto com o mesmo `name`, preservando os `<form action>`, as Server Actions e `useActionState`. A validação continua no domínio, em TypeScript puro, e no banco.
- Em tela pequena, o select e o calendário abrem como painel inferior (bottom sheet); no desktop, como painel flutuante. A busca dentro do painel aparece quando há mais de 8 opções. A variante de seleção múltipla mostra chips.
- O calendário de data começa a semana na **segunda-feira**, igual ao calendário principal (a diferença em relação à preferência genérica por domingo está registrada). Tem navegação de mês e ano, atalho "Hoje", dias de fora do mês, variante de intervalo e variante com hora (passos de 5 ou 15 minutos, campo digitável, e opção de limpar para dia inteiro).
- A lógica sem interface (montagem da grade do mês em pt-BR com semana na segunda, regras de intervalo, arredondamento e leitura de hora, busca e digitação nas opções) fica em módulo de domínio, TS puro, para ser testada sem navegador. A camada de interface fica fina.
- Todos os usos nativos de `select`, radio, checkbox, `date`, `time` e `datetime-local` são substituídos: formulário de Evento (data, hora, fim, responsável, status, escopo da edição, campos específicos de data, data e hora, escolha e pessoa), repetição e painel da Série, filtros de Eventos e da lista de Arquivos, cadastro e conta (nascimento, preferências de notificação, painel do calendário), lista e formulários de Adolescentes (inclusive "mostrar inativos"), e todas as telas de administração (Logs, Catálogo, Configurações, Notificações, Convites, Usuários, Arquivos, Marcações). Os radios `sr-only` de ícone viram radios visuais acessíveis. Qualquer uso mantido de propósito é listado no resumo da entrega, com o motivo.
- O calendário principal (Lista, Mês, Semana) só muda de **estilo**: tipografia, cores e bordas. Nenhuma lógica de navegação, de períodos ou de eventos é alterada.
- Todos os estados são tratados (padrão, hover, foco, desabilitado, erro e carregando), com áreas de toque de pelo menos 44 px, foco visível e os tokens e o tema claro e escuro já definidos.
- Verificação visual antes e depois das telas principais em 375 px e em desktop, no resumo da entrega.

### Horários padrão

- Novas colunas opcionais e aditivas na tabela de Categorias: horário de início padrão e duração padrão em minutos. A migração define EBD 09:00 e Pequeno grupo 15:00, sem duração; as demais ficam vazias. Caminho de reversão em comentário SQL, como as migrações anteriores.
- Nova seção de administração "Horários padrão" (nova rota em `/admin`, entrada na lista de seções do Admin), com o novo seletor de hora. Só o Admin edita, garantido no banco por política e permissões de coluna; cada mudança gera Log pelo mecanismo existente.
- Um módulo de domínio calcula os valores iniciais do formulário de Evento novo a partir da Categoria (início padrão; fim somente se há duração e a Categoria mostra o campo de fim). A Categoria vem da rota de criação, então o preenchimento acontece ao abrir o formulário. Eventos existentes e edições nunca são afetados.
- Séries usam o horário do formulário, já pré-preenchido; o modelo e as regras de Série não mudam.
- Categorias sem início padrão e a Postagem seguem a definição atual de campos.

### Gênero

- Novas colunas opcionais e aditivas, com valores permitidos "masculino" e "feminino", em Adolescentes e em perfis de pessoas com conta. Registros antigos ficam nulos ("não informado").
- Adolescentes: o Gênero é obrigatório em novos registros, garantido por um gatilho de inserção no banco (só em `INSERT`, nunca bloqueando atualizações de registros antigos). Os privilégios de coluna passam a incluir o Gênero.
- Contas: a obrigatoriedade é verificada na ação do servidor e no domínio do cadastro (auto-cadastro e convite, inclusive Professor), sem regra rígida no gatilho de criação de perfil, para não arriscar o fluxo de criação de contas. O Gênero é gravado no perfil a partir do cadastro.
- A própria pessoa edita só o Gênero em Minha conta; o Admin edita o de qualquer pessoa na tela de usuários. Não se cria uma tela de edição de perfil completa (nome, e-mail, nascimento).
- A lista de Adolescentes ganha filtro por Gênero (inclusive "sem gênero informado") e os totais por Gênero (com "não informado"), calculados sobre os Adolescentes ativos, independentemente do filtro de Gênero escolhido. Selo discreto "cadastro incompleto" para quem não tem Gênero, na lista de Adolescentes e na de usuários.
- Privacidade: leitura só por usuários aprovados, mesmas políticas das tabelas existentes. O Gênero fica fora do feed `.ics`, das Notificações e de qualquer exportação pública. O Log da alteração registra só que o campo mudou, sem o valor.

### Observações

- Nova tabela de Observações, ligada ao Adolescente, com texto, autor (pessoa), data de criação e data da última edição. Limite de 2.000 caracteres por check no banco, texto simples não vazio. A chave estrangeira para o Adolescente usa exclusão em cascata **apenas por segurança**: como Adolescentes nunca são excluídos (só inativados), as Observações são preservadas; isso é documentado, e qualquer remoção futura de Adolescente deve gerar Log.
- Políticas por linha na tabela nova, usando as funções de acesso existentes: leitura e criação para Admin e Líder (o Professor e o Pendente não veem); edição e exclusão para o próprio autor e para o Admin. O autor é gravado pelo banco a partir do usuário da sessão, nunca vindo do formulário. A data da última edição é atualizada por gatilho.
- Página do Adolescente: nova seção "Observações" com aviso discreto e permanente, lista cronológica, formulário de adicionar com contador e, para quem pode, edição e exclusão. Nada é bloqueado automaticamente pelo conteúdo.
- Logs: o gatilho (ou RPC) que grava Logs de Observação registra apenas a ação, o Adolescente e o Líder, nunca o texto. Nenhum texto de Observação entra em Notificações, central, feed `.ics`, exportações CSV, busca ou relatórios, e nada é enviado a serviço externo.
- O README ganha a nota recomendando que a autorização dos pais cubra esse tipo de registro (LGPD) e documenta o comportamento de exclusão.

### Transversais

- Toda mudança de esquema é migração nova e aditiva, com política de acesso para cada tabela nova e reversão em comentário SQL.
- Permissões garantidas no servidor e no banco, nunca só na interface.
- Tudo o que for relevante gera Log pelo mecanismo existente, sem segredos e sem conteúdo de Observações.
- Nenhum dado pessoal novo além de Gênero e Observações.
- Idioma pt-BR, fuso America/Bahia, mobile-first.

## Testing Decisions

- Um bom teste verifica comportamento externo (o valor enviado, o que a pessoa vê, quem pode ou não pode), não detalhes de implementação.
- Usam-se os três pontos de teste que já existem, sem criar nenhum novo:
  1. **`src/dominio` (TS puro, sem banco):** montagem da grade do calendário pt-BR com semana na segunda e dias de fora do mês, seleção de data e de intervalo, passos e leitura de hora (inclusive vazio como dia inteiro), filtro e digitação das opções do select; cálculo dos valores iniciais do Horário padrão (início, fim com duração, Categoria sem padrão, Postagem, Evento existente intacto); validação do Gênero (obrigatório em cadastro novo, ausente em perfil antigo); texto do Log de Observação sem o conteúdo; contagem por Gênero e filtro "sem gênero".
  2. **`tests/rls` (Supabase local):** Horários padrão (colunas, valores da migração, só o Admin edita); Gênero (colunas opcionais, gatilho de inserção exigindo Gênero em Adolescente novo e permitindo atualizar antigo, leitura só por aprovados); Observações (Admin e Líder leem e criam; Professor e Pendente não leem; só o autor e o Admin editam e apagam; limite de 2.000 caracteres; autor vindo da sessão; preservação com Adolescente inativo; o Log não contém o texto).
  3. **`tests/fumaca` (Playwright, celular simulado):** um teste por componente novo, cobrindo navegação por teclado (setas, Enter, Esc, Tab), abertura e fechamento, seleção única e múltipla, seleção de data e de intervalo, valor enviado no formulário e atributos de acessibilidade (papel, rótulo, estado e erro associado ao campo).
- Arte anterior: os testes de domínio ao lado dos módulos (`*.test.ts`), os de política por linha em `tests/rls` com o ambiente de `tests/rls/ambiente.ts`, e os de fluxo em `tests/fumaca`.
- Linha de base: `pnpm test`, `pnpm typecheck`, `pnpm lint` e o build rodam antes da primeira branch e depois de cada entrega, com o resultado comparado no resumo.

## Out of Scope

- Qualquer mudança na integração com o Drive (pasta automática, renomear, lixeira, painel de Arquivos): já funciona como o Admin quer.
- "Título = tema" na EBD e exibir "Título - Tema" nos cartões: título e Tema continuam separados, como hoje; `tituloDeExibicao`, notificações, `.ics`, Logs e nome da pasta não mudam.
- Checklists em Eventos e tarefas, lembretes de mensagens aos Adolescentes e envio automático de mensagens.
- Upload de arquivos, exclusão permanente no Drive e acesso dos Adolescentes ao app.
- Tela de edição completa do perfil (nome, e-mail, nascimento) e "apagar Ocorrência isolada".
- Dados pessoais novos além de Gênero e Observações.
- Mudar a lógica do calendário principal ou o recurso de aniversários no feed `.ics`.
- Qualquer melhoria não listada acima.

## Further Notes

- **Risco registrado:** o feed `.ics` já traz, de forma opcional, "Aniversário de {primeiro nome}" de Adolescentes ativos. Isso conflita com a regra geral de que dados de Adolescentes não vão para o iCal. É um recurso anterior, fora desta spec, e fica como está por decisão do Admin; Gênero e Observações nunca entram no feed.
- **Risco registrado:** o título do Evento é texto livre e vai para Notificações e `.ics`; se alguém escrever o nome de um Adolescente nele, o nome aparece. Os Logs de presença já guardam o nome do Adolescente nos detalhes. Ambos são anteriores a esta spec e ficam como estão.
- A semana começa na segunda-feira nos novos componentes por coerência com o calendário principal, divergindo do padrão genérico de domingo.
- Ordem das branches: `feat/alt-1-componentes`, `feat/alt-2-horarios-padrao`, `feat/alt-5-genero`, `feat/alt-6-observacoes`, cada uma mesclada em `develop` localmente depois do resumo e da aprovação; sem push nem deploy sem o Admin pedir.
- Dependências entre entregas: o Gênero (radio) e os Horários padrão (seletor de hora) usam componentes da primeira entrega; as Observações são independentes das demais.
- O `CONTEXT.md` já registra os termos Horário padrão, Gênero e Observação.
