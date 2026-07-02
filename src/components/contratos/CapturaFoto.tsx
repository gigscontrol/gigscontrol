"use client";

/**
 * Captura de foto para a página pública de assinatura (CPF, documento ou selfie).
 *
 * O usuário escolhe/tira uma foto via <input type="file">. A imagem é
 * REDUZIDA no cliente (lado mais longo ≤ 1280px, JPEG qualidade 0.7) antes de
 * virar um data URL base64, pra manter o upload pequeno (~100–300KB). Devolve
 * o data URL reduzido por `onChange` (ou null quando removido).
 */

import { useCallback, useRef, useState } from "react";
import { Camera, Upload, Check, X, RefreshCw, ScanFace } from "lucide-react";
import { useT } from "@/lib/i18n";

type CapturaFotoProps = {
  label: string;
  /** JPEG base64 reduzido; null quando removido. */
  onChange: (dataUrl: string | null) => void;
  /** Se true, abre a câmera frontal no celular (capture="user"). */
  selfie?: boolean;
  disabled?: boolean;
};

/** Lado mais longo máximo da imagem reduzida, em pixels. */
const MAX_LADO = 1280;
/** Qualidade do JPEG exportado (0–1). */
const QUALIDADE = 0.7;

/**
 * Carrega o File numa Image, desenha num canvas redimensionado de forma que o
 * lado mais longo seja ≤ MAX_LADO (mantendo proporção) e devolve o data URL JPEG.
 */
function reduzirImagem(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const { naturalWidth: w, naturalHeight: h } = img;
        if (!w || !h) {
          throw new Error("Imagem inválida.");
        }
        const escala = Math.min(1, MAX_LADO / Math.max(w, h));
        const largura = Math.max(1, Math.round(w * escala));
        const altura = Math.max(1, Math.round(h * escala));

        const canvas = document.createElement("canvas");
        canvas.width = largura;
        canvas.height = altura;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Canvas indisponível.");
        }
        ctx.drawImage(img, 0, 0, largura, altura);
        resolve(canvas.toDataURL("image/jpeg", QUALIDADE));
      } catch (e) {
        reject(e instanceof Error ? e : new Error("Falha ao processar a imagem."));
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível carregar a imagem."));
    };

    img.src = url;
  });
}

export default function CapturaFoto({
  label,
  onChange,
  selfie = false,
  disabled = false,
}: CapturaFotoProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const abrirSeletor = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const aoSelecionar = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Permite reescolher o mesmo arquivo numa próxima vez.
      e.target.value = "";
      if (!file) return;

      setErro(null);
      try {
        const dataUrl = await reduzirImagem(file);
        setPreview(dataUrl);
        onChange(dataUrl);
      } catch {
        setPreview(null);
        setErro(t("Não foi possível usar essa imagem. Tente outra."));
        onChange(null);
      }
    },
    [onChange, t],
  );

  const remover = useCallback(() => {
    if (disabled) return;
    setPreview(null);
    setErro(null);
    onChange(null);
  }, [disabled, onChange]);

  const Icone = selfie ? ScanFace : Camera;

  return (
    <div className={disabled ? "opacity-50" : ""}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={selfie ? "user" : "environment"}
        onChange={aoSelecionar}
        disabled={disabled}
        className="hidden"
      />

      {preview ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={label}
            className="h-14 w-14 flex-shrink-0 rounded-md border border-border object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-primary">
              {label}
            </div>
            <div
              className="inline-flex items-center gap-1 text-xs"
              style={{ color: "var(--success)" }}
            >
              <Check size={12} /> {t("Enviada")}
            </div>
          </div>
          <button
            type="button"
            onClick={abrirSeletor}
            disabled={disabled}
            className="btn-ghost rounded px-2 py-1 text-xs"
            title={t("Trocar foto")}
          >
            <RefreshCw size={13} /> {t("Trocar")}
          </button>
          <button
            type="button"
            onClick={remover}
            disabled={disabled}
            aria-label={t("Remover foto")}
            className="btn-ghost rounded p-1.5 hover:text-danger"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={abrirSeletor}
          disabled={disabled}
          className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border bg-surface-2 p-3 text-left transition-colors hover:border-border-strong disabled:cursor-not-allowed"
        >
          <span
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-elevated"
            style={{ color: "var(--brand)" }}
          >
            <Icone size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-primary">{label}</span>
            <span className="block text-xs text-muted">
              {selfie
                ? t("Toque para tirar a selfie")
                : t("Toque para tirar ou enviar a foto")}
            </span>
          </span>
          <Upload size={16} className="flex-shrink-0 text-muted" />
        </button>
      )}

      {erro && (
        <div className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
          {erro}
        </div>
      )}
    </div>
  );
}
