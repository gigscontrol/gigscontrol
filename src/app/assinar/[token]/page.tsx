"use client";

/**
 * Página PÚBLICA de assinatura (padrão ZapSign):
 *  - Header: painel "Assinaturas X/Y" + download à esquerda; marca à direita.
 *  - Etapa DOCUMENTO: contrato com zoom (+/−) e barra fixa "Continuar".
 *  - Etapa FORM: identificação + exigências (CPF avançado, fotos, selfie…).
 *  - Etapa CÓDIGO (exigência de e-mail): a assinatura fica PENDENTE até a
 *    pessoa digitar o código de 6 dígitos OU clicar no botão do e-mail
 *    (válidos por 30 min). Só então conta como assinada.
 */

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
  ChevronDown,
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  Clock,
} from "lucide-react";
import { FolhaA4, gerarPdfFolha, type AssinaturaInfo } from "@/components/contratos/folhaA4";
import AssinaturaCanvas from "@/components/contratos/AssinaturaCanvas";
import CapturaFoto from "@/components/contratos/CapturaFoto";
import SelfieAoVivo from "@/components/contratos/SelfieAoVivo";
import { documentoValido } from "@/lib/documento";
import { cpfValido } from "@/lib/pix";
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
    /** Assinatura submetida aguardando código/botão do e-mail (30 min). */
    aguardandoConfirmacao?: boolean;
    confirmacaoExpiraEm?: string | null;
  };
  contrato: {
    numero: string;
    conteudo: { secoes: SecaoModelo[]; estilo: EstiloModelo };
    verificacaoId?: string | null;
    conteudoHash?: string | null;
  };
  /** Signatários que já assinaram (relatório, sem KYC). */
  assinaturas: AssinaturaInfo[];
  /** TODOS os signatários (nome/papel/status) — painel "Assinaturas X/Y". */
  signatariosResumo?: { nome: string; papel: string | null; status: string }[];
  jaAssinou: boolean;
};

type Etapa = "documento" | "form" | "codigo";

function dataHoraBR(iso: string | null): string {
  if (!iso) return "";
  // Convertido pro fuso LOCAL de quem vê, com o GMT explícito (o banco grava
  // em UTC — fatiar a string ISO mostrava 3h a mais no Brasil).
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset() / 60;
  const gmt = `GMT${off >= 0 ? "+" : ""}${off}`;
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())} (${gmt})`;
}

const ZOOMS = [0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.5];

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

  const [etapa, setEtapa] = useState<Etapa>("documento");
  const [zoomIdx, setZoomIdx] = useState(4); // 100%
  const [painelAberto, setPainelAberto] = useState(false);

  const [documento, setDocumento] = useState("");
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [fotoDocumento, setFotoDocumento] = useState<string | null>(null);
  const [fotoDocumentoVerso, setFotoDocumentoVerso] = useState<string | null>(
    null
  );
  const [mostrarCamera, setMostrarCamera] = useState(false);
  // Consentimento ESPECÍFICO pro tratamento biométrico (LGPD art. 11) —
  // exigido quando a assinatura pede selfie/reconhecimento facial.
  const [consenteBiometria, setConsenteBiometria] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);

  // Etapa CÓDIGO (confirmação por e-mail da assinatura pendente).
  const [otpCodigo, setOtpCodigo] = useState("");
  const [otpOcupado, setOtpOcupado] = useState(false);
  const [otpMsg, setOtpMsg] = useState<string | null>(null);
  const [otpExpirado, setOtpExpirado] = useState(false);

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
      const d = body as Dados;
      setDados(d);
      if (d.signatario.documento)
        setDocumento(mascararCpfCnpj(d.signatario.documento ?? ""));
      // Assinatura pendente de confirmação → reabre direto na tela do código
      // (a pessoa pode ter fechado a página pra buscar o e-mail).
      if (d.signatario.status !== "assinado" && d.signatario.aguardandoConfirmacao) {
        setEtapa("codigo");
      }
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
          // Volta pra etapa do documento — é onde o banner verde "Assinado"
          // aparece (ficar no form deixava a página em branco no desktop).
          setEtapa("documento");
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
  function assinar() {
    if (!dados) return;
    const ex = dados.signatario.exige;
    if (ex.cpfAvancado) {
      if (nomeCompleto.trim().split(/\s+/).length < 2) {
        setErro("Informe seu nome completo (nome e sobrenome).");
        return;
      }
      if (!dataNascimento) {
        setErro("Informe sua data de nascimento.");
        return;
      }
      if (!cpfValido(documento)) {
        setErro("CPF inválido — confira os 11 dígitos.");
        return;
      }
    } else if (ex.cpfCnpj) {
      if (!documento.trim()) {
        setErro("Informe seu CPF ou CNPJ.");
        return;
      }
      if (!documentoValido(documento)) {
        setErro("Documento inválido: informe um CPF (11 dígitos) ou CNPJ (14 dígitos).");
        return;
      }
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
    if ((ex.selfie || ex.facial) && !consenteBiometria) {
      setErro(
        "Para continuar, autorize o uso da sua imagem na verificação de identidade (caixa acima do botão)."
      );
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
          nomeCompleto,
          dataNascimento,
          fotoDocumento: fotoDocumento ?? "",
          fotoDocumentoVerso: fotoDocumentoVerso ?? "",
          selfie: selfie ?? "",
          consentimentoBiometria: consenteBiometria,
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
      if ((body as { aguardandoConfirmacao?: boolean }).aguardandoConfirmacao) {
        // Assinatura PENDENTE: falta o código/botão do e-mail.
        setOtpMsg(null);
        setOtpExpirado(false);
        setOtpCodigo("");
        setEtapa("codigo");
        return;
      }
      await carregar(); // recarrega no estado "assinado"
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarCodigo() {
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
      const body = (await res.json().catch(() => ({}))) as {
        assinado?: boolean;
        erro?: string;
        expirado?: boolean;
        cancelado?: boolean;
      };
      // A agência cancelou o contrato enquanto a confirmação estava pendente.
      if (body.cancelado) {
        setCancelado(true);
        return;
      }
      if (body.expirado) {
        setOtpExpirado(true);
        setOtpMsg(body.erro ?? "O prazo expirou — assine novamente.");
        return;
      }
      if (!res.ok) throw new Error(body.erro ?? `HTTP ${res.status}`);
      if (body.assinado) {
        setEtapa("documento");
        await carregar();
      }
    } catch (e) {
      setOtpMsg((e as Error).message);
    } finally {
      setOtpOcupado(false);
    }
  }

  async function reenviarCodigo() {
    setOtpOcupado(true);
    setOtpMsg(null);
    try {
      const res = await fetch(`/api/assinar/${params.token}/otp`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if ((body as { cancelado?: boolean }).cancelado) {
        setCancelado(true);
        return;
      }
      if (!res.ok) throw new Error(body.erro ?? `HTTP ${res.status}`);
      setOtpExpirado(false);
      setOtpMsg("Código reenviado! Confira sua caixa de entrada (e o spam).");
    } catch (e) {
      setOtpMsg((e as Error).message);
    } finally {
      setOtpOcupado(false);
    }
  }

  async function baixarPdf() {
    if (!conteudoRef.current || !dados) return;
    setBaixando(true);
    try {
      await gerarPdfFolha(
        conteudoRef.current,
        dados.contrato.conteudo.estilo,
        dados.contrato.numero,
        { verificacaoId: dados.contrato.verificacaoId }
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
  const resumo = dados.signatariosResumo ?? [];
  const totalAssinados = resumo.filter((s) => s.status === "assinado").length;
  const zoom = ZOOMS[zoomIdx];
  const pendente = !assinado;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-main)" }}>
      {/* ===== Header: Assinaturas X/Y + download (esq) · marca (dir) ===== */}
      <div className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur px-4 py-2.5">
        <div className="max-w-[1000px] mx-auto flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setPainelAberto((a) => !a)}
              className="btn btn-secondary text-sm"
              aria-expanded={painelAberto}
            >
              Assinaturas {totalAssinados}/{resumo.length || 1}
              <ChevronDown
                size={14}
                style={{
                  transform: painelAberto ? "rotate(180deg)" : undefined,
                  transition: "transform .15s",
                }}
              />
            </button>
            {painelAberto && (
              <div
                className="absolute left-0 top-full mt-1 z-40 w-[280px] rounded-lg border p-2 shadow-lg flex flex-col gap-1.5"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  borderColor: "var(--border-color)",
                }}
              >
                <div className="stat-label px-1">Assinaturas</div>
                {resumo.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-border px-3 py-2"
                  >
                    <span
                      className={`badge ${
                        s.status === "assinado" ? "badge-success" : "badge-warning"
                      } mb-1`}
                    >
                      {s.status === "assinado" ? "Assinado" : "Em curso"}
                    </span>
                    <div className="text-sm text-primary truncate" title={s.nome}>
                      {s.nome}
                    </div>
                    {s.papel && (
                      <div className="text-xs text-muted">{s.papel}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={baixarPdf}
            disabled={baixando}
            title="Baixar PDF"
            aria-label="Baixar PDF"
            className="btn-ghost p-2 rounded"
          >
            {baixando ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
          </button>

          <div className="flex-1 min-w-0 text-center text-xs text-muted truncate hidden sm:block">
            {contrato.numero} · {signatario.nome}
          </div>

          <div
            className="ml-auto text-sm font-extrabold whitespace-nowrap"
            style={{ letterSpacing: "0.14em", color: "var(--text-primary)" }}
          >
            GIGS CONTROL
          </div>
        </div>
      </div>

      {/* ===== Etapa DOCUMENTO ===== */}
      {etapa === "documento" && (
        <div className="max-w-[1000px] mx-auto p-4 flex flex-col gap-3 pb-24">
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

          {/* Zoom centralizado sobre o documento */}
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
              disabled={zoomIdx === 0}
              title="Diminuir zoom"
              aria-label="Diminuir zoom"
              className="btn btn-secondary p-2 disabled:opacity-40"
            >
              <ZoomOut size={15} />
            </button>
            <span className="text-xs text-muted w-12 text-center tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomIdx((i) => Math.min(ZOOMS.length - 1, i + 1))}
              disabled={zoomIdx === ZOOMS.length - 1}
              title="Aumentar zoom"
              aria-label="Aumentar zoom"
              className="btn btn-secondary p-2 disabled:opacity-40"
            >
              <ZoomIn size={15} />
            </button>
          </div>

          {/* O contrato + relatório de assinaturas (de quem já assinou) */}
          <div style={{ zoom }}>
            <FolhaA4
              secoes={contrato.conteudo.secoes}
              estilo={contrato.conteudo.estilo}
              folhaRef={folhaRef}
              conteudoRef={conteudoRef}
              assinaturas={dados.assinaturas}
              numeroContrato={contrato.numero}
              verificacaoId={contrato.verificacaoId}
              conteudoHash={contrato.conteudoHash}
            />
          </div>
        </div>
      )}

      {/* ===== Etapa FORM ===== */}
      {etapa === "form" && !assinado && (
        <div className="max-w-[640px] mx-auto p-4 flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setEtapa("documento")}
            className="btn btn-ghost self-start"
          >
            <ArrowLeft size={15} />
            Voltar ao documento
          </button>

          <div className="card flex flex-col gap-4">
            <div className="section-title inline-flex items-center gap-2">
              <PenLine size={16} style={{ color: "var(--brand)" }} />
              Confirme sua identidade para assinar
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-secondary">
                Nome do signatário
              </span>
              <div className="campo-input opacity-80">{signatario.nome}</div>
            </div>

            {signatario.exige.cpfAvancado ? (
              <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                <div className="text-sm font-medium text-secondary inline-flex items-center gap-2">
                  <ShieldCheck size={15} style={{ color: "var(--brand)" }} />
                  Verificação de CPF avançada
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-secondary">
                    Nome completo
                  </span>
                  <input
                    value={nomeCompleto}
                    onChange={(e) => setNomeCompleto(e.target.value)}
                    placeholder="Como está no seu documento"
                    className="campo-input"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-secondary">CPF</span>
                  <input
                    value={documento}
                    onChange={(e) => setDocumento(mascararCpfCnpj(e.target.value))}
                    inputMode="numeric"
                    maxLength={14}
                    placeholder="000.000.000-00"
                    className="campo-input font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-secondary">
                    Data de nascimento
                  </span>
                  <input
                    type="date"
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                    className="campo-input"
                  />
                </label>
              </div>
            ) : (
              signatario.exige.cpfCnpj && (
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
              )
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
                    : "."}{" "}
                  No computador, você pode continuar pelo celular via QR code.
                </span>
              </div>
            )}
            {(signatario.exige.selfie || signatario.exige.facial) && (
              <label className="flex items-start gap-2.5 text-xs text-muted leading-relaxed cursor-pointer">
                <input
                  type="checkbox"
                  checked={consenteBiometria}
                  onChange={(e) => setConsenteBiometria(e.target.checked)}
                  className="mt-0.5 flex-shrink-0"
                />
                <span>
                  Autorizo o uso da minha <strong>imagem</strong> (selfie
                  {signatario.exige.facial
                    ? " e comparação com a foto do meu documento"
                    : ""}
                  ) para a verificação de identidade desta assinatura, como
                  prova de autoria do documento (LGPD, art. 11). As imagens
                  ficam guardadas junto ao contrato, acessíveis só à agência.
                </span>
              </label>
            )}

            {signatario.exige.otpEmail && (
              <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-border bg-surface-2 p-3 text-xs text-muted">
                <MailCheck
                  size={18}
                  className="flex-shrink-0"
                  style={{ color: "var(--brand)" }}
                />
                <span className="leading-relaxed">
                  Após assinar, enviaremos um <strong>código de 6 dígitos</strong>{" "}
                  para <strong>{signatario.email ?? "seu e-mail"}</strong> — a
                  assinatura só é concluída com a confirmação (válida por 30
                  minutos).
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
              <span>
                Ao assinar, você aceita assinar eletronicamente este documento
                (art. 10, §2º, da MP 2.200-2/2001). Como prova da assinatura,
                registramos: data/hora, seu IP, dispositivo, fuso horário e (se
                você permitir) sua localização
                {signatario.exige.fotoDocumento || signatario.exige.fotoCpf
                  ? ", além das fotos de documento enviadas"
                  : ""}
                {signatario.exige.selfie || signatario.exige.facial
                  ? `, da selfie${signatario.exige.facial ? " e do resultado da verificação facial" : ""}`
                  : ""}
                {signatario.exige.cpfAvancado
                  ? ", e dos dados informados (nome completo, CPF e data de nascimento)"
                  : ""}
                . Esses registros ficam guardados com o contrato enquanto ele
                servir de prova, acessíveis à agência responsável. A ação é
                única — depois de concluída não dá pra refazer.
              </span>
            </p>
          </div>
        </div>
      )}

      {/* ===== Etapa CÓDIGO (confirmação por e-mail) ===== */}
      {etapa === "codigo" && !assinado && (
        <div className="max-w-[480px] mx-auto p-4 pt-10">
          <div className="card flex flex-col items-center text-center gap-4 py-8">
            {otpExpirado ? (
              <>
                <Clock size={30} style={{ color: "var(--warning)" }} />
                <div className="section-title">Prazo expirado</div>
                <p className="text-sm text-muted max-w-sm">
                  O código venceu (validade de 30 minutos) e a assinatura não
                  foi concluída. Sem problema: é só assinar novamente — um novo
                  código será enviado.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOtpExpirado(false);
                    setOtpMsg(null);
                    setEtapa("form");
                  }}
                  className="btn"
                  style={{ backgroundColor: "var(--brand)", color: "#fff" }}
                >
                  <PenLine size={15} />
                  Assinar novamente
                </button>
              </>
            ) : (
              <>
                <MailCheck size={30} style={{ color: "var(--brand)" }} />
                <div className="section-title">Confirme seu e-mail</div>
                <p className="text-sm text-muted max-w-sm">
                  Sua assinatura foi registrada e está <strong>aguardando
                  confirmação</strong>. Enviamos um código de 6 dígitos para{" "}
                  <strong>{signatario.email ?? "seu e-mail"}</strong> — ele vale
                  por 30 minutos.
                </p>
                <input
                  value={otpCodigo}
                  onChange={(e) =>
                    setOtpCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  autoFocus
                  className="campo-input font-mono w-44 text-center text-2xl tracking-[0.4em]"
                />
                <button
                  type="button"
                  onClick={() => void confirmarCodigo()}
                  disabled={otpOcupado || otpCodigo.length !== 6}
                  className="btn w-44 disabled:opacity-50"
                  style={{ backgroundColor: "var(--brand)", color: "#fff" }}
                >
                  {otpOcupado ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={15} />
                  )}
                  Confirmar
                </button>
                {otpMsg && (
                  <p className="text-xs max-w-sm" style={{ color: "var(--muted, var(--text-muted))" }}>
                    {otpMsg}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void reenviarCodigo()}
                  disabled={otpOcupado}
                  className="btn-ghost text-xs"
                  style={{ color: "var(--brand)" }}
                >
                  Reenviar código
                </button>
                <p className="text-[0.7rem] text-muted max-w-sm leading-relaxed">
                  Dica: o e-mail também traz o botão{" "}
                  <strong>“Concluir assinatura”</strong> — clicar nele confirma
                  tudo sem digitar o código.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== Barra fixa "Continuar" (etapa documento, pendente) ===== */}
      {etapa === "documento" && pendente && !signatario.aguardandoConfirmacao && (
        <div
          className="fixed bottom-0 inset-x-0 z-30 border-t border-border px-4 py-3"
          style={{ backgroundColor: "var(--bg-surface)" }}
        >
          <div className="max-w-[1000px] mx-auto flex justify-end">
            <button
              type="button"
              onClick={() => setEtapa("form")}
              className="btn w-full sm:w-auto sm:min-w-[220px] justify-center"
              style={{ backgroundColor: "var(--brand)", color: "#fff" }}
            >
              Continuar
            </button>
          </div>
        </div>
      )}
      {etapa === "documento" && pendente && signatario.aguardandoConfirmacao && (
        <div
          className="fixed bottom-0 inset-x-0 z-30 border-t border-border px-4 py-3"
          style={{ backgroundColor: "var(--bg-surface)" }}
        >
          <div className="max-w-[1000px] mx-auto flex justify-end">
            <button
              type="button"
              onClick={() => setEtapa("codigo")}
              className="btn w-full sm:w-auto sm:min-w-[220px] justify-center"
              style={{ backgroundColor: "var(--brand)", color: "#fff" }}
            >
              <MailCheck size={15} />
              Digitar o código do e-mail
            </button>
          </div>
        </div>
      )}

      {mostrarCamera && (
        <SelfieAoVivo
          onCapturar={(dataUrl) => void enviarAssinatura(dataUrl)}
          onCancelar={() => setMostrarCamera(false)}
        />
      )}
    </div>
  );
}
