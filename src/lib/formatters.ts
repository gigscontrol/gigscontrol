/**
 * Helpers de formatação reutilizáveis pelo site inteiro.
 *
 * Todas as máscaras seguem a convenção:
 *   - Entrada: string crua do input (com ou sem máscara)
 *   - Saída: string formatada pra exibição
 *
 * E as conversões "BR ↔ ISO" são pra datas — sempre guardamos ISO
 * (YYYY-MM-DD) no estado/banco, mas mostramos DD/MM/YYYY pro usuário.
 */

import { getFormatoData } from "./preferencias";
import type { Moeda } from "@/types";

/** Remove tudo que não é dígito. */
export function apenasDigitos(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

// ============================================================
// Moeda
// ============================================================

/** Símbolo por moeda — usado no prefixo dos campos de valor e na formatação. */
export const SIMBOLO_MOEDA: Record<Moeda, string> = {
  BRL: "R$",
  USD: "US$",
  EUR: "€",
};

/**
 * Formatador de moeda ÚNICO do app (BRL/USD/EUR — migração 92). Antes existiam
 * 2 `formatBRL` divergentes + formatadores inline; agora todos delegam aqui.
 * A grade numérica é a do app (pt-BR: 1.234,56); SÓ o símbolo muda por moeda —
 * assim uma agência que sempre foi BRL não vê NENHUMA diferença. `casas`
 * controla as decimais (2 = "R$ 1.234,56"; 0 = "R$ 1.234").
 */
export function formatarMoeda(
  valor: number,
  moeda: Moeda = "BRL",
  casas = 2
): string {
  const v = Number.isFinite(valor) ? valor : 0;
  const sinal = v < 0 ? "-" : "";
  const n = Math.abs(v).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
  return `${sinal}${SIMBOLO_MOEDA[moeda] ?? "R$"} ${n}`;
}

/**
 * Total de uma lista de valores AGRUPADO por moeda — nunca soma moedas
 * diferentes num número só (aritmética falsa; não há câmbio no sistema).
 * Com UMA moeda (o caso normal), devolve só ela: "R$ 45.000,00". Com várias:
 * "R$ 45.000,00 + US$ 8.000,00" (ordem estável BRL, USD, EUR). Lista vazia →
 * "R$ 0,00" (mantém o comportamento de hoje pra agência BRL sem dados).
 */
export function totaisPorMoeda(
  itens: { valor: number; moeda: Moeda }[],
  casas = 2
): string {
  const soma = new Map<Moeda, number>();
  for (const it of itens) {
    soma.set(it.moeda, (soma.get(it.moeda) ?? 0) + (it.valor || 0));
  }
  const ordem: Moeda[] = ["BRL", "USD", "EUR"];
  const partes = ordem
    .filter((m) => soma.has(m))
    .map((m) => formatarMoeda(soma.get(m) ?? 0, m, casas));
  return partes.length > 0 ? partes.join(" + ") : formatarMoeda(0, "BRL", casas);
}

// ============================================================
// CPF / CNPJ
// ============================================================

/**
 * Aplica a máscara progressiva enquanto o admin digita:
 *   "123"           → "123"
 *   "12345678"      → "123.456.78"
 *   "12345678901"   → "123.456.789-01"        (CPF: 11 dígitos)
 *   "12345678000195"→ "12.345.678/0001-95"    (CNPJ: 14 dígitos)
 *
 * Se passar do 14º dígito é truncado — assumimos que ninguém precisa
 * de mais que isso no Brasil.
 */
export function mascararCpfCnpj(s: string | null | undefined): string {
  const d = apenasDigitos(s).slice(0, 14);
  if (d.length === 0) return "";

  // CPF (até 11 dígitos)
  if (d.length <= 11) {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
  }

  // CNPJ (12 a 14 dígitos)
  if (d.length <= 12)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  if (d.length <= 13)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(
      8,
      12
    )}-${d.slice(12)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(
    8,
    12
  )}-${d.slice(12, 14)}`;
}

// ============================================================
// Capacidade de público
// ============================================================

/** Só dígitos, no máximo 6 (até 999.999 — qualquer estádio do mundo cabe). */
export function mascararCapacidade(s: string | null | undefined): string {
  return apenasDigitos(s).slice(0, 6);
}

// ============================================================
// Data BR ↔ ISO
// ============================================================

/**
 * Converte data ISO (YYYY-MM-DD) pra display brasileiro (DD/MM/YYYY).
 * Retorna string vazia se o input for vazio/inválido — não joga erro
 * pra não quebrar a render.
 */
export function formatarDataBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const [, y, mo, d] = m;
  // Ordem conforme a preferência da agência (dmy = DD/MM, mdy = MM/DD).
  return getFormatoData() === "mdy" ? `${mo}/${d}/${y}` : `${d}/${mo}/${y}`;
}

/**
 * Aplica a máscara progressiva DD/MM/YYYY enquanto o admin digita.
 *   "1"       → "1"
 *   "12"      → "12"
 *   "123"     → "12/3"
 *   "12345"   → "12/34/5"
 *   "12345678"→ "12/34/5678"
 * Trunca em 8 dígitos.
 */
export function mascararDataBR(s: string | null | undefined): string {
  const d = apenasDigitos(s).slice(0, 8);
  if (d.length === 0) return "";
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/**
 * Converte data brasileira (DD/MM/YYYY) pra ISO (YYYY-MM-DD).
 * Retorna null se a data não estiver completa OU não for válida
 * (ex: 31/02/2026, 99/99/9999).
 */
export function parseDataBR(br: string | null | undefined): string | null {
  if (!br) return null;
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, p1, p2, yyyy] = m;
  // Qual grupo é dia e qual é mês depende da preferência (dmy vs mdy).
  const mdy = getFormatoData() === "mdy";
  const diaStr = mdy ? p2 : p1;
  const mesStr = mdy ? p1 : p2;
  const d = Number(diaStr);
  const mo = Number(mesStr);
  const y = Number(yyyy);
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > 31) return null;
  if (y < 1900 || y > 2100) return null;
  // Valida o dia no mês (ex: 31/02 inválido). Date constrói com mês 0-indexed.
  const dt = new Date(y, mo - 1, d);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== mo - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return `${yyyy}-${mesStr}-${diaStr}`;
}
