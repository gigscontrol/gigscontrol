"use client";

import { useCallback, useEffect, useState } from "react";
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
  ShieldCheck,
} from "lucide-react";
import { useWorkspace, WorkspaceProvider } from "@/lib/workspace-context";
import { AuthProvider } from "@/lib/auth-context";
import {
  PLANOS,
  type PlanoId,
  type CicloCobranca,
  getPlano,
  formatarPreco,
  valorMensal,
  valorAnual,
} from "@/lib/planos";
import PlanoCarrossel from "@/components/PlanoCarrossel";
import SeletorGateway from "@/components/checkout/SeletorGateway";
import CidadeGlobalAutocomplete, { type CidadeEscolhida } from "@/components/CidadeGlobalAutocomplete";
import { resolverCidade } from "@/lib/cidade-helpers";
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
  /** Validade do acesso (modelo pré-pago) — fonte de verdade de "plano ok". */
  acessoAte: string | null;
  ciclo?: string;
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
  { id: 3, label: "Pagamento", descricao: "Assinatura" },
  { id: 4, label: "Artista", descricao: "1º artista" },
  { id: 5, label: "Equipe", descricao: "Convidar membro" },
];

/**
 * "Plano ok" (modelo pré-pago) = tem validade de acesso FUTURA
 * (`acessoAte` > agora) — seja por pagamento real (Stripe/MP) ou trial de
 * verdade. O stub "trial sem data" que o checkout cria antes do pagamento
 * NÃO conta, pra não pular o passo sem concluir o pagamento. Cai de volta
 * pro subscriptionStatus (legado) quando `acessoAte` ainda não veio da API.
 */
function planoOkDe(d: Status): boolean {
  if (d.acessoAte) return new Date(d.acessoAte).getTime() > Date.now();
  return (
    d.subscriptionStatus === "ativa" ||
    (d.subscriptionStatus === "trial" && !!d.trialTerminaEm)
  );
}

/**
 * Etapa em que o onboarding deve RETOMAR — a 1ª não concluída. Sem isso o
 * wizard voltava pro passo do plano depois de pagar (loop).
 */
function etapaInicial(d: Status): number {
  // Etapa 1 agora é o cadastro completo (dados pessoais + agência). Volta
  // pra ela enquanto faltarem os campos obrigatórios de pessoa.
  if (!d.pessoa?.documento || !d.pessoa?.dataNascimento) return 1;
  // Pagamento é a etapa 3. Sem plano escolhido → volta pro Plano (2); escolhido
  // mas ainda não pago → fica no Pagamento (3).
  if (!planoOkDe(d)) return d.planoEscolhido ? 3 : 2;
  if (!d.checklist.temArtista) return 4;
  if (!d.checklist.temEquipe) return 5;
  return 5;
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
  // Erro vindo do POST de conclusão (402 = falta plano, 409 = falta artista).
  // O servidor é a fonte da verdade; aqui só exibimos e mandamos pra etapa certa.
  const [erroConclusao, setErroConclusao] = useState<string | null>(null);

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
    setErroConclusao(null);
    try {
      const r = await fetch("/api/workspace/onboarding", {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) {
        // Servidor barrou: 402 = falta plano/pagamento, 409 = falta artista.
        // Mostra o motivo e volta pra etapa que resolve.
        const b = (await r.json().catch(() => ({}))) as { erro?: string };
        setErroConclusao(
          b.erro ?? t("Não foi possível finalizar. Verifique as etapas.")
        );
        // 402 = falta pagamento → passo Pagamento (3); 409 = falta artista → passo Artista (4)
        if (r.status === 402) setEtapa(3);
        else if (r.status === 409) setEtapa(4);
        setFinalizando(false);
        return;
      }
      router.replace("/app");
    } catch {
      setErroConclusao(t("Falha de conexão. Tente novamente."));
      setFinalizando(false);
    }
  }

  function avancar() {
    if (etapa < 5) setEtapa(etapa + 1);
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
              : etapa === 3
                ? "w-full max-w-[920px]"
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
                cicloInicial={status.ciclo}
                planoOk={planoOkDe(status)}
                onAvancar={avancar}
                onContinuarPago={() => setEtapa(etapaInicial(status))}
                onRecarregar={recarregar}
              />
            )}
            {etapa === 3 && (
              <Etapa3Pagamento
                status={status}
                onAvancar={avancar}
                onRecarregar={recarregar}
              />
            )}
            {etapa === 4 && (
              <Etapa4Artista
                status={status}
                onAvancar={avancar}
                onRecarregar={recarregar}
              />
            )}
            {etapa === 5 && (
              <Etapa5Equipe
                status={status}
                onAvancar={avancar}
                onRecarregar={recarregar}
              />
            )}
          </div>

          {/* Erro de conclusão (barrado pelo servidor: falta plano/artista) */}
          {erroConclusao && (
            <div
              className="mt-4 flex items-center gap-2 text-xs rounded-md px-3 py-2"
              style={{
                backgroundColor: "rgba(239,68,68,0.08)",
                color: "var(--danger)",
                border: "1px solid rgba(239,68,68,0.3)",
              }}
            >
              <AlertTriangle size={12} /> {erroConclusao}
            </div>
          )}

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

      // Cidade UNIFICADA: a mesma seleção vira o cidade_id do admin (profile) e
      // a cidade denormalizada da agência (abaixo). Resolve pro UUID do catálogo.
      let cidadeId: string | undefined;
      try {
        cidadeId = (await resolverCidade(cidade)).id;
      } catch {
        /* não bloqueia o onboarding se a cidade não resolver */
      }

      // 1. Dados pessoais → profile (inclui o cidade_id do admin)
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
          ...(cidadeId ? { cidade_id: cidadeId } : {}),
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
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={t("Ex: João Silva")}
            className={campo}
          />
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
  cicloInicial,
  planoOk,
  onAvancar,
  onContinuarPago,
  onRecarregar,
}: {
  planoEscolhido: PlanoId;
  cicloInicial?: string;
  /** Já pagou/ativou: o passo vira read-only ("plano ativo") em vez de cobrar de novo. */
  planoOk: boolean;
  onAvancar: () => void;
  /** Segue DIRETO pro 1º passo pendente (Artista/Equipe), pulando o Pagamento. */
  onContinuarPago: () => void;
  onRecarregar: () => Promise<void>;
}) {
  const t = useT();
  // O plano selecionado é o card CENTRAL do coverflow (índice na escada).
  const [central, setCentral] = useState(() =>
    Math.max(0, PLANOS.findIndex((p) => p.id === (planoEscolhido ?? "individual")))
  );
  const planoSelecionado = PLANOS[central].id;
  const [ciclo, setCiclo] = useState<CicloCobranca>(
    cicloInicial === "anual" ? "anual" : "mensal"
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
        body: JSON.stringify({ plano: planoSelecionado, ciclo }),
      });
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        throw new Error((b.erro as string) ?? `HTTP ${r.status}`);
      }
      // Avança pro passo Pagamento DENTRO do wizard (não sai mais pra /pagamento).
      await onRecarregar();
      onAvancar();
    } catch (e) {
      setErro((e as Error).message);
      setAcao(null);
    }
  }

  // Já pago/ativo: NÃO deixa "pagar de novo" (o escolher-plano devolveria 409 →
  // beco sem saída ao voltar pra cá depois de pagar). Mostra o plano ativo e
  // segue DIRETO pro 1º passo pendente (Artista/Equipe).
  if (planoOk) {
    const p = getPlano(planoSelecionado);
    return (
      <div className="text-center">
        <CheckCircle2
          size={40}
          className="mx-auto mb-3"
          style={{ color: "var(--success)" }}
        />
        <h2 className="text-xl font-bold tracking-tight">
          {t("Seu plano está ativo")}
        </h2>
        <p className="mt-1 text-sm text-secondary">
          {t("Plano")} <strong className="text-primary">{p.nome}</strong>
          {" · "}
          {ciclo === "anual" ? t("Anual") : t("Mensal")}
        </p>
        <p className="mt-2 text-[0.7rem] text-muted">
          {t("Para trocar de plano, acesse Configurações › Plano & Assinatura.")}
        </p>
        <button
          onClick={onContinuarPago}
          className="btn btn-primary text-sm mt-5 justify-center px-6 py-2.5"
          style={{ backgroundColor: "var(--brand)", color: "#fff" }}
        >
          {t("Continuar")}
          <ArrowRight size={14} />
        </button>
      </div>
    );
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

        {/* Toggle Mensal / Anual */}
        <div className="mt-6 flex items-center justify-center">
          <div className="inline-flex items-center gap-1 bg-surface border border-border rounded-full p-1">
            <button
              type="button"
              onClick={() => setCiclo("mensal")}
              className={`text-sm font-medium px-4 py-1.5 rounded-full transition-colors ${
                ciclo === "mensal" ? "bg-elevated text-primary" : "text-muted hover:text-secondary"
              }`}
            >
              {t("Mensal")}
            </button>
            <button
              type="button"
              onClick={() => setCiclo("anual")}
              className={`text-sm font-medium px-4 py-1.5 rounded-full transition-colors inline-flex items-center gap-2 ${
                ciclo === "anual" ? "bg-elevated text-primary" : "text-muted hover:text-secondary"
              }`}
            >
              {t("Anual")}
              <span
                className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full text-white"
                style={{ backgroundColor: "var(--brand)" }}
              >
                {t("ECONOMIZE")}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <PlanoCarrossel
          ciclo={ciclo}
          selecionadoIndex={central}
          onSelecionar={setCentral}
        />
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
// Etapa 3 — Pagamento (checkout embutido no wizard; pula se já pago/trial)
// ============================================================
function Etapa3Pagamento({
  status,
  onAvancar,
  onRecarregar,
}: {
  status: Status;
  onAvancar: () => void;
  onRecarregar: () => Promise<void>;
}) {
  const t = useT();
  const moeda = useMoeda();
  const [usarHosted, setUsarHosted] = useState(false);
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Pagamento aprovado no Mercado Pago (cartão ou PIX): a rota já estendeu o
  // acesso antes de responder — avança o wizard igual ao retorno da Stripe.
  const [confirmadoMp, setConfirmadoMp] = useState(false);
  const degradar = useCallback(() => setUsarHosted(true), []);

  const planoOk = planoOkDe(status) || confirmadoMp;

  const plano = status.planoEscolhido
    ? getPlano(status.planoEscolhido as PlanoId)
    : null;
  const ciclo: CicloCobranca = status.ciclo === "anual" ? "anual" : "mensal";
  const valor = plano
    ? ciclo === "anual"
      ? valorAnual(plano, moeda)
      : valorMensal(plano, moeda)
    : 0;
  const precoFmt = plano ? formatarPreco(valor, moeda) : "—";

  async function irParaHosted() {
    if (indo || !plano) return;
    setErro(null);
    setIndo(true);
    try {
      const res = await fetch("/api/checkout/stripe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: plano.id, ciclo }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        throw new Error((body.erro as string) ?? `HTTP ${res.status}`);
      }
      window.location.href = body.url as string;
    } catch (e) {
      setErro((e as Error).message);
      setIndo(false);
    }
  }

  // Já pago (ou trial de verdade): não mostra checkout — confirma e segue.
  if (planoOk) {
    return (
      <div className="text-center">
        <CheckCircle2
          size={40}
          className="mx-auto mb-3"
          style={{ color: "var(--success)" }}
        />
        <h2 className="text-xl font-bold tracking-tight">
          {t("Pagamento confirmado")}
        </h2>
        <p className="mt-1 text-sm text-secondary">
          {t("Sua assinatura está ativa. Vamos continuar o cadastro.")}
        </p>
        <button
          onClick={onAvancar}
          className="btn btn-primary text-sm mt-5 justify-center px-6 py-2.5"
          style={{ backgroundColor: "var(--brand)", color: "#fff" }}
        >
          {t("Continuar")}
          <ArrowRight size={14} />
        </button>
      </div>
    );
  }

  if (!plano) {
    return (
      <div className="text-center text-sm text-danger">
        {t("Plano não encontrado. Volte ao cadastro pra escolher um.")}
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold tracking-tight">
          {t("Conclua o pagamento")}
        </h2>
      </div>

      {!usarHosted ? (
        <SeletorGateway
          plano={plano.id}
          ciclo={ciclo}
          onFallbackHosted={degradar}
          onSucessoMercadoPago={() => {
            setConfirmadoMp(true);
            void onRecarregar();
          }}
          onSucessoCupom={() => {
            setConfirmadoMp(true);
            void onRecarregar();
          }}
        />
      ) : (
        <div className="card max-w-[560px] mx-auto">
          <div className="section-title mb-3 flex items-center gap-2">
            <ShieldCheck size={16} style={{ color: "var(--brand)" }} />
            {t("Pagamento por cartão")}
          </div>
          <p className="text-sm text-secondary mb-4">
            {t(
              "Você vai pro ambiente seguro de pagamento pra concluir a assinatura."
            )}
          </p>
          {erro && (
            <div
              className="flex items-center gap-2 text-xs rounded-md px-3 py-2 mb-4"
              style={{
                backgroundColor: "rgba(239,68,68,0.08)",
                color: "var(--danger)",
                border: "1px solid rgba(239,68,68,0.3)",
              }}
            >
              <AlertTriangle size={12} className="flex-shrink-0" />
              {erro}
            </div>
          )}
          <button
            onClick={irParaHosted}
            disabled={indo}
            className="btn btn-primary text-sm w-full justify-center py-2.5 disabled:opacity-60"
            style={{ backgroundColor: "var(--brand)", color: "#fff" }}
          >
            {indo ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {t("Abrindo o pagamento seguro...")}
              </>
            ) : (
              <>
                <Lock size={14} />
                {t("Assinar por {preco}", { preco: precoFmt })}
              </>
            )}
          </button>
        </div>
      )}
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
