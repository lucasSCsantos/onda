# 04: Pasta do Evento (Eventos avulsos)

**Spec:** `../spec.md` (Alteração 3, ADRs 0006 e 0007)

**What to build:** Ao criar um Evento avulso de EBD ou Pequeno grupo, o Mural cria sozinho a Pasta do Evento no Drive do ministério e coloca o link em "Link do material". Inclui as Configurações do Admin para o Drive (ligar/desligar, pasta raiz, Categorias com pasta automática), o cliente do Drive (com falso em memória para testes), a fila de tarefas de pasta e a infraestrutura do agendador (`pg_cron` + `pg_net` chamando uma rota protegida por `CRON_SECRET`, com a chave service-role só no servidor). Se o Drive falhar ou estiver desligado, o Evento nasce normalmente.

**Blocked by:** 02 (Campos nativos por Categoria, que cria "Link do material" no Pequeno grupo)

**Status:** ready-for-agent

- [ ] Configurações do Admin: integração ligada ou desligada, ID da pasta raiz e Categorias com pasta automática; cada mudança vira Log
- [ ] Credenciais da service account só em variável de ambiente do servidor; nada vai ao navegador nem aos Logs
- [ ] Cliente do Drive (criar pasta, listar, obter pais e metadados, baixar) com implementação sobre a API v3 e falso em memória para testes
- [ ] Fila de tarefas de pasta com chave de idempotência por Evento, tentativas, próxima tentativa e erro; rota do agendador protegida por segredo e agendada por `pg_cron`/`pg_net`
- [ ] Evento avulso de EBD ou Pequeno grupo enfileira a criação; a pasta nasce em `<raiz>/<Categoria>/<Ano>/<AAAA-MM-DD · título>`, criando Categoria e ano se faltarem, e o link vai para "Link do material"
- [ ] Um link digitado à mão no momento da criação (ou depois) nunca é sobrescrito e dispensa a pasta; um Evento nunca ganha duas pastas
- [ ] Colunas opcionais no Evento para o ID e o estado da pasta; a tela do Evento mostra criada, pendente ou com erro, com aviso de que o link só abre para quem tem acesso no Drive
- [ ] Falha do Drive faz nova tentativa com espera crescente e vai para os Logs; integração desligada ou sem credenciais não impede criar o Evento e mostra mensagem clara
- [ ] O Mural nunca apaga nada no Drive; cancelar o Evento não toca na pasta
- [ ] Testes com o Drive falso (criação, não duplicação, falha com nova tentativa, integração desligada) e do banco (fila, políticas, idempotência); README com as variáveis novas e instruções de deploy do agendador
- [ ] Contrato com `scripts/wizard-integracoes.sh` (que o Admin roda uma vez, antes deste ticket): variáveis de ambiente do servidor `GOOGLE_SERVICE_ACCOUNT_JSON` (JSON da service account numa linha), `SUPABASE_SERVICE_ROLE_KEY` e `CRON_SECRET`; o job do `pg_cron` lê do Vault do Supabase os segredos de nome `cron_secret` e `app_url` para chamar a rota do agendador com `pg_net`. A pasta raiz NÃO é variável de ambiente: vem de Configurações do Admin. Se mudar algum desses nomes, atualizar o wizard.
