import type { ContratoStatus } from "@/lib/mappers/contrato";

/**
 * Regra da troca MANUAL de status do contrato (PATCH da agência). O normal é
 * o status andar sozinho pelas assinaturas (enviado → assinado, em
 * contratoSignatarios.service); à mão, duas travas:
 *  - FINALIZADO pelas assinaturas não volta pra rascunho/enviado — só
 *    cancelar e, depois, reativar como assinado;
 *  - "assinado" sem as assinaturas (papel, outro sistema) exige motivo.
 *
 * Módulo PURO — coberto por regraStatus.test.ts. Devolve o erro a mostrar
 * (com o status HTTP) ou null quando a troca pode seguir.
 */
export function erroTrocaStatus(o: {
  statusAtual: ContratoStatus;
  statusNovo: ContratoStatus;
  finalizado: boolean;
  motivo?: string | null;
}): { status: 400 | 409; mensagem: string } | null {
  if (o.statusNovo === o.statusAtual) return null;
  if (o.finalizado && o.statusNovo !== "cancelado" && o.statusNovo !== "assinado") {
    return {
      status: 409,
      mensagem:
        "Este contrato foi finalizado pelas assinaturas eletrônicas — o status não volta atrás. Se precisar tirá-lo de circulação, cancele.",
    };
  }
  if (o.statusNovo === "assinado" && !o.finalizado && !o.motivo?.trim()) {
    return {
      status: 400,
      mensagem:
        "Diga por que o contrato está sendo marcado como assinado (ex.: assinado em papel).",
    };
  }
  return null;
}
