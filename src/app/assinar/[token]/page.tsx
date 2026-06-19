"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  Download,
  PenLine,
  ShieldCheck,
} from "lucide-react";
import { FolhaA4, gerarPdfFolha } from "@/components/contratos/folhaA4";
import AssinaturaCanvas from "@/components/contratos/AssinaturaCanvas";
import CapturaFoto from "@/components/contratos/CapturaFoto";
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
  };
  contrato: {
    numero: string;
    conteudo: { secoes: SecaoModelo[]; estilo: EstiloModelo };
  };
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

  const [documento, setDocumento] = useState("");
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [fotoDocumento, setFotoDocumento] = useState<string | null>(null);
  const [fotoDocumentoVerso, setFotoDocumentoVerso] = useState<string | null>(
    null
  );
  const [selfie, setSelfie] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);

  const folhaRef = useRef<HTMLDivElement>(null);
  const conteudoRef = useRef<HTMLDivElement>(null);

  async function carregar() {
    setCarregando(true);
    setErroCarga(null);
    try {
      const res = await fetch(`/api/assinar/${params.token}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.erro ?? `HTTP ${res.status}`);
      setDados(body as Dados);
      if ((body as Dados).signatario.documento)
        setDocumento((body as Dados).signatario.documento ?? "");
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

  async function assinar() {
    if (!dados) return;
    const ex = dados.signatario.exige;
    if (ex.cpfCnpj && !documento.trim()) {
      setErro("Informe seu CPF ou CNPJ.");
      return;
    }
    if (ex.assinaturaTela && !assinatura) {
      setErro("Desenhe sua assinatura no quadro.");
      return;
    }
    if ((ex.fotoDocumento || ex.facial) && !fotoDocumento) {
      setErro("Envie a foto da frente do seu documento (CNH ou RG).");
      return;
    }
    if (ex.fotoDocumento && !fotoDocumentoVerso) {
      setErro("Envie a foto do verso do seu documento (CNH ou RG).");
      return;
    }
    if ((ex.selfie || ex.facial) && !selfie) {
      setErro("Envie a selfie.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const geolocalizacao = await pegarGeo();
      const res = await fetch(`/api/assinar/${params.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assinatura: assinatura ?? "",
          documento,
          geolocalizacao,
          fotoDocumento: fotoDocumento ?? "",
          fotoDocumentoVerso: fotoDocumentoVerso ?? "",
          selfie: selfie ?? "",
        }),
      });
      const body = await res.json().catch(() => ({}));
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
          <PenLine size={18} style={{ color: "var(--module-contratos)" }} />
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

        {/* O contrato */}
        <FolhaA4
          secoes={contrato.conteudo.secoes}
          estilo={contrato.conteudo.estilo}
          folhaRef={folhaRef}
          conteudoRef={conteudoRef}
        />

        {/* Form de assinatura (só se ainda não assinou) */}
        {!assinado && (
          <div className="card flex flex-col gap-4">
            <div className="section-title inline-flex items-center gap-2">
              <PenLine size={16} style={{ color: "var(--module-contratos)" }} />
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
                  onChange={(e) => setDocumento(e.target.value)}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  className="campo-input font-mono"
                />
              </label>
            )}

            {signatario.exige.assinaturaTela && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-secondary">
                  Desenhe sua assinatura
                </span>
                <AssinaturaCanvas onChange={setAssinatura} />
              </div>
            )}

            {(signatario.exige.fotoDocumento || signatario.exige.facial) && (
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
              <CapturaFoto label="Selfie" onChange={setSelfie} selfie />
            )}
            {signatario.exige.facial && (
              <p className="text-xs text-muted inline-flex items-start gap-1.5 leading-relaxed">
                <ShieldCheck size={13} className="flex-shrink-0 mt-0.5" />
                Ao assinar, comparamos sua selfie com a foto do documento
                (reconhecimento facial) e registramos o resultado.
              </p>
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
                backgroundColor: "var(--module-contratos)",
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
    </div>
  );
}
