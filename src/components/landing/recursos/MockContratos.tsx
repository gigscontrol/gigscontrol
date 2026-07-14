// Mockup do módulo 04 — Contratos (visual à ESQUERDA da seção).
//
// Composição de DOCUMENTO (não dashboard): folha do contrato em RETRATO (A4 em
// pé, ~210×294) com skeleton de texto + área de assinatura, card de assinantes
// flutuante (colado à direita da folha) e vínculo com a venda. 100% estático;
// texto = dado de exemplo fixo em PT (§4).

import { ChipFlutuante } from "./MockKit";

// Larguras das barras de "texto" do contrato (skeleton) — 15 linhas dão a
// altura de uma folha em pé (retrato A4).
const BARRAS = [
  "100%",
  "94%",
  "97%",
  "78%",
  "100%",
  "92%",
  "85%",
  "96%",
  "70%",
  "98%",
  "88%",
  "93%",
  "100%",
  "82%",
  "54%",
];

// Assinantes e seus estados (cor da bolinha + do rótulo de estado).
const ASSINANTES = [
  { nome: "Contratante", estado: "assinou", cor: "var(--success-ink)" },
  { nome: "Artista", estado: "abriu", cor: "var(--warning-ink)" },
  { nome: "Testemunha", estado: "não abriu", cor: "var(--text-label)" },
];

export default function MockContratos() {
  return (
    <div
      className="absolute left-1/2 top-1/2 w-[420px] h-[380px]"
      style={{ margin: "-190px 0 0 -210px" }}
    >
      {/* folha do contrato — retrato (A4 em pé) */}
      <div
        className="absolute left-[36px] top-[20px] w-[210px] rounded-[12px] border border-[color-mix(in_srgb,var(--text-primary)_9%,transparent)] bg-[var(--mock-window)] px-4 pb-4 pt-3.5"
        style={{ boxShadow: "0 24px 55px -22px var(--shadow-color-strong)" }}
      >
        {/* vínculo com a venda — colado no topo da folha */}
        <div
          className="absolute rounded-md border border-[color-mix(in_srgb,var(--brand)_35%,transparent)] bg-[var(--mock-window)] px-2 py-[3px] font-mono text-[7.5px] font-semibold text-[var(--brand-ink)]"
          style={{ top: -10, left: 10 }}
        >
          VINCULADO À VENDA #0147
        </div>

        {/* cabeçalho */}
        <div className="font-mono text-[8px] tracking-[.1em] text-[var(--text-label)]">
          CONTRATO Nº 2026-041
        </div>
        <div className="mt-0.5 text-[11px] font-bold text-primary">
          Maninhoo — Audio Club
        </div>

        {/* texto (skeleton) */}
        <div className="mt-2.5 flex flex-col gap-[6px]">
          {BARRAS.map((w, i) => (
            <div
              key={i}
              className="h-[5px] rounded bg-[color-mix(in_srgb,var(--text-primary)_7%,transparent)]"
              style={{ width: w }}
            />
          ))}
        </div>

        {/* área de assinatura */}
        <div className="mt-3 rounded-[8px] border border-dashed border-[color-mix(in_srgb,var(--brand)_45%,transparent)] bg-[color-mix(in_srgb,var(--brand)_7%,transparent)] px-3 py-2">
          <svg
            viewBox="0 0 70 18"
            style={{ width: 70, height: 18 }}
            fill="none"
            aria-hidden
          >
            <path
              d="M1 13c3-9 6 3 9-1s4-8 7-3 4 9 8 3 6-6 10-2 8 2 15-1 8 1 19-3"
              stroke="var(--brand-ink)"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <div className="mt-1 font-mono text-[7px] tracking-[.1em] text-[var(--text-label)]">
            ASSINATURA DIGITAL
          </div>
        </div>
      </div>

      {/* card de assinantes — colado à direita do documento */}
      <div
        className="absolute w-[150px] rounded-[10px] border border-[color-mix(in_srgb,var(--brand)_40%,transparent)] bg-surface px-3 py-2.5"
        style={{ left: 238, top: 64, boxShadow: "0 14px 30px -12px var(--shadow-color-strong)" }}
      >
        <div className="mb-2 font-mono text-[7.5px] tracking-[.1em] text-[var(--text-label)]">
          ASSINANTES
        </div>
        <div className="flex flex-col gap-[7px]">
          {ASSINANTES.map((a) => (
            <div key={a.nome} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 flex-none rounded-full"
                style={{ backgroundColor: a.cor }}
              />
              <span className="text-[9.5px] text-[var(--text-soft)]">{a.nome}</span>
              <span
                className="ml-auto font-mono text-[7.5px] font-semibold"
                style={{ color: a.cor }}
              >
                {a.estado}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* chip flutuante — contrato assinado, colado no canto inferior esquerdo da folha */}
      <ChipFlutuante
        estilo={{ top: 296, left: 18 }}
        corIcone="var(--success)"
        icone={
          <>
            <path d="M7 3h7l4 4v14H7z" />
            <path d="M9 13l2 2 4-4" />
          </>
        }
        titulo="Contrato assinado"
        detalhe="agora mesmo, pelo celular"
      />
    </div>
  );
}
