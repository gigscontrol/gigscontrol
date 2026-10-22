"use client";

import { useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { gradienteSutil } from "@/lib/gradiente";
import {
  Plus,
  X,
  AlertCircle,
  Check,
  CheckCircle2,
} from "lucide-react";
import ColorPicker from "../ColorPicker";
import InputDocumento from "../inputs/InputDocumento";
import PhoneInput from "../PhoneInput";
import { configDocumento } from "@/lib/data/documentos";
import InputDataBR from "@/components/inputs/InputDataBR";
import { exemploEndereco } from "@/lib/data/exemplos";
import { detectarChavePix, ROTULO_CHAVE_PIX } from "@/lib/pix";
import { montarTelefoneE164, type Country } from "@/lib/data/countries";
import { type PrivacidadeDj } from "@/lib/permissoes";
import { type TaxaAgenciaModo, type DocumentoTipo, type Cidade } from "@/types";

/**
 * 10 cores padrão pro identificador visual do artista. Curadas pra
 * serem bem distinguíveis entre si em dark mode (matiz separados ≥30°).
 * Pra ter dezenas de artistas, o admin também pode escolher cor
 * customizada via color picker.
 */
export const CORES = [
  "#ef4444", // vermelho
  "#f97316", // laranja
  "#f59e0b", // âmbar
  "#eab308", // amarelo
  "#22c55e", // verde
  "#14b8a6", // teal
  "#06b6d4", // ciano
  "#3b82f6", // azul
  "#a855f7", // roxo
  "#ec4899", // rosa
];

/**
 * Snapshot do artista usado pra abrir o modal de edição com os dados
 * pré-preenchidos. ArtistaWS (=DJ) já tem tudo que precisamos.
 */
export type ArtistaParaEdicao = {
  id: string;
  nome: string;
  cor: string;
  usernameAtual: string; // ex: brunosocek-twobookings
  cidadeIbgeId?: string;
  cidadeNome?: string;
  cidadeUf?: string;
  cidadeId?: string;
  cidade?: Cidade;
  pais?: string;
  nomeLegal?: string;
  documentoTipo?: DocumentoTipo;
  documento?: string;
  razaoSocial?: string;
  endereco?: string;
  telefone?: string;
  dataNascimento?: string;
  email?: string;
  pix?: string;
  taxaModo: TaxaAgenciaModo;
  taxaValor?: number;
  riderCamarim: string[];
  riderEfeitos: string[];
  riderTecnico: string[];
  privacidade: PrivacidadeDj;
  /** Acesso do artista ao sistema — true = suspenso/bloqueado. */
  acessoSuspenso?: boolean;
};

export const MODOS_TAXA: TaxaAgenciaModo[] = [
  "sem-taxa",
  "perc-fixa",
  "perc-variavel",
  "valor-fixo",
  "valor-variavel",
];

// ============================================================
// Seletor de cor — 10 cores + cor personalizada
// ============================================================

/**
 * Seletor visual de cor com 10 swatches padrão + 1 botão "personalizada"
 * que abre o color picker nativo. Quando o usuário escolhe uma cor que
 * não está no padrão, ela aparece como 11ª bolinha destacada.
 */
export function SeletorDeCor({
  cor,
  onChange,
}: {
  cor: string;
  onChange: (cor: string) => void;
}) {
  const t = useT();
  // A cor atual está nas predefinidas? Se não, é "personalizada".
  const ePersonalizada = !CORES.includes(cor);
  const [pickerAberto, setPickerAberto] = useState(false);
  // Ref do botão "+" — o popover usa pra calcular a altura vertical
  const botaoPickerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-secondary">
        {t("Cor de identificação")}
      </span>

      <div className="relative flex flex-wrap gap-2 items-center">
        {CORES.map((c) => {
          const sel = !ePersonalizada && c === cor;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              aria-label={`Cor ${c}`}
              className="relative h-8 w-8 rounded-full transition-all hover:scale-110"
              style={{
                background: gradienteSutil(c),
                boxShadow: sel
                  ? `0 0 0 2px var(--bg-surface), 0 0 0 4px ${c}`
                  : "0 1px 2px var(--shadow-color)",
                transform: sel ? "scale(1.1)" : "scale(1)",
              }}
            >
              {sel && (
                <Check
                  size={14}
                  className="absolute inset-0 m-auto text-white drop-shadow"
                  strokeWidth={3}
                />
              )}
            </button>
          );
        })}

        {/* Botão "cor personalizada" — quando ativo, vira a 11ª bolinha
            mostrando a cor escolhida com um anel destacado */}
        <button
          ref={botaoPickerRef}
          type="button"
          onClick={() => setPickerAberto((v) => !v)}
          aria-label={t("Escolher cor personalizada")}
          title={t("Cor personalizada")}
          className="relative h-8 w-8 rounded-full transition-all hover:scale-110 flex items-center justify-center overflow-hidden"
          style={{
            // Quando personalizada está ativa: mostra a cor escolhida
            // Quando inativa: mostra um gradient arco-íris como "hint" de paleta
            background: ePersonalizada
              ? gradienteSutil(cor)
              : "conic-gradient(from 0deg, #ef4444, #f59e0b, #eab308, #22c55e, #14b8a6, #3b82f6, #a855f7, #ec4899, #ef4444)",
            boxShadow: ePersonalizada
              ? `0 0 0 2px var(--bg-surface), 0 0 0 4px ${cor}`
              : "0 1px 2px var(--shadow-color)",
            transform: ePersonalizada ? "scale(1.1)" : "scale(1)",
          }}
        >
          {ePersonalizada ? (
            <Check
              size={14}
              className="text-white drop-shadow"
              strokeWidth={3}
            />
          ) : (
            <Plus
              size={14}
              className="text-white drop-shadow"
              strokeWidth={2.5}
              style={{ filter: "drop-shadow(0 1px 2px var(--shadow-color))" }}
            />
          )}
        </button>

        {/* Hex da cor personalizada (preview legível) */}
        {ePersonalizada && (
          <span className="text-[0.7rem] font-mono text-muted ml-1 tabular-nums">
            {cor.toUpperCase()}
          </span>
        )}

        {/* Popover do color picker custom — fica centralizado na viewport */}
        {pickerAberto && (
          <ColorPicker
            cor={cor}
            anchorRef={botaoPickerRef}
            onApply={(novaCor) => {
              onChange(novaCor);
              setPickerAberto(false);
            }}
            onClose={() => setPickerAberto(false)}
          />
        )}
      </div>

      {/* Dica sutil */}
      <p className="text-[0.6875rem] text-muted mt-0.5">
        {ePersonalizada
          ? t("Cor personalizada — clique pra trocar")
          : t("Clique no + pra escolher uma cor personalizada")}
      </p>
    </div>
  );
}

// ============================================================
// Helpers de UI
// ============================================================

// ---- Documento (CPF/CNPJ) + telefone: máscara e validação ----

/** Valida só a contagem de dígitos (11=CPF, 14=CNPJ) — não faz checksum. */
export function documentoValido(valor: string, tipo: DocumentoTipo): boolean {
  return valor.replace(/\D/g, "").length === (tipo === "cpf" ? 11 : 14);
}

/** Deriva o tipo por contagem de dígitos: 12+ dígitos = CNPJ, senão CPF. */
export function tipoDocumentoPorDigitos(valor: string): DocumentoTipo {
  return valor.replace(/\D/g, "").length > 11 ? "cnpj" : "cpf";
}

/**
 * Campo ÚNICO de CPF/CNPJ (BR) — SEM seletor de tipo. Delega no
 * `InputDocumento` compartilhado (MESMO visual/placeholder/máscara do site
 * inteiro) e só acrescenta a sincronização do `documentoTipo` no pai,
 * derivado pela contagem de dígitos (11 = CPF, 14 = CNPJ) — o que dispara a
 * razão social quando vira CNPJ.
 */
export function InputDocumentoBR({
  documento,
  setDocumento,
  setDocumentoTipo,
  className,
}: {
  documento: string;
  setDocumento: (v: string) => void;
  setDocumentoTipo?: (v: DocumentoTipo) => void;
  className?: string;
}) {
  return (
    <InputDocumento
      pais="BR"
      value={documento}
      onChange={(v) => {
        setDocumento(v);
        setDocumentoTipo?.(tipoDocumentoPorDigitos(v));
      }}
      inputMode="numeric"
      className={className}
    />
  );
}

/** Máscara leve de telefone BR: (11) 98888-7777. */
/**
 * Validação dos dados do CONTRATADO (obrigatórios pro contrato): nome
 * completo + documento sempre; razão social quando CNPJ. Devolve a 1ª
 * mensagem de erro, ou null se tudo certo.
 */
export function validarDadosContrato(
  nomeLegal: string,
  documentoTipo: DocumentoTipo,
  documento: string,
  razaoSocial: string,
  t: (s: string) => string
): string | null {
  if (!nomeLegal.trim()) return t("Informe o nome completo (civil) do artista.");
  if (!documentoValido(documento, documentoTipo))
    return documentoTipo === "cpf"
      ? t("CPF inválido — precisa de 11 dígitos.")
      : t("CNPJ inválido — precisa de 14 dígitos.");
  if (documentoTipo === "cnpj" && !razaoSocial.trim())
    return t("Informe a razão social / nome da empresa (CNPJ).");
  return null;
}

/**
 * Campos do CONTRATADO (sem wrapper) — reusados na Seção (cadastro / edição
 * em modal) e no card do perfil editável inline. O `nome` do artista é o
 * nome artístico; aqui ficam os dados legais que vão pro contrato.
 */
export function CamposDadosContrato({
  pais,
  setPais,
  nomeLegal,
  setNomeLegal,
  documentoTipo,
  setDocumentoTipo,
  documento,
  setDocumento,
  razaoSocial,
  setRazaoSocial,
  endereco,
  setEndereco,
  telefone,
  setTelefone,
  dataNascimento,
  setDataNascimento,
  email,
  setEmail,
  pix,
  setPix,
  erros,
}: {
  pais: Country;
  setPais: (v: Country) => void;
  nomeLegal: string;
  setNomeLegal: (v: string) => void;
  documentoTipo: DocumentoTipo;
  setDocumentoTipo: (v: DocumentoTipo) => void;
  documento: string;
  setDocumento: (v: string) => void;
  razaoSocial: string;
  setRazaoSocial: (v: string) => void;
  endereco: string;
  setEndereco: (v: string) => void;
  telefone: string;
  setTelefone: (v: string) => void;
  /** Opcionais — só aparecem quando o setter é passado (form de artista). */
  dataNascimento?: string;
  setDataNascimento?: (v: string) => void;
  email?: string;
  setEmail?: (v: string) => void;
  /** Chave PIX — só no form de ARTISTA e só quando o país é BR. */
  pix?: string;
  setPix?: (v: string) => void;
  /** Campos obrigatórios faltando — pinta rótulo + borda de vermelho. */
  erros?: { nomeLegal?: boolean; documento?: boolean; razaoSocial?: boolean };
}) {
  const t = useT();
  const isBR = pais.code === "BR";
  // O telefone é guardado em E.164 ("55119..."); o PhoneInput trabalha com os
  // dígitos nacionais, então tiramos o DDI do país pra exibir.
  const telDigits = (() => {
    const digs = (telefone ?? "").replace(/\D/g, "");
    return digs.startsWith(pais.ddi) && digs.length > pais.ddi.length
      ? digs.slice(pais.ddi.length)
      : digs;
  })();
  return (
    <>
      <Campo
        label={t("Nome completo (civil)")}
        className="md:col-span-2"
        erro={erros?.nomeLegal}
      >
        <input
          value={nomeLegal}
          onChange={(e) => setNomeLegal(e.target.value)}
          placeholder={t("Ex: João da Silva")}
          className={`campo-input${erros?.nomeLegal ? " erro" : ""}`}
        />
      </Campo>

      {setDataNascimento && (
        <Campo label={t("Data de nascimento")}>
          {isBR ? (
            <InputDataBR
              value={dataNascimento ?? ""}
              onChange={setDataNascimento}
              className="campo-input"
            />
          ) : (
            <input
              type="date"
              value={dataNascimento ?? ""}
              onChange={(e) => setDataNascimento(e.target.value)}
              className="campo-input"
            />
          )}
        </Campo>
      )}

      {isBR ? (
        <>
          <Campo label={t("CPF / CNPJ")} erro={erros?.documento}>
            <InputDocumentoBR
              documento={documento}
              setDocumento={setDocumento}
              setDocumentoTipo={setDocumentoTipo}
              className={erros?.documento ? "input-erro" : ""}
            />
          </Campo>

          {tipoDocumentoPorDigitos(documento) === "cnpj" && (
            <Campo
              label={t("Razão social / Nome da empresa")}
              className="md:col-span-2"
              erro={erros?.razaoSocial}
            >
              <input
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                placeholder={t("Ex: Silva Produções Artísticas LTDA")}
                className={`campo-input${erros?.razaoSocial ? " erro" : ""}`}
              />
            </Campo>
          )}
        </>
      ) : (
        <Campo label={configDocumento(pais.code).label} erro={erros?.documento}>
          <InputDocumento
            pais={pais.code}
            value={documento}
            onChange={setDocumento}
            className={erros?.documento ? "input-erro" : ""}
          />
        </Campo>
      )}

      {setEmail && (
        <Campo label={t("E-mail")} className="md:col-span-2">
          <input
            type="email"
            value={email ?? ""}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contato@email.com"
            className="campo-input"
          />
        </Campo>
      )}

      <Campo label={t("Telefone (opcional)")}>
        <PhoneInput
          country={pais}
          onCountryChange={setPais}
          value={telDigits}
          onChange={(digits) =>
            setTelefone(digits ? montarTelefoneE164(pais, digits) : "")
          }
        />
      </Campo>

      <Campo label={t("Endereço (opcional)")} className="md:col-span-2">
        <input
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          placeholder={exemploEndereco(pais.code)}
          className="campo-input"
        />
      </Campo>

      {isBR && setPix && (
        <Campo label={t("Chave PIX (opcional)")} className="md:col-span-2">
          <input
            value={pix ?? ""}
            onChange={(e) => setPix(e.target.value)}
            placeholder={t("CPF, CNPJ, e-mail, telefone ou chave aleatória")}
            className="campo-input"
          />
          {/* Detecção AO VIVO do tipo (conta dígitos + valida DV de CPF/CNPJ). */}
          {(() => {
            const tipo = detectarChavePix(pix ?? "");
            if (!tipo) return null;
            const ok = tipo !== "desconhecida";
            return (
              <div
                className="mt-1 inline-flex items-center gap-1.5 text-xs"
                style={{ color: ok ? "var(--success)" : "var(--danger)" }}
              >
                {ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                {ok
                  ? `${t("Detectado")}: ${t(ROTULO_CHAVE_PIX[tipo])}`
                  : t("Chave não reconhecida — confira o valor digitado.")}
              </div>
            );
          })()}
        </Campo>
      )}
    </>
  );
}

/** Wrapper em <Secao> dos campos do contratado (cadastro / edição em modal). */
export function SecaoDadosContrato(props: Parameters<typeof CamposDadosContrato>[0]) {
  const t = useT();
  return (
    <Secao titulo={t("Dados pessoais")}>
      <CamposDadosContrato {...props} />
    </Secao>
  );
}

export function Secao({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 pb-3 border-b border-border last:border-b-0 last:pb-0">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
        {titulo}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

export function Campo({
  label,
  children,
  className,
  erro,
}: {
  label: string;
  children: React.ReactNode;
  /** Classes extras no wrapper — ex: "md:col-span-2" pra ocupar a linha toda num grid. */
  className?: string;
  /** Pinta o rótulo de vermelho quando o campo obrigatório está faltando. */
  erro?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1${className ? ` ${className}` : ""}`}>
      <span
        className="text-xs font-medium text-secondary"
        style={erro ? { color: "var(--danger)" } : undefined}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

/**
 * Linha de toggle no estilo LinhaEscopo (mesma cara da AbaEquipe): rótulo +
 * descrição que muda conforme o estado + switch. Usada no card "Acesso ao
 * sistema" do editar do artista pra ligar/desligar o acesso.
 */
export function LinhaEscopo({
  label,
  descricaoLigado,
  descricaoDesligado,
  valor,
  onChange,
}: {
  label: string;
  descricaoLigado: string;
  descricaoDesligado: string;
  valor: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-md border border-border bg-elevated">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-primary">{label}</div>
        <div className="text-xs text-muted">
          {valor ? descricaoLigado : descricaoDesligado}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!valor)}
        className="alvo-toque relative h-6 w-11 rounded-full transition-colors flex-shrink-0"
        style={{
          backgroundColor: valor ? "var(--brand)" : "var(--border-strong)",
        }}
        aria-label={label}
      >
        <span
          className="absolute top-0.5 left-0 h-5 w-5 rounded-full bg-white transition-transform"
          style={{
            transform: valor ? "translateX(22px)" : "translateX(2px)",
          }}
        />
      </button>
    </div>
  );
}

/**
 * Lista editável de itens do rider (camarim ou efeitos).
 * Mostra inputs pra adicionar novo item + chips de sugestões do catálogo
 * global que adicionam com 1 clique.
 */
export function ListaRider({
  itens,
  onChange,
  catalogoSugestoes,
  placeholderItem,
  limite,
}: {
  itens: string[];
  onChange: (itens: string[]) => void;
  catalogoSugestoes: readonly string[];
  placeholderItem: string;
  limite: number;
}) {
  const t = useT();
  const [novoNome, setNovoNome] = useState("");
  const cheio = itens.length >= limite;

  function adicionar(nome: string) {
    if (cheio) return;
    const n = nome.trim();
    if (!n) return;
    // Evita duplicado por nome
    if (itens.some((i) => i.toLowerCase() === n.toLowerCase())) return;
    onChange([...itens, n]);
    setNovoNome("");
  }

  function remover(idx: number) {
    onChange(itens.filter((_, i) => i !== idx));
  }

  // Sugestões do catálogo global que ainda não estão na lista
  const sugestoes = catalogoSugestoes.filter(
    (s) => !itens.some((i) => i.toLowerCase() === s.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Mensagem explicativa */}
      <p className="text-[0.7rem] text-muted leading-relaxed">
        {t("Liste apenas os itens. A")} <strong>{t("quantidade")}</strong> {t("é definida em cada orçamento (varia por evento).")}
      </p>

      {/* Itens já adicionados */}
      {itens.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {itens.map((nome, idx) => (
            <span
              key={nome}
              className="inline-flex items-center gap-1.5 bg-elevated border border-border rounded-md pl-3 pr-1.5 py-1 text-sm text-primary"
            >
              {t(nome)}
              <button
                type="button"
                onClick={() => remover(idx)}
                className="hover:text-danger transition-colors"
                aria-label={t("Remover item")}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Adicionar novo */}
      <div className="flex items-center gap-2">
        <input aria-label={t("Novo item")}
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          placeholder={cheio ? t("Limite de {n} atingido", { n: limite }) : t(placeholderItem)}
          disabled={cheio}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar(novoNome);
            }
          }}
          className="campo-input flex-1 text-sm disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => adicionar(novoNome)}
          aria-label={t("Adicionar item")}
          disabled={!novoNome.trim() || cheio}
          className="btn-ghost p-2 rounded disabled:opacity-40"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Chips de sugestões */}
      {!cheio && sugestoes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          <span className="text-[0.6875rem] text-muted self-center">
            {t("Sugestões:")}
          </span>
          {sugestoes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => adicionar(s)}
              className="text-[0.7rem] px-2 py-0.5 rounded-md border border-border bg-elevated hover:border-border-strong text-secondary hover:text-primary transition-colors"
            >
              + {t(s)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Normaliza um texto pra virar username (cadastro de artista e de usuário):
 *   "DJ Lúnar" → "djlunar"
 *   "João Vendas" → "joaovendas"
 * Remove acentos, lowercase, mantém só [a-z0-9-].
 */
export function normalizarUsername(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
