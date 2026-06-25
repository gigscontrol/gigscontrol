"use client";

import { useMemo, useState } from "react";
import { Lock, Eye, EyeOff, AlertCircle, Check } from "lucide-react";
import { useT } from "@/lib/i18n";
import {
  avaliarSenha,
  labelForca,
  corForca,
  type AvaliacaoSenha,
} from "@/lib/senha-forca";

/**
 * Campo de senha reusável com medidor de força integrado.
 *
 * Visual:
 *  - Input com toggle de olho (mostrar/esconder)
 *  - Barra de força (4 segmentos), colorida conforme `corForca()`
 *  - Label dinâmica ("Muito fraca" / "Fraca" / "Média" / "Forte")
 *  - Mensagens curtas inline (motivos) — em vermelho se bloqueia,
 *    em cinza se é só sugestão
 *
 * Quando `mostrarForca={false}` (campos de confirmação), funciona
 * como um input de senha normal sem medidor.
 *
 * Política aplicada (via `avaliarSenha`):
 *  - Mínimo 8 chars (NIST 800-63B)
 *  - Bloqueia top-~120 senhas comuns
 *  - Pontua por comprimento (+ longa = melhor) e variedade
 */
type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  /** Mostra medidor de força. Default `true`. Em campos de confirmação, passar `false`. */
  mostrarForca?: boolean;
};

export default function CampoSenha({
  label,
  value,
  onChange,
  placeholder = "••••••••",
  autoComplete = "new-password",
  autoFocus,
  mostrarForca = true,
}: Props) {
  const [visivel, setVisivel] = useState(false);

  const avaliacao: AvaliacaoSenha | null = useMemo(
    () => (mostrarForca && value ? avaliarSenha(value) : null),
    [value, mostrarForca]
  );

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-secondary">{label}</span>
      <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2 focus-within:border-border-strong transition-colors">
        <Lock size={14} className="text-muted flex-shrink-0" />
        <input
          type={visivel ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted"
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? "Esconder senha" : "Mostrar senha"}
          className="text-muted hover:text-secondary transition-colors flex-shrink-0"
          tabIndex={-1}
        >
          {visivel ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      {avaliacao && <MedidorForca avaliacao={avaliacao} />}
    </label>
  );
}

/**
 * Barra horizontal de 4 segmentos. Quantos segmentos pintam =
 * `pontuacao` (0-4). Cor do segmento ativo = `corForca`.
 */
function MedidorForca({ avaliacao }: { avaliacao: AvaliacaoSenha }) {
  const t = useT();
  const { forca, pontuacao, podeUsar, motivos, comum } = avaliacao;
  const cor = corForca(forca);

  // Sempre mostra 4 segmentos. Acende `max(pontuacao, 1)` quando há
  // senha digitada — assim mesmo "muito-fraca" pinta 1 segmento vermelho
  // (em vez de barra totalmente vazia, que confunde o usuário).
  const acesos = Math.max(pontuacao, 1);

  return (
    <div className="flex flex-col gap-1 mt-0.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{
                backgroundColor: i < acesos ? cor : "var(--border-color)",
              }}
            />
          ))}
        </div>
        <span
          className="text-[0.65rem] font-medium tabular-nums flex-shrink-0"
          style={{ color: cor }}
        >
          {t(labelForca(forca))}
        </span>
      </div>

      {motivos.map((m, i) => (
        <span
          key={i}
          className="text-[0.7rem] flex items-center gap-1"
          style={{ color: podeUsar ? "var(--text-muted)" : "var(--danger)" }}
        >
          {podeUsar ? (
            <Check size={11} style={{ color: "var(--text-muted)" }} />
          ) : (
            <AlertCircle size={11} />
          )}
          {t(m)}
        </span>
      ))}

      {/* Senhas comuns: mensagem extra de educação */}
      {comum && (
        <span className="text-[0.65rem] text-muted italic">
          {t("Senhas como essa são as primeiras testadas em ataques.")}
        </span>
      )}
    </div>
  );
}
