"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  Check,
  Mail,
  AtSign,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import Toast from "../Toast";
import Modal from "../Modal";
import { useWorkspace } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth-context";
import { criarClienteBrowser } from "@/lib/db/supabase-browser";
import CidadeGlobalAutocomplete, {
  type CidadeEscolhida,
} from "@/components/CidadeGlobalAutocomplete";
import { resolverCidade } from "@/lib/cidade-helpers";
import InputDataBR from "@/components/inputs/InputDataBR";
import PhoneInput, {
  DEFAULT_COUNTRY,
  contarDigitos,
  type Country,
} from "@/components/PhoneInput";
import { montarTelefoneE164, COUNTRIES } from "@/lib/data/countries";
import { configDocumento, normalizarDocumento } from "@/lib/data/documentos";
import AbaSeguranca from "./AbaSeguranca";

/**
 * Aba "Geral" das Configurações (antes era "Aparência").
 *
 * Reúne tudo relacionado à identidade e conta da agência:
 *  - Logo (upload pro Supabase Storage)
 *  - Nome exibido
 *  - E-mail cadastrado (somente leitura — troca via Segurança)
 *  - Username da agência (slug) — vai pro fim do login da equipe
 *    (ex: dudu-twobookings). Troca limitada a 3/30 dias, com cascata
 *    em todos os usuários do workspace.
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

export default function AbaGeral() {
  const t = useT();
  const { aparencia, atualizarNomeAgencia } = useWorkspace();
  const { sessao } = useAuth();
  const isAdmin = sessao?.usuario?.papel === "admin";
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
      {/* ---- Meus dados (pessoa) — visível pra TODOS (admin, artista, equipe).
          Cada um edita os PRÓPRIOS dados via PATCH /api/perfil. Não expõe
          nada de permissão/papel — é só dados de pessoa. ---- */}
      <MeusDados onToast={(msg, tipo) => setToast({ msg, tipo })} />

      {/* Blocos abaixo só pra admin (identidade da agência). Não-admin
          (artista, vendedor etc) vê só os próprios dados + Segurança. */}
      {isAdmin && (
        <>
      {/* ---- Nome da agência ---- */}
      <section className="card">
        <div className="section-title mb-1">{t("Nome exibido")}</div>
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
        </>
      )}

      {/* ---- Segurança (alterar senha) — sempre visível ---- */}
      <AbaSeguranca />

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
// Meus dados — formulário de PESSOA do próprio usuário (todos os papéis)
// ============================================================

/**
 * Espelha a Etapa 1 do onboarding (Etapa1Cadastro), porém SÓ os campos de
 * PESSOA — sem nada de agência/permissão. Salva via PATCH /api/perfil (que
 * grava só o próprio profile). Carrega os dados atuais lendo a própria linha
 * de `profiles` pelo cliente browser (RLS deixa o usuário ler o próprio row)
 * e o estado de verificação do e-mail via supabase.auth.getUser().
 */
type PerfilPessoa = {
  nome: string;
  nome_legal: string | null;
  pais: string | null;
  documento_tipo: string | null;
  documento: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  cidade_id: string | null;
  /** Cidade embutida (join em cidades por cidade_id) — pré-preenche o seletor. */
  cidade: {
    nome: string;
    estado: string | null;
    ibge_id: string | null;
    geoname_id: string | null;
    latitude: number | string | null;
    longitude: number | string | null;
    pais: string | null;
  } | null;
};

function MeusDados({
  onToast,
}: {
  onToast: (msg: string, tipo: "sucesso" | "erro") => void;
}) {
  const t = useT();
  const supabase = useMemo(() => criarClienteBrowser(), []);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // E-mail + verificação (auth.users). Verificado => trava (é o login).
  const [email, setEmail] = useState("");
  const [emailVerificado, setEmailVerificado] = useState(false);

  // Campos de pessoa.
  const [pais, setPais] = useState<string>("BR");
  const [cidade, setCidade] = useState<CidadeEscolhida | null>(null);
  const [apelido, setApelido] = useState("");
  const [nomeLegal, setNomeLegal] = useState("");
  const [nascimento, setNascimento] = useState<string>("");
  const [doc, setDoc] = useState<string>("");
  const [telCountry, setTelCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [telDigits, setTelDigits] = useState<string>("");

  const campo =
    "bg-elevated border border-border rounded-md px-3 py-2 text-sm text-primary focus:border-border-strong outline-none";
  const docCfg = configDocumento(pais);

  // Carrega o profile + estado de verificação do e-mail.
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const u = userData.user;
        if (!u) throw new Error(t("Sessão expirada. Faça login de novo."));

        const { data: profile, error: errProfile } = await supabase
          .from("profiles")
          .select(
            "nome, nome_legal, pais, documento_tipo, documento, telefone, data_nascimento, cidade_id, cidade:cidades!cidade_id(nome, estado, ibge_id, geoname_id, latitude, longitude, pais)"
          )
          .eq("id", u.id)
          .single<PerfilPessoa>();
        if (errProfile || !profile) {
          throw new Error(t("Não foi possível carregar seus dados."));
        }
        if (!ativo) return;

        setEmail(u.email ?? "");
        setEmailVerificado(!!u.email_confirmed_at);

        const paisInicial = (profile.pais || "BR").toUpperCase();
        setPais(paisInicial);
        setApelido(profile.nome ?? "");
        setNomeLegal(profile.nome_legal ?? "");
        setNascimento(profile.data_nascimento ?? "");
        setDoc(profile.documento ?? "");
        // Pré-preenche o seletor com a cidade salva (join). Cidade legada (sem
        // ibge/geoname) fica vazia — o autocomplete não tem como reidentificá-la.
        const cr = profile.cidade;
        setCidade(
          cr && (cr.ibge_id || cr.geoname_id)
            ? {
                nome: cr.nome,
                uf: cr.estado ?? "",
                pais: cr.pais ?? "BR",
                ...(cr.ibge_id ? { ibgeId: cr.ibge_id } : {}),
                ...(cr.geoname_id ? { geonameId: cr.geoname_id } : {}),
                ...(cr.latitude != null ? { latitude: Number(cr.latitude) } : {}),
                ...(cr.longitude != null ? { longitude: Number(cr.longitude) } : {}),
              }
            : null
        );

        const cc =
          COUNTRIES.find((c) => c.code === paisInicial) ?? DEFAULT_COUNTRY;
        setTelCountry(cc);
        const digs = (profile.telefone ?? "").replace(/\D/g, "");
        setTelDigits(digs.startsWith(cc.ddi) ? digs.slice(cc.ddi.length) : digs);
      } catch (e) {
        if (ativo) setErro((e as Error).message);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [supabase, t]);

  // Um país só: o seletor da Cidade dirige documento + DDI do telefone.
  function sincronizarPais(code: string) {
    setPais(code);
    const cc = COUNTRIES.find((x) => x.code === code);
    if (cc) setTelCountry(cc);
  }

  async function salvar() {
    setErro(null);
    if (!apelido.trim()) return setErro(t("Informe seu apelido."));
    if (!nomeLegal.trim()) return setErro(t("Informe seu nome completo."));
    if (!nascimento) return setErro(t("Informe a data de nascimento."));
    if (!doc.trim()) return setErro(t("Informe o documento."));
    if (contarDigitos(telDigits) < telCountry.minDigits)
      return setErro(t("Telefone incompleto."));

    setSalvando(true);
    try {
      const telefone = montarTelefoneE164(telCountry, telDigits);
      const docNorm = normalizarDocumento(pais, doc);
      const docTipo =
        pais === "BR" ? (docNorm.length > 11 ? "cnpj" : "cpf") : "doc";

      // Cidade (opcional): resolve a seleção pro UUID do catálogo (lookup-or-
      // create no próprio workspace). Sem cidade = limpa (null). Falha ao
      // resolver = não mexe no cidade_id atual (undefined → não vai no body).
      let cidade_id: string | null | undefined = null;
      if (cidade) {
        try {
          cidade_id = (await resolverCidade(cidade)).id;
        } catch {
          cidade_id = undefined;
        }
      }

      // Só campos de PESSOA — o endpoint /api/perfil grava só o próprio
      // profile e NÃO aceita nada de papel/permissão.
      const r = await fetch("/api/perfil", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: apelido.trim(),
          nome_legal: nomeLegal.trim(),
          pais,
          documento_tipo: docTipo,
          documento: docNorm,
          telefone,
          data_nascimento: nascimento,
          ...(cidade_id !== undefined ? { cidade_id } : {}),
        }),
      });
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        throw new Error((b.erro as string) ?? t("Falha ao salvar seus dados."));
      }
      onToast(t("Dados salvos."), "sucesso");
    } catch (e) {
      onToast((e as Error).message, "erro");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <section className="card">
        <div className="flex items-center gap-2 mb-1">
          <UserIcon size={16} style={{ color: "var(--brand)" }} />
          <div className="section-title">{t("Meus dados")}</div>
        </div>
        <div className="text-sm text-muted flex items-center gap-2 mt-3">
          <Loader2 size={14} className="animate-spin" /> {t("Carregando...")}
        </div>
      </section>
    );
  }

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <UserIcon size={16} style={{ color: "var(--brand)" }} />
          <div className="section-title">{t("Meus dados")}</div>
        </div>
        <div className="section-subtitle">
          {t("Seus dados pessoais. Aparecem nos contratos e orçamentos gerados pelo sistema.")}
        </div>
      </div>

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
          {t("País e cidade onde reside")}
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
          value={nomeLegal}
          onChange={(e) => setNomeLegal(e.target.value)}
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

      {/* E-mail — travado quando verificado (é o login). Quando NÃO
          verificado (ex.: membro com e-mail interno), a troca acontece no
          card "E-mail de acesso" logo abaixo (Segurança). */}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-secondary">{t("E-mail")}</span>
        <div
          className="flex items-center gap-2 border rounded-md px-3 py-2"
          style={{
            backgroundColor: emailVerificado
              ? "rgba(34,197,94,0.08)"
              : "var(--bg-elevated)",
            borderColor: emailVerificado
              ? "var(--success)"
              : "var(--border-color)",
          }}
        >
          <Mail size={14} className="text-muted flex-shrink-0" />
          <input
            value={email}
            disabled
            className="flex-1 bg-transparent outline-none text-sm text-muted cursor-not-allowed break-all"
          />
          {emailVerificado && (
            <span
              className="inline-flex items-center gap-1 text-[0.7rem] flex-shrink-0"
              style={{ color: "var(--success)" }}
            >
              <ShieldCheck size={12} /> {t("Verificado")}
            </span>
          )}
        </div>
        {emailVerificado ? (
          <span className="text-[0.7rem]" style={{ color: "var(--success)" }}>
            {t("E-mail verificado — é o seu login e não pode ser alterado.")}
          </span>
        ) : (
          <span className="text-[0.7rem] text-muted">
            {t("Cadastre ou troque seu e-mail no bloco de acesso abaixo.")}
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
        className="btn btn-primary text-sm w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {salvando ? (
          <>
            <Loader2 size={14} className="animate-spin" /> {t("Salvando...")}
          </>
        ) : (
          <>
            <Check size={14} /> {t("Salvar meus dados")}
          </>
        )}
      </button>
    </section>
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
        <div className="section-title mb-1">{t("Username da agência")}</div>
        <div className="text-sm text-muted flex items-center gap-2 mt-3">
          <Loader2 size={14} className="animate-spin" /> {t("Carregando...")}
        </div>
      </section>
    );
  }

  if (!info) {
    return (
      <section className="card">
        <div className="section-title mb-1">{t("Username da agência")}</div>
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
      <div className="section-title mb-1">{t("Username da agência")}</div>
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

// (o upload de logo da dashboard foi removido — a dashboard exibe o nome)
