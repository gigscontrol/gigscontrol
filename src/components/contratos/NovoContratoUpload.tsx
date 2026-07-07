"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Plus, Trash2, Loader2, Check, Copy, FileSignature } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useContratos } from "@/lib/contratos-context";
import { ESTILO_PADRAO } from "@/lib/mappers/contratoModelo";
import { EXIGENCIAS_PADRAO } from "@/lib/mappers/contratoSignatario";
import { definirSignatarios, linkAssinatura } from "@/lib/contratos/signatarios-api";
import type { CampoAssinatura } from "@/lib/mappers/contrato";
import PosicionadorPdf, { type SignatarioLite } from "./PosicionadorPdf";

const CORES = ["#3D7BFF", "#22C55E", "#F59E0B", "#EC4899", "#8B5CF6", "#14B8A6"];

type PdfInfo = { path: string; nome: string; paginas: number; dims: { w: number; h: number }[] };
type LinkGerado = { nome: string; url: string };

/** Fluxo "Novo contrato por UPLOAD": sobe um PDF pronto, posiciona as
 *  assinaturas e gera os links — reusando toda a captura pública de sempre. */
export default function NovoContratoUpload() {
  const t = useT();
  const { criarContrato } = useContratos();

  const [pdf, setPdf] = useState<PdfInfo | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [nomes, setNomes] = useState<string[]>([""]);
  const [campos, setCampos] = useState<CampoAssinatura[]>([]);
  const [subindo, setSubindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [links, setLinks] = useState<LinkGerado[] | null>(null);
  const [copiado, setCopiado] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const signatarios: SignatarioLite[] = nomes.map((nome, i) => ({
    ordem: i,
    nome: nome.trim() || t("Signatário {n}", { n: i + 1 }),
    cor: CORES[i % CORES.length],
  }));

  async function onArquivo(file: File) {
    setErro(null);
    if (file.type !== "application/pdf") {
      setErro(t("Só PDF. Converta o Word/Google Docs em PDF antes de enviar."));
      return;
    }
    setSubindo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/contratos/pdf", { method: "POST", credentials: "include", body: fd });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error((body.erro as string) ?? t("Falha no upload."));
      setPdf(body as unknown as PdfInfo);
      setObjectUrl(URL.createObjectURL(file));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSubindo(false);
    }
  }

  async function criar() {
    setErro(null);
    const nomesLimpos = nomes.map((n) => n.trim()).filter(Boolean);
    if (!pdf) return;
    if (nomesLimpos.length === 0) {
      setErro(t("Adicione ao menos um signatário."));
      return;
    }
    setSalvando(true);
    try {
      const contrato = await criarContrato({
        secoes: [],
        estilo: { ...ESTILO_PADRAO },
        pdf: { ...pdf, campos },
        status: "rascunho",
      });
      const sigs = await definirSignatarios(
        contrato.id,
        nomesLimpos.map((nome) => ({
          nome,
          email: "",
          papel: "",
          exige: { ...EXIGENCIAS_PADRAO },
        }))
      );
      setLinks(
        sigs
          .sort((a, b) => a.ordem - b.ordem)
          .map((s) => ({ nome: s.nome, url: linkAssinatura(s.token) }))
      );
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  // ---- Sucesso: mostra os links ----
  if (links) {
    return (
      <div className="card flex flex-col gap-4 max-w-xl">
        <div className="flex items-center gap-2 text-success">
          <Check size={18} />
          <span className="font-semibold">{t("Contrato criado! Envie os links de assinatura:")}</span>
        </div>
        {links.map((l, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md border border-border p-2.5">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-primary truncate">{l.nome}</div>
              <div className="text-xs text-muted truncate">{l.url}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(l.url);
                setCopiado(i);
                setTimeout(() => setCopiado((v) => (v === i ? null : v)), 1500);
              }}
              className="btn btn-secondary text-xs"
            >
              {copiado === i ? <Check size={13} /> : <Copy size={13} />}
              {copiado === i ? t("Copiado") : t("Copiar")}
            </button>
          </div>
        ))}
      </div>
    );
  }

  // ---- Passo 1: upload ----
  if (!pdf || !objectUrl) {
    return (
      <div className="card flex flex-col items-center gap-3 py-10 max-w-xl text-center">
        <FileSignature size={28} style={{ color: "var(--brand)" }} />
        <div className="font-semibold text-primary">{t("Suba um PDF pronto pra coletar assinaturas")}</div>
        <p className="text-xs text-muted max-w-sm">
          {t("Você posiciona onde cada pessoa assina e a gente gera o link. Só PDF (Word/Google Docs → Salvar como PDF).")}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onArquivo(f);
            e.target.value = "";
          }}
        />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={subindo} className="btn btn-primary">
          {subindo ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {subindo ? t("Enviando…") : t("Escolher PDF")}
        </button>
        {erro && <div className="text-xs text-danger">{erro}</div>}
      </div>
    );
  }

  // ---- Passo 2: signatários + posicionamento ----
  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-col gap-3 max-w-xl">
        <div className="section-title">{t("Quem vai assinar")}</div>
        {nomes.map((nome, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: CORES[i % CORES.length] }} />
            <input
              value={nome}
              onChange={(e) => setNomes((prev) => prev.map((n, j) => (j === i ? e.target.value : n)))}
              placeholder={t("Nome do signatário {n}", { n: i + 1 })}
              className="input flex-1"
            />
            {nomes.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setNomes((prev) => prev.filter((_, j) => j !== i));
                  setCampos((prev) => prev.filter((c) => c.signatarioOrdem !== i).map((c) => (c.signatarioOrdem > i ? { ...c, signatarioOrdem: c.signatarioOrdem - 1 } : c)));
                }}
                className="btn-ghost p-1.5 rounded"
                style={{ color: "var(--danger)" }}
                aria-label={t("Remover signatário")}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        {nomes.length < CORES.length && (
          <button type="button" onClick={() => setNomes((prev) => [...prev, ""])} className="btn btn-secondary text-sm self-start">
            <Plus size={14} /> {t("Adicionar signatário")}
          </button>
        )}
      </div>

      <PosicionadorPdf
        pdfUrl={objectUrl}
        paginas={pdf.paginas}
        signatarios={signatarios}
        campos={campos}
        onChange={setCampos}
      />

      {erro && <div className="text-xs text-danger">{erro}</div>}
      <div className="flex items-center gap-3">
        <button type="button" onClick={criar} disabled={salvando} className="btn btn-primary">
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <FileSignature size={15} />}
          {salvando ? t("Criando…") : t("Criar contrato e gerar links")}
        </button>
        <span className="text-xs text-muted">
          {t("{n} campo(s) posicionado(s)", { n: campos.length })}
        </span>
      </div>
    </div>
  );
}
