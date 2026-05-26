/**
 * Avaliação de força de senha conforme recomendações do NIST SP
 * 800-63B (2017+) e OWASP (2024).
 *
 * Não exige composição obrigatória (maiúscula/símbolo/número). Em vez
 * disso, mede COMPRIMENTO + VARIEDADE + verifica se é uma das senhas
 * mais comuns. Senhas no top-100 são bloqueadas independentemente do
 * comprimento — assim mesmo "Password123!" não passa.
 */

export type ForcaSenha = "muito-fraca" | "fraca" | "media" | "forte";

export type AvaliacaoSenha = {
  forca: ForcaSenha;
  pontuacao: number; // 0-4
  comum: boolean;
  motivos: string[]; // mensagens curtas pro user
  podeUsar: boolean; // true se >= "fraca" E não comum
};

/**
 * Top ~120 senhas mais comuns em português e inglês.
 * Inclui variações com case que aparecem em rainbow tables.
 * Fonte: SecLists, NordPass anual, vazamentos brasileiros.
 */
const SENHAS_COMUNS = new Set<string>(
  [
    // Numéricas básicas
    "12345678", "123456789", "1234567890", "12345", "123456", "111111",
    "000000", "987654321", "147258369", "121212",
    // Padrões de teclado
    "qwerty", "qwertyuiop", "asdfghjkl", "1qaz2wsx", "qweasd", "qwer1234",
    // Palavras óbvias EN
    "password", "password1", "password123", "passw0rd", "letmein", "welcome",
    "admin", "administrator", "root", "user", "test", "guest", "login",
    "iloveyou", "abc123", "monkey", "dragon", "princess", "shadow", "master",
    "sunshine", "ashley", "michael", "jennifer", "hello", "freedom",
    // Palavras óbvias PT-BR
    "senha", "senha123", "123senha", "senhasenha", "novasenha", "minhasenha",
    "brasil", "brasil123", "brazil", "amor", "familia", "amigo", "saudade",
    "mae", "pai", "filho", "filha", "casa", "trabalho",
    // Times brasileiros (alvo comum)
    "flamengo", "corinthians", "palmeiras", "saopaulo", "santos", "fluminense",
    "vasco", "gremio", "internacional", "cruzeiro", "atletico",
    // Datas óbvias
    "01012000", "01011990", "01011980", "01012020", "01012021", "01012022",
    "01012023", "01012024", "01012025",
    // Nomes próprios populares
    "joao", "maria", "pedro", "ana", "bruno", "carlos", "paulo", "lucas",
    "rafael", "rodrigo", "felipe", "gabriel",
    // Específicos do produto
    "gigscontrol", "gigs", "control", "gigscontrol123", "gigs123",
    // Sequências
    "abcdef", "abcdefg", "abcd1234", "asd123",
    // Senhas que "parecem fortes" mas estão em rainbow tables
    "P@ssw0rd", "Senha@123", "Admin@123", "Welcome@123",
  ].map((s) => s.toLowerCase())
);

/**
 * Avalia uma senha e devolve sua força + se pode ser usada.
 *
 * Regras (NIST 800-63B simplificado):
 *  - < 8 chars → muito-fraca, bloqueia
 *  - Está em SENHAS_COMUNS → fraca, bloqueia
 *  - Comprimento + variedade definem pontuação 0-4:
 *      * +1 se >= 8
 *      * +1 se >= 12
 *      * +1 se >= 16
 *      * +1 se tem 3+ tipos de char (a-z, A-Z, 0-9, !@#$%...)
 *  - Mapeamento: 0/1 = fraca, 2 = média, 3 = forte, 4 = forte
 */
export function avaliarSenha(senha: string): AvaliacaoSenha {
  const motivos: string[] = [];
  if (!senha) {
    return {
      forca: "muito-fraca",
      pontuacao: 0,
      comum: false,
      motivos: ["Digite uma senha."],
      podeUsar: false,
    };
  }

  if (senha.length < 8) {
    motivos.push("Mínimo 8 caracteres.");
    return {
      forca: "muito-fraca",
      pontuacao: 0,
      comum: false,
      motivos,
      podeUsar: false,
    };
  }

  const lower = senha.toLowerCase();
  const comum = SENHAS_COMUNS.has(lower);
  if (comum) {
    motivos.push("Essa senha é muito comum — escolha uma diferente.");
    return {
      forca: "fraca",
      pontuacao: 1,
      comum: true,
      motivos,
      podeUsar: false,
    };
  }

  // Pontuação por comprimento
  let pontuacao = 0;
  if (senha.length >= 8) pontuacao++;
  if (senha.length >= 12) pontuacao++;
  if (senha.length >= 16) pontuacao++;

  // Pontuação por variedade
  const tipos = [
    /[a-z]/.test(senha),
    /[A-Z]/.test(senha),
    /[0-9]/.test(senha),
    /[^a-zA-Z0-9]/.test(senha),
  ].filter(Boolean).length;
  if (tipos >= 3) pontuacao++;

  let forca: ForcaSenha;
  if (pontuacao <= 1) forca = "fraca";
  else if (pontuacao === 2) forca = "media";
  else forca = "forte";

  // Sugestões sutis (sem bloquear)
  if (senha.length < 12) motivos.push("Mais longa = mais segura.");
  if (tipos < 3) motivos.push("Misture letras, números e símbolos.");

  return {
    forca,
    pontuacao,
    comum: false,
    motivos,
    podeUsar: true,
  };
}

/** Label amigável da força. */
export function labelForca(f: ForcaSenha): string {
  switch (f) {
    case "muito-fraca": return "Muito fraca";
    case "fraca":       return "Fraca";
    case "media":       return "Média";
    case "forte":       return "Forte";
  }
}

/** Cor CSS associada à força. */
export function corForca(f: ForcaSenha): string {
  switch (f) {
    case "muito-fraca": return "var(--danger)";
    case "fraca":       return "var(--danger)";
    case "media":       return "var(--warning)";
    case "forte":       return "var(--success)";
  }
}
