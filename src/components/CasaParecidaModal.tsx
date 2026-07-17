"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import Modal from "./Modal";
import { useT } from "@/lib/i18n";

export type CasaCandidata = {
  id: string;
  nome: string;
  endereco?: string;
  capacidade?: number;
  /** Ausente = "não sei" (candidata oculta ou contagem indisponível), não "zero". */
  totalShows?: number;
  bloqueado?: boolean;
  /** Fora da visibilidade derivada: só o nome vem do servidor. */
  oculta: boolean;
  motivo: "nome" | "endereco";
};

export type EscolhaCasaParecida =
  | { tipo: "vincular"; casaId: string; renomearPara?: string }
  | { tipo: "nova" };

/**
 * Popup de local parecido. Aparece quando o dedupe EXATO (nome normalizado +
 * cidade) não achou nada mas existe casa parecida NA MESMA CIDADE — "Downtown"
 * já cadastrado e o usuário digitou "Downtown Urban Club".
 *
 * - É o mesmo local → vincula na casa existente (opcionalmente renomeando).
 * - É outro local → cria nova, o comportamento de sempre.
 * - Fechar (X / clique-fora / ESC) → mesmo efeito de "É outro local": o caminho
 *   seguro é o de hoje. NÃO decidir não é opção — o submit está esperando essa
 *   Promise, e vincular sem clique explícito grudaria dois locais reais num só
 *   (pior que duplicar).
 *
 * NUNCA vincula/mescla automaticamente: a pergunta é obrigatória.
 *
 * `oculta`: a candidata veio do endpoint, que enxerga o workspace inteiro
 * ignorando a visibilidade derivada. O NOME aparece como AVISO ("já existe algo
 * parecido aqui"), mas endereço/capacidade/shows não vêm do servidor — e
 * renomear não é oferecido (o PATCH 404aria). Vincular NELA fica desabilitado:
 * com só o nome na tela a confirmação vira chute, e o D6 é explícito que grudar
 * dois locais reais num só é PIOR que duplicar. O caminho é criar como novo (ou
 * pedir pra alguém com acesso conferir).
 */
export default function CasaParecidaModal({
  aberto,
  nomeDigitado,
  candidatas,
  podeRenomear,
  onEscolher,
  onFechar,
}: {
  aberto: boolean;
  nomeDigitado: string;
  candidatas: CasaCandidata[];
  podeRenomear: boolean;
  onEscolher: (r: EscolhaCasaParecida) => void;
  onFechar: () => void;
}) {
  const t = useT();
  // O backend já ordena por força do match → a 1ª nasce marcada. Oculta nunca
  // nasce marcada: vincular nela é desabilitado, e um radio marcado com o botão
  // travado parece bug (a decisão real ali é "É outro local").
  const idPadrao = (candidatas.find((c) => !c.oculta) ?? candidatas[0])?.id ?? "";
  const [selecionadaId, setSelecionadaId] = useState<string>(idPadrao);
  const [usarNomeNovo, setUsarNomeNovo] = useState(false);

  // Abriu com um conjunto novo de candidatas → volta pro padrão.
  useEffect(() => {
    setSelecionadaId(idPadrao);
  }, [idPadrao, aberto]);

  const selecionada = candidatas.find((c) => c.id === selecionadaId);

  // D7 — pré-seleciona o nome MAIS COMPLETO (mais longo) da candidata marcada.
  // Re-sincroniza pela chave derivada (trocar de candidata troca o padrão).
  const chaveNome = selecionada ? selecionada.nome : "";
  useEffect(() => {
    setUsarNomeNovo(chaveNome.length < nomeDigitado.length);
  }, [chaveNome, nomeDigitado, aberto]);

  if (!aberto || candidatas.length === 0) return null;

  const ofereceNome = podeRenomear && !!selecionada && !selecionada.oculta;
  // Sem endereço/capacidade/histórico na tela não dá pra afirmar que é o mesmo
  // lugar — só o nome bate, e nome parecido é exatamente o que trouxe a
  // candidata pra cá. Confirmar aqui seria circular.
  const podeConfirmar = !!selecionada && !selecionada.oculta;

  function confirmar() {
    if (!selecionada || selecionada.oculta) return;
    onEscolher({
      tipo: "vincular",
      casaId: selecionada.id,
      // Manter o nome atual = nenhum PATCH.
      renomearPara: ofereceNome && usarNomeNovo ? nomeDigitado : undefined,
    });
  }

  return (
    <Modal
      isOpen
      onClose={onFechar}
      title={t("Local parecido encontrado")}
      maxWidth={520}
    >
      <div className="flex items-start gap-3 mb-4">
        <span
          className="flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: "color-mix(in srgb, var(--info) 12%, transparent)",
            color: "var(--info)",
          }}
        >
          <Building2 size={18} />
        </span>
        <p className="text-sm text-secondary leading-relaxed">
          {t('Já existe um local parecido com "{nome}" nesta cidade. É o mesmo?', {
            nome: nomeDigitado,
          })}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {candidatas.map((c) => {
          const marcada = c.id === selecionadaId;
          return (
            <label
              key={c.id}
              className={`flex items-start gap-3 py-2.5 px-3 rounded-md border cursor-pointer transition-colors ${
                marcada ? "border-border-strong bg-elevated" : "border-border"
              }`}
            >
              <input
                type="radio"
                name="casa-candidata"
                checked={marcada}
                onChange={() => setSelecionadaId(c.id)}
                className="mt-1 flex-shrink-0"
                style={{ accentColor: "var(--info)" }}
              />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-primary break-all">
                  {c.nome}
                </span>
                {!c.oculta && (
                  <span className="block text-xs text-muted break-all mt-0.5">
                    {c.endereco || t("(sem endereço cadastrado)")}
                  </span>
                )}
                {(c.capacidade !== undefined || c.totalShows !== undefined) && (
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-secondary">
                    {c.capacidade !== undefined && (
                      <span>
                        {t("Capacidade")}: <strong>{c.capacidade}</strong>
                      </span>
                    )}
                    {c.totalShows !== undefined && (
                      <span>
                        {t("Shows realizados")}: <strong>{c.totalShows}</strong>
                      </span>
                    )}
                  </span>
                )}
                {(c.motivo === "endereco" || c.oculta || c.bloqueado) && (
                  <span className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {c.motivo === "endereco" && (
                      <span className="badge badge-info">{t("Endereço parecido")}</span>
                    )}
                    {c.oculta && (
                      <span className="badge badge-neutral">{t("Dados restritos")}</span>
                    )}
                    {c.bloqueado && (
                      <span className="badge badge-danger">{t("Casa bloqueada")}</span>
                    )}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      {ofereceNome && selecionada && (
        <div className="mt-4 pt-4 border-t border-border">
          <span className="block stat-label mb-2">{t("Qual nome deve ficar?")}</span>
          <p className="text-xs text-muted leading-relaxed mb-2">
            {t(
              "Esse local aparece em shows já cadastrados — trocar o nome atualiza o histórico também."
            )}
          </p>
          <div className="flex flex-col gap-2">
            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <input
                type="radio"
                name="casa-nome"
                checked={!usarNomeNovo}
                onChange={() => setUsarNomeNovo(false)}
                className="mt-1 flex-shrink-0"
                style={{ accentColor: "var(--info)" }}
              />
              <span className="break-all">
                {t('Manter "{nome}"', { nome: selecionada.nome })}
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <input
                type="radio"
                name="casa-nome"
                checked={usarNomeNovo}
                onChange={() => setUsarNomeNovo(true)}
                className="mt-1 flex-shrink-0"
                style={{ accentColor: "var(--info)" }}
              />
              <span className="break-all">
                {t('Usar "{nome}"', { nome: nomeDigitado })}
              </span>
            </label>
          </div>
        </div>
      )}

      {selecionada?.oculta && (
        <p className="text-xs text-muted leading-relaxed mt-4">
          {t(
            "Você não tem acesso aos dados desse local, então não dá pra confirmar que é o mesmo. Crie como novo local ou peça pra alguém com acesso conferir."
          )}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 flex-wrap mt-5">
        <button
          onClick={() => onEscolher({ tipo: "nova" })}
          className="btn btn-secondary text-sm"
        >
          {t("É outro local")}
        </button>
        <button
          onClick={confirmar}
          disabled={!podeConfirmar}
          className="btn btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {t("É o mesmo local")}
        </button>
      </div>
    </Modal>
  );
}
