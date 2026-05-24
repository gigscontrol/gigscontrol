import { NextResponse } from "next/server";
import { autenticarSuperAdmin } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { listarUsuariosPlataforma } from "@/lib/services/plataforma.service";

export async function GET() {
  const r = await autenticarSuperAdmin();
  if ("response" in r) return r.response;
  try {
    const admin = criarClienteAdmin();
    const usuarios = await listarUsuariosPlataforma(admin);
    return NextResponse.json({ usuarios });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao listar usuários." },
      { status: 500 }
    );
  }
}
