"use client";

/**
 * Página do BOTÃO MÁGICO do e-mail de confirmação: conclui a assinatura
 * pendente automaticamente (sem digitar o código). Sucesso → oferece ver o
 * contrato assinado; expirado → orienta a assinar de novo pelo mesmo link.
 */
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, Loader2, AlertCircle, FileText } from "lucide-react";

type EstadoPagina =
  | { fase: "confirmando" }
  | { fase: "assinado"; token: string | null }
  | { fase: "expirado"; mensagem: string }
  | { fase: "erro"; mensagem: string };

export default function ConcluirAssinaturaPage({
  params,
}: {
  params: { confirmToken: string };
}) {
  const [estado, setEstado] = useState<EstadoPagina>({ fase: "confirmando" });
  const disparado = useRef(false);

  useEffect(() => {
    if (disparado.current) return; // StrictMode dispara efeitos 2x no dev
    disparado.current = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/assinar/concluir/${encodeURIComponent(params.confirmToken)}`,
          { method: "POST" }
        );
        const body = (await res.json().catch(() => ({}))) as {
          assinado?: boolean;
          token?: string;
          erro?: string;
          expirado?: boolean;
        };
        if (res.ok && body.assinado) {
          setEstado({ fase: "assinado", token: body.token ?? null });
        } else if (body.expirado) {
          setEstado({
            fase: "expirado",
            mensagem:
              body.erro ??
              "O prazo de 30 minutos expirou. Abra o link do contrato e assine novamente.",
          });
        } else {
          setEstado({
            fase: "erro",
            mensagem: body.erro ?? "Não foi possível concluir a assinatura.",
          });
        }
      } catch {
        setEstado({
          fase: "erro",
          mensagem: "Falha de conexão. Tente abrir o link do e-mail novamente.",
        });
      }
    })();
  }, [params.confirmToken]);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--bg-main)" }}
    >
      <div className="card w-full max-w-md flex flex-col items-center text-center gap-3 py-10">
        {estado.fase === "confirmando" && (
          <>
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--brand)" }} />
            <div className="section-title">Concluindo sua assinatura…</div>
          </>
        )}
        {estado.fase === "assinado" && (
          <>
            <CheckCircle2 size={32} style={{ color: "var(--success)" }} />
            <div className="section-title">Assinatura concluída! 🎉</div>
            <p className="text-sm text-muted max-w-sm">
              Sua assinatura foi confirmada e registrada com validade jurídica.
              Você pode fechar esta página.
            </p>
            {estado.token && (
              <a
                href={`/assinar/${estado.token}`}
                className="btn mt-2"
                style={{ backgroundColor: "var(--brand)", color: "#fff" }}
              >
                <FileText size={15} />
                Ver o contrato assinado
              </a>
            )}
          </>
        )}
        {estado.fase === "expirado" && (
          <>
            <Clock size={30} style={{ color: "var(--warning)" }} />
            <div className="section-title">Prazo expirado</div>
            <p className="text-sm text-muted max-w-sm">{estado.mensagem}</p>
            <p className="text-xs text-muted max-w-sm">
              O link do contrato continua o mesmo — é só abrir de novo,
              preencher e assinar; um novo código será enviado.
            </p>
          </>
        )}
        {estado.fase === "erro" && (
          <>
            <AlertCircle size={30} style={{ color: "var(--danger)" }} />
            <div className="section-title">Não foi possível concluir</div>
            <p className="text-sm text-muted max-w-sm">{estado.mensagem}</p>
          </>
        )}
      </div>
    </div>
  );
}
