# 12: Push: ativar neste aparelho

**Spec:** `../spec.md` (Alteração 7, seções de inscrição e consentimento)

**What to build:** Em "Minha conta", a seção "Notificações" permite ativar e desativar o push neste aparelho, só depois de um toque, com orientação para iPhone e iPad, estado do dispositivo e lista de dispositivos. O service worker existente recebe o tratamento de `push` e de `notificationclick`. Um botão envia uma notificação de teste para a própria pessoa.

**Blocked by:** 11 (Minha conta e assinatura de calendário)

**Status:** done

- [x] Tabela de inscrições por dispositivo (usuário, endpoint, chaves, nome amigável, criação, último uso), com políticas só do dono e do servidor; endpoint e chaves nunca em telas, Logs ou exportações
- [x] Chaves VAPID só como variáveis de ambiente (a pública no navegador, a privada só no servidor); README com como gerar e rotacionar. Nomes definidos por `scripts/wizard-integracoes.sh` (etapa 9, que gera as chaves): `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` (`mailto:…`); rotacionar invalida todas as inscrições
- [x] O pedido de permissão do navegador só acontece após um toque na seção; nada é enviado sem permissão
- [x] iPhone e iPad: detecta app não instalado e mostra "Compartilhar → Adicionar à Tela de Início" antes de oferecer a ativação
- [x] Mostra o estado: ativo neste dispositivo, bloqueado (com instrução de como liberar) ou não suportado
- [x] A pessoa vê a lista dos seus dispositivos e desativa um ou todos; sair da conta remove a inscrição daquele dispositivo
- [x] `sw.js` ganha `push` (exibe título, texto, `tag` e dados mínimos) e `notificationclick` (reaproveita a janela aberta ou abre o Evento ou a Chamada), sem segundo service worker
- [x] Notificação de teste enviada a si mesmo pelo adaptador de envio (com falso para testes); ativar e desativar viram Log
- [x] Testes (opt-in e opt-out, vários dispositivos, remoção por 404 ou 410, políticas do banco, ausência de endpoints nos Logs); o clique da notificação fica como verificação manual descrita no resumo
