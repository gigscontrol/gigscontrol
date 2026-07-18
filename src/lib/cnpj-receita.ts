/**
 * Consulta de CNPJ na Receita Federal via BrasilAPI.
 *
 * Por que BrasilAPI? É gratuita, sem chave de API, e devolve os dados públicos
 * do CNPJ direto da base da Receita. Limites de uso:
 *   - Serviço comunitário/gratuito: pode devolver 429 (rate limit) sem aviso
 *   - Sem SLA — tratamos indisponibilidade como o caso normal, não como erro
 *
 * Como usamos: quando o documento digitado num cadastro/venda fecha 14 dígitos
 * (`ehCnpj`), fazemos UMA chamada pra sugerir a razão social. Antes disso a rota
 * consulta os documentos que o próprio workspace já acumulou — essa é a camada
 * barata e é ela que cresce sozinha. Aqui só chegamos quando não conhecemos.
 *
 * Falha graciosamente: 400 (dígitos verificadores inválidos), 404 (CNPJ válido
 * que não existe), 429, timeout ou rede fora devolvem `null`. O campo de razão
 * social continua editável a mão e a venda nunca trava — falhar aqui é um
 * NÃO-EVENTO.
 *
 * A situação cadastral que devolvemos é informação do MOMENTO da consulta e
 * NÃO é persistida: ela muda com o tempo e viraria mentira guardada no banco.
 */

const BRASILAPI_CNPJ = "https://brasilapi.com.br/api/cnpj/v1";
const USER_AGENT =
  "GIGS-CONTROL/1.0 (gigscontrol.com; suporte@gigscontrol.com.br)";

/** A chamada externa não pode fazer o dono esperar: ~1s é o normal, 4s já é fora. */
const TIMEOUT_MS = 4000;

export type CnpjReceita = {
  razaoSocial: string;
  /** "ATIVA" | "BAIXADA" | "INAPTA" | "SUSPENSA" | "NULA" — do momento da consulta. */
  situacao: string | null;
};

/**
 * Busca a razão social de um CNPJ na Receita (via BrasilAPI).
 *
 * @param cnpj 14 dígitos, JÁ normalizado (só dígitos). Quem chama valida antes —
 *             a rota é a guarda anti-scanner; aqui a checagem é só cinto de segurança.
 * @returns {razaoSocial, situacao} ou null se não achou / a API falhou
 */
export async function consultarCnpjNaReceita(
  cnpj: string
): Promise<CnpjReceita | null> {
  if (!/^\d{14}$/.test(cnpj)) return null;

  try {
    const res = await fetch(`${BRASILAPI_CNPJ}/${cnpj}`, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      // Razão social muda raramente — 7 dias de cache do Next poupa a API
      // comunitária e deixa a segunda digitação do mesmo CNPJ instantânea.
      next: { revalidate: 60 * 60 * 24 * 7 },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      // Respostas LEGÍTIMAS, não falhas — não sujam o log (verificado contra a
      // API): 400 = dígitos verificadores inválidos (o dono errou ao digitar, o
      // caso mais comum) e 404 = CNPJ válido que não existe na Receita.
      // Só 429/5xx/etc. viram warn. Nenhum deles chega na cara do dono: o campo
      // segue editável a mão.
      if (res.status !== 400 && res.status !== 404) {
        console.warn(`[cnpj-receita] HTTP ${res.status} pra ${cnpj}`);
      }
      return null;
    }
    const raw = (await res.json()) as {
      razao_social?: unknown;
      descricao_situacao_cadastral?: unknown;
    };
    // Não confia no payload: só aceita string não-vazia.
    const razaoSocial =
      typeof raw.razao_social === "string" ? raw.razao_social.trim() : "";
    if (!razaoSocial) return null;
    const situacao =
      typeof raw.descricao_situacao_cadastral === "string" &&
      raw.descricao_situacao_cadastral.trim() !== ""
        ? raw.descricao_situacao_cadastral.trim().toUpperCase()
        : null;
    return { razaoSocial, situacao };
  } catch (e) {
    // Inclui TimeoutError (AbortSignal.timeout) e falha de rede.
    console.warn("[cnpj-receita] exceção:", (e as Error).message);
    return null;
  }
}
