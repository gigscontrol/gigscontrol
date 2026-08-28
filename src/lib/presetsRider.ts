import type { ItemQuantidade } from "@/types";

/**
 * PRESETS DE RIDER POR ARTISTA (feature 28/08/2026).
 *
 * Cada artista pode definir até 3 presets NOMEADOS por categoria (camarim,
 * efeitos, técnico) — conjuntos de itens COM quantidade, prontos pra aplicar
 * no orçamento/venda com um clique. O rider legado (rider_camarim etc.,
 * string[]) continua sendo o "cardápio" (quais itens aparecem na lista);
 * o preset é a combinação pronta por cima dele.
 *
 * Semântica do seletor (spec do Bruno):
 *  - selecionar um preset APLICA as quantidades dele;
 *  - qualquer edição manual depois disso derruba a seleção pra
 *    "Personalizado" — aqui isso é DERIVADO por comparação (presetAtivo),
 *    não guardado em estado: editar sai do preset sozinho e, se o usuário
 *    desfizer a edição na mão, o chip do preset reacende sozinho.
 *  - tudo continua 100% editável depois de aplicar.
 *
 * Persistência: artists.rider_presets (jsonb) no shape
 *   { camarim: PresetRider[], efeitos: PresetRider[], tecnico: PresetRider[] }
 */

export type CategoriaPreset = "camarim" | "efeitos" | "tecnico";

export type PresetRider = {
  /** Nome curto dado pelo admin (ex.: "Padrão", "Festival", "Internacional"). */
  nome: string;
  /** Itens com quantidade — só os que participam (qtd > 0). */
  itens: ItemQuantidade[];
};

export type PresetsRider = Record<CategoriaPreset, PresetRider[]>;

export const CATEGORIAS_PRESET: readonly CategoriaPreset[] = [
  "camarim",
  "efeitos",
  "tecnico",
];

export const LABELS_CATEGORIA_PRESET: Record<CategoriaPreset, string> = {
  camarim: "Rider de Camarim",
  efeitos: "Rider de Efeitos",
  tecnico: "Rider Técnico",
};

export const MAX_PRESETS_POR_CATEGORIA = 3;
export const MAX_ITENS_POR_PRESET = 40;
export const MAX_NOME_PRESET = 40;
export const MAX_NOME_ITEM = 120;

export const PRESETS_VAZIOS: PresetsRider = {
  camarim: [],
  efeitos: [],
  tecnico: [],
};

/** Item válido: nome não-vazio + qtd inteira 1..9999 (0 não participa). */
function itemValido(raw: unknown): ItemQuantidade | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const nome = typeof r.nome === "string" ? r.nome.trim().slice(0, MAX_NOME_ITEM) : "";
  const qtd = typeof r.qtd === "number" && Number.isFinite(r.qtd) ? Math.floor(r.qtd) : 0;
  if (!nome || qtd < 1) return null;
  return { nome, qtd: Math.min(qtd, 9999) };
}

/** Sanitiza UMA lista de presets (de uma categoria). */
function presetsValidos(raw: unknown): PresetRider[] {
  if (!Array.isArray(raw)) return [];
  const out: PresetRider[] = [];
  for (const p of raw) {
    if (out.length >= MAX_PRESETS_POR_CATEGORIA) break;
    if (typeof p !== "object" || p === null) continue;
    const r = p as Record<string, unknown>;
    const nome =
      typeof r.nome === "string" ? r.nome.trim().slice(0, MAX_NOME_PRESET) : "";
    const itens = Array.isArray(r.itens)
      ? r.itens
          .map(itemValido)
          .filter((i): i is ItemQuantidade => i !== null)
          .slice(0, MAX_ITENS_POR_PRESET)
      : [];
    // Preset sem nome OU sem item não existe — não ocupa slot.
    if (!nome || itens.length === 0) continue;
    out.push({ nome, itens });
  }
  return out;
}

/**
 * Normaliza o jsonb cru do banco (ou input de API) pro shape seguro.
 * Qualquer lixo vira lista vazia — nunca lança.
 */
export function normalizarPresets(raw: unknown): PresetsRider {
  if (typeof raw !== "object" || raw === null) return { ...PRESETS_VAZIOS };
  const r = raw as Record<string, unknown>;
  return {
    camarim: presetsValidos(r.camarim),
    efeitos: presetsValidos(r.efeitos),
    tecnico: presetsValidos(r.tecnico),
  };
}

/** Mapa nome→qtd só do que participa (qtd > 0) — a identidade de uma seleção. */
function assinatura(itens: ItemQuantidade[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of itens) {
    if (i.qtd > 0) m.set(i.nome, i.qtd);
  }
  return m;
}

/**
 * Qual preset está ATIVO dada a seleção atual? Comparação por conteúdo
 * (multiconjunto nome→qtd dos itens com qtd>0): editar qualquer quantidade
 * derruba pra null ("Personalizado"); desfazer a edição reacende o preset.
 * Linhas com qtd 0 (o resto do cardápio) não entram na identidade.
 */
export function presetAtivo(
  itens: ItemQuantidade[],
  presets: PresetRider[]
): number | null {
  const atual = assinatura(itens);
  for (let i = 0; i < presets.length; i++) {
    const alvo = assinatura(presets[i].itens);
    if (alvo.size !== atual.size) continue;
    let igual = true;
    for (const [nome, qtd] of alvo) {
      if (atual.get(nome) !== qtd) {
        igual = false;
        break;
      }
    }
    if (igual) return i;
  }
  return null;
}

/**
 * Aplica um preset sobre a lista atual do form:
 *  - zera todas as quantidades e grava as do preset (por nome);
 *  - item do preset que não está na lista (fora do cardápio/catálogo do
 *    momento) é ANEXADO ao fim — o preset sempre vale por inteiro.
 * A ordem das linhas existentes é preservada (a lista é o cardápio).
 */
export function aplicarPreset(
  itensAtuais: ItemQuantidade[],
  preset: PresetRider
): ItemQuantidade[] {
  const doPreset = assinatura(preset.itens);
  const out = itensAtuais.map((i) => ({
    nome: i.nome,
    qtd: doPreset.get(i.nome) ?? 0,
  }));
  const nomesNaLista = new Set(out.map((i) => i.nome));
  for (const [nome, qtd] of doPreset) {
    if (!nomesNaLista.has(nome)) out.push({ nome, qtd });
  }
  return out;
}

/** Presets de UMA categoria do artista, com fallback seguro. */
export function presetsDoArtista(
  artista: { presets?: PresetsRider } | undefined | null,
  categoria: CategoriaPreset
): PresetRider[] {
  return artista?.presets?.[categoria] ?? [];
}
