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
import { Camera, Upload, Trash2 } from "lucide-react";

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
        setErro("Não foi possível usar essa imagem. Tente outra.");
        onChange(null);
      }
    },
    [onChange],
  );

  const remover = useCallback(() => {
    if (disabled) return;
    setPreview(null);
    setErro(null);
    onChange(null);
  }, [disabled, onChange]);

  return (
    <div className={`border border-border rounded-md p-2 flex items-center gap-3 ${disabled ? "opacity-50" : ""}`}>
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
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={label}
            className="h-20 w-auto rounded border border-border object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-foreground/80 truncate">{label}</div>
            <div className="text-xs text-success">Foto adicionada</div>
          </div>
          <button
            type="button"
            onClick={remover}
            disabled={disabled}
            title="Remover foto"
            aria-label="Remover foto"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:text-danger hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
            Remover
          </button>
        </>
      ) : (
        <>
          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded border border-dashed border-border text-zinc-400">
            <Camera className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-foreground/80 truncate">{label}</div>
            {erro ? (
              <div className="text-xs text-danger">{erro}</div>
            ) : (
              <button
                type="button"
                onClick={abrirSeletor}
                disabled={disabled}
                className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Upload className="h-4 w-4" />
                Selecionar / tirar foto
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
