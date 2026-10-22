# Logs só de inserção, gravados pelo banco

Os Logs ficam numa tabela em que ninguém tem permissão de escrita: os gatilhos das tabelas principais gravam o que muda (inclusive o que é feito fora da interface), e uma RPC restrita, `registrar_log`, grava o que não passa pelo banco (entrar, sair, senha) e as falhas, que o banco não consegue registrar porque a transação que falha é desfeita junto. Um gatilho recusa edição e exclusão; só a limpeza da retenção apaga.

Descartamos dar ao servidor do app a chave de serviço do Supabase para gravar logs: seria um segredo novo, com poder total, só para isso. O preço é que a tentativa de login com falha vem de quem ainda não entrou, então quem tiver a chave pública consegue registrar tentativas falsas; um limite por minuto contém o volume, e nenhum outro tipo de log pode ser forjado (quem fez é sempre `auth.uid()`).

O log de Evento sai do registro de alterações que já existia (`alteracoes_dos_eventos`), para os dois nunca divergirem. Uma operação que mexe em várias linhas (criar ou editar uma Série, cadastrar com convite, aprovar com Função) vira um log só, marcado numa variável da transação; o resumo de cadastro e aprovação sai no fim dela (gatilhos adiados), quando nível e Funções já estão definidos.

Nunca entram no log senha, token, e-mail ou data de nascimento: o e-mail digitado só serve para achar a conta, e da data de nascimento fica só que mudou. As frases e textos da tela ficam no domínio (`src/dominio/logs.ts`), não no banco.
