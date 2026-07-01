"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { Field, TextInput, TextArea } from "../Field";
import InputDocumento from "../inputs/InputDocumento";
import SeletorPais from "../SeletorPais";
import PhoneInput from "../PhoneInput";
import { normalizarDocumento, configDocumento } from "@/lib/data/documentos";
import { BRASIL, buscarPais, montarTelefoneE164, type Country } from "@/lib/data/countries";
import CidadeGlobalAutocomplete, { type CidadeEscolhida } from "../CidadeGlobalAutocomplete";
import { useContatos } from "@/lib/contatos-context";
import { resolverCidade, cidadeParaEscolhida } from "@/lib/cidade-helpers";
import { getPaisPadrao } from "@/lib/preferencias";
import type { Contratante } from "@/types";

type Props = {
  initial?: Contratante;
  onSubmit: () => void;
  onCancel: () => void;
};

function paisDe(code: string | undefined): Country {
  if (code) {
    const p = buscarPais(code).find((x) => x.code === code.toUpperCase());
    if (p) return p;
  }
  return getPaisPadrao();
}

export default function ContratanteForm({ initial, onSubmit, onCancel }: Props) {
  const t = useT();
  const { cidades, addContratante, updateContratante } = useContatos();

  const cidadeInicial = initial?.cidadeId
    ? cidades.find((c) => c.id === initial.cidadeId)
    : undefined;
  const [cidadeSel, setCidadeSel] = useState<CidadeEscolhida | null>(
    cidadeParaEscolhida(cidadeInicial)
  );

  const [nome, setNome] = useState(initial?.nome ?? "");
  const [pais, setPais] = useState<Country>(paisDe(initial?.pais));
  const [documento, setDocumento] = useState(initial?.documento ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");

  // Telefone: país (DDI) + dígitos nacionais. Prefill remove o DDI se colado.
  const [telPais, setTelPais] = useState<Country>(paisDe(initial?.pais));
  const [telDigits, setTelDigits] = useState(() => {
    const digs = (initial?.telefone ?? "").replace(/\D/g, "");
    const ddi = paisDe(initial?.pais).ddi;
    return digs.startsWith(ddi) && digs.length > ddi.length ? digs.slice(ddi.length) : digs;
  });

  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!nome.trim()) errs.nome = t("Nome obrigatório");
    if (!telDigits.trim()) errs.telefone = t("Telefone obrigatório");
    if (!cidadeSel) errs.cidade = t("Selecione uma cidade");

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    if (!cidadeSel) return;

    let cidadeIdResolvido: string;
    try {
      cidadeIdResolvido = (await resolverCidade(cidadeSel)).id;
    } catch (e) {
      setErrors({ cidade: (e as Error).message });
      return;
    }

    const payload = {
      nome,
      pais: pais.code,
      documento: normalizarDocumento(pais.code, documento),
      email: email || "",
      telefone: montarTelefoneE164(telPais, telDigits),
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
        <Field label="País de origem" hint="Define o documento fiscal pedido">
          <SeletorPais
            value={pais}
            onChange={(p) => {
              setPais(p);
              setTelPais(p);
            }}
          />
        </Field>
        <Field label="Telefone (WhatsApp)" required error={errors.telefone}>
          <PhoneInput
            country={telPais}
            onCountryChange={setTelPais}
            value={telDigits}
            onChange={(v) => {
              setTelDigits(v);
              if (v) setErrors((p) => ({ ...p, telefone: "" }));
            }}
            error={errors.telefone}
          />
        </Field>
        <Field label={configDocumento(pais.code).label} hint="Necessário ao converter em venda">
          <InputDocumento pais={pais.code} value={documento} onChange={setDocumento} />
        </Field>
        <Field label="Cidade" required error={errors.cidade}>
          <CidadeGlobalAutocomplete
            value={cidadeSel}
            onChange={(c) => {
              setCidadeSel(c);
              if (c) setErrors((p) => ({ ...p, cidade: "" }));
            }}
            placeholder={t("Ex: São Paulo, Belo Horizonte...")}
          />
        </Field>
        <Field label="E-mail" hint="Necessário ao converter em venda">
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@email.com" />
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
