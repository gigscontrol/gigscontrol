"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { useT, useMoeda } from "@/lib/i18n";
import {
  PLANOS,
  getPlano,
  precoPorMes,
  formatarPreco,
  tierPlano,
  type PlanoId,
  type CicloCobranca,
  type Moeda,
} from "@/lib/planos";

/**
 * Aba Plano & Assinatura (Configurações — admin). Mostra o plano atual e,
 * se a assinatura está ativa, os planos superiores como opção de UPGRADE:
 * ao escolher, mostra a estimativa do valor rateado a pagar agora e, na
 * confirmação, chama o Stripe (rateio real, cobra a diferença na hora).
 */

type Preview = { valorAgora: number; moeda: Moeda; diasRestantes: number } | null;

export default function AbaPlano() {
  const t = useT();
  const moedaRegiao = useMoeda();

  const [carregando, setCarregando] = useState(true);
  const [plano, setPlano] = useState<PlanoId | null>(null);
  const [ciclo, setCiclo] = useState<CicloCobranca>("mensal");
  const [status, setStatus] = useState<string | null>(null);

  const [selecionado, setSelecionado] = useState<PlanoId | null>(null);
  const [preview, setPreview] = useState<Preview>(null);
  const [carregandoPreview, setCarregandoPreview] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    try {
      const res = await fetch("/api/workspace", { credentials: "include" });
      const body = await res.json();
      const ws = body.workspace;
      setPlano((ws?.plano ?? null) as PlanoId | null);
      setCiclo(ws?.ciclo === "anual" ? "anual" : "mensal");
      setStatus(ws?.status ?? null);
    } catch {
      /* silencioso */
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => {
    void carregar();
  }, []);

  async function escolher(p: PlanoId) {
    setSelecionado(p);
    setPreview(null);
    setErro(null);
    setMsg(null);
    setCarregandoPreview(true);
    try {
      const res = await fetch("/api/assinatura/preview-upgrade", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: p }),
      });
      const body = await res.json();
      if (!res.ok) {
        setErro(body.erro ?? t("Falha ao estimar o upgrade."));
        return;
      }
      setPreview(body);
    } catch {
      setErro(t("Falha ao estimar o upgrade."));
    } finally {
      setCarregandoPreview(false);
    }
  }

  async function confirmar() {
    if (!selecionado) return;
    setConfirmando(true);
    setErro(null);
    try {
      const res = await fetch("/api/assinatura/upgrade", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: selecionado }),
      });
      const body = await res.json();
      if (!res.ok) {
        setErro(body.erro ?? t("Falha ao cobrar o upgrade. Verifique o cartão."));
        return;
      }
      setMsg(t("Upgrade feito! O novo plano já está ativo."));
      setSelecionado(null);
      setPreview(null);
      await carregar();
    } catch {
      setErro(t("Falha ao cobrar o upgrade. Verifique o cartão."));
    } finally {
      setConfirmando(false);
    }
  }

  if (carregando) {
    return (
      <div className="text-sm text-muted p-2 flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> {t("Carregando…")}
      </div>
    );
  }

  const atualTier = plano ? tierPlano(plano) : -1;
  const upgrades = PLANOS.filter((p) => tierPlano(p.id) > atualTier);
  const ativa = status === "ativa";

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* Plano atual */}
      <section className="card flex flex-col gap-1">
        <div className="stat-label">{t("Plano atual")}</div>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-lg font-bold text-primary">
            {plano ? getPlano(plano).nome : "—"}
          </span>
          {plano && (
            <span className="text-sm text-muted">
              {formatarPreco(precoPorMes(getPlano(plano), ciclo, moedaRegiao), moedaRegiao)}/
              {t("mês")} · {t(ciclo === "anual" ? "anual" : "mensal")}
            </span>
          )}
        </div>
        {!ativa && (
          <p className="text-xs text-warning mt-1">
            {t("O upgrade com rateio só fica disponível com a assinatura ativa (paga).")}
          </p>
        )}
      </section>

      {msg && (
        <div className="text-sm" style={{ color: "var(--success)" }}>
          {msg}
        </div>
      )}

      {/* Upgrades */}
      {upgrades.length === 0 ? (
        <div className="text-sm text-muted">{t("Você já está no plano mais alto. 🎉")}</div>
      ) : (
        <section className="flex flex-col gap-2">
          <div className="section-title">{t("Fazer upgrade")}</div>
          {upgrades.map((p) => {
            const sel = selecionado === p.id;
            return (
              <div key={p.id} className="card flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-primary">{p.nome}</div>
                    <div className="text-xs text-muted truncate">
                      {p.maxArtistas} {t("artistas")} · {p.maxUsuariosAdicionais} {t("usuários")} ·{" "}
                      {formatarPreco(precoPorMes(p, ciclo, moedaRegiao), moedaRegiao)}/{t("mês")}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!ativa || carregandoPreview}
                    onClick={() => escolher(p.id)}
                    className="btn btn-secondary text-sm inline-flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
                    style={sel ? { borderColor: "var(--module-vendas)", color: "var(--module-vendas)" } : undefined}
                  >
                    <ArrowUp size={14} /> {t("Fazer upgrade")}
                  </button>
                </div>

                {sel && (
                  <div className="border-t border-border pt-3 flex flex-col gap-2">
                    {carregandoPreview ? (
                      <div className="text-sm text-muted flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" /> {t("Calculando o rateio…")}
                      </div>
                    ) : preview ? (
                      <>
                        <p className="text-sm text-secondary">
                          {t("Você paga agora cerca de")}{" "}
                          <span className="font-bold text-primary">
                            {formatarPreco(preview.valorAgora, preview.moeda)}
                          </span>
                          .{" "}
                          {t("Rateado pelos {n} dias restantes; o Stripe credita o que sobra do plano atual e o valor exato é confirmado na cobrança.", { n: preview.diasRestantes })}
                        </p>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="btn btn-secondary text-sm"
                            onClick={() => {
                              setSelecionado(null);
                              setPreview(null);
                            }}
                          >
                            {t("Cancelar")}
                          </button>
                          <button
                            type="button"
                            disabled={confirmando}
                            onClick={confirmar}
                            className="btn btn-primary text-sm disabled:opacity-50"
                            style={{ backgroundColor: "var(--module-vendas)", color: "#fff" }}
                          >
                            {confirmando ? t("Cobrando…") : t("Confirmar e pagar")}
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {erro && <div className="text-xs text-danger">{erro}</div>}

      <p className="text-[0.7rem] text-muted">
        {t("Downgrade e cancelamento: fale com o suporte por enquanto.")}
      </p>
    </div>
  );
}
