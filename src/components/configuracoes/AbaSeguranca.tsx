"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { Eye, EyeOff, ShieldCheck, Lock, Mail } from "lucide-react";
import Toast from "../Toast";
import { criarClienteBrowser } from "@/lib/db/supabase-browser";
import { useAuth } from "@/lib/auth-context";

/**
 * Aba "Segurança" das Configurações — alteração de senha via Supabase Auth.
 *
 * Fluxo:
 *  1. Valida a senha atual fazendo um `signInWithPassword` fantasma (precisa
 *     bater pra não permitir que alguém com a sessão aberta troque a senha
 *     sem saber a atual).
 *  2. `updateUser({ password: nova })` aplica a nova senha.
 *  3. Toast de sucesso e form limpo.
 */
export default function AbaSeguranca() {
  const t = useT();
  const { sessao } = useAuth();
  const supabase = useMemo(() => criarClienteBrowser(), []);

  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: "sucesso" | "erro" } | null>(null);

  // ---- E-mail de acesso ----
  // Membros (artista/equipe) nascem com um e-mail interno determinístico
  // (handle@interno.gigscontrol.app) e logam pelo username. Aqui eles podem
  // cadastrar um e-mail real: o Supabase manda um link de confirmação e, após
  // confirmar, o e-mail vira o de acesso (verificado, verde pra agência) e o
  // login passa a valer pelo username OU pelo e-mail.
  const emailAtual = sessao?.usuario?.email ?? "";
  const semEmailReal = /@interno\.gigscontrol\.app$/i.test(emailAtual);
  const [novoEmail, setNovoEmail] = useState("");
  const [salvandoEmail, setSalvandoEmail] = useState(false);
  const emailValido =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novoEmail.trim()) &&
    novoEmail.trim().toLowerCase() !== emailAtual.toLowerCase();

  async function salvarEmail() {
    if (!emailValido || salvandoEmail) return;
    setSalvandoEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: novoEmail.trim() });
      if (error) {
        setToast({ msg: error.message, tipo: "erro" });
        return;
      }
      setToast({
        msg: t(
          "Enviamos um link de confirmação para {email}. Confirme para ativar o login por e-mail.",
          { email: novoEmail.trim() }
        ),
        tipo: "sucesso",
      });
      setNovoEmail("");
    } catch (e) {
      setToast({ msg: (e as Error).message, tipo: "erro" });
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

  async function salvar() {
    if (!podeSalvar) return;
    if (!sessao?.usuario?.email) {
      setToast({ msg: t("Sessão sem e-mail. Faça login novamente."), tipo: "erro" });
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
        setToast({ msg: t("Senha atual incorreta."), tipo: "erro" });
        return;
      }

      // 2) Atualiza para a nova senha.
      const { error: errUpdate } = await supabase.auth.updateUser({
        password: nova,
      });
      if (errUpdate) {
        setToast({ msg: errUpdate.message, tipo: "erro" });
        return;
      }

      // 3) Avisa o backend que o usuário trocou a senha — derruba a
      // flag `profiles.senha_padrao` pra `false`. Falha aqui não rolba
      // a troca de senha (já foi feita); só perde o sinal pro admin.
      try {
        await fetch("/api/auth/senha-trocada", {
          method: "POST",
          credentials: "include",
        });
      } catch {
        // ignora — flag é cosmética, não impede o sucesso da troca.
      }

      setToast({ msg: t("Senha alterada com sucesso."), tipo: "sucesso" });
      setAtual("");
      setNova("");
      setConfirma("");
    } catch (e) {
      setToast({ msg: (e as Error).message, tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ---- E-mail de acesso (cadastrar/verificar) ---- */}
      <section className="card">
        <div className="flex items-center gap-2 mb-1">
          <Mail size={16} style={{ color: "var(--brand)" }} />
          <div className="section-title">
            {semEmailReal ? t("Cadastrar e-mail de acesso") : t("E-mail de acesso")}
          </div>
        </div>
        <div className="section-subtitle mb-4">
          {semEmailReal
            ? t("Cadastre um e-mail seu. Enviamos um link pra confirmar — depois disso você pode entrar tanto pelo seu login de usuário quanto pelo e-mail.")
            : t("Este é o seu e-mail de acesso. Você também pode entrar pelo seu login de usuário.")}
        </div>

        {!semEmailReal && (
          <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2 mb-3">
            <Mail size={14} className="text-muted flex-shrink-0" />
            <span className="flex-1 text-sm text-secondary break-all">{emailAtual}</span>
            <span
              className="inline-flex items-center gap-1 text-[0.7rem] flex-shrink-0"
              style={{ color: "var(--success)" }}
            >
              <ShieldCheck size={12} /> {t("Verificado")}
            </span>
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-secondary">
            {semEmailReal ? t("Seu e-mail") : t("Trocar e-mail")}
          </span>
          <input
            type="email"
            value={novoEmail}
            onChange={(e) => setNovoEmail(e.target.value)}
            className="campo-input"
            placeholder="voce@email.com"
            autoComplete="email"
          />
        </label>

        <button
          onClick={salvarEmail}
          disabled={!emailValido || salvandoEmail}
          className="btn btn-primary text-sm w-full justify-center mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {salvandoEmail
            ? t("Enviando...")
            : semEmailReal
            ? t("Cadastrar e confirmar")
            : t("Trocar e-mail")}
        </button>
      </section>

      {/* ---- Alterar senha ---- */}
      <section className="card">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={16} style={{ color: "var(--brand)" }} />
          <div className="section-title">{t("Alterar senha")}</div>
        </div>
        <div className="section-subtitle mb-4">
          {t("A senha de acesso à sua dashboard. Use ao menos 8 caracteres.")}
        </div>

        <div className="flex flex-col gap-3">
          {/* Senha atual */}
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

          {/* Nova senha */}
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

          {/* Confirmar */}
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
          onClick={salvar}
          disabled={!podeSalvar}
          className="btn btn-primary text-sm w-full justify-center mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {salvando ? t("Alterando...") : t("Alterar senha")}
        </button>
      </section>

      <Toast
        open={!!toast}
        mensagem={toast?.msg ?? ""}
        tipo={toast?.tipo ?? "sucesso"}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
