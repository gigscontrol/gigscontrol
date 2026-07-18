import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { podeVerAgenda } from "@/lib/api/permissoes";
import { podeNaSessao } from "@/lib/api/permissao";
import { respostaDeErro } from "@/lib/api/erros";
import { buscarShowPorId } from "@/lib/services/shows.service";
import { buscarVendaPorId } from "@/lib/services/vendas.service";
import { buscarOrcamentoPorId } from "@/lib/services/orcamentos.service";
import { redigirFicha, type FichaShow } from "@/lib/agenda/ficha";
import { chaveDoSetor, type SetorAgenda } from "@/lib/permissoes/setoresAgenda";

/**
 * GET /api/shows/[id]/ficha
 *
 * A ficha do show, montada e REDIGIDA NO SERVIDOR, setor a setor.
 *
 * Existe porque o modal montava a ficha no CLIENTE, juntando a venda pelo
 * `vendaId` (`vendas.find(...)`) — e `/api/vendas` responde 403 pra quem não
 * tem chave de VENDAS. Resultado: quem tinha "Acesso total" na AGENDA via
 * Contratante, Pagamento, Camarim, Efeitos, Logística e Documentos VAZIOS, não
 * por permissão de agenda, mas porque o dado nunca chegava. Aqui a agenda passa
 * a servir a própria ficha, com as chaves DELA.
 *
 * Por que ler venda/orçamento com a sessão do usuário é seguro: a RLS de
 * `vendas`/`orcamentos` escopa por workspace E por `alcanca_operacional`
 * (vínculo com o artista). Quem não tem vínculo não lê a linha nem aqui. O que
 * este endpoint faz de diferente é NÃO aplicar o gate de MÓDULO de vendas —
 * de propósito, porque a autorização aqui é a da agenda.
 *
 * 404 (e não 403) pra show fora do alcance: não confirma nem que existe.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  const { id } = await params;

  try {
    const show = await buscarShowPorId(r.sessao.supabase, id);
    if (!show) return NextResponse.json({ erro: "Show não encontrado." }, { status: 404 });

    const artistaId = show.artistaId || null;
    // Nenhum setor alcançado = a ficha inteira é invisível. 404 em vez de 403.
    if (!podeVerAgenda(r.sessao, artistaId)) {
      return NextResponse.json({ erro: "Show não encontrado." }, { status: 404 });
    }

    const podeVer = (setor: SetorAgenda) =>
      podeNaSessao(r.sessao, artistaId, chaveDoSetor(setor));

    // Só busca o que ALGUM setor visível usa — não carregar a venda pra depois
    // jogar fora economiza a query e evita ler o que não vai ser lido.
    const precisaDaVenda = (
      [
        "contratante",
        "local",
        "detalhes",
        "pagamento",
        "lineup",
        "camarim",
        "efeitos",
        "tecnico",
        "logistica",
        "hotel",
        "observacoes",
        "documentos",
      ] as SetorAgenda[]
    ).some(podeVer);

    const venda =
      precisaDaVenda && show.vendaId
        ? await buscarVendaPorId(r.sessao.supabase, show.vendaId).catch(() => null)
        : null;
    const orcamento =
      precisaDaVenda && !venda && show.orcamentoId
        ? await buscarOrcamentoPorId(r.sessao.supabase, show.orcamentoId).catch(
            () => null
          )
        : null;

    // Venda manda; orçamento é o fallback (show que ainda não virou venda).
    const fonte = venda ?? orcamento;

    const completa: Omit<FichaShow, "setoresVisiveis"> = {
      showId: show.id,
      artistaId: show.artistaId,
      contratante: venda
        ? {
            nome: venda.contratanteNome ?? "",
            telefone: venda.contratanteTelefone || undefined,
            email: venda.contratanteEmail || undefined,
            documento: venda.contratanteDocumento || undefined,
            endereco: venda.contratanteEndereco || undefined,
          }
        : undefined,
      local: {
        nomeLocal: venda?.nomeLocal || show.venue || undefined,
        nomeEvento: venda?.nomeEvento || undefined,
        instagram: venda?.eventoInstagram || undefined,
        endereco: venda?.enderecoLocal || undefined,
        cidade: show.location || undefined,
        capacidade: venda?.capacidadePublico || undefined,
      },
      detalhes: {
        dataISO: venda?.dataShow || show.data || undefined,
        horario: venda?.horario || show.time || undefined,
        horarioFim: venda?.horarioFim || undefined,
        duracaoHoras: venda?.duracaoHoras,
        duracaoMinutos: venda?.duracaoMinutos,
        status: show.status,
        
      },
      pagamento: venda
        ? {
            cache: venda.cache,
            moeda: venda.moeda,
            parcelas: venda.parcelas,
            taxaAgenciaValor: venda.taxaAgenciaValor,
          }
        : show.valor != null
          ? { cache: show.valor }
          : undefined,
      // `lineUp` só existe na VENDA (o orçamento não tem o campo) e já é string[].
      lineup: (venda?.lineUp ?? []).filter(Boolean),
      camarim: fonte?.camarim,
      efeitos: fonte?.efeitos,
      tecnico: fonte?.tecnico,
      logistica: fonte?.logistica,
      hotel: { itens: fonte?.hotel, booking: show.booking },
      observacoes: fonte?.observacoes || undefined,
      documentos: {
        vendaId: show.vendaId,
        orcamentoId: show.orcamentoId,
      },
    };

    return NextResponse.json({ ficha: redigirFicha(completa, podeVer) });
  } catch (e) {
    return respostaDeErro(e, "Falha ao carregar a ficha do show.");
  }
}
