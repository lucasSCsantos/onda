# Mural ONDA — Escopo do MVP

Ministério de Adolescentes ONDA · Versão 1.0 · 20/10/2026

---

## 1. Objetivo

Ter um app único onde a liderança do ONDA vê, cria e acompanha todas as atividades do ministério, cada uma com **responsável** e **status**, substituindo o controle espalhado entre WhatsApp e Notion.

No MVP, **somente a liderança usa o app**. Os adolescentes existem como cadastro (lista e aniversários), sem login.

### Premissas
- Construção de um app próprio (protótipo), com foco em ser **facilmente ampliável**.
- Dados coletados apenas: **nome, data de nascimento, e-mail e senha**. Nada sensível (sem CPF etc.).
- Nenhum upload de arquivo. Qualquer material ou postagem é **link opcional** (Drive, Instagram etc.).
- Não haverá migração do Notion. Os dados serão cadastrados manualmente.

---

## 2. Acesso e permissões

O acesso tem duas camadas: o **nível de acesso** (o que a pessoa é no sistema) e a **função** (o que ela é no ministério, que define o que pode criar).

### 2.1 Níveis de acesso

| Nível | Descrição |
|---|---|
| **Admin** | Controle total: aprova contas, gera convites, define funções e permissões, edita qualquer coisa |
| **Líder** | Acesso da liderança: vê o calendário completo e a lista de adolescentes, e age conforme as permissões da sua função |
| **Pendente** | Criou conta e aguarda aprovação; não vê nenhum dado |

### 2.2 Funções e permissões por categoria

Cada líder recebe uma ou mais **funções**. Cada função define em quais **categorias de evento** a pessoa pode **criar** eventos. As funções e suas permissões são cadastros editáveis pelo admin, e não valores fixos no código. Assim, liberar uma permissão depois é uma mudança de configuração.

| Função | Cria eventos de… |
|---|---|
| Líder do ministério (Lucas) | Todas as categorias |
| Co-líder do ministério (Carol Leal) | Todas as categorias |
| Líder de comunicação e mídia (Carol França) | Postagem |
| Líder do louvor (Beythel) | Ensaio de louvor |
| Líder de integração e programação (Mariana) | Nenhuma por ora |
| Co-líder de integração e programação (Denize) | Nenhuma por ora |

> **Regra atual:** apenas Lucas e Carol Leal criam eventos de qualquer tipo. A comunicação cria somente postagens e o louvor cria somente ensaios.

### 2.3 Regras de edição
- **Criar:** conforme a permissão da função (tabela acima).
- **Editar um evento:** admin, quem tem permissão de criar aquela categoria, ou o **responsável** do evento.
- **Alterar status:** admin, quem tem permissão na categoria, ou o responsável.
- **Excluir:** só admin. Para o dia a dia usa-se o status *Cancelado*.
- Todo líder **vê** todos os eventos. A restrição é de criação e edição, não de visualização.

*(Pontos a confirmar: o responsável poder marcar o evento como "Confirmado", e o responsável poder ser alguém sem permissão de criar a categoria. O padrão adotado aqui é que sim para ambos.)*

---

## 3. Contas

- **Cadastro por link de convite:** o admin gera um link com função e nível pré-definidos e validade. Quem se cadastra por ele já entra aprovado.
- **Cadastro sem convite:** a conta fica como *Pendente* e o admin recebe a lista de pendentes para **aprovar** (definindo nível e função) ou **recusar**.
- **Campos do cadastro:** nome, e-mail, senha e data de nascimento.
- Login, recuperação de senha e logout.
- O admin pode desativar um usuário sem apagar o histórico dos eventos dele.

---

## 4. Eventos

### 4.1 Campos comuns a todos os eventos
Título · categoria · data e hora de início e fim · local · **responsável** · **status** · observações · link opcional.

Todo evento exige responsável. O registro guarda quem criou, quem editou por último e quando.

### 4.2 Categorias e campos específicos

| Categoria | Campos específicos |
|---|---|
| **EBD** | tema, professor, link do material |
| **Pequeno grupo** | grupo, anfitrião/local, tema |
| **Culto** | quem prega, observações da liturgia |
| **Ensaio de louvor** | repertório (link), observações |
| **Reunião de liderança** | pauta, link da ata |
| **Postagem** | plataforma, data de publicação, link da arte/post |
| **Evento extra** | tipo (gincana, intercâmbio entre igrejas, campeonato, outro), igreja/grupo parceiro (opcional), valor (opcional), link de inscrição (opcional), o que levar |
| **Acampamento** | local, período (vários dias), valor, link de inscrição, link da autorização dos pais, lista de itens a levar |
| **Serviço** | descrição da ação |

**Evento extra** e **Acampamento** são categorias separadas, com cores e filtros próprios.

Novas categorias devem poder ser adicionadas definindo apenas a lista de campos dela, sem mudar a estrutura do banco.

### 4.3 Status

`Rascunho` → `Planejado` → `Confirmado` → `Realizado`, além de `Cancelado` e `Adiado`.

- Cancelado continua visível (riscado), nunca é apagado.
- Rascunho aparece com destaque visual para não ser confundido com algo confirmado.

### 4.4 Recorrência

Qualquer categoria pode ser criada como **série recorrente** (típico de EBD, pequeno grupo e ensaio).

- Frequência: semanal, quinzenal ou mensal, com os dias da semana escolhidos.
- Término: por data final ou por número de ocorrências.
- Cada ocorrência é um evento **editável individualmente** (mudar horário, cancelar uma data, trocar responsável).
- Ao editar uma ocorrência: **só esta**, **esta e as seguintes** ou **toda a série**.
- Cancelar uma ocorrência não afeta as demais.
- Quem pode criar uma série segue a mesma regra de permissão da categoria.

---

## 5. Calendário

- Visões **mensal**, **semanal** e **lista**. No celular, a lista é a padrão.
- Cor por categoria; status indicado visualmente.
- **Aniversários** de líderes e adolescentes aparecem no calendário. Eles são calculados a partir da data de nascimento, não gravados como eventos, o que evita duplicidade e trata o 29/02.
- Fuso horário fixo: America/Bahia.

### 5.1 Filtros
- **Meus eventos** (onde sou o responsável)
- **Esta semana**
- **Um dia específico**
- **Por categoria** (seleção múltipla)
- **Por status**
- Os filtros podem ser combinados.

### 5.2 Próximos eventos
Tela inicial com os eventos futuros em ordem, agrupados em hoje, esta semana e depois, com destaque para os eventos onde sou o responsável. Também mostra alertas de eventos **sem responsável** ou ainda em **rascunho**.

---

## 6. Adolescentes

- Lista com nome e data de nascimento.
- Criar, editar e inativar (por admin e líderes com essa permissão).
- Busca por nome e ordenação por próximo aniversário.
- Bloco de **aniversariantes do mês** na tela inicial.
- Status ativo/inativo, para tirar da lista quem saiu sem perder o histórico (necessário para presença e ranking futuros).
- Os adolescentes **não têm login** no MVP. O cadastro deles fica separado da tabela de usuários para permitir ligar um acesso no futuro.

---

## 7. PWA

- Instalável na tela inicial do celular, com ícone e tela de abertura próprios.
- Mobile-first e responsivo.
- Offline completo não é necessário. Basta abrir rápido e mostrar uma mensagem clara quando estiver sem internet.

---

## 8. Requisitos não funcionais

- Interface em **pt-BR**, simples para quem não é técnico.
- **Segurança:** autenticação por serviço dedicado (senhas nunca tratadas em código próprio), regras de acesso no banco e HTTPS.
- **Dados de menores:** visíveis só para usuários aprovados, fora de buscadores. Recomenda-se ter autorização dos pais (LGPD).
- **Backups** automáticos e possibilidade de exportar os dados.
- **Auditoria básica:** quem criou e alterou cada evento.
- **Escalabilidade:** novas categorias, funções e permissões entram por configuração.

---

## 9. Fora do MVP

### Pós-MVP
- **Registro de presença na EBD**, com marcações além de presença (trouxe bíblia, trouxe visitante, fez atividade). As marcações devem ser configuráveis, não colunas fixas.
- **Ranking geral anual** dos adolescentes, calculado a partir das marcações, com pontos configuráveis.
- **Assinatura de calendário (iCal)**, com um endereço por usuário.
- **Criação automática de pastas no Drive** ao criar uma aula (ver seção 10).

### Fora do escopo
- Upload de qualquer material ou postagem (apenas links).
- Acesso de adolescentes ao app.

---

## 10. Sugestão técnica

| Camada | Sugestão | Motivo |
|---|---|---|
| App | **Next.js** (TypeScript), PWA | Um só projeto para telas e servidor; ecossistema grande |
| Banco e login | **Supabase** (Postgres + Auth + regras por linha) | Login, convites e permissões prontos, sem construir autenticação do zero |
| Hospedagem | **Vercel** (ou Cloudflare Pages) | Deploy automático a partir do GitHub |

**Pontos de atenção:**
- Conferir os limites e termos dos planos gratuitos antes de decidir. Projetos gratuitos do Supabase podem ser pausados por inatividade, e os backups são limitados. Ao entrar em uso real, avaliar o plano pago mais barato.
- Não guardar arquivos nem dados no disco do projeto. Em hospedagem serverless o disco é somente leitura ou temporário, e o banco resolve concorrência e busca.
- **Drive:** no MVP, o link da pasta ou do documento é colado em um campo do evento. Na fase seguinte, o app pode criar uma subpasta automaticamente na pasta compartilhada via Google Drive API, usando uma *service account* com a pasta compartilhada a ela. Preferir **Drive compartilhado** para evitar problemas de propriedade dos arquivos.

---

## 11. Critérios de aceite do MVP

1. Um líder se cadastra por convite e entra com a função correta; outra pessoa se cadastra sem convite e fica aguardando aprovação do admin.
2. Lucas e Carol Leal criam eventos de qualquer categoria; Carol França cria apenas postagens; Beythel cria apenas ensaios de louvor; Mariana e Denize não conseguem criar eventos (por ora).
3. É possível criar uma série semanal de EBD e cancelar uma única data sem afetar as demais.
4. Eventos aparecem no calendário (mensal, semanal e lista) com cor por categoria e status visível.
5. Os filtros "meus eventos", "esta semana", "dia", "categoria" e "status" funcionam e combinam entre si.
6. A lista de próximos eventos destaca os meus e alerta eventos sem responsável.
7. Aniversários de líderes e adolescentes aparecem no calendário e no bloco do mês.
8. O app é instalável como PWA no celular e usável no dia a dia.

---

## 12. Próximos passos

1. Validar este escopo.
2. Definir o **modelo de dados** (usuários, funções, permissões, adolescentes, eventos, séries de recorrência, convites).
3. Desenhar as telas principais (início, calendário, criar evento, adolescentes, administração).
4. Construir o MVP em etapas: contas e permissões → eventos e calendário → filtros e recorrência → adolescentes e aniversários → PWA.
