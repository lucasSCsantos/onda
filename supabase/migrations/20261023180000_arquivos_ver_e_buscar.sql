-- Arquivos: ver, buscar e baixar (ticket 07 de .scratch/drive-agenda-avisos). Ver ADR 0006.
-- O limite de tamanho do download, que o Admin ajusta em Configurações. Só acréscimo; cada mudança vira Log pelo gatilho
-- das configurações (`acao_da_configuracao` já manda as chaves `drive_*` para o módulo do Drive).

alter table public.configuracoes
  add column drive_limite_de_download_mb integer not null default 4 check (drive_limite_de_download_mb between 1 and 50);

grant update (drive_limite_de_download_mb) on public.configuracoes to authenticated;

-- Reverter --------------------------------------------------------------------------
-- alter table public.configuracoes drop column drive_limite_de_download_mb;
