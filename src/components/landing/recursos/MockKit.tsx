// Primitivas compartilhadas dos mockups da página /recursos.
//
// Espelham a linguagem visual dos painéis vivos (PainelVivoLogin, CalendarioVivo,
// RadarMapa) porém 100% ESTÁTICAS: nenhum keyframe/movimento/hook. Cada peça é só
// markup + estilo. Identidade Signal Blue; cores semânticas apenas em status.
// A API abaixo é o contrato travado (§3.0 do spec) — os 6 mocks montam sobre ela.

/** Janela do app: chrome macOS + moldura (técnica PainelVivoLogin:87-96). */
export function Janela({ w, children }: { w: number; children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--text-primary)_9%,transparent)] bg-[var(--mock-window)]"
      style={{ width: w, boxShadow: "0 24px 55px -22px var(--shadow-color-strong)" }}
    >
      {/* barra da janela — 3 bolinhas macOS */}
      <div className="flex h-[26px] items-center gap-[5px] border-b border-[var(--hairline)] bg-[var(--mock-chrome)] px-3">
        <span className="h-2 w-2 rounded-full bg-[var(--danger)]" />
        <span className="h-2 w-2 rounded-full bg-[var(--warning)]" />
        <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
      </div>
      {/* corpo: sidebar + conteúdo */}
      <div className="flex">{children}</div>
    </div>
  );
}

/** Ordem fixa dos módulos na sidebar (mesma da navegação real). */
const ITENS_SIDEBAR = [
  "Agenda",
  "Vendas",
  "Financeiro",
  "Contratos",
  "Contatos",
  "Agência",
];

/** Sidebar mini (PainelVivoLogin:99-125). Itens fixos; destaca `ativo`. */
export function SidebarMini({ ativo }: { ativo: string }) {
  return (
    <div className="flex w-[92px] flex-none flex-col gap-[3px] border-r border-[var(--hairline)] px-2 py-2.5">
      {ITENS_SIDEBAR.map((item) => {
        const on = item === ativo;
        return (
          <div
            key={item}
            className={`flex items-center gap-[7px] rounded-md px-[9px] py-1.5 ${
              on ? "bg-[var(--mock-active)]" : ""
            }`}
          >
            <span
              className={`rounded-full ${
                on ? "h-[5px] w-[5px] bg-[var(--brand)]" : "h-1 w-1 bg-[var(--mock-dot)]"
              }`}
              style={on ? { boxShadow: "0 0 6px var(--brand)" } : undefined}
            />
            <span
              className={
                on
                  ? "text-[10px] font-semibold text-primary"
                  : "text-[10px] text-[var(--text-dim)]"
              }
            >
              {item}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Tile de métrica (PainelVivoLogin:143-158; escala levemente maior). */
export function TileMetrica({
  rotulo,
  valor,
  cor = "var(--brand-ink)",
  sub,
}: {
  rotulo: string;
  valor: string;
  cor?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-[color-mix(in_srgb,var(--text-primary)_7%,transparent)] bg-main px-2.5 py-2">
      <div className="whitespace-nowrap font-mono text-[7px] font-semibold uppercase tracking-[.1em] text-[var(--text-label)]">
        {rotulo}
      </div>
      <div
        className="mt-1 font-display text-[16px] font-extrabold"
        style={{ color: cor }}
      >
        {valor}
      </div>
      {sub && (
        <div className="mt-0.5 font-mono text-[7px] text-[var(--text-label)]">{sub}</div>
      )}
    </div>
  );
}

/** Chip flutuante de notificação/info (Notificacao do PainelVivoLogin:22-71, SEM animação). */
export function ChipFlutuante({
  estilo,
  corIcone,
  icone,
  titulo,
  detalhe,
}: {
  estilo: React.CSSProperties;
  corIcone: string;
  icone: React.ReactNode;
  titulo: string;
  detalhe: string;
}) {
  return (
    <div
      className="absolute z-[2] flex items-center gap-[9px] rounded border border-[var(--border-strong)] bg-surface px-3 py-[9px]"
      style={{ boxShadow: "0 16px 34px -12px var(--shadow-color-strong)", ...estilo }}
    >
      <span
        className="flex h-6 w-6 flex-none items-center justify-center rounded-chip"
        style={{ backgroundColor: corIcone }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          style={{ width: 13, height: 13 }}
          aria-hidden
        >
          {icone}
        </svg>
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="whitespace-nowrap text-[10.5px] font-bold text-primary">
          {titulo}
        </span>
        <span className="whitespace-nowrap font-mono text-[8px] font-medium text-muted">
          {detalhe}
        </span>
      </span>
    </div>
  );
}

/** Cores dos badges mono (espelha .badge* do globals.css:177-194). */
const TONS_BADGE = {
  success: { color: "var(--success-ink)", background: "var(--success-weak)" },
  danger: { color: "var(--danger)", background: "var(--danger-weak)" },
  warning: { color: "var(--warning-ink)", background: "var(--warning-weak)" },
  info: { color: "var(--brand-ink)", background: "var(--brand-weak)" },
  neutral: {
    color: "var(--text-body)",
    background: "color-mix(in srgb, var(--text-primary) 7%, transparent)",
  },
} as const;

/** Badge mono de status. */
export function BadgeMono({
  tom,
  children,
}: {
  tom: "success" | "danger" | "warning" | "info" | "neutral";
  children: React.ReactNode;
}) {
  const c = TONS_BADGE[tom];
  return (
    <span
      className="whitespace-nowrap rounded px-1.5 py-[2px] font-mono text-[7.5px] font-semibold uppercase tracking-[.06em]"
      style={{ color: c.color, backgroundColor: c.background }}
    >
      {children}
    </span>
  );
}

/** Linha de lista (padrão "atividade" PainelVivoLogin:183-197 + conteúdo livre). */
export function LinhaLista({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-chip border border-[var(--hairline)] bg-main px-2.5 py-[7px]">
      {children}
    </div>
  );
}
