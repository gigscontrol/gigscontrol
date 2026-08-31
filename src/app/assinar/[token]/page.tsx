"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  Download,
  PenLine,
  ShieldCheck,
  ScanFace,
  MailCheck,
} from "lucide-react";
import { FolhaA4, gerarPdfFolha, type AssinaturaInfo } from "@/components/contratos/folhaA4";
import AssinaturaCanvas from "@/components/contratos/AssinaturaCanvas";
import CapturaFoto from "@/components/contratos/CapturaFoto";
import SelfieAoVivo from "@/components/contratos/SelfieAoVivo";
import { documentoValido } from "@/lib/documento";
import { mascararCpfCnpj } from "@/lib/formatters";
import type { SecaoModelo, EstiloModelo } from "@/lib/mappers/contratoModelo";
import type { ExigenciasSignatario } from "@/lib/mappers/contratoSignatario";

type Dados = {
  signatario: {
    nome: string;
    email: string | null;
    papel: string | null;
    exige: ExigenciasSignatario;
    status: "pendente" | "assinado";
    assinatura: string | null;
    documento: string | null;
    assinadoEm: string | null;
    /** OTP de e-mail já confirmado (exigência otpEmail). */
    otpVerificado?: boolean;
  };
  contrato: {
    numero: string;
    conteudo: { secoes: SecaoModelo[]; estilo: EstiloModelo };
    /** Código público GC-XXXX-XXXX (só quando finalizado). */
    verificacaoId?: string | null;
  };
  /** Signatários do mesmo contrato que já assinaram (relatório, sem KYC). */
  assinaturas: AssinaturaInfo[];
  jaAssinou: boolean;
};

function dataHoraBR(iso: string | null): string {
  if (!iso) return "";
  const d = iso.slice(0, 10).split("-");
  const h = iso.slice(11, 16);
  if (d.length !== 3) return iso;
  return `${d[2]}/${d[1]}/${d[0]}${h ? ` ${h}` : ""}`;
}

export default function AssinarPage({
  params,
}: {
  params: { token: string };
}) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  // Contrato cancelado pela agência (D4): tela dedicada, não "link inválido".
  const [cancelado, setCancelado] = useState(false);

  const [documento, setDocumento] = useState("");
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [fotoDocumento, setFotoDocumento] = useState<string | null>(null);
  const [fotoDocumentoVerso, setFotoDocumentoVerso] = useState<string | null>(
    null
  );
  const [mostrarCamera, setMostrarCamera] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);

  // OTP por e-mail (exigência otpEmail): estado local do fluxo de verificação.
  const [otpOk, setOtpOk] = useState(false);
  const [otpEnviado, setOtpEnviado] = useState(false);
  const [otpCodigo, setOtpCodigo] = useState("");
  const [otpOcupado, setOtpOcupado] = useState(false);
  const [otpMsg, setOtpMsg] = useState<string | null>(null);

  const folhaRef = useRef<HTMLDivElement>(null);
  const conteudoRef = useRef<HTMLDivElement>(null);

  async function carregar() {
    setCarregando(true);
    setErroCarga(null);
    try {
      const res = await fetch(`/api/assinar/${params.token}`);
      const body = await res.json().catch(() => ({}));
      // Contrato cancelado pela agência → tela dedicada (não "link inválido").
      if ((body as { cancelado?: boolean }).cancelado) {
        setCancelado(true);
        return;
      }
      if (!res.ok) throw new Error(body.erro ?? `HTTP ${res.status}`);
      setDados(body as Dados);
      if ((body as Dados).signatario.otpVerificado) setOtpOk(true);
      if ((body as Dados).signatario.documento)
        setDocumento(
          mascararCpfCnpj((body as Dados).signatario.documento ?? "")
        );
    } catch (e) {
      setErroCarga((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enquanto a câmera está aberta (inclusive na tela de QR, quando o
  // dispositivo não tem câmera), fica escutando: se a pessoa concluir a
  // assinatura em outro aparelho (pelo celular via QR), o desktop detecta e
  // já mostra o estado "assinado".
  useEffect(() => {
    if (!mostrarCamera) return;
    const id = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/assinar/${params.token}`);
        const body = await res.json().catch(() => ({}));
        if (res.ok && (body as Dados).signatario?.status === "assinado") {
          setDados(body as Dados);
          setMostrarCamera(false);
        }
      } catch {
        /* silencioso — tenta de novo no próximo ciclo */
      }
    }, 4000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarCamera]);

  function pegarGeo(): Promise<string> {
    return new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation)
        return resolve("");
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve(
            `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`
          ),
        () => resolve(""),
        { timeout: 8000, maximumAge: 60000 }
      );
    });
  }

  /**
   * Valida os campos. Se a verificação facial/selfie for exigida, abre a
   * câmera ao vivo (o envio acontece depois, quando a selfie é capturada).
   * Caso contrário, envia direto.
   */
  // ---- OTP por e-mail ----

  async function enviarOtp() {
    setOtpOcupado(true);
    setOtpMsg(null);
    try {
      const res = await fetch(`/api/assinar/${params.token}/otp`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.erro ?? `HTTP ${res.status}`);
      setOtpEnviado(true);
      setOtpMsg("Código enviado! Confira sua caixa de entrada (e o spam).");
    } catch (e) {
      setOtpMsg((e as Error).message);
    } finally {
      setOtpOcupado(false);
    }
  }

  async function verificarOtp() {
    if (!/^\d{6}$/.test(otpCodigo.trim())) {
      setOtpMsg("Digite o código de 6 dígitos.");
      return;
    }
    setOtpOcupado(true);
    setOtpMsg(null);
    try {
      const res = await fetch(`/api/assinar/${params.token}/otp/verificar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: otpCodigo.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.erro ?? `HTTP ${res.status}`);
      setOtpOk(true);
      setOtpMsg(null);
      setErro(null);
    } catch (e) {
      setOtpMsg((e as Error).message);
    } finally {
      setOtpOcupado(false);
    }
  }

  function assinar() {
    if (!dados) return;
    const ex = dados.signatario.exige;
    if (ex.otpEmail && !otpOk) {
      setErro("Confirme o código enviado ao seu e-mail antes de assinar.");
      return;
    }
    if (ex.cpfCnpj && !documento.trim()) {
      setErro("Informe seu CPF ou CNPJ.");
      return;
    }
    if (ex.cpfCnpj && !documentoValido(documento)) {
      setErro("Documento inválido: informe um CPF (11 dígitos) ou CNPJ (14 dígitos).");
      return;
    }
    if (ex.assinaturaTela && !assinatura) {
      setErro("Desenhe sua assinatura no quadro.");
      return;
    }
    if (ex.fotoDocumento && !fotoDocumento) {
      setErro("Envie a foto da frente do seu documento (CNH ou RG).");
      return;
    }
    if (ex.fotoDocumento && !fotoDocumentoVerso) {
      setErro("Envie a foto do verso do seu documento (CNH ou RG).");
      return;
    }
    setErro(null);
    // Selfie de verificação é tirada AO VIVO: abre a câmera e envia na captura.
    if (ex.selfie || ex.facial) {
      setMostrarCamera(true);
      return;
    }
    void enviarAssinatura(null);
  }

  async function enviarAssinatura(selfie: string | null) {
    if (!dados) return;
    setMostrarCamera(false);
    setEnviando(true);
    setErro(null);
    try {
      const geolocalizacao = await pegarGeo();
      // Fuso do navegador — evidência registrada junto com data/hora e IP.
      let fusoHorario = "";
      try {
        fusoHorario = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
      } catch {
        /* navegador sem Intl completo — segue sem fuso */
      }
      const res = await fetch(`/api/assinar/${params.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assinatura: assinatura ?? "",
          documento,
          geolocalizacao,
          fusoHorario,
          fotoDocumento: fotoDocumento ?? "",
          fotoDocumentoVerso: fotoDocumentoVerso ?? "",
          selfie: selfie ?? "",
        }),
      });
      const body = await res.json().catch(() => ({}));
      // Cancelado no meio do caminho (a agência cancelou enquanto a pessoa
      // preenchia) → tela dedicada, sem tratar como erro genérico.
      if ((body as { cancelado?: boolean }).cancelado) {
        setCancelado(true);
        return;
      }
      if (!res.ok) throw new Error(body.erro ?? `HTTP ${res.status}`);
      await carregar(); // recarrega no estado "assinado"
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function baixarPdf() {
    if (!conteudoRef.current || !dados) return;
    setBaixando(true);
    try {
      await gerarPdfFolha(
        conteudoRef.current,
        dados.contrato.conteudo.estilo,
        dados.contrato.numero
      );
    } catch {
      setErro("Não foi possível gerar o PDF.");
    } finally {
      setBaixando(false);
    }
  }

  // ---- Estados de carga ----
  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">
        <Loader2 size={20} className="animate-spin mr-2" />
        Abrindo o documento…
      </div>
    );
  }
  if (cancelado) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertCircle size={28} style={{ color: "var(--danger)" }} />
        <div className="section-title">Contrato cancelado</div>
        <p className="text-sm text-muted max-w-sm">
          Este contrato foi cancelado pela agência e não está mais disponível
          para assinatura. Em caso de dúvida, fale com quem te enviou o link.
        </p>
      </div>
    );
  }
  if (erroCarga || !dados) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertCircle size={28} style={{ color: "var(--danger)" }} />
        <div className="section-title">Link inválido</div>
        <p className="text-sm text-muted max-w-sm">
          {erroCarga ?? "Não encontramos este documento."} Confira o link com
          quem te enviou.
        </p>
      </div>
    );
  }

  const { signatario, contrato } = dados;
  const assinado = signatario.status === "assinado";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-main)" }}>
      {/* Topo */}
      <div className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur px-4 py-3">
        <div className="max-w-[900px] mx-auto flex items-center gap-3 flex-wrap">
          <PenLine size={18} style={{ color: "var(--brand)" }} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-primary truncate">
              Assinatura de contrato · {contrato.numero}
            </div>
            <div className="text-xs text-muted truncate">
              {signatario.nome}
              {signatario.papel ? ` — ${signatario.papel}` : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={baixarPdf}
            disabled={baixando}
            className="btn btn-secondary text-sm"
          >
            {baixando ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            PDF
          </button>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto p-4 flex flex-col gap-4">
        {assinado && (
          <div
            className="flex items-center gap-2 rounded-md px-4 py-3 text-sm"
            style={{
              backgroundColor: "rgba(34,197,94,0.12)",
              color: "var(--success)",
            }}
          >
            <CheckCircle2 size={18} />
            <span>
              <strong>Assinado.</strong>{" "}
              {signatario.assinadoEm
                ? `Em ${dataHoraBR(signatario.assinadoEm)}.`
                : ""}{" "}
              Este link agora serve só para visualizar o contrato.
            </span>
          </div>
        )}

        {/* O contrato + relatório de assinaturas (de quem já assinou) */}
        <FolhaA4
          secoes={contrato.conteudo.secoes}
          estilo={contrato.conteudo.estilo}
          folhaRef={folhaRef}
          conteudoRef={conteudoRef}
          assinaturas={dados.assinaturas}
          numeroContrato={contrato.numero}
          verificacaoId={contrato.verificacaoId}
        />

        {/* Form de assinatura (só se ainda não assinou) */}
        {!assinado && (
          <div className="card flex flex-col gap-4">
            <div className="section-title inline-flex items-center gap-2">
              <PenLine size={16} style={{ color: "var(--brand)" }} />
              Sua assinatura
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-secondary">
                Nome do signatário
              </span>
              <div className="campo-input opacity-80">{signatario.nome}</div>
            </div>

            {signatario.exige.cpfCnpj && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-secondary">
                  CPF ou CNPJ
                </span>
                <input
                  value={documento}
                  onChange={(e) => setDocumento(mascararCpfCnpj(e.target.value))}
                  inputMode="numeric"
                  maxLength={18}
                  placeholder="000.000.000-00"
                  className="campo-input font-mono"
                />
              </label>
            )}

            {signatario.exige.otpEmail && (
              <div
                className="flex flex-col gap-2.5 rounded-lg border border-border p-3"
                style={
                  otpOk ? { backgroundColor: "rgba(34,197,94,0.08)" } : undefined
                }
              >
                <div className="flex items-center gap-2 text-sm font-medium text-secondary">
                  <MailCheck
                    size={16}
                    style={{ color: otpOk ? "var(--success)" : "var(--brand)" }}
                  />
                  Verificação de e-mail
                </div>
                {otpOk ? (
                  <div
                    className="flex items-center gap-2 text-sm"
                    style={{ color: "var(--success)" }}
                  >
                    <CheckCircle2 size={15} />
                    E-mail verificado com sucesso.
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted leading-relaxed">
                      Para assinar, confirme que este e-mail é seu:{" "}
                      <strong>{signatario.email ?? "—"}</strong>. Enviaremos um
                      código de 6 dígitos.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void enviarOtp()}
                        disabled={otpOcupado}
                        className="btn btn-secondary text-sm"
                      >
                        {otpOcupado && !otpEnviado ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <MailCheck size={14} />
                        )}
                        {otpEnviado ? "Reenviar código" : "Enviar código"}
                      </button>
                      {otpEnviado && (
                        <>
                          <input
                            value={otpCodigo}
                            onChange={(e) =>
                              setOtpCodigo(
                                e.target.value.replace(/\D/g, "").slice(0, 6)
                              )
                            }
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="000000"
                            className="campo-input font-mono w-28 text-center tracking-widest"
                          />
                          <button
                            type="button"
                            onClick={() => void verificarOtp()}
                            disabled={otpOcupado || otpCodigo.length !== 6}
                            className="btn text-sm disabled:opacity-50"
                            style={{ backgroundColor: "var(--brand)", color: "#fff" }}
                          >
                            {otpOcupado ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={14} />
                            )}
                            Confirmar
                          </button>
                        </>
                      )}
                    </div>
                    {otpMsg && (
                      <p className="text-xs" style={{ color: "var(--muted)" }}>
                        {otpMsg}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {signatario.exige.assinaturaTela && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-secondary">
                  Desenhe sua assinatura
                </span>
                <AssinaturaCanvas onChange={setAssinatura} />
              </div>
            )}

            {signatario.exige.fotoDocumento && (
              <CapturaFoto
                label="Documento (CNH ou RG) — frente"
                onChange={setFotoDocumento}
              />
            )}
            {signatario.exige.fotoDocumento && (
              <CapturaFoto
                label="Documento (CNH ou RG) — verso"
                onChange={setFotoDocumentoVerso}
              />
            )}
            {(signatario.exige.selfie || signatario.exige.facial) && (
              <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-border bg-surface-2 p-3 text-xs text-muted">
                <ScanFace
                  size={20}
                  className="flex-shrink-0"
                  style={{ color: "var(--brand)" }}
                />
                <span className="leading-relaxed">
                  Ao tocar em <strong>Assinar contrato</strong>, abriremos a
                  câmera para você tirar uma <strong>selfie ao vivo</strong> de
                  verificação
                  {signatario.exige.facial
                    ? " — comparamos com a foto do seu documento (reconhecimento facial) e registramos o resultado."
                    : "."}
                </span>
              </div>
            )}

            {erro && (
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--danger)" }}>
                <AlertCircle size={15} />
                {erro}
              </div>
            )}

            <button
              type="button"
              onClick={assinar}
              disabled={enviando}
              className="btn"
              style={{
                backgroundColor: "var(--brand)",
                color: "#fff",
                opacity: enviando ? 0.6 : 1,
              }}
            >
              {enviando ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <CheckCircle2 size={15} />
              )}
              {enviando ? "Registrando…" : "Assinar contrato"}
            </button>

            <p className="text-[0.7rem] text-muted inline-flex items-start gap-1.5 leading-relaxed">
              <ShieldCheck size={13} className="flex-shrink-0 mt-0.5" />
              Ao assinar, registramos data/hora, seu IP, dispositivo e (se você
              permitir) sua localização, como prova da assinatura. A ação é
              única — depois de assinar não dá pra refazer.
            </p>
          </div>
        )}
      </div>

      {mostrarCamera && (
        <SelfieAoVivo
          onCapturar={(dataUrl) => void enviarAssinatura(dataUrl)}
          onCancelar={() => setMostrarCamera(false)}
        />
      )}
    </div>
  );
}
