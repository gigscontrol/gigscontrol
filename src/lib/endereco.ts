/**
 * Endereço do artista guardado numa ÚNICA coluna `endereco` (sem migration):
 * as 3 partes — logradouro/rua, número e complemento — ficam unidas por "||".
 * A tela mostra 3 inputs; o perfil e o contrato formatam pra leitura humana.
 *
 * Compat: valores antigos em texto plano (sem "||") caem inteiros em `rua`.
 */

export type EnderecoPartes = {
  rua: string;
  numero: string;
  complemento: string;
};

const SEP = "||";

/** Quebra a string guardada nas 3 partes. Tolerante a vazio / formato legado. */
export function splitEndereco(
  valor: string | null | undefined
): EnderecoPartes {
  const partes = (valor ?? "").split(SEP);
  return {
    rua: partes[0] ?? "",
    numero: partes[1] ?? "",
    complemento: partes[2] ?? "",
  };
}

/** Formata pra leitura humana: "Rua X, nº 123, Apto 4". Vazio → "". */
export function formatEndereco(valor: string | null | undefined): string {
  const { rua, numero, complemento } = splitEndereco(valor);
  const partes: string[] = [];
  if (rua) partes.push(rua);
  if (numero) partes.push(`nº ${numero}`);
  if (complemento) partes.push(complemento);
  return partes.join(", ");
}
