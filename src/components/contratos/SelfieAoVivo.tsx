"use client";

/**
 * Captura de selfie AO VIVO para a verificação facial da assinatura.
 *
 * Diferente do upload de foto, aqui a pessoa NÃO escolhe arquivo: a câmera
 * frontal é aberta (getUserMedia) e a selfie é tirada na hora, com um oval de
 * enquadramento. Isso evita enviar uma foto de galeria (anti-fraude).
 *
 * A imagem é reduzida (lado mais longo ≤ 1280px, JPEG 0.8) e devolvida por
 * `onCapturar` como data URL. `onCancelar` fecha sem capturar.
 *
 * Requer HTTPS (ou localhost) — já é o caso em produção e no dev.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { X, RefreshCw, Check, AlertCircle } from "lucide-react";

type Props = {
  onCapturar: (dataUrl: string) => void;
  onCancelar: () => void;
};

/** Lado mais longo máximo da imagem, em pixels. */
const MAX_LADO = 1280;
/** Qualidade do JPEG exportado (0–1). */
const QUALIDADE = 0.8;

const ACCENT = "var(--module-contratos)";

export default function SelfieAoVivo({ onCapturar, onCancelar }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const parar = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Abre a câmera frontal ao montar; encerra o stream ao desmontar.
  useEffect(() => {
    let cancelado = false;
    async function iniciar() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Seu navegador não tem suporte a câmera.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
          audio: false,
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        const err = e as Error;
        setErro(
          err.name === "NotAllowedError" || err.name === "SecurityError"
            ? "Permissão de câmera negada. Libere a câmera no navegador e tente de novo."
            : err.name === "NotFoundError"
              ? "Nenhuma câmera encontrada neste dispositivo."
              : err.message || "Não foi possível abrir a câmera."
        );
      }
    }
    void iniciar();
    return () => {
      cancelado = true;
      parar();
    };
  }, [parar]);

  const capturar = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || !v.videoHeight) return;
    const escala = Math.min(1, MAX_LADO / Math.max(v.videoWidth, v.videoHeight));
    const w = Math.round(v.videoWidth * escala);
    const h = Math.round(v.videoHeight * escala);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, w, h);
    setPreview(canvas.toDataURL("image/jpeg", QUALIDADE));
  }, []);

  const refazer = useCallback(() => setPreview(null), []);

  const confirmar = useCallback(() => {
    if (!preview) return;
    parar();
    onCapturar(preview);
  }, [preview, parar, onCapturar]);

  const cancelar = useCallback(() => {
    parar();
    onCancelar();
  }, [parar, onCancelar]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Topo */}
      <div className="flex items-center justify-between px-3 py-3 text-white">
        <button
          type="button"
          onClick={cancelar}
          aria-label="Fechar câmera"
          className="rounded-full p-2 hover:bg-white/10"
        >
          <X size={22} />
        </button>
        <span className="text-sm font-medium">Selfie de verificação</span>
        <span className="w-9" />
      </div>

      {/* Câmera / preview */}
      <div className="relative flex-1 overflow-hidden bg-black">
        {erro ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <AlertCircle size={34} />
            <p className="max-w-xs text-sm leading-relaxed opacity-90">{erro}</p>
            <button
              type="button"
              onClick={cancelar}
              className="btn btn-secondary mt-2"
            >
              Fechar
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              onLoadedMetadata={() => setPronto(true)}
              className="h-full w-full object-cover"
              style={{
                transform: "scaleX(-1)",
                display: preview ? "none" : "block",
              }}
            />
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Selfie capturada"
                className="h-full w-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
            )}

            {/* Oval de enquadramento + escurecimento ao redor */}
            {!preview && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div
                  className="rounded-[50%]"
                  style={{
                    width: "min(70vw, 260px)",
                    height: "min(52vh, 340px)",
                    border: "2px solid rgba(255,255,255,0.9)",
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
                  }}
                />
              </div>
            )}

            {/* Dica */}
            {!preview && (
              <div className="absolute inset-x-0 bottom-6 flex justify-center">
                <span className="rounded-full bg-black/55 px-3 py-1 text-xs text-white">
                  {pronto
                    ? "Posicione seu rosto dentro do oval"
                    : "Abrindo a câmera…"}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Controles */}
      {!erro && (
        <div className="flex items-center justify-center gap-10 bg-black px-4 py-6">
          {preview ? (
            <>
              <button
                type="button"
                onClick={refazer}
                className="flex flex-col items-center gap-1.5 text-xs text-white"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/40">
                  <RefreshCw size={20} />
                </span>
                Refazer
              </button>
              <button
                type="button"
                onClick={confirmar}
                className="flex flex-col items-center gap-1.5 text-xs text-white"
              >
                <span
                  className="flex h-16 w-16 items-center justify-center rounded-full"
                  style={{ background: ACCENT }}
                >
                  <Check size={30} />
                </span>
                Usar foto
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={capturar}
              disabled={!pronto}
              aria-label="Tirar selfie"
              className="relative h-[74px] w-[74px] rounded-full disabled:opacity-40"
            >
              <span className="absolute inset-0 rounded-full border-[3px] border-white/90" />
              <span className="absolute inset-[6px] rounded-full bg-white" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
