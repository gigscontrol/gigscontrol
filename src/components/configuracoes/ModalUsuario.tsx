"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  Check,
  ShieldCheck,
  KeyRound,
  Copy,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mail,
  Users,
  AtSign,
  SlidersHorizontal,
} from "lucide-react";
import Modal from "../Modal";
import ConfirmarSaidaModal from "../ConfirmarSaidaModal";
import { useConfirmar } from "../ConfirmarModal";
import { useNavegacaoOpcional } from "../NavOverlay";
import { useArtistas, type UsuarioEquipe } from "@/lib/workspace-context";
import { PERFIS, type PerfilId } from "@/lib/permissoes/perfis";
import { CATALOGO } from "@/lib/permissoes/catalogo";
import CidadeGlobalAutocomplete, { type CidadeEscolhida } from "../CidadeGlobalAutocomplete";
import { resolverCidade, cidadeParaEscolhida } from "@/lib/cidade-helpers";
import { BRASIL, COUNTRIES, type Country } from "@/lib/data/countries";
import { CORES, Campo, CamposDadosContrato, LinhaEscopo, Secao, SeletorDeCor, normalizarUsername } from "./camposCadastro";
import { EditorPermissoesVinculo } from "./EquipeDoArtista";
import type { DocumentoTipo } from "@/types";
import { corComoTexto } from "@/lib/contraste";

/** Vínculo (usuário × artista) resumido — perfis + permissões por artista. */
export type VinculoResumo = { artistId: string; perfis: string[]; permissoes: string[] };

/** Rótulo (do catálogo) da permissão de criar pastas de anotações. */
const ROTULO_ANOTACOES =
  CATALOGO.find((p) => p.chave === "agencia.criar_pastas_anotacoes")?.label ??
  "Criar pastas de anotações";

// ================================================================
// Modal de criação / edição
// ================================================================

export type DadosContaUsuario = {
  email: string;
  emailVerificado: boolean;
  /** true quando o e-mail ainda é o fake interno (membro criado por handle). */
  emailFakeInterno: boolean;
  ultimoLogin: string | null;
  senhaPadrao: boolean;
  /** Plaintext da senha aleatória — só preenchida enquanto senhaPadrao=true. */
  senhaPadraoValor: string | null;
};

/**
 * Patch enviado pelo modo EDITAR — apelido + dados de pessoa (snake_case, o
 * mesmo formato que `atualizarUsuario` repassa pro backend) + bloqueio.
 * E-mail fica de fora de propósito (bloqueado; o membro cadastra depois).
 */
export type PatchEditarUsuario = {
  nome?: string;
  ativo?: boolean;
  pode_criar_anotacoes?: boolean;
  cor?: string;
  pais?: string;
  nome_legal?: string;
  documento_tipo?: string;
  documento?: string;
  razao_social?: string;
  endereco?: string;
  telefone?: string;
  data_nascimento?: string;
  cidade_id?: string;
};

export function ModalUsuario({
  modo,
  inicial,
  slugAgencia,
  onFechar,
  onCriar,
  onEditar,
  onResetarSenha,
  modoInline = false,
}: {
  modo: "criar" | "editar";
  inicial?: UsuarioEquipe;
  /** Slug da agência — usado pra montar o handle "raiz-slug" na criação. */
  slugAgencia: string;
  onFechar: () => void;
  /**
   * Inline (sem wrapper de Modal) — pro onboarding embedar o form completo
   * na etapa da equipe, igual a etapa do artista faz com ModalNovoArtista.
   */
  modoInline?: boolean;
  onCriar: (dados: {
    nome: string;
    username_raiz: string;
    artistIds: string[];
    permissoes_por_artista?: Record<string, string[]>;
    /** Presets (perfis) por artista escolhidos já na criação — persistem no vínculo. */
    perfis_por_artista?: Record<string, string[]>;
    cor?: string;
    pais?: string;
    nome_legal?: string;
    documento_tipo?: string;
    documento?: string;
    razao_social?: string;
    endereco?: string;
    telefone?: string;
    data_nascimento?: string;
    email_contato?: string;
    cidade_id?: string;
  }) => void | Promise<void>;
  onEditar: (id: string, dados: PatchEditarUsuario) => void | Promise<void>;
  /** Só passado no modo editar. Reseta a senha do usuário. */
  onResetarSenha?: () => void | Promise<void>;
}) {
  const t = useT();
  const artistas = useArtistas();
  const { confirmar, confirmador } = useConfirmar();
  const [nome, setNome] = useState(inicial?.nome ?? "");
  // Login (só na criação): raiz digitada pelo admin; auto-preenche a
  // partir do nome enquanto o admin não editar o campo manualmente.
  const [usernameRaiz, setUsernameRaiz] = useState("");
  const [usernameFoiEditado, setUsernameFoiEditado] = useState(false);
  const [copiouUsername, setCopiouUsername] = useState(false);
  // Artistas com quem trabalha (a função é definida depois na aba Equipe).
  const [artistIdsSel, setArtistIdsSel] = useState<Set<string>>(new Set());
  // Permissões já definidas por artista no próprio modal de criação
  // (mapa artistId → chaves). Vazio = vínculo nasce sem permissão.
  const [permsPorArtista, setPermsPorArtista] = useState<Record<string, string[]>>({});
  // Presets (perfis) escolhidos por artista no modal de criação (mapa
  // artistId → ids de perfil). ANTES eram descartados — agora persistem no
  // vínculo via `perfis_por_artista`, então o vínculo nasce rotulado (ex.:
  // "Manager"), não como "Personalizado".
  const [perfisPorArtista, setPerfisPorArtista] = useState<Record<string, PerfilId[]>>({});
  // Artista cujo editor de permissões está aberto (modal empilhado). null = fechado.
  const [editandoPermsDe, setEditandoPermsDe] = useState<string | null>(null);
  // Dados pessoais (opcionais) — country-aware, servem para contrato.
  // No modo editar, pré-preenche a partir do `inicial` (mesmo conjunto de
  // estados do modo criar) — igual o editar do artista faz.
  const [paisPessoal, setPaisPessoal] = useState<Country>(
    () =>
      COUNTRIES.find((p) => p.code === (inicial?.pais ?? "BR").toUpperCase()) ??
      BRASIL
  );
  const [cor, setCor] = useState<string>(inicial?.cor ?? CORES[0]);
  // Cidade: o `inicial.cidade` (join no backend por cidade_id) traz nome/uf/país,
  // então no editar o autocomplete já abre PRÉ-PREENCHIDO. Sem cidade (modo criar,
  // ou cidade legada sem ibge/geoname) começa vazio. No submit só resolve/manda
  // cidade_id se houver seleção — a cidade inalterada resolve pro mesmo id
  // (lookup idempotente), então não muda nada; escolher outra troca.
  const [cidadeSel, setCidadeSel] = useState<CidadeEscolhida | null>(
    () => cidadeParaEscolhida(inicial?.cidade ?? null)
  );
  const [nomeLegal, setNomeLegal] = useState(inicial?.nomeLegal ?? "");
  const [documentoTipo, setDocumentoTipo] = useState<DocumentoTipo>(
    // `inicial.documentoTipo` vem tipado como string no workspace-context;
    // aqui só existem os tipos válidos de DocumentoTipo, então estreitamos.
    (inicial?.documentoTipo as DocumentoTipo | undefined) ?? "cpf"
  );
  const [documento, setDocumento] = useState(inicial?.documento ?? "");
  const [razaoSocial, setRazaoSocial] = useState(inicial?.razaoSocial ?? "");
  const [endereco, setEndereco] = useState(inicial?.endereco ?? "");
  const [telefone, setTelefone] = useState(inicial?.telefone ?? "");
  const [dataNascimento, setDataNascimento] = useState(inicial?.dataNascimento ?? "");
  const [ativo, setAtivo] = useState<boolean>(inicial?.ativo ?? true);
  // Permissão dedicada: pode criar pastas de anotações na Agenda (movida do
  // painel de detalhe pra cá, T3).
  const [podeCriarAnotacoes, setPodeCriarAnotacoes] = useState<boolean>(
    inicial?.podeCriarAnotacoes ?? false
  );
  // Validação: `erros` = Set das CHAVES obrigatórias faltando ("nome"/"username")
  // pra borda vermelha + contador. `erro` = mensagem geral (rede/servidor).
  const [erros, setErros] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Remove uma chave do Set de erros (onChange dos campos obrigatórios — a
  // borda vermelha some assim que o usuário mexe no campo).
  function limparErro(chave: string) {
    setErros((prev) => {
      if (!prev.has(chave)) return prev;
      const n = new Set(prev);
      n.delete(chave);
      return n;
    });
  }

  // Mensagem derivada do Set (live): específica com 1 campo, "N informações
  // faltando" com vários.
  const msgErros =
    erros.size === 0
      ? null
      : erros.size === 1
      ? erros.has("nome")
        ? t("Nome obrigatório")
        : t("Login obrigatório")
      : t("{n} informações faltando", { n: erros.size });

  // Handle completo + validação (mesma regra de AbaArtistas).
  const usernameCompleto = usernameRaiz.trim()
    ? `${usernameRaiz.trim().toLowerCase()}-${slugAgencia}`
    : "";
  const usernameValido = (() => {
    const v = usernameRaiz.trim();
    if (v.length < 3) return false;
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(v);
  })();

  // Auto-sugere o username a partir do nome até o admin tocar no campo.
  useEffect(() => {
    if (modo !== "criar" || usernameFoiEditado) return;
    setUsernameRaiz(normalizarUsername(nome));
  }, [nome, modo, usernameFoiEditado]);

  // Dados de conta — async no modo editar. No modo criar não tem
  // sentido (o usuário ainda nem existe).
  const [conta, setConta] = useState<DadosContaUsuario | null>(null);
  const [carregandoConta, setCarregandoConta] = useState(modo === "editar");
  const [copiouSenhaPadrao, setCopiouSenhaPadrao] = useState(false);
  // Feedback de copiar o login (handle) no card de Acesso ao sistema do editar.
  const [copiouLoginEditar, setCopiouLoginEditar] = useState(false);

  // ---- Permissões por artista (T8) — só no modo editar ----
  // Vínculos do membro (artista × perfis × permissões). null = carregando.
  const [vinculosEdit, setVinculosEdit] = useState<VinculoResumo[] | null>(null);
  const [vinculosEditErro, setVinculosEditErro] = useState(false);
  // Artista cujo editor de permissões está aberto no modo editar (modal
  // empilhado). null = fechado.
  const [editandoVinculoDe, setEditandoVinculoDe] = useState<string | null>(null);
  const [salvandoVinculo, setSalvandoVinculo] = useState(false);

  const carregarVinculos = useCallback(async () => {
    if (modo !== "editar" || !inicial?.id) return;
    setVinculosEdit(null);
    setVinculosEditErro(false);
    try {
      const res = await fetch(`/api/usuarios/${inicial.id}/vinculos`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = (await res.json()) as { vinculos: VinculoResumo[] };
      setVinculosEdit(d.vinculos ?? []);
    } catch {
      setVinculosEdit([]);
      setVinculosEditErro(true);
    }
  }, [modo, inicial?.id]);

  useEffect(() => {
    void carregarVinculos();
  }, [carregarVinculos]);

  // Salva as permissões de UM vínculo (usuário × artista) — reutiliza o
  // endpoint PUT já existente da equipe do artista, depois recarrega a lista.
  async function salvarVinculo(artistaId: string, permissoes: string[], perfis: string[]) {
    if (!inicial?.id) return;
    setSalvandoVinculo(true);
    try {
      const res = await fetch(`/api/artistas/${artistaId}/equipe/${inicial.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfis, permissoes }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.erro ?? t("Falha ao salvar."));
      setEditandoVinculoDe(null);
      await carregarVinculos();
    } finally {
      setSalvandoVinculo(false);
    }
  }

  useEffect(() => {
    if (modo !== "editar" || !inicial?.id) return;
    let mounted = true;
    setCarregandoConta(true);
    fetch(`/api/usuarios/${inicial.id}/conta`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as DadosContaUsuario;
      })
      .then((d) => {
        if (mounted) setConta(d);
      })
      .catch(() => {
        if (mounted) setConta(null);
      })
      .finally(() => {
        if (mounted) setCarregandoConta(false);
      });
    return () => {
      mounted = false;
    };
  }, [modo, inicial?.id]);

  function toggleArtista(id: string) {
    setArtistIdsSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Desmarcar o artista limpa as permissões E os perfis definidos.
        setPermsPorArtista((p) => {
          if (!(id in p)) return p;
          const resto = { ...p };
          delete resto[id];
          return resto;
        });
        setPerfisPorArtista((p) => {
          if (!(id in p)) return p;
          const resto = { ...p };
          delete resto[id];
          return resto;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function salvar(): Promise<boolean> {
    // Coleta TODOS os obrigatórios faltando de uma vez (não para no 1º). O
    // login só é exigido na criação; o editar exige apenas o apelido.
    // Devolve true no sucesso — a guarda de saída usa isso pra decidir se sai.
    const faltando = new Set<string>();
    if (!nome.trim()) faltando.add("nome");
    if (modo === "criar" && !usernameValido) faltando.add("username");
    if (faltando.size > 0) {
      setErros(faltando);
      setErro(null);
      return false;
    }
    setErros(new Set());

    if (modo === "criar") {
      const artistIds = [...artistIdsSel];
      setSalvando(true);
      setErro(null);
      try {
        // Cidade (opcional) → resolve/cria e devolve o UUID do catálogo.
        let cidadeId: string | undefined;
        if (cidadeSel) {
          try {
            cidadeId = (await resolverCidade(cidadeSel)).id;
          } catch {
            /* cidade não resolvida — segue sem (não bloqueia o cadastro) */
          }
        }
        // Só manda permissões dos artistas realmente selecionados e com ao
        // menos 1 chave — vínculo sem permissão nasce vazio de qualquer forma.
        const permsPayload: Record<string, string[]> = {};
        for (const aid of artistIds) {
          const chaves = permsPorArtista[aid];
          if (chaves && chaves.length > 0) permsPayload[aid] = chaves;
        }
        // Presets escolhidos por artista — persistem no vínculo (fix do bug:
        // antes o perfil escolhido na criação era descartado).
        const perfisPayload: Record<string, string[]> = {};
        for (const aid of artistIds) {
          const perfis = perfisPorArtista[aid];
          if (perfis && perfis.length > 0) perfisPayload[aid] = perfis;
        }
        await onCriar({
          nome: nome.trim(),
          username_raiz: usernameRaiz.trim().toLowerCase(),
          artistIds,
          permissoes_por_artista: Object.keys(permsPayload).length > 0 ? permsPayload : undefined,
          perfis_por_artista: Object.keys(perfisPayload).length > 0 ? perfisPayload : undefined,
          cor,
          pais: paisPessoal.code,
          nome_legal: nomeLegal.trim() || undefined,
          documento_tipo: documentoTipo,
          documento: documento.trim() || undefined,
          razao_social: (documentoTipo === "cnpj" ? razaoSocial.trim() : "") || undefined,
          telefone: telefone.trim() || undefined,
          endereco: endereco.trim() || undefined,
          data_nascimento: dataNascimento || undefined,
          cidade_id: cidadeId,
        });
        return true;
      } catch (e) {
        setErro((e as Error).message);
        return false;
      } finally {
        setSalvando(false);
      }
    }

    // Editar: apelido + dados de pessoa + bloqueio. O acesso (perfis/permissões
    // por artista) continua gerenciado na aba Equipe do artista. E-mail fica
    // bloqueado (o membro cadastra depois).
    if (!inicial) return false;
    setSalvando(true);
    setErro(null);
    try {
      // Cidade (opcional): só resolve/envia se o admin escolher uma nova —
      // senão o backend mantém a atual (o autocomplete começa vazio no editar).
      let cidadeId: string | undefined;
      if (cidadeSel) {
        try {
          cidadeId = (await resolverCidade(cidadeSel)).id;
        } catch {
          /* cidade não resolvida — segue sem (não bloqueia o cadastro) */
        }
      }
      await onEditar(inicial.id, {
        nome: nome.trim(),
        ativo,
        pode_criar_anotacoes: podeCriarAnotacoes,
        cor,
        pais: paisPessoal.code,
        nome_legal: nomeLegal.trim() || undefined,
        documento_tipo: documentoTipo,
        documento: documento.trim() || undefined,
        razao_social: (documentoTipo === "cnpj" ? razaoSocial.trim() : "") || undefined,
        endereco: endereco.trim() || undefined,
        telefone: telefone.trim() || undefined,
        data_nascimento: dataNascimento || undefined,
        cidade_id: cidadeId,
      });
      return true;
    } catch (e) {
      setErro((e as Error).message);
      return false;
    } finally {
      setSalvando(false);
    }
  }

  // ---- Guarda de "alterações não salvas" (só no modo editar) ----
  // Assinatura dos campos editáveis do editar. A baseline é capturada no 1º
  // render (form recém-aberto = pristine) → sujo=false ao abrir.
  const assinatura = useMemo(
    () =>
      JSON.stringify({
        nome,
        cor,
        cidade: cidadeSel
          ? `${cidadeSel.pais}|${cidadeSel.uf}|${cidadeSel.nome}|${cidadeSel.ibgeId ?? cidadeSel.geonameId ?? ""}`
          : "",
        pais: paisPessoal.code,
        nomeLegal,
        documentoTipo,
        documento,
        razaoSocial,
        endereco,
        telefone,
        dataNascimento,
        ativo,
        podeCriarAnotacoes,
      }),
    [
      nome,
      cor,
      cidadeSel,
      paisPessoal,
      nomeLegal,
      documentoTipo,
      documento,
      razaoSocial,
      endereco,
      telefone,
      dataNascimento,
      ativo,
      podeCriarAnotacoes,
    ]
  );
  const baselineRef = useRef<string | null>(null);
  if (baselineRef.current === null) baselineRef.current = assinatura;
  const sujo = modo === "editar" && assinatura !== baselineRef.current;

  // Popup de confirmação da saída LOCAL (botão Cancelar do editar).
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const cancelar = () => {
    if (modo === "editar" && sujo) setConfirmarSaida(true);
    else onFechar();
  };

  // Guarda GLOBAL (interceptar navegação pra outra tela) — só no editar e só
  // quando há provider (o form também roda no onboarding, sem NavProvider).
  const nav = useNavegacaoOpcional();
  const registrarGuarda = nav?.registrarGuarda;
  const limparGuarda = nav?.limparGuarda;
  const sujoRef = useRef(sujo);
  sujoRef.current = sujo;
  const salvarRef = useRef(salvar);
  salvarRef.current = salvar;
  useEffect(() => {
    if (modo !== "editar" || !registrarGuarda || !limparGuarda) return;
    registrarGuarda(() => ({ sujo: sujoRef.current, salvar: salvarRef.current }));
    return () => limparGuarda();
  }, [modo, registrarGuarda, limparGuarda]);

  const conteudo = (
      <div className="flex flex-col gap-4">
        {modo === "criar" ? (
          <>
            <Secao titulo={t("Dados básicos")}>
              <Campo label={t("Apelido")} erro={erros.has("nome")}>
                <input
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value);
                    if (e.target.value.trim()) limparErro("nome");
                  }}
                  placeholder={t("Como essa pessoa é chamada")}
                  className={`campo-input${erros.has("nome") ? " erro" : ""}`}
                  autoFocus
                />
                <span className="text-micro text-muted mt-1 block">
                  {t("É o nome que aparece pros outros usuários da sua agência.")}
                </span>
              </Campo>
              <Campo label={t("País e cidade onde reside")}>
                <CidadeGlobalAutocomplete
                  value={cidadeSel}
                  onChange={setCidadeSel}
                  onPaisChange={setPaisPessoal}
                  placeholder={t("Ex: São Paulo, Rio de Janeiro...")}
                />
              </Campo>
            </Secao>

            <Secao titulo={t("Dados pessoais")}>
              <CamposDadosContrato
                pais={paisPessoal}
                setPais={setPaisPessoal}
                nomeLegal={nomeLegal}
                setNomeLegal={setNomeLegal}
                documentoTipo={documentoTipo}
                setDocumentoTipo={setDocumentoTipo}
                documento={documento}
                setDocumento={setDocumento}
                razaoSocial={razaoSocial}
                setRazaoSocial={setRazaoSocial}
                endereco={endereco}
                setEndereco={setEndereco}
                telefone={telefone}
                setTelefone={setTelefone}
                dataNascimento={dataNascimento}
                setDataNascimento={setDataNascimento}
              />
            </Secao>

            <SeletorDeCor cor={cor} onChange={setCor} />

            {/* Tag visual do tipo de cadastro */}
            <div className="flex items-center gap-2">
              <span
                className="text-micro font-bold uppercase tracking-wider px-2 py-0.5 rounded text-white"
                style={{ backgroundColor: "var(--brand)" }}
              >
                {t("Equipe")}
              </span>
            </div>

            <Secao titulo={t("Acesso ao sistema")}>
              <Campo label={t("Login (username)")} erro={erros.has("username")}>
                <div
                  className="flex items-center bg-elevated border border-border rounded-md px-3 py-2 foco-campo-dentro"
                  style={erros.has("username") ? { borderColor: "var(--danger)" } : undefined}
                >
                  <input
                    value={usernameRaiz}
                    onChange={(e) => {
                      setUsernameFoiEditado(true);
                      setUsernameRaiz(
                        e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                      );
                      limparErro("username");
                    }}
                    placeholder="marinasouza"
                    style={{
                      width: `${Math.max(
                        usernameRaiz.length || "marinasouza".length,
                        4
                      )}ch`,
                    }}
                    className="bg-transparent outline-none text-sm text-primary placeholder:text-muted font-mono"
                  />
                  <span className="text-sm text-muted font-mono whitespace-nowrap">
                    -{slugAgencia || "agencia"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!usernameValido || !usernameCompleto) return;
                      navigator.clipboard.writeText(usernameCompleto).then(() => {
                        setCopiouUsername(true);
                        setTimeout(() => setCopiouUsername(false), 2000);
                      });
                    }}
                    disabled={!usernameValido}
                    className="ml-auto btn-ghost p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label={t("Copiar login completo")}
                    title={
                      usernameValido
                        ? t("Copiar login completo")
                        : t("Preencha um login válido pra copiar")
                    }
                  >
                    {copiouUsername ? (
                      <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>
                {usernameCompleto && !usernameValido && (
                  <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>
                    {t("Use 3+ caracteres (letras, números, hífen)")}
                  </p>
                )}
                {usernameValido && usernameCompleto && (
                  <p className="text-xs mt-1" style={{ color: "var(--success)" }}>
                    {t("Login completo:")}{" "}
                    <strong className="font-mono text-primary">{usernameCompleto}</strong>
                  </p>
                )}
                <p className="text-micro text-muted mt-1">
                  {t("A senha é gerada automaticamente e mostrada só uma vez ao final.")}
                </p>
              </Campo>
            </Secao>

            <Secao titulo={t("Com quais artistas trabalha")}>
              <p className="text-micro text-muted -mt-1">
                {t("Marque os artistas. A função de cada um (e as permissões) você define depois, na aba Equipe do artista.")}
              </p>
              {artistas.length === 0 ? (
                <span className="text-xs text-muted">
                  {t("Nenhum artista cadastrado ainda. Cadastre na aba Artistas.")}
                </span>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {artistas.map((artista) => {
                    const sel = artistIdsSel.has(artista.id);
                    const nPerms = permsPorArtista[artista.id]?.length ?? 0;
                    return (
                      <div
                        key={artista.id}
                        className="flex items-center gap-2.5 rounded-md border p-2 transition-colors"
                        style={{
                          borderColor: sel ? "var(--brand)" : "var(--border-color)",
                          backgroundColor: sel ? "var(--brand-weak)" : "transparent",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleArtista(artista.id)}
                          className="flex items-center gap-2.5 text-left flex-1 min-w-0"
                        >
                          <span
                            className="h-4 w-4 rounded-[3px] flex items-center justify-center flex-shrink-0 border"
                            style={{
                              backgroundColor: sel ? "var(--brand)" : "transparent",
                              borderColor: sel ? "var(--brand)" : "var(--border-strong)",
                            }}
                          >
                            {sel && <Check size={11} className="text-white" />}
                          </span>
                          <span
                            className="h-6 w-6 rounded-full flex-shrink-0"
                            style={{ backgroundColor: artista.color }}
                          />
                          <span className="text-sm font-medium text-primary flex-1 truncate">
                            {artista.name}
                          </span>
                        </button>
                        {sel && (
                          <button
                            type="button"
                            onClick={() => setEditandoPermsDe(artista.id)}
                            className="btn-ghost text-micro inline-flex items-center gap-1 px-2 py-1 rounded flex-shrink-0"
                            style={{ color: nPerms > 0 ? "var(--brand)" : "var(--text-muted)" }}
                            title={t("Definir permissões deste artista")}
                          >
                            <SlidersHorizontal size={12} />
                            {nPerms > 0 ? t("{n} permissões", { n: nPerms }) : t("Permissões")}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Secao>
          </>
        ) : (
          <>
            {/* HEADER estilo artista: barra colorida (a cor) + avatar (1ª
                letra do apelido) + input do APELIDO grande/bold, e
                Cancelar + "Salvar alterações" no canto. */}
            <div className="card p-0 overflow-hidden">
              <div
                style={{
                  height: 4,
                  background: `linear-gradient(90deg, ${cor}, color-mix(in srgb, ${cor} 40%, transparent))`,
                }}
              />
              <div className="p-5 flex flex-col gap-4">
                <div className="flex items-start gap-4 flex-wrap">
                  <span
                    className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${cor}, color-mix(in srgb, ${cor} 60%, transparent))`,
                    }}
                  >
                    {(nome.trim().charAt(0) || "?").toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <input aria-label={t("Apelido")}
                      value={nome}
                      onChange={(e) => {
                        setNome(e.target.value);
                        if (e.target.value.trim()) limparErro("nome");
                      }}
                      placeholder={t("Apelido")}
                      className={`campo-input text-xl font-bold${erros.has("nome") ? " erro" : ""}`}
                      autoFocus
                    />
                    <span className="text-micro text-muted mt-1 block">
                      {t("É o nome que aparece pros outros usuários da sua agência.")}
                    </span>
                  </div>

                  {/* Ações: Cancelar / Salvar alterações */}
                  <div className="ml-auto flex items-center gap-2 flex-wrap">
                    <button onClick={cancelar} className="btn btn-secondary text-sm" disabled={salvando}>
                      {t("Cancelar")}
                    </button>
                    <button
                      onClick={salvar}
                      disabled={salvando}
                      className="btn btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1"
                    >
                      <Check size={14} />
                      {salvando ? t("Salvando...") : t("Salvar alterações")}
                    </button>
                  </div>
                </div>

                {/* Corpo do card: cor + país/cidade + dados pessoais — TUDO
                    DENTRO do card, igual ao editar do artista (não solto no
                    fundo). */}
                <div className="flex flex-col gap-4">
                  <SeletorDeCor cor={cor} onChange={setCor} />
                  <div className="border-t border-border" />
                  <Secao titulo={t("País e cidade onde reside")}>
                    <CidadeGlobalAutocomplete
                      ariaLabel={t("País e cidade onde reside")}
                      value={cidadeSel}
                      onChange={setCidadeSel}
                      onPaisChange={setPaisPessoal}
                      placeholder={t("Ex: São Paulo, Rio de Janeiro...")}
                    />
                  </Secao>
                  <Secao titulo={t("Dados pessoais")}>
                    <CamposDadosContrato
                      pais={paisPessoal}
                      setPais={setPaisPessoal}
                      nomeLegal={nomeLegal}
                      setNomeLegal={setNomeLegal}
                      documentoTipo={documentoTipo}
                      setDocumentoTipo={setDocumentoTipo}
                      documento={documento}
                      setDocumento={setDocumento}
                      razaoSocial={razaoSocial}
                      setRazaoSocial={setRazaoSocial}
                      endereco={endereco}
                      setEndereco={setEndereco}
                      telefone={telefone}
                      setTelefone={setTelefone}
                      dataNascimento={dataNascimento}
                      setDataNascimento={setDataNascimento}
                    />
                  </Secao>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Card ÚNICO "Acesso ao sistema" — idêntico ao editar do artista:
            Login (display) + E-mail (display read-only + selo) + toggle
            Acesso ativo + toggle Anotações + Senha/gerar nova. */}
        {modo === "editar" && (
          <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-4">
            <div className="stat-label inline-flex items-center gap-1.5">
              <KeyRound size={12} style={{ color: "var(--brand)" }} />
              {t("Acesso ao sistema")}
            </div>

            {/* (1) Login (handle) — display read-only. O admin NÃO troca o
                login do membro; só copia. Membros antigos (login por e-mail)
                têm username null → oculta. */}
            {inicial?.username && (
              <div>
                <div className="text-xs font-medium text-secondary mb-1">{t("Login")}</div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard
                      .writeText(inicial.username!)
                      .then(() => {
                        setCopiouLoginEditar(true);
                        setTimeout(() => setCopiouLoginEditar(false), 2000);
                      });
                  }}
                  className="w-full flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2 hover:border-border-strong transition-colors text-left"
                >
                  <AtSign size={14} className="text-muted flex-shrink-0" />
                  <span className="font-mono text-sm text-primary flex-1 truncate">
                    {inicial.username}
                  </span>
                  {copiouLoginEditar ? (
                    <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                  ) : (
                    <Copy size={14} className="text-muted" />
                  )}
                </button>
              </div>
            )}

            {/* (2) E-mail — display read-only + selo Verificado/Não verificado.
                O admin NÃO edita o e-mail do membro. */}
            {carregandoConta ? (
              <div className="flex items-center gap-2 text-sm text-muted py-1">
                <Loader2 size={14} className="animate-spin" />
                {t("Carregando dados da conta...")}
              </div>
            ) : !conta ? (
              <p className="text-xs text-danger">
                {t("Não foi possível carregar a conta.")}
              </p>
            ) : (
              <div>
                <div className="text-xs font-medium text-secondary mb-1">{t("E-mail")}</div>
                {conta.emailFakeInterno ? (
                  <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2">
                    <Mail size={14} className="text-muted flex-shrink-0" />
                    <span className="flex-1 text-sm text-muted italic">
                      {t("Sem e-mail")}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2">
                      <Mail size={14} className="text-muted flex-shrink-0" />
                      <span className="flex-1 text-sm text-secondary break-all">
                        {conta.email}
                      </span>
                    </div>
                    <div className="mt-1.5 text-micro">
                      {conta.emailVerificado ? (
                        <span
                          className="inline-flex items-center gap-1"
                          style={{ color: "var(--success)" }}
                        >
                          <ShieldCheck size={11} /> {t("Verificado")}
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1"
                          style={{ color: "var(--warning)" }}
                        >
                          <AlertTriangle size={11} /> {t("Não verificado")}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* (3) Toggle Acesso ativo */}
            <LinhaEscopo
              label={t("Acesso ativo")}
              descricaoLigado={t("O usuário pode entrar normalmente")}
              descricaoDesligado={t("O usuário está bloqueado e não consegue entrar")}
              valor={ativo}
              onChange={setAtivo}
            />

            {/* (4) Senha — mostra a padrão (se houver) + copiar + gerar nova */}
            <div>
              <div className="text-xs font-medium text-secondary mb-1">{t("Senha")}</div>
              {carregandoConta ? (
                <div className="flex items-center gap-2 text-sm text-muted py-1">
                  <Loader2 size={14} className="animate-spin" />
                  {t("Carregando dados da conta...")}
                </div>
              ) : !conta ? (
                <p className="text-xs text-danger">
                  {t("Não foi possível carregar a conta.")}
                </p>
              ) : conta.senhaPadrao && conta.senhaPadraoValor ? (
                <>
                  {/* Senha padrão conhecida: mostra + botão copiar */}
                  <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2">
                    <Lock size={14} className="text-muted flex-shrink-0" />
                    <span className="font-mono text-sm text-primary flex-1 break-all select-all">
                      {conta.senhaPadraoValor}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard
                          .writeText(conta.senhaPadraoValor!)
                          .then(() => {
                            setCopiouSenhaPadrao(true);
                            setTimeout(
                              () => setCopiouSenhaPadrao(false),
                              2000
                            );
                          });
                      }}
                      className="btn-ghost p-1.5 rounded"
                      aria-label={t("Copiar senha")}
                    >
                      {copiouSenhaPadrao ? (
                        <CheckCircle2
                          size={14}
                          style={{ color: "var(--success)" }}
                        />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                  <div
                    className="text-micro mt-1 inline-flex items-center gap-1"
                    style={{ color: "var(--warning)" }}
                  >
                    <AlertTriangle size={11} />
                    {t("Senha padrão gerada pelo sistema — usuário ainda não trocou.")}
                  </div>
                </>
              ) : conta.senhaPadrao ? (
                <div
                  className="flex items-start gap-2 text-xs rounded-md px-3 py-2.5 leading-relaxed"
                  style={{
                    backgroundColor: "var(--warning-weak)",
                    color: "var(--warning)",
                    border: "1px solid color-mix(in srgb, var(--warning) 20%, transparent)",
                  }}
                >
                  <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                  <span>
                    {t("Usuário ainda está com a")}{" "}<strong>{t("senha padrão")}</strong>{" "}
                    {t("gerada pelo sistema, mas o valor não está disponível (usuário criado antes desta versão). Gere uma nova abaixo pra conseguir copiar.")}
                  </span>
                </div>
              ) : (
                <div
                  className="flex items-center gap-2 text-xs rounded-md px-3 py-2.5"
                  style={{
                    backgroundColor: "var(--success-weak)",
                    color: "var(--success)",
                    border: "1px solid color-mix(in srgb, var(--success) 20%, transparent)",
                  }}
                >
                  <Lock size={13} className="flex-shrink-0" />
                  <span>{t("Senha já foi alterada pelo usuário.")}</span>
                </div>
              )}

              {onResetarSenha && (
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      await confirmar({
                        titulo: t("Gerar uma nova senha aleatória pro usuário {nome}?", { nome: nome || inicial?.nome || "" }),
                      })
                    ) {
                      void onResetarSenha();
                    }
                  }}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors hover:bg-elevated mt-2"
                  style={{
                    borderColor: "var(--brand)",
                    color: "var(--brand)",
                  }}
                >
                  <KeyRound size={14} />
                  {t("Gerar nova senha aleatória")}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Permissões da agência (D7) — permissões workspace-level, ADMIN
            delega aqui. Anotações (criar pastas) integrada ao modelo: usa o
            MESMO visual do editor de permissões (checkbox + label do catálogo)
            e continua gravando profiles.pode_criar_anotacoes (payload idêntico). */}
        {modo === "editar" && (
          <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
            <div className="stat-label inline-flex items-center gap-1.5">
              <ShieldCheck size={12} style={{ color: "var(--brand)" }} />
              {t("Permissões da agência")}
            </div>
            <p className="text-xs text-muted -mt-1">
              {t("Permissões administrativas — valem no workspace inteiro, não por artista.")}
            </p>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setPodeCriarAnotacoes((v) => !v)}
                className="flex items-center gap-2 text-left text-sm py-1 w-full rounded hover:bg-elevated transition-colors"
              >
                <span
                  className="h-4 w-4 rounded-[3px] flex items-center justify-center flex-shrink-0 border"
                  style={{
                    backgroundColor: podeCriarAnotacoes ? "var(--brand)" : "transparent",
                    borderColor: podeCriarAnotacoes ? "var(--brand)" : "var(--border-strong)",
                  }}
                >
                  {podeCriarAnotacoes && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                </span>
                <span className="text-secondary">{ROTULO_ANOTACOES}</span>
              </button>
            </div>
          </div>
        )}

        {/* Permissões por artista (T8) — lista os DJs com quem o membro
            trabalha; cada linha abre o EditorPermissoesVinculo. */}
        {modo === "editar" && (
          <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
            <div className="stat-label inline-flex items-center gap-1.5">
              <Users size={12} style={{ color: "var(--brand)" }} />
              {t("Permissões por artista")}
            </div>
            <p className="text-xs text-muted -mt-1">
              {t("O que este membro pode fazer com cada artista — vale só para aquele artista.")}
            </p>
            {vinculosEdit === null ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Loader2 size={14} className="animate-spin" />
                {t("Carregando…")}
              </div>
            ) : vinculosEditErro ? (
              <div className="text-sm text-danger">
                {t("Não foi possível carregar. Tente recarregar a página.")}
              </div>
            ) : vinculosEdit.length === 0 ? (
              <div className="text-sm text-muted">
                {t("Nenhum artista vinculado. Vincule na aba Equipe do artista.")}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {vinculosEdit.map((v) => {
                  const artista = artistas.find((a) => a.id === v.artistId);
                  return (
                    <div
                      key={v.artistId}
                      className="flex items-center gap-3 rounded-md border border-border bg-elevated p-2.5"
                    >
                      <span
                        className="h-8 w-8 rounded-full flex-shrink-0"
                        style={{ backgroundColor: artista?.color ?? "var(--border-strong)" }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-primary truncate">
                          {artista?.name ?? v.artistId}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          {v.perfis.length > 0 ? (
                            v.perfis.map((pid) => {
                              const perfil = PERFIS.find((x) => x.id === pid);
                              return (
                                <span
                                  key={pid}
                                  className="text-micro font-semibold px-1.5 py-0.5 rounded"
                                  style={{
                                    backgroundColor: `color-mix(in srgb, ${perfil?.cor ?? "#3D7BFF"} 13%, transparent)`,
                                    color: corComoTexto(perfil?.cor ?? "#3D7BFF"),
                                  }}
                                >
                                  {perfil?.nome ?? pid}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-micro text-muted">
                              {t("Personalizado")}
                            </span>
                          )}
                          <span className="text-micro text-muted">
                            {t("{n} permissões", { n: v.permissoes.length })}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditandoVinculoDe(v.artistId)}
                        className="btn-ghost text-xs inline-flex items-center gap-1 px-2 py-1.5 rounded flex-shrink-0"
                        style={{ color: "var(--brand)" }}
                        title={t("Editar permissões deste artista")}
                      >
                        <SlidersHorizontal size={13} />
                        {t("Editar")}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {(erro || msgErros) && (
          <div className="text-xs" style={{ color: "var(--danger)" }}>
            {erro ?? msgErros}
          </div>
        )}

        {/* Footer (Cancelar/Salvar) — só no modo criar. No editar as ações
            ficam no HEADER (estilo artista). */}
        {modo === "criar" && (
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            {!modoInline && (
              <button onClick={onFechar} className="btn btn-secondary" disabled={salvando}>
                {t("Cancelar")}
              </button>
            )}
            <button
              onClick={salvar}
              className={`btn btn-primary ${modoInline ? "flex-1 justify-center" : ""}`}
              disabled={salvando}
            >
              {salvando ? (
                t("Salvando...")
              ) : (
                <>
                  <Check size={14} />{" "}
                  {modoInline ? t("Convidar") : t("Salvar")}
                </>
              )}
            </button>
          </div>
        )}

        {/* Footer do EDITAR — 2º botão Salvar no fim (evita rolar até o topo).
            Mesmos handlers do cabeçalho (cancelar/salvar). */}
        {modo === "editar" && (
          <div className="flex items-center justify-end gap-2 flex-wrap pt-2 border-t border-border">
            <button onClick={cancelar} className="btn btn-secondary text-sm" disabled={salvando}>
              {t("Cancelar")}
            </button>
            <button
              onClick={salvar}
              disabled={salvando}
              className="btn btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1"
            >
              <Check size={14} />
              {salvando ? t("Salvando...") : t("Salvar alterações")}
            </button>
          </div>
        )}

        {/* Editor de permissões do artista selecionado — modal empilhado
            (fechar/salvar aqui NÃO fecha o ModalUsuario). Usado na CRIAÇÃO. */}
        {editandoPermsDe && (() => {
          const artista = artistas.find((a) => a.id === editandoPermsDe);
          if (!artista) return null;
          return (
            <EditorPermissoesVinculo
              key={editandoPermsDe}
              nomeUsuario={nome.trim() || t("Novo usuário")}
              nomeArtista={artista.name}
              permissoes={permsPorArtista[editandoPermsDe] ?? []}
              perfisIniciais={perfisPorArtista[editandoPermsDe] ?? []}
              onSalvar={(chaves, perfis) => {
                setPermsPorArtista((p) => ({ ...p, [editandoPermsDe]: chaves }));
                // Persiste os perfis (presets) escolhidos — antes eram descartados.
                setPerfisPorArtista((p) => ({ ...p, [editandoPermsDe]: perfis }));
                setEditandoPermsDe(null);
              }}
              onFechar={() => setEditandoPermsDe(null)}
            />
          );
        })()}

        {/* Editor de permissões por vínculo — modo EDITAR (T8). Persiste via
            o endpoint da equipe do artista e recarrega a lista. */}
        {modo === "editar" && editandoVinculoDe && (() => {
          const artista = artistas.find((a) => a.id === editandoVinculoDe);
          if (!artista) return null;
          const vinculo = (vinculosEdit ?? []).find((v) => v.artistId === editandoVinculoDe);
          return (
            <EditorPermissoesVinculo
              key={editandoVinculoDe}
              nomeUsuario={nome.trim() || inicial?.nome || t("Usuário")}
              nomeArtista={artista.name}
              permissoes={vinculo?.permissoes ?? []}
              perfisIniciais={(vinculo?.perfis ?? []) as PerfilId[]}
              podeSalvar={!salvandoVinculo}
              onSalvar={(chaves, perfis) =>
                salvarVinculo(editandoVinculoDe, chaves, perfis)
              }
              onFechar={() => setEditandoVinculoDe(null)}
            />
          );
        })()}

        {confirmarSaida && (
          <ConfirmarSaidaModal
            salvando={salvando}
            onCancelar={() => setConfirmarSaida(false)}
            onDescartar={() => {
              setConfirmarSaida(false);
              onFechar();
            }}
            onSalvarESair={async () => {
              // salvar() sucesso → o pai fecha o editor (setEditando null); no
              // erro/validação fica na tela e o popup fecha pra mostrar o aviso.
              await salvar();
              setConfirmarSaida(false);
            }}
          />
        )}
        {confirmador}
      </div>
  );

  if (modoInline) return conteudo;
  return (
    <Modal
      isOpen
      onClose={onFechar}
      // No editar o próprio HEADER (card com barra/avatar/apelido) faz de
      // título — sem barra de título redundante, igual o editar do artista.
      title={modo === "criar" ? t("Criar usuário") : ""}
      maxWidth={modo === "editar" ? 620 : 520}
    >
      {conteudo}
    </Modal>
  );
}
