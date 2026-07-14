/**
 * Mockup do módulo Financeiro — seção 03 da página /recursos (zigue-zague).
 * Janelinha com tiles de fluxo de caixa + barra de recebimento + parcelas.
 * 100% estático (sem hooks/props/animação) — decorativo, dados de exemplo fixos.
 */

import {
  Janela,
  SidebarMini,
  TileMetrica,
  LinhaLista,
  BadgeMono,
  ChipFlutuante,
} from "@/components/landing/recursos/MockKit";

export default function MockFinanceiro() {
  return (
    <div
      aria-hidden
      className="absolute left-1/2 top-1/2 w-[420px]"
      style={{ margin: "-165px 0 0 -210px" }}
    >
      <div className="relative">
        <Janela w={380}>
          <SidebarMini ativo="Financeiro" />
          <div className="min-w-0 flex-1 px-3 py-2.5">
            {/* 4 tiles em grid 2×2 uniforme */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="min-w-0">
                <TileMetrica
                  rotulo="TOTAL EM VENDAS"
                  valor="R$ 128k"
                  cor="var(--brand-ink)"
                />
              </div>
              <div className="min-w-0">
                <TileMetrica rotulo="RECEBIDO" valor="R$ 92k" cor="var(--success-ink)" />
              </div>
              <div className="min-w-0">
                <TileMetrica rotulo="A RECEBER" valor="R$ 36k" cor="var(--brand-ink)" />
              </div>
              <div className="min-w-0">
                <TileMetrica rotulo="ATRASADO" valor="R$ 4,2k" cor="var(--danger)" />
              </div>
            </div>

            {/* barra de progresso de recebimento */}
            <div className="mt-2 rounded-lg border border-[var(--hairline)] bg-main px-2.5 py-2">
              <div className="font-mono text-[7px] font-semibold tracking-[.1em] text-[var(--text-label)]">
                PROGRESSO DE RECEBIMENTO
              </div>
              <div className="mt-1.5 h-[7px] rounded-full bg-[var(--hairline)]">
                <div
                  className="h-full w-[72%] rounded-full"
                  style={{ background: "var(--grad-signal)" }}
                />
              </div>
            </div>

            {/* parcelas */}
            <div className="mt-2.5 font-mono text-[7px] font-semibold tracking-[.1em] text-[var(--text-label)]">
              PARCELAS
            </div>
            <div className="mt-1.5 flex flex-col gap-[5px]">
              <LinhaLista>
                <span className="min-w-0 flex-1 truncate text-[9.5px] text-[var(--text-soft)]">
                  Parcela 2/3 · Maninhoo · R$ 5.000
                </span>
                <span className="flex-none font-mono text-[8px] text-muted">
                  VENC 20 JUL
                </span>
                <BadgeMono tom="success">PAGO</BadgeMono>
              </LinhaLista>
              <LinhaLista>
                <span className="min-w-0 flex-1 truncate text-[9.5px] text-[var(--text-soft)]">
                  Parcela 1/2 · DJ Lunar · R$ 11.000
                </span>
                <BadgeMono tom="warning">PENDENTE</BadgeMono>
              </LinhaLista>
              <LinhaLista>
                <span className="min-w-0 flex-1 truncate text-[9.5px] text-[var(--text-soft)]">
                  Parcela 3/3 · Maninhoo · R$ 4.200
                </span>
                <BadgeMono tom="danger">ATRASADO</BadgeMono>
              </LinhaLista>
            </div>
          </div>
        </Janela>

        <ChipFlutuante
          estilo={{ bottom: -10, left: -6 }}
          corIcone="var(--success)"
          icone={<path d="M5 12l5 5L20 6" />}
          titulo="Parcela recebida"
          detalhe="R$ 5.000 · Pix"
        />

        <ChipFlutuante
          estilo={{ top: -12, right: -6 }}
          corIcone="var(--danger)"
          icone={
            <>
              <path d="M12 4L2.5 20h19z" />
              <path d="M12 10v4M12 17h.01" />
            </>
          }
          titulo="Pagamento atrasado"
          detalhe="Parcela 3/3 · R$ 4.200"
        />
      </div>
    </div>
  );
}
