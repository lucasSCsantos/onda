# Mural ONDA

Aplicativo web onde a liderança do ONDA, o ministério de adolescentes da igreja, vê, cria e acompanha as atividades do ministério, cada uma com responsável e status.

## Language

### Calendário

**Evento**:
Qualquer item do calendário (uma EBD, uma gincana, uma postagem), com categoria, responsável e status.
_Avoid_: Atividade, compromisso

**Série**:
O molde recorrente que gera Ocorrências (a "EBD semanal"); editar "esta e as seguintes" ou "toda a série" altera as Ocorrências afetadas sem dividir a Série nem tirá-las dela. Repete no máximo toda semana, por até 6 meses; cada Ocorrência leva um número na ordem das datas ("Aula de EBD · 3"), que não muda se outra for cancelada.
_Avoid_: Recorrência, evento recorrente

**Ocorrência**:
Um Evento que nasceu de uma Série e pode ser editado ou cancelado individualmente (inclusive o professor); continua na Série, marcada como editada, e uma edição "toda a série" não a sobrescreve. Ocorrências Realizadas ou Canceladas ficam congeladas diante de edições de série.
_Avoid_: Instância, repetição

**Categoria**:
O tipo de um Evento (EBD, pequeno grupo, culto, ensaio de louvor, reunião de liderança, postagem, evento extra, acampamento, serviço); define os campos específicos do Evento e quais dos campos comuns (local, fim, observações, link) ele oculta, mostra ou exige; o que fica oculto não é apagado dos Eventos que já o tinham.
_Avoid_: Tipo

**Área**:
Uma frente de trabalho do ministério (Geral, Ensino, Programação, Comunicação, Louvor, Acampamento) que agrupa Categorias e Funções e concede a permissão de criar Eventos; Geral é a liderança geral do ministério e cria todas as Categorias.
_Avoid_: Departamento, setor

**Responsável**:
A pessoa da Liderança encarregada de um Evento, qualquer uma delas; obrigatório para o Evento sair de Rascunho. Cada Ocorrência tem o seu.
_Avoid_: Dono, encarregado

**Status**:
O estágio de um Evento: Rascunho, Planejado, Confirmado, Realizado, Cancelado ou Adiado, com transições livres. Um Evento Confirmado passa sozinho a Realizado depois do horário de fim (ou no dia seguinte, se não houver fim); fora isso, só o Admin e o Responsável marcam Realizado, e nunca antes do fim. Planejado ou Rascunho que passam da data ficam parados com alerta até o Responsável decidir. Remarcar um Adiado (mudar a data) o volta a Planejado.

**Atalho de filtro**:
Um filtro marcável da barra de Eventos (Meus eventos, Hoje, Esta semana, Próximos, Rascunho, Sem Responsável, Aula sem Professor, Atrasados) que liga e desliga na hora, sem botão de confirmar.
_Avoid_: Filtro rápido, botão de filtro

**Painel do dia**:
A lista dos Eventos de um dia (com os aniversariantes), aberta ao tocar nele no Calendário.
_Avoid_: Modal do dia, detalhe do dia

**Horário padrão**:
O horário de início e a duração que uma Categoria sugere ao criar um Evento novo; o Admin ajusta, ambos são opcionais, e mudar o padrão nunca altera Eventos já criados.
_Avoid_: Horário fixo

**Postagem**:
Categoria de Evento cuja data é a data de publicação.

**Reunião de liderança**:
Categoria que pertence à Área Geral; só quem tem Função Geral (ou o Admin) cria.

### Pessoas e acesso

**Liderança**:
O conjunto de pessoas com nível de acesso Admin ou Líder.
_Avoid_: Equipe, time

**Nível de acesso**:
O que a pessoa é no sistema: Admin, Líder, Professor ou Pendente.

**Admin**:
Nível de acesso com controle total; hoje só Lucas.

**Líder**:
Nível de acesso da liderança aprovada. Sempre se refere ao nível, nunca a uma Função.

**Pendente**:
Nível de acesso de quem criou conta sem convite e aguarda aprovação; não vê nenhum dado.

**Função**:
O papel de uma pessoa no ministério (ex.: "Líder do louvor", "Co-líder do ministério"); pertence a uma Área, e a pessoa cria Eventos de todas as Categorias dessa Área. Uma pessoa pode ter várias Funções. A Área Geral cria todas as Categorias.

**Professor**:
Pessoa cadastrada que dá aulas de EBD; é escolhido por Ocorrência e, ao entrar no app, vê no calendário apenas as aulas em que foi colocado, podendo editar só as observações delas e fazer a Chamada delas. Uma aula tem até dois: o Professor e o Auxiliar. Quem é Líder ou Admin também pode ser escolhido, sem outro cadastro; o nível de acesso Professor existe só para quem não é da Liderança.

**Auxiliar**:
O segundo Professor de uma aula, em apoio ao Professor principal.
_Avoid_: Docente, instrutor

**Adolescente**:
Pessoa atendida pelo ministério, existente só como cadastro (nome, data de nascimento, Gênero, ativo/inativo); sem login. Nunca é excluída, só inativada.
_Avoid_: Membro, jovem

**Gênero**:
Masculino ou Feminino, de cada Adolescente e de cada pessoa com conta; opcional nos cadastros antigos ("não informado") e obrigatório nos novos. Só usuários aprovados veem; nunca vai para Notificação, Assinatura de calendário ou exportação pública.
_Avoid_: Sexo

**Dados pessoais**:
Nome, data de nascimento e Gênero de uma pessoa com conta. Só a própria pessoa edita os seus (em Minha conta); o Admin não edita dados pessoais de ninguém, só as Funções, o nível de acesso e a ativação das contas, e vê apenas o selo "cadastro incompleto" de quem está sem Gênero. Os dados de um Adolescente (mesmos campos) são editados pela Liderança, na página dele.
_Avoid_: Perfil (para o que a pessoa edita)

**Observação**:
Uma anotação de texto da Liderança sobre um Adolescente, com autor, data de criação e data da última edição; só Admin e Líder leem e criam, e só o autor e o Admin editam ou apagam. Sobrevive à inativação do Adolescente. Nunca aparece em Log, Notificação, Assinatura de calendário, exportação ou busca; o Log diz só que houve a ação, quem fez e sobre qual Adolescente.
_Avoid_: Nota, comentário, anotação

### Presença

**Chamada**:
A lista de presença de uma aula de uma Categoria com chamada (a EBD): para cada Adolescente ativo, as Marcações daquele dia. Quem faz é o Admin, quem tem Função na Área da Categoria e o Professor e o Auxiliar daquela aula (que, para isso, veem nome e identificador dos Adolescentes ativos, nunca a data de nascimento), a partir do dia da aula; pode ser corrigida depois. Uma aula com Chamada não é excluída, só cancelada.
_Avoid_: Lista, frequência

**Marcação**:
O que se marca para um Adolescente na Chamada (Presente, Trouxe bíblia, Trouxe visitante, Fez atividade), com ícone e pontos, cadastrada pelo Admin. Marcar qualquer uma marca também a de presença. Não se apaga, desativa-se.
_Avoid_: Critério, item

**Alerta de ausência**:
Aviso, na tela de Presença, de quem faltou a um número configurável de aulas com Chamada seguidas.

**Ranking**:
A classificação anual dos Adolescentes pela soma dos pontos das Marcações nas aulas do ano, calculada na hora com a pontuação atual (mudar os pontos refaz também os anos anteriores). No empate, fica na frente quem tem mais da Marcação de desempate (padrão: Presente). Só a Liderança vê.

### Administração

**Log**:
O registro de uma ação no Mural: quem fez (ou o Sistema), o quê, sobre qual objeto, quando e com qual resultado. Só de inserção e só o Admin lê; nunca guarda senha, e-mail ou data de nascimento. O registro de alterações dos Eventos é a fonte dos Logs de Evento.
_Avoid_: Auditoria (o "Histórico do Evento" é o recorte dos Logs de um Evento)

**Configurações**:
O que o Admin ajusta sem mexer no sistema (por quanto tempo guardar os Logs, se líderes veem o histórico dos Eventos e o que as fases seguintes acrescentarem); cada mudança vira um Log.

### Integrações e avisos

**Pasta do Evento**:
A pasta no Drive do ministério criada para um Evento de EBD ou Pequeno grupo (outras Categorias por configuração), cujo link vai para o campo "Link do material". Um link digitado à mão vale mais que a pasta automática; o app nunca apaga nada no Drive.
_Avoid_: Diretório

**Arquivos**:
A seção, só de leitura e só para a Liderança, que mostra o Drive do ministério dentro do app, a partir de Atalhos escolhidos pelo Admin.
_Avoid_: Biblioteca, galeria

**Assinatura de calendário**:
O endereço pessoal (.ics) com que uma pessoa vê os Eventos no calendário do celular; funciona como senha de leitura, pode ser regerado ou revogado e nunca traz Eventos Cancelados nem Rascunhos.
_Avoid_: Exportação (já é outra coisa: o CSV do Admin)

**Notificação**:
O aviso a uma pessoa (Liderança, ou o Professor sobre as próprias aulas) sobre um Evento seu, entregue por push e guardado na central dentro do app; nunca leva dados de Adolescentes.
_Avoid_: Alerta (o alerta é o aviso na tela, como o Alerta de ausência)

**Minha conta**:
A página de cada pessoa para ajustar suas Notificações e sua Assinatura de calendário.
