// Mockup do módulo 01 — Agenda (visual à DIREITA da seção).
//
// Mini-modal RICO do show (protagonista) — reproduz, em miniatura e fiel ao
// ShowDetalheModal real, as seções Contratante / Local / Detalhes / Camarim /
// Hotel / Pagamento / Documentos vinculados + a linha de logística (VOO/HOTEL/
// RIDER). Ao lado dele (à esquerda), um calendário menor e secundário dá o
// contexto do app — o card encosta e sobrepõe levemente a metade direita da
// coluna do sábado do calendário (pinta por cima), reforçando a profundidade.
// 100% estático (nenhum keyframe/hook); texto = dado de exemplo fixo em PT (§4).

import { Janela, ChipFlutuante, BadgeMono } from "./MockKit";

// Cabeçalho da grade (domingo primeiro) e destaque do dia do show.
const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const DIAS_DESTAQUE = new Set([3, 17, 31]); // sextas de julho/2026
const VAZIAS = 3; // 1º de julho/2026 cai na quarta → 3 células vazias

/** Mini-ícone mono (traço var(--brand-ink)) das seções/linhas do card. */
function Ico({ children, size = 9 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--brand-ink)"
      strokeWidth="1.8"
      style={{ width: size, height: size, flex: "none" }}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Cabeçalho de seção do card (mini-ícone + rótulo mono uppercase). */
function SecLabel({
  icone,
  children,
}: {
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1 flex items-center gap-1">
      <Ico>{icone}</Ico>
      <span className="font-mono text-[6.5px] font-semibold uppercase tracking-[.14em] text-[var(--text-label)]">
        {children}
      </span>
    </div>
  );
}

/** Linha ícone + texto (padrão "Linha" do ShowDetalheModal). */
function Linha({
  icone,
  bold,
  children,
}: {
  icone?: React.ReactNode;
  bold?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {icone && <Ico>{icone}</Ico>}
      <span
        className={`min-w-0 truncate text-[9px] leading-[1.35] ${
          bold ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-soft)]"
        }`}
      >
        {children}
      </span>
    </div>
  );
}

/** Item com quantidade à direita (Camarim/Hotel) — padrão "ItensGrid". */
function ItemQtd({ nome, qtd }: { nome: string; qtd: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--hairline)] py-[2.5px] last:border-0">
      <span className="truncate text-[9px] text-[var(--text-soft)]">{nome}</span>
      <span className="flex-none font-mono text-[8.5px] font-bold text-[var(--text-primary)]">
        {qtd}
      </span>
    </div>
  );
}

/** Chip mono de documento vinculado (VND/ORC) — azul. */
function ChipDoc({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[5px] border border-[color-mix(in_srgb,var(--brand)_30%,transparent)] bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] px-1.5 py-[2.5px]">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--brand-ink)"
        strokeWidth="2"
        style={{ width: 8, height: 8, flex: "none" }}
        aria-hidden
      >
        <path d="M7 3h7l4 4v14H7z" />
        <path d="M10 12h5M10 16h5" />
      </svg>
      <span className="font-mono text-[7.5px] font-bold tracking-[.04em] text-[var(--brand-ink)]">
        {children}
      </span>
    </span>
  );
}

/** Mini-chip de logística (ícone 11×11 + rótulo mono). */
function ChipLogistica({
  icone,
  children,
}: {
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1">
      <span className="flex h-4 w-4 flex-none items-center justify-center rounded-[5px] bg-[var(--brand-weak)]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--brand-ink)"
          strokeWidth="2"
          style={{ width: 10, height: 10 }}
          aria-hidden
        >
          {icone}
        </svg>
      </span>
      <span className="whitespace-nowrap font-mono text-[7px] font-semibold text-[var(--brand-ink)]">
        {children}
      </span>
    </span>
  );
}

export default function MockAgenda() {
  return (
    <div
      className="absolute left-1/2 top-1/2 h-[410px] w-[416px]"
      style={{ margin: "-205px 0 0 -208px" }}
    >
      {/* calendário secundário — menor, lado a lado à esquerda do card */}
      <div className="absolute left-0 top-[96px]">
        <Janela w={180}>
          <div className="min-w-0 flex-1 px-2.5 py-2">
            <div className="mb-1.5 flex items-baseline gap-1.5">
              <span className="text-[11px] font-bold text-primary">Julho</span>
              <span className="font-mono text-[8px] text-muted">2026</span>
            </div>
            <div className="mb-[4px] grid grid-cols-7 gap-[3px]">
              {DIAS_SEMANA.map((d, i) => (
                <span
                  key={i}
                  className="text-center font-mono text-[7px] text-[var(--text-disabled)]"
                >
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-[3px]">
              {Array.from({ length: VAZIAS }).map((_, i) => (
                <span key={`v${i}`} className="calE" />
              ))}
              {Array.from({ length: 31 }).map((_, i) => {
                const dia = i + 1;
                const destaque = DIAS_DESTAQUE.has(dia);
                const show = dia === 17;
                return (
                  <span
                    key={dia}
                    className="calD"
                    style={
                      show
                        ? {
                            border: "1px solid color-mix(in srgb, var(--brand) 85%, transparent)",
                            background: "color-mix(in srgb, var(--brand) 90%, transparent)",
                            color: "#fff",
                          }
                        : destaque
                        ? {
                            border: "1px solid color-mix(in srgb, var(--brand) 50%, transparent)",
                            color: "var(--text-primary)",
                          }
                        : undefined
                    }
                  >
                    {dia}
                  </span>
                );
              })}
            </div>
          </div>
        </Janela>
      </div>

      {/* card de detalhe do show — protagonista, à direita do calendário */}
      <div
        className="absolute w-[244px] rounded-xl border border-[color-mix(in_srgb,var(--text-primary)_9%,transparent)] bg-[var(--mock-window)] px-3 pb-3 pt-2.5"
        style={{ left: 160, top: 6, boxShadow: "0 22px 46px -16px var(--shadow-color-strong)" }}
      >
        {/* cabeçalho: avatar + artista + data + badge de origem */}
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[8.5px] font-bold text-white"
            style={{
              backgroundColor: "var(--brand)",
              boxShadow: "0 0 0 3px color-mix(in srgb, var(--brand) 20%, transparent)",
            }}
          >
            MA
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-bold text-primary">Maninhoo</div>
            <div className="font-mono text-[7.5px] text-muted">SEX · 17 JUL · 2026</div>
          </div>
          <BadgeMono tom="success">VENDA</BadgeMono>
        </div>

        <div className="mt-2.5 flex flex-col gap-[5px] border-t border-[var(--hairline)] pt-2.5">
          {/* CONTRATANTE */}
          <div>
            <SecLabel
              icone={
                <>
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
                </>
              }
            >
              Contratante
            </SecLabel>
            <Linha
              bold
              icone={
                <>
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
                </>
              }
            >
              Prod. Alameda
            </Linha>
            <Linha
              icone={
                <path d="M6 3h3l2 5-2 1a12 12 0 0 0 5 5l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 6a2 2 0 0 1 2-3z" />
              }
            >
              +55 11 99999-9999
            </Linha>
          </div>

          {/* LOCAL DO EVENTO */}
          <div>
            <SecLabel
              icone={
                <>
                  <rect x="4" y="3" width="10" height="18" rx="1" />
                  <path d="M14 8h5v13M8 7h2M8 11h2M8 15h2" />
                </>
              }
            >
              Local do evento
            </SecLabel>
            <Linha
              bold
              icone={
                <>
                  <rect x="4" y="3" width="10" height="18" rx="1" />
                  <path d="M14 8h5v13" />
                </>
              }
            >
              Audio Club
            </Linha>
            <Linha
              icone={
                <>
                  <path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z" />
                  <circle cx="12" cy="11" r="2" />
                </>
              }
            >
              Curitiba, PR <span className="text-muted">· Cap. 800</span>
            </Linha>
          </div>

          {/* DETALHES DO SHOW */}
          <div>
            <SecLabel
              icone={
                <>
                  <path d="M9 18V6l10-2v12" />
                  <circle cx="6.5" cy="18" r="2.5" />
                  <circle cx="16.5" cy="16" r="2.5" />
                </>
              }
            >
              Detalhes do show
            </SecLabel>
            <Linha
              bold
              icone={
                <>
                  <circle cx="12" cy="12" r="8" />
                  <path d="M12 8v4l3 2" />
                </>
              }
            >
              01:10 – 02:30
              <span className="ml-1.5 font-mono text-[9px] font-bold text-[var(--success-ink)]">
                R$ 5.000
              </span>
            </Linha>
          </div>

          {/* CAMARIM / CONSUMAÇÃO */}
          <div>
            <SecLabel
              icone={
                <>
                  <path d="M7 4h10l-1 14a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z" />
                  <path d="M7 9h10" />
                </>
              }
            >
              Camarim / Consumação
            </SecLabel>
            <ItemQtd nome="Red Label" qtd="×6" />
            <ItemQtd nome="Jack Daniels" qtd="×1" />
            <ItemQtd nome="Coca-Cola" qtd="×6" />
          </div>

          {/* HOTEL */}
          <div>
            <SecLabel
              icone={
                <>
                  <path d="M3 12h18v5H3z" />
                  <path d="M3 12V8h7v4" />
                  <path d="M3 17v2M21 17v2" />
                </>
              }
            >
              Hotel
            </SecLabel>
            <Linha
              icone={
                <>
                  <path d="M3 12h18v5H3z" />
                  <path d="M3 12V8h7v4" />
                </>
              }
            >
              Quarto Single ×1 <span className="text-muted">· Duplo ×1</span>
            </Linha>
          </div>

          {/* PAGAMENTO */}
          <div>
            <SecLabel
              icone={
                <>
                  <rect x="3" y="6" width="18" height="12" rx="2" />
                  <path d="M3 10h18" />
                </>
              }
            >
              Pagamento
            </SecLabel>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] text-[var(--text-soft)]">
                Parcela 1/1 ·{" "}
                <span className="font-mono font-bold text-[var(--text-primary)]">R$ 5.000</span>
              </span>
              <BadgeMono tom="danger">ATRASADO</BadgeMono>
            </div>
          </div>

          {/* DOCUMENTOS VINCULADOS */}
          <div>
            <SecLabel
              icone={<path d="M9 4L7 20M17 4l-2 16M4 9h16M3 15h16" />}
            >
              Documentos vinculados
            </SecLabel>
            <div className="flex items-center gap-1.5">
              <ChipDoc>VND-0003</ChipDoc>
              <ChipDoc>ORC-0004</ChipDoc>
            </div>
          </div>

          {/* LOGÍSTICA */}
          <div className="flex flex-wrap gap-x-2 gap-y-1 border-t border-[var(--hairline)] pt-2">
            <ChipLogistica
              icone={
                <>
                  <path d="M22 2L11 13" />
                  <path d="M22 2l-7 20-4-9-9-4z" />
                </>
              }
            >
              VOO GRU→CWB
            </ChipLogistica>
            <ChipLogistica
              icone={
                <>
                  <path d="M3 12h18v5H3z" />
                  <path d="M3 12V8h7v4" />
                  <path d="M3 17v2M21 17v2" />
                </>
              }
            >
              HOTEL OK
            </ChipLogistica>
            <ChipLogistica
              icone={
                <>
                  <path d="M7 3h7l4 4v14H7z" />
                  <path d="M10 12h5M10 16h5" />
                </>
              }
            >
              RIDER
            </ChipLogistica>
          </div>
        </div>
      </div>

      {/* chip de confirmação — filho do root, encostado no canto inferior-esquerdo
          do calendário (dentro do box, sem corte na base do wrapper) */}
      <ChipFlutuante
        estilo={{ left: 10, top: 300 }}
        corIcone="var(--brand)"
        icone={
          <>
            <rect x="4" y="6" width="16" height="14" rx="2" />
            <path d="M8 3v4M16 3v4M4 11h16" />
          </>
        }
        titulo="Show confirmado"
        detalhe="sex · 17 jul"
      />
    </div>
  );
}
