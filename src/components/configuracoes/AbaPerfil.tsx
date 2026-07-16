"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  Check,
  Mail,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  User as UserIcon,
  Palette,
} from "lucide-react";
import Toast from "../Toast";
import { useAuth } from "@/lib/auth-context";
import { criarClienteBrowser } from "@/lib/db/supabase-browser";
import CidadeGlobalAutocomplete, {
  type CidadeEscolhida,
} from "@/components/CidadeGlobalAutocomplete";
import { resolverCidade } from "@/lib/cidade-helpers";
import { ehEmailInterno } from "@/lib/email-interno";
import InputDataBR from "@/components/inputs/InputDataBR";
import PhoneInput, {
  DEFAULT_COUNTRY,
  contarDigitos,
  type Country,
} from "@/components/PhoneInput";
import { montarTelefoneE164, COUNTRIES } from "@/lib/data/countries";
import { configDocumento, normalizarDocumento } from "@/lib/data/documentos";
import { SeletorDeCor } from "./AbaArtistas";

/** Fallback quando o usuário ainda não escolheu cor — mesmo default usado
 *  em AbaEquipe/Topbar pra `perfil?.cor` (var(--brand) em hex fixo, porque o
 *  seletor de cor trabalha com string, não CSS var). */
const COR_PADRAO = "#3D7BFF";

/**
 * Aba "Perfil" das Configurações — TODOS os papéis (admin, artista, equipe).
 *
 * Reúne (rework: antes era metade de "Geral" + "Segurança" separadas):
 *  - Meus dados: apelido, cor do avatar, país/cidade, nome legal, nascimento,
 *    documento, telefone (+ razão social/endereço só pro artista)
 *  - Acesso: e-mail de login (cadastro/verificação) + alterar senha, num
 *    card único (antes eram 2 cards de e-mail redundantes)
 *
 * Consome o GET/PATCH ramificado de /api/perfil (WI-2): o backend decide
 * sozinho se grava em `profiles` (admin/equipe) ou `artists` (artista) — este
 * componente manda sempre o MESMO shape, pro papel que for.
 *
 * A cor do avatar é um endpoint à parte (/api/perfil/cor): é preferência de
 * UI da conta (profiles.cor), não dado de pessoa/contrato — não faz parte do
 * whitelist de /api/perfil.
 */
export default function AbaPerfil() {
  const [toast, setToast] = useState<{ msg: string; tipo: "sucesso" | "erro" } | null>(null);
  const onToast = (msg: string, tipo: "sucesso" | "erro") => setToast({ msg, tipo });

  return (
    <div className="flex flex-col gap-6 w-full">
      <MeusDados onToast={onToast} />
      <AcessoCard onToast={onToast} />

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
// Meus dados — pessoa (todos os papéis) + cor do avatar
// ============================================================

type PerfilPessoa = {
  nome: string;
  nome_legal: string | null;
  pais: string | null;
  documento_tipo: string | null;
  documento: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  cidade_id: string | null;
  razao_social: string | null;
  endereco: string | null;
  cor: string | null;
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
  const { sessao } = useAuth();
  const isArtista = sessao?.usuario?.papel === "artista";

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Campos de pessoa.
  const [pais, setPais] = useState<string>("BR");
  const [cidade, setCidade] = useState<CidadeEscolhida | null>(null);
  const [apelido, setApelido] = useState("");
  const [nomeLegal, setNomeLegal] = useState("");
  const [nascimento, setNascimento] = useState<string>("");
  const [doc, setDoc] = useState<string>("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [endereco, setEndereco] = useState("");
  const [telCountry, setTelCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [telDigits, setTelDigits] = useState<string>("");

  // Cor do avatar — endpoint próprio (/api/perfil/cor), salva na hora. Sem cor
  // salva ainda, cai no --brand (mesmo fallback usado em AbaEquipe/Topbar
  // pra `perfil?.cor`).
  const [cor, setCor] = useState<string>(COR_PADRAO);
  const [salvandoCor, setSalvandoCor] = useState(false);

  const campo =
    "bg-elevated border border-border rounded-md px-3 py-2 text-sm text-primary focus:border-border-strong outline-none";
  const docCfg = configDocumento(pais);

  // Carrega o perfil (GET /api/perfil, já ramificado por papel no backend).
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const r = await fetch("/api/perfil", { credentials: "include" });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error((body.erro as string) ?? t("Não foi possível carregar seus dados."));
        }
        const perfil = body.perfil as PerfilPessoa;
        if (!ativo) return;

        const paisInicial = (perfil.pais || "BR").toUpperCase();
        setPais(paisInicial);
        setApelido(perfil.nome ?? "");
        setNomeLegal(perfil.nome_legal ?? "");
        setNascimento(perfil.data_nascimento ?? "");
        setDoc(perfil.documento ?? "");
        setRazaoSocial(perfil.razao_social ?? "");
        setEndereco(perfil.endereco ?? "");
        setCor(perfil.cor && /^#[0-9a-fA-F]{6}$/.test(perfil.cor) ? perfil.cor : COR_PADRAO);

        // Pré-preenche o seletor com a cidade salva (join). Cidade legada (sem
        // ibge/geoname) fica vazia — o autocomplete não tem como reidentificá-la.
        const cr = perfil.cidade;
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
        const digs = (perfil.telefone ?? "").replace(/\D/g, "");
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
  }, [t]);

  // Um país só: o seletor da Cidade dirige documento + DDI do telefone.
  function sincronizarPais(code: string) {
    setPais(code);
    const cc = COUNTRIES.find((x) => x.code === code);
    if (cc) setTelCountry(cc);
  }

  async function trocarCor(novaCor: string) {
    const anterior = cor;
    setCor(novaCor);
    setSalvandoCor(true);
    try {
      const r = await fetch("/api/perfil/cor", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cor: novaCor }),
      });
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        throw new Error((b.erro as string) ?? t("Falha ao salvar a cor."));
      }
      onToast(t("Cor do avatar atualizada."), "sucesso");
    } catch (e) {
      setCor(anterior);
      onToast((e as Error).message, "erro");
    } finally {
      setSalvandoCor(false);
    }
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

      // Só campos de PESSOA — o endpoint /api/perfil já ramifica sozinho por
      // papel (grava em `profiles` ou `artists`) e NÃO aceita nada de
      // papel/permissão/cor.
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
          ...(isArtista
            ? {
                razao_social: razaoSocial.trim() || null,
                endereco: endereco.trim() || null,
              }
            : {}),
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

      {/* Cor do avatar — salva na hora (endpoint próprio), não faz parte do
          botão "Salvar meus dados" abaixo. */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <Palette size={12} className="text-muted" />
          <span className="text-xs font-medium text-secondary">
            {t("Cor do meu avatar")}
          </span>
          {salvandoCor && (
            <Loader2 size={11} className="animate-spin text-muted" />
          )}
        </div>
        <SeletorDeCor cor={cor} onChange={trocarCor} />
      </div>

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

      {isArtista && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-secondary">
              {t("Razão social")}
            </span>
            <input
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              placeholder={t("Se você emitir nota fiscal por CNPJ")}
              className={campo}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-secondary">
              {t("Endereço")}
            </span>
            <input
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder={t("Rua, número, bairro, cidade")}
              className={campo}
            />
            <span className="text-[0.7rem] text-muted">
              {t("Aparece nos contratos gerados pelo sistema.")}
            </span>
          </label>
        </>
      )}

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
// Acesso — e-mail de login (cadastro/verificação) + alterar senha
// (absorve a antiga AbaSeguranca.tsx — card único, sem redundância
// com o e-mail que já aparecia em "Meus dados")
// ============================================================

function AcessoCard({
  onToast,
}: {
  onToast: (msg: string, tipo: "sucesso" | "erro") => void;
}) {
  const t = useT();
  const { sessao } = useAuth();
  const supabase = useMemo(() => criarClienteBrowser(), []);

  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // ---- E-mail de acesso ----
  // Membros (artista/equipe) nascem com um e-mail interno determinístico
  // (handle@interno.gigscontrol.app) e logam pelo username. Aqui eles podem
  // cadastrar um e-mail real: o Supabase manda um link de confirmação e, após
  // confirmar, o e-mail vira o de acesso (verificado, verde) e o login passa
  // a valer pelo username OU pelo e-mail.
  //
  // REGRA: um e-mail VERIFICADO (email_confirmed_at) é o login e NÃO pode ser
  // trocado por aqui — o card fica travado, só de leitura, com selo
  // Verificado. Sem verificar (ex.: membro com e-mail interno) libera o
  // cadastro/troca via updateUser.
  const emailAtual = sessao?.usuario?.email ?? "";
  // O e-mail sintético (@interno.gigscontrol.app) existe SÓ pra backar o login
  // por username no Supabase — não é um e-mail real e NUNCA deve aparecer. Mesmo
  // "confirmado" no auth, tratamos como "sem e-mail cadastrado": libera o campo
  // em branco pro membro cadastrar/verificar um e-mail próprio.
  const ehInterno = ehEmailInterno(emailAtual);
  const [emailVerificado, setEmailVerificado] = useState(false);
  const [carregandoEmail, setCarregandoEmail] = useState(true);
  // "Travado" (só-leitura, verde) só quando há um e-mail REAL verificado.
  const emailTravado = emailVerificado && !ehInterno;

  useEffect(() => {
    let ativo = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!ativo) return;
      setEmailVerificado(!!data.user?.email_confirmed_at);
      setCarregandoEmail(false);
    });
    return () => {
      ativo = false;
    };
  }, [supabase]);

  const [novoEmail, setNovoEmail] = useState("");
  const [salvandoEmail, setSalvandoEmail] = useState(false);
  const emailValido =
    !emailTravado &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novoEmail.trim()) &&
    novoEmail.trim().toLowerCase() !== emailAtual.toLowerCase();

  async function salvarEmail() {
    if (!emailValido || salvandoEmail) return;
    setSalvandoEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: novoEmail.trim() });
      if (error) {
        onToast(error.message, "erro");
        return;
      }
      onToast(
        t(
          "Enviamos um link de confirmação para {email}. Confirme para ativar o login por e-mail.",
          { email: novoEmail.trim() }
        ),
        "sucesso"
      );
      setNovoEmail("");
    } catch (e) {
      onToast((e as Error).message, "erro");
    } finally {
      setSalvandoEmail(false);
    }
  }

  const novaCurta = nova.length > 0 && nova.length < 8;
  const naoConfere = confirma.length > 0 && nova !== confirma;
  const podeSalvar =
    !salvando &&
    atual.length > 0 &&
    nova.length >= 8 &&
    confirma.length >= 8 &&
    nova === confirma;

  async function salvarSenha() {
    if (!podeSalvar) return;
    if (!sessao?.usuario?.email) {
      onToast(t("Sessão sem e-mail. Faça login novamente."), "erro");
      return;
    }
    setSalvando(true);
    try {
      // 1) Re-autentica com a senha atual para confirmar a posse da conta.
      const { error: errAtual } = await supabase.auth.signInWithPassword({
        email: sessao.usuario.email,
        password: atual,
      });
      if (errAtual) {
        onToast(t("Senha atual incorreta."), "erro");
        return;
      }

      // 2) Atualiza para a nova senha.
      const { error: errUpdate } = await supabase.auth.updateUser({
        password: nova,
      });
      if (errUpdate) {
        onToast(errUpdate.message, "erro");
        return;
      }

      // 3) Avisa o backend que o usuário trocou a senha — derruba a flag
      // `profiles.senha_padrao` pra `false`. Falha aqui não rolba a troca de
      // senha (já foi feita); só perde o sinal pro admin.
      try {
        await fetch("/api/auth/senha-trocada", {
          method: "POST",
          credentials: "include",
        });
      } catch {
        // ignora — flag é cosmética, não impede o sucesso da troca.
      }

      onToast(t("Senha alterada com sucesso."), "sucesso");
      setAtual("");
      setNova("");
      setConfirma("");
    } catch (e) {
      onToast((e as Error).message, "erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={16} style={{ color: "var(--brand)" }} />
          <div className="section-title">{t("Acesso")}</div>
        </div>
        <div className="section-subtitle">
          {t("Seu e-mail de login e a senha de acesso à sua dashboard.")}
        </div>
      </div>

      {/* ---- E-mail ---- */}
      {carregandoEmail ? (
        <div className="text-sm text-muted flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> {t("Carregando...")}
        </div>
      ) : emailTravado ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-secondary">{t("E-mail")}</span>
          <div
            className="flex items-center gap-2 border rounded-md px-3 py-2"
            style={{
              backgroundColor: "rgba(34,197,94,0.08)",
              borderColor: "var(--success)",
            }}
          >
            <Mail size={14} className="text-muted flex-shrink-0" />
            <span className="flex-1 text-sm text-secondary break-all">{emailAtual}</span>
            <span
              className="inline-flex items-center gap-1 text-[0.7rem] flex-shrink-0"
              style={{ color: "var(--success)" }}
            >
              <ShieldCheck size={12} /> {t("Verificado")}
            </span>
          </div>
          <span className="text-[0.7rem]" style={{ color: "var(--success)" }}>
            {t("E-mail verificado — é o seu login e não pode ser alterado.")}
          </span>
        </label>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-secondary">
            {t("Cadastrar e-mail de acesso")}
          </span>
          <span className="text-[0.7rem] text-muted -mt-1">
            {t("Cadastre um e-mail seu. Enviamos um link pra confirmar — depois disso você pode entrar tanto pelo seu login de usuário quanto pelo e-mail.")}
          </span>
          <input
            type="email"
            value={novoEmail}
            onChange={(e) => setNovoEmail(e.target.value)}
            className="campo-input mt-1"
            placeholder="voce@email.com"
            autoComplete="email"
          />
          <button
            onClick={salvarEmail}
            disabled={!emailValido || salvandoEmail}
            className="btn btn-secondary text-sm w-full justify-center mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {salvandoEmail ? t("Enviando...") : t("Cadastrar e confirmar")}
          </button>
        </div>
      )}

      <div className="border-t border-border" />

      {/* ---- Alterar senha ---- */}
      <div>
        <div className="text-xs font-medium text-secondary mb-3">
          {t("Alterar senha")} <span className="text-muted font-normal">— {t("mínimo de 8 caracteres")}</span>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-secondary">
              {t("Senha atual")}
            </span>
            <div className="relative">
              <input
                type={verSenha ? "text" : "password"}
                value={atual}
                onChange={(e) => setAtual(e.target.value)}
                className="campo-input pr-9"
                placeholder={t("Digite sua senha atual")}
                autoComplete="current-password"
              />
              <Lock
                size={13}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-secondary">
              {t("Nova senha")}
            </span>
            <div className="relative">
              <input
                type={verSenha ? "text" : "password"}
                value={nova}
                onChange={(e) => setNova(e.target.value)}
                className="campo-input pr-9"
                placeholder={t("Mínimo de 8 caracteres")}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setVerSenha((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-secondary"
                aria-label={verSenha ? t("Ocultar senha") : t("Mostrar senha")}
              >
                {verSenha ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {novaCurta && (
              <span className="text-xs" style={{ color: "var(--danger)" }}>
                {t("A senha deve ter pelo menos 8 caracteres.")}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-secondary">
              {t("Confirmar nova senha")}
            </span>
            <input
              type={verSenha ? "text" : "password"}
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
              className="campo-input"
              placeholder={t("Repita a nova senha")}
              autoComplete="new-password"
            />
            {naoConfere && (
              <span className="text-xs" style={{ color: "var(--danger)" }}>
                {t("As senhas não coincidem.")}
              </span>
            )}
          </label>
        </div>

        <button
          onClick={salvarSenha}
          disabled={!podeSalvar}
          className="btn btn-primary text-sm w-full justify-center mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {salvando ? t("Alterando...") : t("Alterar senha")}
        </button>
      </div>
    </section>
  );
}
