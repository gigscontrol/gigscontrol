"use client";

import { useMemo, useRef, useState } from "react";
import { useDialogo } from "@/lib/useDialogo";
import { useT } from "@/lib/i18n";
import {
  Music,
  Plus,
  X,
  AlertCircle,
  Copy,
  CheckCircle2,
  KeyRound,
  AlertTriangle,
} from "lucide-react";
import CidadeGlobalAutocomplete, { type CidadeEscolhida } from "../CidadeGlobalAutocomplete";
import { resolverCidade } from "@/lib/cidade-helpers";
import { haDataPendente } from "@/components/inputs/InputDataBR";
import { BRASIL, type Country } from "@/lib/data/countries";
import { type NovoArtistaInput } from "@/lib/workspace-context";
import { PRIVACIDADE_DJ_PADRAO, type PrivacidadeDj } from "@/lib/permissoes";
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
import { CORES, Campo, ListaRider, MODOS_TAXA, Secao, SecaoDadosContrato, SeletorDeCor, documentoValido, normalizarUsername, tipoDocumentoPorDigitos } from "./camposCadastro";
import { PrivacidadePills } from "./PrivacidadePills";

// ============================================================
// Modal — Novo artista (form completo, 5 seções)
// ============================================================

export type Props = {
  slugAgencia: string;
  nomeAgencia: string;
  onCancelar: () => void;
  onCriado: (r: { nomeArtista: string; username: string; senha: string }) => void;
  adicionarArtista: (input: NovoArtistaInput) => Promise<{
    artista: { id: string; name: string };
    senhaTemporaria: string;
    usernameCompleto: string;
  }>;
  /**
   * Nomes dos artistas que já existem NO WORKSPACE atual (lowercase).
   * Usado pra bloquear duplicata dentro da mesma agência — o admin não
   * pode ter dois "Bruno" no próprio CRM porque vira confusão. Mas
   * agências diferentes podem ter "Bruno" sem problema (cada
   * `nomesExistentes` é escopado pelo workspace que monta a lista).
   */
  nomesExistentes: string[];
  /** Nomes dos artistas que estão na lixeira do workspace (lowercase). */
  nomesNaLixeira: string[];
  /**
   * Raízes de username dos artistas ATIVOS no workspace (lowercase, sem
   * o sufixo "-slugAgencia"). Usado pra warning inline antes do submit.
   */
  usernamesExistentes: string[];
  /** Raízes de username dos artistas na lixeira. */
  usernamesNaLixeira: string[];
  /**
   * Quando true, renderiza inline (sem overlay fixed, sem botão X,
   * sem botão Cancelar). Usado pelo onboarding wizard, onde o cadastro
   * do 1º artista é obrigatório e fica embedado na Etapa 4.
   */
  modoInline?: boolean;
};

/**
 * Extrai a "raiz" do username completo, removendo o sufixo "-slugAgencia".
 *   "djlunar-twobookings", slug "twobookings" → "djlunar"
 * Se não tiver sufixo (ou username for vazio), devolve o que recebeu
 * em lowercase. Usado nas checagens de colisão inline do form.
 */
export function extrairRaizUsername(
  usernameCompleto: string | undefined | null,
  slugAgencia: string
): string {
  if (!usernameCompleto) return "";
  const u = usernameCompleto.toLowerCase();
  const sufixo = `-${slugAgencia.toLowerCase()}`;
  return u.endsWith(sufixo) ? u.slice(0, -sufixo.length) : u;
}

export function ModalNovoArtista({
  slugAgencia,
  nomeAgencia,
  onCancelar,
  onCriado,
  adicionarArtista,
  nomesExistentes,
  nomesNaLixeira,
  usernamesExistentes,
  usernamesNaLixeira,
  modoInline = false,
}: Props) {
  const t = useT();
  // Overlay próprio (não usa o Modal): mesmo comportamento de diálogo —
  // foco preso dentro, Esc fecha, foco volta pra quem abriu.
  const camadaRef = useRef<HTMLDivElement>(null);
  useDialogo(camadaRef, !modoInline, onCancelar);
  // Seção 1 — dados básicos
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(CORES[0]);
  const [cidade, setCidade] = useState<CidadeEscolhida | null>(null);

  // Seção 2 — acesso
  // Auto-preenche a partir do nome enquanto o usuário não toca no campo.
  // Quando ele edita manualmente o username, paramos de espelhar.
  const [usernameRaiz, setUsernameRaiz] = useState("");
  const [usernameFoiEditado, setUsernameFoiEditado] = useState(false);

  // Seção 3 — taxa
  const [taxaModo, setTaxaModo] = useState<TaxaAgenciaModo>("sem-taxa");
  const [taxaValor, setTaxaValor] = useState<string>("");

  // Seção 4, 5 e 6 — rider (apenas nomes; quantidade vai no orçamento)
  const [riderCamarim, setRiderCamarim] = useState<string[]>([]);
  const [riderEfeitos, setRiderEfeitos] = useState<string[]>([]);
  const [riderTecnico, setRiderTecnico] = useState<string[]>([]);

  // Seção — Privacidade (o que o artista pode ver/fazer). Começa no padrão.
  const [privacidade, setPrivacidade] = useState<PrivacidadeDj>(PRIVACIDADE_DJ_PADRAO);

  // Seção — Dados pessoais (CONTRATADO)
  const [pais, setPais] = useState<Country>(BRASIL);
  const [nomeLegal, setNomeLegal] = useState("");
  const [documentoTipo, setDocumentoTipo] = useState<DocumentoTipo>("cpf");
  const [documento, setDocumento] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [endereco, setEndereco] = useState("");
  const [telefone, setTelefone] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [pix, setPix] = useState("");

  // Validação: Set das CHAVES de campo obrigatório faltando (borda vermelha +
  // contador). `erroGeral` guarda mensagens que não são de campo (ex.: falha
  // de rede no submit, ou a regra de % > 100).
  const [erros, setErros] = useState<Set<string>>(new Set());
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Feedback do botão de copiar username completo.
  const [copiouUsername, setCopiouUsername] = useState(false);

  // Remove uma chave do Set de erros (chamado no onChange de cada campo — a
  // borda vermelha some assim que o usuário mexe no campo).
  function limparErro(chave: string) {
    setErros((prev) => {
      if (!prev.has(chave)) return prev;
      const n = new Set(prev);
      n.delete(chave);
      return n;
    });
  }

  // Mapa chave→mensagem específica, mostrada quando falta exatamente 1 campo.
  const MSG_ERRO_CAMPO: Record<string, string> = {
    nome: t("Nome obrigatório"),
    username: t("Login obrigatório"),
    cidade: t("Cidade obrigatória"),
    nomeLegal: t("Nome completo obrigatório"),
    documento: t("CPF/CNPJ obrigatório"),
    razaoSocial: t("Razão social obrigatória"),
    taxaValor: t("Valor da taxa obrigatório"),
  };
  // Mensagem derivada do Set (live): some ao zerar, específica quando é 1 só,
  // "N informações faltando" quando são vários.
  const msgErros =
    erros.size === 0
      ? null
      : erros.size === 1
      ? MSG_ERRO_CAMPO[[...erros][0]] ?? t("{n} informações faltando", { n: 1 })
      : t("{n} informações faltando", { n: erros.size });

  const usernameCompleto = useMemo(() => {
    if (!usernameRaiz.trim()) return "";
    return `${usernameRaiz.trim().toLowerCase()}-${slugAgencia}`;
  }, [usernameRaiz, slugAgencia]);

  const usernameValido = useMemo(() => {
    const v = usernameRaiz.trim();
    if (v.length < 3) return false;
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(v);
  }, [usernameRaiz]);

  // Colisões em tempo real — checa contra ativos E lixeira. "ativo"
  // bloqueia direto; "lixeira" também bloqueia mas com mensagem
  // diferente (admin precisa restaurar ou apagar).
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

  // Validação: percorre TODAS as regras acumulando as CHAVES dos campos
  // obrigatórios que faltam (não para no primeiro). As colisões de nome/login
  // seguem separadas — avisos inline + bloqueio por `temColisao`.
  // Nome do artista NÃO precisa ser único globalmente — duas agências
  // diferentes podem ter "Bruno" cada uma. Mas DENTRO da mesma agência
  // bloqueamos duplicata (via temColisao) pra não confundir o admin.
  function validarTudo(): Set<string> {
    const faltando = new Set<string>();
    if (!nome.trim()) faltando.add("nome");
    if (!usernameValido) faltando.add("username");
    if (!cidade) faltando.add("cidade");
    if (!nomeLegal.trim()) faltando.add("nomeLegal");
    if (!documentoValido(documento, documentoTipo)) faltando.add("documento");
    if (documentoTipo === "cnpj" && !razaoSocial.trim()) faltando.add("razaoSocial");
    // Taxa obrigatória nos modos fixos
    if (taxaModo === "perc-fixa" || taxaModo === "valor-fixo") {
      const v = parseFloat(taxaValor.replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) faltando.add("taxaValor");
    }
    return faltando;
  }

  async function salvar() {
    setErroGeral(null);
    // TRAVA: data digitada pela metade não vira ISO e sumiria em silêncio.
    if (haDataPendente()) {
      setErroGeral(t("Complete a data (dd/mm/aaaa) antes de salvar — o campo em vermelho está incompleto."));
      return;
    }
    const faltando = validarTudo();
    // Regra extra: % fixa não pode passar de 100% — mantém a mensagem
    // específica de antes (via erroGeral), marcando o campo em vermelho.
    if (taxaModo === "perc-fixa" && !faltando.has("taxaValor")) {
      const v = parseFloat(taxaValor.replace(",", "."));
      if (Number.isFinite(v) && v > 100) {
        faltando.add("taxaValor");
        setErroGeral(t("Porcentagem não pode ser maior que 100%."));
      }
    }
    if (faltando.size > 0) {
      setErros(faltando);
      return;
    }
    setErros(new Set());
    setEnviando(true);
    try {
      const input: NovoArtistaInput = {
        nome: nome.trim(),
        cor,
        usernameRaiz: usernameRaiz.trim().toLowerCase(),
      };
      if (cidade) {
        input.cidadeIbgeId = cidade.ibgeId ?? "";
        input.cidadeNome = cidade.nome;
        input.cidadeUf = cidade.uf;
        // Cidade global canônica: resolve pro UUID do catálogo (qualquer país).
        try {
          input.cidadeId = (await resolverCidade(cidade)).id;
        } catch {
          /* segue sem cidade_id se não resolver */
        }
      }
      input.taxaModo = taxaModo;
      if (taxaModo === "perc-fixa" || taxaModo === "valor-fixo") {
        input.taxaValor = parseFloat(taxaValor.replace(",", "."));
      }
      if (riderCamarim.length > 0) input.riderCamarim = riderCamarim;
      if (riderEfeitos.length > 0) input.riderEfeitos = riderEfeitos;
      if (riderTecnico.length > 0) input.riderTecnico = riderTecnico;
      input.privacidade = privacidade;

      // Dados do CONTRATADO (obrigatórios — validados acima)
      input.pais = pais.code;
      input.nomeLegal = nomeLegal.trim();
      input.documento = documento.trim();
      input.documentoTipo = documentoTipo;
      if (dataNascimento) input.dataNascimento = dataNascimento;
      if (pais.code === "BR" && pix.trim()) input.pix = pix.trim();
      if (documentoTipo === "cnpj" && razaoSocial.trim())
        input.razaoSocial = razaoSocial.trim();
      if (endereco.trim()) input.endereco = endereco.trim();
      if (telefone.trim()) input.telefone = telefone.trim();

      const resultado = await adicionarArtista(input);
      onCriado({
        nomeArtista: nome.trim(),
        username: resultado.usernameCompleto,
        senha: resultado.senhaTemporaria,
      });
    } catch (e) {
      setErroGeral((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  // Conteúdo do formulário — usado tanto no modal quanto inline.
  const conteudo = (
    <div
      className={
        modoInline
          ? "bg-surface border border-border rounded w-full"
          : "bg-surface border border-border rounded w-full max-w-[560px] max-h-[92vh] overflow-y-auto"
      }
      style={modoInline ? undefined : { boxShadow: "0 24px 60px var(--shadow-color)" }}
      onClick={modoInline ? undefined : (e) => e.stopPropagation()}
    >
      {!modoInline && (
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-surface z-10">
          <div className="flex items-center gap-2">
            <Music size={16} style={{ color: "var(--brand)" }} />
            <h2 className="section-title">{t("Novo artista")}</h2>
          </div>
          <button onClick={onCancelar} className="btn-ghost p-1.5 rounded" aria-label={t("Fechar")}>
            <X size={18} />
          </button>
        </div>
      )}

        <div className="p-4 flex flex-col gap-5">
          {/* Seção 1 — Dados básicos */}
          <Secao titulo={t("Dados básicos")}>
            <Campo label={t("Nome do artista")} erro={erros.has("nome")}>
              <input
                value={nome}
                onChange={(e) => {
                  const v = e.target.value;
                  setNome(v);
                  if (v.trim()) limparErro("nome");
                  // Espelha o username enquanto o usuário não tiver
                  // mexido manualmente no campo de login
                  if (!usernameFoiEditado) {
                    setUsernameRaiz(normalizarUsername(v));
                    limparErro("username");
                  }
                }}
                placeholder={t("Ex: DJ Lunar")}
                className={`campo-input${erros.has("nome") ? " erro" : ""}`}
                autoFocus
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
            </Campo>

            <Campo label={t("País e cidade onde reside")} erro={erros.has("cidade")}>
              <CidadeGlobalAutocomplete
                value={cidade}
                onChange={(c) => {
                  setCidade(c);
                  if (c) limparErro("cidade");
                }}
                onPaisChange={setPais}
                erro={erros.has("cidade")}
                placeholder={t("Ex: São Paulo, Belo Horizonte...")}
              />
            </Campo>
          </Secao>

          {/* Seção — Dados pessoais (CONTRATADO) */}
          <SecaoDadosContrato
            pais={pais}
            setPais={setPais}
            nomeLegal={nomeLegal}
            setNomeLegal={(v) => {
              setNomeLegal(v);
              if (v.trim()) limparErro("nomeLegal");
            }}
            documentoTipo={documentoTipo}
            setDocumentoTipo={setDocumentoTipo}
            documento={documento}
            setDocumento={(v) => {
              setDocumento(v);
              if (documentoValido(v, tipoDocumentoPorDigitos(v))) limparErro("documento");
              // Voltou a ser CPF → some o campo razão social (limpa o erro dele).
              if (tipoDocumentoPorDigitos(v) !== "cnpj") limparErro("razaoSocial");
            }}
            razaoSocial={razaoSocial}
            setRazaoSocial={(v) => {
              setRazaoSocial(v);
              if (v.trim()) limparErro("razaoSocial");
            }}
            endereco={endereco}
            setEndereco={setEndereco}
            telefone={telefone}
            setTelefone={setTelefone}
            dataNascimento={dataNascimento}
            setDataNascimento={setDataNascimento}
            pix={pix}
            setPix={setPix}
            erros={{
              nomeLegal: erros.has("nomeLegal"),
              documento: erros.has("documento"),
              razaoSocial: erros.has("razaoSocial"),
            }}
          />

          <SeletorDeCor cor={cor} onChange={setCor} />

          {/* Tag visual do tipo de cadastro */}
          <div className="flex items-center gap-2">
            <span
              className="text-micro font-bold uppercase tracking-wider px-2 py-0.5 rounded text-white"
              style={{ backgroundColor: "var(--brand)" }}
            >
              {t("Artista")}
            </span>
          </div>

          {/* Seção 2 — Acesso ao sistema */}
          <Secao titulo={t("Acesso ao sistema")}>
            <Campo label={t("Login (username)")} erro={erros.has("username")}>
              <div
                className="flex items-center bg-elevated border border-border rounded-md px-3 py-2 foco-campo-dentro"
                style={erros.has("username") ? { borderColor: "var(--danger)" } : undefined}
              >
                {/* Input cresce conforme o usuário digita (largura em `ch`
                    casa com a font-mono — sem espaço sobrando entre o
                    que foi digitado e o sufixo da agência). */}
                <input
                  value={usernameRaiz}
                  onChange={(e) => {
                    setUsernameFoiEditado(true);
                    setUsernameRaiz(
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                    );
                    limparErro("username");
                  }}
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
                  -{slugAgencia || "agencia"}
                </span>
                {/* Botão copiar — só ativa quando o username completo é
                    válido. Copia "raiz-slug" pronto pra colar. */}
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
                    <CheckCircle2
                      size={14}
                      style={{ color: "var(--success)" }}
                    />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
              {usernameCompleto && !usernameValido && (
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--danger)" }}
                >
                  {t("Use 3+ chars (letras, números, hífen)")}
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
              {usernameValido && !colisaoUsername && usernameCompleto && (
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--success)" }}
                >
                  {t("Login completo:")}{" "}
                  <strong className="font-mono text-primary">
                    {usernameCompleto}
                  </strong>
                </p>
              )}
            </Campo>

            <div
              className="text-xs rounded-md px-3 py-2 leading-relaxed"
              style={{
                backgroundColor: "color-mix(in srgb, var(--brand) 8%, transparent)",
                color: "var(--text-secondary)",
              }}
            >
              <strong>{t("Login:")}</strong> {t("fica salvo e você consegue ver depois na lista de artistas.")}
              <br />
              <strong>{t("Senha:")}</strong> {t("será gerada automaticamente (algo tipo")} <span className="font-mono">Lyra-Bravo-7421</span>) {t("e mostrada")} <strong>{t("só uma vez")}</strong> {t("ao final pra você copiar. Se perder, dá pra gerar uma nova clicando em")}{" "}
              <span className="inline-flex items-center gap-1 font-medium">
                <KeyRound size={11} /> {t("Senha")}
              </span>{" "}
              {t("na lista.")}
            </div>
          </Secao>

          {/* Seção 3 — Taxa de agência */}
          <Secao titulo={t("Taxa de agência")}>
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
                      name="taxaModo"
                      checked={sel}
                      onChange={() => {
                        setTaxaModo(m);
                        if (m !== "perc-fixa" && m !== "valor-fixo") {
                          setTaxaValor("");
                          limparErro("taxaValor");
                          setErroGeral(null);
                        }
                      }}
                      className="mt-0"
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
                          onChange={(e) => {
                            setTaxaValor(e.target.value);
                            limparErro("taxaValor");
                            setErroGeral(null);
                          }}
                          placeholder={m === "perc-fixa" ? "15" : "500"}
                          className="bg-main border border-border rounded px-2 py-0.5 text-sm w-20 text-right outline-none foco-campo"
                          style={
                            erros.has("taxaValor")
                              ? { borderColor: "var(--danger)" }
                              : undefined
                          }
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
            <p className="text-xs text-muted mt-1 leading-relaxed">
              {t("Nos modos")} <strong>{t("variáveis")}</strong>, {t("vendedor/admin define o valor da taxa a cada orçamento.")}
            </p>
          </Secao>

          {/* Seção 4 — Rider de camarim */}
          <Secao titulo={`${t("Rider de Camarim")} (${riderCamarim.length}/${LIMITE_RIDER_CAMARIM})`}>
            <ListaRider
              itens={riderCamarim}
              onChange={setRiderCamarim}
              catalogoSugestoes={CATALOGO_CAMARIM}
              placeholderItem="Ex: Jack Daniels"
              limite={LIMITE_RIDER_CAMARIM}
            />
          </Secao>

          {/* Seção 5 — Rider de efeitos */}
          <Secao titulo={`${t("Rider de Efeitos")} (${riderEfeitos.length}/${LIMITE_RIDER_EFEITOS})`}>
            <ListaRider
              itens={riderEfeitos}
              onChange={setRiderEfeitos}
              catalogoSugestoes={CATALOGO_EFEITOS}
              placeholderItem="Ex: CO²"
              limite={LIMITE_RIDER_EFEITOS}
            />
          </Secao>

          {/* Seção 6 — Rider técnico */}
          <Secao titulo={`${t("Rider técnico")} (${riderTecnico.length}/${LIMITE_RIDER_TECNICO})`}>
            <ListaRider
              itens={riderTecnico}
              onChange={setRiderTecnico}
              catalogoSugestoes={CATALOGO_TECNICO}
              placeholderItem="Ex: CDJ-3000"
              limite={LIMITE_RIDER_TECNICO}
            />
          </Secao>

          {/* Seção 7 — Privacidade (permissões do DJ) */}
          <Secao titulo={t("Permissões — o que ele pode ver/fazer")}>
            <PrivacidadePills valor={privacidade} onChange={setPrivacidade} />
          </Secao>

          {(erroGeral || msgErros) && (
            <div
              className="flex items-center gap-2 text-xs rounded-md px-3 py-2"
              style={{
                backgroundColor: "var(--danger-weak)",
                color: "var(--danger)",
                border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
              }}
            >
              <AlertCircle size={13} className="flex-shrink-0" />
              {erroGeral ?? msgErros}
            </div>
          )}
        </div>

        <div
          className={
            modoInline
              ? "flex justify-end gap-2 p-4 border-t border-border bg-surface"
              : "flex justify-end gap-2 p-4 border-t border-border sticky bottom-0 bg-surface"
          }
        >
          {!modoInline && (
            <button onClick={onCancelar} className="btn btn-secondary text-sm">
              {t("Cancelar")}
            </button>
          )}
          <button
            onClick={salvar}
            disabled={enviando || temColisao}
            className="btn btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            title={
              temColisao
                ? t("Resolva os avisos de nome/login antes de cadastrar")
                : undefined
            }
          >
            <Plus size={14} />
            {enviando
              ? t("Cadastrando...")
              : t("Cadastrar em {nome}", { nome: nomeAgencia || t("agência") })}
          </button>
        </div>
      </div>
  );

  if (modoInline) return conteudo;

  return (
    <div
      ref={camadaRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("Novo artista")}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--overlay-scrim)" }}
      onClick={onCancelar}
    >
      {conteudo}
    </div>
  );
}
