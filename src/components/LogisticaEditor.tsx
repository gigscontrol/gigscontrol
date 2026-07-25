"use client";

import { useT } from "@/lib/i18n";
import type { LogisticaSelecao } from "@/types";
import { iata } from "@/lib/logisticaTexto";

/**
 * Editor da LOGÍSTICA — fonte única usada no Novo Orçamento e no Concretizar
 * Venda. Aéreas SEPARADAS ida/volta (quantidade + aeroporto partida→destino,
 * códigos IATA de 3 letras), bagagens extras com quantidade e translado.
 *
 * Sub-blocos são componentes de MÓDULO (não definidos dentro do render) — se
 * fossem internos, remontariam a cada tecla e os inputs de aeroporto perderiam
 * o foco a cada caractere.
 */

const MAX = 20;

const stepBtn =
  "h-7 w-7 rounded-md border border-border bg-surface-2 text-secondary flex items-center justify-center hover:border-border-strong";

function Stepper({ qtd, onQtd, accent }: { qtd: number; onQtd: (n: number) => void; accent: string }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onQtd(Math.max(1, qtd - 1))} className={stepBtn} style={{ accentColor: accent }}>
        −
      </button>
      <span className="text-sm font-bold tabular-nums w-6 text-center">{qtd}</span>
      <button type="button" onClick={() => onQtd(Math.min(MAX, qtd + 1))} className={stepBtn} style={{ accentColor: accent }}>
        +
      </button>
    </div>
  );
}

/** Uma aérea (ida ou volta): check + quantidade + aeroporto de partida→destino. */
function AereaBloco({
  label,
  qtd,
  origem,
  destino,
  onQtd,
  onOrigem,
  onDestino,
  accent,
}: {
  label: string;
  qtd: number;
  origem: string;
  destino: string;
  onQtd: (n: number) => void;
  onOrigem: (v: string) => void;
  onDestino: (v: string) => void;
  accent: string;
}) {
  const t = useT();
  const ativo = qtd > 0;
  const airport =
    "w-16 text-sm uppercase tracking-widest text-center rounded-md border border-border bg-surface-2 py-1.5 outline-none focus:border-border-strong placeholder:tracking-normal placeholder:normal-case";
  return (
    <div className={`rounded-md border transition-colors ${ativo ? "border-border-strong bg-elevated" : "border-border"}`}>
      <div className="flex items-center gap-3 py-2 px-3">
        <input
          type="checkbox"
          checked={ativo}
          onChange={(e) => onQtd(e.target.checked ? Math.max(1, qtd) : 0)}
          style={{ accentColor: accent }}
        />
        <span className="text-sm flex-1">{label}</span>
        {ativo && <Stepper qtd={qtd} onQtd={onQtd} accent={accent} />}
      </div>
      {ativo && (
        <div className="flex items-center flex-wrap gap-2 px-3 pb-2.5">
          <input
            value={origem}
            onChange={(e) => onOrigem(iata(e.target.value))}
            maxLength={3}
            placeholder={t("Partida")}
            aria-label={t("Aeroporto de partida")}
            className={airport}
          />
          <span className="text-muted text-sm">→</span>
          <input
            value={destino}
            onChange={(e) => onDestino(iata(e.target.value))}
            maxLength={3}
            placeholder={t("Destino")}
            aria-label={t("Aeroporto de destino")}
            className={airport}
          />
          <span className="text-xs text-muted">{t("Código de 3 letras (ex.: GRU)")}</span>
        </div>
      )}
    </div>
  );
}

/** Linha simples com quantidade (bagagens). */
function LinhaQtd({
  label,
  qtd,
  onQtd,
  accent,
}: {
  label: string;
  qtd: number;
  onQtd: (n: number) => void;
  accent: string;
}) {
  const ativo = qtd > 0;
  return (
    <div className={`flex items-center gap-3 py-2 px-3 rounded-md border transition-colors ${ativo ? "border-border-strong bg-elevated" : "border-border"}`}>
      <input
        type="checkbox"
        checked={ativo}
        onChange={(e) => onQtd(e.target.checked ? Math.max(1, qtd) : 0)}
        style={{ accentColor: accent }}
      />
      <span className="text-sm flex-1">{label}</span>
      {ativo && <Stepper qtd={qtd} onQtd={onQtd} accent={accent} />}
    </div>
  );
}

export default function LogisticaEditor({
  value,
  onChange,
  accent,
}: {
  value: LogisticaSelecao;
  onChange: (l: LogisticaSelecao) => void;
  accent: string;
}) {
  const t = useT();
  const set = (patch: Partial<LogisticaSelecao>) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-col gap-2">
      <AereaBloco
        label={t("Passagem aérea ida")}
        qtd={value.aereaIdaQtd ?? 0}
        origem={value.aereaIdaOrigem ?? ""}
        destino={value.aereaIdaDestino ?? ""}
        onQtd={(n) => set({ aereaIdaQtd: n })}
        onOrigem={(v) => set({ aereaIdaOrigem: v })}
        onDestino={(v) => set({ aereaIdaDestino: v })}
        accent={accent}
      />
      <AereaBloco
        label={t("Passagem aérea volta")}
        qtd={value.aereaVoltaQtd ?? 0}
        origem={value.aereaVoltaOrigem ?? ""}
        destino={value.aereaVoltaDestino ?? ""}
        onQtd={(n) => set({ aereaVoltaQtd: n })}
        onOrigem={(v) => set({ aereaVoltaOrigem: v })}
        onDestino={(v) => set({ aereaVoltaDestino: v })}
        accent={accent}
      />
      <LinhaQtd
        label={t("Bagagem despachada extra")}
        qtd={value.bagagemDespachadaQtd ?? 0}
        onQtd={(n) => set({ bagagemDespachadaQtd: n })}
        accent={accent}
      />
      <LinhaQtd
        label={t("Bagagem especial extra")}
        qtd={value.bagagemEspecialQtd ?? 0}
        onQtd={(n) => set({ bagagemEspecialQtd: n })}
        accent={accent}
      />

      {/* Translado terrestre — toggle simples */}
      <label
        className={`flex items-center gap-3 py-2 px-3 rounded-md border cursor-pointer transition-colors text-sm ${
          value.transladoTerrestre ? "border-border-strong bg-elevated" : "border-border hover:border-border-hover"
        }`}
      >
        <input
          type="checkbox"
          checked={value.transladoTerrestre}
          onChange={(e) => set({ transladoTerrestre: e.target.checked })}
          style={{ accentColor: accent }}
        />
        <span className="flex-1">
          <span className="font-medium">{t("Translado Terrestre")}</span>
          <span className="block text-xs text-muted mt-0.5">
            {t("Motorista executivo ou van: Aeroporto → Hotel → Evento → Hotel → Aeroporto")}
          </span>
        </span>
      </label>
    </div>
  );
}
