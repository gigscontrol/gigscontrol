/**
 * Feriados nacionais brasileiros — calculados, sem dependência externa.
 *
 * Inclui os fixos + os móveis baseados na Páscoa (Carnaval, Sexta-feira
 * Santa, Corpus Christi). NÃO cobre feriados estaduais/municipais — isso
 * fica pra uma tabela gerenciável no futuro, se necessário.
 *
 * Todas as datas são strings "YYYY-MM-DD" pra casar direto com o campo
 * `data` dos shows (sem dor de cabeça de fuso horário).
 */

export type Feriado = { data: string; nome: string };

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), em UTC. */
function domingoDePascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3 = março, 4 = abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/** Soma `dias` a uma data UTC e devolve "YYYY-MM-DD". */
function somarDias(base: Date, dias: number): string {
  const d = new Date(base.getTime() + dias * 86400000);
  return d.toISOString().slice(0, 10);
}

function iso(ano: number, mes1a12: number, dia: number): string {
  const mm = String(mes1a12).padStart(2, "0");
  const dd = String(dia).padStart(2, "0");
  return `${ano}-${mm}-${dd}`;
}

/** Lista de feriados nacionais de um ano. */
export function feriadosDoAno(ano: number): Feriado[] {
  const pascoa = domingoDePascoa(ano);
  return [
    { data: iso(ano, 1, 1), nome: "Confraternização Universal" },
    { data: somarDias(pascoa, -47), nome: "Carnaval" }, // terça de carnaval
    { data: somarDias(pascoa, -2), nome: "Sexta-feira Santa" },
    { data: iso(ano, 4, 21), nome: "Tiradentes" },
    { data: iso(ano, 5, 1), nome: "Dia do Trabalho" },
    { data: somarDias(pascoa, 60), nome: "Corpus Christi" },
    { data: iso(ano, 9, 7), nome: "Independência" },
    { data: iso(ano, 10, 12), nome: "Nossa Senhora Aparecida" },
    { data: iso(ano, 11, 2), nome: "Finados" },
    { data: iso(ano, 11, 15), nome: "Proclamação da República" },
    { data: iso(ano, 12, 25), nome: "Natal" },
  ];
}

/**
 * Set de datas de feriado ("YYYY-MM-DD") cobrindo os anos pedidos.
 * Passe o ano do mês exibido (e o anterior/seguinte se precisar de borda).
 */
export function setFeriados(anos: number[]): Set<string> {
  const s = new Set<string>();
  for (const ano of anos) {
    for (const f of feriadosDoAno(ano)) s.add(f.data);
  }
  return s;
}

/** É feriado? */
export function ehFeriado(dataISO: string, feriados: Set<string>): boolean {
  return feriados.has(dataISO);
}

/** É véspera de feriado? (o dia seguinte é feriado) */
export function ehVesperaDeFeriado(
  dataISO: string,
  feriados: Set<string>
): boolean {
  const d = new Date(`${dataISO}T12:00:00Z`);
  const seguinte = new Date(d.getTime() + 86400000).toISOString().slice(0, 10);
  return feriados.has(seguinte);
}
