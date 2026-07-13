"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  FileSignature,
  Download,
  Check,
  Loader2,
  AlertCircle,
  Plus,
} from "lucide-react";
import PageHeader from "../PageHeader";
import Modal from "../Modal";
import NovoContratoUpload from "./NovoContratoUpload";
import { FolhaA4, gerarPdfFolha } from "./folhaA4";
import { useModelos } from "@/lib/modelos-context";
import { useVendas } from "@/lib/vendas-context";
import { useWorkspace } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth-context";
import { useContratos, ExcedenteError } from "@/lib/contratos-context";
import {
  valoresDeVenda,
  preencherSecoes,
  dataBR,
  hojeBR,
} from "@/lib/contratos/preencherSecoes";
import { VARIAVEIS_CONTRATO } from "@/lib/contratos/variaveis";
import type { Contrato } from "@/lib/mappers/contrato";
import { getPlano, formatarPreco } from "@/lib/planos";
import { useT } from "@/lib/i18n";

const ACCENT = "#3D7BFF";

// Tokens que costumam ser longos → textarea.
const LONGOS = new Set([
  "forma de pagamento",
  "rider de camarim",
  "rider de efeitos",
  "rider tecnico",
  "hospedagem",
  "logistica",
  "translado",
  "endereco",
  "endereco_local",
]);

// Auto-preenchidos (não editáveis no form): número (no save) e data de hoje.
const OCULTOS = new Set(["numero_contrato"]);

export default function NovoContratoPage() {
  const t = useT();
  const { modelos } = useModelos();
  const { vendas } = useVendas();
  const { artistas } = useWorkspace();
  const { sessao, podeUI } = useAuth();
  const { contratos, criarContrato, atualizarContrato } = useContratos();

  const editaveis = useMemo(
    () => modelos.filter((m) => m.tipo === "editavel"),
    [modelos]
  );
  const agencia = sessao?.workspace?.nome ?? "";

  // Limite mensal de contratos do plano (mesmo padrão da aba Equipe). Conta
  // os contratos gerados no mês corrente por `criadoEm` (espelha a contagem
  // do servidor) pra mostrar usado/limite + bloquear "Gerar contrato".
  const plano = sessao?.workspace ? getPlano(sessao.workspace.plano) : null;
  const limiteMes = plano?.maxContratosMes ?? 0;
  const usadosMes = useMemo(() => {
    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    return contratos.filter((c) => {
      if (!c.criadoEm) return false;
      const criado = new Date(c.criadoEm);
      return !isNaN(criado.getTime()) && criado >= inicioMes;
    }).length;
  }, [contratos]);
  const noLimite = !!plano && usadosMes >= limiteMes;

  const [modeloId, setModeloId] = useState<string>("");
  const [vendaId, setVendaId] = useState<string>("");
  const [valores, setValores] = useState<Record<string, string>>({});
  const [gerando, setGerando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [gerado, setGerado] = useState<Contrato | null>(null);
  // Modal de contrato EXCEDENTE (limite atingido + opção de pagar por unidade,
  // via checkout avulso — MODELO PRÉ-PAGO, sem 1-clique no cartão salvo).
  const [excedente, setExcedente] = useState<
    { valor: number; moeda: "brl" | "usd" } | null
  >(null);
  // Erro acionável dentro do modal do excedente.
  const [excedenteErro, setExcedenteErro] = useState<string | null>(null);
  // true enquanto cria o checkout do excedente (evita duplo clique).
  const [excedenteIndo, setExcedenteIndo] = useState(false);

  const folhaRef = useRef<HTMLDivElement>(null);
  const conteudoRef = useRef<HTMLDivElement>(null);

  const modelo = useMemo(
    () => editaveis.find((m) => m.id === modeloId) ?? null,
    [editaveis, modeloId]
  );
  const venda = useMemo(
    () => vendas.find((v) => v.id === vendaId) ?? null,
    [vendas, vendaId]
  );

  // Permissão de criar contrato. Com venda escolhida, gate pelo artista dela;
  // sem venda (artista escolhido depois), habilita se PODE em qualquer artista.
  const podeCriar = venda
    ? podeUI(venda.artistaId || null, "contratos.criar")
    : artistas.some((a) => podeUI(a.id, "contratos.criar"));

  // (Re)preenche os valores quando muda o modelo ou a venda. Edições do
  // usuário são sobrescritas só nessas trocas (comportamento esperado).
  useEffect(() => {
    if (!modeloId) {
      setValores({});
      return;
    }
    const base: Record<string, string> = {};
    for (const v of VARIAVEIS_CONTRATO) base[v.token] = "";
    base.agencia = agencia;
    base.data_hoje = hojeBR();
    if (venda) {
      const artista = artistas.find((a) => a.id === venda.artistaId) ?? null;
      Object.assign(base, valoresDeVenda({ venda, artista, agencia, numero: "" }));
    }
    setValores(base);
    setGerado(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeloId, vendaId]);

  const secoesPreenchidas = useMemo(
    () => (modelo ? preencherSecoes(modelo.secoes, valores) : []),
    [modelo, valores]
  );

  const grupos = useMemo(() => {
    const m = new Map<string, typeof VARIAVEIS_CONTRATO>();
    for (const v of VARIAVEIS_CONTRATO) {
      if (OCULTOS.has(v.token)) continue;
      const arr = m.get(v.grupo) ?? [];
      arr.push(v);
      m.set(v.grupo, arr);
    }
    return Array.from(m.entries());
  }, []);

  function setValor(token: string, valor: string) {
    setValores((prev) => ({ ...prev, [token]: valor }));
  }

  async function gerar() {
    if (!modelo) return;
    setGerando(true);
    setErro(null);
    try {
      const secoes = preencherSecoes(modelo.secoes, valores);
      const contrato = await criarContrato({
        modeloId: modelo.id,
        vendaId: vendaId || null,
        secoes,
        estilo: modelo.estilo,
        status: "rascunho",
      });
      // Injeta o número real (CTR-XXXX) no snapshot e na tela.
      const valoresFinais = { ...valores, numero_contrato: contrato.numero };
      const secoesFinais = preencherSecoes(modelo.secoes, valoresFinais);
      const atualizado = await atualizarContrato(contrato.id, {
        secoes: secoesFinais,
        estilo: modelo.estilo,
      });
      setValores(valoresFinais);
      setGerado(atualizado);
      setExcedente(null);
      setExcedenteErro(null);
    } catch (e) {
      if (e instanceof ExcedenteError) {
        // Limite atingido, sem crédito disponível → abre o modal pra pagar o
        // contrato extra (checkout avulso, "Pagar excedente").
        setExcedente(e.info);
        setExcedenteErro(null);
      } else {
        setErro((e as Error).message || t("Não foi possível gerar o contrato."));
      }
    } finally {
      setGerando(false);
    }
  }

  // Abre o checkout avulso do contrato excedente (MODELO PRÉ-PAGO: redirect
  // pro ambiente seguro da Stripe — não é 1-clique no cartão salvo). Ao
  // aprovar, o webhook registra o crédito 'excedente_disponivel'; o usuário
  // volta e reenvia — o POST de /api/contratos consome o crédito na hora.
  async function pagarExcedente() {
    if (excedenteIndo) return;
    setExcedenteIndo(true);
    setExcedenteErro(null);
    try {
      const res = await fetch("/api/contratos/excedente-checkout", {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        throw new Error(
          (body.erro as string) ?? t("Falha ao iniciar o pagamento do excedente.")
        );
      }
      window.location.href = body.url as string;
    } catch (e) {
      setExcedenteErro(
        (e as Error).message || t("Falha ao iniciar o pagamento do excedente.")
      );
      setExcedenteIndo(false);
    }
  }

  async function baixarPdf() {
    if (!conteudoRef.current || !modelo) return;
    setBaixando(true);
    setErro(null);
    try {
      await gerarPdfFolha(
        conteudoRef.current,
        modelo.estilo,
        gerado?.numero || "contrato"
      );
    } catch {
      setErro(t("Não foi possível gerar o PDF."));
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Novo contrato"
        subtitle={
          plano
            ? t("Plano {nome} — {usados} de {limite} contratos este mês", {
                nome: plano.nome,
                usados: usadosMes,
                limite: limiteMes,
              })
            : "Una um modelo com uma venda e gere o contrato"
        }
        accentColor={ACCENT}
        actions={
          plano ? (
            <div className="min-w-[160px]">
              <div className="text-right">
                <span className="text-2xl font-bold tabular-nums text-primary">
                  {usadosMes}
                </span>
                <span className="text-muted text-base font-normal">
                  {" "}
                  / {limiteMes}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-elevated overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${limiteMes > 0 ? Math.min(100, (usadosMes / limiteMes) * 100) : 0}%`,
                    background: noLimite ? "var(--danger)" : "var(--grad-signal)",
                  }}
                />
              </div>
            </div>
          ) : undefined
        }
      />

      {/* Tudo numa página: (1) gerar por modelo + venda; (2) subir PDF + posicionar. */}
      <div className="section-title mt-8 mb-4">{t("1. Gerar a partir de um modelo")}</div>

      <>

      {noLimite && (
        <div
          className="flex items-start gap-2 text-sm rounded-md px-3 py-2.5 mb-6"
          style={{ backgroundColor: "rgba(245,158,11,0.1)", color: "var(--warning)" }}
        >
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          <span>
            {t(
              "Você atingiu o limite de contratos do plano {nome} neste ciclo. Ao gerar, pode pagar por um contrato extra, ou fazer upgrade.",
              { nome: plano?.nome ?? "" }
            )}
          </span>
        </div>
      )}

      {erro && (
        <div
          className="card mb-6 flex items-center gap-2"
          style={{ borderColor: "var(--danger)" }}
        >
          <AlertCircle size={16} style={{ color: "var(--danger)" }} />
          <p className="text-sm text-danger">{erro}</p>
        </div>
      )}

      {/* Modal do contrato EXCEDENTE (pagar por unidade além do limite, via
          checkout avulso — MODELO PRÉ-PAGO, sem cobrança em 1 clique). */}
      <Modal
        isOpen={excedente !== null}
        onClose={() => {
          if (excedenteIndo) return;
          setExcedente(null);
          setExcedenteErro(null);
        }}
        title={t("Limite de contratos atingido")}
        maxWidth={440}
      >
        {excedente && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-secondary">
              {t("Você atingiu o limite do seu plano neste ciclo. Dá pra gerar um contrato EXTRA pagando")}{" "}
              <span className="font-bold text-primary">
                {formatarPreco(excedente.valor / 100, excedente.moeda)}
              </span>{" "}
              {t("no ambiente seguro de pagamento. Depois de aprovado, volte aqui e gere o contrato de novo. O limite reseta na virada do plano.")}
            </p>
            {excedenteErro && (
              <div
                className="flex items-start gap-2 text-sm rounded-md px-3 py-2.5"
                style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "var(--danger)" }}
              >
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                <span>{excedenteErro}</span>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary text-sm"
                onClick={() => {
                  setExcedente(null);
                  setExcedenteErro(null);
                }}
                disabled={excedenteIndo}
              >
                {t("Cancelar")}
              </button>
              <button
                type="button"
                className="btn btn-primary text-sm disabled:opacity-50 inline-flex items-center gap-1.5"
                style={{ backgroundColor: ACCENT, color: "#fff" }}
                onClick={pagarExcedente}
                disabled={excedenteIndo}
              >
                {excedenteIndo && <Loader2 size={14} className="animate-spin" />}
                {excedenteIndo
                  ? t("Abrindo o pagamento…")
                  : t("Pagar excedente")}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {editaveis.length === 0 ? (
        <div className="card flex flex-col items-center text-center gap-3 py-16">
          <FileText size={26} style={{ color: ACCENT }} />
          <div className="section-title">{t("Nenhum modelo disponível")}</div>
          <p className="text-sm text-muted max-w-sm">
            {t("Crie um modelo de contrato primeiro (Contratos → Modelos) para poder gerar contratos.")}
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[420px_1fr] gap-6 items-start">
          {/* Coluna esquerda: seleção + dados */}
          <div className="flex flex-col gap-4 min-w-0">
            <div className="card flex flex-col gap-3">
              <div className="stat-label" style={{ color: ACCENT }}>
                {t("1. Modelo e venda")}
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-secondary">
                  {t("Modelo de contrato")}
                </span>
                <select
                  value={modeloId}
                  onChange={(e) => setModeloId(e.target.value)}
                  className="campo-input"
                >
                  <option value="">{t("Selecione um modelo…")}</option>
                  {editaveis.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-secondary">
                  {t("Venda (opcional — pré-preenche os dados)")}
                </span>
                <select
                  value={vendaId}
                  onChange={(e) => setVendaId(e.target.value)}
                  className="campo-input"
                >
                  <option value="">{t("Sem venda (preencher manual)")}</option>
                  {vendas.map((v) => {
                    const artista = artistas.find((a) => a.id === v.artistaId);
                    return (
                      <option key={v.id} value={v.id}>
                        {v.numero} · {v.nomeEvento || "evento"} ·{" "}
                        {dataBR(v.dataShow)}
                        {artista ? ` · ${artista.name}` : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>

            {modelo && (
              <div className="card flex flex-col gap-4">
                <div className="stat-label" style={{ color: ACCENT }}>
                  {t("2. Dados do contrato")}
                </div>
                <p className="text-xs text-muted -mt-2">
                  {t("Pré-preenchido pela venda. Edite o que precisar; o que ficar vazio aparece como")}{" "}<code>{"{{token}}"}</code>{" "}{t("no contrato.")}
                </p>
                {grupos.map(([grupo, vars]) => (
                  <div key={grupo} className="flex flex-col gap-2">
                    <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted">
                      {t(grupo)}
                    </div>
                    {vars.map((v) => (
                      <label key={v.token} className="flex flex-col gap-1">
                        <span className="text-xs text-secondary">{t(v.label)}</span>
                        {LONGOS.has(v.token) ? (
                          <textarea
                            value={valores[v.token] ?? ""}
                            onChange={(e) => setValor(v.token, e.target.value)}
                            rows={2}
                            className="campo-input resize-y leading-relaxed"
                          />
                        ) : (
                          <input
                            type="text"
                            value={valores[v.token] ?? ""}
                            onChange={(e) => setValor(v.token, e.target.value)}
                            className="campo-input"
                          />
                        )}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Coluna direita: preview + ações */}
          <div className="min-w-0">
            {!modelo ? (
              <div className="card flex flex-col items-center text-center gap-3 py-16">
                <FileSignature size={26} style={{ color: ACCENT }} />
                <div className="section-title">{t("Selecione um modelo")}</div>
                <p className="text-sm text-muted max-w-sm">
                  {t("Escolha um modelo (e opcionalmente uma venda) para ver o contrato preenchido aqui.")}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {gerado ? (
                    <div
                      className="flex items-center gap-2 text-sm rounded-md px-3 py-2 flex-1"
                      style={{
                        backgroundColor: "rgba(34,197,94,0.1)",
                        color: "var(--success)",
                      }}
                    >
                      <Check size={16} />
                      {t("Contrato")} <strong>{gerado.numero}</strong> {t("gerado e salvo no histórico.")}
                    </div>
                  ) : (
                    <div className="flex-1 text-sm text-muted">
                      {t("Confira o preview e gere o contrato.")}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={baixarPdf}
                    disabled={baixando}
                    className="btn btn-secondary"
                    style={{ opacity: baixando ? 0.6 : 1 }}
                  >
                    {baixando ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Download size={15} />
                    )}
                    {baixando ? t("Gerando…") : t("Baixar PDF")}
                  </button>
                  {gerado ? (
                    <button
                      type="button"
                      onClick={() => {
                        setGerado(null);
                        setModeloId("");
                        setVendaId("");
                      }}
                      className="btn"
                      style={{ backgroundColor: ACCENT, color: "#fff" }}
                    >
                      <Plus size={15} />
                      {t("Novo")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => gerar()}
                      disabled={gerando || !podeCriar}
                      title={!podeCriar ? t("Você não tem permissão para isso.") : undefined}
                      className="btn disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: ACCENT,
                        color: "#fff",
                        opacity: gerando || !podeCriar ? 0.6 : 1,
                      }}
                    >
                      {gerando ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <FileSignature size={15} />
                      )}
                      {gerando ? t("Gerando…") : t("Gerar contrato")}
                    </button>
                  )}
                </div>

                <FolhaA4
                  secoes={secoesPreenchidas}
                  estilo={modelo.estilo}
                  folhaRef={folhaRef}
                  conteudoRef={conteudoRef}
                />
              </div>
            )}
          </div>
        </div>
      )}
        </>

      {/* 2. Subir um contrato pronto (PDF) e posicionar as assinaturas. */}
      <div className="border-t border-border mt-12 pt-8">
        <div className="section-title mb-1">
          {t("2. Ou: subir um PDF pronto e posicionar as assinaturas")}
        </div>
        <p className="section-subtitle mb-4">
          {t("Já tem o contrato feito? Envie o PDF, escolha os signatários e posicione onde cada um assina.")}
        </p>
        <NovoContratoUpload />
      </div>
    </div>
  );
}
