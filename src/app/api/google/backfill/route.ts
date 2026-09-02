import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { sincronizarShowNoGoogle } from "@/lib/google/calendario";
import {
  carregarVendaCompleta,
  vendaParaInputDoGoogle,
} from "@/lib/services/vendas.service";
import { respostaDeErro } from "@/lib/api/erros";

export const maxDuration = 60;

/**
 * POST /api/google/backfill  { artistaId }
 *
 * Envia pro Google Agenda do artista os shows FUTUROS que ainda não têm
 * evento — o caso clássico: shows criados ANTES de conectar a conta Google.
 * Idempotente: usa a MESMA sincronizarShowNoGoogle do fluxo normal, que grava
 * shows.google_event_id (rodar de novo não duplica). Admin-only, escopo do
 * workspace via RLS (mesmo padrão do /api/google/connect).
 */
export async function POST(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas o admin pode sincronizar a agenda dos artistas." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const artistaId =
    body && typeof body === "object" && "artistaId" in body
      ? String((body as { artistaId: unknown }).artistaId)
      : "";
  if (!artistaId) {
    return NextResponse.json({ erro: "artistaId obrigatório." }, { status: 400 });
  }

  const supabase = r.sessao.supabase;
  const { data: artista } = await supabase
    .from("artists")
    .select("id")
    .eq("id", artistaId)
    .maybeSingle();
  if (!artista) {
    return NextResponse.json({ erro: "Artista não encontrado." }, { status: 404 });
  }

  try {
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: vendas, error } = await supabase
      .from("vendas")
      .select("id, show_id")
      .eq("artist_id", artistaId)
      .gte("data_show", hoje)
      .not("show_id", "is", null)
      .is("deletado_em", null);
    if (error) throw error;

    const linhas = (vendas ?? []) as { id: string; show_id: string }[];
    let pendentes: { vendaId: string; showId: string }[] = [];
    if (linhas.length > 0) {
      const { data: shows, error: e2 } = await supabase
        .from("shows")
        .select("id, google_event_id, status")
        .in("id", linhas.map((v) => v.show_id));
      if (e2) throw e2;
      const semEvento = new Set(
        ((shows ?? []) as { id: string; google_event_id: string | null; status: string | null }[])
          .filter((s) => !s.google_event_id && s.status !== "cancelado")
          .map((s) => s.id)
      );
      pendentes = linhas
        .filter((v) => semEvento.has(v.show_id))
        .map((v) => ({ vendaId: v.id, showId: v.show_id }));
    }

    let criados = 0;
    const erros: string[] = [];
    for (const p of pendentes) {
      try {
        const venda = await carregarVendaCompleta(supabase, p.vendaId);
        if (!venda) continue;
        const res = await sincronizarShowNoGoogle(supabase, {
          artistId: artistaId,
          showId: p.showId,
          input: vendaParaInputDoGoogle(venda),
        });
        if (!res) {
          // Sem conexão Google — não adianta continuar o loop.
          return NextResponse.json(
            { erro: "Este artista não tem uma conta Google conectada." },
            { status: 409 }
          );
        }
        criados++;
      } catch (e) {
        erros.push((e as Error).message);
      }
    }

    return NextResponse.json({
      pendentes: pendentes.length,
      criados,
      falhas: erros.length,
      ...(erros.length ? { erros: erros.slice(0, 3) } : {}),
    });
  } catch (e) {
    return respostaDeErro(e, "Falha ao sincronizar a agenda.");
  }
}
