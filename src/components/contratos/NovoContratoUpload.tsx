"use client";

import { useEffect, useRef, useState } from "react";
import {
  Upload,
  Plus,
  Trash2,
  Loader2,
  Check,
  Copy,
  FileSignature,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { useContratos } from "@/lib/contratos-context";
import { ESTILO_PADRAO } from "@/lib/mappers/contratoModelo";
import {
  EXIGENCIAS_PADRAO,
  type ExigenciasSignatario,
} from "@/lib/mappers/contratoSignatario";
import { definirSignatarios, linkAssinatura } from "@/lib/contratos/signatarios-api";
import type { CampoAssinatura } from "@/lib/mappers/contrato";
import PosicionadorPdf, { type SignatarioLite } from "./PosicionadorPdf";

const CORES = ["#3D7BFF", "#22C55E", "#F59E0B", "#EC4899", "#8B5CF6", "#14B8A6"];

/** Meio de autenticação opcional por signatário (além da assinatura + CPF, que
 *  são sempre exigidos). Mesmas chaves do fluxo de modelo. */
const AUTENTICACAO: { chave: keyof ExigenciasSignatario; rotulo: string }[] = [
  { chave: "fotoDocumento", rotulo: "Verificação de documento avançado com foto (CNH ou RG)" },
  { chave: "facial", rotulo: "Verificação facial avançada (selfie)" },
];

type PdfInfo = { path: string; nome: string; paginas: number; dims: { w: number; h: number }[] };
type LinkGerado = { nome: string; url: string };
type SigForm = { nome: string; email: string; papel: string; exige: ExigenciasSignatario };
const novoSig = (): SigForm => ({ nome: "", email: "", papel: "", exige: { ...EXIGENCIAS_PADRAO } });

/**
 * Fluxo "Novo contrato por UPLOAD" (wizard):
 *  1. Upload do PDF pronto.
 *  2. Definir signatários + meio de autenticação → avançar.
 *  3. Posicionar as assinaturas (escolhe o signatário, clica no documento).
 *  4. Gerar os links (avisa se algum signatário ficou sem assinatura posicionada).
 * Reusa 100% a captura pública de sempre.
 */
export default function NovoContratoUpload() {
  const t = useT();
  const { criarContrato } = useContratos();

  const [pdf, setPdf] = useState<PdfInfo | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<"sig" | "pos">("sig");
  const [sigs, setSigs] = useState<SigForm[]>([novoSig()]);
  const [campos, setCampos] = useState<CampoAssinatura[]>([]);
  const [subindo, setSubindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [links, setLinks] = useState<LinkGerado[] | null>(null);
  const [copiado, setCopiado] = useState<number | null>(null);
  // Nomes dos signatários sem campo posicionado (aviso antes de gerar).
  const [aviso, setAviso] = useState<string[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const signatariosLite: SignatarioLite[] = sigs.map((s, i) => ({
    ordem: i,
    nome: s.nome.trim() || t("Signatário {n}", { n: i + 1 }),
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

  function avancar() {
    setErro(null);
    if (sigs.some((s) => !s.nome.trim())) {
      setErro(t("Dê um nome a todos os signatários."));
      return;
    }
    setEtapa("pos");
  }

  async function criar(forcar = false) {
    setErro(null);
    setAviso(null);
    if (!pdf) return;
    // Signatários sem NENHUM campo posicionado — avisa antes de gerar.
    const semCampo = sigs
      .map((s, i) => ({ nome: s.nome.trim(), ordem: i }))
      .filter((s) => !campos.some((c) => c.signatarioOrdem === s.ordem))
      .map((s) => s.nome);
    if (semCampo.length > 0 && !forcar) {
      setAviso(semCampo);
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
      const criados = await definirSignatarios(
        contrato.id,
        sigs.map((s) => ({
          nome: s.nome.trim(),
          email: s.email.trim(),
          papel: s.papel.trim(),
          exige: s.exige,
        }))
      );
      setLinks(
        criados
          .sort((a, b) => a.ordem - b.ordem)
          .map((s) => ({ nome: s.nome, url: linkAssinatura(s.token) }))
      );
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  // ---------- Sucesso: links ----------
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

  // ---------- Passo 1: upload ----------
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

  // ---------- Passo 2: signatários + autenticação ----------
  if (etapa === "sig") {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-sm text-muted">
          {t("PDF")}: <span className="text-primary font-medium">{pdf.nome}</span> ({pdf.paginas} {t("páginas")})
        </div>
        <div className="card flex flex-col gap-4">
          <div>
            <div className="section-title">{t("Quem vai assinar")}</div>
            <p className="text-xs text-muted">
              {t("Todos assinam na tela e informam CPF/CNPJ. Marque abaixo se quer exigir mais autenticação de cada um.")}
            </p>
          </div>
          {sigs.map((s, i) => (
            <div
              key={i}
              className="rounded-md border border-border bg-elevated p-3"
              style={{ borderLeft: `3px solid ${CORES[i % CORES.length]}` }}
            >
              <div className="flex items-start gap-2">
                <div className="grid flex-1 gap-2 sm:grid-cols-3">
                  <div>
                    <label className="stat-label mb-1 block">{t("Nome")}</label>
                    <input
                      type="text"
                      className="campo-input"
                      value={s.nome}
                      onChange={(e) => setSigs((p) => p.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))}
                      placeholder={t("Nome completo")}
                    />
                  </div>
                  <div>
                    <label className="stat-label mb-1 block">{t("E-mail")}</label>
                    <input
                      type="email"
                      className="campo-input"
                      value={s.email}
                      onChange={(e) => setSigs((p) => p.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))}
                      placeholder={t("email@exemplo.com")}
                    />
                  </div>
                  <div>
                    <label className="stat-label mb-1 block">{t("Papel")}</label>
                    <input
                      type="text"
                      className="campo-input"
                      value={s.papel}
                      onChange={(e) => setSigs((p) => p.map((x, j) => (j === i ? { ...x, papel: e.target.value } : x)))}
                      placeholder={t("Contratante, Testemunha...")}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSigs((p) => p.filter((_, j) => j !== i));
                    // Reindexa os campos: remove os do i e desloca os de ordem > i.
                    setCampos((p) =>
                      p
                        .filter((c) => c.signatarioOrdem !== i)
                        .map((c) => (c.signatarioOrdem > i ? { ...c, signatarioOrdem: c.signatarioOrdem - 1 } : c))
                    );
                  }}
                  disabled={sigs.length <= 1}
                  title={t("Remover signatário")}
                  aria-label={t("Remover signatário")}
                  className="btn-ghost mt-6 rounded p-2 hover:text-danger disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {/* O que será exigido */}
              <div className="mt-3">
                <div className="stat-label mb-1.5">{t("O que será exigido")}</div>
                <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm text-secondary">
                    <input type="checkbox" checked disabled readOnly />
                    {t("Assinatura na tela")}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-secondary">
                    <input type="checkbox" checked disabled readOnly />
                    {t("CPF/CNPJ")}
                  </label>
                  {AUTENTICACAO.map((a) => (
                    <label key={a.chave} className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!s.exige[a.chave]}
                        onChange={(e) =>
                          setSigs((p) =>
                            p.map((x, j) => (j === i ? { ...x, exige: { ...x.exige, [a.chave]: e.target.checked } } : x))
                          )
                        }
                      />
                      {t(a.rotulo)}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {sigs.length < CORES.length && (
            <button
              type="button"
              onClick={() => setSigs((p) => [...p, novoSig()])}
              className="btn btn-secondary text-sm self-start"
            >
              <Plus size={14} /> {t("Adicionar signatário")}
            </button>
          )}
        </div>
        {erro && <div className="text-xs text-danger">{erro}</div>}
        <button type="button" onClick={avancar} className="btn btn-primary self-start">
          {t("Avançar — posicionar assinaturas")} <ArrowRight size={15} />
        </button>
      </div>
    );
  }

  // ---------- Passo 3: posicionar ----------
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setEtapa("sig")} className="btn btn-secondary text-sm">
          <ArrowLeft size={14} /> {t("Voltar aos signatários")}
        </button>
        <span className="text-xs text-muted">
          {t("{n} campo(s) posicionado(s)", { n: campos.length })}
        </span>
      </div>

      <PosicionadorPdf
        pdfUrl={objectUrl}
        paginas={pdf.paginas}
        signatarios={signatariosLite}
        campos={campos}
        onChange={setCampos}
      />

      {/* Aviso: algum signatário sem campo posicionado */}
      {aviso && aviso.length > 0 && (
        <div
          className="flex items-start gap-2 rounded-md p-3 text-sm"
          style={{ backgroundColor: "rgba(245,158,11,0.1)", color: "var(--warning)" }}
        >
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium">
              {t("Sem assinatura posicionada: {nomes}", { nomes: aviso.join(", ") })}
            </div>
            <div className="text-xs mt-0.5 opacity-90">
              {t("Esses signatários vão receber o link, mas a assinatura deles não será carimbada em lugar nenhum. Quer gerar assim mesmo?")}
            </div>
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setAviso(null)} className="btn btn-secondary text-xs">
                {t("Voltar e posicionar")}
              </button>
              <button type="button" onClick={() => criar(true)} disabled={salvando} className="btn btn-primary text-xs">
                {t("Gerar assim mesmo")}
              </button>
            </div>
          </div>
        </div>
      )}

      {erro && <div className="text-xs text-danger">{erro}</div>}
      {!aviso && (
        <button type="button" onClick={() => criar(false)} disabled={salvando} className="btn btn-primary self-start">
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <FileSignature size={15} />}
          {salvando ? t("Criando…") : t("Criar contrato e gerar links")}
        </button>
      )}
    </div>
  );
}
