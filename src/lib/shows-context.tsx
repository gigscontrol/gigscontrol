"use client";

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { Show, BookingShow } from "@/types";
import { useAuth } from "./auth-context";

/**
 * Contexto de shows — agora ligado ao backend (`/api/shows`).
 *
 * Mantém um cache local da lista para renderização imediata. Cada mutação
 * faz a chamada à API e, em caso de sucesso, atualiza o cache com o
 * retorno do servidor (que já vem com `artistaNome`, `location` e `venue` resolvidos
 * via JOIN).
 *
 * `addShow` aceita o payload no formato legado (camelCase) usado pela UI
 * e traduz para o contrato da API (snake_case). Os FKs precisam ser uuid
 * — chamadas vindas de orçamentos/vendas (ainda em mock) que enviarem
 * números legados receberão erro 400, e isso é o esperado até as Etapas
 * 5 e 6 migrarem essas entidades.
 */

// `contratoDispensado` sai do Omit de propósito: no Show ele é o CARIMBO do
// servidor (`ContratoDispensadoInfo`), nunca entra na criação. Se ficasse aqui,
// o `Partial<AddShowInput> & { contratoDispensado?: boolean }` do UpdateShowInput
// viraria a interseção `ContratoDispensadoInfo & boolean` — tipo que nenhum
// booleano satisfaz, forçando cast em todo call-site.
export type AddShowInput = Omit<
  Show,
  "id" | "dayId" | "artistaNome" | "location" | "venue" | "contratoDispensado"
> & {
  /** Permitido continuar passando `artistaNome` legado — ignorado pela API. */
  artistaNome?: string;
  /** Idem — ignorado. */
  location?: string;
  /** Idem — ignorado. */
  venue?: string;
  /** Idem — derivado de `data` no servidor. */
  dayId?: number;
};

export type UpdateShowInput = Partial<AddShowInput> & {
  /** Motivo ao cancelar. O servidor carimba quem/quando em shows.meta —
   *  não é campo do Show, só trafega no PATCH. */
  cancelamentoMotivo?: string;
  /** Booking/hospedagem — mesclado em shows.meta.booking pelo servidor. */
  booking?: BookingShow;
  /** "Ignorar contrato": true dispensa a venda deste show do alerta da Agência,
   *  false desfaz. Transiente — o servidor carimba {em, por} em
   *  shows.meta.contratoDispensado e devolve o Show já com o campo. */
  contratoDispensado?: boolean;
};

type ShowsContextValue = {
  shows: Show[];
  carregando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
  addShow: (s: AddShowInput) => Promise<Show>;
  updateShow: (id: string, s: UpdateShowInput) => Promise<Show>;
  removeShow: (id: string) => Promise<void>;
};

const ShowsContext = createContext<ShowsContextValue | null>(null);

function camelParaApi(s: AddShowInput | UpdateShowInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (s.artistaId !== undefined) out.artist_id = s.artistaId || null;
  if (s.contratanteId !== undefined) out.contratante_id = s.contratanteId || null;
  if (s.casaId !== undefined) out.casa_id = s.casaId || null;
  if (s.cidadeId !== undefined) out.cidade_id = s.cidadeId || null;
  if (s.data !== undefined) out.data = s.data || null;
  if (s.time !== undefined) out.horario = s.time || null;
  if (s.status !== undefined) out.status = s.status;
  if (s.valor !== undefined) out.valor = s.valor ?? null;
  if (s.orcamentoId !== undefined) out.orcamento_id = s.orcamentoId || null;
  if (s.vendaId !== undefined) out.venda_id = s.vendaId || null;
  const motivo = (s as UpdateShowInput).cancelamentoMotivo;
  if (motivo !== undefined) out.cancelamentoMotivo = motivo;
  const booking = (s as UpdateShowInput).booking;
  if (booking !== undefined) out.booking = booking;
  const dispensado = (s as UpdateShowInput).contratoDispensado;
  if (dispensado !== undefined) out.contratoDispensado = dispensado;
  return out;
}

export function ShowsProvider({ children }: { children: ReactNode }) {
  const { sessao } = useAuth();
  const [shows, setShows] = useState<Show[]>([]);
  // Começa TRUE: o provider sempre dispara o fetch no mount, e entre o primeiro
  // render e o `setCarregando(true)` de dentro do recarregar havia uma janela
  // com `shows: []` + `carregando: false` — quem lê os dois via "0 shows" como
  // resposta pronta (o alerta da Agência mostrava a contagem sem as dispensadas).
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    // Sem workspace ativo (não logado ou super-admin no painel) não busca.
    if (!sessao?.workspace) {
      setShows([]);
      // Sem workspace não há o que buscar — encerra o "carregando" inicial,
      // senão ele ficaria travado em true pra sempre.
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch("/api/shows", { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.erro ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { shows: Show[] };
      setShows(body.shows);
    } catch (e) {
      setErro((e as Error).message);
      setShows([]);
    } finally {
      setCarregando(false);
    }
  }, [sessao?.workspace]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const addShow = useCallback(
    async (input: AddShowInput): Promise<Show> => {
      const res = await fetch("/api/shows", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(camelParaApi(input)),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.erro ?? `HTTP ${res.status}`);
      }
      const { show } = (await res.json()) as { show: Show };
      setShows((prev) => [...prev, show]);
      return show;
    },
    []
  );

  const updateShow = useCallback(
    async (id: string, input: UpdateShowInput): Promise<Show> => {
      const res = await fetch(`/api/shows/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(camelParaApi(input)),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.erro ?? `HTTP ${res.status}`);
      }
      const { show } = (await res.json()) as { show: Show };
      setShows((prev) => prev.map((s) => (s.id === id ? show : s)));
      return show;
    },
    []
  );

  const removeShow = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/shows/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.erro ?? `HTTP ${res.status}`);
    }
    setShows((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const value = useMemo<ShowsContextValue>(
    () => ({ shows, carregando, erro, recarregar, addShow, updateShow, removeShow }),
    [shows, carregando, erro, recarregar, addShow, updateShow, removeShow]
  );

  return <ShowsContext.Provider value={value}>{children}</ShowsContext.Provider>;
}

export function useShows() {
  const ctx = useContext(ShowsContext);
  if (!ctx) throw new Error("useShows deve ser usado dentro de <ShowsProvider>");
  return ctx;
}
