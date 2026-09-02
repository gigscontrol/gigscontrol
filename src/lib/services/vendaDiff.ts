import type { SupabaseClient } from "@supabase/supabase-js";
import type { Venda, ItemQuantidade, LogisticaSelecao } from "@/types";
import { formatarMoeda, mascararCpfCnpj } from "@/lib/formatters";
import { numeroQtd } from "@/lib/quantidades";

/**
 * DIFF DA VENDA — insumo do rastro antifraude (histórico_acoes.dados).
 *
 * O propósito é o dono conseguir olhar depois e ver O QUE mudou, não só QUEM
 * mexeu. Por isso `antes`/`depois` já saem FORMATADOS pra humano (R$ 1.400,00,
 * 15/08/2026, nome da casa em vez do uuid) e os rótulos são PT legível.
 *
 * Rótulos ficam em PT no banco DE PROPÓSITO: isso é registro histórico, não UI
 * traduzível — o texto gravado tem que continuar significando a mesma coisa
 * daqui a 2 anos, independente do idioma de quem lê.
 *
 * Nada aqui pode lançar: o diff é acessório da edição (ver o try/catch no PATCH).
 */

export type AlteracaoVenda = {
  campo: string;
  rotulo: string;
  antes: string;
  depois: string;
};

const VAZIO = "—";

function texto(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  return s || VAZIO;
}

function truncar(v: string | null | undefined, max = 120): string {
  const s = (v ?? "").trim();
  if (!s) return VAZIO;
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * ISO (YYYY-MM-DD) → DD/MM/YYYY. Não reusa `formatarDataBR` de propósito: aquele
 * segue a preferência dmy/mdy da agência (singleton de cliente, que no servidor é
 * sempre o default) — aqui o formato precisa ser estável no registro.
 */
function dataBR(iso: string | null | undefined): string {
  const m = (iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return VAZIO;
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

function moeda(v: number | null | undefined): string {
  if (v === null || v === undefined) return VAZIO;
  return formatarMoeda(v);
}

function telefone(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  if (!s) return VAZIO;
  return s.startsWith("+") ? s : `+${s}`;
}

function documento(v: string | null | undefined): string {
  return mascararCpfCnpj(v) || VAZIO;
}

function numero(v: number | null | undefined): string {
  if (v === null || v === undefined) return VAZIO;
  return v.toLocaleString("pt-BR");
}

function duracao(horas: number | null | undefined, minutos: number | null | undefined): string {
  const h = horas ?? 0;
  const m = minutos ?? 0;
  if (!h && !m) return VAZIO;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

function itens(lista: ItemQuantidade[] | null | undefined): string {
  const s = (lista ?? [])
    .filter((i) => i && i.nome && i.qtd > 0)
    .map((i) => `${numeroQtd(i.qtd)} ${i.nome}`)
    .join(", ");
  return s || VAZIO;
}

function logistica(l: LogisticaSelecao | null | undefined): string {
  if (!l) return VAZIO;
  const partes: string[] = [];
  if (l.aereaQtd > 0) partes.push(`${numeroQtd(l.aereaQtd)} Aérea`);
  if (l.transladoTerrestre) partes.push("Translado terrestre");
  return partes.join(" · ") || "Inclusa no cachê";
}

function lineUp(l: string[] | null | undefined): string {
  const s = (l ?? []).filter((n) => n && n.trim()).join(", ");
  return s || VAZIO;
}

/**
 * Resolve o NOME de um vínculo (cidade/casa/artista) pra não gravar uuid cru no
 * rastro. Best-effort: lookup que falha cai no próprio id — melhor um rastro
 * feio que rastro nenhum.
 */
async function nomeDoVinculo(
  supabase: SupabaseClient,
  tabela: "cidades" | "casas" | "artists",
  id: string | null | undefined
): Promise<string> {
  if (!id) return VAZIO;
  try {
    const { data } = await supabase
      .from(tabela)
      .select("nome")
      .eq("id", id)
      .maybeSingle();
    const nome = (data as { nome?: string | null } | null)?.nome;
    return nome && nome.trim() ? nome.trim() : id;
  } catch {
    return id;
  }
}

/**
 * Compara duas versões da MESMA venda e devolve só o que MUDOU, já formatado.
 * Ordem do retorno = ordem de leitura da venda (contratante → evento → show →
 * dinheiro → detalhes).
 */
export async function diffVenda(
  supabase: SupabaseClient,
  antes: Venda,
  depois: Venda
): Promise<AlteracaoVenda[]> {
  const out: AlteracaoVenda[] = [];
  const add = (campo: string, rotulo: string, a: string, d: string) => {
    if (a !== d) out.push({ campo, rotulo, antes: a, depois: d });
  };

  // Contratante
  add("contratante_nome", "Contratante", texto(antes.contratanteNome), texto(depois.contratanteNome));
  add("contratante_email", "E-mail do contratante", texto(antes.contratanteEmail), texto(depois.contratanteEmail));
  add("contratante_telefone", "Telefone do contratante", telefone(antes.contratanteTelefone), telefone(depois.contratanteTelefone));
  add("contratante_documento", "Documento do contratante", documento(antes.contratanteDocumento), documento(depois.contratanteDocumento));
  add("contratante_razao_social", "Razão social do contratante", texto(antes.contratanteRazaoSocial), texto(depois.contratanteRazaoSocial));
  add("contratante_endereco", "Endereço do contratante", texto(antes.contratanteEndereco), texto(depois.contratanteEndereco));

  // Evento
  add("nome_evento", "Nome do evento", texto(antes.nomeEvento), texto(depois.nomeEvento));
  add("evento_instagram", "Instagram do evento", texto(antes.eventoInstagram), texto(depois.eventoInstagram));
  add("nome_local", "Local", texto(antes.nomeLocal), texto(depois.nomeLocal));
  add("capacidade_publico", "Capacidade de público", numero(antes.capacidadePublico), numero(depois.capacidadePublico));
  add("endereco_local", "Endereço do local", texto(antes.enderecoLocal), texto(depois.enderecoLocal));
  add("data_show", "Data do show", dataBR(antes.dataShow), dataBR(depois.dataShow));
  // Horário vazio na venda = "A definir" (é assim que a UI mostra).
  add(
    "horario",
    "Horário de início",
    antes.horario?.trim() ? antes.horario : "A definir",
    depois.horario?.trim() ? depois.horario : "A definir"
  );
  add("horario_fim", "Horário de término", texto(antes.horarioFim), texto(depois.horarioFim));

  // Vínculos — nome só é resolvido quando o id mudou (evita select à toa).
  if ((antes.cidadeId || "") !== (depois.cidadeId || "")) {
    add(
      "cidade_id",
      "Cidade",
      await nomeDoVinculo(supabase, "cidades", antes.cidadeId),
      await nomeDoVinculo(supabase, "cidades", depois.cidadeId)
    );
  }
  if ((antes.casaId || "") !== (depois.casaId || "")) {
    add(
      "casa_id",
      "Casa de show",
      await nomeDoVinculo(supabase, "casas", antes.casaId),
      await nomeDoVinculo(supabase, "casas", depois.casaId)
    );
  }
  if ((antes.artistaId || "") !== (depois.artistaId || "")) {
    add(
      "artist_id",
      "Artista",
      await nomeDoVinculo(supabase, "artists", antes.artistaId),
      await nomeDoVinculo(supabase, "artists", depois.artistaId)
    );
  }

  // Dinheiro
  add("cache", "Cachê", moeda(antes.cache), moeda(depois.cache));
  add("taxa_agencia_valor", "Taxa de agência", moeda(antes.taxaAgenciaValor), moeda(depois.taxaAgenciaValor));

  // Detalhes do show
  add(
    "duracao",
    "Duração",
    duracao(antes.duracaoHoras, antes.duracaoMinutos),
    duracao(depois.duracaoHoras, depois.duracaoMinutos)
  );
  add("line_up", "Line-up", lineUp(antes.lineUp), lineUp(depois.lineUp));
  add("camarim", "Rider de Camarim", itens(antes.camarim), itens(depois.camarim));
  add("efeitos", "Rider de Efeitos", itens(antes.efeitos), itens(depois.efeitos));
  add("hotel", "Hotel", itens(antes.hotel), itens(depois.hotel));
  add("logistica", "Logística", logistica(antes.logistica), logistica(depois.logistica));
  add("observacoes", "Observações", truncar(antes.observacoes), truncar(depois.observacoes));
  add("info_extra", "Informações extras", truncar(antes.infoExtra), truncar(depois.infoExtra));

  return out;
}
