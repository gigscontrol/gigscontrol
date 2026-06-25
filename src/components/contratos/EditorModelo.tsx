"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from "react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Save,
  X,
  Heading,
  Users,
  ListOrdered,
  PenLine,
  Paperclip,
  Download,
  Palette,
} from "lucide-react";
import { useModelos } from "@/lib/modelos-context";
import { useT } from "@/lib/i18n";
import ColorPicker from "../ColorPicker";
import type {
  SecaoModelo,
  ItemClausula,
  EstiloModelo,
} from "@/lib/mappers/contratoModelo";
import { estiloParaCorpo } from "@/lib/mappers/contratoModelo";
import { calcularNumeracao } from "@/lib/contratos/numeracao";
import {
  VARIAVEIS_CONTRATO,
  VALORES_EXEMPLO,
  preencher,
  type VariavelContrato,
} from "@/lib/contratos/variaveis";

const ACCENT = "#14b8a6";

type Props = {
  /** Quando presente, o editor atualiza um modelo existente; senão cria um novo. */
  modeloId?: string | null;
  nomeInicial: string;
  secoesIniciais: SecaoModelo[];
  estiloInicial: EstiloModelo;
  onVoltar: () => void;
  onSalvo: () => void;
};

/** Tipos de seção que o usuário pode adicionar, na ordem do menu. */
type TipoSecao = SecaoModelo["tipo"];

const TIPOS_SECAO: { tipo: TipoSecao; label: string; Icon: typeof Heading }[] = [
  { tipo: "titulo", label: "Título", Icon: Heading },
  { tipo: "partes", label: "Das partes", Icon: Users },
  { tipo: "clausula", label: "Cláusula", Icon: ListOrdered },
  { tipo: "assinaturas", label: "Assinaturas", Icon: PenLine },
  { tipo: "anexo", label: "Anexo", Icon: Paperclip },
];

/** Cria uma seção vazia do tipo pedido (com ids novos). */
function novaSecao(tipo: TipoSecao): SecaoModelo {
  const id = crypto.randomUUID();
  switch (tipo) {
    case "titulo":
      return { id, tipo: "titulo", titulo: "", subtitulo: "" };
    case "partes":
      return { id, tipo: "partes", contratante: "", contratado: "", paragrafo: "" };
    case "clausula":
      return {
        id,
        tipo: "clausula",
        titulo: "",
        itens: [{ id: crypto.randomUUID(), tipo: "subclausula", texto: "" }],
      };
    case "assinaturas":
      return { id, tipo: "assinaturas", testemunhas: [] };
    case "anexo":
      return { id, tipo: "anexo", titulo: "", conteudo: "" };
  }
}

/**
 * Campo editável de texto. Identifica exatamente qual string do estado um
 * input/textarea edita, para inserir variáveis no ponto do cursor.
 */
/** Campos de string de seção (sem os itens de cláusula). */
type CampoTextoSimples =
  | "titulo"
  | "subtitulo"
  | "contratante"
  | "contratado"
  | "paragrafo"
  | "conteudo";

/** Qualquer campo editável: os simples acima OU um item de cláusula. */
type CampoTexto = CampoTextoSimples | "item";

type Descritor = { secaoId: string; campo: CampoTexto; itemId?: string };

/** Chave única (estável) de um campo editável, para indexar o ref do DOM. */
function chaveCampo(d: Descritor): string {
  return d.campo === "item"
    ? `${d.secaoId}:item:${d.itemId}`
    : `${d.secaoId}:${d.campo}`;
}

/**
 * Agrupa as variáveis por `grupo`, preservando a ordem em que aparecem em
 * VARIAVEIS_CONTRATO (tanto a ordem dos grupos quanto a das variáveis dentro
 * de cada grupo).
 */
function agruparVariaveis(): { grupo: string; itens: VariavelContrato[] }[] {
  const grupos: { grupo: string; itens: VariavelContrato[] }[] = [];
  for (const v of VARIAVEIS_CONTRATO) {
    let bucket = grupos.find((g) => g.grupo === v.grupo);
    if (!bucket) {
      bucket = { grupo: v.grupo, itens: [] };
      grupos.push(bucket);
    }
    bucket.itens.push(v);
  }
  return grupos;
}

const GRUPOS_VARIAVEIS = agruparVariaveis();

/** Há algo digitado em alguma seção? (para validações/preview). */
function temConteudo(secoes: SecaoModelo[]): boolean {
  return secoes.some((s) => {
    switch (s.tipo) {
      case "titulo":
        return !!(s.titulo.trim() || s.subtitulo.trim());
      case "partes":
        return !!(s.contratante.trim() || s.contratado.trim() || s.paragrafo.trim());
      case "clausula":
        return !!(s.titulo.trim() || s.itens.some((i) => i.texto.trim()));
      case "anexo":
        return !!(s.titulo.trim() || s.conteudo.trim());
      case "assinaturas":
        return true; // assinaturas sempre geram blocos
    }
  });
}

export default function EditorModelo({
  modeloId,
  nomeInicial,
  secoesIniciais,
  estiloInicial,
  onVoltar,
  onSalvo,
}: Props) {
  const t = useT();
  const { criarModelo, atualizarModelo } = useModelos();

  const [nome, setNome] = useState(nomeInicial);
  const [secoes, setSecoes] = useState<SecaoModelo[]>(secoesIniciais);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [estilo, setEstilo] = useState<EstiloModelo>(estiloInicial);
  const [baixandoPdf, setBaixandoPdf] = useState(false);
  // Folha A4 do preview (visual) + container das seções (capturado no PDF).
  const folhaRef = useRef<HTMLDivElement>(null);
  const conteudoRef = useRef<HTMLDivElement>(null);

  // Numeração automática (cláusulas + sub-cláusulas), recalculada a cada render.
  const num = calcularNumeracao(secoes);

  // Rastreamento do caret: referência de cada campo editável (input/textarea),
  // indexado pela chave do descritor, e qual recebeu foco por último.
  const camposRef = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});
  const focoRef = useRef<Descritor | null>(null);

  // Fecha o menu de "Adicionar seção" ao clicar fora.
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menuAberto) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAberto(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuAberto]);

  // ---- Manipulação de seções ----

  function adicionarSecao(tipo: TipoSecao) {
    setSecoes((prev) => [...prev, novaSecao(tipo)]);
    setMenuAberto(false);
  }

  function removerSecao(id: string) {
    if (temConteudo(secoes.filter((s) => s.id === id)) &&
        !window.confirm(t("Remover esta seção? O conteúdo será perdido."))) {
      return;
    }
    setSecoes((prev) => prev.filter((s) => s.id !== id));
    if (focoRef.current?.secaoId === id) focoRef.current = null;
    for (const chave of Object.keys(camposRef.current)) {
      if (chave.startsWith(`${id}:`)) delete camposRef.current[chave];
    }
  }

  function moverSecao(index: number, dir: -1 | 1) {
    setSecoes((prev) => {
      const destino = index + dir;
      if (destino < 0 || destino >= prev.length) return prev;
      const copia = [...prev];
      const [item] = copia.splice(index, 1);
      copia.splice(destino, 0, item);
      return copia;
    });
  }

  /**
   * Atualiza um campo de texto simples de uma seção, imutavelmente. O `switch`
   * por `tipo` garante que só escrevemos o campo onde ele realmente existe
   * (TS narrows corretamente cada membro da união).
   */
  function setCampo(secaoId: string, campo: CampoTextoSimples, valor: string) {
    setSecoes((prev) =>
      prev.map((s): SecaoModelo => {
        if (s.id !== secaoId) return s;
        switch (s.tipo) {
          case "titulo":
            if (campo === "titulo") return { ...s, titulo: valor };
            if (campo === "subtitulo") return { ...s, subtitulo: valor };
            return s;
          case "partes":
            if (campo === "contratante") return { ...s, contratante: valor };
            if (campo === "contratado") return { ...s, contratado: valor };
            if (campo === "paragrafo") return { ...s, paragrafo: valor };
            return s;
          case "clausula":
            if (campo === "titulo") return { ...s, titulo: valor };
            return s;
          case "anexo":
            if (campo === "titulo") return { ...s, titulo: valor };
            if (campo === "conteudo") return { ...s, conteudo: valor };
            return s;
          case "assinaturas":
            return s;
        }
      })
    );
  }

  /** Adiciona uma testemunha (manual) numa seção de assinaturas — máx. 2. */
  function adicionarTestemunha(secaoId: string) {
    setSecoes((prev) =>
      prev.map((s) =>
        s.id === secaoId && s.tipo === "assinaturas" && s.testemunhas.length < 2
          ? {
              ...s,
              testemunhas: [
                ...s.testemunhas,
                { id: crypto.randomUUID(), nome: "", documento: "" },
              ],
            }
          : s
      )
    );
  }

  function removerTestemunha(secaoId: string, testemunhaId: string) {
    setSecoes((prev) =>
      prev.map((s) =>
        s.id === secaoId && s.tipo === "assinaturas"
          ? { ...s, testemunhas: s.testemunhas.filter((t) => t.id !== testemunhaId) }
          : s
      )
    );
  }

  function atualizarTestemunha(
    secaoId: string,
    testemunhaId: string,
    campo: "nome" | "documento",
    valor: string
  ) {
    setSecoes((prev) =>
      prev.map((s) =>
        s.id === secaoId && s.tipo === "assinaturas"
          ? {
              ...s,
              testemunhas: s.testemunhas.map((t) =>
                t.id === testemunhaId ? { ...t, [campo]: valor } : t
              ),
            }
          : s
      )
    );
  }

  // ---- Manipulação de itens de cláusula ----

  function atualizarItem(secaoId: string, itemId: string, texto: string) {
    setSecoes((prev) =>
      prev.map((s) =>
        s.id === secaoId && s.tipo === "clausula"
          ? {
              ...s,
              itens: s.itens.map((i) => (i.id === itemId ? { ...i, texto } : i)),
            }
          : s
      )
    );
  }

  function adicionarItem(secaoId: string, tipo: ItemClausula["tipo"]) {
    setSecoes((prev) =>
      prev.map((s) =>
        s.id === secaoId && s.tipo === "clausula"
          ? {
              ...s,
              itens: [...s.itens, { id: crypto.randomUUID(), tipo, texto: "" }],
            }
          : s
      )
    );
  }

  function removerItem(secaoId: string, itemId: string) {
    const secao = secoes.find((s) => s.id === secaoId);
    const item =
      secao?.tipo === "clausula" ? secao.itens.find((i) => i.id === itemId) : null;
    if (item?.texto.trim() &&
        !window.confirm(t("Remover este item? O conteúdo será perdido."))) {
      return;
    }
    setSecoes((prev) =>
      prev.map((s) =>
        s.id === secaoId && s.tipo === "clausula"
          ? { ...s, itens: s.itens.filter((i) => i.id !== itemId) }
          : s
      )
    );
    if (focoRef.current?.itemId === itemId) focoRef.current = null;
    delete camposRef.current[chaveCampo({ secaoId, campo: "item", itemId })];
  }

  // ---- Inserção de variáveis no caret ----

  /** Lê o valor atual da string que um descritor edita (ou null se obsoleto). */
  function lerValor(d: Descritor): string | null {
    const secao = secoes.find((s) => s.id === d.secaoId);
    if (!secao) return null;
    switch (d.campo) {
      case "titulo":
        return secao.tipo === "titulo" || secao.tipo === "clausula" || secao.tipo === "anexo"
          ? secao.titulo
          : null;
      case "subtitulo":
        return secao.tipo === "titulo" ? secao.subtitulo : null;
      case "contratante":
        return secao.tipo === "partes" ? secao.contratante : null;
      case "contratado":
        return secao.tipo === "partes" ? secao.contratado : null;
      case "paragrafo":
        return secao.tipo === "partes" ? secao.paragrafo : null;
      case "conteudo":
        return secao.tipo === "anexo" ? secao.conteudo : null;
      case "item": {
        if (secao.tipo !== "clausula") return null;
        const it = secao.itens.find((i) => i.id === d.itemId);
        return it ? it.texto : null;
      }
    }
  }

  /** Escreve um novo valor na string que um descritor edita. */
  function escreverValor(d: Descritor, valor: string) {
    if (d.campo === "item") {
      if (d.itemId) atualizarItem(d.secaoId, d.itemId, valor);
      return;
    }
    setCampo(d.secaoId, d.campo, valor);
  }

  function inserirVariavel(token: string) {
    const trecho = `{{${token}}}`;
    const foco = focoRef.current;

    // Sem foco válido: anexa ao 1º campo de texto disponível (sem crashar).
    const alvo: Descritor | null =
      foco && lerValor(foco) !== null ? foco : primeiroCampoTexto(secoes);
    if (!alvo) return;

    const valor = lerValor(alvo);
    if (valor === null) return;

    const chave = chaveCampo(alvo);
    const el = camposRef.current[chave];
    const mesmoFoco =
      !!el &&
      foco?.secaoId === alvo.secaoId &&
      foco?.campo === alvo.campo &&
      foco?.itemId === alvo.itemId;

    const inicio = mesmoFoco ? el!.selectionStart ?? valor.length : valor.length;
    const fim = mesmoFoco ? el!.selectionEnd ?? valor.length : valor.length;

    const novoValor = valor.slice(0, inicio) + trecho + valor.slice(fim);
    escreverValor(alvo, novoValor);

    const novaPos = inicio + trecho.length;
    requestAnimationFrame(() => {
      const ref = camposRef.current[chave];
      if (ref) {
        ref.focus();
        try {
          ref.setSelectionRange(novaPos, novaPos);
        } catch {
          /* ignora navegadores que não suportam */
        }
      }
    });
  }

  // ---- Salvar ----

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const payload = {
        nome: nome.trim() || "Modelo sem nome",
        tipo: "editavel" as const,
        secoes,
        // Cores do modelo serializadas na coluna `corpo` (sem migration).
        corpo: estiloParaCorpo(estilo),
      };
      if (modeloId) {
        await atualizarModelo(modeloId, payload);
      } else {
        await criarModelo(payload);
      }
      onSalvo();
    } catch (e) {
      setErro((e as Error).message || t("Não foi possível salvar o modelo."));
    } finally {
      setSalvando(false);
    }
  }

  // ---- Baixar PDF (lazy-load só no clique; paginação A4 página a página) ----
  // Captura cada seção num canvas e monta as páginas A4: o fundo preenche a
  // página inteira (sem branco sobrando), a quebra acontece ENTRE seções
  // (nunca cortando o texto no meio) e toda página tem a mesma margem.
  async function baixarPdf() {
    const cont = conteudoRef.current;
    if (!cont || cont.children.length === 0) return;
    setBaixandoPdf(true);
    setErro(null);
    try {
      const [{ jsPDF }, html2canvasMod] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);
      const html2canvas = html2canvasMod.default;

      const A4_W = 210;
      const A4_H = 297;
      const MX = 20; // margem lateral (mm)
      const MTOP = 22;
      const MBOT = 22;
      const contentW = A4_W - 2 * MX; // 170mm
      const limiteY = A4_H - MBOT; // y máximo do conteúdo
      const GAP = 6.5; // espaço entre seções (≈ 1 linha, mm)

      const [fr, fg, fb] = hexParaRgb(estilo.corFundo);
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

      let y = MTOP;
      let primeira = true;
      const novaPagina = () => {
        if (!primeira) pdf.addPage();
        primeira = false;
        pdf.setFillColor(fr, fg, fb);
        pdf.rect(0, 0, A4_W, A4_H, "F"); // fundo preenche a página inteira
        y = MTOP;
      };
      novaPagina();

      for (const el of Array.from(cont.children) as HTMLElement[]) {
        const canvas = await html2canvas(el, {
          scale: 2,
          backgroundColor: estilo.corFundo,
          useCORS: true,
        });
        const hmm = (canvas.height / canvas.width) * contentW;

        if (hmm <= limiteY - MTOP) {
          // Seção cabe numa página — quebra antes se não couber no que resta.
          if (y + hmm > limiteY && y > MTOP) novaPagina();
          pdf.addImage(
            canvas.toDataURL("image/jpeg", 0.95),
            "JPEG",
            MX,
            y,
            contentW,
            hmm
          );
          y += hmm + GAP;
        } else {
          // Seção maior que a página — fatia em páginas (preenchendo o fundo).
          const pxPorMm = canvas.height / hmm;
          let offset = 0;
          while (offset < canvas.height) {
            if (y > MTOP) novaPagina();
            const dispMm = limiteY - y;
            const slicePx = Math.min(
              canvas.height - offset,
              Math.floor(dispMm * pxPorMm)
            );
            const tmp = document.createElement("canvas");
            tmp.width = canvas.width;
            tmp.height = slicePx;
            const ctx = tmp.getContext("2d");
            if (ctx) {
              ctx.fillStyle = estilo.corFundo;
              ctx.fillRect(0, 0, canvas.width, slicePx);
              ctx.drawImage(
                canvas,
                0,
                offset,
                canvas.width,
                slicePx,
                0,
                0,
                canvas.width,
                slicePx
              );
            }
            const sliceMm = slicePx / pxPorMm;
            pdf.addImage(
              tmp.toDataURL("image/jpeg", 0.95),
              "JPEG",
              MX,
              y,
              contentW,
              sliceMm
            );
            offset += slicePx;
            y += sliceMm + GAP;
          }
        }
      }

      pdf.save(`${nome.trim() || "contrato"}.pdf`);
    } catch {
      setErro(t("Não foi possível gerar o PDF. Tente novamente."));
    } finally {
      setBaixandoPdf(false);
    }
  }

  // ---- Helpers de render de campos ----

  /** Props comuns de um campo editável (ref + foco). */
  function campoProps(d: Descritor) {
    return {
      ref: (el: HTMLInputElement | HTMLTextAreaElement | null) => {
        camposRef.current[chaveCampo(d)] = el;
      },
      onFocus: () => {
        focoRef.current = d;
      },
    };
  }

  // ---- Render ----

  return (
    <div>
      {/* Barra superior */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button type="button" onClick={onVoltar} className="btn btn-ghost">
          <ArrowLeft size={15} />
          {t("Voltar")}
        </button>

        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={t("Nome do modelo")}
          className="campo-input flex-1 min-w-[220px] max-w-md font-medium"
        />

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() => setPreview((p) => !p)}
            className="btn btn-secondary"
            aria-pressed={preview}
          >
            {preview ? <EyeOff size={15} /> : <Eye size={15} />}
            {preview ? t("Editar") : t("Preview")}
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="btn"
            style={{ backgroundColor: ACCENT, color: "#fff", opacity: salvando ? 0.6 : 1 }}
          >
            <Save size={15} />
            {salvando ? t("Salvando...") : t("Salvar")}
          </button>
        </div>
      </div>

      {erro && (
        <div className="card mb-6" style={{ borderColor: "var(--danger)" }}>
          <p className="text-sm text-danger">{erro}</p>
        </div>
      )}

      {/* Layout em duas colunas (no lg): conteúdo + paleta de variáveis */}
      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        {/* Coluna esquerda: editor de seções OU preview */}
        <div className="min-w-0">
          {preview ? (
            <div className="flex flex-col gap-3">
              {/* Barra de aparência: cores + baixar PDF */}
              <div className="card flex flex-wrap items-center gap-x-5 gap-y-3 p-3">
                <span
                  className="text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1"
                  style={{ color: ACCENT }}
                >
                  <Palette size={13} />
                  {t("Aparência")}
                </span>
                <SeletorCorInline
                  label={t("Fundo")}
                  cor={estilo.corFundo}
                  presets={PRESETS_FUNDO}
                  onChange={(c) => setEstilo((s) => ({ ...s, corFundo: c }))}
                />
                <SeletorCorInline
                  label={t("Texto")}
                  cor={estilo.corTexto}
                  presets={PRESETS_TEXTO}
                  onChange={(c) => setEstilo((s) => ({ ...s, corTexto: c }))}
                />
                <SeletorCorInline
                  label={t("Títulos")}
                  cor={estilo.corTitulo}
                  presets={PRESETS_TITULO}
                  onChange={(c) => setEstilo((s) => ({ ...s, corTitulo: c }))}
                />
                <button
                  type="button"
                  onClick={baixarPdf}
                  disabled={baixandoPdf}
                  className="btn ml-auto"
                  style={{ backgroundColor: ACCENT, color: "#fff", opacity: baixandoPdf ? 0.6 : 1 }}
                >
                  <Download size={15} />
                  {baixandoPdf ? t("Gerando...") : t("Baixar PDF")}
                </button>
              </div>
              <PreviewSecoes
                secoes={secoes}
                estilo={estilo}
                folhaRef={folhaRef}
                conteudoRef={conteudoRef}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {secoes.map((secao, index) => (
                <div key={secao.id} className="card">
                  {/* Cabeçalho do card: rótulo do tipo + mover/remover */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="stat-label" style={{ color: ACCENT }}>
                      {t(TIPOS_SECAO.find((tp) => tp.tipo === secao.tipo)?.label ?? secao.tipo)}
                    </span>
                    <div className="flex items-center gap-0.5 flex-shrink-0 ml-auto">
                      <button
                        type="button"
                        onClick={() => moverSecao(index, -1)}
                        disabled={index === 0}
                        title={t("Mover para cima")}
                        aria-label={t("Mover para cima")}
                        className="btn-ghost p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moverSecao(index, 1)}
                        disabled={index === secoes.length - 1}
                        title={t("Mover para baixo")}
                        aria-label={t("Mover para baixo")}
                        className="btn-ghost p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowDown size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removerSecao(secao.id)}
                        title={t("Remover seção")}
                        aria-label={t("Remover seção")}
                        className="btn-ghost p-1.5 rounded hover:text-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Corpo do card por tipo */}
                  {secao.tipo === "titulo" && (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        {...campoProps({ secaoId: secao.id, campo: "titulo" })}
                        value={secao.titulo}
                        onChange={(e) => setCampo(secao.id, "titulo", e.target.value)}
                        placeholder={t("Título do contrato")}
                        className="campo-input font-semibold"
                      />
                      <input
                        type="text"
                        {...campoProps({ secaoId: secao.id, campo: "subtitulo" })}
                        value={secao.subtitulo}
                        onChange={(e) => setCampo(secao.id, "subtitulo", e.target.value)}
                        placeholder={t("Subtítulo")}
                        className="campo-input"
                      />
                    </div>
                  )}

                  {secao.tipo === "partes" && (
                    <div className="flex flex-col gap-3">
                      <label className="flex flex-col gap-1">
                        <span className="stat-label">{t("Contratante")}</span>
                        <textarea
                          {...campoProps({ secaoId: secao.id, campo: "contratante" })}
                          value={secao.contratante}
                          onChange={(e) => setCampo(secao.id, "contratante", e.target.value)}
                          placeholder={t("Identificação do contratante. Use as variáveis ao lado.")}
                          className="campo-input min-h-[70px] resize-y leading-relaxed"
                          style={{ whiteSpace: "pre-wrap" }}
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="stat-label">{t("Contratado")}</span>
                        <textarea
                          {...campoProps({ secaoId: secao.id, campo: "contratado" })}
                          value={secao.contratado}
                          onChange={(e) => setCampo(secao.id, "contratado", e.target.value)}
                          placeholder={t("Identificação do contratado. Use as variáveis ao lado.")}
                          className="campo-input min-h-[70px] resize-y leading-relaxed"
                          style={{ whiteSpace: "pre-wrap" }}
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="stat-label">{t("Parágrafo")}</span>
                        <textarea
                          {...campoProps({ secaoId: secao.id, campo: "paragrafo" })}
                          value={secao.paragrafo}
                          onChange={(e) => setCampo(secao.id, "paragrafo", e.target.value)}
                          placeholder={t("Parágrafo de abertura (ex: 'As partes acima têm, entre si...').")}
                          className="campo-input min-h-[70px] resize-y leading-relaxed"
                          style={{ whiteSpace: "pre-wrap" }}
                        />
                      </label>
                    </div>
                  )}

                  {secao.tipo === "clausula" && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="badge flex-shrink-0"
                          style={{ backgroundColor: `${ACCENT}20`, color: ACCENT }}
                        >
                          {t("Cláusula")} {num.clausulas[secao.id]}
                        </span>
                        <input
                          type="text"
                          {...campoProps({ secaoId: secao.id, campo: "titulo" })}
                          value={secao.titulo}
                          onChange={(e) => setCampo(secao.id, "titulo", e.target.value)}
                          placeholder={t("Título da cláusula (ex: DO OBJETO)")}
                          className="campo-input font-semibold"
                        />
                      </div>

                      <div className="flex flex-col gap-2 pl-1">
                        {secao.itens.map((item) => (
                          <div key={item.id} className="flex items-start gap-1.5">
                            <span
                              className="text-xs font-semibold flex-shrink-0 mt-2 w-9 text-right"
                              style={{
                                color:
                                  item.tipo === "subclausula" ? ACCENT : "var(--text-muted)",
                              }}
                              title={item.tipo === "subclausula" ? t("Sub-cláusula") : t("Parágrafo")}
                            >
                              {item.tipo === "subclausula" ? num.itens[item.id] : "¶"}
                            </span>
                            <textarea
                              {...campoProps({
                                secaoId: secao.id,
                                campo: "item",
                                itemId: item.id,
                              })}
                              value={item.texto}
                              onChange={(e) => atualizarItem(secao.id, item.id, e.target.value)}
                              placeholder={
                                item.tipo === "subclausula"
                                  ? t("Sub-cláusula numerada automaticamente.")
                                  : t("Parágrafo (sem número).")
                              }
                              className="campo-input min-h-[80px] resize-y leading-relaxed flex-1"
                              style={{ whiteSpace: "pre-wrap" }}
                            />
                            <button
                              type="button"
                              onClick={() => removerItem(secao.id, item.id)}
                              title={t("Remover item")}
                              aria-label={t("Remover item")}
                              className="btn-ghost p-1 rounded hover:text-danger flex-shrink-0 mt-1"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}

                        <div className="flex items-center gap-2 pl-9">
                          <button
                            type="button"
                            onClick={() => adicionarItem(secao.id, "subclausula")}
                            className="btn btn-ghost text-xs px-2 py-1"
                          >
                            <Plus size={13} />
                            {t("Cláusula")}
                          </button>
                          <button
                            type="button"
                            onClick={() => adicionarItem(secao.id, "paragrafo")}
                            className="btn btn-ghost text-xs px-2 py-1"
                          >
                            <Plus size={13} />
                            {t("Parágrafo")}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {secao.tipo === "assinaturas" && (
                    <div className="flex flex-col gap-3">
                      <p className="section-subtitle">
                        {t("Blocos de")} <strong>{t("Contratante")}</strong> {t("e")}{" "}
                        <strong>{t("Contratado")}</strong> {t("são automáticos (dados do contrato). Testemunhas são preenchidas manualmente:")}
                      </p>

                      {secao.testemunhas.map((testemunha, i) => (
                        <div
                          key={testemunha.id}
                          className="bg-surface border border-border rounded p-3 flex flex-col gap-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                              {t("Testemunha")} {i + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => removerTestemunha(secao.id, testemunha.id)}
                              className="btn-ghost p-1 rounded text-muted hover:text-danger"
                              title={t("Remover testemunha")}
                            >
                              <X size={13} />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={testemunha.nome}
                            onChange={(e) =>
                              atualizarTestemunha(secao.id, testemunha.id, "nome", e.target.value)
                            }
                            placeholder={t("Nome da testemunha")}
                            className="campo-input"
                          />
                          <input
                            type="text"
                            value={testemunha.documento}
                            onChange={(e) =>
                              atualizarTestemunha(
                                secao.id,
                                testemunha.id,
                                "documento",
                                e.target.value
                              )
                            }
                            placeholder={t("CPF / documento")}
                            className="campo-input"
                          />
                        </div>
                      ))}

                      {secao.testemunhas.length < 2 && (
                        <button
                          type="button"
                          onClick={() => adicionarTestemunha(secao.id)}
                          className="btn-ghost text-xs inline-flex items-center gap-1.5 self-start"
                          style={{ color: "var(--module-contratos)" }}
                        >
                          <Plus size={13} /> {t("Testemunha")}
                        </button>
                      )}
                    </div>
                  )}

                  {secao.tipo === "anexo" && (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        {...campoProps({ secaoId: secao.id, campo: "titulo" })}
                        value={secao.titulo}
                        onChange={(e) => setCampo(secao.id, "titulo", e.target.value)}
                        placeholder={t("Título do anexo (ex: ANEXO — RIDER TÉCNICO)")}
                        className="campo-input font-semibold"
                      />
                      <textarea
                        {...campoProps({ secaoId: secao.id, campo: "conteudo" })}
                        value={secao.conteudo}
                        onChange={(e) => setCampo(secao.id, "conteudo", e.target.value)}
                        placeholder={t("Conteúdo do anexo. Use as variáveis ao lado para inserir {{campos}}.")}
                        className="campo-input min-h-[110px] resize-y leading-relaxed"
                        style={{ whiteSpace: "pre-wrap" }}
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Menu "Adicionar seção" */}
              <div ref={menuRef} className="relative self-start">
                <button
                  type="button"
                  onClick={() => setMenuAberto((a) => !a)}
                  className="btn btn-secondary"
                  aria-haspopup="menu"
                  aria-expanded={menuAberto}
                >
                  <Plus size={15} />
                  {t("Adicionar seção")}
                </button>
                {menuAberto && (
                  <div
                    role="menu"
                    className="absolute left-0 top-full mt-1 z-10 min-w-[200px] rounded-md border p-1 shadow-lg"
                    style={{
                      backgroundColor: "var(--bg-surface)",
                      borderColor: "var(--border-color)",
                    }}
                  >
                    {TIPOS_SECAO.map(({ tipo, label, Icon }) => (
                      <button
                        key={tipo}
                        type="button"
                        role="menuitem"
                        onClick={() => adicionarSecao(tipo)}
                        className="btn-ghost w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left"
                      >
                        <Icon size={15} style={{ color: ACCENT }} />
                        {t(label)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Coluna direita: paleta de variáveis (sticky) */}
        <aside className="lg:sticky lg:top-6 self-start">
          <div className="card p-4">
            <div className="section-title mb-1">{t("Variáveis")}</div>
            <p className="section-subtitle mb-4">
              {t("Clique para inserir no ponto do cursor.")}
            </p>
            <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-1">
              {GRUPOS_VARIAVEIS.map((g) => (
                <div key={g.grupo}>
                  <div className="stat-label mb-2">{t(g.grupo)}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.itens.map((v) => (
                      <button
                        key={v.token}
                        type="button"
                        onClick={() => inserirVariavel(v.token)}
                        title={`Inserir {{${v.token}}}`}
                        className="badge badge-neutral hover:text-primary transition-colors"
                        style={{ cursor: "pointer" }}
                      >
                        {t(v.label)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Primeiro campo de texto editável de um conjunto de seções (ou null). */
function primeiroCampoTexto(secoes: SecaoModelo[]): Descritor | null {
  for (const s of secoes) {
    switch (s.tipo) {
      case "titulo":
        return { secaoId: s.id, campo: "titulo" };
      case "partes":
        return { secaoId: s.id, campo: "contratante" };
      case "clausula":
        if (s.itens.length > 0) {
          return { secaoId: s.id, campo: "item", itemId: s.itens[0].id };
        }
        return { secaoId: s.id, campo: "titulo" };
      case "anexo":
        return { secaoId: s.id, campo: "titulo" };
      case "assinaturas":
        break; // sem campo de texto
    }
  }
  return null;
}

/** Hex (#rrggbb) → [r, g, b] pra preencher o fundo da página no jsPDF. */
function hexParaRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  return [
    parseInt(m.slice(0, 2), 16) || 0,
    parseInt(m.slice(2, 4), 16) || 0,
    parseInt(m.slice(4, 6), 16) || 0,
  ];
}

// Presets de cor (4 + a opção RGB custom via ColorPicker) pra cada parte.
// branco · off-white · cinza escuro · preto (+ RGB no botão "+")
const PRESETS_FUNDO = ["#ffffff", "#f8f7f4", "#404040", "#000000"];
// preto · branco · cinza · azul escuro (+ RGB)
const PRESETS_TEXTO = ["#111111", "#ffffff", "#6b7280", "#1e3a8a"];
// título: mesma escala do texto
const PRESETS_TITULO = ["#111111", "#ffffff", "#6b7280", "#1e3a8a"];

/**
 * Seletor de cor compacto (mesma ideia do seletor do artista): 4 swatches de
 * preset + um botão de cor personalizada que abre o ColorPicker (RGB/HSV).
 */
function SeletorCorInline({
  label,
  cor,
  presets,
  onChange,
}: {
  label: string;
  cor: string;
  presets: string[];
  onChange: (c: string) => void;
}) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const ativo = (p: string) => p.toLowerCase() === cor.toLowerCase();
  const ehCustom = !presets.some(ativo);

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted">{label}</span>
      {presets.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          title={p}
          aria-label={`${label} ${p}`}
          className="h-6 w-6 rounded-md transition-transform hover:scale-110"
          style={{
            backgroundColor: p,
            border: "1px solid var(--border-color)",
            boxShadow: ativo(p)
              ? "0 0 0 2px var(--bg-surface), 0 0 0 3px var(--text-primary)"
              : undefined,
          }}
        />
      ))}
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setAberto(true)}
        title={t("Cor personalizada (RGB)")}
        className="h-6 w-6 rounded-md flex items-center justify-center transition-transform hover:scale-110"
        style={{
          backgroundColor: ehCustom ? cor : "transparent",
          border: `1px ${ehCustom ? "solid" : "dashed"} ${
            ehCustom ? "var(--text-primary)" : "var(--border-color)"
          }`,
          color: "var(--text-muted)",
          boxShadow: ehCustom
            ? "0 0 0 2px var(--bg-surface), 0 0 0 3px var(--text-primary)"
            : undefined,
        }}
      >
        {!ehCustom && <Plus size={12} />}
      </button>
      {aberto && (
        <ColorPicker
          cor={cor}
          onApply={(c) => {
            onChange(c);
            setAberto(false);
          }}
          onClose={() => setAberto(false)}
          anchorRef={anchorRef}
        />
      )}
    </div>
  );
}

/**
 * Preview do modelo numa FOLHA A4 (210×297mm), com as cores escolhidas
 * (fundo / texto / título) e dados de exemplo já substituídos. O `folhaRef`
 * aponta pra folha — é o nó capturado na geração do PDF.
 */
function PreviewSecoes({
  secoes,
  estilo,
  folhaRef,
  conteudoRef,
}: {
  secoes: SecaoModelo[];
  estilo: EstiloModelo;
  folhaRef: Ref<HTMLDivElement>;
  conteudoRef: Ref<HTMLDivElement>;
}) {
  const translate = useT();
  const num = calcularNumeracao(secoes);
  const ex = (s: string) => preencher(s, VALORES_EXEMPLO);

  return (
    <div
      className="overflow-auto rounded-md p-4"
      style={{
        background: "var(--bg-main)",
        border: "1px solid var(--border-color)",
      }}
    >
      <div
        ref={folhaRef}
        style={{
          width: "210mm",
          minHeight: "297mm",
          margin: "0 auto",
          padding: "22mm 20mm",
          background: estilo.corFundo,
          color: estilo.corTexto,
          boxShadow: "0 6px 28px rgba(0,0,0,0.45)",
          fontFamily: "'Times New Roman', Georgia, serif",
          fontSize: "11pt",
          lineHeight: 1.6,
        }}
      >
        {!temConteudo(secoes) ? (
          <p style={{ fontStyle: "italic", opacity: 0.55 }}>
            {translate("Nada para mostrar ainda — adicione seções e preencha o conteúdo.")}
          </p>
        ) : (
          <div
            ref={conteudoRef}
            style={{ display: "flex", flexDirection: "column", gap: "18pt" }}
          >
            {secoes.map((secao) => (
              <div key={secao.id}>{renderPreviewSecao(secao, num, ex, estilo, translate)}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Estilo de um título centralizado (usa a cor de título do modelo). */
function estiloTitulo(cor: string): CSSProperties {
  return {
    color: cor,
    fontSize: "11pt",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    textAlign: "center",
    marginBottom: "6pt",
  };
}

function renderPreviewSecao(
  secao: SecaoModelo,
  num: ReturnType<typeof calcularNumeracao>,
  ex: (s: string) => string,
  estilo: EstiloModelo,
  tr: (s: string) => string
) {
  const corpo: CSSProperties = { whiteSpace: "pre-wrap", textAlign: "justify" };

  switch (secao.tipo) {
    case "titulo":
      return (
        <div style={{ textAlign: "center" }}>
          {secao.titulo.trim() && (
            <h2
              style={{
                color: estilo.corTitulo,
                fontSize: "15pt",
                fontWeight: 700,
                letterSpacing: "0.02em",
              }}
            >
              {ex(secao.titulo)}
            </h2>
          )}
          {secao.subtitulo.trim() && (
            <p style={{ fontSize: "11pt", marginTop: "4pt", opacity: 0.85 }}>
              {ex(secao.subtitulo)}
            </p>
          )}
        </div>
      );

    case "partes":
      return (
        <div>
          <h3 style={estiloTitulo(estilo.corTitulo)}>{tr("Das partes")}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0pt" }}>
            {[secao.contratante, secao.contratado, secao.paragrafo]
              .filter((s) => s.trim())
              .map((s, i) => (
                <div key={i} style={corpo}>
                  {ex(s)}
                </div>
              ))}
          </div>
        </div>
      );

    case "clausula":
      return (
        <div>
          <h3 style={estiloTitulo(estilo.corTitulo)}>
            {tr("CLÁUSULA")} {num.clausulas[secao.id]}ª — {ex(secao.titulo)}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0pt" }}>
            {secao.itens.map((item) => (
              <div key={item.id} style={corpo}>
                {item.tipo === "subclausula"
                  ? `${num.itens[item.id]} ${ex(item.texto)}`
                  : ex(item.texto)}
              </div>
            ))}
          </div>
        </div>
      );

    case "assinaturas": {
      const blocos: { nome: string; doc?: string; papel: string }[] = [
        { nome: ex("{{contratante}}"), doc: ex("{{documento}}"), papel: tr("CONTRATANTE") },
        { nome: ex("{{artista}}"), papel: tr("CONTRATADO") },
      ];
      secao.testemunhas.forEach((testemunha, i) => {
        blocos.push({ nome: testemunha.nome, doc: testemunha.documento, papel: `${tr("Testemunha")} ${i + 1}` });
      });
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "26pt",
            paddingTop: "14pt",
          }}
        >
          {blocos.map((b, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <div
                style={{ width: "70mm", borderTop: `1px solid ${estilo.corTexto}` }}
              />
              {b.nome && <span style={{ marginTop: "3pt" }}>{b.nome}</span>}
              {b.doc && b.doc.trim() && (
                <span style={{ fontSize: "9pt", opacity: 0.7, marginTop: "1pt" }}>
                  {b.doc}
                </span>
              )}
              <span
                style={{
                  fontSize: "9pt",
                  opacity: 0.7,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginTop: "1pt",
                }}
              >
                {b.papel}
              </span>
            </div>
          ))}
        </div>
      );
    }

    case "anexo":
      return (
        <div>
          <h3 style={estiloTitulo(estilo.corTitulo)}>{ex(secao.titulo)}</h3>
          <div style={corpo}>{ex(secao.conteudo)}</div>
        </div>
      );
  }
}
