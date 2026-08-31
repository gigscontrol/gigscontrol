"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Search } from "lucide-react";

/**
 * Página PÚBLICA de verificação de autenticidade — landing. Qualquer pessoa
 * com o código GC-XXXX-XXXX (impresso no contrato/relatório de assinaturas)
 * confere aqui se o documento é autêntico e o que foi assinado.
 */
export default function VerificarLanding() {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function formatar(v: string): string {
    // Aceita colar com/sem GC- e hífens; normaliza pra GC-XXXX-XXXX.
    const limpo = v.toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/^GC/, "");
    const a = limpo.slice(0, 4);
    const b = limpo.slice(4, 8);
    return `GC-${a}${b ? `-${b}` : ""}`;
  }

  function abrir() {
    const c = codigo.trim().toUpperCase();
    if (!/^GC-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(c)) {
      setErro("Informe o código completo, no formato GC-XXXX-XXXX.");
      return;
    }
    setErro(null);
    router.push(`/verificar/${c}`);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--bg-main)" }}
    >
      <div className="card w-full max-w-md flex flex-col gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <div
            className="h-12 w-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgba(34,197,94,0.12)" }}
          >
            <ShieldCheck size={24} style={{ color: "var(--success)" }} />
          </div>
          <h1 className="section-title">Verificar autenticidade</h1>
          <p className="text-sm text-muted leading-relaxed">
            Digite o código de verificação impresso no contrato ou no relatório
            de assinaturas para conferir se o documento é autêntico.
          </p>
        </div>

        <input
          value={codigo}
          onChange={(e) => setCodigo(formatar(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && abrir()}
          placeholder="GC-XXXX-XXXX"
          maxLength={12}
          className="campo-input font-mono text-center text-lg tracking-widest"
          autoFocus
        />

        {erro && (
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            {erro}
          </p>
        )}

        <button
          type="button"
          onClick={abrir}
          className="btn"
          style={{ backgroundColor: "var(--brand)", color: "#fff" }}
        >
          <Search size={15} />
          Verificar
        </button>
      </div>
    </div>
  );
}
