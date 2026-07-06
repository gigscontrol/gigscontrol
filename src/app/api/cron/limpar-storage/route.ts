import { NextResponse } from "next/server";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";

/**
 * GET /api/cron/limpar-storage — drena a fila `storage_orfaos`.
 *
 * O purge (limpar_lixeira_expirada) faz hard-delete de vendas/agenda/contratos
 * apos 30 dias na lixeira e ENFILEIRA os paths dos objetos ligados (comprovante,
 * voucher, fotos de assinatura). Esta rota apaga esses objetos com service_role
 * — o Postgres nao acessa o Storage API, entao a limpeza vive aqui.
 *
 * Disparada por Vercel Cron (vercel.json) 1x/dia, depois do purge. Protegida por
 * CRON_SECRET (a Vercel injeta `Authorization: Bearer $CRON_SECRET`).
 *
 * ?dry=1 => NAO apaga nada; devolve o que APAGARIA (validacao antes do real).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Row = { id: string; bucket: string; path: string };

/** Defesa: rejeita path vazio, traversal ou absoluto (nao deveria ocorrer — os
 *  paths sao gerados pelo servidor no enqueue — mas nunca apaga fora do esperado). */
function pathSeguro(p: string): boolean {
  return !!p && !p.includes("..") && !p.startsWith("/");
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ erro: "CRON_SECRET não configurada." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const dry = new URL(request.url).searchParams.get("dry") === "1";
  const admin = criarClienteAdmin();

  const { data: rows, error } = await admin
    .from("storage_orfaos")
    .select("id, bucket, path")
    .is("processado_em", null)
    .order("criado_em", { ascending: true })
    .limit(1000);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const pendentes = (rows ?? []) as Row[];

  // Agrupa por bucket — remove() aceita varios paths do MESMO bucket por chamada.
  const porBucket = new Map<string, Row[]>();
  const invalidos: Row[] = [];
  for (const r of pendentes) {
    if (!pathSeguro(r.path)) {
      invalidos.push(r);
      continue;
    }
    const lista = porBucket.get(r.bucket) ?? [];
    lista.push(r);
    porBucket.set(r.bucket, lista);
  }

  if (dry) {
    return NextResponse.json({
      dry: true,
      pendentes: pendentes.length,
      invalidos: invalidos.map((r) => ({ bucket: r.bucket, path: r.path })),
      apagaria: [...porBucket.entries()].map(([bucket, rs]) => ({
        bucket,
        paths: rs.map((r) => r.path),
      })),
    });
  }

  const agora = new Date().toISOString();
  let apagados = 0;
  const falhas: { bucket: string; erro: string; n: number }[] = [];

  // Path malformado: marca com erro pra nao retentar pra sempre.
  if (invalidos.length) {
    await admin
      .from("storage_orfaos")
      .update({ processado_em: agora, erro: "path inválido" })
      .in(
        "id",
        invalidos.map((r) => r.id)
      );
  }

  const CHUNK = 100;
  for (const [bucket, rs] of porBucket) {
    for (let i = 0; i < rs.length; i += CHUNK) {
      const lote = rs.slice(i, i + CHUNK);
      const ids = lote.map((r) => r.id);
      const { error: errRm } = await admin.storage
        .from(bucket)
        .remove(lote.map((r) => r.path));
      if (errRm) {
        // Falha (provavelmente transitoria): deixa processado_em NULL pra retentar
        // no proximo run, so registra o erro. Objeto que falhou DEVE ser reapagado.
        await admin.from("storage_orfaos").update({ erro: errRm.message }).in("id", ids);
        falhas.push({ bucket, erro: errRm.message, n: lote.length });
      } else {
        await admin
          .from("storage_orfaos")
          .update({ processado_em: agora, erro: null })
          .in("id", ids);
        apagados += lote.length;
      }
    }
  }

  return NextResponse.json({ ok: true, apagados, invalidos: invalidos.length, falhas });
}
