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

/**
 * Diâmetro e corpo da fonte andam juntos, na proporção que o app JÁ usava
 * (~33-37%). Medido antes de escolher, em vez de arbitrar:
 *
 *   Sidebar          28px / 10.4px = 37%
 *   AbaEquipe        32px / 11.2px = 35%
 *   Lixeira          36px / 12px   = 33%
 *   AdminClientes    32px / 10.4px = 33%
 *   Topbar (antigo)  28px / 12px   = 43%  ← o único fora da curva
 *
 * Era isso que fazia o "ZÉ" do Topbar parecer grande demais: mesmo círculo
 * da Sidebar, letra 15% maior. `sm` é idêntico à Sidebar de propósito — é o
 * avatar que fica na mesma tela, lado a lado, e qualquer diferença salta.
 */
const TAMANHOS: Record<TamanhoAvatar, { box: string; fonte: string }> = {
  sm: { box: "h-7 w-7", fonte: "0.65rem" }, // 28px → 10.4px (Topbar, Sidebar)
  md: { box: "h-9 w-9", fonte: "0.75rem" }, // 36px → 12px   (menus, listas)
  lg: { box: "h-12 w-12", fonte: "1rem" }, // 48px → 16px   (cabeçalho de modal)
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
  // Sem `leading-none`: entrelinha 1 aperta o topo do glifo e deixa o acento
  // do "É" espremido contra a borda do círculo.
  return (
    <span
      className={`${box} rounded-full flex items-center justify-center font-bold flex-shrink-0 select-none ${className}`}
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
