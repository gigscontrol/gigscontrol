/**
 * Lista de países com DDI, bandeira (emoji) e máscara de telefone.
 *
 * Países com máscara conhecida formatam automaticamente.
 * Países sem máscara aceitam digitação livre (mas com validação de min/max).
 *
 * Brasil sempre como padrão e em destaque no topo.
 */

export type Country = {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  ddi: string;
  flag: string;
  /** "X" = dígito. Outros caracteres são literais. Vazio = sem máscara. */
  mask: string;
  minDigits: number;
  maxDigits: number;
};

// Helper para evitar repetição
const c = (
  code: string,
  name: string,
  ddi: string,
  flag: string,
  mask = "",
  minDigits = 6,
  maxDigits = 15
): Country => ({ code, name, ddi, flag, mask, minDigits, maxDigits });

/** Brasil sempre em primeiro */
export const BRASIL: Country = c("BR", "Brasil", "55", "🇧🇷", "(XX) XXXXX-XXXX", 10, 11);

/** Países comuns com máscara conhecida — ficam no topo da lista após Brasil */
const PAISES_DESTAQUE: Country[] = [
  c("US", "Estados Unidos", "1", "🇺🇸", "(XXX) XXX-XXXX", 10, 10),
  c("PT", "Portugal", "351", "🇵🇹", "XXX XXX XXX", 9, 9),
  c("AR", "Argentina", "54", "🇦🇷", "XX XXXX-XXXX", 10, 11),
  c("ES", "Espanha", "34", "🇪🇸", "XXX XXX XXX", 9, 9),
  c("UY", "Uruguai", "598", "🇺🇾", "X XXX XXXX", 8, 9),
  c("PY", "Paraguai", "595", "🇵🇾", "XXX XXXXXX", 9, 9),
  c("CL", "Chile", "56", "🇨🇱", "X XXXX XXXX", 9, 9),
  c("CO", "Colômbia", "57", "🇨🇴", "XXX XXX XXXX", 10, 10),
  c("MX", "México", "52", "🇲🇽", "XX XXXX XXXX", 10, 10),
  c("FR", "França", "33", "🇫🇷", "X XX XX XX XX", 9, 9),
  c("IT", "Itália", "39", "🇮🇹", "XXX XXX XXXX", 9, 11),
  c("DE", "Alemanha", "49", "🇩🇪", "", 10, 12),
  c("GB", "Reino Unido", "44", "🇬🇧", "XXXX XXX XXXX", 10, 11),
  c("CA", "Canadá", "1", "🇨🇦", "(XXX) XXX-XXXX", 10, 10),
  c("NL", "Holanda", "31", "🇳🇱", "X XXXX XXXX", 9, 9),
  c("BE", "Bélgica", "32", "🇧🇪", "XXX XX XX XX", 9, 9),
  c("CH", "Suíça", "41", "🇨🇭", "XX XXX XX XX", 9, 9),
  c("AT", "Áustria", "43", "🇦🇹", "", 10, 13),
  c("SE", "Suécia", "46", "🇸🇪", "", 7, 13),
  c("NO", "Noruega", "47", "🇳🇴", "XXX XX XXX", 8, 8),
];

/** Demais países do mundo — ordem alfabética */
const PAISES_OUTROS: Country[] = [
  c("AF", "Afeganistão", "93", "🇦🇫"),
  c("AL", "Albânia", "355", "🇦🇱"),
  c("DZ", "Argélia", "213", "🇩🇿"),
  c("AS", "Samoa Americana", "1684", "🇦🇸"),
  c("AD", "Andorra", "376", "🇦🇩"),
  c("AO", "Angola", "244", "🇦🇴"),
  c("AI", "Anguilla", "1264", "🇦🇮"),
  c("AG", "Antígua e Barbuda", "1268", "🇦🇬"),
  c("AM", "Armênia", "374", "🇦🇲"),
  c("AW", "Aruba", "297", "🇦🇼"),
  c("AU", "Austrália", "61", "🇦🇺", "X XXXX XXXX", 9, 9),
  c("AZ", "Azerbaijão", "994", "🇦🇿"),
  c("BS", "Bahamas", "1242", "🇧🇸"),
  c("BH", "Bahrein", "973", "🇧🇭"),
  c("BD", "Bangladesh", "880", "🇧🇩"),
  c("BB", "Barbados", "1246", "🇧🇧"),
  c("BY", "Belarus", "375", "🇧🇾"),
  c("BZ", "Belize", "501", "🇧🇿"),
  c("BJ", "Benin", "229", "🇧🇯"),
  c("BM", "Bermuda", "1441", "🇧🇲"),
  c("BT", "Butão", "975", "🇧🇹"),
  c("BO", "Bolívia", "591", "🇧🇴", "XXXX XXXX", 8, 8),
  c("BA", "Bósnia e Herzegovina", "387", "🇧🇦"),
  c("BW", "Botsuana", "267", "🇧🇼"),
  c("BN", "Brunei", "673", "🇧🇳"),
  c("BG", "Bulgária", "359", "🇧🇬"),
  c("BF", "Burkina Faso", "226", "🇧🇫"),
  c("BI", "Burundi", "257", "🇧🇮"),
  c("KH", "Camboja", "855", "🇰🇭"),
  c("CM", "Camarões", "237", "🇨🇲"),
  c("CV", "Cabo Verde", "238", "🇨🇻"),
  c("KY", "Ilhas Cayman", "1345", "🇰🇾"),
  c("CF", "República Centro-Africana", "236", "🇨🇫"),
  c("TD", "Chade", "235", "🇹🇩"),
  c("CN", "China", "86", "🇨🇳"),
  c("KM", "Comores", "269", "🇰🇲"),
  c("CG", "Congo", "242", "🇨🇬"),
  c("CD", "Congo (RDC)", "243", "🇨🇩"),
  c("CK", "Ilhas Cook", "682", "🇨🇰"),
  c("CR", "Costa Rica", "506", "🇨🇷"),
  c("CI", "Costa do Marfim", "225", "🇨🇮"),
  c("HR", "Croácia", "385", "🇭🇷"),
  c("CU", "Cuba", "53", "🇨🇺"),
  c("CY", "Chipre", "357", "🇨🇾"),
  c("CZ", "Tchéquia", "420", "🇨🇿"),
  c("DK", "Dinamarca", "45", "🇩🇰"),
  c("DJ", "Djibuti", "253", "🇩🇯"),
  c("DM", "Dominica", "1767", "🇩🇲"),
  c("DO", "Rep. Dominicana", "1809", "🇩🇴"),
  c("EC", "Equador", "593", "🇪🇨"),
  c("EG", "Egito", "20", "🇪🇬"),
  c("SV", "El Salvador", "503", "🇸🇻"),
  c("GQ", "Guiné Equatorial", "240", "🇬🇶"),
  c("ER", "Eritreia", "291", "🇪🇷"),
  c("EE", "Estônia", "372", "🇪🇪"),
  c("ET", "Etiópia", "251", "🇪🇹"),
  c("FK", "Ilhas Malvinas", "500", "🇫🇰"),
  c("FO", "Ilhas Faroe", "298", "🇫🇴"),
  c("FJ", "Fiji", "679", "🇫🇯"),
  c("FI", "Finlândia", "358", "🇫🇮"),
  c("PF", "Polinésia Francesa", "689", "🇵🇫"),
  c("GA", "Gabão", "241", "🇬🇦"),
  c("GM", "Gâmbia", "220", "🇬🇲"),
  c("GE", "Geórgia", "995", "🇬🇪"),
  c("GH", "Gana", "233", "🇬🇭"),
  c("GI", "Gibraltar", "350", "🇬🇮"),
  c("GR", "Grécia", "30", "🇬🇷"),
  c("GL", "Groenlândia", "299", "🇬🇱"),
  c("GD", "Granada", "1473", "🇬🇩"),
  c("GP", "Guadalupe", "590", "🇬🇵"),
  c("GU", "Guam", "1671", "🇬🇺"),
  c("GT", "Guatemala", "502", "🇬🇹"),
  c("GG", "Guernsey", "44", "🇬🇬"),
  c("GN", "Guiné", "224", "🇬🇳"),
  c("GW", "Guiné-Bissau", "245", "🇬🇼"),
  c("GY", "Guiana", "592", "🇬🇾"),
  c("HT", "Haiti", "509", "🇭🇹"),
  c("HN", "Honduras", "504", "🇭🇳"),
  c("HK", "Hong Kong", "852", "🇭🇰"),
  c("HU", "Hungria", "36", "🇭🇺"),
  c("IS", "Islândia", "354", "🇮🇸"),
  c("IN", "Índia", "91", "🇮🇳", "XXXXX XXXXX", 10, 10),
  c("ID", "Indonésia", "62", "🇮🇩"),
  c("IR", "Irã", "98", "🇮🇷"),
  c("IQ", "Iraque", "964", "🇮🇶"),
  c("IE", "Irlanda", "353", "🇮🇪"),
  c("IM", "Ilha de Man", "44", "🇮🇲"),
  c("IL", "Israel", "972", "🇮🇱"),
  c("JM", "Jamaica", "1876", "🇯🇲"),
  c("JP", "Japão", "81", "🇯🇵"),
  c("JE", "Jersey", "44", "🇯🇪"),
  c("JO", "Jordânia", "962", "🇯🇴"),
  c("KZ", "Cazaquistão", "7", "🇰🇿"),
  c("KE", "Quênia", "254", "🇰🇪"),
  c("KI", "Kiribati", "686", "🇰🇮"),
  c("KP", "Coreia do Norte", "850", "🇰🇵"),
  c("KR", "Coreia do Sul", "82", "🇰🇷"),
  c("KW", "Kuwait", "965", "🇰🇼"),
  c("KG", "Quirguistão", "996", "🇰🇬"),
  c("LA", "Laos", "856", "🇱🇦"),
  c("LV", "Letônia", "371", "🇱🇻"),
  c("LB", "Líbano", "961", "🇱🇧"),
  c("LS", "Lesoto", "266", "🇱🇸"),
  c("LR", "Libéria", "231", "🇱🇷"),
  c("LY", "Líbia", "218", "🇱🇾"),
  c("LI", "Liechtenstein", "423", "🇱🇮"),
  c("LT", "Lituânia", "370", "🇱🇹"),
  c("LU", "Luxemburgo", "352", "🇱🇺"),
  c("MO", "Macau", "853", "🇲🇴"),
  c("MK", "Macedônia do Norte", "389", "🇲🇰"),
  c("MG", "Madagascar", "261", "🇲🇬"),
  c("MW", "Malaui", "265", "🇲🇼"),
  c("MY", "Malásia", "60", "🇲🇾"),
  c("MV", "Maldivas", "960", "🇲🇻"),
  c("ML", "Mali", "223", "🇲🇱"),
  c("MT", "Malta", "356", "🇲🇹"),
  c("MH", "Ilhas Marshall", "692", "🇲🇭"),
  c("MQ", "Martinica", "596", "🇲🇶"),
  c("MR", "Mauritânia", "222", "🇲🇷"),
  c("MU", "Maurício", "230", "🇲🇺"),
  c("YT", "Mayotte", "262", "🇾🇹"),
  c("FM", "Micronésia", "691", "🇫🇲"),
  c("MD", "Moldávia", "373", "🇲🇩"),
  c("MC", "Mônaco", "377", "🇲🇨"),
  c("MN", "Mongólia", "976", "🇲🇳"),
  c("ME", "Montenegro", "382", "🇲🇪"),
  c("MS", "Montserrat", "1664", "🇲🇸"),
  c("MA", "Marrocos", "212", "🇲🇦"),
  c("MZ", "Moçambique", "258", "🇲🇿"),
  c("MM", "Mianmar", "95", "🇲🇲"),
  c("NA", "Namíbia", "264", "🇳🇦"),
  c("NR", "Nauru", "674", "🇳🇷"),
  c("NP", "Nepal", "977", "🇳🇵"),
  c("NC", "Nova Caledônia", "687", "🇳🇨"),
  c("NZ", "Nova Zelândia", "64", "🇳🇿"),
  c("NI", "Nicarágua", "505", "🇳🇮"),
  c("NE", "Níger", "227", "🇳🇪"),
  c("NG", "Nigéria", "234", "🇳🇬"),
  c("NU", "Niue", "683", "🇳🇺"),
  c("MP", "Marianas do Norte", "1670", "🇲🇵"),
  c("OM", "Omã", "968", "🇴🇲"),
  c("PK", "Paquistão", "92", "🇵🇰"),
  c("PW", "Palau", "680", "🇵🇼"),
  c("PS", "Palestina", "970", "🇵🇸"),
  c("PA", "Panamá", "507", "🇵🇦"),
  c("PG", "Papua-Nova Guiné", "675", "🇵🇬"),
  c("PE", "Peru", "51", "🇵🇪", "XXX XXX XXX", 9, 9),
  c("PH", "Filipinas", "63", "🇵🇭"),
  c("PL", "Polônia", "48", "🇵🇱"),
  c("PR", "Porto Rico", "1787", "🇵🇷"),
  c("QA", "Catar", "974", "🇶🇦"),
  c("RE", "Reunião", "262", "🇷🇪"),
  c("RO", "Romênia", "40", "🇷🇴"),
  c("RU", "Rússia", "7", "🇷🇺"),
  c("RW", "Ruanda", "250", "🇷🇼"),
  c("BL", "São Bartolomeu", "590", "🇧🇱"),
  c("SH", "Santa Helena", "290", "🇸🇭"),
  c("KN", "São Cristóvão e Névis", "1869", "🇰🇳"),
  c("LC", "Santa Lúcia", "1758", "🇱🇨"),
  c("MF", "São Martinho", "590", "🇲🇫"),
  c("PM", "São Pedro e Miquelão", "508", "🇵🇲"),
  c("VC", "São Vicente e Granadinas", "1784", "🇻🇨"),
  c("WS", "Samoa", "685", "🇼🇸"),
  c("SM", "San Marino", "378", "🇸🇲"),
  c("ST", "São Tomé e Príncipe", "239", "🇸🇹"),
  c("SA", "Arábia Saudita", "966", "🇸🇦"),
  c("SN", "Senegal", "221", "🇸🇳"),
  c("RS", "Sérvia", "381", "🇷🇸"),
  c("SC", "Seicheles", "248", "🇸🇨"),
  c("SL", "Serra Leoa", "232", "🇸🇱"),
  c("SG", "Singapura", "65", "🇸🇬"),
  c("SX", "Sint Maarten", "1721", "🇸🇽"),
  c("SK", "Eslováquia", "421", "🇸🇰"),
  c("SI", "Eslovênia", "386", "🇸🇮"),
  c("SB", "Ilhas Salomão", "677", "🇸🇧"),
  c("SO", "Somália", "252", "🇸🇴"),
  c("ZA", "África do Sul", "27", "🇿🇦"),
  c("LK", "Sri Lanka", "94", "🇱🇰"),
  c("SD", "Sudão", "249", "🇸🇩"),
  c("SS", "Sudão do Sul", "211", "🇸🇸"),
  c("SR", "Suriname", "597", "🇸🇷"),
  c("SZ", "Essuatíni", "268", "🇸🇿"),
  c("SY", "Síria", "963", "🇸🇾"),
  c("TW", "Taiwan", "886", "🇹🇼"),
  c("TJ", "Tajiquistão", "992", "🇹🇯"),
  c("TZ", "Tanzânia", "255", "🇹🇿"),
  c("TH", "Tailândia", "66", "🇹🇭"),
  c("TL", "Timor-Leste", "670", "🇹🇱"),
  c("TG", "Togo", "228", "🇹🇬"),
  c("TK", "Tokelau", "690", "🇹🇰"),
  c("TO", "Tonga", "676", "🇹🇴"),
  c("TT", "Trinidad e Tobago", "1868", "🇹🇹"),
  c("TN", "Tunísia", "216", "🇹🇳"),
  c("TR", "Turquia", "90", "🇹🇷"),
  c("TM", "Turcomenistão", "993", "🇹🇲"),
  c("TC", "Ilhas Turcas e Caicos", "1649", "🇹🇨"),
  c("TV", "Tuvalu", "688", "🇹🇻"),
  c("UG", "Uganda", "256", "🇺🇬"),
  c("UA", "Ucrânia", "380", "🇺🇦"),
  c("AE", "Emirados Árabes", "971", "🇦🇪"),
  c("UZ", "Uzbequistão", "998", "🇺🇿"),
  c("VU", "Vanuatu", "678", "🇻🇺"),
  c("VA", "Vaticano", "379", "🇻🇦"),
  c("VE", "Venezuela", "58", "🇻🇪"),
  c("VN", "Vietnã", "84", "🇻🇳"),
  c("VG", "Ilhas Virgens Britânicas", "1284", "🇻🇬"),
  c("VI", "Ilhas Virgens Americanas", "1340", "🇻🇮"),
  c("WF", "Wallis e Futuna", "681", "🇼🇫"),
  c("EH", "Saara Ocidental", "212", "🇪🇭"),
  c("YE", "Iêmen", "967", "🇾🇪"),
  c("ZM", "Zâmbia", "260", "🇿🇲"),
  c("ZW", "Zimbábue", "263", "🇿🇼"),
];

// Brasil + destaque + alfabético
PAISES_OUTROS.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
export const COUNTRIES: Country[] = [BRASIL, ...PAISES_DESTAQUE, ...PAISES_OUTROS];
export const DEFAULT_COUNTRY = BRASIL;

/**
 * Aplica máscara estilo "(XX) XXXXX-XXXX" sobre uma string de dígitos.
 * Se máscara vazia, retorna os dígitos como vieram.
 */
export function aplicarMascara(digitos: string, mask: string): string {
  const numeros = digitos.replace(/\D/g, "");
  if (!mask) return numeros;
  let out = "";
  let i = 0;
  for (const char of mask) {
    if (i >= numeros.length) break;
    if (char === "X") {
      out += numeros[i];
      i++;
    } else {
      out += char;
    }
  }
  return out;
}

export function contarDigitos(s: string): number {
  return s.replace(/\D/g, "").length;
}

/** Monta número no formato E.164 sem o "+": ex "5511999998888" */
export function montarTelefoneE164(country: Country, digitos: string): string {
  const numeros = digitos.replace(/\D/g, "");
  return country.ddi + numeros;
}

export function buscarPais(query: string): Country[] {
  const q = query.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!q) return COUNTRIES.slice(0, 30);
  return COUNTRIES.filter((c) => {
    const nome = c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return nome.includes(q) || c.ddi.includes(q) || c.code.toLowerCase().includes(q);
  });
}
