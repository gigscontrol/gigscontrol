"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  AlertCircle,
  Copy,
  Check,
  CheckCircle2,
  KeyRound,
  Percent,
  DollarSign,
  Mail,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  Lock,
} from "lucide-react";
import ConfirmarSaidaModal from "../ConfirmarSaidaModal";
import { useConfirmar } from "../ConfirmarModal";
import { useNavegacaoOpcional } from "../NavOverlay";
import CidadeGlobalAutocomplete, { type CidadeEscolhida } from "../CidadeGlobalAutocomplete";
import { resolverCidade, cidadeParaEscolhida } from "@/lib/cidade-helpers";
import { haDataPendente } from "@/components/inputs/InputDataBR";
import { BRASIL, buscarPais, type Country } from "@/lib/data/countries";
import {
  useWorkspace,
  type NovoArtistaInput,
} from "@/lib/workspace-context";
import { type PrivacidadeDj } from "@/lib/permissoes";
import { iniciaisDoNome } from "@/lib/iniciais";
import {
  LABELS_TAXA_MODO,
  CATALOGO_CAMARIM,
  CATALOGO_EFEITOS,
  CATALOGO_TECNICO,
  LIMITE_RIDER_CAMARIM,
  LIMITE_RIDER_EFEITOS,
  LIMITE_RIDER_TECNICO,
  type TaxaAgenciaModo,
  type DocumentoTipo,
} from "@/types";
import { ArtistaParaEdicao, Campo, LinhaEscopo, ListaRider, MODOS_TAXA, SecaoDadosContrato, SeletorDeCor, validarDadosContrato } from "./camposCadastro";
import { PrivacidadePills } from "./PrivacidadePills";


// ============================================================
// Modal — Editar artista
// ============================================================

export type EditarProps = {
  artista: ArtistaParaEdicao;
  slugAgencia: string;
  onCancelar: () => void;
  onSalvo: () => void;
  /** Dispara o reset de senha — o caller mostra modal de credenciais. */
  onResetarSenha: () => Promise<void>;
  /**
   * Mesmas listas usadas no cadastro novo, MAS já excluindo o próprio
   * artista sendo editado (pra que ele não colida consigo mesmo).
   */
  nomesExistentes: string[];
  nomesNaLixeira: string[];
  usernamesExistentes: string[];
  usernamesNaLixeira: string[];
  /** Render inline (sem overlay de modal) — usado dentro do perfil da Agência. */
  modoInline?: boolean;
};

export type DadosConta = {
  email: string;
  emailVerificado: boolean;
  emailFakeInterno: boolean;
  senhaPadrao: boolean;
  /** Senha em plaintext — só vem quando senhaPadrao=true E foi gerada após migration 28. */
  senhaPadraoValor: string | null;
};

export function ModalEditarArtista({
  artista,
  slugAgencia,
  onCancelar,
  onSalvo,
  onResetarSenha,
  nomesExistentes,
  nomesNaLixeira,
  usernamesExistentes,
  usernamesNaLixeira,
  modoInline = false,
}: EditarProps) {
  const t = useT();
  const { atualizarArtista } = useWorkspace();
  const { confirmar, confirmador } = useConfirmar();

  // Username "raiz" — o que aparece antes do "-slug". Derivado do
  // username completo no banco. Ex: "brunosocek-twobookings" → "brunosocek"
  const usernameRaizInicial = useMemo(
    () =>
      artista.usernameAtual.endsWith(`-${slugAgencia}`)
        ? artista.usernameAtual.slice(0, -`-${slugAgencia}`.length)
        : artista.usernameAtual,
    [artista.usernameAtual, slugAgencia]
  );

  // Estado dos campos editáveis
  const [nome, setNome] = useState(artista.nome);
  const [cor, setCor] = useState(artista.cor);
  const [cidade, setCidade] = useState<CidadeEscolhida | null>(
    () =>
      // Prefere a cidade GLOBAL (join por cidade_id — qualquer país); cai no
      // denormalizado legado (só-BR) pra artistas antigos sem cidade_id.
      cidadeParaEscolhida(artista.cidade ?? null) ??
      (artista.cidadeIbgeId && artista.cidadeNome && artista.cidadeUf
        ? {
            ibgeId: artista.cidadeIbgeId,
            nome: artista.cidadeNome,
            uf: artista.cidadeUf,
            pais: "BR",
          }
        : null)
  );
  const [usernameRaiz, setUsernameRaiz] = useState(usernameRaizInicial);
  // Feedback do botão de copiar senha aleatória do bloco "Senha".
  const [copiouSenhaPadrao, setCopiouSenhaPadrao] = useState(false);
  const [taxaModo, setTaxaModo] = useState<TaxaAgenciaModo>(artista.taxaModo);
  const [taxaValor, setTaxaValor] = useState<string>(
    artista.taxaValor !== undefined ? String(artista.taxaValor) : ""
  );
  const [riderCamarim, setRiderCamarim] = useState<string[]>(artista.riderCamarim);
  const [riderEfeitos, setRiderEfeitos] = useState<string[]>(artista.riderEfeitos);
  const [riderTecnico, setRiderTecnico] = useState<string[]>(artista.riderTecnico);
  const [privacidade, setPrivacidade] = useState<PrivacidadeDj>(artista.privacidade);
  // Acesso ao sistema: ligado = pode entrar; desligado = bloqueado/suspenso.
  // Mapeia !acessoSuspenso; salvo no patch como acesso_suspenso.
  const [acessoAtivo, setAcessoAtivo] = useState(!artista.acessoSuspenso);

  // Dados pessoais (CONTRATADO) — pré-preenchidos do artista.
  const [pais, setPais] = useState<Country>(
    () =>
      buscarPais(artista.pais ?? "BR").find(
        (p) => p.code === (artista.pais ?? "BR").toUpperCase()
      ) ?? BRASIL
  );
  const [nomeLegal, setNomeLegal] = useState(artista.nomeLegal ?? "");
  const [documentoTipo, setDocumentoTipo] = useState<DocumentoTipo>(
    artista.documentoTipo ?? "cpf"
  );
  const [documento, setDocumento] = useState(artista.documento ?? "");
  const [razaoSocial, setRazaoSocial] = useState(artista.razaoSocial ?? "");
  const [endereco, setEndereco] = useState(artista.endereco ?? "");
  const [telefone, setTelefone] = useState(artista.telefone ?? "");
  const [dataNascimento, setDataNascimento] = useState(artista.dataNascimento ?? "");
  const [pix, setPix] = useState(artista.pix ?? "");

  // Dados da conta (email + verificado) — async ao abrir
  const [conta, setConta] = useState<DadosConta | null>(null);
  const [carregandoConta, setCarregandoConta] = useState(true);

  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Feedback do botão de copiar o username completo (Acesso ao sistema).
  const [copiouUsername, setCopiouUsername] = useState(false);

  // Carrega os dados da conta auth (email + verificado)
  useEffect(() => {
    let ativo = true;
    setCarregandoConta(true);
    fetch(`/api/artistas/${artista.id}/conta`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as DadosConta;
      })
      .then((d) => {
        if (!ativo) return;
        setConta(d);
      })
      .catch(() => {
        if (!ativo) return;
        setConta(null);
      })
      .finally(() => {
        if (ativo) setCarregandoConta(false);
      });
    return () => {
      ativo = false;
    };
  }, [artista.id]);

  const usernameValido = useMemo(() => {
    const v = usernameRaiz.trim();
    if (v.length < 3) return false;
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(v);
  }, [usernameRaiz]);

  // Username completo (raiz + sufixo da agência) — usado no botão copiar.
  const usernameCompleto = useMemo(() => {
    if (!usernameRaiz.trim()) return "";
    return `${usernameRaiz.trim().toLowerCase()}-${slugAgencia}`;
  }, [usernameRaiz, slugAgencia]);

  // Colisões em tempo real — mesmo padrão do cadastro novo. As listas
  // recebidas via props já excluem o próprio artista sendo editado.
  const colisaoNome: "ativo" | "lixeira" | null = useMemo(() => {
    const n = nome.trim().toLowerCase();
    if (!n) return null;
    if (nomesExistentes.includes(n)) return "ativo";
    if (nomesNaLixeira.includes(n)) return "lixeira";
    return null;
  }, [nome, nomesExistentes, nomesNaLixeira]);

  const colisaoUsername: "ativo" | "lixeira" | null = useMemo(() => {
    const u = usernameRaiz.trim().toLowerCase();
    if (!u) return null;
    if (usernamesExistentes.includes(u)) return "ativo";
    if (usernamesNaLixeira.includes(u)) return "lixeira";
    return null;
  }, [usernameRaiz, usernamesExistentes, usernamesNaLixeira]);

  const temColisao = colisaoNome !== null || colisaoUsername !== null;

  const usernameMudou = usernameRaiz.trim() !== usernameRaizInicial;

  function validar(): string | null {
    const n = nome.trim();
    if (!n) return t("Informe o nome do artista.");
    if (colisaoNome === "ativo")
      return t("Já existe um artista com esse nome na sua agência.");
    if (colisaoNome === "lixeira")
      return t("Existe um artista na lixeira com esse nome (\"{n}\"). Restaure ou apague antes de reutilizar.", { n });
    if (!cidade) return t("Informe a cidade onde o artista reside.");
    const erroContrato = validarDadosContrato(
      nomeLegal,
      documentoTipo,
      documento,
      razaoSocial,
      t
    );
    if (erroContrato) return erroContrato;
    if (!usernameValido)
      return t("Username inválido (3+ chars, letras/números/hífen).");
    if (colisaoUsername === "ativo")
      return t("Esse login já está em uso por outro artista da sua agência.");
    if (colisaoUsername === "lixeira")
      return t("Esse login pertence a um artista da lixeira. Restaure ou apague antes de reutilizar.");
    if (taxaModo === "perc-fixa" || taxaModo === "valor-fixo") {
      const v = parseFloat(taxaValor.replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) {
        return t("Informe o valor da taxa ({modo}).", { modo: LABELS_TAXA_MODO[taxaModo] });
      }
      if (taxaModo === "perc-fixa" && v > 100) {
        return t("Porcentagem não pode ser maior que 100%.");
      }
    }
    return null;
  }

  async function salvar(): Promise<boolean> {
    setErro(null);
    // TRAVA: data digitada pela metade não vira ISO e sumiria em silêncio.
    if (haDataPendente()) {
      setErro(t("Complete a data (dd/mm/aaaa) antes de salvar — o campo em vermelho está incompleto."));
      return false;
    }
    const v = validar();
    if (v) {
      setErro(v);
      return false;
    }
    setEnviando(true);
    try {
      // Cidade global canônica: resolve pro UUID do catálogo (qualquer país).
      // Falha ao resolver → cidadeId undefined → atualizarArtista mantém o atual.
      let cidadeId: string | undefined;
      try {
        cidadeId = (await resolverCidade(cidade!)).id;
      } catch {
        /* segue sem */
      }
      const patch: Partial<NovoArtistaInput> = {
        nome: nome.trim(),
        cor,
        cidadeIbgeId: cidade!.ibgeId ?? "",
        cidadeNome: cidade!.nome,
        cidadeUf: cidade!.uf,
        cidadeId,
        taxaModo,
        taxaValor:
          taxaModo === "perc-fixa" || taxaModo === "valor-fixo"
            ? parseFloat(taxaValor.replace(",", "."))
            : undefined,
        riderCamarim,
        riderEfeitos,
        riderTecnico,
        privacidade,
        // Acesso ao sistema — toggle "Acesso ativo" mapeia !acessoSuspenso.
        acesso_suspenso: !acessoAtivo,
        // Dados do CONTRATADO (sempre enviados — validados acima).
        pais: pais.code,
        nomeLegal: nomeLegal.trim(),
        documento: documento.trim(),
        documentoTipo,
        razaoSocial: documentoTipo === "cnpj" ? razaoSocial.trim() : "",
        endereco: endereco.trim(),
        telefone: telefone.trim(),
        dataNascimento: dataNascimento || undefined,
        // PIX: só BR; envia string vazia p/ limpar se trocar de país.
        pix: pais.code === "BR" ? pix.trim() : "",
        // E-mail: o admin não define mais — o próprio artista cadastra e
        // verifica depois do 1º login. Aqui só exibimos o e-mail da conta.
      };
      // Username só se mudou (evita trabalho desnecessário no backend)
      if (usernameMudou) {
        patch.usernameRaiz = usernameRaiz.trim().toLowerCase();
      }
      await atualizarArtista(artista.id, patch);
      onSalvo();
      return true;
    } catch (e) {
      setErro((e as Error).message);
      return false;
    } finally {
      setEnviando(false);
    }
  }

  // ---- Guarda de "alterações não salvas" ----
  // Assinatura de TODOS os campos editáveis. A baseline é capturada no 1º
  // render (form recém-aberto = pristine), então um form intocado dá
  // sujo=false. Muda qualquer campo → sujo=true.
  const assinatura = useMemo(
    () =>
      JSON.stringify({
        nome,
        cor,
        cidade: cidade
          ? `${cidade.pais}|${cidade.uf}|${cidade.nome}|${cidade.ibgeId ?? cidade.geonameId ?? ""}`
          : "",
        usernameRaiz: usernameRaiz.trim().toLowerCase(),
        taxaModo,
        taxaValor,
        riderCamarim,
        riderEfeitos,
        riderTecnico,
        privacidade,
        acessoAtivo,
        pais: pais.code,
        nomeLegal,
        documentoTipo,
        documento,
        razaoSocial,
        endereco,
        telefone,
        dataNascimento,
        pix,
      }),
    [
      nome,
      cor,
      cidade,
      usernameRaiz,
      taxaModo,
      taxaValor,
      riderCamarim,
      riderEfeitos,
      riderTecnico,
      privacidade,
      acessoAtivo,
      pais,
      nomeLegal,
      documentoTipo,
      documento,
      razaoSocial,
      endereco,
      telefone,
      dataNascimento,
      pix,
    ]
  );
  const baselineRef = useRef<string | null>(null);
  if (baselineRef.current === null) baselineRef.current = assinatura;
  const sujo = assinatura !== baselineRef.current;

  // Popup de confirmação da saída LOCAL (botão Cancelar).
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const cancelar = () => {
    if (sujo) setConfirmarSaida(true);
    else onCancelar();
  };

  // Registra a guarda GLOBAL (interceptar navegação pra outra tela). Reflete
  // sempre o `sujo`/`salvar` mais recente via refs, sem re-registrar a cada
  // render. Fora da dashboard (sem provider) simplesmente não faz nada.
  const nav = useNavegacaoOpcional();
  const registrarGuarda = nav?.registrarGuarda;
  const limparGuarda = nav?.limparGuarda;
  const sujoRef = useRef(sujo);
  sujoRef.current = sujo;
  const salvarRef = useRef(salvar);
  salvarRef.current = salvar;
  useEffect(() => {
    if (!registrarGuarda || !limparGuarda) return;
    registrarGuarda(() => ({ sujo: sujoRef.current, salvar: salvarRef.current }));
    return () => limparGuarda();
  }, [registrarGuarda, limparGuarda]);

  // ---- Perfil editável ----
  // Mesma cara do perfil read-only do AbaArtistas (header com banda de cor
  // + avatar 64px, depois um grid de cards), com os campos editáveis e
  // Salvar/Cancelar no topo. Único layout do editar — sempre renderizado
  // inline (dentro do card do artista selecionado), nunca como modal.
  const boxInline = (
    <>
      {/* Header do perfil — editável */}
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
              className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
              style={{
                color: "#fff",
                background: `linear-gradient(135deg, ${cor}, color-mix(in srgb, ${cor} 60%, transparent))`,
              }}
            >
              {iniciaisDoNome(nome) || "?"}
            </span>
            <div className="flex-1 min-w-0">
              <input aria-label={t("Nome do artista")}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder={t("Nome do artista")}
                className="campo-input text-xl font-bold"
              />
              {colisaoNome === "ativo" && (
                <p
                  className="text-xs mt-1 inline-flex items-center gap-1"
                  style={{ color: "var(--danger)" }}
                >
                  <AlertCircle size={11} />
                  {t("Já existe um artista ATIVO com esse nome. Escolha outro.")}
                </p>
              )}
              {colisaoNome === "lixeira" && (
                <p
                  className="text-xs mt-1 inline-flex items-center gap-1"
                  style={{ color: "var(--warning)" }}
                >
                  <AlertTriangle size={11} />
                  {t("Existe um artista na")} <strong>{t("lixeira")}</strong> {t("com esse nome. Restaure ou apague pra reutilizar.")}
                </p>
              )}
            </div>

            {/* Ações: Salvar / Cancelar */}
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <button
                onClick={cancelar}
                className="btn btn-secondary text-sm"
              >
                {t("Cancelar")}
              </button>
              <button
                onClick={salvar}
                disabled={enviando || temColisao}
                className="btn btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1"
                title={
                  temColisao
                    ? t("Resolva os avisos de nome/login antes de salvar")
                    : undefined
                }
              >
                <Check size={14} />
                {enviando ? t("Salvando...") : t("Salvar alterações")}
              </button>
            </div>
          </div>

          {/* Corpo do header: Cor + país/cidade (com onPaisChange p/ o
              documento e o DDI seguirem o país) + dados pessoais
              país-aware (mesmo conteúdo do layout modal). */}
          <div className="flex flex-col gap-4">
            <SeletorDeCor cor={cor} onChange={setCor} />
            <div className="border-t border-border" />
            <Campo label={t("País e cidade onde reside")}>
              <CidadeGlobalAutocomplete
                value={cidade}
                onChange={setCidade}
                onPaisChange={setPais}
                placeholder={t("Ex: São Paulo, Belo Horizonte...")}
              />
            </Campo>
            <SecaoDadosContrato
              pais={pais}
              setPais={setPais}
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
              pix={pix}
              setPix={setPix}
            />
          </div>
        </div>
      </div>

      {/* Grid de cards editáveis */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {/* Acesso ao sistema */}
        <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
          <div className="stat-label inline-flex items-center gap-1.5">
            <KeyRound size={12} style={{ color: "var(--brand)" }} />
            {t("Acesso ao sistema")}
          </div>

          {/* Login (username) */}
          <Campo label={t("Login (username)")}>
            <div className="flex items-center bg-elevated border border-border rounded-md px-3 py-2 foco-campo-dentro">
              {/* Input com largura dinâmica (em ch + font-mono) — o
                  sufixo da agência fica colado na ponta do que foi
                  digitado, mesmo padrão do cadastro novo. */}
              <input
                value={usernameRaiz}
                onChange={(e) =>
                  setUsernameRaiz(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                  )
                }
                placeholder="djlunar"
                style={{
                  width: `${Math.max(
                    usernameRaiz.length || "djlunar".length,
                    4
                  )}ch`,
                }}
                className="bg-transparent outline-none text-sm text-primary placeholder:text-muted font-mono"
              />
              <span className="text-sm text-muted font-mono whitespace-nowrap">
                -{slugAgencia}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (!usernameValido || !usernameCompleto) return;
                  navigator.clipboard
                    .writeText(usernameCompleto)
                    .then(() => {
                      setCopiouUsername(true);
                      setTimeout(() => setCopiouUsername(false), 2000);
                    });
                }}
                disabled={!usernameValido}
                className="ml-auto btn-ghost p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={t("Copiar username completo")}
                title={
                  usernameValido
                    ? t("Copiar username completo")
                    : t("Preencha um username válido pra copiar")
                }
              >
                {copiouUsername ? (
                  <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
            {!usernameValido && usernameRaiz.length > 0 && (
              <p className="text-micro mt-1" style={{ color: "var(--danger)" }}>
                {t("Use 3+ chars (letras, números, hífen)")}.
              </p>
            )}
            {usernameValido && colisaoUsername === "ativo" && (
              <p
                className="text-xs mt-1 inline-flex items-center gap-1"
                style={{ color: "var(--danger)" }}
              >
                <AlertCircle size={11} />
                {t("Esse login já está em uso por outro artista ATIVO.")}
              </p>
            )}
            {usernameValido && colisaoUsername === "lixeira" && (
              <p
                className="text-xs mt-1 inline-flex items-center gap-1"
                style={{ color: "var(--warning)" }}
              >
                <AlertTriangle size={11} />
                {t("Esse login pertence a um artista na")} <strong>{t("lixeira")}</strong>.
                {t("Restaure ou apague pra reutilizar.")}
              </p>
            )}
            {usernameMudou && usernameValido && !colisaoUsername && (
              <div
                className="flex items-start gap-2 text-micro mt-1 rounded-md px-2 py-1.5"
                style={{
                  backgroundColor: "var(--warning-weak)",
                  color: "var(--warning)",
                  border: "1px solid color-mix(in srgb, var(--warning) 20%, transparent)",
                }}
              >
                <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
                <span>
                  {t("O artista vai precisar usar este novo login na próxima entrada.")}
                </span>
              </div>
            )}
          </Campo>

          {/* Conta: e-mail + senha */}
          {carregandoConta ? (
            <div className="flex items-center gap-2 text-sm text-muted py-2">
              <Loader2 size={14} className="animate-spin" />
              {t("Carregando dados da conta...")}
            </div>
          ) : !conta ? (
            <p className="text-xs text-danger">
              {t("Não foi possível carregar os dados da conta.")}
            </p>
          ) : (
            <>
              <Campo label={t("E-mail cadastrado")}>
                {conta.emailFakeInterno ? (
                  /* Sem e-mail real — o próprio artista cadastra depois. */
                  <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2">
                    <Mail size={14} className="text-muted flex-shrink-0" />
                    <span className="flex-1 text-sm text-muted italic">
                      {t("Usuário não cadastrou nenhum email")}
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Tem e-mail real — só leitura, com selo de verificação. */}
                    <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2">
                      <Mail size={14} className="text-muted flex-shrink-0" />
                      <span className="flex-1 text-sm text-secondary break-all">
                        {conta.email}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-micro">
                      {conta.emailVerificado ? (
                        <span
                          className="inline-flex items-center gap-1"
                          style={{ color: "var(--success)" }}
                        >
                          <ShieldCheck size={11} />
                          {t("Verificado")}
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1"
                          style={{ color: "var(--warning)" }}
                        >
                          <AlertTriangle size={11} />
                          {t("Não verificado")}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </Campo>

              {/* ---- Acesso ativo (liga/desliga a entrada no sistema) ---- */}
              <LinhaEscopo
                label={t("Acesso ativo")}
                descricaoLigado={t("O artista pode entrar no sistema.")}
                descricaoDesligado={t("Acesso bloqueado — o artista não consegue entrar.")}
                valor={acessoAtivo}
                onChange={setAcessoAtivo}
              />

              {/* ---- Senha ---- */}
              <Campo label={t("Senha")}>
                {conta.senhaPadrao && conta.senhaPadraoValor ? (
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
                      className="text-micro mt-1.5 inline-flex items-center gap-1"
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
                      {t("Usuário ainda está com a")} <strong>{t("senha padrão")}</strong>{" "}
                      {t("gerada pelo sistema, mas o valor não está disponível (artista criado antes desta versão). Gere uma nova abaixo pra conseguir copiar.")}
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
              </Campo>

              <button
                type="button"
                onClick={async () => {
                  if (
                    await confirmar({
                      titulo: t("Gerar uma nova senha aleatória pro artista {nome}?", { nome: artista.nome }),
                    })
                  ) {
                    void onResetarSenha();
                  }
                }}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors hover:bg-elevated"
                style={{
                  borderColor: "var(--brand)",
                  color: "var(--brand)",
                }}
              >
                <KeyRound size={14} />
                {t("Gerar nova senha aleatória")}
              </button>
            </>
          )}
        </div>

        {/* Permissões */}
        <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
          <div className="stat-label inline-flex items-center gap-1.5">
            <ShieldCheck size={12} style={{ color: "var(--brand)" }} />
            {t("Permissões")}
          </div>
          <p className="text-xs text-muted -mt-1">
            {t("Escolha o nível de cada área. Cada opção diz exatamente o que o artista pode fazer.")}
          </p>
          <PrivacidadePills valor={privacidade} onChange={setPrivacidade} />
        </div>

        {/* Rider de camarim */}
        <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
          <div className="stat-label">
            {t("Rider de camarim ({n}/{max})", { n: riderCamarim.length, max: LIMITE_RIDER_CAMARIM })}
          </div>
          <ListaRider
            itens={riderCamarim}
            onChange={setRiderCamarim}
            catalogoSugestoes={CATALOGO_CAMARIM}
            placeholderItem="Ex: Jack Daniels"
            limite={LIMITE_RIDER_CAMARIM}
          />
        </div>

        {/* Rider de efeitos */}
        <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
          <div className="stat-label">
            {t("Rider de efeitos ({n}/{max})", { n: riderEfeitos.length, max: LIMITE_RIDER_EFEITOS })}
          </div>
          <ListaRider
            itens={riderEfeitos}
            onChange={setRiderEfeitos}
            catalogoSugestoes={CATALOGO_EFEITOS}
            placeholderItem="Ex: CO²"
            limite={LIMITE_RIDER_EFEITOS}
          />
        </div>

        {/* Rider técnico */}
        <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
          <div className="stat-label">
            {t("Rider técnico ({n}/{max})", { n: riderTecnico.length, max: LIMITE_RIDER_TECNICO })}
          </div>
          <ListaRider
            itens={riderTecnico}
            onChange={setRiderTecnico}
            catalogoSugestoes={CATALOGO_TECNICO}
            placeholderItem="Ex: CDJ-3000"
            limite={LIMITE_RIDER_TECNICO}
          />
        </div>

        {/* Taxa de agência */}
        <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
          <div className="stat-label inline-flex items-center gap-1.5">
            {taxaModo.startsWith("perc") ? (
              <Percent size={12} style={{ color: "var(--brand)" }} />
            ) : (
              <DollarSign size={12} style={{ color: "var(--brand)" }} />
            )}
            {t("Taxa de agência")}
          </div>
          <div className="flex flex-col gap-1.5">
            {MODOS_TAXA.map((m) => {
              const sel = taxaModo === m;
              return (
                <label
                  key={m}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer border transition-colors ${
                    sel
                      ? "border-border-strong bg-elevated"
                      : "border-border hover:border-border-strong"
                  }`}
                >
                  <input
                    type="radio"
                    name="taxaModoEditInline"
                    checked={sel}
                    onChange={() => {
                      setTaxaModo(m);
                      if (m !== "perc-fixa" && m !== "valor-fixo") {
                        setTaxaValor("");
                      }
                    }}
                  />
                  <span className="text-sm flex-1">{t(LABELS_TAXA_MODO[m])}</span>
                  {sel && (m === "perc-fixa" || m === "valor-fixo") && (
                    <div className="flex items-center gap-1">
                      {m === "valor-fixo" && (
                        <span className="text-xs text-muted">R$</span>
                      )}
                      <input
                        type="text"
                        inputMode="decimal"
                        value={taxaValor}
                        onChange={(e) => setTaxaValor(e.target.value)}
                        placeholder={m === "perc-fixa" ? "15" : "500"}
                        className="bg-main border border-border rounded px-2 py-0.5 text-sm w-20 text-right outline-none foco-campo"
                        onClick={(e) => e.preventDefault()}
                      />
                      {m === "perc-fixa" && (
                        <span className="text-xs text-muted">%</span>
                      )}
                    </div>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {erro && (
        <div
          className="flex items-center gap-2 text-xs rounded-md px-3 py-2"
          style={{
            backgroundColor: "var(--danger-weak)",
            color: "var(--danger)",
            border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
          }}
        >
          <AlertCircle size={13} className="flex-shrink-0" />
          {erro}
        </div>
      )}

      {/* Ações no FIM do form — mesmos handlers do topo (evita rolar até o
          cabeçalho pra salvar). */}
      <div className="flex items-center justify-end gap-2 flex-wrap pt-1">
        <button onClick={cancelar} className="btn btn-secondary text-sm">
          {t("Cancelar")}
        </button>
        <button
          onClick={salvar}
          disabled={enviando || temColisao}
          className="btn btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1"
          title={
            temColisao
              ? t("Resolva os avisos de nome/login antes de salvar")
              : undefined
          }
        >
          <Check size={14} />
          {enviando ? t("Salvando...") : t("Salvar alterações")}
        </button>
      </div>

      {confirmarSaida && (
        <ConfirmarSaidaModal
          salvando={enviando}
          onCancelar={() => setConfirmarSaida(false)}
          onDescartar={() => {
            setConfirmarSaida(false);
            onCancelar();
          }}
          onSalvarESair={async () => {
            // salvar() já chama onSalvo() (fecha) no sucesso; no erro fica na
            // tela e o popup fecha pra mostrar a mensagem.
            await salvar();
            setConfirmarSaida(false);
          }}
        />
      )}
      {confirmador}
    </>
  );

  return boxInline;
}
