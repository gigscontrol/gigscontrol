"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Field, TextInput, Select } from "../Field";
import { useContatos } from "@/lib/contatos-context";
import type { Cidade } from "@/types";

const REGIOES: Cidade["regiao"][] = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];

type Props = {
  initial?: Cidade;
  onSubmit: () => void;
  onCancel: () => void;
};

/**
 * Formulário de cidade.
 *
 * NOVO (sem `initial`): mostra apenas uma mensagem informativa explicando
 * que cidades agora são criadas automaticamente a partir do catálogo
 * nacional do IBGE quando aparecem em orçamento/venda/casa/contratante.
 *
 * EDIÇÃO (com `initial`): permite ajustar nome/UF de cidades legadas
 * (criadas antes da integração IBGE). Cidades novas (com ibge_id) também
 * podem ser editadas — útil pra corrigir grafia ou UF errados.
 */
export default function CidadeForm({ initial, onSubmit, onCancel }: Props) {
  const t = useT();
  const { updateCidade } = useContatos();

  const [nome, setNome] = useState(initial?.nome ?? "");
  const [estado, setEstado] = useState(initial?.estado ?? "");
  const [regiao, setRegiao] = useState<Cidade["regiao"]>(initial?.regiao ?? "Sudeste");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Modo NOVO: explica que não precisa criar manualmente
  if (!initial) {
    return (
      <div className="flex flex-col gap-4">
        <div
          className="flex items-start gap-3 rounded-md px-4 py-3"
          style={{
            backgroundColor: "color-mix(in srgb, var(--brand) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--brand) 20%, transparent)",
          }}
        >
          <Info size={18} style={{ color: "var(--brand)" }} className="flex-shrink-0 mt-0.5" />
          <div className="text-sm text-secondary leading-relaxed">
            {t("Cidades agora são adicionadas")} <strong className="text-primary">{t("automaticamente")}</strong> {t("a partir do catálogo nacional do IBGE quando aparecem em um orçamento, venda, casa ou contratante.")}
            <br />
            <br />
            {t("Não precisa criar manualmente — basta usar o autocomplete de cidade nos formulários e a cidade fica salva aqui.")}
          </div>
        </div>
        <div className="flex justify-end pt-2 border-t border-border">
          <button onClick={onCancel} className="btn btn-primary">
            {t("Entendi")}
          </button>
        </div>
      </div>
    );
  }

  // BR usa UF de 2 letras + região; cidade estrangeira (GeoNames) tem estado
  // de comprimento livre (ex.: "Lisboa", "Île-de-France") e não tem região.
  const ehBR = (initial.pais ?? "BR") === "BR";

  // Modo EDIÇÃO: permite ajustar cidade existente (legada ou IBGE)
  const handleSave = () => {
    const errs: Record<string, string> = {};
    if (!nome.trim()) errs.nome = t("Nome obrigatório");
    if (ehBR && (!estado.trim() || estado.length !== 2))
      errs.estado = t("UF com 2 letras (ex: SP)");

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const payload = {
      nome,
      estado: ehBR ? estado.toUpperCase() : estado.trim(),
      regiao,
    };
    updateCidade(initial.id, payload)
      .then(() => onSubmit())
      .catch((e) => setErrors({ nome: (e as Error).message }));
  };

  return (
    <div className="flex flex-col gap-4">
      <Field label="Nome da cidade" required error={errors.nome}>
        <TextInput value={nome} onChange={(e) => setNome(e.target.value)} placeholder="São Paulo" />
      </Field>

      <div className={ehBR ? "grid grid-cols-2 gap-4" : ""}>
        <Field
          label={ehBR ? "UF" : t("Estado/Região")}
          required={ehBR}
          hint={ehBR ? "Ex: SP, RJ, MG" : undefined}
          error={errors.estado}
        >
          <TextInput
            value={estado}
            onChange={(e) =>
              setEstado(ehBR ? e.target.value.toUpperCase() : e.target.value)
            }
            maxLength={ehBR ? 2 : undefined}
            placeholder={ehBR ? "SP" : "Lisboa"}
          />
        </Field>
        {ehBR && (
          <Field label="Região" required>
            <Select value={regiao} onChange={(e) => setRegiao(e.target.value as Cidade["regiao"])}>
              {REGIOES.map((r) => (
                <option key={r} value={r}>{t(r)}</option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button onClick={onCancel} className="btn btn-secondary">{t("Cancelar")}</button>
        <button onClick={handleSave} className="btn btn-primary">
          {t("Salvar alterações")}
        </button>
      </div>
    </div>
  );
}
