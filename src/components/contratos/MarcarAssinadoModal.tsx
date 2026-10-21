"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "../Modal";
import { Field, TextArea } from "../Field";
import { useT } from "@/lib/i18n";

/**
 * "Marcar como assinado" sem as assinaturas eletrônicas (papel, outro
 * sistema). Pede o motivo — ele vai pra trilha do contrato — e deixa claro
 * que esse contrato não ganha a verificação pública.
 */
export default function MarcarAssinadoModal({
  aberto,
  numero,
  salvando,
  onCancelar,
  onConfirmar,
}: {
  aberto: boolean;
  numero: string;
  salvando: boolean;
  onCancelar: () => void;
  onConfirmar: (motivo: string) => void;
}) {
  const t = useT();
  const [motivo, setMotivo] = useState("");
  const campo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    setMotivo("");
    // O Modal foca o 1º focável (o X) no próximo frame; aqui o que importa é
    // o motivo, então o foco vai pro campo logo depois.
    const id = setTimeout(() => campo.current?.querySelector("textarea")?.focus(), 50);
    return () => clearTimeout(id);
  }, [aberto]);

  const pronto = motivo.trim().length >= 3 && !salvando;

  return (
    <Modal
      isOpen={aberto}
      onClose={onCancelar}
      title={t("Marcar {numero} como assinado?", { numero })}
      maxWidth={480}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pronto) onConfirmar(motivo.trim());
        }}
        className="flex flex-col gap-4"
      >
        <p className="text-sm leading-relaxed text-secondary">
          {t(
            "Use só quando o contrato foi assinado fora do GigsControl, em papel ou em outro sistema. Ele não ganha o código de verificação pública, e o motivo fica registrado no histórico do contrato."
          )}
        </p>
        <div ref={campo}>
          <Field label="Motivo" required>
            <TextArea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: assinado em papel no dia do show"
              maxLength={500}
              rows={3}
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={onCancelar} className="btn btn-secondary text-sm">
            {t("Cancelar")}
          </button>
          <button
            type="submit"
            disabled={!pronto}
            className="btn btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {salvando && <Loader2 size={14} className="animate-spin" />}
            {t("Marcar como assinado")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
