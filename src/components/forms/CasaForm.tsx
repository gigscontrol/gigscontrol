"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { Field, TextInput, TextArea, Select } from "../Field";
import InputCapacidade from "../inputs/InputCapacidade";
import CidadeGlobalAutocomplete, { type CidadeEscolhida } from "../CidadeGlobalAutocomplete";
import { useContatos } from "@/lib/contatos-context";
import { resolverCidade, cidadeParaEscolhida } from "@/lib/cidade-helpers";
import { exemploEndereco } from "@/lib/data/exemplos";
import type { Casa, TipoCasa } from "@/types";

const TIPOS: { value: TipoCasa; label: string }[] = [
  { value: "club", label: "Club / Boate" },
  { value: "festival", label: "Festival" },
  { value: "festa-privada", label: "Festa privada" },
  { value: "bar", label: "Bar / Pub" },
  { value: "arena", label: "Arena / Estádio" },
  { value: "outro", label: "Outro" },
];

type Props = {
  initial?: Casa;
  onSubmit: () => void;
  onCancel: () => void;
};

export default function CasaForm({ initial, onSubmit, onCancel }: Props) {
  const t = useT();
  const { cidades, addCasa, updateCasa } = useContatos();

  // Pré-popula a cidade IBGE a partir da cidade atual da casa (se ela
  // tem ibgeId no banco). Cidades legadas sem ibge_id ficam vazias e o
  // user precisa escolher uma do IBGE.
  const cidadeInicial = initial?.cidadeId
    ? cidades.find((c) => c.id === initial.cidadeId)
    : undefined;
  const [cidadeSel, setCidadeSel] = useState<CidadeEscolhida | null>(
    cidadeParaEscolhida(cidadeInicial)
  );

  const [nome, setNome] = useState(initial?.nome ?? "");
  const [tipo, setTipo] = useState<TipoCasa>(initial?.tipo ?? "club");
  const [capacidade, setCapacidade] = useState<string>(initial?.capacidade?.toString() ?? "");
  const [endereco, setEndereco] = useState(initial?.endereco ?? "");
  const [contatoResponsavel, setContatoResponsavel] = useState(initial?.contatoResponsavel ?? "");
  const [telefone, setTelefone] = useState(initial?.telefone ?? "");
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!nome.trim()) errs.nome = t("Nome obrigatório");
    if (!cidadeSel) errs.cidade = t("Selecione uma cidade");
    if (capacidade && isNaN(Number(capacidade))) errs.capacidade = t("Capacidade deve ser número");

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    if (!cidadeSel) return; // type guard pro TS

    // Resolve cidade (IBGE ou GeoNames) → UUID local antes de salvar
    let cidadeIdResolvido: string;
    try {
      const cid = await resolverCidade(cidadeSel);
      cidadeIdResolvido = cid.id;
    } catch (e) {
      setErrors({ cidade: (e as Error).message });
      return;
    }

    const payload = {
      nome,
      tipo,
      cidadeId: cidadeIdResolvido,
      capacidade: capacidade ? Number(capacidade) : undefined,
      endereco: endereco || undefined,
      contatoResponsavel: contatoResponsavel || undefined,
      telefone: telefone || undefined,
      observacoes: observacoes || undefined,
    };

    try {
      if (initial) await updateCasa(initial.id, payload);
      else await addCasa(payload);
      onSubmit();
    } catch (e) {
      setErrors({ nome: (e as Error).message });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nome" required error={errors.nome}>
          <TextInput value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Club Laroc" />
        </Field>
        <Field label="Tipo" required>
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoCasa)}>
            {TIPOS.map((tipo) => (
              <option key={tipo.value} value={tipo.value}>{t(tipo.label)}</option>
            ))}
          </Select>
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
        <Field label="Capacidade" hint="Quantidade de pessoas" error={errors.capacidade}>
          <InputCapacidade
            value={capacidade}
            onChange={setCapacidade}
            placeholder="1200"
          />
        </Field>
        <Field label="Contato responsável">
          <TextInput value={contatoResponsavel} onChange={(e) => setContatoResponsavel(e.target.value)} placeholder="Renata Souza" />
        </Field>
        <Field label="Telefone">
          <TextInput value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
        </Field>
      </div>

      <Field label="Endereço">
        <TextInput value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder={exemploEndereco(cidadeSel?.pais ?? "BR")} />
      </Field>

      <Field label="Observações">
        <TextArea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Notas internas sobre a casa, política do local, etc." />
      </Field>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button onClick={onCancel} className="btn btn-secondary">{t("Cancelar")}</button>
        <button onClick={handleSave} className="btn btn-primary">
          {initial ? t("Salvar alterações") : t("Cadastrar casa")}
        </button>
      </div>
    </div>
  );
}
