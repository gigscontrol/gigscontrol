"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, Check, Image as ImageIcon } from "lucide-react";
import Toast from "../Toast";
import { useWorkspace } from "@/lib/workspace-context";

/**
 * Aba "Aparência" — nome da agência + logo (Supabase Storage).
 *
 * Fluxo de upload:
 *  1. Usuário escolhe arquivo.
 *  2. Redimensionamos no canvas para a altura padrão (~96px @ 2x densidade).
 *  3. Convertemos o canvas em Blob (PNG) e enviamos via FormData
 *     para POST /api/workspace/logo, que sobe pro Storage e atualiza a
 *     `workspaces.logo_url`.
 */

const ALTURA_LOGO = 96;
const LARGURA_MAX_LOGO = 420;

export default function AbaAparencia() {
  const { aparencia, atualizarNomeAgencia, uploadLogo, removerLogo } = useWorkspace();
  const [nome, setNome] = useState(aparencia.nomeAgencia);
  const [erro, setErro] = useState<string | null>(null);
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [removendoLogo, setRemovendoLogo] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: "sucesso" | "erro" } | null>(null);
  const inputFile = useRef<HTMLInputElement>(null);

  // Sincroniza o nome local quando o context recarrega
  useEffect(() => {
    setNome(aparencia.nomeAgencia);
  }, [aparencia.nomeAgencia]);

  function escolherArquivo() {
    inputFile.current?.click();
  }

  async function aoSelecionarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    setErro(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErro("Selecione um arquivo de imagem (PNG de preferência).");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setErro("Imagem muito grande. Use um arquivo de até 4 MB.");
      return;
    }

    setEnviandoLogo(true);
    try {
      const blob = await redimensionarParaBlob(file);
      await uploadLogo(blob);
      setToast({ msg: "Logo atualizada.", tipo: "sucesso" });
    } catch (err) {
      setToast({ msg: (err as Error).message ?? "Falha ao enviar a logo.", tipo: "erro" });
    } finally {
      setEnviandoLogo(false);
      if (inputFile.current) inputFile.current.value = "";
    }
  }

  async function aoRemoverLogo() {
    setRemovendoLogo(true);
    try {
      await removerLogo();
      setToast({ msg: "Logo removida.", tipo: "sucesso" });
    } catch (err) {
      setToast({ msg: (err as Error).message, tipo: "erro" });
    } finally {
      setRemovendoLogo(false);
    }
  }

  async function salvarNome() {
    const limpo = nome.trim();
    if (!limpo) {
      setErro("O nome da agência não pode ficar vazio.");
      return;
    }
    setSalvandoNome(true);
    setErro(null);
    try {
      await atualizarNomeAgencia(limpo);
      setToast({ msg: "Nome salvo.", tipo: "sucesso" });
    } catch (err) {
      setToast({ msg: (err as Error).message, tipo: "erro" });
    } finally {
      setSalvandoNome(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* ---- Nome da agência ---- */}
      <section className="card">
        <div className="section-title mb-1">Nome da agência</div>
        <div className="section-subtitle mb-4">
          Aparece no topo da dashboard quando não há logo definida.
        </div>

        <label className="flex flex-col gap-1 mb-3">
          <span className="text-xs font-medium text-secondary">
            Nome exibido
          </span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: OPUS, TWO DASH..."
            className="campo-input"
            maxLength={40}
          />
        </label>

        <button
          onClick={salvarNome}
          disabled={salvandoNome || nome.trim() === aparencia.nomeAgencia}
          className="btn btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {salvandoNome ? "Salvando..." : <><Check size={14} /> Salvar nome</>}
        </button>
      </section>

      {/* ---- Logo ---- */}
      <section className="card">
        <div className="section-title mb-1">Logo da dashboard</div>
        <div className="section-subtitle mb-4">
          Envie um PNG (de preferência com fundo transparente). A imagem é
          ajustada automaticamente para caber bem no topo da dashboard.
        </div>

        {/* Pré-visualização */}
        <div className="mb-4">
          <div className="text-xs font-medium text-secondary mb-2">
            Pré-visualização
          </div>
          <div
            className="rounded-md border border-border bg-elevated flex items-center px-4"
            style={{ height: 80 }}
          >
            {aparencia.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={aparencia.logoUrl}
                alt="Logo da agência"
                style={{ height: 46, width: "auto" }}
              />
            ) : (
              <span className="font-bold text-lg text-primary">
                {aparencia.nomeAgencia}
                <span className="text-muted text-xs ml-2 font-normal">
                  (sem logo — exibindo o nome)
                </span>
              </span>
            )}
          </div>
        </div>

        <input
          ref={inputFile}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={aoSelecionarArquivo}
          className="hidden"
        />

        <div className="flex flex-wrap gap-2">
          <button
            onClick={escolherArquivo}
            disabled={enviandoLogo}
            className="btn btn-secondary text-sm disabled:opacity-50"
          >
            <Upload size={14} />
            {enviandoLogo
              ? "Enviando..."
              : aparencia.logoUrl
              ? "Trocar logo"
              : "Enviar logo"}
          </button>
          {aparencia.logoUrl && (
            <button
              onClick={aoRemoverLogo}
              disabled={removendoLogo}
              className="btn-ghost text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
              style={{ color: "var(--danger)" }}
            >
              <Trash2 size={14} />
              {removendoLogo ? "Removendo..." : "Remover logo"}
            </button>
          )}
        </div>

        <div className="flex items-start gap-2 mt-4 text-xs text-muted">
          <ImageIcon size={14} className="flex-shrink-0 mt-0.5" />
          <span>
            Formatos aceitos: PNG, JPG ou WEBP, até 4 MB. A logo é
            ajustada automaticamente para o topo da dashboard.
          </span>
        </div>
      </section>

      {erro && (
        <div
          className="text-sm rounded-md px-3 py-2"
          style={{
            backgroundColor: "rgba(239,68,68,0.1)",
            color: "var(--danger)",
          }}
        >
          {erro}
        </div>
      )}

      <Toast
        open={!!toast}
        mensagem={toast?.msg ?? ""}
        tipo={toast?.tipo ?? "sucesso"}
        onClose={() => setToast(null)}
      />
    </div>
  );
}

/**
 * Lê a imagem, redimensiona via canvas para a altura padrão e devolve
 * um Blob PNG. Mantém proporção e respeita a largura máxima.
 */
function redimensionarParaBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const escala = ALTURA_LOGO / img.height;
        let largura = img.width * escala;
        let altura = ALTURA_LOGO;
        if (largura > LARGURA_MAX_LOGO) {
          const escala2 = LARGURA_MAX_LOGO / largura;
          largura = LARGURA_MAX_LOGO;
          altura = altura * escala2;
        }
        const canvas = document.createElement("canvas");
        canvas.width = largura * 2;
        canvas.height = altura * 2;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas indisponível"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob) reject(new Error("canvas.toBlob falhou"));
            else resolve(blob);
          },
          "image/png"
        );
      };
      img.onerror = () => reject(new Error("imagem inválida"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("falha na leitura"));
    reader.readAsDataURL(file);
  });
}
