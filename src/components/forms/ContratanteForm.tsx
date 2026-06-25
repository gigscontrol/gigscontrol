"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { Field, TextInput, TextArea } from "../Field";
import InputCpfCnpj from "../inputs/InputCpfCnpj";
import { apenasDigitos } from "@/lib/formatters";
import CidadeIBGEAutocomplete, { type CidadeIBGE } from "../CidadeIBGEAutocomplete";
import { useContatos } from "@/lib/contatos-context";
import { resolverCidadeIbge, cidadeParaIbge } from "@/lib/cidade-helpers";
import type { Contratante } from "@/types";

type Props = {
  initial?: Contratante;
  onSubmit: () => void;
  onCancel: () => void;
};

export default function ContratanteForm({ initial, onSubmit, onCancel }: Props) {
  const t = useT();
  const { cidades, addContratante, updateContratante } = useContatos();

  // Pré-popula a cidade IBGE a partir da cidade atual do contratante (se
  // ela tem ibgeId). Cidade legada (sem ibge_id) força o user a escolher
  // do IBGE.
  const cidadeInicial = initial?.cidadeId
    ? cidades.find((c) => c.id === initial.cidadeId)
    : undefined;
  const [cidadeIbge, setCidadeIbge] = useState<CidadeIBGE | null>(
    cidadeParaIbge(cidadeInicial)
  );

  const [nome, setNome] = useState(initial?.nome ?? "");
  const [documento, setDocumento] = useState(initial?.documento ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [telefone, setTelefone] = useState(initial?.telefone ?? "");
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!nome.trim()) errs.nome = t("Nome obrigatório");
    if (!telefone.trim()) errs.telefone = t("Telefone obrigatório");
    if (!cidadeIbge) errs.cidade = t("Selecione uma cidade");

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    if (!cidadeIbge) return;

    let cidadeIdResolvido: string;
    try {
      const cid = await resolverCidadeIbge(cidadeIbge);
      cidadeIdResolvido = cid.id;
    } catch (e) {
      setErrors({ cidade: (e as Error).message });
      return;
    }

    const payload = {
      nome,
      documento: apenasDigitos(documento),
      email: email || "",
      telefone,
      cidadeId: cidadeIdResolvido,
      observacoes: observacoes || undefined,
    };

    try {
      if (initial) await updateContratante(initial.id, payload);
      else await addContratante(payload);
      onSubmit();
    } catch (e) {
      setErrors({ nome: (e as Error).message });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nome completo" required error={errors.nome}>
          <TextInput value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Marcos Lima" />
        </Field>
        <Field label="Telefone (WhatsApp)" required hint="Com DDD" error={errors.telefone}>
          <TextInput value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
        </Field>
        <Field label="Cidade" required error={errors.cidade}>
          <CidadeIBGEAutocomplete
            value={cidadeIbge}
            onChange={(c) => {
              setCidadeIbge(c);
              if (c) setErrors((p) => ({ ...p, cidade: "" }));
            }}
            placeholder={t("Ex: São Paulo, Belo Horizonte...")}
          />
        </Field>
        <Field label="E-mail" hint="Necessário ao converter em venda">
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@email.com" />
        </Field>
        <Field label="CPF / CNPJ" hint="Necessário ao converter em venda">
          <InputCpfCnpj value={documento} onChange={setDocumento} placeholder="000.000.000-00 ou 00.000.000/0000-00" />
        </Field>
      </div>

      <Field label="Observações" hint="Notas internas">
        <TextArea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Ex: prefere contato via WhatsApp, paga sempre antecipado..."
        />
      </Field>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button onClick={onCancel} className="btn btn-secondary">{t("Cancelar")}</button>
        <button onClick={handleSave} className="btn btn-primary">
          {initial ? t("Salvar alterações") : t("Cadastrar contratante")}
        </button>
      </div>
    </div>
  );
}
