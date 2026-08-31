"use client";

import { useEffect, useRef, useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileUp,
  Link2,
} from "lucide-react";

/**
 * Página PÚBLICA de verificação de um contrato pelo código GC-XXXX-XXXX
 * (mig 98 — validade jurídica). Mostra:
 *  - status/finalização + integridade da cadeia de eventos (recomputada no banco);
 *  - quem assinou (documento mascarado — sem KYC/IP/geo);
 *  - hashes oficiais (conteúdo e PDF final);
 *  - comparador local: a pessoa escolhe o PDF que guardou e o navegador
 *    calcula o SHA-256 (SubtleCrypto) e compara com o hash selado — o arquivo
 *    NUNCA é enviado ao servidor.
 */

type Resultado = {
  verificacaoId: string;
  numero: string;
  status: string;
  finalizadoEm: string | null;
  conteudoHash: string | null;
  conteudoVersao: number;
  pdfFinalHash: string | null;
  assinaturas: {
    nome: string;
    papel: string | null;
    documento: string | null;
    assinadoEm: string | null;
  }[];
  cadeia: { integra: boolean; eventos: number; furoSeq: number | null };
  eventos: { seq: number; tipo: string; criadoEm: string; hash: string }[];
};

const ROTULO_EVENTO: Record<string, string> = {
  criado: "Contrato criado",
  conteudo_alterado: "Conteúdo alterado (nova versão)",
  enviado: "Enviado para assinatura",
  aberto: "Link de assinatura aberto",
  otp_enviado: "Código de verificação enviado por e-mail",
  otp_verificado: "E-mail verificado (código OTP)",
  assinado: "Assinatura registrada",
  finalizado: "Todas as assinaturas concluídas",
  pdf_final_gerado: "PDF final selado",
  cancelado: "Contrato cancelado",
};

function dataHoraBR(iso: string | null): string {
  if (!iso) return "";
  const d = iso.slice(0, 10).split("-");
  const h = iso.slice(11, 16);
  if (d.length !== 3) return iso;
  return `${d[2]}/${d[1]}/${d[0]}${h ? ` às ${h}` : ""}`;
}

export default function VerificarContratoPage({
  params,
}: {
  params: { id: string };
}) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Comparador local de arquivo (SHA-256 no navegador).
  const fileRef = useRef<HTMLInputElement>(null);
  const [hashLocal, setHashLocal] = useState<string | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [calculando, setCalculando] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/verificar/${encodeURIComponent(params.id)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!vivo) return;
        if (!res.ok)
          throw new Error(
            (body as { erro?: string }).erro ?? `HTTP ${res.status}`
          );
        setResultado(body as Resultado);
      })
      .catch((e) => {
        if (vivo) setErro((e as Error).message);
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [params.id]);

  async function calcularHashLocal(file: File) {
    setCalculando(true);
    setNomeArquivo(file.name);
    setHashLocal(null);
    try {
      const buf = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", buf);
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      setHashLocal(hex);
    } catch {
      setHashLocal("erro");
    } finally {
      setCalculando(false);
    }
  }

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">
        <Loader2 size={20} className="animate-spin mr-2" />
        Verificando…
      </div>
    );
  }

  if (erro || !resultado) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertCircle size={28} style={{ color: "var(--danger)" }} />
        <div className="section-title">Não foi possível verificar</div>
        <p className="text-sm text-muted max-w-sm">
          {erro ?? "Nenhum contrato encontrado com este código."}
        </p>
        <a href="/verificar" className="btn btn-secondary mt-2 text-sm">
          <Link2 size={14} />
          Tentar outro código
        </a>
      </div>
    );
  }

  const autentico =
    resultado.cadeia.integra && resultado.status !== "cancelado";
  const arquivoConfere =
    hashLocal && resultado.pdfFinalHash
      ? hashLocal === resultado.pdfFinalHash
      : null;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-main)" }}>
      <div className="max-w-[760px] mx-auto p-4 sm:p-6 flex flex-col gap-4">
        {/* Veredito */}
        <div
          className="card flex items-start gap-3"
          style={{
            borderColor: autentico ? "var(--success)" : "var(--danger)",
            boxShadow: `0 0 0 1px ${autentico ? "var(--success)" : "var(--danger)"}`,
          }}
        >
          {autentico ? (
            <ShieldCheck
              size={28}
              className="flex-shrink-0"
              style={{ color: "var(--success)" }}
            />
          ) : (
            <ShieldAlert
              size={28}
              className="flex-shrink-0"
              style={{ color: "var(--danger)" }}
            />
          )}
          <div className="min-w-0">
            <div className="section-title">
              {autentico
                ? "Documento autêntico"
                : resultado.status === "cancelado"
                  ? "Contrato cancelado"
                  : "Atenção: trilha de auditoria com inconsistência"}
            </div>
            <p className="text-sm text-muted mt-1 leading-relaxed">
              Contrato <strong>{resultado.numero}</strong> · código{" "}
              <span className="font-mono">{resultado.verificacaoId}</span>
              {resultado.finalizadoEm
                ? ` · finalizado em ${dataHoraBR(resultado.finalizadoEm)}`
                : ""}
              . Trilha de auditoria com {resultado.cadeia.eventos} evento
              {resultado.cadeia.eventos === 1 ? "" : "s"},{" "}
              {resultado.cadeia.integra
                ? "íntegra (cadeia de hashes verificada agora no banco)."
                : "INCONSISTENTE — procure a agência emissora."}
            </p>
          </div>
        </div>

        {/* Assinaturas */}
        <div className="card">
          <div className="section-title mb-3">Assinaturas</div>
          {resultado.assinaturas.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma assinatura registrada.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {resultado.assinaturas.map((a, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-primary truncate">
                      {a.nome}
                      {a.papel ? (
                        <span className="text-muted font-normal"> — {a.papel}</span>
                      ) : null}
                    </div>
                    {a.documento && (
                      <div className="text-xs text-muted mt-0.5">
                        Documento {a.documento}
                      </div>
                    )}
                  </div>
                  <div
                    className="flex items-center gap-1.5 text-xs"
                    style={{ color: "var(--success)" }}
                  >
                    <CheckCircle2 size={14} />
                    {a.assinadoEm ? dataHoraBR(a.assinadoEm) : "Assinado"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Impressões digitais (hashes) */}
        <div className="card">
          <div className="section-title mb-3">Impressão digital do documento</div>
          <div className="flex flex-col gap-3 text-sm">
            {resultado.conteudoHash && (
              <div>
                <div className="stat-label mb-1">
                  SHA-256 do conteúdo (versão {resultado.conteudoVersao})
                </div>
                <code className="block text-xs font-mono break-all rounded bg-elevated border border-border p-2">
                  {resultado.conteudoHash}
                </code>
              </div>
            )}
            {resultado.pdfFinalHash && (
              <div>
                <div className="stat-label mb-1">SHA-256 do PDF final selado</div>
                <code className="block text-xs font-mono break-all rounded bg-elevated border border-border p-2">
                  {resultado.pdfFinalHash}
                </code>
              </div>
            )}
            {!resultado.conteudoHash && !resultado.pdfFinalHash && (
              <p className="text-muted">
                Este contrato ainda não teve o conteúdo selado.
              </p>
            )}
          </div>

          {/* Comparador local */}
          {resultado.pdfFinalHash && (
            <div className="mt-4 rounded-lg border border-dashed border-border p-3">
              <div className="text-sm font-medium text-secondary mb-1.5">
                Conferir o arquivo que você recebeu
              </div>
              <p className="text-xs text-muted leading-relaxed mb-2.5">
                Escolha o PDF do contrato que está com você. O código é
                calculado <strong>no seu navegador</strong> — o arquivo não é
                enviado a lugar nenhum.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void calcularHashLocal(f);
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={calculando}
                className="btn btn-secondary text-sm"
              >
                {calculando ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <FileUp size={14} />
                )}
                Escolher PDF
              </button>
              {hashLocal && hashLocal !== "erro" && (
                <div
                  className="mt-2.5 flex items-start gap-2 text-sm"
                  style={{
                    color: arquivoConfere ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {arquivoConfere ? (
                    <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle size={16} className="flex-shrink-0 mt-0.5" />
                  )}
                  <span>
                    {arquivoConfere
                      ? `O arquivo "${nomeArquivo}" é EXATAMENTE o PDF final selado deste contrato.`
                      : `O arquivo "${nomeArquivo}" NÃO corresponde ao PDF final selado — pode ter sido alterado ou ser outra versão.`}
                  </span>
                </div>
              )}
              {hashLocal === "erro" && (
                <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>
                  Não foi possível ler o arquivo. Tente novamente.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Linha do tempo */}
        <div className="card">
          <div className="section-title mb-3">Histórico do contrato</div>
          <div className="flex flex-col">
            {resultado.eventos.map((ev) => (
              <div
                key={ev.seq}
                className="flex items-start gap-3 py-2 border-b border-border last:border-b-0"
              >
                <div
                  className="mt-1.5 h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: "var(--brand)" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-primary">
                    {ROTULO_EVENTO[ev.tipo] ?? ev.tipo}
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {dataHoraBR(ev.criadoEm)} · elo #{ev.seq} ·{" "}
                    <span className="font-mono">{ev.hash.slice(0, 12)}…</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted text-center pb-6">
          Verificação emitida pela plataforma GIGS CONTROL. A trilha de
          auditoria é imutável: cada evento sela o anterior por hash SHA-256 e
          qualquer adulteração quebra a cadeia.
        </p>
      </div>
    </div>
  );
}
