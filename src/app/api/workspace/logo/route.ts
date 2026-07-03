import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { verificarAdminDoWorkspace } from "@/lib/api/permissoes";
import { rowParaWorkspace, type WorkspaceRow } from "@/lib/mappers/workspace";
import { auditAndNotify } from "@/lib/services/historico.service";

const BUCKET = "workspace-logos";
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const TIPOS_ACEITOS = ["image/png", "image/jpeg", "image/webp"];

/**
 * POST /api/workspace/logo — upload de logo via multipart FormData.
 * Campo esperado: `file` (Blob de imagem).
 *
 * Usa o cliente admin (service_role) para subir no bucket e atualizar
 * o `logo_url` em workspaces. A autorização é feita antes via
 * `autenticarComWorkspace` (precisa ter sessão e workspace).
 */
export async function POST(request: Request) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;
  const g = verificarAdminDoWorkspace(r.sessao);
  if (g) return g;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { erro: "Envio inválido (não é FormData)." },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { erro: "Campo 'file' não encontrado." },
      { status: 400 }
    );
  }
  if (!TIPOS_ACEITOS.includes(file.type)) {
    return NextResponse.json(
      { erro: "Formato inválido. Use PNG, JPG ou WEBP." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { erro: "Arquivo maior que 4 MB." },
      { status: 400 }
    );
  }

  const admin = criarClienteAdmin();

  // Path: <workspace_id>/logo-<timestamp>.<ext> — timestamp dribla cache
  const ext = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "webp";
  const filename = `logo-${Date.now()}.${ext}`;
  const path = `${r.sessao.workspaceId}/${filename}`;

  // Lê o conteúdo do File e sobe
  const arrayBuffer = await file.arrayBuffer();
  const { error: errUp } = await admin.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });
  if (errUp) {
    return NextResponse.json(
      { erro: `Falha no upload: ${errUp.message}` },
      { status: 500 }
    );
  }

  // URL pública
  const { data: publicUrlData } = admin.storage.from(BUCKET).getPublicUrl(path);
  const logoUrl = publicUrlData.publicUrl;

  // Antes de atualizar, busca a URL anterior para apagar do Storage
  const { data: atual } = await admin
    .from("workspaces")
    .select("logo_url")
    .eq("id", r.sessao.workspaceId)
    .single<{ logo_url: string | null }>();

  // Atualiza workspaces.logo_url
  const { data: atualizado, error: errUpd } = await admin
    .from("workspaces")
    .update({ logo_url: logoUrl })
    .eq("id", r.sessao.workspaceId)
    .select("id, nome, plano, ciclo, status, logo_url, criado_em")
    .single<WorkspaceRow>();
  if (errUpd || !atualizado) {
    return NextResponse.json(
      { erro: errUpd?.message ?? "Falha ao atualizar workspace." },
      { status: 500 }
    );
  }

  // Apaga o arquivo antigo (best-effort — ignora erro)
  if (atual?.logo_url) {
    const prevPath = extrairPath(atual.logo_url);
    if (prevPath && prevPath !== path) {
      await admin.storage.from(BUCKET).remove([prevPath]).catch(() => undefined);
    }
  }

  const ws = rowParaWorkspace(atualizado);
  await auditAndNotify(r.sessao, {
    modulo: "aparencia",
    tipo: "upload-logo",
    entidadeId: ws.id,
    entidadeNome: ws.nomeAgencia,
    descricao: `Atualizou a logo da agência`,
  });
  return NextResponse.json({ workspace: ws });
}

/**
 * DELETE /api/workspace/logo — apaga a logo atual.
 */
export async function DELETE() {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;
  const g = verificarAdminDoWorkspace(r.sessao);
  if (g) return g;

  const admin = criarClienteAdmin();

  const { data: atual } = await admin
    .from("workspaces")
    .select("logo_url")
    .eq("id", r.sessao.workspaceId)
    .single<{ logo_url: string | null }>();

  if (atual?.logo_url) {
    const path = extrairPath(atual.logo_url);
    if (path) {
      await admin.storage.from(BUCKET).remove([path]).catch(() => undefined);
    }
  }

  const { data: atualizado, error } = await admin
    .from("workspaces")
    .update({ logo_url: null })
    .eq("id", r.sessao.workspaceId)
    .select("id, nome, plano, ciclo, status, logo_url, criado_em")
    .single<WorkspaceRow>();
  if (error || !atualizado) {
    return NextResponse.json(
      { erro: error?.message ?? "Falha ao remover logo." },
      { status: 500 }
    );
  }

  const ws = rowParaWorkspace(atualizado);
  await auditAndNotify(r.sessao, {
    modulo: "aparencia",
    tipo: "remover-logo",
    entidadeId: ws.id,
    entidadeNome: ws.nomeAgencia,
    descricao: `Removeu a logo da agência`,
  });
  return NextResponse.json({ workspace: ws });
}

/** Extrai o path interno do bucket a partir de uma URL pública do Supabase. */
function extrairPath(publicUrl: string): string | null {
  // Padrão: https://<projeto>.supabase.co/storage/v1/object/public/workspace-logos/<path>
  const marker = `/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx < 0) return null;
  return publicUrl.slice(idx + marker.length);
}
