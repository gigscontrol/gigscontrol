import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { pertenceAoWorkspace } from "@/lib/api/pertence";
import { resetarSenhaDoUsuario } from "@/lib/services/usuarios.service";
import { audit } from "@/lib/services/historico.service";
import { notificarUsuario } from "@/lib/services/notificacoes.service";
import { respostaDeErro } from "@/lib/api/erros";

type RouteCtx = { params: { id: string } };

/**
 * POST /api/usuarios/:id/resetar-senha
 * Gera nova senha temporária e atualiza no Supabase Auth. A nova senha é
 * devolvida UMA vez pra UI mostrar — não fica armazenada em nenhum lugar.
 */
export async function POST(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  // Ação sensível de equipe é só de admin (igual ao reset de artista).
  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas admin pode resetar senha." },
      { status: 403 }
    );
  }
  try {
    const admin = criarClienteAdmin();
    // Isolamento multi-tenant: o admin client ignora RLS, então valida à mão.
    if (!(await pertenceAoWorkspace(admin, "profiles", params.id, r.sessao.workspaceId))) {
      return NextResponse.json({ erro: "Usuário não encontrado." }, { status: 404 });
    }
    const resultado = await resetarSenhaDoUsuario(admin, params.id);
    // Snapshot do nome
    const { data: snap } = await admin
      .from("profiles")
      .select("nome")
      .eq("id", params.id)
      .maybeSingle();
    await audit(r.sessao, {
      modulo: "equipe",
      tipo: "resetar-senha",
      entidadeId: params.id,
      entidadeNome: snap?.nome ?? null,
      descricao: `Resetou a senha de ${snap?.nome ?? "usuário"}`,
    });
    // Notifica o usuário afetado (não os admins)
    await notificarUsuario(r.sessao.workspaceId, params.id, {
      titulo: "Sua senha foi resetada",
      mensagem: `${r.sessao.userNome ?? "Um admin"} resetou sua senha. Use a nova senha temporária enviada e altere em Configurações → Segurança.`,
      tipo: "aviso",
      modulo: "equipe",
    });
    return NextResponse.json(resultado);
  } catch (e) {
    return respostaDeErro(e, "Falha ao resetar senha.");
  }
}
