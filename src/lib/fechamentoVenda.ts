import type { ItemQuantidade } from "@/types";
import { formatBRL } from "./whatsapp";

/** Dados que alimentam o texto de fechamento — subconjunto da Venda, mas aceita
 *  também o estado vivo do formulário de ConcretizarVenda (todos opcionais). */
export type DadosFechamento = {
  contratanteNome?: string;
  contratanteEmail?: string;
  contratanteTelefone?: string;
  contratanteDocumento?: string;
  contratanteEndereco?: string;
  nomeEvento?: string;
  eventoInstagram?: string;
  nomeLocal?: string;
  capacidadePublico?: number;
  enderecoLocal?: string;
  dataShow?: string;
  horario?: string;
  horarioFim?: string;
  cache?: number;
  lineUp?: string[];
  efeitos?: ItemQuantidade[];
  camarim?: ItemQuantidade[];
};

/**
 * Texto "copia e cola" pro WhatsApp gerado ao concretizar a venda (Vendas —
 * Passo 3). Preenche automaticamente tudo que já existe no orçamento/venda e
 * deixa EM BRANCO só o que falta, pro contratante completar. Sem repetir o que
 * já foi acertado. Em PT (mensagem pro cliente), como o gerarTextoWhatsApp.
 */
export function textoFechamentoVenda(v: DadosFechamento): string {
  const L: string[] = [];
  const campo = (label: string, valor?: string | number | null) => {
    const val =
      valor === undefined || valor === null || `${valor}`.trim() === ""
        ? ""
        : `${valor}`;
    L.push(`${label}: ${val}`);
  };

  L.push("🖋️ *Informações do Contratante*");
  campo("Nome", v.contratanteNome);
  campo("E-mail", v.contratanteEmail);
  campo(
    "Telefone",
    v.contratanteTelefone ? `+${v.contratanteTelefone.replace(/\D/g, "")}` : ""
  );
  campo("CPF/CNPJ", v.contratanteDocumento);
  campo("Endereço do contratante/empresa", v.contratanteEndereco);

  L.push("");
  L.push("📌 *Informações do evento*");
  campo("Nome do Evento", v.nomeEvento);
  campo("Instagram", v.eventoInstagram);
  campo("Nome do Local", v.nomeLocal);
  campo("Capacidade de público", v.capacidadePublico);
  campo("Endereço", v.enderecoLocal);
  campo("Data", fmtData(v.dataShow));
  campo("Horário da apresentação", v.horarioFim ? `${v.horario} — ${v.horarioFim}` : v.horario);
  campo("Cachê", v.cache ? formatBRL(v.cache) : "");
  campo("Line-UP", v.lineUp && v.lineUp.length ? v.lineUp.join(", ") : "");

  // Efeitos e Camarim: lista multi-linha quando houver; senão fica em branco.
  const efeitos = (v.efeitos ?? []).filter((i) => i.qtd > 0);
  L.push(efeitos.length ? "Efeitos:" : "Efeitos: ");
  efeitos.forEach((i) => L.push(`${i.qtd}x ${i.nome}`));

  const camarim = (v.camarim ?? []).filter((i) => i.qtd > 0);
  L.push(camarim.length ? "Consumação/Camarim:" : "Consumação/Camarim: ");
  camarim.forEach((i) => L.push(`${i.qtd}x ${i.nome}`));

  L.push("");
  L.push(
    "Após o preenchimento dessas informações a sua data será agendada e em seguida você receberá todos os materiais e vídeo chamada do artista."
  );
  L.push("*OBS:* Sua data só será reservada após o preenchimento total dessa lista.");

  return L.join("\n");
}

/** "YYYY-MM-DD" → DD/MM/AAAA (vazio se ausente). */
function fmtData(iso?: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
