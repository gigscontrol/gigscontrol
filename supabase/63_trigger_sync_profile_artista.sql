-- 63: Trigger que sincroniza o profile do artista com o soft-delete do artista.
-- Fecha o login-fantasma na RAIZ: qualquer soft-delete de artista (por qualquer
-- caminho) leva o profile papel=artista vinculado junto, e a restauracao volta
-- os dois. Roda como definer (profiles.write e RLS-locked pro service_role,
-- migration 57). Aplicada + testada via MCP (ambas as direcoes).

create or replace function public.sync_profile_com_artista()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.deletado_em is not null and old.deletado_em is null then
    update public.profiles
      set deletado_em = new.deletado_em
      where artista_id = new.id and papel = 'artista' and deletado_em is null;
  elsif new.deletado_em is null and old.deletado_em is not null then
    update public.profiles
      set deletado_em = null
      where artista_id = new.id and papel = 'artista' and deletado_em is not null;
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_profile_artista on public.artists;
create trigger trg_sync_profile_artista
  after update of deletado_em on public.artists
  for each row execute function public.sync_profile_com_artista();
