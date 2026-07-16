"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Copy, Check, Clock, RefreshCw } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { DadosPixBrick } from "./MercadoPagoBrick";

/**
 * Tela do PIX pendente: mostra o QR Code (imagem base64), o copia-e-cola
 * (qr_code texto), uma contagem regressiva de 30 min e faz polling do status
 * a cada 4s. Quando o backend confirma `approved`, dispara `onAprovado` — o
 * MESMO sucesso do cartão. Ao expirar (30 min ou status expired/cancelled),
 * mostra o estado 'expirado' com botão pra gerar um novo QR.
 */

const EXPIRA_MS = 30 * 60 * 1000; // 30 min
const POLL_MS = 4000; // 4s

type Props = {
  dados: DadosPixBrick;
  onAprovado: (paymentId: string) => void;
  /** Pai gera um novo pagamento PIX (volta pro Brick) quando expira. */
  onGerarNovo: () => void;
};

function formatarTempo(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(total / 60);
  const seg = total % 60;
  return `${String(min).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;
}

export default function PixPendente({ dados, onAprovado, onGerarNovo }: Props) {
  const t = useT();
  const [restanteMs, setRestanteMs] = useState(EXPIRA_MS);
  const [expirado, setExpirado] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // onAprovado volátil sem re-armar o polling.
  const aprovadoRef = useRef(onAprovado);
  aprovadoRef.current = onAprovado;

  const inicio = useRef(Date.now());

  // Reinicia o relógio quando um novo QR chega (paymentId muda).
  useEffect(() => {
    inicio.current = Date.now();
    setRestanteMs(EXPIRA_MS);
    setExpirado(false);
    setCopiado(false);
  }, [dados.paymentId]);

  // Contagem regressiva (tick a cada 1s).
  useEffect(() => {
    if (expirado) return;
    const id = setInterval(() => {
      const rest = EXPIRA_MS - (Date.now() - inicio.current);
      if (rest <= 0) {
        setRestanteMs(0);
        setExpirado(true);
        clearInterval(id);
      } else {
        setRestanteMs(rest);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [expirado, dados.paymentId]);

  // Polling do status.
  useEffect(() => {
    if (expirado) return;
    let ativo = true;

    const id = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/checkout/mercadopago/status?paymentId=${encodeURIComponent(
            dados.paymentId
          )}`,
          { credentials: "include" }
        );
        if (!ativo) return;
        const body = await res.json().catch(() => ({}));
        const status = body.status as string | undefined;
        if (status === "approved") {
          clearInterval(id);
          aprovadoRef.current(dados.paymentId);
        } else if (
          status === "cancelled" ||
          status === "expired" ||
          status === "rejected"
        ) {
          clearInterval(id);
          setExpirado(true);
        }
      } catch {
        /* transiente — tenta de novo no próximo tick */
      }
    }, POLL_MS);

    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [dados.paymentId, expirado]);

  const copiar = useCallback(async () => {
    if (!dados.qrCode) return;
    try {
      await navigator.clipboard.writeText(dados.qrCode);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* clipboard bloqueado — ignora silenciosamente */
    }
  }, [dados.qrCode]);

  if (expirado) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Clock size={28} style={{ color: "var(--muted)" }} />
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          {t("O código PIX expirou.")}
        </p>
        <button
          type="button"
          onClick={onGerarNovo}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm rounded-control"
        >
          <RefreshCw size={14} />
          {t("Gerar novo código")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <p className="text-sm" style={{ color: "var(--text-primary)" }}>
        {t("Escaneie o QR Code no app do seu banco")}
      </p>

      {dados.qrCodeBase64 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`data:image/png;base64,${dados.qrCodeBase64}`}
          alt={t("QR Code PIX")}
          width={220}
          height={220}
          className="rounded-lg"
          style={{ background: "#fff", padding: 8 }}
        />
      ) : (
        <div className="flex items-center gap-2 py-8 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" />
          {t("Gerando o QR Code...")}
        </div>
      )}

      {dados.qrCode && (
        <button
          type="button"
          onClick={copiar}
          className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm rounded-control"
        >
          {copiado ? <Check size={14} /> : <Copy size={14} />}
          {copiado ? t("Copiado!") : t("Copiar código copia-e-cola")}
        </button>
      )}

      <div
        className="flex items-center gap-2 text-xs"
        style={{ color: "var(--muted)" }}
      >
        <Clock size={12} />
        {t("Expira em {tempo}", { tempo: formatarTempo(restanteMs) })}
      </div>

      <div
        className="flex items-center gap-2 text-xs"
        style={{ color: "var(--muted)" }}
      >
        <Loader2 size={12} className="animate-spin" />
        {t("Aguardando o pagamento...")}
      </div>
    </div>
  );
}
