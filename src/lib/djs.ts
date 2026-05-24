import type { DJ } from "@/types";

/**
 * Fallback estático dos DJs — usado APENAS quando a sessão ainda não
 * carregou o workspace ou quando o componente roda fora do
 * `WorkspaceProvider`. A fonte real é o `useArtistas()` hook (lê do
 * `workspace-context`, que vem da tabela `artists` no Supabase).
 *
 * Os IDs aqui batem com os uuids fixos do seed (10_artistas_extras.sql).
 */
export const DJS_FALLBACK: DJ[] = [
  { id: "a0000001-0000-0000-0000-000000000001", name: "CZ",         color: "#ef4444" },
  { id: "a0000002-0000-0000-0000-000000000001", name: "Dudu",       color: "#22c55e" },
  { id: "a0000003-0000-0000-0000-000000000001", name: "Maninho",    color: "#a855f7" },
  { id: "a0000004-0000-0000-0000-000000000001", name: "Blackdrumm", color: "#3b82f6" },
];

/**
 * @deprecated use o hook `useArtistas()` (de `workspace-context`).
 * Mantido só para arquivos legacy/seeds que ainda não migraram.
 */
export const DJS: DJ[] = DJS_FALLBACK;

/** IDs (uuid) dos artistas que vêm pré-selecionados na sidebar. */
export const DEFAULT_SELECTED_DJ_IDS: string[] = DJS_FALLBACK.map((d) => d.id);
