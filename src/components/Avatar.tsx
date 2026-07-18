"use client";

/**
 * Avatar de iniciais — PADRÃO ÚNICO do app.
 *
 * Existiam 4 versões divergentes: cada tela escolhia seu tamanho, sua
 * proporção de texto e até seu jeito de tirar as iniciais (o
 * `name.slice(0, 2)` do ShowDetalheModal dava "DJ" pra "DJ Alok", em vez de
 * "DA"). O resultado visível: o "ZÉ" do Topbar com a letra grande demais
 * dentro do círculo, enquanto o "MA" do modal parecia certo.
 *
 * A proporção texto/círculo é FIXA (~0.3) em todos os tamanhos — é ela, e
 * não o diâmetro, que faz um avatar parecer "grande demais".
 */

import { iniciaisDoNome } from "@/lib/iniciais";

export type TamanhoAvatar = "sm" | "md" | "lg";

/** Diâmetro e corpo da fonte andam juntos: fonte ≈ 30% do diâmetro. */
const TAMANHOS: Record<TamanhoAvatar, { box: string; fonte: string }> = {
  sm: { box: "h-7 w-7", fonte: "0.5rem" }, // 28px → 8px  (Topbar)
  md: { box: "h-10 w-10", fonte: "0.75rem" }, // 40px → 12px (menu, listas)
  lg: { box: "h-12 w-12", fonte: "0.875rem" }, // 48px → 14px (cabeçalho de modal)
};

export default function Avatar({
  nome,
  cor,
  size = "md",
  anel = false,
  className = "",
}: {
  nome: string | null | undefined;
  /** Cor de identidade (artista/equipe). Sem cor, cai no elevado neutro. */
  cor?: string | null;
  size?: TamanhoAvatar;
  /** Halo suave em volta — usado no cabeçalho do modal de show. */
  anel?: boolean;
  className?: string;
}) {
  const { box, fonte } = TAMANHOS[size];
  const iniciais = iniciaisDoNome(nome) || "—";
  return (
    <span
      className={`${box} rounded-full flex items-center justify-center font-bold flex-shrink-0 leading-none select-none ${className}`}
      style={{
        fontSize: fonte,
        background: cor ? `linear-gradient(135deg, ${cor}, ${cor}99)` : "var(--bg-elevated)",
        color: cor ? "#fff" : "var(--text-primary)",
        boxShadow: anel && cor ? `0 0 0 3px ${cor}33` : undefined,
      }}
      aria-hidden="true"
    >
      {iniciais}
    </span>
  );
}
