"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { Field, TextInput, TextArea } from "../Field";
import InputDocumento from "../inputs/InputDocumento";
import {
  useRazaoSocialDoCnpj,
  LabelRazaoSocial,
  DicaRazaoSocial,
} from "../inputs/RazaoSocialCnpj";
import SeletorPais from "../SeletorPais";
import PhoneInput from "../PhoneInput";
import { normalizarDocumento, configDocumento, ehCnpj } from "@/lib/data/documentos";
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
  const { cidades, addContratante, updateContratante, registrarCidade } = useContatos();

  const cidadeInicial = initial?.cidadeId
    ? cidades.find((c) => c.id === initial.cidadeId)
    : undefined;
  const [cidadeSel, setCidadeSel] = useState<CidadeEscolhida | null>(
    cidadeParaEscolhida(cidadeInicial)
  );

  const [nome, setNome] = useState(initial?.nome ?? "");
  const [pais, setPais] = useState<Country>(paisDe(initial?.pais));
  const [documento, setDocumento] = useState(initial?.documento ?? "");
  // Razão social do documento PRINCIPAL — só existe quando ele é CNPJ.
  const [razaoSocial, setRazaoSocial] = useState(initial?.razaoSocial ?? "");
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

  // Aparece/some conforme o documento digitado vira CNPJ. Fora do BR o helper
  // devolve false — o campo nunca aparece e nada muda pra esses países.
  const docEhCnpj = ehCnpj(pais.code, documento);

  // Fechou 14 dígitos → busca a razão social sozinha (cadastro nosso, senão
  // Receita). Só preenche campo vazio e falhar é não-evento.
  const buscaRazao = useRazaoSocialDoCnpj({
    pais: pais.code,
    documento,
    valor: razaoSocial,
    onPreencher: (r) => {
      setRazaoSocial(r);
      setErrors((p) => ({ ...p, razaoSocial: "" }));
    },
  });

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!nome.trim()) errs.nome = t("Nome obrigatório");
    if (!telDigits.trim()) errs.telefone = t("Telefone obrigatório");
    if (!cidadeSel) errs.cidade = t("Selecione uma cidade");
    // Só no cadastro novo: contratante antigo já gravado no CNPJ não tem razão
    // social, e exigi-la travaria uma edição que nada tem a ver com isso.
    if (docEhCnpj && !razaoSocial.trim() && !initial)
      errs.razaoSocial = t("Razão social obrigatória");

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    if (!cidadeSel) return;

    let cidadeIdResolvido: string;
    try {
      const cidade = await resolverCidade(cidadeSel);
      cidadeIdResolvido = cidade.id;
      // Cidade pode ter sido criada agora no servidor — reflete no contexto
      // pra a coluna "Cidade" e o Mapa de Dobras aparecerem sem F5.
      registrarCidade(cidade);
    } catch (e) {
      setErrors({ cidade: (e as Error).message });
      return;
    }

    const payload = {
      nome,
      pais: pais.code,
      documento: normalizarDocumento(pais.code, documento),
      // Segue o documento (D1): CPF não tem razão social — manda vazio pra não
      // deixar pendurada a razão de um CNPJ que foi trocado.
      razaoSocial: docEhCnpj ? razaoSocial.trim() : "",
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
        {docEhCnpj && (
          <div className="sm:col-span-2">
            <Field
              label={<LabelRazaoSocial busca={buscaRazao} />}
              required={!initial}
              error={errors.razaoSocial}
            >
              <TextInput
                value={razaoSocial}
                onChange={(e) => {
                  setRazaoSocial(e.target.value);
                  buscaRazao.aoEditarManualmente();
                  if (e.target.value) setErrors((p) => ({ ...p, razaoSocial: "" }));
                }}
                placeholder="Ex: Silva Produções Artísticas LTDA"
              />
              <DicaRazaoSocial busca={buscaRazao} valor={razaoSocial} />
            </Field>
          </div>
        )}
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
