"use client";

import { useEffect, useRef, useState } from "react";
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
  Image as ImageIcon,
  Palette,
  AtSign,
  Lock,
  Mail,
  AlertTriangle,
  Check,
} from "lucide-react";
import { useWorkspace, WorkspaceProvider } from "@/lib/workspace-context";
import { useAuth, AuthProvider } from "@/lib/auth-context";
import { PLANOS, formatarPreco, type PlanoId } from "@/lib/planos";
import CidadeIBGEAutocomplete, {
  type CidadeIBGE,
} from "@/components/CidadeIBGEAutocomplete";
import ColorPicker from "@/components/ColorPicker";
import PhoneInput, {
  DEFAULT_COUNTRY,
  contarDigitos,
  type Country,
} from "@/components/PhoneInput";
import { montarTelefoneE164 } from "@/lib/data/countries";
import {
  ModalNovoArtista,
  ModalCredenciais,
} from "@/components/configuracoes/AbaArtistas";

/**
 * /onboarding — wizard linear de 5 etapas pra novos admins.
 *
 *   1. Bem-vindo ✓
 *   2. Plano (com opção trial grátis 7d)
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
    whatsapp: string | null;
    corAcento: string | null;
    cidadeIbgeId: string | null;
    cidadeNome: string | null;
    cidadeUf: string | null;
    logoUrl: string | null;
  };
};

const ETAPAS: { id: number; label: string; descricao: string }[] = [
  { id: 1, label: "Conta", descricao: "Conta criada" },
  { id: 2, label: "Plano", descricao: "Escolha do plano" },
  { id: 3, label: "Agência", descricao: "Identidade" },
  { id: 4, label: "Artista", descricao: "1º DJ" },
  { id: 5, label: "Equipe", descricao: "Convidar membro" },
];

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
  const [status, setStatus] = useState<Status | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [etapa, setEtapa] = useState(1);
  const [finalizando, setFinalizando] = useState(false);

  async function recarregar() {
    setCarregando(true);
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
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void recarregar();
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
          Carregando...
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
            "radial-gradient(700px circle at 50% 0%, rgba(168,85,247,0.15), transparent 60%)",
        }}
      />

      <nav className="relative border-b border-border">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-2">
            <div
              className="rounded-md flex items-center justify-center font-bold text-white h-7 w-7 text-sm"
              style={{ backgroundColor: "var(--module-vendas)" }}
            >
              G
            </div>
            <span className="font-bold tracking-tight text-base">
              GIGS<span className="text-muted"> CONTROL</span>
            </span>
          </div>
          <button
            onClick={concluir}
            disabled={finalizando}
            className="text-xs text-muted hover:text-secondary transition-colors disabled:opacity-50"
          >
            Pular tudo
          </button>
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
              <Etapa1Bemvindo
                nomeAgencia={status.identidade.nomeAgencia}
                onAvancar={avancar}
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
              <Etapa3Agencia
                status={status}
                onAvancar={avancar}
                onRecarregar={recarregar}
              />
            )}
            {etapa === 4 && (
              <Etapa4Artista
                onAvancar={avancar}
                onRecarregar={recarregar}
              />
            )}
            {etapa === 5 && (
              <Etapa5Equipe
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
              Voltar
            </button>
            <span className="text-xs text-muted">
              Etapa {etapa} de {ETAPAS.length}
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
                    ? "var(--module-vendas)"
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
function Etapa1Bemvindo({
  nomeAgencia,
  onAvancar,
}: {
  nomeAgencia: string;
  onAvancar: () => void;
}) {
  return (
    <div className="text-center">
      <div
        className="h-16 w-16 mx-auto rounded-full flex items-center justify-center mb-4"
        style={{
          background:
            "linear-gradient(135deg, rgba(168,85,247,0.2), rgba(168,85,247,0.05))",
          color: "var(--module-vendas)",
        }}
      >
        <PartyPopper size={28} />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">
        Bem-vindo ao GIGS CONTROL!
      </h1>
      <p className="mt-2 text-sm text-secondary max-w-md mx-auto">
        Sua conta da{" "}
        <strong className="text-primary">{nomeAgencia}</strong> está criada.
        Vamos configurar os essenciais em 4 passos rápidos.
      </p>
      <button
        onClick={onAvancar}
        className="btn btn-primary text-sm mt-6 py-2.5 px-6"
        style={{ backgroundColor: "var(--module-vendas)", color: "#fff" }}
      >
        <Sparkles size={14} />
        Vamos lá
        <ArrowRight size={14} />
      </button>
    </div>
  );
}

// ============================================================
// Etapa 2 — Plano (todos os 5 + trial só no Individual)
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
        <h2 className="text-xl font-bold tracking-tight">Escolha o plano</h2>
        <p className="mt-1 text-sm text-secondary">
          Plano <strong className="text-warning">Individual</strong> tem{" "}
          <strong className="text-warning">7 dias grátis</strong> sem cartão.
          Demais planos: cobrança imediata.
        </p>
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
                borderColor: sel ? "var(--module-vendas)" : undefined,
                boxShadow: sel ? "0 0 0 1px var(--module-vendas)" : undefined,
                paddingTop: temTrial || popular ? 24 : undefined,
              }}
            >
              {/* Badges no topo */}
              <div className="absolute top-0 left-3 right-3 flex flex-wrap gap-1" style={{ transform: "translateY(-50%)" }}>
                {popular && (
                  <span
                    className="text-[0.55rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-white"
                    style={{ backgroundColor: "var(--module-vendas)" }}
                  >
                    Mais popular
                  </span>
                )}
                {temTrial && (
                  <span
                    className="text-[0.55rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-black"
                    style={{ backgroundColor: "#fbbf24" }}
                  >
                    Teste grátis 7 dias
                  </span>
                )}
              </div>

              <div className="text-sm font-bold text-primary">{p.nome}</div>
              <div className="text-[0.65rem] text-muted mb-2 line-clamp-2">{p.tagline}</div>
              <div className="mb-2">
                <span className="text-base font-bold text-primary">
                  {formatarPreco(p.precoMensal)}
                </span>
                <span className="text-[0.6rem] text-muted">/mês</span>
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
                  style={{ backgroundColor: "var(--module-vendas)" }}
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
        {/* Botão verde: pagar agora (todos os planos) */}
        <button
          onClick={irParaPagamento}
          disabled={acao !== null}
          className="btn btn-primary text-sm w-full justify-center py-2.5 disabled:opacity-60"
          style={{ backgroundColor: "var(--success)", color: "#fff" }}
        >
          {acao === "pagar" ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Indo pro pagamento...
            </>
          ) : (
            <>
              Continuar e pagar agora
              <ArrowRight size={14} />
            </>
          )}
        </button>

        {/* Botão amarelo: trial grátis (só Individual) */}
        {isIndividual && (
          <button
            onClick={iniciarTrial}
            disabled={acao !== null}
            className="text-sm w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-md font-medium disabled:opacity-60 text-black"
            style={{ backgroundColor: "#fbbf24" }}
          >
            {acao === "trial" ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Iniciando...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Começar teste grátis (7 dias)
              </>
            )}
          </button>
        )}

        {/* Se não é Individual, lembra que não tem trial */}
        {!isIndividual && (
          <p className="text-[0.65rem] text-muted text-center">
            Teste grátis disponível apenas no plano Individual.
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Etapa 3 — Configurar agência
// ============================================================
function Etapa3Agencia({
  status,
  onAvancar,
  onRecarregar,
}: {
  status: Status;
  onAvancar: () => void;
  onRecarregar: () => Promise<void>;
}) {
  const { uploadLogo, atualizarNomeAgencia } = useWorkspace();
  const { sessao } = useAuth();
  const slugAtual = sessao?.workspace?.slug ?? "";
  const id = status.identidade;

  // Normaliza um nome em slug (lowercase, sem acentos, só [a-z0-9])
  function normalizarSlug(s: string): string {
    return s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  // Nome
  const [nome, setNome] = useState(id.nomeAgencia);
  // Slug — pré-popula com o slug que o signup gerou automaticamente.
  // Auto-preenche enquanto o usuário não tocar manualmente (igual artista).
  const [slug, setSlug] = useState<string>(slugAtual);
  const [slugEditado, setSlugEditado] = useState(false);
  const [slugCheck, setSlugCheck] = useState<
    "idle" | "checando" | "ok" | "em-uso" | "invalido"
  >("idle");
  const [slugMsg, setSlugMsg] = useState<string | null>(null);
  // Cidade (autocomplete IBGE)
  const [cidade, setCidade] = useState<CidadeIBGE | null>(
    id.cidadeIbgeId && id.cidadeNome && id.cidadeUf
      ? { ibgeId: id.cidadeIbgeId, nome: id.cidadeNome, uf: id.cidadeUf }
      : null
  );
  // WhatsApp
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [telDigits, setTelDigits] = useState(() => {
    const tel = id.whatsapp ?? "";
    const digs = tel.replace(/\D/g, "");
    return digs.startsWith("55") && digs.length >= 12 ? digs.slice(2) : digs;
  });
  // Cor de preferência
  const [cor, setCor] = useState<string>(id.corAcento ?? "#a855f7");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  // Logo
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [logoLocal, setLogoLocal] = useState<string | null>(id.logoUrl);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Auto-fill: quando o nome muda e o user ainda não tocou no slug,
  // espelha o nome normalizado
  function aoMudarNome(novo: string) {
    setNome(novo);
    if (!slugEditado) {
      setSlug(normalizarSlug(novo));
    }
  }

  // Debounce do check de disponibilidade do slug (400ms)
  useEffect(() => {
    const v = slug.trim().toLowerCase();
    if (!v) {
      setSlugCheck("idle");
      setSlugMsg(null);
      return;
    }
    // Mesmo slug atual: já está OK (a gente vai pular o update no salvar)
    if (v === slugAtual) {
      setSlugCheck("ok");
      setSlugMsg("Username atual");
      return;
    }
    setSlugCheck("checando");
    setSlugMsg(null);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
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
      clearTimeout(t);
    };
  }, [slug, slugAtual]);

  async function aoSelecionarLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErro("Use um arquivo de imagem.");
      return;
    }
    setEnviandoLogo(true);
    try {
      // Redimensionamento via canvas (igual ao da AbaGeral)
      const blob = await new Promise<Blob>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const escala = 96 / img.height;
            let largura = img.width * escala;
            let altura = 96;
            if (largura > 420) {
              const e2 = 420 / largura;
              largura = 420;
              altura = altura * e2;
            }
            const canvas = document.createElement("canvas");
            canvas.width = largura * 2;
            canvas.height = altura * 2;
            const ctx = canvas.getContext("2d");
            if (!ctx) return reject(new Error("canvas indisponível"));
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/png");
          };
          img.onerror = () => reject(new Error("imagem inválida"));
          img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
      });
      await uploadLogo(blob);
      setLogoLocal(URL.createObjectURL(blob));
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviandoLogo(false);
    }
  }

  async function salvar() {
    setErro(null);
    if (!nome.trim()) return setErro("Informe o nome da agência.");
    if (!cidade) return setErro("Informe a cidade da agência.");
    if (contarDigitos(telDigits) < country.minDigits)
      return setErro("WhatsApp incompleto.");
    if (!slug.trim()) return setErro("Informe o username da agência.");
    if (slug.trim() !== slugAtual && slugCheck !== "ok") {
      return setErro("Username inválido ou em uso.");
    }

    setSalvando(true);
    try {
      // 1. Se o slug mudou, define agora (rota especial sem cota)
      if (slug.trim() !== slugAtual) {
        const rs = await fetch("/api/workspace/slug/definir-inicial", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: slug.trim().toLowerCase() }),
        });
        if (!rs.ok) {
          const b = await rs.json().catch(() => ({}));
          throw new Error((b.erro as string) ?? "Falha ao definir username.");
        }
      }
      // 2. Nome via workspace-context (atualiza sidebar)
      if (nome.trim() !== id.nomeAgencia) {
        await atualizarNomeAgencia(nome.trim());
      }
      // 3. Resto numa única chamada
      const r = await fetch("/api/workspace", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsapp: montarTelefoneE164(country, telDigits),
          cor_acento: cor,
          cidade_ibge_id: cidade.ibgeId,
          cidade_nome: cidade.nome,
          cidade_uf: cidade.uf,
        }),
      });
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        throw new Error((b.erro as string) ?? `HTTP ${r.status}`);
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
        <h2 className="text-xl font-bold tracking-tight">Sua agência</h2>
        <p className="mt-1 text-sm text-secondary">
          Esses dados aparecem nos orçamentos e na dashboard.
        </p>
      </div>

      <div className="card flex flex-col gap-4">
        {/* Nome */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-secondary">
            Nome da agência <span className="text-danger">*</span>
          </span>
          <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2 focus-within:border-border-strong transition-colors">
            <Building2 size={14} className="text-muted flex-shrink-0" />
            <input
              value={nome}
              onChange={(e) => aoMudarNome(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted"
              maxLength={40}
            />
          </div>
        </label>

        {/* Username da agência (slug) */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-secondary">
            Username da agência <span className="text-danger">*</span>
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
              onChange={(e) => {
                setSlugEditado(true);
                setSlug(
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                );
              }}
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
            Vai pro fim do login dos seus artistas e equipe (ex:{" "}
            <span className="font-mono text-primary">dudu-{slug || "agencia"}</span>).
            Cada agência tem um username único — ninguém mais pode usar.
          </span>
        </label>

        {/* Cidade */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-secondary">
            Cidade onde fica <span className="text-danger">*</span>
          </span>
          <CidadeIBGEAutocomplete
            value={cidade}
            onChange={setCidade}
            placeholder="Ex: São Paulo, Belo Horizonte..."
          />
        </label>

        {/* WhatsApp */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-secondary">
            WhatsApp <span className="text-danger">*</span>
          </span>
          <PhoneInput
            country={country}
            onCountryChange={setCountry}
            value={telDigits}
            onChange={setTelDigits}
          />
        </label>

        {/* Cor */}
        <CampoCor cor={cor} onChange={setCor} aberto={colorPickerOpen} setAberto={setColorPickerOpen} />

        {/* Logo */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-secondary">
            Logo (opcional)
          </span>
          <div className="flex items-center gap-3">
            <div
              className="h-12 w-20 rounded-md border border-border bg-elevated flex items-center justify-center overflow-hidden flex-shrink-0"
            >
              {logoLocal ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoLocal} alt="Logo" style={{ maxHeight: 32 }} />
              ) : (
                <ImageIcon size={16} className="text-muted" />
              )}
            </div>
            <label className="btn btn-secondary text-xs cursor-pointer">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={aoSelecionarLogo}
                className="hidden"
              />
              {enviandoLogo ? "Enviando..." : "Enviar logo"}
            </label>
          </div>
        </div>

        {erro && (
          <div
            className="flex items-center gap-2 text-xs rounded-md px-3 py-2"
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

        <button
          onClick={salvar}
          disabled={salvando}
          className="btn btn-primary text-sm w-full justify-center py-2.5 disabled:opacity-60"
          style={{ backgroundColor: "var(--module-vendas)", color: "#fff" }}
        >
          {salvando ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              Salvar e continuar
              <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Campo de cor com botão "pílula" + popover do ColorPicker quando aberto.
 * Usa useRef no botão pra ancorar o popover de forma correta (sem
 * gambiarra com document.activeElement).
 */
function CampoCor({
  cor,
  onChange,
  aberto,
  setAberto,
}: {
  cor: string;
  onChange: (c: string) => void;
  aberto: boolean;
  setAberto: (v: boolean) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <div className="flex flex-col gap-1.5 relative">
      <span className="text-xs font-medium text-secondary">Cor de preferência</span>
      <button
        ref={ref}
        type="button"
        onClick={() => setAberto(!aberto)}
        className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2 hover:border-border-strong transition-colors"
      >
        <span
          className="h-5 w-5 rounded-full flex-shrink-0"
          style={{ backgroundColor: cor }}
        />
        <span className="font-mono text-sm text-primary flex-1 text-left">
          {cor.toUpperCase()}
        </span>
        <Palette size={14} className="text-muted" />
      </button>
      {aberto && (
        <ColorPicker
          cor={cor}
          anchorRef={ref}
          onApply={(c) => {
            onChange(c);
            setAberto(false);
          }}
          onClose={() => setAberto(false)}
        />
      )}
    </div>
  );
}

// ============================================================
// Etapa 4 — Primeiro artista (usa o MESMO modal de Configurações)
// ============================================================
function Etapa4Artista({
  onAvancar,
  onRecarregar,
}: {
  onAvancar: () => void;
  onRecarregar: () => Promise<void>;
}) {
  const { artistas, adicionarArtista } = useWorkspace();
  const { sessao } = useAuth();
  const slug = sessao?.workspace?.slug ?? "";
  const nomeAgencia = sessao?.workspace?.nome ?? "";

  const [modalAberto, setModalAberto] = useState(false);
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
          <h2 className="text-xl font-bold tracking-tight">Artista cadastrado!</h2>
          <p className="mt-1 text-sm text-secondary">
            Anote agora — a senha não aparece de novo.
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
          style={{ color: "var(--module-vendas)" }}
        />
        <h2 className="text-xl font-bold tracking-tight">
          Cadastre seu primeiro artista
        </h2>
        <p className="mt-1 text-sm text-secondary max-w-md mx-auto">
          O cadastro completo inclui cidade, taxa de agência e rider — você
          vai conseguir gerar orçamentos pra ele em seguida.
        </p>
      </div>

      <div className="card flex flex-col gap-3 items-center text-center">
        <p className="text-sm text-secondary">
          Pode pular agora e adicionar artistas depois em{" "}
          <strong className="text-primary">Configurações → Artistas</strong>.
        </p>
        <div className="flex flex-col gap-2 w-full max-w-[280px]">
          <button
            onClick={() => setModalAberto(true)}
            className="btn btn-primary text-sm w-full justify-center py-2.5"
            style={{ backgroundColor: "var(--module-vendas)", color: "#fff" }}
          >
            <Music size={14} />
            Abrir cadastro completo
          </button>
          <button
            onClick={onAvancar}
            className="text-xs text-muted hover:text-secondary"
          >
            Pular por agora
          </button>
        </div>
      </div>

      {/* Modal completo (mesmo de Configurações → Artistas) */}
      {modalAberto && (
        <ModalNovoArtista
          slugAgencia={slug}
          nomeAgencia={nomeAgencia}
          adicionarArtista={adicionarArtista}
          nomesExistentes={artistas.map((a) => a.name.toLowerCase())}
          onCancelar={() => setModalAberto(false)}
          onCriado={async (resultado) => {
            setModalAberto(false);
            setCredenciais(resultado);
            await onRecarregar();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Etapa 5 — Convidar primeiro membro da equipe
// ============================================================
function Etapa5Equipe({
  onAvancar,
  onRecarregar,
}: {
  onAvancar: () => void;
  onRecarregar: () => Promise<void>;
}) {
  const { adicionarUsuario } = useWorkspace();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<"vendedor" | "produtor" | "financeiro">(
    "vendedor"
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ senha: string; email: string } | null>(null);

  async function salvar() {
    setErro(null);
    if (!nome.trim()) return setErro("Informe o nome.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErro("Email inválido.");
    setSalvando(true);
    try {
      const r = await adicionarUsuario({
        nome: nome.trim(),
        email: email.trim(),
        papel,
        escopo: { verTodosContatos: true, verTodasVendas: true, editarTodosEventos: true },
        funcoes: {},
      });
      setResultado({ senha: r.senhaTemporaria, email: email.trim() });
      await onRecarregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="text-center mb-6">
        <Users
          size={32}
          className="mx-auto mb-3"
          style={{ color: "var(--module-vendas)" }}
        />
        <h2 className="text-xl font-bold tracking-tight">Convide a equipe</h2>
        <p className="mt-1 text-sm text-secondary">
          Vendedor, produtor ou financeiro — adicione quem vai te ajudar a
          tocar a agência. Pode pular se ainda tá começando sozinho.
        </p>
      </div>

      {resultado ? (
        <div className="card text-center">
          <CheckCircle2 size={32} className="mx-auto mb-3" style={{ color: "var(--success)" }} />
          <h3 className="text-base font-bold">Equipe convidada!</h3>
          <p className="text-sm text-secondary mt-1 mb-4">
            Mande pra essa pessoa:
          </p>
          <div className="bg-elevated rounded-md p-3 text-left flex flex-col gap-2">
            <div>
              <div className="text-[0.65rem] text-muted">E-mail</div>
              <div className="font-mono text-sm text-primary">{resultado.email}</div>
            </div>
            <div>
              <div className="text-[0.65rem] text-muted">Senha temporária</div>
              <div className="font-mono text-sm text-primary">{resultado.senha}</div>
            </div>
          </div>
          <button
            onClick={onAvancar}
            className="btn btn-primary text-sm w-full justify-center py-2.5 mt-4"
            style={{ backgroundColor: "var(--module-vendas)", color: "#fff" }}
          >
            Terminar
            <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <div className="card flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-secondary">Nome completo</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Marina Souza"
              className="campo-input"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-secondary">E-mail</span>
            <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2 focus-within:border-border-strong">
              <Mail size={14} className="text-muted" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="marina@email.com"
                className="flex-1 bg-transparent outline-none text-sm text-primary"
              />
            </div>
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-secondary">Papel</span>
            <div className="grid grid-cols-3 gap-2">
              {(["vendedor", "produtor", "financeiro"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPapel(p)}
                  className="card text-center py-2 text-xs capitalize transition-colors"
                  style={{
                    borderColor: papel === p ? "var(--module-vendas)" : undefined,
                    color: papel === p ? "var(--text-primary)" : "var(--text-secondary)",
                    fontWeight: papel === p ? 600 : 400,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {erro && (
            <div
              className="flex items-center gap-2 text-xs rounded-md px-3 py-2"
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

          <div className="flex flex-col gap-2">
            <button
              onClick={salvar}
              disabled={salvando}
              className="btn btn-primary text-sm w-full justify-center py-2.5 disabled:opacity-60"
              style={{ backgroundColor: "var(--module-vendas)", color: "#fff" }}
            >
              {salvando ? "Convidando..." : "Convidar"}
            </button>
            <button
              onClick={onAvancar}
              className="text-xs text-muted hover:text-secondary"
            >
              Pular e finalizar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
