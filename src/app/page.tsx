"use client";

import Link from "next/link";
import {
  CalendarRange,
  FileText,
  Wallet,
  Users,
  ArrowRight,
  MessageCircle,
  Shield,
  Zap,
  Check,
} from "lucide-react";
import {
  MockAgenda,
  MockVendas,
  MockFinanceiro,
  MockDashboard,
} from "@/components/landing/Mockups";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-main text-primary">
      {/* ===== NAV ===== */}
      <nav className="sticky top-0 z-40 border-b border-border bg-main/90 backdrop-blur-md">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between px-6 h-16">
          <Logo />
          <div className="flex items-center gap-2">
            <Link href="/planos" className="btn btn-ghost text-sm">
              Planos
            </Link>
            <Link href="/login" className="btn btn-secondary text-sm">
              Entrar
            </Link>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background:
              "radial-gradient(600px circle at 70% 10%, rgba(168,85,247,0.15), transparent 60%), radial-gradient(500px circle at 20% 40%, rgba(59,130,246,0.12), transparent 60%)",
          }}
        />
        <div className="relative max-w-[1200px] mx-auto px-6 pt-20 pb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-surface text-xs text-secondary mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--module-vendas)]" />
            Gestão completa para agências e artistas
          </div>

          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.1] max-w-3xl mx-auto">
            A agenda da sua{" "}
            <span style={{ color: "var(--module-vendas)" }}>
              carreira musical
            </span>{" "}
            em um só lugar
          </h1>

          <p className="mt-6 text-base sm:text-lg text-secondary max-w-xl mx-auto">
            O GIGS CONTROL organiza shows, orçamentos, vendas e pagamentos de
            DJs, cantores e MCs. Da proposta no WhatsApp ao recebimento do
            cachê.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/planos"
              className="btn btn-primary text-sm px-5 py-2.5"
              style={{ backgroundColor: "var(--module-vendas)", color: "#fff" }}
            >
              Ver planos
              <ArrowRight size={15} />
            </Link>
            <Link href="/login" className="btn btn-secondary text-sm px-5 py-2.5">
              Já tenho conta
            </Link>
          </div>

          <p className="mt-4 text-xs text-muted">
            Sem cartão de crédito para testar · Cancele quando quiser
          </p>
        </div>

        {/* Mockup grande da dashboard */}
        <div className="relative max-w-[1080px] mx-auto px-6 pb-20">
          <BrowserFrame legenda="Painel principal — visão geral da operação">
            <MockDashboard />
          </BrowserFrame>
        </div>
      </section>

      {/* ===== MÓDULOS (grade) ===== */}
      <section className="max-w-[1200px] mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold">
            Tudo que a operação precisa
          </h2>
          <p className="mt-2 text-secondary text-sm">
            Quatro módulos integrados, pensados para o dia a dia da música.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FeatureCard
            icon={<CalendarRange size={20} />}
            color="var(--module-agenda)"
            title="Agenda"
            desc="Escala de shows, calendário e detalhes de cada evento com toda a logística."
          />
          <FeatureCard
            icon={<FileText size={20} />}
            color="var(--module-vendas)"
            title="Vendas"
            desc="Orçamentos profissionais, envio por WhatsApp e conversão em vendas."
          />
          <FeatureCard
            icon={<Wallet size={20} />}
            color="var(--module-financeiro)"
            title="Financeiro"
            desc="Parcelas, vencimentos e controle de quem pagou, quem está atrasado."
          />
          <FeatureCard
            icon={<Users size={20} />}
            color="var(--module-contatos)"
            title="Contatos"
            desc="Contratantes, casas e cidades — um CRM feito para o meio musical."
          />
        </div>
      </section>

      {/* ===== FUNCIONALIDADE 1 — AGENDA ===== */}
      <SecaoFuncionalidade
        cor="var(--module-agenda)"
        etiqueta="Agenda de Shows"
        titulo="Toda a escala da agência num calendário só"
        descricao="Visualize os shows de todos os artistas de uma vez ou filtre por DJ. Cada evento traz contratante, local, line-up, camarim, hotel e logística completa — tudo num clique."
        pontos={[
          "Calendário com todos os artistas ao mesmo tempo",
          "Detalhes completos de cada show num modal",
          "Filtro por artista, status e período",
        ]}
        mockup={<MockAgenda />}
        legenda="Agenda de Shows — escala de todos os artistas"
        inverter={false}
      />

      {/* ===== FUNCIONALIDADE 2 — VENDAS ===== */}
      <SecaoFuncionalidade
        cor="var(--module-vendas)"
        etiqueta="Orçamentos & Vendas"
        titulo="Do orçamento no WhatsApp ao show fechado"
        descricao="Monte orçamentos profissionais com múltiplos DJs, logística e valores. Envie a proposta formatada pelo WhatsApp e, quando aceita, transforme em venda e em show na agenda."
        pontos={[
          "Orçamento com vários artistas no mesmo evento",
          "Proposta formatada enviada direto no WhatsApp",
          "Um clique transforma orçamento aceito em venda",
        ]}
        mockup={<MockVendas />}
        legenda="Vendas — histórico de orçamentos e conversões"
        inverter={true}
      />

      {/* ===== FUNCIONALIDADE 3 — FINANCEIRO ===== */}
      <SecaoFuncionalidade
        cor="var(--module-financeiro)"
        etiqueta="Controle Financeiro"
        titulo="Saiba quem pagou, quem deve e quando vence"
        descricao="Cada venda gera as parcelas automaticamente. Acompanhe vencimentos, registre pagamentos e veja num relance o que está pago, pendente ou atrasado."
        pontos={[
          "Parcelas geradas automaticamente a cada venda",
          "Status de pago, pendente e atrasado",
          "Visão clara de recebimentos por período",
        ]}
        mockup={<MockFinanceiro />}
        legenda="Financeiro — controle de parcelas e pagamentos"
        inverter={false}
      />

      {/* ===== DESTAQUES ===== */}
      <section className="border-y border-border bg-surface/50">
        <div className="max-w-[1200px] mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <Destaque
            icon={<MessageCircle size={18} />}
            title="Orçamento direto no WhatsApp"
            desc="Monte o orçamento e envie a proposta formatada em segundos, sem copiar e colar."
          />
          <Destaque
            icon={<Shield size={18} />}
            title="Cada um vê o que deve ver"
            desc="Defina o que vendedores, produtores e artistas acessam. Privacidade por papel."
          />
          <Destaque
            icon={<Zap size={18} />}
            title="Do orçamento ao palco"
            desc="Transforme um orçamento aceito em venda e em show na agenda com um clique."
          />
        </div>
      </section>

      {/* ===== CTA FINAL ===== */}
      <section className="max-w-[1200px] mx-auto px-6 py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold">
          Pronto para organizar sua agência?
        </h2>
        <p className="mt-3 text-secondary text-sm max-w-md mx-auto">
          Escolha o plano do tamanho da sua operação — do artista solo à
          agência com 50 nomes.
        </p>
        <Link
          href="/planos"
          className="mt-8 inline-flex btn btn-primary text-sm px-6 py-3"
          style={{ backgroundColor: "var(--module-vendas)", color: "#fff" }}
        >
          Conhecer os planos
          <ArrowRight size={15} />
        </Link>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-border">
        <div className="max-w-[1200px] mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4">
          <Logo small />
          <p className="text-xs text-muted">
            © {new Date().getFullYear()} GIGS CONTROL — Gestão para a música.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted">
            <Link
              href="/planos"
              className="hover:text-secondary transition-colors"
            >
              Planos
            </Link>
            <Link
              href="/login"
              className="hover:text-secondary transition-colors"
            >
              Entrar
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ============================================================
   Seção de funcionalidade — texto + mockup, alternando lados
   ============================================================ */
function SecaoFuncionalidade({
  cor,
  etiqueta,
  titulo,
  descricao,
  pontos,
  mockup,
  legenda,
  inverter,
}: {
  cor: string;
  etiqueta: string;
  titulo: string;
  descricao: string;
  pontos: string[];
  mockup: React.ReactNode;
  legenda: string;
  inverter: boolean;
}) {
  return (
    <section className="max-w-[1200px] mx-auto px-6 py-16">
      <div
        className={`grid grid-cols-1 lg:grid-cols-2 gap-10 items-center ${
          inverter ? "lg:[&>*:first-child]:order-2" : ""
        }`}
      >
        {/* Texto */}
        <div>
          <span
            className="inline-block text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded mb-3"
            style={{ backgroundColor: `${cor}22`, color: cor }}
          >
            {etiqueta}
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold leading-tight">
            {titulo}
          </h2>
          <p className="mt-3 text-secondary text-sm leading-relaxed">
            {descricao}
          </p>
          <ul className="mt-5 flex flex-col gap-2.5">
            {pontos.map((p) => (
              <li key={p} className="flex items-start gap-2.5">
                <span
                  className="h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: `${cor}22`, color: cor }}
                >
                  <Check size={12} />
                </span>
                <span className="text-sm text-secondary">{p}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Mockup */}
        <BrowserFrame legenda={legenda}>{mockup}</BrowserFrame>
      </div>
    </section>
  );
}

/* ============================================================
   Moldura de navegador — embala os mockups/prints
   ============================================================ */
function BrowserFrame({
  children,
  legenda,
}: {
  children: React.ReactNode;
  legenda?: string;
}) {
  return (
    <div>
      <div
        className="rounded-xl border border-border overflow-hidden bg-surface"
        style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.45)" }}
      >
        {/* Barra do navegador */}
        <div className="flex items-center gap-1.5 px-3 h-8 border-b border-border bg-elevated">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]/70" />
        </div>
        {/* Conteúdo (mockup) */}
        <div className="bg-main">{children}</div>
      </div>
      {legenda && (
        <p className="text-center text-xs text-muted mt-3">{legenda}</p>
      )}
    </div>
  );
}

function Logo({ small }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="rounded-md flex items-center justify-center font-bold text-white"
        style={{
          backgroundColor: "var(--module-vendas)",
          width: small ? 24 : 28,
          height: small ? 24 : 28,
          fontSize: small ? 13 : 15,
        }}
      >
        G
      </div>
      <span
        className={`font-bold tracking-tight ${
          small ? "text-sm" : "text-base"
        }`}
      >
        GIGS<span className="text-muted"> CONTROL</span>
      </span>
    </div>
  );
}

function FeatureCard({
  icon,
  color,
  title,
  desc,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="card">
      <div
        className="h-10 w-10 rounded-md flex items-center justify-center mb-3"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {icon}
      </div>
      <h3 className="text-sm font-bold mb-1">{title}</h3>
      <p className="text-xs text-secondary leading-relaxed">{desc}</p>
    </div>
  );
}

function Destaque({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="h-9 w-9 rounded-md flex items-center justify-center"
        style={{
          backgroundColor: "var(--bg-elevated)",
          color: "var(--module-vendas)",
        }}
      >
        {icon}
      </div>
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="text-xs text-secondary leading-relaxed">{desc}</p>
    </div>
  );
}
