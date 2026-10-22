"use client";

import { useT } from "@/lib/i18n";
import { type PrivacidadeDj } from "@/lib/permissoes";

// Nível de acesso de um módulo: nenhum → só vê → vê e age (cria/fecha/informa).
// Mapeia pros dois booleanos do modelo (Ver / Criar|Informar) sem mudar o schema.
export type NivelAcessoTipo = "nenhum" | "ver" | "agir";

export function nivelDe(ver: boolean, agiu: boolean): NivelAcessoTipo {
  return agiu ? "agir" : ver ? "ver" : "nenhum";
}

/**
 * Seletor de nível por módulo — substitui os toggles ambíguos.
 *
 * Em vez de dois switches "Ver"/"Criar" (que não deixam claro o que
 * ligado/desligado faz), mostra os níveis como botões de múltipla escolha
 * com rótulo explícito ("Não vê" · "Só vê" · "Vê e cria"). Genérico: serve
 * tanto pros módulos (3 níveis) quanto pra Contatos (2 opções).
 */
export function SegmentedChoice<T extends string>({
  titulo,
  valor,
  opcoes,
  onChange,
}: {
  titulo: string;
  valor: T;
  opcoes: { val: T; label: string; sub?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-sm font-medium text-primary">{titulo}</div>
      <div className="flex gap-1.5">
        {opcoes.map((o) => {
          const ativo = valor === o.val;
          return (
            <button
              key={o.val}
              type="button"
              onClick={() => onChange(o.val)}
              aria-pressed={ativo}
              className="flex-1 px-2 py-2 rounded-md text-xs font-medium border transition-colors text-center leading-tight"
              style={
                ativo
                  ? {
                      borderColor: "var(--brand)",
                      backgroundColor: "color-mix(in srgb, var(--brand) 14%, transparent)",
                      color: "var(--text-primary)",
                    }
                  : {
                      borderColor: "var(--border-color)",
                      color: "var(--text-secondary)",
                    }
              }
            >
              <span className="block">{o.label}</span>
              {o.sub && <span className="block text-micro text-muted mt-0.5">{o.sub}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Bloco COMPLETO de privacidade do DJ — seletores segmentados (pills).
 *
 * Encapsula o mapeamento seletor <-> objeto `PrivacidadeDj` (ida e volta),
 * pra que criar (ModalNovoArtista) e editar (ModalEditarArtista) usem
 * EXATAMENTE a mesma UI e a mesma conversão. O componente recebe o objeto
 * inteiro e um onChange que devolve o objeto atualizado.
 *
 * Linhas: Agenda · Orçamentos · Vendas · Financeiro · Contratos · Contatos.
 */
export function PrivacidadePills({
  valor,
  onChange,
}: {
  valor: PrivacidadeDj;
  onChange: (v: PrivacidadeDj) => void;
}) {
  const t = useT();

  // Deriva o nível do seletor a partir dos dois booleanos (ver/agir).
  // Orçamentos e Vendas agora são independentes.
  const nivelOrcamentos = nivelDe(valor.orcamentosVer, valor.orcamentosCriar);
  const nivelVendas = nivelDe(valor.vendasVer, valor.vendasCriar);
  const nivelFinanceiro = nivelDe(valor.financeiroVer, valor.financeiroInformar);

  return (
    <div className="flex flex-col gap-4">
      {/* Agenda — 3 estados: Básico (sem cachê/contato) / Leitura / Total */}
      <SegmentedChoice
        titulo={t("Agenda")}
        valor={
          valor.agendaTotal ? "total" : valor.agendaVerDetalhado ? "leitura" : "basico"
        }
        opcoes={[
          { val: "basico", label: t("Básico"), sub: t("sem valores nem contato") },
          { val: "leitura", label: t("Somente leitura") },
          { val: "total", label: t("Acesso total") },
        ]}
        onChange={(v) =>
          onChange({
            ...valor,
            agendaVerDetalhado: v !== "basico",
            agendaTotal: v === "total",
          })
        }
      />

      {/* Orçamentos — 3 estados, independente de Vendas */}
      <SegmentedChoice
        titulo={t("Orçamentos")}
        valor={nivelOrcamentos}
        opcoes={[
          { val: "nenhum", label: t("Sem acesso") },
          { val: "ver", label: t("Somente leitura") },
          { val: "agir", label: t("Acesso total") },
        ]}
        onChange={(n) =>
          onChange({
            ...valor,
            orcamentosVer: n !== "nenhum",
            orcamentosCriar: n === "agir",
          })
        }
      />

      {/* Vendas — 3 estados, independente de Orçamentos */}
      <SegmentedChoice
        titulo={t("Vendas")}
        valor={nivelVendas}
        opcoes={[
          { val: "nenhum", label: t("Sem acesso") },
          { val: "ver", label: t("Somente leitura") },
          { val: "agir", label: t("Acesso total") },
        ]}
        onChange={(n) =>
          onChange({
            ...valor,
            vendasVer: n !== "nenhum",
            vendasCriar: n === "agir",
          })
        }
      />

      {/* Financeiro — 3 estados */}
      <SegmentedChoice
        titulo={t("Financeiro")}
        valor={nivelFinanceiro}
        opcoes={[
          { val: "nenhum", label: t("Sem acesso") },
          { val: "ver", label: t("Somente leitura") },
          { val: "agir", label: t("Acesso total") },
        ]}
        onChange={(n) =>
          onChange({
            ...valor,
            financeiroVer: n !== "nenhum",
            financeiroInformar: n === "agir",
          })
        }
      />

      {/* Contratos — 3 estados */}
      <SegmentedChoice
        titulo={t("Contratos")}
        valor={nivelDe(valor.contratosVer, valor.contratosCriar)}
        opcoes={[
          { val: "nenhum", label: t("Sem acesso") },
          { val: "ver", label: t("Somente leitura") },
          { val: "agir", label: t("Acesso total"), sub: t("criar, editar e cancelar") },
        ]}
        onChange={(n) =>
          onChange({
            ...valor,
            contratosVer: n !== "nenhum",
            contratosCriar: n === "agir",
          })
        }
      />

      {/* Contatos — 3 estados (nenhum / próprios / todos) */}
      <SegmentedChoice
        titulo={t("Contatos")}
        valor={valor.contatos}
        opcoes={[
          { val: "nenhum", label: t("Sem acesso") },
          { val: "proprios", label: t("Somente os seus contatos") },
          { val: "todos", label: t("Todos os contatos da agência") },
        ]}
        onChange={(c) => onChange({ ...valor, contatos: c })}
      />

      <p className="text-xs text-muted leading-relaxed">
        {t("Nenhum artista vê os dados de outro (agenda, orçamentos, vendas, financeiro, contratos). A única exceção é o compartilhamento de contatos, se você liberar acima. Excluir contrato é uma ação exclusiva do admin — não é liberável aqui.")}
      </p>
    </div>
  );
}
