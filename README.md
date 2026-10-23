# Mural ONDA

Calendário de Eventos da Liderança do ONDA, ministério de adolescentes. Next.js + Supabase. Os comandos de desenvolvimento
e as convenções estão em `CLAUDE.md`; o vocabulário, em `CONTEXT.md`; as decisões, em `docs/adr/`.

## Variáveis de ambiente

Modelo em `.env.example`. No Supabase local, copie `API_URL`, `ANON_KEY` e `SERVICE_ROLE_KEY` de
`pnpm exec supabase status -o env`.

| Variável | Onde vale | Para quê |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | navegador e servidor | endereço do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | navegador e servidor | chave pública (anon); as políticas por linha protegem os dados |
| `SUPABASE_SERVICE_ROLE_KEY` | **só o servidor** | chave service-role, que ignora as políticas por linha. Usada apenas pelo feed do calendário (`/feed/<token>.ics`). Nunca use o prefixo `NEXT_PUBLIC_` nela, nem a coloque em código que roda no navegador |
| `FEED_LIMITE_POR_HORA` | servidor, opcional | consultas por hora que cada endereço de calendário aceita (padrão 60) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | **só o servidor** | o JSON da chave da service account do Google, numa linha só; usada pela rota do agendador para criar pastas no Drive |
| `CRON_SECRET` | **só o servidor** | segredo que o banco manda em `Authorization: Bearer` ao chamar as rotas `/api/agendador/*`; sem ele, nada é processado |

Em produção (Vercel), cadastre `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON` e `CRON_SECRET` como variáveis de
ambiente do projeto, só para Production e marcadas como Sensitive; a chave `service_role` fica no painel do Supabase, em
Project Settings → API. Variáveis novas só valem em deploys novos. O `scripts/wizard-integracoes.sh` guia esses passos (Google
Cloud, compartilhar a pasta, Vault do Supabase e as variáveis da Vercel).

## Pastas dos Eventos no Drive

Com o Drive ligado em **Admin → Configurações**, cada Evento avulso de uma Categoria marcada ali (a EBD e o Pequeno grupo, por
padrão) ganha sozinho uma pasta `Categoria/Ano/AAAA-MM-DD · título` dentro da pasta do ministério, e o link entra no campo
"Link do material". O Mural só cria e lê: nunca apaga nem sobrescreve nada no Drive, e um link digitado à mão vale mais que a
pasta automática. As decisões estão nos ADRs 0006 e 0007.

Como funciona:

- ao criar o Evento, o banco enfileira uma tarefa (`tarefas_de_pasta`, uma por Evento); a interface não lê essa tabela;
- todo minuto em que há tarefa devida, o `pg_cron` do Supabase chama a rota `POST /api/agendador/pastas` com `pg_net`,
  mandando `Authorization: Bearer <CRON_SECRET>`; a URL do app e o segredo ficam no Vault do Supabase (`app_url` e `cron_secret`);
- a rota reserva as tarefas, cria as pastas pela API v3 do Drive com a service account e devolve o resultado ao banco, que grava
  o link e os Logs (`drive.pasta_criada` e `drive.pasta_falhou`);
- falha passageira é refeita até 5 vezes, com espera crescente (1, 5, 15, 60 e 240 minutos); erro permanente (pasta raiz sem
  acesso) fecha a tarefa na hora, o Evento avisa que não foi possível criar a pasta e o campo continua preenchível à mão;
- sem `GOOGLE_SERVICE_ACCOUNT_JSON` ou `SUPABASE_SERVICE_ROLE_KEY`, a rota responde 503 e as tarefas esperam; o estado dessas
  variáveis (só sim ou não) aparece em Configurações;
- o Drive desligado não enfileira nada, e o Evento nasce normal;
- tarefa que gasta as 5 tentativas sem nunca receber resposta (a rota caiu depois de reservar, de novo e de novo) fecha com
  erro na reserva seguinte, em vez de ficar pendente para sempre;
- uma tarefa já na fila segue mesmo se a Categoria for desmarcada depois; já um Evento criado com o Drive desligado, ou antes de
  ligá-lo, não ganha pasta sozinho (o botão "Criar pasta agora" é do ticket 05).

Limites conhecidos: se duas rodadas do agendador rodarem juntas (só se a reserva de 10 minutos vencer no meio), as pastas de
Categoria e de ano podem sair duplicadas, porque o Drive aceita duas pastas com o mesmo nome; e dois Eventos avulsos com a mesma
data e o mesmo título caem na mesma pasta.

Para configurar em produção: compartilhe a pasta do ministério com o e-mail da service account (Editor), ligue a extensão
`pg_net`, guarde `app_url` e `cron_secret` no Vault (`select vault.create_secret('<valor>', '<nome>')`), cadastre as variáveis na
Vercel e, em Configurações, informe a pasta raiz e ligue o Drive. Para rotacionar o `CRON_SECRET`, troque-o na Vercel e no Vault
(apague o segredo antigo do Vault antes de criar o novo) e faça um novo deploy.

Para reverter: desligue o Drive em Configurações (nada é apagado). O passo a passo para desfazer a migração está no fim de
`supabase/migrations/20261023040000_pasta_do_evento.sql`.

Limitação: a pasta do ministério é uma pasta comum (o ministério não tem Google Workspace), então as pastas criadas pelo app
ficam com a service account como dona e só ela as apaga ou move. Com um Drive compartilhado isso deixa de existir, sem mudar o app.

## Assinatura de calendário

Cada pessoa aprovada gera o próprio endereço `.ics` em **Minha conta → Calendário** (`/conta`) e assina no calendário do
celular. O endereço funciona como senha de leitura:

- o token tem 256 bits aleatórios e é mostrado uma única vez; o banco guarda só o hash (SHA-256);
- regerar invalida o endereço anterior; revogar apaga a assinatura;
- cada token aceita 60 consultas por hora; acima disso, a rota responde 429 com `Retry-After`;
- endereço desconhecido, regerado ou revogado responde 404, sem distinguir um do outro;
- gerar, regerar e revogar viram Log; o token e o endereço nunca são registrados.

A geração do texto é a função pura `gerarFeed` (`src/dominio/assinatura-de-calendario.ts`); a rota só busca os dados.

## Notificações push

Em "Minha conta", cada pessoa da Liderança (e Professor) ativa as Notificações **neste aparelho**, só depois de tocar em "Ativar":
o navegador pede a permissão nesse momento e nunca antes. No iPhone e no iPad o app precisa estar na Tela de Início
(Compartilhar → Adicionar à Tela de Início). Cada aparelho tem a própria inscrição na tabela `inscricoes_de_push`; o endpoint e
as chaves só o servidor lê (nunca a interface, os Logs ou as exportações). Sair da conta remove a inscrição daquele aparelho.
O botão "Enviar notificação de teste" manda um aviso só para si mesmo.

| Variável | Onde | O que é |
| --- | --- | --- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | navegador e servidor | chave pública VAPID |
| `VAPID_PRIVATE_KEY` | **só o servidor** | chave privada VAPID |
| `VAPID_SUBJECT` | servidor | contato, no formato `mailto:alguem@exemplo.com.br` |
| `PUSH_MODO_TESTE` | servidor | `1` = dry-run: o envio só finge que deu certo |

**Gerar as chaves:** `scripts/wizard-integracoes.sh` (etapa 9) gera o par e mostra os valores, ou, à mão:

```
node -e 'const c=require("crypto");const k=c.generateKeyPairSync("ec",{namedCurve:"prime256v1"});const p=k.publicKey.export({format:"jwk"});console.log("pública:",Buffer.concat([Buffer.from([4]),Buffer.from(p.x,"base64url"),Buffer.from(p.y,"base64url")]).toString("base64url"));console.log("privada:",k.privateKey.export({format:"jwk"}).d)'
```

**Rotacionar:** gere um par novo e troque as três variáveis (na Vercel e no `.env.local`). Um par novo **invalida todas as
inscrições existentes**: cada pessoa precisa desativar e ativar de novo em "Minha conta". Só rotacione se a chave privada vazou.
A chave privada nunca vai em código, em Log nem no navegador.

### Fila, envio e central

As Notificações devidas são gravadas pelo banco na tabela `notificacoes`, que também é a central dentro do app ("Notificações" no
menu, com as não lidas em destaque e o número no menu). Hoje há dois tipos: "você foi definido(a) como Responsável por um Evento" e
"você foi escalado(a) como Professor ou Auxiliar de uma aula". Quem mexeu no próprio Evento não é avisado, e uma mudança que atinge
várias Ocorrências de uma Série de uma vez avisa uma vez só.

- **Chave única:** tipo + Evento + pessoa + janela. O banco recusa a segunda igual, então nenhum aviso nasce duas vezes.
- **Envio:** todo minuto em que há Notificação devida, o `pg_cron` chama `POST /api/agendador/notificacoes` pelo mesmo caminho das
  pastas do Drive (`pg_net`, `Authorization: Bearer <CRON_SECRET>`, `app_url` e `cron_secret` no Vault). A rota reserva um lote, monta o
  texto (modelos curtos em `src/dominio/notificacoes.ts`) e envia a cada dispositivo da pessoa separadamente. Uma reserva de 5 minutos
  impede que duas rodadas enviem a mesma Notificação; quem já recebeu fica registrado, então uma nova tentativa só envia ao que falhou.
- **Janela de horário:** padrão das 8h às 21h em America/Bahia, ajustável por pessoa em "Minha conta". Fora dela, o aviso espera abrir
  (os marcados como urgentes não esperam; nenhum tipo desta entrega é urgente).
- **Retentativas:** esperas de 5, 15, 45 e 135 minutos, até 5 tentativas. A falha definitiva vira Log de erro (`notificacao.falhou`, só
  com tipo e contagens). Inscrição recusada com 404 ou 410 é removida (`push.expirado`). A Notificação vale 48 horas; depois expira.
- **Modo de teste (dry-run):** com `PUSH_MODO_TESTE=1` nada sai; cada Notificação vira um Log `notificacao.simulada`.
- **Retenção da central:** 30 dias por padrão, em Admin → Configurações; uma limpeza roda todo dia às 3h30.
- **Sem dados de Adolescentes:** o texto é montado só com título, número, data, hora e local do Evento (o Pequeno grupo omite o local).

Sem `SUPABASE_SERVICE_ROLE_KEY` ou chaves VAPID (e fora do modo de teste), a rota responde 503 e a fila espera; a central funciona do mesmo jeito.

Para reverter, veja o fim de `supabase/migrations/20261023140000_notificacoes.sql`.
