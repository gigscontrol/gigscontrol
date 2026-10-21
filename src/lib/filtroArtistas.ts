/**
 * Regra ÚNICA do filtro "Artistas" da barra lateral (pedido do dono,
 * 20/10/2026: vale em TODAS as telas, menos na Agência).
 *
 *   - coisa ligada a um artista → aparece só se o artista está marcado;
 *   - coisa SEM artista (contrato avulso, venda sem artista, contato sem
 *     histórico, nota sem etiqueta) → aparece sempre. Esconder o que não é
 *     de ninguém faria o cadastro "sumir" sem motivo — a lição do I11.
 *
 * Contato não tem artista próprio: herda dos shows/vendas/orçamentos em que
 * aparece. Puro — testado em filtroArtistas.test.ts.
 */

/** A coisa (com este artista) passa no filtro? */
export function passaNoFiltro(
  artistaId: string | null | undefined,
  selecionados: readonly string[]
): boolean {
  if (!artistaId) return true;
  return selecionados.includes(artistaId);
}

/** O filtro está restringindo algo? (todos marcados = desligado) */
export function filtroAtivo(selecionados: readonly string[], todos: readonly string[]): boolean {
  if (todos.length === 0) return false;
  return todos.some((id) => !selecionados.includes(id));
}

type ComArtista = { artistaId?: string | null };
type ShowLike = ComArtista & { contratanteId?: string; casaId?: string; cidadeId?: string };
type VendaLike = ComArtista & { contratanteId?: string; casaId?: string; cidadeId?: string };
type OrcamentoLike = ComArtista & {
  contratanteId?: string | null;
  casaId?: string | null;
  cidadeId?: string | null;
};

export type ArtistasDosContatos = {
  contratantes: Map<string, Set<string>>;
  casas: Map<string, Set<string>>;
  cidades: Map<string, Set<string>>;
};

/** Pra cada contratante/casa/cidade: os artistas que já trabalharam com ele. */
export function artistasDosContatos(
  shows: readonly ShowLike[],
  vendas: readonly VendaLike[],
  orcamentos: readonly OrcamentoLike[]
): ArtistasDosContatos {
  const m: ArtistasDosContatos = {
    contratantes: new Map(),
    casas: new Map(),
    cidades: new Map(),
  };
  const add = (mapa: Map<string, Set<string>>, id: string | null | undefined, art: string | null | undefined) => {
    if (!id || !art) return;
    let s = mapa.get(id);
    if (!s) {
      s = new Set();
      mapa.set(id, s);
    }
    s.add(art);
  };
  for (const x of [...shows, ...vendas, ...orcamentos]) {
    add(m.contratantes, x.contratanteId, x.artistaId);
    add(m.casas, x.casaId, x.artistaId);
    add(m.cidades, x.cidadeId, x.artistaId);
  }
  return m;
}

/**
 * O contato passa no filtro? Sem histórico com artista nenhum → sempre;
 * com histórico → se ALGUM dos artistas dele está marcado.
 */
export function contatoPassa(
  mapa: Map<string, Set<string>>,
  contatoId: string,
  selecionados: readonly string[]
): boolean {
  const arts = mapa.get(contatoId);
  if (!arts || arts.size === 0) return true;
  for (const a of arts) if (selecionados.includes(a)) return true;
  return false;
}
