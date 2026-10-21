-- Esquema do ranking e das skins enviadas. Rode no Supabase: SQL Editor → New query → Run.
create table if not exists public.kv (
  key   text primary key,
  value jsonb not null
);
-- RLS ligado e sem políticas: só a chave service_role (usada pelo servidor) acessa.
alter table public.kv enable row level security;
