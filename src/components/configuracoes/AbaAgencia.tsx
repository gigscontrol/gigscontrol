"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  Check,
  AtSign,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  Building2,
} from "lucide-react";
import Toast from "../Toast";
import Modal from "../Modal";
import { useWorkspace } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth-context";

/**
 * Aba "Agência" das Configurações (admin-only).
 *
 * Identidade da agência em si (não da pessoa que está logada):
 *  - Nome exibido (aparece no topo da dashboard sem logo, e em contratos e
 *    orçamentos gerados pelo sistema)
 *  - Username da agência (slug) — vai pro fim do login de artistas e equipe
 *
 * Extraído da antiga aba "Geral" (rework: Geral virou Perfil + Agência).
 */

// Pega o primeiro nome do admin e normaliza pro mesmo formato dos logins
// (lowercase, sem acentos, só [a-z0-9]) — usado só nos textos de exemplo
// do bloco "Username da agência".
function slugificarPrimeiroNome(nome: string | null | undefined): string {
  if (!nome) return "";
  const primeiro = nome.trim().split(/\s+/)[0] ?? "";
  return primeiro
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

type SlugInfo = {
  slug: string;
  trocasUltimos30d: number;
  trocasRestantes: number;
  limite: number;
};

type CheckResultado = {
  status: "idle" | "checando" | "disponivel" | "em-uso" | "invalido" | "igual";
  mensagem?: string;
};

export default function AbaAgencia() {
  const t = useT();
  const { aparencia, atualizarNomeAgencia } = useWorkspace();
  const { sessao } = useAuth();
  const [nome, setNome] = useState(aparencia.nomeAgencia);
  const [erro, setErro] = useState<string | null>(null);
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: "sucesso" | "erro" } | null>(null);

  // Sincroniza o nome local quando o context recarrega
  useEffect(() => {
    setNome(aparencia.nomeAgencia);
  }, [aparencia.nomeAgencia]);

  async function salvarNome() {
    const limpo = nome.trim();
    if (!limpo) {
      setErro(t("O nome da agência não pode ficar vazio."));
      return;
    }
    setSalvandoNome(true);
    setErro(null);
    try {
      await atualizarNomeAgencia(limpo);
      setToast({ msg: t("Nome salvo."), tipo: "sucesso" });
    } catch (err) {
      setToast({ msg: (err as Error).message, tipo: "erro" });
    } finally {
      setSalvandoNome(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* ---- Nome da agência ---- */}
      <section className="card">
        <div className="flex items-center gap-2 mb-1">
          <Building2 size={16} style={{ color: "var(--brand)" }} />
          <div className="section-title">{t("Nome exibido")}</div>
        </div>
        <div className="section-subtitle mb-4">
          {t("Aparece no topo da dashboard quando não há logo, e também em contratos e orçamentos gerados pelo sistema.")}
        </div>

        <label className="flex flex-col gap-1 mb-3">
          <span className="text-xs font-medium text-secondary">
            {t("Nome da agência")}
          </span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={t("Ex.: TWO DASH, OPUS...")}
            className="campo-input"
            maxLength={40}
          />
        </label>

        <button
          onClick={salvarNome}
          disabled={salvandoNome || nome.trim() === aparencia.nomeAgencia}
          className="btn btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {salvandoNome ? t("Salvando...") : <><Check size={14} /> {t("Salvar nome")}</>}
        </button>
      </section>

      {/* ---- Username da agência ---- */}
      <SlugSection
        primeiroNomeAdmin={slugificarPrimeiroNome(sessao?.usuario?.nome) || "voce"}
        onToast={(msg, tipo) => setToast({ msg, tipo })}
      />

      {erro && (
        <div
          className="text-sm rounded-md px-3 py-2"
          style={{
            backgroundColor: "rgba(239,68,68,0.1)",
            color: "var(--danger)",
          }}
        >
          {erro}
        </div>
      )}

      <Toast
        open={!!toast}
        mensagem={toast?.msg ?? ""}
        tipo={toast?.tipo ?? "sucesso"}
        onClose={() => setToast(null)}
      />
    </div>
  );
}

// ============================================================
// Username da agência — bloco separado por carregar dados próprios
// ============================================================

function SlugSection({
  primeiroNomeAdmin,
  onToast,
}: {
  primeiroNomeAdmin: string;
  onToast: (msg: string, tipo: "sucesso" | "erro") => void;
}) {
  const t = useT();
  const [info, setInfo] = useState<SlugInfo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [novoSlug, setNovoSlug] = useState("");
  const [check, setCheck] = useState<CheckResultado>({ status: "idle" });
  const [confirmandoTroca, setConfirmandoTroca] = useState(false);
  const [trocando, setTrocando] = useState(false);

  // Carrega info do slug atual
  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    fetch("/api/workspace/slug", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as SlugInfo;
      })
      .then((d) => {
        if (!ativo) return;
        setInfo(d);
      })
      .catch(() => {
        if (!ativo) return;
        setInfo(null);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  // Debounce: checa disponibilidade 400ms após parar de digitar
  useEffect(() => {
    const v = novoSlug.trim().toLowerCase();
    if (!v) {
      setCheck({ status: "idle" });
      return;
    }
    if (info && v === info.slug) {
      setCheck({ status: "igual", mensagem: t("Esse é o seu username atual.") });
      return;
    }
    setCheck({ status: "checando" });
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/workspace/slug/disponivel?slug=${encodeURIComponent(v)}`,
          { credentials: "include", signal: ctrl.signal }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { disponivel: boolean; erro?: string };
        if (body.disponivel) {
          setCheck({ status: "disponivel" });
        } else if (body.erro) {
          setCheck({ status: "invalido", mensagem: body.erro });
        } else {
          setCheck({ status: "em-uso", mensagem: t("Já em uso por outra agência.") });
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setCheck({ status: "invalido", mensagem: t("Falha na checagem.") });
        }
      }
    }, 400);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [novoSlug, info, t]);

  const podeAbrirConfirmacao = useMemo(() => {
    if (!info) return false;
    if (info.trocasRestantes <= 0) return false;
    return check.status === "disponivel";
  }, [check.status, info]);

  async function confirmarTroca() {
    if (!info || !novoSlug.trim()) return;
    setTrocando(true);
    try {
      const res = await fetch("/api/workspace/slug/trocar", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: novoSlug.trim().toLowerCase() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body.erro as string) ?? `HTTP ${res.status}`);
      }
      onToast(
        t("Username trocado. {n} login(s) atualizados.", { n: body.usuariosAtualizados ?? 0 }),
        "sucesso"
      );
      setConfirmandoTroca(false);
      setNovoSlug("");
      // Recarrega a página pra que a sessão e o slug em todo lugar
      // batam com o novo. Não é ideal mas é o caminho mais seguro
      // sem reescrever o auth-context inteiro.
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      onToast((e as Error).message, "erro");
    } finally {
      setTrocando(false);
    }
  }

  if (carregando) {
    return (
      <section className="card">
        <div className="flex items-center gap-2 mb-1">
          <AtSign size={16} style={{ color: "var(--brand)" }} />
          <div className="section-title">{t("Username da agência")}</div>
        </div>
        <div className="text-sm text-muted flex items-center gap-2 mt-3">
          <Loader2 size={14} className="animate-spin" /> {t("Carregando...")}
        </div>
      </section>
    );
  }

  if (!info) {
    return (
      <section className="card">
        <div className="flex items-center gap-2 mb-1">
          <AtSign size={16} style={{ color: "var(--brand)" }} />
          <div className="section-title">{t("Username da agência")}</div>
        </div>
        <p className="text-sm text-danger mt-2">
          {t("Não foi possível carregar. Tente recarregar a página.")}
        </p>
      </section>
    );
  }

  const semCota = info.trocasRestantes <= 0;
  const limpo = novoSlug.trim().toLowerCase();

  return (
    <section className="card">
      <div className="flex items-center gap-2 mb-1">
        <AtSign size={16} style={{ color: "var(--brand)" }} />
        <div className="section-title">{t("Username da agência")}</div>
      </div>
      <div className="section-subtitle mb-4">
        {t("Vai pro fim do login de todo artista e da equipe (ex:")} {" "}
        <span className="font-mono text-primary">{primeiroNomeAdmin}-{info.slug}</span>).
        {t("Esse identificador é único: nenhuma outra agência consegue usar.")}
      </div>

      {/* Username atual */}
      <div className="mb-4">
        <div className="text-xs font-medium text-secondary mb-1">
          {t("Atualmente")}
        </div>
        <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2.5">
          <AtSign size={14} className="text-muted flex-shrink-0" />
          <span className="text-sm font-mono text-primary flex-1">
            -{info.slug}
          </span>
        </div>
      </div>

      {/* Novo username */}
      <label className="flex flex-col gap-1 mb-3">
        <span className="text-xs font-medium text-secondary">
          {t("Trocar pra")}
        </span>
        <div
          className="flex items-center gap-2 bg-elevated border rounded-md px-3 py-2 focus-within:border-border-strong transition-colors"
          style={{
            borderColor:
              check.status === "disponivel"
                ? "var(--success)"
                : check.status === "em-uso" || check.status === "invalido"
                ? "var(--danger)"
                : "var(--border-color)",
          }}
        >
          <span className="text-muted text-sm">-</span>
          <input
            value={novoSlug}
            onChange={(e) =>
              setNovoSlug(
                e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
              )
            }
            placeholder={t("ex: twodash2026")}
            disabled={semCota}
            className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted disabled:opacity-50 font-mono"
          />
          {check.status === "checando" && (
            <Loader2 size={14} className="animate-spin text-muted" />
          )}
          {check.status === "disponivel" && (
            <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
          )}
          {(check.status === "em-uso" ||
            check.status === "invalido" ||
            check.status === "igual") && (
            <XCircle size={14} style={{ color: "var(--danger)" }} />
          )}
        </div>
        {check.mensagem && (
          <span
            className="text-xs"
            style={{
              color:
                check.status === "disponivel"
                  ? "var(--success)"
                  : check.status === "igual"
                  ? "var(--text-muted)"
                  : "var(--danger)",
            }}
          >
            {check.mensagem}
          </span>
        )}
        {check.status === "disponivel" && limpo && (
          <span className="text-xs text-success">
            {t("Disponível ✓")}
          </span>
        )}
      </label>

      {/* Cota de trocas */}
      <div
        className="text-xs rounded-md px-3 py-2 mb-3 leading-relaxed"
        style={{
          backgroundColor: semCota
            ? "rgba(239,68,68,0.08)"
            : "rgba(245,158,11,0.08)",
          color: semCota ? "var(--danger)" : "var(--warning)",
          border: semCota
            ? "1px solid rgba(239,68,68,0.2)"
            : "1px solid rgba(245,158,11,0.2)",
        }}
      >
        <div className="flex items-start gap-2">
          <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
          <span>
            {semCota ? (
              <>
                {t("Você atingiu o limite de {n} trocas em 30 dias. Aguarde pra trocar novamente.", { n: info.limite })}
              </>
            ) : (
              <>
                <strong>{t("Trocas restantes:")}</strong> {info.trocasRestantes}/
                {info.limite} {t("(janela móvel de 30 dias). Cada troca muda o login de TODOS os artistas e equipe — avise eles antes.")}
              </>
            )}
          </span>
        </div>
      </div>

      <button
        onClick={() => setConfirmandoTroca(true)}
        disabled={!podeAbrirConfirmacao}
        className="btn btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t("Trocar username")}
      </button>

      {/* Modal de confirmação */}
      <Modal
        isOpen={confirmandoTroca}
        onClose={() => !trocando && setConfirmandoTroca(false)}
        title={t("Confirmar troca de username")}
        subtitle={t("Esta ação muda o login de todo mundo da agência")}
        maxWidth={520}
      >
        <div className="flex flex-col gap-4">
          <div
            className="text-sm rounded-md px-3 py-3 leading-relaxed"
            style={{
              backgroundColor: "rgba(245,158,11,0.08)",
              color: "var(--text-secondary)",
              border: "1px solid rgba(245,158,11,0.2)",
            }}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle
                size={16}
                style={{ color: "var(--warning)" }}
                className="flex-shrink-0 mt-0.5"
              />
              <div>
                <strong className="text-primary">
                  {t("TODOS os logins de artistas e equipe vão mudar.")}
                </strong>
                <br />
                {t("Exemplo:")}{" "}
                <span className="font-mono">{primeiroNomeAdmin}-{info.slug}</span> {t("vai virar")}{" "}
                <span className="font-mono">{primeiroNomeAdmin}-{limpo}</span>.
                <br />
                {t("Avise sua equipe antes de confirmar — eles precisam usar o login novo na próxima entrada.")}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted mb-1">{t("De")}</div>
              <div className="text-sm font-mono bg-elevated border border-border rounded-md px-3 py-2">
                -{info.slug}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">{t("Para")}</div>
              <div
                className="text-sm font-mono rounded-md px-3 py-2"
                style={{
                  backgroundColor: "rgba(34,197,94,0.08)",
                  border: "1px solid rgba(34,197,94,0.2)",
                  color: "var(--success)",
                }}
              >
                -{limpo}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              onClick={() => setConfirmandoTroca(false)}
              disabled={trocando}
              className="btn btn-secondary text-sm"
            >
              {t("Cancelar")}
            </button>
            <button
              onClick={confirmarTroca}
              disabled={trocando}
              className="btn btn-primary text-sm disabled:opacity-50"
            >
              {trocando ? t("Trocando...") : t("Sim, trocar agora")}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
