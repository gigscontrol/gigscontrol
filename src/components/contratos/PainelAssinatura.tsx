"use client";

/**
 * Painel da agência para ENVIAR um contrato para assinatura (Fase 1).
 *
 * Dois modos:
 *  - DEFINIR: quando o contrato ainda não tem signatários, mostra o form que
 *    monta os signatários (pré-preenchido com contratante/contratado da venda)
 *    e gera os links públicos /assinar/{token}.
 *  - LISTA: quando já existem signatários, mostra o status de cada um (link +
 *    copiar + WhatsApp para pendentes; check + data para assinados) e permite
 *    baixar o PDF assinado quando ao menos um assinou.
 *
 * Na Fase 1 só "Assinatura na tela" e "CPF/CNPJ" são exigências ativas (sempre
 * marcadas); as demais (fotos/selfie/facial) aparecem desabilitadas "(em breve)".
 */

import { useEffect, useRef, useState } from "react";
import {
  PenLine,
  Copy,
  Check,
  CheckCircle2,
  Plus,
  Trash2,
  Download,
  MessageCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { FolhaA4, gerarPdfFolha, type AssinaturaInfo } from "./folhaA4";
import {
  buscarSignatarios,
  definirSignatarios,
  linkAssinatura,
  type EntradaSignatarioUI,
} from "@/lib/contratos/signatarios-api";
import {
  EXIGENCIAS_PADRAO,
  type Signatario,
  type ExigenciasSignatario,
} from "@/lib/mappers/contratoSignatario";
import type { Contrato } from "@/lib/mappers/contrato";
import { useVendas } from "@/lib/vendas-context";
import { useWorkspace } from "@/lib/workspace-context";

const ACCENT = "#14b8a6";

/** Linha editável do form de definição (papel é texto livre). */
type LinhaForm = {
  nome: string;
  email: string;
  papel: string;
  exige: ExigenciasSignatario;
};

/** Exigências opcionais. Foto/selfie já funcionam (Fase 2); facial é Fase 3. */
const EXIGENCIAS_OPCIONAIS: {
  chave: keyof ExigenciasSignatario;
  rotulo: string;
  disponivel: boolean;
}[] = [
  {
    chave: "fotoDocumento",
    rotulo: "Verificação de documento avançado com foto (CNH ou RG)",
    disponivel: true,
  },
  {
    chave: "facial",
    rotulo: "Verificação facial avançada (selfie)",
    disponivel: true,
  },
];

/** ISO → DD/MM/AAAA (vazio se não houver data). */
function dataBr(iso: string | null): string {
  if (!iso) return "";
  const d = iso.slice(0, 10).split("-");
  if (d.length !== 3) return iso;
  return `${d[2]}/${d[1]}/${d[0]}`;
}

/** Signatário assinado → AssinaturaInfo (para a folha/relatório). */
function paraAssinaturaInfo(s: Signatario): AssinaturaInfo {
  return {
    nome: s.nome,
    papel: s.papel,
    documento: s.documento,
    ip: s.ip,
    geolocalizacao: s.geolocalizacao,
    dispositivo: s.dispositivo,
    assinadoEm: s.assinadoEm,
    assinatura: s.assinatura,
    fotoCpfUrl: s.arquivosUrls?.fotoCpf,
    fotoDocumentoUrl: s.arquivosUrls?.fotoDocumento,
    fotoDocumentoVersoUrl: s.arquivosUrls?.fotoDocumentoVerso,
    selfieUrl: s.arquivosUrls?.selfie,
    facialSimilaridade: s.arquivos.facialSimilaridade,
    facialMatch: s.arquivos.facialMatch,
  };
}

export default function PainelAssinatura({ contrato }: { contrato: Contrato }) {
  const { vendas } = useVendas();
  const { artistas } = useWorkspace();

  const [signatarios, setSignatarios] = useState<Signatario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Modo "definir" começa indefinido; é resolvido após o carregamento inicial
  // (sem signatários → form; com signatários → lista). "Redefinir" força o form.
  const [modoDefinir, setModoDefinir] = useState(false);
  const [linhas, setLinhas] = useState<LinhaForm[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const [copiado, setCopiado] = useState<string | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  // Refs da folha oculta usada para gerar o PDF assinado.
  const folhaRef = useRef<HTMLDivElement>(null);
  const conteudoRef = useRef<HTMLDivElement>(null);

  // ---- Pré-preenchimento (contratante da venda + artista contratado) ----

  function linhasIniciais(): LinhaForm[] {
    const venda = vendas.find((v) => v.id === contrato.vendaId);
    const artista = artistas.find((a) => a.id === venda?.djId);
    return [
      {
        nome: venda?.contratanteNome ?? "",
        email: "",
        papel: "Contratante",
        exige: { ...EXIGENCIAS_PADRAO },
      },
      {
        nome: artista?.name ?? "",
        email: "",
        papel: "Contratado",
        exige: { ...EXIGENCIAS_PADRAO },
      },
    ];
  }

  // ---- Carregamento inicial ----

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setErro(null);
    buscarSignatarios(contrato.id)
      .then((lista) => {
        if (!vivo) return;
        setSignatarios(lista);
        if (lista.length === 0) {
          setLinhas(linhasIniciais());
          setModoDefinir(true);
        } else {
          setModoDefinir(false);
        }
      })
      .catch((e) => {
        if (vivo) setErro((e as Error).message || "Falha ao carregar signatários.");
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
    // Recarrega só se o contrato mudar. (linhasIniciais usa vendas/artistas,
    // mas só queremos o pré-preenchimento no carregamento/abertura do form.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contrato.id]);

  // ---- Ações do form ----

  function adicionarLinha() {
    setLinhas((prev) => [
      ...prev,
      { nome: "", email: "", papel: "", exige: { ...EXIGENCIAS_PADRAO } },
    ]);
  }

  function removerLinha(idx: number) {
    setLinhas((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  function alterarLinha(idx: number, patch: Partial<LinhaForm>) {
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function abrirRedefinir() {
    setLinhas(linhasIniciais());
    setErroForm(null);
    setModoDefinir(true);
  }

  async function gerarLinks() {
    setErroForm(null);
    if (linhas.some((l) => !l.nome.trim())) {
      setErroForm("Cada signatário precisa de um nome.");
      return;
    }
    setSalvando(true);
    try {
      // assinaturaTela + cpfCnpj sempre (do padrão); foto/selfie conforme marcado.
      const rows: EntradaSignatarioUI[] = linhas.map((l) => ({
        nome: l.nome.trim(),
        email: l.email.trim(),
        papel: l.papel.trim(),
        exige: { ...EXIGENCIAS_PADRAO, ...l.exige },
      }));
      const lista = await definirSignatarios(contrato.id, rows);
      setSignatarios(lista);
      setModoDefinir(false);
    } catch (e) {
      setErroForm((e as Error).message || "Não foi possível gerar os links.");
    } finally {
      setSalvando(false);
    }
  }

  // ---- Ações da lista ----

  async function copiar(token: string) {
    try {
      await navigator.clipboard.writeText(linkAssinatura(token));
      setCopiado(token);
      window.setTimeout(() => setCopiado((c) => (c === token ? null : c)), 1800);
    } catch {
      // clipboard pode falhar sem https/permissão — silencioso (o link fica visível).
    }
  }

  function abrirWhatsApp(token: string) {
    const texto = `Assine o contrato ${contrato.numero}: ${linkAssinatura(token)}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(texto)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function baixarPdf() {
    if (!conteudoRef.current) return;
    setGerandoPdf(true);
    try {
      await gerarPdfFolha(
        conteudoRef.current,
        contrato.conteudo.estilo,
        `${contrato.numero}-assinado`
      );
    } finally {
      setGerandoPdf(false);
    }
  }

  // ---- Derivados ----

  const assinados = signatarios.filter((s) => s.status === "assinado");
  const assinaturasFolha: AssinaturaInfo[] = assinados.map(paraAssinaturaInfo);

  // ---- Render ----

  return (
    <div
      className="card"
      style={{ borderColor: ACCENT, boxShadow: `0 0 0 1px ${ACCENT}` }}
    >
      {/* Cabeçalho */}
      <div className="flex items-start gap-3">
        <div
          className="h-10 w-10 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${ACCENT}20`, color: ACCENT }}
        >
          <PenLine size={18} />
        </div>
        <div className="min-w-0">
          <div className="section-title">Assinatura</div>
          <p className="section-subtitle mt-1">
            Defina quem assina e envie o link de assinatura para cada pessoa.
          </p>
        </div>
      </div>

      <div className="mt-5">
        {carregando ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
            <Loader2 size={16} className="animate-spin" />
            Carregando signatários...
          </div>
        ) : erro ? (
          <div className="flex items-start gap-2 rounded-md p-3 text-sm text-danger bg-elevated">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{erro}</span>
          </div>
        ) : modoDefinir ? (
          renderForm()
        ) : (
          renderLista()
        )}
      </div>

      {/* Folha A4 OCULTA off-screen — fonte do PDF assinado. */}
      <div style={{ position: "absolute", left: "-99999px", top: 0 }} aria-hidden>
        <FolhaA4
          secoes={contrato.conteudo.secoes}
          estilo={contrato.conteudo.estilo}
          folhaRef={folhaRef}
          conteudoRef={conteudoRef}
          assinaturas={assinaturasFolha}
        />
      </div>
    </div>
  );

  // ---- Sub-renders ----

  function renderForm() {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          {linhas.map((linha, idx) => (
            <div key={idx} className="rounded-md border border-border p-3 bg-elevated">
              <div className="flex items-start gap-2">
                <div className="grid flex-1 gap-2 sm:grid-cols-3">
                  <div>
                    <label className="stat-label mb-1 block">Nome</label>
                    <input
                      type="text"
                      className="campo-input"
                      value={linha.nome}
                      onChange={(e) => alterarLinha(idx, { nome: e.target.value })}
                      placeholder="Nome completo"
                    />
                  </div>
                  <div>
                    <label className="stat-label mb-1 block">E-mail</label>
                    <input
                      type="email"
                      className="campo-input"
                      value={linha.email}
                      onChange={(e) => alterarLinha(idx, { email: e.target.value })}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div>
                    <label className="stat-label mb-1 block">Papel</label>
                    <input
                      type="text"
                      className="campo-input"
                      value={linha.papel}
                      onChange={(e) => alterarLinha(idx, { papel: e.target.value })}
                      placeholder="Contratante, Testemunha..."
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removerLinha(idx)}
                  disabled={linhas.length <= 1}
                  title="Remover signatário"
                  aria-label="Remover signatário"
                  className="btn-ghost p-2 rounded hover:text-danger disabled:opacity-40 disabled:cursor-not-allowed mt-6"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Exigências */}
              <div className="mt-3">
                <div className="stat-label mb-1.5">O que será exigido</div>
                <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                  {/* Obrigatórias na Fase 1 — sempre marcadas e desabilitadas. */}
                  <label className="flex items-center gap-2 text-sm text-secondary">
                    <input type="checkbox" checked disabled readOnly />
                    Assinatura na tela
                  </label>
                  <label className="flex items-center gap-2 text-sm text-secondary">
                    <input type="checkbox" checked disabled readOnly />
                    CPF/CNPJ
                  </label>
                  {/* Foto/selfie já funcionam (Fase 2); facial é Fase 3. */}
                  {EXIGENCIAS_OPCIONAIS.map((ex) => (
                    <label
                      key={ex.chave}
                      className={`flex items-center gap-2 text-sm ${
                        ex.disponivel ? "text-secondary" : "text-muted"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={ex.disponivel ? linha.exige[ex.chave] : false}
                        disabled={!ex.disponivel}
                        onChange={(e) =>
                          ex.disponivel &&
                          alterarLinha(idx, {
                            exige: {
                              ...linha.exige,
                              [ex.chave]: e.target.checked,
                            },
                          })
                        }
                      />
                      {ex.rotulo}
                      {!ex.disponivel && (
                        <span className="text-xs opacity-70">(em breve)</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div>
          <button type="button" onClick={adicionarLinha} className="btn btn-secondary">
            <Plus size={15} />
            Adicionar signatário
          </button>
        </div>

        {erroForm && (
          <div className="flex items-start gap-2 text-sm text-danger">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{erroForm}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={gerarLinks}
            disabled={salvando}
            className="btn"
            style={{ backgroundColor: ACCENT, color: "#fff" }}
          >
            {salvando ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <PenLine size={15} />
            )}
            {salvando ? "Gerando..." : "Gerar links"}
          </button>
          {signatarios.length > 0 && (
            <button
              type="button"
              onClick={() => setModoDefinir(false)}
              disabled={salvando}
              className="btn btn-secondary"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderLista() {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          {signatarios.map((s) => (
            <div key={s.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="section-title truncate" title={s.nome}>
                    {s.nome}
                  </div>
                  {s.papel && (
                    <div className="stat-label mt-0.5">{s.papel}</div>
                  )}
                </div>
                <span
                  className={`badge ${
                    s.status === "assinado" ? "badge-success" : "badge-warning"
                  }`}
                >
                  {s.status === "assinado" ? "Assinado" : "Pendente"}
                </span>
              </div>

              {s.status === "assinado" ? (
                <div className="mt-2 flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 size={16} className="flex-shrink-0" />
                  <span>
                    assinou
                    {s.assinadoEm ? ` em ${dataBr(s.assinadoEm)}` : ""}
                  </span>
                </div>
              ) : (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={linkAssinatura(s.token)}
                    onFocus={(e) => e.currentTarget.select()}
                    className="campo-input flex-1 min-w-[200px] font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => copiar(s.token)}
                    className="btn btn-secondary"
                    title="Copiar link"
                  >
                    {copiado === s.token ? <Check size={14} /> : <Copy size={14} />}
                    {copiado === s.token ? "Copiado" : "Copiar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirWhatsApp(s.token)}
                    className="btn btn-secondary"
                    title="Enviar pelo WhatsApp"
                  >
                    <MessageCircle size={14} />
                    WhatsApp
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {assinados.length > 0 && (
            <button
              type="button"
              onClick={baixarPdf}
              disabled={gerandoPdf}
              className="btn"
              style={{ backgroundColor: ACCENT, color: "#fff" }}
            >
              {gerandoPdf ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
              {gerandoPdf ? "Gerando..." : "Baixar contrato assinado (PDF)"}
            </button>
          )}
          <button
            type="button"
            onClick={abrirRedefinir}
            className="btn btn-secondary"
            title="Substitui os links pendentes por novos signatários"
          >
            <PenLine size={14} />
            Redefinir signatários
          </button>
        </div>
      </div>
    );
  }
}
