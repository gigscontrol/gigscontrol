"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  Trash2,
  Check,
  Image as ImageIcon,
  Mail,
  AtSign,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Toast from "../Toast";
import Modal from "../Modal";
import { useWorkspace } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth-context";
import AbaSeguranca from "./AbaSeguranca";

/**
 * Aba "Geral" das Configurações (antes era "Aparência").
 *
 * Reúne tudo relacionado à identidade e conta da agência:
 *  - Logo (upload pro Supabase Storage)
 *  - Nome exibido
 *  - E-mail cadastrado (somente leitura — troca via Segurança)
 *  - Username da agência (slug) — vai pro fim do login da equipe
 *    (ex: dudu-twobookings). Troca limitada a 3/30 dias, com cascata
 *    em todos os usuários do workspace.
 */

const ALTURA_LOGO = 96;
const LARGURA_MAX_LOGO = 420;

// Pega o primeiro nome do admin e normaliza pro mesmo formato dos logins
// (lowercase, sem acentos, só [a-z0-9]) — usado só nos textos de exemplo
// do bloco "Username da agência".
function slugificarPrimeiroNome(nome: string | null | undefined): string {
  if (!nome) return "";
  const primeiro = nome.trim().split(/\s+/)[0] ?? "";
  return primeiro
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

type SlugInfo = {
  slug: string;
  trocasUltimos30d: number;
  trocasRestantes: number;
  limite: number;
};

type CheckResultado = {
  status: "idle" | "checando" | "disponivel" | "em-uso" | "invalido" | "igual";
  mensagem?: string;
};

export default function AbaGeral() {
  const { aparencia, atualizarNomeAgencia, uploadLogo, removerLogo } = useWorkspace();
  const { sessao } = useAuth();
  const isAdmin = sessao?.usuario?.papel === "admin";
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
      {/* Blocos abaixo só pra admin. Não-admin (artista, vendedor etc)
          vê só a seção de Segurança no final. */}
      {isAdmin && (
        <>
      {/* ---- Logo ---- */}
      <section className="card">
        <div className="section-title mb-1">Logo da dashboard</div>
        <div className="section-subtitle mb-4">
          Envie um PNG (de preferência com fundo transparente). A imagem é
          ajustada automaticamente para caber bem no topo da dashboard.
        </div>

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
            Formatos aceitos: PNG, JPG ou WEBP, até 4 MB.
          </span>
        </div>
      </section>

      {/* ---- Nome da agência ---- */}
      <section className="card">
        <div className="section-title mb-1">Nome exibido</div>
        <div className="section-subtitle mb-4">
          Aparece no topo da dashboard quando não há logo, e também em
          contratos e orçamentos gerados pelo sistema.
        </div>

        <label className="flex flex-col gap-1 mb-3">
          <span className="text-xs font-medium text-secondary">
            Nome da agência
          </span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: TWO DASH, OPUS..."
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

      {/* ---- E-mail cadastrado (somente leitura) ---- */}
      <section className="card">
        <div className="section-title mb-1">E-mail cadastrado</div>
        <div className="section-subtitle mb-4">
          E-mail principal da conta admin. Pra trocar, vá em{" "}
          <strong className="text-primary">Segurança</strong>.
        </div>

        <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2.5">
          <Mail size={14} className="text-muted flex-shrink-0" />
          <span className="text-sm text-primary flex-1 font-mono">
            {sessao?.usuario?.email ?? "—"}
          </span>
        </div>
      </section>

      {/* ---- Username da agência ---- */}
      <SlugSection
        primeiroNomeAdmin={slugificarPrimeiroNome(sessao?.usuario?.nome) || "voce"}
        onToast={(msg, tipo) => setToast({ msg, tipo })}
      />
        </>
      )}

      {/* ---- Segurança (alterar senha) — sempre visível ---- */}
      <AbaSeguranca />

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

// ============================================================
// Username da agência — bloco separado por carregar dados próprios
// ============================================================

function SlugSection({
  primeiroNomeAdmin,
  onToast,
}: {
  primeiroNomeAdmin: string;
  onToast: (msg: string, tipo: "sucesso" | "erro") => void;
}) {
  const [info, setInfo] = useState<SlugInfo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [novoSlug, setNovoSlug] = useState("");
  const [check, setCheck] = useState<CheckResultado>({ status: "idle" });
  const [confirmandoTroca, setConfirmandoTroca] = useState(false);
  const [trocando, setTrocando] = useState(false);

  // Carrega info do slug atual
  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    fetch("/api/workspace/slug", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as SlugInfo;
      })
      .then((d) => {
        if (!ativo) return;
        setInfo(d);
      })
      .catch(() => {
        if (!ativo) return;
        setInfo(null);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  // Debounce: checa disponibilidade 400ms após parar de digitar
  useEffect(() => {
    const v = novoSlug.trim().toLowerCase();
    if (!v) {
      setCheck({ status: "idle" });
      return;
    }
    if (info && v === info.slug) {
      setCheck({ status: "igual", mensagem: "Esse é o seu username atual." });
      return;
    }
    setCheck({ status: "checando" });
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/workspace/slug/disponivel?slug=${encodeURIComponent(v)}`,
          { credentials: "include", signal: ctrl.signal }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { disponivel: boolean; erro?: string };
        if (body.disponivel) {
          setCheck({ status: "disponivel" });
        } else if (body.erro) {
          setCheck({ status: "invalido", mensagem: body.erro });
        } else {
          setCheck({ status: "em-uso", mensagem: "Já em uso por outra agência." });
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setCheck({ status: "invalido", mensagem: "Falha na checagem." });
        }
      }
    }, 400);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [novoSlug, info]);

  const podeAbrirConfirmacao = useMemo(() => {
    if (!info) return false;
    if (info.trocasRestantes <= 0) return false;
    return check.status === "disponivel";
  }, [check.status, info]);

  async function confirmarTroca() {
    if (!info || !novoSlug.trim()) return;
    setTrocando(true);
    try {
      const res = await fetch("/api/workspace/slug/trocar", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: novoSlug.trim().toLowerCase() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body.erro as string) ?? `HTTP ${res.status}`);
      }
      onToast(
        `Username trocado. ${body.usuariosAtualizados ?? 0} login(s) atualizados.`,
        "sucesso"
      );
      setConfirmandoTroca(false);
      setNovoSlug("");
      // Recarrega a página pra que a sessão e o slug em todo lugar
      // batam com o novo. Não é ideal mas é o caminho mais seguro
      // sem reescrever o auth-context inteiro.
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      onToast((e as Error).message, "erro");
    } finally {
      setTrocando(false);
    }
  }

  if (carregando) {
    return (
      <section className="card">
        <div className="section-title mb-1">Username da agência</div>
        <div className="text-sm text-muted flex items-center gap-2 mt-3">
          <Loader2 size={14} className="animate-spin" /> Carregando...
        </div>
      </section>
    );
  }

  if (!info) {
    return (
      <section className="card">
        <div className="section-title mb-1">Username da agência</div>
        <p className="text-sm text-danger mt-2">
          Não foi possível carregar. Tente recarregar a página.
        </p>
      </section>
    );
  }

  const semCota = info.trocasRestantes <= 0;
  const limpo = novoSlug.trim().toLowerCase();

  return (
    <section className="card">
      <div className="section-title mb-1">Username da agência</div>
      <div className="section-subtitle mb-4">
        Vai pro fim do login de todo artista e da equipe (ex:{" "}
        <span className="font-mono text-primary">{primeiroNomeAdmin}-{info.slug}</span>).
        Esse identificador é único: nenhuma outra agência consegue usar.
      </div>

      {/* Username atual */}
      <div className="mb-4">
        <div className="text-xs font-medium text-secondary mb-1">
          Atualmente
        </div>
        <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2.5">
          <AtSign size={14} className="text-muted flex-shrink-0" />
          <span className="text-sm font-mono text-primary flex-1">
            -{info.slug}
          </span>
        </div>
      </div>

      {/* Novo username */}
      <label className="flex flex-col gap-1 mb-3">
        <span className="text-xs font-medium text-secondary">
          Trocar pra
        </span>
        <div
          className="flex items-center gap-2 bg-elevated border rounded-md px-3 py-2 focus-within:border-border-strong transition-colors"
          style={{
            borderColor:
              check.status === "disponivel"
                ? "var(--success)"
                : check.status === "em-uso" || check.status === "invalido"
                ? "var(--danger)"
                : "var(--border-color)",
          }}
        >
          <span className="text-muted text-sm">-</span>
          <input
            value={novoSlug}
            onChange={(e) =>
              setNovoSlug(
                e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
              )
            }
            placeholder="ex: twodash2026"
            disabled={semCota}
            className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted disabled:opacity-50 font-mono"
          />
          {check.status === "checando" && (
            <Loader2 size={14} className="animate-spin text-muted" />
          )}
          {check.status === "disponivel" && (
            <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
          )}
          {(check.status === "em-uso" ||
            check.status === "invalido" ||
            check.status === "igual") && (
            <XCircle size={14} style={{ color: "var(--danger)" }} />
          )}
        </div>
        {check.mensagem && (
          <span
            className="text-xs"
            style={{
              color:
                check.status === "disponivel"
                  ? "var(--success)"
                  : check.status === "igual"
                  ? "var(--text-muted)"
                  : "var(--danger)",
            }}
          >
            {check.mensagem}
          </span>
        )}
        {check.status === "disponivel" && limpo && (
          <span className="text-xs text-success">
            Disponível ✓
          </span>
        )}
      </label>

      {/* Cota de trocas */}
      <div
        className="text-xs rounded-md px-3 py-2 mb-3 leading-relaxed"
        style={{
          backgroundColor: semCota
            ? "rgba(239,68,68,0.08)"
            : "rgba(245,158,11,0.08)",
          color: semCota ? "var(--danger)" : "var(--warning)",
          border: semCota
            ? "1px solid rgba(239,68,68,0.2)"
            : "1px solid rgba(245,158,11,0.2)",
        }}
      >
        <div className="flex items-start gap-2">
          <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
          <span>
            {semCota ? (
              <>
                Você atingiu o limite de {info.limite} trocas em 30 dias.
                Aguarde pra trocar novamente.
              </>
            ) : (
              <>
                <strong>Trocas restantes:</strong> {info.trocasRestantes}/
                {info.limite} (janela móvel de 30 dias). Cada troca muda o
                login de TODOS os artistas e equipe — avise eles antes.
              </>
            )}
          </span>
        </div>
      </div>

      <button
        onClick={() => setConfirmandoTroca(true)}
        disabled={!podeAbrirConfirmacao}
        className="btn btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Trocar username
      </button>

      {/* Modal de confirmação */}
      <Modal
        isOpen={confirmandoTroca}
        onClose={() => !trocando && setConfirmandoTroca(false)}
        title="Confirmar troca de username"
        subtitle="Esta ação muda o login de todo mundo da agência"
        maxWidth={520}
      >
        <div className="flex flex-col gap-4">
          <div
            className="text-sm rounded-md px-3 py-3 leading-relaxed"
            style={{
              backgroundColor: "rgba(245,158,11,0.08)",
              color: "var(--text-secondary)",
              border: "1px solid rgba(245,158,11,0.2)",
            }}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle
                size={16}
                style={{ color: "var(--warning)" }}
                className="flex-shrink-0 mt-0.5"
              />
              <div>
                <strong className="text-primary">
                  TODOS os logins de artistas e equipe vão mudar.
                </strong>
                <br />
                Exemplo:{" "}
                <span className="font-mono">{primeiroNomeAdmin}-{info.slug}</span> vai
                virar{" "}
                <span className="font-mono">{primeiroNomeAdmin}-{limpo}</span>.
                <br />
                Avise sua equipe antes de confirmar — eles precisam usar o
                login novo na próxima entrada.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted mb-1">De</div>
              <div className="text-sm font-mono bg-elevated border border-border rounded-md px-3 py-2">
                -{info.slug}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">Para</div>
              <div
                className="text-sm font-mono rounded-md px-3 py-2"
                style={{
                  backgroundColor: "rgba(34,197,94,0.08)",
                  border: "1px solid rgba(34,197,94,0.2)",
                  color: "var(--success)",
                }}
              >
                -{limpo}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              onClick={() => setConfirmandoTroca(false)}
              disabled={trocando}
              className="btn btn-secondary text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={confirmarTroca}
              disabled={trocando}
              className="btn btn-primary text-sm disabled:opacity-50"
            >
              {trocando ? "Trocando..." : "Sim, trocar agora"}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

// ============================================================
// Helper de redimensionamento (mesmo de antes)
// ============================================================

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
