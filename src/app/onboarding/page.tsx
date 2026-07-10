"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Loader2,
  ArrowRight,
  ArrowLeft,
  PartyPopper,
  Sparkles,
  Music,
  Users,
  Building2,
  Phone,
  MapPin,
  AtSign,
  Lock,
  AlertTriangle,
  Check,
} from "lucide-react";
import { useWorkspace, WorkspaceProvider } from "@/lib/workspace-context";
import { AuthProvider } from "@/lib/auth-context";
import { PLANOS, formatarPreco, valorMensal, type PlanoId } from "@/lib/planos";
import CidadeGlobalAutocomplete, { type CidadeEscolhida } from "@/components/CidadeGlobalAutocomplete";
import InputDataBR from "@/components/inputs/InputDataBR";
import PhoneInput, {
  DEFAULT_COUNTRY,
  contarDigitos,
  type Country,
} from "@/components/PhoneInput";
import { montarTelefoneE164, COUNTRIES } from "@/lib/data/countries";
import { configDocumento, normalizarDocumento } from "@/lib/data/documentos";
import {
  ModalNovoArtista,
  ModalCredenciais,
  SeletorDeCor,
} from "@/components/configuracoes/AbaArtistas";
import { ModalUsuario } from "@/components/configuracoes/AbaEquipe";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useT, useMoeda } from "@/lib/i18n";
import { TRIAL_ATIVADO } from "@/lib/flags";

/**
 * /onboarding — wizard linear de 5 etapas pra novos admins.
 *
 *   1. Bem-vindo ✓
 *   2. Plano (trial grátis 7d fica atrás do flag TRIAL_ATIVADO)
 *   3. Configurar agência (nome + cidade + whatsapp + slug + cor + logo)
 *   4. Cadastrar primeiro artista
 *   5. Convidar primeiro membro da equipe
 *
 * Cada etapa salva no backend antes de avançar. Botão "Pular" disponível
 * na maioria. Etapa 5 termina → marca onboarding_completo + /app.
 */

type Status = {
  onboardingCompleto: boolean;
  subscriptionStatus: string;
  trialTerminaEm: string | null;
  planoEscolhido: string;
  checklist: {
    contaCriada: boolean;
    planoEscolhido: boolean;
    agenciaConfigurada: boolean;
    temArtista: boolean;
    temEquipe: boolean;
  };
  identidade: {
    nomeAgencia: string;
    slug: string;
    whatsapp: string | null;
    corAcento: string | null;
    cidadeIbgeId: string | null;
    cidadeNome: string | null;
    cidadeUf: string | null;
    logoUrl: string | null;
    primeiroNomeAdmin: string | null;
  };
  pessoa: {
    nome: string;
    nomeLegal: string;
    email: string;
    emailVerificado: boolean;
    pais: string;
    documentoTipo: string | null;
    documento: string | null;
    telefone: string | null;
    dataNascimento: string | null;
  };
};

const ETAPAS: { id: number; label: string; descricao: string }[] = [
  { id: 1, label: "Cadastro", descricao: "Seus dados" },
  { id: 2, label: "Plano", descricao: "Escolha do plano" },
  { id: 3, label: "Artista", descricao: "1º DJ" },
  { id: 4, label: "Equipe", descricao: "Convidar membro" },
];

/**
 * Etapa em que o onboarding deve RETOMAR — a 1ª não concluída. Sem isso o
 * wizard voltava pro passo do plano depois de pagar (loop). "Plano feito"
 * = assinatura ATIVA (pagou) OU trial de verdade (status trial + data de
 * término) — o registro "trial sem data" que o checkout cria antes do
 * pagamento NÃO conta, pra não pular o passo sem concluir o pagamento.
 */
function etapaInicial(d: Status): number {
  // Etapa 1 agora é o cadastro completo (dados pessoais + agência). Volta
  // pra ela enquanto faltarem os campos obrigatórios de pessoa.
  if (!d.pessoa?.documento || !d.pessoa?.dataNascimento) return 1;
  const planoOk =
    d.subscriptionStatus === "ativa" ||
    (d.subscriptionStatus === "trial" && !!d.trialTerminaEm);
  if (!planoOk) return 2;
  if (!d.checklist.temArtista) return 3;
  if (!d.checklist.temEquipe) return 4;
  return 4;
}

export default function OnboardingPage() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <OnboardingInner />
      </WorkspaceProvider>
    </AuthProvider>
  );
}

function OnboardingInner() {
  const router = useRouter();
  const t = useT();
  const [status, setStatus] = useState<Status | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [etapa, setEtapa] = useState(1);
  const [finalizando, setFinalizando] = useState(false);

  /**
   * Refetcha o status. Por padrão NÃO toggla `carregando`, pra não
   * desmontar a etapa atual (o que perderia state local — ex: a tela
   * de credenciais geradas na Etapa 4 sumiria). Só o mount inicial
   * passa `{ inicial: true }` pra exibir o spinner full-page.
   */
  async function recarregar(opts?: { inicial?: boolean }) {
    if (opts?.inicial) setCarregando(true);
    try {
      const r = await fetch("/api/workspace/onboarding", {
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = (await r.json()) as Status;
      if (d.onboardingCompleto) {
        router.replace("/app");
        return;
      }
      setStatus(d);
      // Só no carregamento inicial: retoma na 1ª etapa pendente (não
      // reseta a etapa nos refetches que acontecem após salvar um passo).
      if (opts?.inicial) setEtapa(etapaInicial(d));
    } finally {
      if (opts?.inicial) setCarregando(false);
    }
  }

  useEffect(() => {
    void recarregar({ inicial: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function concluir() {
    if (finalizando) return;
    setFinalizando(true);
    try {
      await fetch("/api/workspace/onboarding", {
        method: "POST",
        credentials: "include",
      });
      router.replace("/app");
    } catch {
      setFinalizando(false);
    }
  }

  function avancar() {
    if (etapa < 4) setEtapa(etapa + 1);
    else void concluir();
  }

  function voltar() {
    if (etapa > 1) setEtapa(etapa - 1);
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-main flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" />
          {t("Carregando...")}
        </div>
      </div>
    );
  }

  if (!status) return null;

  return (
    <div className="min-h-screen bg-main text-primary flex flex-col">
      <div
        className="fixed inset-0 opacity-40 pointer-events-none"
        style={{
          background:
            "radial-gradient(700px circle at 50% 0%, rgba(61,123,255,0.15), transparent 60%)",
        }}
      />

      <nav className="relative border-b border-border">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-2">
            <div
              className="rounded-md flex items-center justify-center font-bold text-white h-7 w-7 text-sm"
              style={{ backgroundColor: "var(--brand)" }}
            >
              G
            </div>
            <span className="font-bold tracking-tight text-base">
              GIGS<span className="text-muted"> CONTROL</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <button
              onClick={concluir}
              disabled={finalizando}
              className="text-xs text-muted hover:text-secondary transition-colors disabled:opacity-50"
            >
              {t("Pular tudo")}
            </button>
          </div>
        </div>
      </nav>

      <div className="relative flex-1 flex flex-col items-center px-6 py-10">
        {/* Etapa 2 (plano) precisa de espaço pros 5 cards. Outras etapas
            ficam centradas em largura confortável. */}
        <div
          className={
            etapa === 2
              ? "w-full max-w-[1180px]"
              : "w-full max-w-[680px]"
          }
        >
          {/* Stepper */}
          <Stepper etapaAtual={etapa} />

          {/* Conteúdo */}
          <div className="mt-8">
            {etapa === 1 && (
              <Etapa1Cadastro
                status={status}
                onAvancar={avancar}
                onRecarregar={recarregar}
              />
            )}
            {etapa === 2 && (
              <Etapa2Plano
                planoEscolhido={status.planoEscolhido as PlanoId}
                onAvancar={avancar}
                onRecarregar={recarregar}
              />
            )}
            {etapa === 3 && (
              <Etapa4Artista
                status={status}
                onAvancar={avancar}
                onRecarregar={recarregar}
              />
            )}
            {etapa === 4 && (
              <Etapa5Equipe
                status={status}
                onAvancar={avancar}
                onRecarregar={recarregar}
              />
            )}
          </div>

          {/* Navegação inferior */}
          <div className="mt-6 flex justify-between items-center">
            <button
              onClick={voltar}
              disabled={etapa === 1}
              className="text-xs text-muted hover:text-secondary disabled:opacity-30 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              {t("Voltar")}
            </button>
            <span className="text-xs text-muted">
              {t("Etapa {n} de {total}", { n: etapa, total: ETAPAS.length })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Stepper
// ============================================================
function Stepper({ etapaAtual }: { etapaAtual: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      {ETAPAS.map((e, i) => {
        const concluida = e.id < etapaAtual;
        const ativa = e.id === etapaAtual;
        return (
          <div key={e.id} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
                style={{
                  backgroundColor: concluida
                    ? "var(--success)"
                    : ativa
                    ? "var(--brand)"
                    : "var(--bg-elevated)",
                  color: concluida || ativa ? "#fff" : "var(--text-muted)",
                  border: concluida || ativa ? "none" : "1px solid var(--border-color)",
                }}
              >
                {concluida ? <Check size={14} /> : e.id}
              </div>
              <span
                className="text-[0.65rem] uppercase tracking-wider font-semibold"
                style={{
                  color: ativa
                    ? "var(--text-primary)"
                    : concluida
                    ? "var(--success)"
                    : "var(--text-muted)",
                }}
              >
                {e.label}
              </span>
            </div>
            {i < ETAPAS.length - 1 && (
              <div
                className="h-px flex-1 mx-1 mt-[-14px]"
                style={{
                  backgroundColor: concluida
                    ? "var(--success)"
                    : "var(--border-color)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Etapa 1 — Bem-vindo
// ============================================================
function Etapa1Cadastro({
  status,
  onAvancar,
  onRecarregar,
}: {
  status: Status;
  onAvancar: () => void;
  onRecarregar: () => Promise<void>;
}) {
  const t = useT();
  const { atualizarNomeAgencia } = useWorkspace();
  const id = status.identidade;
  const p = status.pessoa;

  // País de origem — dirige o rótulo/formato do documento e o telefone.
  const [pais, setPais] = useState<string>(p.pais || "BR");
  // Cidade da agência (unificada: vale pra agência).
  const [cidade, setCidade] = useState<CidadeEscolhida | null>(
    id.cidadeIbgeId && id.cidadeNome && id.cidadeUf
      ? { ibgeId: id.cidadeIbgeId, nome: id.cidadeNome, uf: id.cidadeUf, pais: "BR" }
      : null
  );
  const [nomeAgencia, setNomeAgencia] = useState(id.nomeAgencia);
  const [apelido, setApelido] = useState(p.nome || "");
  const [nome, setNome] = useState(p.nomeLegal || "");
  const [nascimento, setNascimento] = useState<string>(p.dataNascimento ?? "");
  const [doc, setDoc] = useState<string>(p.documento ?? "");

  // Telefone — unificado com o WhatsApp da agência.
  const telE164 = id.whatsapp ?? p.telefone ?? "";
  const paisCountry =
    COUNTRIES.find((c) => c.code === (p.pais || "BR")) ?? DEFAULT_COUNTRY;
  const [telCountry, setTelCountry] = useState<Country>(paisCountry);
  const [telDigits, setTelDigits] = useState<string>(() => {
    const digs = telE164.replace(/\D/g, "");
    return digs.startsWith(paisCountry.ddi)
      ? digs.slice(paisCountry.ddi.length)
      : digs;
  });
  const [cor, setCor] = useState<string>(id.corAcento ?? "#3D7BFF");
  const slugAtual = id.slug ?? "";
  const [slug, setSlug] = useState<string>(slugAtual);
  const [slugCheck, setSlugCheck] = useState<
    "idle" | "checando" | "ok" | "em-uso" | "invalido"
  >(slugAtual ? "ok" : "idle");
  const [slugMsg, setSlugMsg] = useState<string | null>(null);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Debounce do check de disponibilidade do username/slug (400ms)
  useEffect(() => {
    const v = slug.trim().toLowerCase();
    if (!v) {
      setSlugCheck("idle");
      setSlugMsg(null);
      return;
    }
    if (v === slugAtual) {
      setSlugCheck("ok");
      setSlugMsg("Username atual");
      return;
    }
    setSlugCheck("checando");
    setSlugMsg(null);
    const ctrl = new AbortController();
    const tm = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/workspace/slug/disponivel?slug=${encodeURIComponent(v)}`,
          { credentials: "include", signal: ctrl.signal }
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const body = (await r.json()) as { disponivel: boolean; erro?: string };
        if (body.disponivel) {
          setSlugCheck("ok");
          setSlugMsg("Disponível");
        } else if (body.erro) {
          setSlugCheck("invalido");
          setSlugMsg(body.erro);
        } else {
          setSlugCheck("em-uso");
          setSlugMsg("Já em uso por outra agência.");
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setSlugCheck("invalido");
          setSlugMsg("Falha na checagem.");
        }
      }
    }, 400);
    return () => {
      ctrl.abort();
      clearTimeout(tm);
    };
  }, [slug, slugAtual]);

  const docCfg = configDocumento(pais);
  const campo =
    "bg-elevated border border-border rounded-md px-3 py-2 text-sm text-primary focus:border-border-strong outline-none";

  // Um país só: o seletor do campo Cidade é a fonte da verdade. Ao trocar o
  // país (ou escolher cidade de outro país), o documento e o DDI do telefone
  // seguem junto.
  function sincronizarPais(code: string) {
    setPais(code);
    const cc = COUNTRIES.find((x) => x.code === code);
    if (cc) setTelCountry(cc);
  }

  async function salvar() {
    setErro(null);
    if (!apelido.trim()) return setErro(t("Informe seu apelido."));
    if (!nome.trim()) return setErro(t("Informe seu nome completo."));
    if (!nomeAgencia.trim()) return setErro(t("Informe o nome da agência."));
    if (!cidade) return setErro(t("Informe a cidade."));
    if (!nascimento) return setErro(t("Informe a data de nascimento."));
    if (!doc.trim()) return setErro(t("Informe o documento."));
    if (contarDigitos(telDigits) < telCountry.minDigits)
      return setErro(t("Telefone incompleto."));
    if (!slug.trim()) return setErro(t("Informe o username da agência."));
    if (slug.trim() !== slugAtual && slugCheck !== "ok") {
      return setErro(t("Username inválido ou em uso."));
    }

    setSalvando(true);
    try {
      const telefone = montarTelefoneE164(telCountry, telDigits);
      const docNorm = normalizarDocumento(pais, doc);
      const docTipo =
        pais === "BR" ? (docNorm.length > 11 ? "cnpj" : "cpf") : "doc";

      // 1. Dados pessoais → profile
      const rp = await fetch("/api/perfil", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: apelido.trim(),
          nome_legal: nome.trim(),
          pais,
          documento_tipo: docTipo,
          documento: docNorm,
          telefone,
          data_nascimento: nascimento,
        }),
      });
      if (!rp.ok) {
        const b = await rp.json().catch(() => ({}));
        throw new Error((b.erro as string) ?? t("Falha ao salvar seus dados."));
      }

      // 2. Nome da agência (atualiza a sidebar)
      if (nomeAgencia.trim() !== id.nomeAgencia) {
        await atualizarNomeAgencia(nomeAgencia.trim());
      }

      // 2b. Username da agência (se mudou) — rota especial sem cota
      if (slug.trim() !== slugAtual) {
        const rs = await fetch("/api/workspace/slug/definir-inicial", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: slug.trim().toLowerCase() }),
        });
        if (!rs.ok) {
          const b = await rs.json().catch(() => ({}));
          throw new Error((b.erro as string) ?? t("Falha ao definir username."));
        }
      }

      // 3. Cidade + WhatsApp da agência (o telefone vale pra agência)
      const rw = await fetch("/api/workspace", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsapp: telefone,
          cor_acento: cor,
          cidade_ibge_id: cidade.ibgeId ?? "",
          cidade_nome: cidade.nome,
          cidade_uf: cidade.uf,
        }),
      });
      if (!rw.ok) {
        const b = await rw.json().catch(() => ({}));
        throw new Error((b.erro as string) ?? `HTTP ${rw.status}`);
      }

      await onRecarregar();
      onAvancar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold tracking-tight">
          {t("Complete seu cadastro")}
        </h2>
        <p className="mt-1 text-sm text-secondary">
          {t("Esses dados aparecem nos seus contratos e orçamentos.")}
        </p>
      </div>

      <div className="card flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-secondary">
            {t("Apelido")} <span className="text-danger">*</span>
          </span>
          <input
            value={apelido}
            onChange={(e) => setApelido(e.target.value)}
            placeholder={t("Como te chamam")}
            className={campo}
          />
          <span className="text-[0.7rem] text-muted">
            {t("É o nome que aparece pros outros usuários da sua agência.")}
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-secondary">
            {t("País e cidade")} <span className="text-danger">*</span>
          </span>
          <CidadeGlobalAutocomplete
            value={cidade}
            onChange={(c) => {
              setCidade(c);
              if (c?.pais) sincronizarPais(c.pais);
            }}
            onPaisChange={(country) => sincronizarPais(country.code)}
          />
          <span className="text-[0.7rem] text-muted">
            {t("O país aqui define o seu documento e o DDI do telefone.")}
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-secondary">
            {t("Nome completo")} <span className="text-danger">*</span>
          </span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={campo} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-secondary">
            {t("Data de nascimento")} <span className="text-danger">*</span>
          </span>
          {pais === "BR" ? (
            <InputDataBR value={nascimento} onChange={setNascimento} />
          ) : (
            <input
              type="date"
              value={nascimento}
              onChange={(e) => setNascimento(e.target.value)}
              className={campo}
            />
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-secondary">
            {docCfg.label} <span className="text-danger">*</span>
          </span>
          <input
            value={docCfg.format(doc)}
            onChange={(e) => setDoc(e.target.value)}
            placeholder={docCfg.placeholder}
            className={`${campo} placeholder:text-muted`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-secondary">{t("E-mail")}</span>
          <div
            className="flex items-center gap-2 border rounded-md px-3 py-2"
            style={{
              backgroundColor: p.emailVerificado
                ? "rgba(34,197,94,0.08)"
                : "transparent",
              borderColor: p.emailVerificado
                ? "var(--success)"
                : "var(--border-color)",
            }}
          >
            <input
              value={p.email}
              disabled
              className="flex-1 bg-transparent outline-none text-sm text-muted cursor-not-allowed"
            />
            {p.emailVerificado && (
              <Check
                size={14}
                style={{ color: "var(--success)" }}
                className="flex-shrink-0"
              />
            )}
          </div>
          {p.emailVerificado ? (
            <span
              className="text-[0.7rem]"
              style={{ color: "var(--success)" }}
            >
              {t("E-mail verificado — é o seu login e não pode ser alterado.")}
            </span>
          ) : (
            <span className="text-[0.7rem] text-muted">
              {t("O e-mail é seu login e não pode ser alterado.")}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-secondary">
            {t("Telefone")} <span className="text-danger">*</span>
          </span>
          <PhoneInput
            country={telCountry}
            onCountryChange={setTelCountry}
            value={telDigits}
            onChange={setTelDigits}
          />
        </label>

        <SeletorDeCor cor={cor} onChange={setCor} />

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-secondary">
            {t("Nome da agência")} <span className="text-danger">*</span>
          </span>
          <input
            value={nomeAgencia}
            onChange={(e) => setNomeAgencia(e.target.value)}
            maxLength={40}
            className={campo}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-secondary">
            {t("Username da agência")} <span className="text-danger">*</span>
          </span>
          <div
            className="flex items-center gap-1 bg-elevated border rounded-md px-3 py-2 focus-within:border-border-strong transition-colors"
            style={{
              borderColor:
                slugCheck === "ok"
                  ? "var(--success)"
                  : slugCheck === "em-uso" || slugCheck === "invalido"
                  ? "var(--danger)"
                  : "var(--border-color)",
            }}
          >
            <span className="text-muted text-sm">-</span>
            <input
              value={slug}
              onChange={(e) =>
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }
              placeholder="ex: agenciaelo"
              className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted font-mono"
              maxLength={30}
            />
            {slugCheck === "checando" && (
              <Loader2 size={14} className="animate-spin text-muted" />
            )}
            {slugCheck === "ok" && (
              <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
            )}
          </div>
          {slugMsg && (
            <span
              className="text-[0.7rem]"
              style={{
                color:
                  slugCheck === "ok" || slug === slugAtual
                    ? "var(--success)"
                    : "var(--danger)",
              }}
            >
              {slugMsg}
            </span>
          )}
          <span className="text-[0.65rem] text-muted leading-relaxed">
            {t("Vai pro fim do login dos seus artistas e equipe (ex:")}{" "}
            <span className="font-mono text-primary">
              {id.primeiroNomeAdmin || "voce"}-{slug || "agencia"}
            </span>
            {t("). Cada agência tem um username único — ninguém mais pode usar.")}
          </span>
        </label>

        {erro && (
          <div
            className="flex items-center gap-2 text-xs rounded-md px-3 py-2"
            style={{
              backgroundColor: "rgba(239,68,68,0.08)",
              color: "var(--danger)",
              border: "1px solid rgba(239,68,68,0.3)",
            }}
          >
            <AlertTriangle size={12} /> {erro}
          </div>
        )}

        <button
          onClick={salvar}
          disabled={salvando}
          className="btn btn-primary text-sm w-full justify-center py-2.5 disabled:opacity-60"
          style={{ backgroundColor: "var(--brand)", color: "#fff" }}
        >
          {salvando ? (
            <>
              <Loader2 size={14} className="animate-spin" /> {t("Salvando...")}
            </>
          ) : (
            <>
              {t("Salvar e continuar")} <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Etapa 2 — Plano (todos os 6; trial só no Individual, atrás do flag TRIAL_ATIVADO)
// ============================================================
function Etapa2Plano({
  planoEscolhido,
  onAvancar,
  onRecarregar,
}: {
  planoEscolhido: PlanoId;
  onAvancar: () => void;
  onRecarregar: () => Promise<void>;
}) {
  const router = useRouter();
  const t = useT();
  const moeda = useMoeda();
  const [planoSelecionado, setPlanoSelecionado] = useState<PlanoId>(
    planoEscolhido ?? "individual"
  );
  const [acao, setAcao] = useState<null | "trial" | "pagar">(null);
  const [erro, setErro] = useState<string | null>(null);

  const isIndividual = planoSelecionado === "individual";

  async function iniciarTrial() {
    if (!isIndividual) return; // proteção; backend tb valida
    setAcao("trial");
    setErro(null);
    try {
      const r = await fetch("/api/workspace/iniciar-trial", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: "individual" }),
      });
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        throw new Error((b.erro as string) ?? `HTTP ${r.status}`);
      }
      await onRecarregar();
      onAvancar();
    } catch (e) {
      setErro((e as Error).message);
      setAcao(null);
    }
  }

  async function irParaPagamento() {
    setAcao("pagar");
    setErro(null);
    try {
      // Salva o plano escolhido em workspaces.plano sem ativar a
      // subscription. O /pagamento mock lê de lá e processa o checkout.
      const r = await fetch("/api/workspace/escolher-plano", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: planoSelecionado }),
      });
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        throw new Error((b.erro as string) ?? `HTTP ${r.status}`);
      }
      router.push("/pagamento");
    } catch (e) {
      setErro((e as Error).message);
      setAcao(null);
    }
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold tracking-tight">{t("Escolha o plano")}</h2>
        {TRIAL_ATIVADO ? (
          <p className="mt-1 text-sm text-secondary">
            {t("Plano")} <strong className="text-warning">Individual</strong> {t("tem")}{" "}
            <strong className="text-warning">{t("7 dias grátis")}</strong> {t("sem cartão.")}{" "}
            {t("Demais planos: cobrança imediata.")}
          </p>
        ) : (
          <p className="mt-1 text-sm text-secondary">
            {t("Escolha o plano ideal para a sua agência. Você pode trocar de plano quando quiser.")}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        {PLANOS.map((p) => {
          const sel = planoSelecionado === p.id;
          const popular = p.id === "individual";
          const temTrial = p.id === "individual";
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlanoSelecionado(p.id)}
              className="card text-left transition-all hover:border-border-strong relative flex flex-col"
              style={{
                borderColor: sel ? "var(--brand)" : undefined,
                boxShadow: sel ? "0 0 0 1px var(--brand)" : undefined,
                paddingTop: (TRIAL_ATIVADO && temTrial) || popular ? 24 : undefined,
              }}
            >
              {/* Badges no topo */}
              <div className="absolute top-0 left-3 right-3 flex flex-wrap gap-1" style={{ transform: "translateY(-50%)" }}>
                {popular && (
                  <span
                    className="text-[0.55rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-white"
                    style={{ backgroundColor: "var(--brand)" }}
                  >
                    {t("Mais popular")}
                  </span>
                )}
                {TRIAL_ATIVADO && temTrial && (
                  <span
                    className="text-[0.55rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-black"
                    style={{ backgroundColor: "#fbbf24" }}
                  >
                    {t("Teste grátis 7 dias")}
                  </span>
                )}
              </div>

              <div className="text-sm font-bold text-primary">{p.nome}</div>
              <div className="text-[0.65rem] text-muted mb-2 line-clamp-2">{p.tagline}</div>
              <div className="mb-2">
                <span className="text-base font-bold text-primary">
                  {formatarPreco(valorMensal(p, moeda), moeda)}
                </span>
                <span className="text-[0.6rem] text-muted">{t("/mês")}</span>
              </div>
              <ul className="flex flex-col gap-1 text-[0.65rem] text-secondary flex-1">
                {p.recursos.slice(0, 3).map((r) => (
                  <li key={r} className="flex items-start gap-1">
                    <Check size={9} className="mt-0.5 flex-shrink-0" style={{ color: "var(--success)" }} />
                    <span className="line-clamp-2">{r}</span>
                  </li>
                ))}
              </ul>
              {sel && (
                <div
                  className="absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "var(--brand)" }}
                >
                  <Check size={12} className="text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {erro && (
        <div
          className="flex items-center gap-2 text-xs rounded-md px-3 py-2 mb-3"
          style={{
            backgroundColor: "rgba(239,68,68,0.08)",
            color: "var(--danger)",
            border: "1px solid rgba(239,68,68,0.3)",
          }}
        >
          <AlertTriangle size={12} />
          {erro}
        </div>
      )}

      <div className="flex flex-col gap-2 max-w-[480px] mx-auto">
        {/* Botão primário: pagar agora (todos os planos) */}
        <button
          onClick={irParaPagamento}
          disabled={acao !== null}
          className="btn btn-primary text-sm w-full justify-center py-2.5 disabled:opacity-60"
          style={{ backgroundColor: "var(--brand)", color: "#fff" }}
        >
          {acao === "pagar" ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {t("Indo pro pagamento...")}
            </>
          ) : (
            <>
              {t("Continuar e pagar agora")}
              <ArrowRight size={14} />
            </>
          )}
        </button>

        {/* Botão amarelo: trial grátis (só Individual, atrás do flag) */}
        {TRIAL_ATIVADO && isIndividual && (
          <button
            onClick={iniciarTrial}
            disabled={acao !== null}
            className="text-sm w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-md font-medium disabled:opacity-60 text-black"
            style={{ backgroundColor: "#fbbf24" }}
          >
            {acao === "trial" ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {t("Iniciando...")}
              </>
            ) : (
              <>
                <Sparkles size={14} />
                {t("Começar teste grátis (7 dias)")}
              </>
            )}
          </button>
        )}

        {/* Se não é Individual, lembra que não tem trial */}
        {TRIAL_ATIVADO && !isIndividual && (
          <p className="text-[0.65rem] text-muted text-center">
            {t("Teste grátis disponível apenas no plano Individual.")}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Etapa 4 — Primeiro artista (usa o MESMO modal de Configurações)
// ============================================================
function Etapa4Artista({
  status,
  onAvancar,
  onRecarregar,
}: {
  status: Status;
  onAvancar: () => void;
  onRecarregar: () => Promise<void>;
}) {
  const t = useT();
  const { artistas, adicionarArtista, recarregarArtistas } = useWorkspace();
  // Lê do status que vem do /api/workspace/onboarding (refrescado a cada
  // onRecarregar). NÃO usa useAuth().sessao.workspace.slug porque essa
  // referência é carregada UMA vez no mount e fica stale depois que a
  // Etapa 3 troca o slug.
  const slug = status.identidade.slug ?? "";
  const nomeAgencia = status.identidade.nomeAgencia ?? "";

  // Refresh dos artistas ao montar — garante que a validação de "nome
  // já existe" rode contra o DB real (não contra cache stale).
  useEffect(() => {
    void recarregarArtistas();
  }, [recarregarArtistas]);

  const [credenciais, setCredenciais] = useState<{
    nomeArtista: string;
    username: string;
    senha: string;
  } | null>(null);

  // Se já tem credenciais geradas, mostra elas
  if (credenciais) {
    return (
      <div>
        <div className="text-center mb-6">
          <CheckCircle2
            size={32}
            className="mx-auto mb-3"
            style={{ color: "var(--success)" }}
          />
          <h2 className="text-xl font-bold tracking-tight">{t("Artista cadastrado!")}</h2>
          <p className="mt-1 text-sm text-secondary">
            {t("Anote agora — a senha não aparece de novo.")}
          </p>
        </div>

        <ModalCredenciais
          nomeArtista={credenciais.nomeArtista}
          username={credenciais.username}
          senha={credenciais.senha}
          onFechar={() => {
            setCredenciais(null);
            onAvancar();
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-6">
        <Music
          size={32}
          className="mx-auto mb-3"
          style={{ color: "var(--brand)" }}
        />
        <h2 className="text-xl font-bold tracking-tight">
          {t("Cadastre seu primeiro artista")}
        </h2>
        <p className="mt-1 text-sm text-secondary max-w-md mx-auto">
          {t("O cadastro completo inclui cidade, taxa de agência e rider — você vai conseguir gerar orçamentos pra ele em seguida.")}
        </p>
      </div>

      {/* Formulário completo embedado direto (sem modal — etapa obrigatória) */}
      <ModalNovoArtista
        modoInline
        slugAgencia={slug}
        nomeAgencia={nomeAgencia}
        adicionarArtista={adicionarArtista}
        nomesExistentes={artistas.map((a) => a.name.toLowerCase())}
        // Workspace recém-criado no onboarding: lixeira ainda vazia.
        nomesNaLixeira={[]}
        usernamesExistentes={[]}
        usernamesNaLixeira={[]}
        onCancelar={() => {
          /* inline: sem cancelar */
        }}
        onCriado={async (resultado) => {
          setCredenciais(resultado);
          await onRecarregar();
        }}
      />
    </div>
  );
}

// ============================================================
// Etapa 5 — Convidar primeiro membro da equipe
// ============================================================
function Etapa5Equipe({
  status,
  onAvancar,
  onRecarregar,
}: {
  status: Status;
  onAvancar: () => void;
  onRecarregar: () => Promise<void>;
}) {
  const t = useT();
  const { adicionarUsuario } = useWorkspace();
  // Lê o slug do status (fresco a cada onRecarregar) — mesma razão da
  // Etapa 4: useAuth().sessao.workspace.slug fica stale após a Etapa 3.
  const slug = status.identidade.slug ?? "";
  const [resultado, setResultado] = useState<{ senha: string; login: string } | null>(null);

  return (
    <div>
      <div className="text-center mb-6">
        <Users
          size={32}
          className="mx-auto mb-3"
          style={{ color: "var(--brand)" }}
        />
        <h2 className="text-xl font-bold tracking-tight">{t("Convide a equipe")}</h2>
        <p className="mt-1 text-sm text-secondary max-w-md mx-auto">
          {t("Cadastre quem vai te ajudar a tocar a agência — o acesso é criado na hora. As permissões você define depois, por artista. Pode pular se ainda tá começando sozinho.")}
        </p>
      </div>

      {resultado ? (
        <div className="card text-center">
          <CheckCircle2 size={32} className="mx-auto mb-3" style={{ color: "var(--success)" }} />
          <h3 className="text-base font-bold">{t("Equipe convidada!")}</h3>
          <p className="text-sm text-secondary mt-1 mb-4">
            {t("Mande pra essa pessoa:")}
          </p>
          <div className="bg-elevated rounded-md p-3 text-left flex flex-col gap-2">
            <div>
              <div className="text-[0.65rem] text-muted">{t("Login")}</div>
              <div className="font-mono text-sm text-primary">{resultado.login}</div>
            </div>
            <div>
              <div className="text-[0.65rem] text-muted">{t("Senha temporária")}</div>
              <div className="font-mono text-sm text-primary">{resultado.senha}</div>
            </div>
          </div>
          <button
            onClick={onAvancar}
            className="btn btn-primary text-sm w-full justify-center py-2.5 mt-4"
            style={{ backgroundColor: "var(--brand)", color: "#fff" }}
          >
            {t("Terminar")}
            <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <>
          {/* Form COMPLETO da equipe — reusa o ModalUsuario da dashboard
              inline (igual a Etapa do Artista faz com ModalNovoArtista),
              pra o membro nascer com apelido/país/nascimento/documento/
              e-mail/telefone/cor + login + artistas, idêntico ao "Criar
              usuário". A criação e as credenciais são tratadas aqui. */}
          <div className="card">
            <ModalUsuario
              modoInline
              modo="criar"
              slugAgencia={slug}
              onFechar={() => {}}
              onEditar={() => {}}
              onCriar={async (dados) => {
                const r = await adicionarUsuario(dados);
                setResultado({
                  senha: r.senhaTemporaria,
                  login: r.usuario.username ?? "",
                });
                await onRecarregar();
              }}
            />
          </div>
          <button
            onClick={onAvancar}
            className="text-xs text-muted hover:text-secondary block mx-auto mt-3"
          >
            {t("Pular e finalizar")}
          </button>
        </>
      )}
    </div>
  );
}
