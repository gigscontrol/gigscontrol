import {
  RekognitionClient,
  CompareFacesCommand,
} from "@aws-sdk/client-rekognition";

/**
 * Reconhecimento facial (Fase 3) via AWS Rekognition CompareFaces. Compara a
 * selfie com a foto do documento e devolve a similaridade. Só roda no servidor
 * (rota /api/assinar). Configurado por env: REKOGNITION_KEY_ID,
 * REKOGNITION_KEY_SECRET, REKOGNITION_REGION (default sa-east-1, São Paulo).
 * Se as envs não estiverem setadas, devolve null e a assinatura segue sem o
 * facial (não trava).
 */

export type ResultadoFacial = {
  similaridade: number; // 0..100
  match: boolean; // similaridade >= LIMIAR
};

const LIMIAR = 80;

function cliente(): RekognitionClient | null {
  const accessKeyId = process.env.REKOGNITION_KEY_ID;
  const secretAccessKey = process.env.REKOGNITION_KEY_SECRET;
  if (!accessKeyId || !secretAccessKey) return null;
  return new RekognitionClient({
    region: process.env.REKOGNITION_REGION || "sa-east-1",
    credentials: { accessKeyId, secretAccessKey },
  });
}

function bytes(dataUrl: string): Uint8Array | null {
  const m = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (!m) return null;
  return new Uint8Array(Buffer.from(m[1], "base64"));
}

/**
 * Compara selfie x documento (data URLs base64). Devolve null se o serviço
 * não está configurado ou as imagens são inválidas; em erro da API devolve
 * similaridade 0 / match false (não derruba a assinatura).
 */
export async function compararFaces(
  selfieDataUrl: string,
  documentoDataUrl: string
): Promise<ResultadoFacial | null> {
  const client = cliente();
  if (!client) return null;
  const selfie = bytes(selfieDataUrl);
  const doc = bytes(documentoDataUrl);
  if (!selfie || !doc) return null;
  try {
    const res = await client.send(
      new CompareFacesCommand({
        SourceImage: { Bytes: selfie },
        TargetImage: { Bytes: doc },
        SimilarityThreshold: 0,
      })
    );
    const sim = res.FaceMatches?.[0]?.Similarity ?? 0;
    return { similaridade: Math.round(sim * 10) / 10, match: sim >= LIMIAR };
  } catch {
    return { similaridade: 0, match: false };
  }
}
