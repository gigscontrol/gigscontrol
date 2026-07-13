"use client";

import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, Loader2, CalendarClock, X, Sparkles } from "lucide-react";
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
import CheckoutEmbutido from "@/components/checkout/CheckoutEmbutido";

/**
 * Aba Plano & Assinatura (Configurações — admin). MODELO PRÉ-PAGO por
 * validade: mostra até quando o acesso vale (`acessoAte`/`diasRestantes`,
 * vindos de /api/assinatura/estado) em vez de "próxima cobrança". Upgrade
 * abre um checkout (pagamento único do plano novo, ciclo inteiro) mostrando
 * o `creditoDias` que o preview concede pelos dias já pagos no plano atual —
 * sem rateio/cobrança proporcional imediata (isso não existe mais no
 * pré-pago). Downgrade continua "agendado pra próxima renovação" (o corte
 * real é a expiração da validade atual, sem reembolso). Se há um downgrade
 * agendado, mostra o aviso com opção de cancelar.
 */

type PreviewUp = {
  ciclo: CicloCobranca;
  moeda: Moeda;
  diasRestantes: number;
  creditoDias: number;
  diasConcedidos: number;
} | null;
type Excedente = { dimensao: string; usoAtual: number; limite: number; remover: number };
type PreviewDown = {
  cabe: boolean;
  excedentes: Excedente[];
  mensagem: string | null;
  valorNovo: number;
  moeda: Moeda;
  ciclo: CicloCobranca;
  efetivoEm: string | null;
} | null;

export default function AbaPlano() {
  const t = useT();
  const moedaRegiao = useMoeda();

  const [carregando, setCarregando] = useState(true);
  const [plano, setPlano] = useState<PlanoId | null>(null);
  const [ciclo, setCiclo] = useState<CicloCobranca>("mensal");
  const [status, setStatus] = useState<string | null>(null);
  const [moeda, setMoeda] = useState<Moeda | null>(null);
  const [acessoAte, setAcessoAte] = useState<string | null>(null);
  const [diasRestantes, setDiasRestantes] = useState(0);
  const [downgradePara, setDowngradePara] = useState<PlanoId | null>(null);
  const [downgradeEm, setDowngradeEm] = useState<string | null>(null);

  // upgrade
  const [selUp, setSelUp] = useState<PlanoId | null>(null);
  const [prevUp, setPrevUp] = useState<PreviewUp>(null);
  const [loadUp, setLoadUp] = useState(false);
  const [checkoutAberto, setCheckoutAberto] = useState(false);
  const [checkoutHosted, setCheckoutHosted] = useState(false);

  // downgrade
  const [selDown, setSelDown] = useState<PlanoId | null>(null);
  const [prevDown, setPrevDown] = useState<PreviewDown>(null);
  const [loadDown, setLoadDown] = useState(false);
  const [confDown, setConfDown] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    try {
      const res = await fetch("/api/assinatura/estado", { credentials: "include" });
      const b = await res.json();
      setPlano((b?.plano ?? null) as PlanoId | null);
      setCiclo(b?.ciclo === "anual" ? "anual" : "mensal");
      setStatus(b?.status ?? null);
      setMoeda((b?.moeda ?? null) as Moeda | null);
      setAcessoAte((b?.acessoAte ?? null) as string | null);
      setDiasRestantes(Number(b?.diasRestantes) || 0);
      setDowngradePara((b?.downgradePara ?? null) as PlanoId | null);
      setDowngradeEm(b?.downgradeEfetivoEm ?? null);
    } catch {
      /* silencioso */
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => {
    void carregar();
  }, []);

  const moedaFmt: Moeda = moeda ?? moedaRegiao;
  const fmtData = (iso: string | null) =>
    iso ? new Date(iso + "T00:00:00").toLocaleDateString() : "—";

  // ---------- upgrade ----------
  // MODELO PRÉ-PAGO: a prévia só calcula o creditoDias (sem cobrar nada). A
  // cobrança real acontece no checkout (embutido) — 1 ciclo inteiro do plano
  // novo + os dias de crédito, concedidos pelo webhook ao aprovar.
  async function escolherUp(p: PlanoId) {
    setSelUp(p);
    setSelDown(null);
    setPrevUp(null);
    setPrevDown(null);
    setCheckoutAberto(false);
    setErro(null);
    setMsg(null);
    setLoadUp(true);
    try {
      const res = await fetch("/api/assinatura/preview-upgrade", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: p }),
      });
      const b = await res.json();
      if (!res.ok) {
        setErro(b.erro ?? t("Falha ao estimar o upgrade."));
        return;
      }
      setPrevUp(b);
    } catch {
      setErro(t("Falha ao estimar o upgrade."));
    } finally {
      setLoadUp(false);
    }
  }

  function irParaCheckoutUpgrade() {
    if (!selUp) return;
    setErro(null);
    setCheckoutHosted(false);
    setCheckoutAberto(true);
  }


  // ---------- downgrade ----------
  async function escolherDown(p: PlanoId) {
    setSelDown(p);
    setSelUp(null);
    setPrevDown(null);
    setPrevUp(null);
    setErro(null);
    setMsg(null);
    setLoadDown(true);
    try {
      const res = await fetch("/api/assinatura/preview-downgrade", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: p }),
      });
      const b = await res.json();
      if (!res.ok) {
        setErro(b.erro ?? t("Falha ao estimar o downgrade."));
        return;
      }
      setPrevDown(b);
    } catch {
      setErro(t("Falha ao estimar o downgrade."));
    } finally {
      setLoadDown(false);
    }
  }

  async function confirmarDown() {
    if (!selDown) return;
    setConfDown(true);
    setErro(null);
    try {
      const res = await fetch("/api/assinatura/downgrade", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: selDown }),
      });
      const b = await res.json();
      if (!res.ok) {
        setErro(b.erro ?? t("Falha ao agendar o downgrade."));
        return;
      }
      setMsg(t("Downgrade agendado. Você mantém o plano atual até a virada."));
      setSelDown(null);
      setPrevDown(null);
      await carregar();
    } catch {
      setErro(t("Falha ao agendar o downgrade."));
    } finally {
      setConfDown(false);
    }
  }

  async function cancelarDown() {
    setCancelando(true);
    setErro(null);
    try {
      const res = await fetch("/api/assinatura/cancelar-downgrade", {
        method: "POST",
        credentials: "include",
      });
      const b = await res.json();
      if (!res.ok) {
        setErro(b.erro ?? t("Falha ao cancelar o downgrade."));
        return;
      }
      setMsg(t("Downgrade cancelado. Você segue no plano atual."));
      await carregar();
    } catch {
      setErro(t("Falha ao cancelar o downgrade."));
    } finally {
      setCancelando(false);
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
  const downgrades = PLANOS.filter((p) => tierPlano(p.id) < atualTier);
  const ativa = status === "ativa";
  const pendente = !!downgradePara;

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* Plano atual — modelo pré-pago: validade em vez de próxima cobrança */}
      <section className="card flex flex-col gap-1">
        <div className="stat-label">{t("Plano atual")}</div>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-lg font-bold text-primary">
            {plano ? getPlano(plano).nome : "—"}
          </span>
          {plano && (
            <span className="text-sm text-muted">
              {formatarPreco(precoPorMes(getPlano(plano), ciclo, moedaFmt), moedaFmt)}/
              {t("mês")} · {t(ciclo === "anual" ? "anual" : "mensal")}
            </span>
          )}
        </div>
        {acessoAte && (
          <p className="text-sm text-secondary mt-1">
            {t("Acesso válido até {data} ({n} dias restantes)", {
              data: fmtData(acessoAte.slice(0, 10)),
              n: diasRestantes,
            })}
          </p>
        )}
        {!ativa && (
          <p className="text-xs text-warning mt-1">
            {t("Mudanças de plano só ficam disponíveis com a assinatura ativa (paga).")}
          </p>
        )}
      </section>

      {msg && (
        <div className="text-sm" style={{ color: "var(--success)" }}>
          {msg}
        </div>
      )}

      {/* Downgrade AGENDADO — enquanto pendente, trava upgrade/downgrade */}
      {pendente ? (
        <section
          className="card flex flex-col gap-3"
          style={{ borderColor: "var(--warning)" }}
        >
          <div className="flex items-center gap-2">
            <CalendarClock size={16} style={{ color: "var(--warning)" }} />
            <div className="font-semibold text-primary">
              {t("Downgrade agendado")}
            </div>
          </div>
          <p className="text-sm text-secondary">
            {t(
              "Você passa para o plano {alvo}{quando}. Até lá, mantém o plano {atual} e todos os seus benefícios — sem reembolso dos dias já pagos. Na virada, a cobrança passa a ser menor.",
              {
                alvo: getPlano(downgradePara!).nome,
                quando: downgradeEm ? ` ${t("em")} ${fmtData(downgradeEm)}` : "",
                atual: plano ? getPlano(plano).nome : "—",
              }
            )}
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={cancelando}
              onClick={cancelarDown}
              className="btn btn-secondary text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <X size={14} />
              {cancelando ? t("Cancelando…") : t("Cancelar downgrade")}
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* Upgrades */}
          {upgrades.length > 0 && (
            <section className="flex flex-col gap-2">
              <div className="section-title">{t("Fazer upgrade")}</div>
              {upgrades.map((p) => {
                const sel = selUp === p.id;
                return (
                  <div key={p.id} className="card flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-primary">{p.nome}</div>
                        <div className="text-xs text-muted truncate">
                          {p.maxArtistas} {t("artistas")} · {p.maxUsuariosAdicionais} {t("usuários")} ·{" "}
                          {formatarPreco(precoPorMes(p, ciclo, moedaFmt), moedaFmt)}/{t("mês")}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!ativa || loadUp}
                        onClick={() => escolherUp(p.id)}
                        className="btn btn-secondary text-sm inline-flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
                        style={sel ? { borderColor: "var(--brand)", color: "var(--brand)" } : undefined}
                      >
                        <ArrowUp size={14} /> {t("Fazer upgrade")}
                      </button>
                    </div>

                    {sel && (
                      <div className="border-t border-border pt-3 flex flex-col gap-2">
                        {loadUp ? (
                          <div className="text-sm text-muted flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin" /> {t("Calculando o crédito…")}
                          </div>
                        ) : prevUp && !checkoutAberto ? (
                          <>
                            <p className="text-sm text-secondary">
                              {t("Você paga um ciclo inteiro do plano {nome} no checkout.", {
                                nome: p.nome,
                              })}{" "}
                              {prevUp.creditoDias > 0 ? (
                                <>
                                  {t("Pelos {dias} dias que ainda restam no seu plano atual, você ganha")}{" "}
                                  <span className="font-bold text-primary">
                                    {t("+{n} dias", { n: prevUp.creditoDias })}
                                  </span>{" "}
                                  {t("de acesso no plano novo — sem cobrança proporcional, sem rateio.")}
                                </>
                              ) : (
                                t("Sem dias restantes pra converter em crédito — o upgrade começa do zero de validade.")
                              )}
                            </p>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                className="btn btn-secondary text-sm"
                                onClick={() => {
                                  setSelUp(null);
                                  setPrevUp(null);
                                }}
                              >
                                {t("Cancelar")}
                              </button>
                              <button
                                type="button"
                                onClick={irParaCheckoutUpgrade}
                                className="btn btn-primary text-sm inline-flex items-center gap-1.5"
                                style={{ backgroundColor: "var(--brand)", color: "#fff" }}
                              >
                                <Sparkles size={14} />
                                {t("Ir para o pagamento")}
                              </button>
                            </div>
                          </>
                        ) : prevUp && checkoutAberto ? (
                          checkoutHosted ? (
                            <CheckoutHostedFallback
                              plano={p.id}
                              ciclo={prevUp.ciclo}
                              creditoDias={prevUp.creditoDias}
                              t={t}
                            />
                          ) : (
                            <CheckoutEmbutido
                              plano={p.id}
                              ciclo={prevUp.ciclo}
                              creditoDias={prevUp.creditoDias}
                              onIndisponivel={() => setCheckoutHosted(true)}
                            />
                          )
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          {/* Downgrades */}
          {downgrades.length > 0 && (
            <section className="flex flex-col gap-2">
              <div className="section-title">{t("Fazer downgrade")}</div>
              <p className="text-xs text-muted">
                {t("O downgrade vale só na próxima renovação (sem reembolso). Você mantém o plano atual até os dias já pagos acabarem.")}
              </p>
              {downgrades.map((p) => {
                const sel = selDown === p.id;
                return (
                  <div key={p.id} className="card flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-primary">{p.nome}</div>
                        <div className="text-xs text-muted truncate">
                          {p.maxArtistas} {t("artistas")} · {p.maxUsuariosAdicionais} {t("usuários")} ·{" "}
                          {formatarPreco(precoPorMes(p, ciclo, moedaFmt), moedaFmt)}/{t("mês")}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!ativa || loadDown}
                        onClick={() => escolherDown(p.id)}
                        className="btn btn-secondary text-sm inline-flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
                        style={sel ? { borderColor: "var(--warning)", color: "var(--warning)" } : undefined}
                      >
                        <ArrowDown size={14} /> {t("Fazer downgrade")}
                      </button>
                    </div>

                    {sel && (
                      <div className="border-t border-border pt-3 flex flex-col gap-2">
                        {loadDown ? (
                          <div className="text-sm text-muted flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin" /> {t("Verificando…")}
                          </div>
                        ) : prevDown ? (
                          prevDown.cabe ? (
                            <>
                              <p className="text-sm text-secondary">
                                {t("Você mantém o plano {atual} até {data}. A partir daí paga", {
                                  atual: plano ? getPlano(plano).nome : "—",
                                  data: fmtData(prevDown.efetivoEm),
                                })}{" "}
                                <span className="font-bold text-primary">
                                  {formatarPreco(prevDown.valorNovo, prevDown.moeda)}
                                </span>{" "}
                                ({t(prevDown.ciclo === "anual" ? "anual" : "mensal")}).{" "}
                                {t("Sem reembolso dos dias já pagos.")}
                              </p>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  className="btn btn-secondary text-sm"
                                  onClick={() => {
                                    setSelDown(null);
                                    setPrevDown(null);
                                  }}
                                >
                                  {t("Cancelar")}
                                </button>
                                <button
                                  type="button"
                                  disabled={confDown}
                                  onClick={confirmarDown}
                                  className="btn btn-primary text-sm disabled:opacity-50"
                                  style={{ backgroundColor: "var(--warning)", color: "#000" }}
                                >
                                  {confDown ? t("Agendando…") : t("Confirmar downgrade")}
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="text-sm text-warning">{prevDown.mensagem}</p>
                              <p className="text-xs text-muted">
                                {t("Remova o que exceder o limite do plano e tente de novo.")}
                              </p>
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  className="btn btn-secondary text-sm"
                                  onClick={() => {
                                    setSelDown(null);
                                    setPrevDown(null);
                                  }}
                                >
                                  {t("Fechar")}
                                </button>
                              </div>
                            </>
                          )
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          {upgrades.length === 0 && downgrades.length === 0 && (
            <div className="text-sm text-muted">{t("Você já está no único plano disponível.")}</div>
          )}
          {upgrades.length === 0 && downgrades.length > 0 && (
            <div className="text-xs text-muted">{t("Você já está no plano mais alto. 🎉")}</div>
          )}
        </>
      )}

      {erro && <div className="text-xs text-danger">{erro}</div>}

      <p className="text-[0.7rem] text-muted">
        {t("Cancelamento da assinatura: fale com o suporte por enquanto.")}
      </p>
    </div>
  );
}

/**
 * Fallback quando o Embedded Checkout não está disponível (sem chave
 * pública) — mesmo padrão do /pagamento e do BloqueioModal: botão que cria a
 * Checkout Session hospedada e redireciona.
 */
function CheckoutHostedFallback({
  plano,
  ciclo,
  creditoDias,
  t,
}: {
  plano: PlanoId;
  ciclo: CicloCobranca;
  creditoDias: number;
  t: ReturnType<typeof useT>;
}) {
  const [indo, setIndo] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  async function ir() {
    if (indo) return;
    setIndo(true);
    setErroLocal(null);
    try {
      const res = await fetch("/api/checkout/stripe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano, ciclo, creditoDias }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        throw new Error((body.erro as string) ?? `HTTP ${res.status}`);
      }
      window.location.href = body.url as string;
    } catch (e) {
      setErroLocal((e as Error).message);
      setIndo(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {erroLocal && <p className="text-xs text-danger">{erroLocal}</p>}
      <button
        type="button"
        onClick={ir}
        disabled={indo}
        className="btn btn-primary text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
        style={{ backgroundColor: "var(--brand)", color: "#fff" }}
      >
        {indo ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {indo ? t("Abrindo o pagamento seguro…") : t("Ir para o pagamento seguro")}
      </button>
    </div>
  );
}
