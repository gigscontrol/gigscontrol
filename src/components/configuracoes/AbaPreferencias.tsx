"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useT, useLang, type Lang } from "@/lib/i18n";
import { useWorkspace } from "@/lib/workspace-context";
import SeletorPais from "../SeletorPais";
import Flag from "../Flag";
import { buscarPais, BRASIL, type Country } from "@/lib/data/countries";

/**
 * Aba Preferências (Configurações — admin). Defaults da agência:
 *  - idioma padrão (aparece ao entrar / novos usuários)
 *  - país padrão (origem do contratante · DDI · cidades)
 *  - formato de data (DD/MM/AAAA ou MM/DD/AAAA)
 *
 * Cada mudança salva na hora (PATCH /api/workspace via workspace-context).
 */

const IDIOMAS: { code: Lang; nome: string; flag: string }[] = [
  { code: "pt", nome: "Português", flag: "BR" },
  { code: "en", nome: "English", flag: "US" },
  { code: "es", nome: "Español", flag: "ES" },
  { code: "fr", nome: "Français", flag: "FR" },
  { code: "de", nome: "Deutsch", flag: "DE" },
  { code: "it", nome: "Italiano", flag: "IT" },
];

function paisDe(code: string | null | undefined): Country {
  const c = (code ?? "BR").toUpperCase();
  return buscarPais(c).find((p) => p.code === c) ?? BRASIL;
}

export default function AbaPreferencias() {
  const t = useT();
  const { setLang } = useLang();
  const { preferencias, atualizarPreferencias } = useWorkspace();
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const idiomaAtual = (preferencias.idiomaPadrao ?? "pt") as Lang;
  const paisAtual = paisDe(preferencias.paisPadrao);
  const formatoAtual = preferencias.formatoData === "mdy" ? "mdy" : "dmy";

  async function salvar(area: string, patch: Parameters<typeof atualizarPreferencias>[0]) {
    setSalvando(area);
    setErro(null);
    try {
      await atualizarPreferencias(patch);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      {erro && <div className="text-xs text-danger">{erro}</div>}

      {/* Idioma padrão */}
      <section className="card flex flex-col gap-3">
        <div>
          <div className="section-title">{t("Idioma padrão")}</div>
          <p className="text-xs text-muted">
            {t("Idioma que aparece ao entrar e com que novos usuários começam.")}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {IDIOMAS.map((i) => {
            const ativo = i.code === idiomaAtual;
            return (
              <button
                key={i.code}
                type="button"
                disabled={!!salvando}
                onClick={async () => {
                  await salvar("idioma", { idiomaPadrao: i.code });
                  setLang(i.code);
                }}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors disabled:opacity-60"
                style={
                  ativo
                    ? {
                        borderColor: "var(--brand)",
                        backgroundColor: "color-mix(in srgb, var(--brand) 12%, transparent)",
                      }
                    : { borderColor: "var(--border-color)" }
                }
              >
                <Flag code={i.flag} size={20} />
                <span className="flex-1 text-left text-primary">{i.nome}</span>
                {ativo && <Check size={14} style={{ color: "var(--brand)" }} />}
              </button>
            );
          })}
        </div>
      </section>

      {/* País padrão */}
      <section className="card flex flex-col gap-3">
        <div>
          <div className="section-title">{t("País padrão")}</div>
          <p className="text-xs text-muted">
            {t("Default de país nos contatos, no telefone e nas cidades. Dá pra trocar campo a campo na hora de preencher.")}
          </p>
        </div>
        <SeletorPais value={paisAtual} onChange={(p) => salvar("pais", { paisPadrao: p.code })} />
      </section>

      {/* Formato de data */}
      <section className="card flex flex-col gap-3">
        <div>
          <div className="section-title">{t("Formato de data")}</div>
          <p className="text-xs text-muted">
            {t("Como as datas aparecem e são digitadas no sistema.")}
          </p>
        </div>
        <div className="flex rounded-md border border-border overflow-hidden text-sm">
          {[
            { v: "dmy" as const, label: "DD/MM/AAAA" },
            { v: "mdy" as const, label: "MM/DD/AAAA" },
          ].map((op, i) => {
            const ativo = formatoAtual === op.v;
            return (
              <button
                key={op.v}
                type="button"
                disabled={!!salvando}
                onClick={() => salvar("formato", { formatoData: op.v })}
                className={`flex-1 py-2 font-medium transition-colors disabled:opacity-60 ${
                  i === 1 ? "border-l border-border" : ""
                }`}
                style={
                  ativo
                    ? {
                        color: "var(--brand)",
                        backgroundColor: "color-mix(in srgb, var(--brand) 14%, transparent)",
                      }
                    : { color: "var(--text-muted)" }
                }
              >
                {t(op.label)}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
