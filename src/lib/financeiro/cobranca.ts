/**
 * Roteiro de cobrança de parcela (WhatsApp) — o texto pronto e as contas de
 * atraso que a lista e a ficha mostram.
 *
 * O texto muda com a situação: parcela que ainda NÃO venceu vira um lembrete;
 * a 1ª cobrança de uma atrasada é gentil (pode ser só esquecimento); da 2ª em
 * diante fica mais direta e pede uma data. Cobrança precisa de tato — é o
 * mesmo contratante que vai fechar o próximo show.
 *
 * Módulo PURO, com `hoje` injetável — coberto por cobranca.test.ts.
 */

export type DadosCobranca = {
  /** Nome do contratante (a saudação usa só o primeiro nome). */
  contratante: string;
  artista: string;
  evento?: string;
  /** YYYY-MM-DD */
  dataShow?: string;
  vendaNumero: string;
  indice: number;
  total: number;
  /** Já formatado na moeda da venda ("R$ 1.800,00"). */
  valor: string;
  /** YYYY-MM-DD */
  vencimento: string;
  /** Chave PIX do artista (vazia = a linha do PIX não entra). */
  pix?: string;
  /** Quem recebe o PIX (razão social / nome legal do artista). */
  favorecido?: string;
  /** Quantas cobranças JÁ foram registradas antes desta. */
  vezesAntes: number;
};

/** Dias do vencimento até hoje: positivo = atrasada há N dias; negativo = vence em N dias. */
export function diasDeAtraso(vencimento: string, hoje: Date): number {
  const v = new Date(`${vencimento.slice(0, 10)}T12:00:00`);
  const h = new Date(hoje);
  h.setHours(12, 0, 0, 0);
  if (Number.isNaN(v.getTime())) return 0;
  return Math.round((h.getTime() - v.getTime()) / 86_400_000);
}

/** "24/08/2026" a partir de "2026-08-24". */
export function dataBR(iso?: string): string {
  const m = iso?.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** 1 → "1ª", 2 → "2ª"… */
export function ordinal(n: number): string {
  return `${n}ª`;
}

export type TipoCobranca = "lembrete" | "primeira" | "insistencia";

export function tipoCobranca(d: Pick<DadosCobranca, "vencimento" | "vezesAntes">, hoje: Date): TipoCobranca {
  if (diasDeAtraso(d.vencimento, hoje) <= 0) return "lembrete";
  return d.vezesAntes === 0 ? "primeira" : "insistencia";
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? "";
}

export function textoCobranca(d: DadosCobranca, hoje: Date): string {
  const tipo = tipoCobranca(d, hoje);
  const nome = primeiroNome(d.contratante);
  const show = [
    `do show do *${d.artista}*`,
    d.evento?.trim() ? `(${d.evento.trim()}${d.dataShow ? `, ${dataBR(d.dataShow)}` : ""})` : d.dataShow ? `(${dataBR(d.dataShow)})` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const parcela = `*parcela ${d.indice}/${d.total}*`;
  const venc = dataBR(d.vencimento);

  const pix: string[] = [];
  if (d.pix?.trim()) {
    pix.push(tipo === "insistencia" ? "Pra regularizar via PIX:" : "Pra pagar via PIX:");
    pix.push(`*Chave:* ${d.pix.trim()}`);
    if (d.favorecido?.trim()) pix.push(`*Favorecido:* ${d.favorecido.trim()}`);
  }

  const linhas: string[] = [];
  if (tipo === "insistencia") {
    const dias = diasDeAtraso(d.vencimento, hoje);
    linhas.push(nome ? `Olá, ${nome}.` : "Olá.");
    linhas.push("");
    linhas.push(
      `Ainda não identificamos o pagamento da ${parcela} ${show}, venda ${d.vendaNumero}, vencida em *${venc}* (há ${dias} ${dias === 1 ? "dia" : "dias"}).`
    );
    linhas.push("");
    linhas.push(`*Valor:* ${d.valor}`);
    if (pix.length) linhas.push("", ...pix);
    linhas.push("");
    linhas.push("Consegue me confirmar uma data pra esse pagamento? Se já pagou, me manda o comprovante por aqui que eu dou baixa.");
  } else {
    linhas.push(nome ? `Olá, ${nome}! Tudo bem?` : "Olá! Tudo bem?");
    linhas.push("");
    linhas.push(
      tipo === "lembrete"
        ? `Passando pra lembrar que a ${parcela} ${show} vence em *${venc}*. Venda ${d.vendaNumero}.`
        : `Passando pra lembrar da ${parcela} ${show}, venda ${d.vendaNumero}:`
    );
    linhas.push("");
    linhas.push(`*Valor:* ${d.valor}`);
    linhas.push(`*Vencimento:* ${venc}`);
    if (pix.length) linhas.push("", ...pix);
    linhas.push("");
    linhas.push(
      tipo === "lembrete"
        ? "Qualquer dúvida, é só me chamar. Obrigado!"
        : "Se já pagou, é só me mandar o comprovante por aqui que eu dou baixa. Obrigado!"
    );
  }
  return linhas.join("\n");
}

/** Link do WhatsApp com o texto; sem telefone, o WhatsApp pede pra escolher o contato. */
export function linkCobrancaWhatsApp(telefone: string | undefined, texto: string): string {
  const d = (telefone ?? "").replace(/\D/g, "");
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}
