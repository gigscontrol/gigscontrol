"use client";

import Link from "next/link";
import {
  CalendarRange,
  FileText,
  Wallet,
  Users,
  FileSignature,
  ArrowRight,
  MessageCircle,
  ShieldCheck,
  Zap,
  Check,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  MockAgenda,
  MockVendas,
  MockFinanceiro,
  MockDashboard,
  MockContratos,
} from "@/components/landing/Mockups";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useT } from "@/lib/i18n";

const VENDAS = "#a855f7";
const AGENDA = "#3b82f6";
const FINANCEIRO = "#22c55e";
const CONTRATOS = "#14b8a6";
const CONTATOS = "#f97316";

/** Anel de foco visível para teclado (acessibilidade), na cor da marca. */
const FOCO =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--module-vendas)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-main)] rounded-md";

export default function LandingPage() {
  const t = useT();
  return (
    <div className="min-h-screen bg-main text-primary">
      {/* ===== NAV ===== */}
      <nav className="sticky top-0 z-40 border-b border-border bg-main/80 backdrop-blur-md">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between px-6 h-16">
          <Logo />
          <div className="flex items-center gap-1.5">
            <Link href="#recursos" className={`btn btn-ghost text-sm hidden sm:inline-flex ${FOCO}`}>
              {t("Recursos")}
            </Link>
            <Link href="/planos" className={`btn btn-ghost text-sm ${FOCO}`}>
              {t("Planos")}
            </Link>
            <LanguageSwitcher />
            <Link href="/login" className={`btn btn-secondary text-sm ${FOCO}`}>
              {t("Entrar")}
            </Link>
            <Link
              href="/planos"
              className={`btn text-sm text-white ${FOCO}`}
              style={{ backgroundColor: VENDAS }}
            >
              {t("Começar")}
            </Link>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(620px circle at 72% 8%, rgba(168,85,247,0.18), transparent 60%), radial-gradient(560px circle at 18% 30%, rgba(20,184,166,0.14), transparent 60%), radial-gradient(700px circle at 50% 80%, rgba(59,130,246,0.10), transparent 65%)",
          }}
        />
        <div className="relative max-w-[1200px] mx-auto px-6 pt-20 pb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-surface/70 text-xs text-secondary mb-7">
            <Sparkles size={13} style={{ color: VENDAS }} />
            {t("Gestão completa para agências e artistas da música")}
          </div>

          <h1 className="font-display text-[2.6rem] leading-[1.05] sm:text-6xl font-extrabold tracking-tight max-w-4xl mx-auto">
            {t("A operação da sua")}{" "}
            <span className="bg-gradient-to-r from-[var(--module-vendas)] to-[var(--module-contratos)] bg-clip-text text-transparent">
              {t("agência musical")}
            </span>{" "}
            {t("em um só lugar")}
          </h1>

          <p className="mt-6 text-base sm:text-lg text-secondary max-w-2xl mx-auto leading-relaxed">
            {t("Agenda de shows, orçamentos no WhatsApp, vendas, contratos com assinatura e financeiro — do primeiro contato ao recebimento do cachê. Feito para DJs, cantores, MCs e agências.")}
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/planos"
              className={`btn text-sm px-6 py-3 text-white shadow-[0_8px_24px_-6px_rgba(168,85,247,0.5)] ${FOCO}`}
              style={{ backgroundColor: VENDAS }}
            >
              {t("Ver planos")}
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/login"
              className={`btn btn-secondary text-sm px-6 py-3 ${FOCO}`}
            >
              {t("Já tenho conta")}
            </Link>
          </div>

          <p className="mt-4 text-xs text-muted">
            {t("Sem cartão de crédito para testar · Cancele quando quiser")}
          </p>

          {/* Indicadores (fiéis às features, sem números inventados) */}
          <div className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 text-xs text-secondary">
            <Indicador icon={<Layers size={14} />} cor={VENDAS} label={t("5 módulos integrados")} />
            <Indicador icon={<MessageCircle size={14} />} cor={FINANCEIRO} label={t("Proposta no WhatsApp")} />
            <Indicador icon={<FileSignature size={14} />} cor={CONTRATOS} label={t("Contrato com assinatura")} />
            <Indicador icon={<ShieldCheck size={14} />} cor={AGENDA} label={t("Privacidade por papel")} />
          </div>
        </div>

        {/* Mockup grande da dashboard, com brilho */}
        <div className="relative max-w-[1080px] mx-auto px-6 pb-20">
          <div
            aria-hidden
            className="absolute -inset-x-10 -top-6 bottom-10 pointer-events-none blur-2xl opacity-60"
            style={{
              background:
                "radial-gradient(closest-side, rgba(168,85,247,0.18), transparent)",
            }}
          />
          <div className="relative">
            <BrowserFrame legenda={t("Painel principal — visão geral da operação")}>
              <MockDashboard />
            </BrowserFrame>
          </div>
        </div>
      </section>

      {/* ===== PRA QUEM É ===== */}
      <section className="max-w-[1200px] mx-auto px-6 pb-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-xs uppercase tracking-[0.15em] text-muted">
            {t("Feito para quem vive de música")}
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[t("DJ"), t("Cantor"), t("MC"), t("Banda"), t("Produtor"), t("Agência")].map((p) => (
              <span
                key={p}
                className="px-3 py-1 rounded-full border border-border bg-surface/60 text-xs font-medium text-secondary"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ===== MÓDULOS (grade) ===== */}
      <section id="recursos" className="max-w-[1200px] mx-auto px-6 py-16 scroll-mt-20">
        <div className="text-center mb-12">
          <h2 className="font-display text-2xl sm:text-4xl font-bold">
            {t("Tudo que a operação precisa")}
          </h2>
          <p className="mt-3 text-secondary max-w-xl mx-auto">
            {t("Cinco módulos que conversam entre si, pensados para o dia a dia da música.")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard
            icon={<CalendarRange size={20} />}
            color={AGENDA}
            title={t("Agenda")}
            desc={t("Escala de shows, calendário e a logística completa de cada evento.")}
          />
          <FeatureCard
            icon={<FileText size={20} />}
            color={VENDAS}
            title={t("Vendas")}
            desc={t("Orçamentos profissionais, envio por WhatsApp e conversão em vendas.")}
          />
          <FeatureCard
            icon={<Wallet size={20} />}
            color={FINANCEIRO}
            title={t("Financeiro")}
            desc={t("Parcelas, vencimentos e controle de quem pagou e quem está atrasado.")}
          />
          <FeatureCard
            icon={<FileSignature size={20} />}
            color={CONTRATOS}
            title={t("Contratos")}
            desc={t("Gere o contrato do show e colete a assinatura com selfie e facial.")}
            novo
          />
          <FeatureCard
            icon={<Users size={20} />}
            color={CONTATOS}
            title={t("Contatos")}
            desc={t("Contratantes, casas e cidades — um CRM feito para o meio musical.")}
          />
          <div className="card flex flex-col justify-center gap-2" style={{ borderColor: "var(--border-hover)" }}>
            <div
              className="h-10 w-10 rounded-md flex items-center justify-center mb-1"
              style={{ backgroundColor: "var(--bg-elevated)", color: VENDAS }}
            >
              <Layers size={20} />
            </div>
            <h3 className="text-sm font-bold">{t("Tudo integrado")}</h3>
            <p className="text-xs text-secondary leading-relaxed">
              {t("Um dado entra uma vez e flui por todos os módulos — do orçamento ao cachê no bolso.")}
            </p>
          </div>
        </div>
      </section>

      {/* ===== COMO FUNCIONA ===== */}
      <section className="border-y border-border bg-surface/40">
        <div className="max-w-[1200px] mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h2 className="font-display text-2xl sm:text-4xl font-bold">
              {t("Do WhatsApp ao palco em 3 passos")}
            </h2>
            <p className="mt-3 text-secondary max-w-xl mx-auto">
              {t("O fluxo que a sua agência já faz — só que organizado e sem perder nada pelo caminho.")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Passo
              n={1}
              cor={VENDAS}
              icon={<MessageCircle size={18} />}
              title={t("Orçou, enviou")}
              desc={t("Monte o orçamento com um ou vários artistas e mande a proposta formatada direto no WhatsApp.")}
            />
            <Passo
              n={2}
              cor={AGENDA}
              icon={<Zap size={18} />}
              title={t("Fechou, agendou")}
              desc={t("Orçamento aceito vira venda, entra como show na agenda e gera as parcelas no financeiro.")}
            />
            <Passo
              n={3}
              cor={CONTRATOS}
              icon={<FileSignature size={18} />}
              title={t("Assinou, garantiu")}
              desc={t("Gere o contrato do show e colete a assinatura com CPF, selfie e reconhecimento facial.")}
            />
          </div>
        </div>
      </section>

      {/* ===== FUNCIONALIDADES (texto + mockup) ===== */}
      <SecaoFuncionalidade
        cor={AGENDA}
        etiqueta={t("Agenda de Shows")}
        titulo={t("Toda a escala da agência num calendário só")}
        descricao={t("Visualize os shows de todos os artistas de uma vez ou filtre por DJ. Cada evento traz contratante, local, line-up, camarim, hotel e logística completa — tudo num clique.")}
        pontos={[
          t("Calendário com todos os artistas ao mesmo tempo"),
          t("Detalhes completos de cada show num modal"),
          t("Filtro por artista, status e período"),
        ]}
        mockup={<MockAgenda />}
        legenda={t("Agenda de Shows — escala de todos os artistas")}
        inverter={false}
      />

      <SecaoFuncionalidade
        cor={VENDAS}
        etiqueta={t("Orçamentos & Vendas")}
        titulo={t("Do orçamento no WhatsApp ao show fechado")}
        descricao={t("Monte orçamentos profissionais com múltiplos DJs, logística e valores. Envie a proposta formatada pelo WhatsApp e, quando aceita, transforme em venda e em show na agenda.")}
        pontos={[
          t("Orçamento com vários artistas no mesmo evento"),
          t("Proposta formatada enviada direto no WhatsApp"),
          t("Um clique transforma orçamento aceito em venda"),
        ]}
        mockup={<MockVendas />}
        legenda={t("Vendas — histórico de orçamentos e conversões")}
        inverter={true}
      />

      <SecaoFuncionalidade
        cor={FINANCEIRO}
        etiqueta={t("Controle Financeiro")}
        titulo={t("Saiba quem pagou, quem deve e quando vence")}
        descricao={t("Cada venda gera as parcelas automaticamente. Acompanhe vencimentos, registre pagamentos e veja num relance o que está pago, pendente ou atrasado.")}
        pontos={[
          t("Parcelas geradas automaticamente a cada venda"),
          t("Status de pago, pendente e atrasado"),
          t("Visão clara de recebimentos por período"),
        ]}
        mockup={<MockFinanceiro />}
        legenda={t("Financeiro — controle de parcelas e pagamentos")}
        inverter={false}
      />

      <SecaoFuncionalidade
        cor={CONTRATOS}
        etiqueta={t("Contratos & Assinatura")}
        titulo={t("Contrato pronto e assinado, sem ferramenta extra")}
        descricao={t("Gere o contrato direto da venda, com seus modelos e os dados já preenchidos. Envie o link de assinatura por WhatsApp e a pessoa assina pelo celular — com CPF, selfie e reconhecimento facial. No fim, um relatório de assinaturas com a prova de cada assinante.")}
        pontos={[
          t("Modelos de contrato com preenchimento automático"),
          t("Assinatura pelo link, sem cadastro, no próprio celular"),
          t("Selfie + reconhecimento facial e relatório de assinaturas"),
        ]}
        mockup={<MockContratos />}
        legenda={t("Contratos — assinatura com verificação")}
        inverter={true}
        novo
      />

      {/* ===== DESTAQUES ===== */}
      <section className="border-y border-border bg-surface/40">
        <div className="max-w-[1200px] mx-auto px-6 py-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <Destaque
            icon={<MessageCircle size={18} />}
            cor={FINANCEIRO}
            title={t("Orçamento direto no WhatsApp")}
            desc={t("Monte e envie a proposta formatada em segundos, sem copiar e colar.")}
          />
          <Destaque
            icon={<ShieldCheck size={18} />}
            cor={AGENDA}
            title={t("Cada um vê o que deve ver")}
            desc={t("Defina o que vendedores, produtores e artistas acessam. Privacidade por papel.")}
          />
          <Destaque
            icon={<FileSignature size={18} />}
            cor={CONTRATOS}
            title={t("Contrato com assinatura")}
            desc={t("Assinatura pelo celular com CPF, selfie e reconhecimento facial.")}
          />
          <Destaque
            icon={<Zap size={18} />}
            cor={VENDAS}
            title={t("Do orçamento ao palco")}
            desc={t("Um orçamento aceito vira venda, show, contrato e parcelas num clique.")}
          />
        </div>
      </section>

      {/* ===== CTA FINAL ===== */}
      <section className="max-w-[1200px] mx-auto px-6 py-20">
        <div
          className="relative overflow-hidden rounded-2xl border border-border px-6 py-14 text-center"
          style={{
            background:
              "radial-gradient(500px circle at 50% 0%, rgba(168,85,247,0.16), transparent 70%), var(--bg-surface)",
          }}
        >
          <h2 className="font-display text-2xl sm:text-4xl font-bold">
            {t("Pronto para organizar sua agência?")}
          </h2>
          <p className="mt-3 text-secondary max-w-md mx-auto">
            {t("Escolha o plano do tamanho da sua operação — do artista solo à agência com 50 nomes.")}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/planos"
              className={`btn text-sm px-6 py-3 text-white shadow-[0_8px_24px_-6px_rgba(168,85,247,0.5)] ${FOCO}`}
              style={{ backgroundColor: VENDAS }}
            >
              {t("Conhecer os planos")}
              <ArrowRight size={16} />
            </Link>
            <Link href="/login" className={`btn btn-secondary text-sm px-6 py-3 ${FOCO}`}>
              {t("Entrar")}
            </Link>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-border">
        <div className="max-w-[1200px] mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex flex-col items-center sm:items-start gap-2">
            <Logo small />
            <p className="text-xs text-muted">
              © {new Date().getFullYear()} GIGS CONTROL — {t("Gestão para a música.")}{" "}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted">
            <Link href="#recursos" className={`hover:text-secondary transition-colors ${FOCO}`}>
              {t("Recursos")}
            </Link>
            <Link href="/planos" className={`hover:text-secondary transition-colors ${FOCO}`}>
              {t("Planos")}
            </Link>
            <Link href="/login" className={`hover:text-secondary transition-colors ${FOCO}`}>
              {t("Entrar")}
            </Link>
            <Link href="/termos" className={`hover:text-secondary transition-colors ${FOCO}`}>
              {t("Termos")}
            </Link>
            <Link href="/privacidade" className={`hover:text-secondary transition-colors ${FOCO}`}>
              {t("Privacidade")}
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
  novo,
}: {
  cor: string;
  etiqueta: string;
  titulo: string;
  descricao: string;
  pontos: string[];
  mockup: React.ReactNode;
  legenda: string;
  inverter: boolean;
  novo?: boolean;
}) {
  const t = useT();
  return (
    <section className="max-w-[1200px] mx-auto px-6 py-16">
      <div
        className={`grid grid-cols-1 lg:grid-cols-2 gap-10 items-center ${
          inverter ? "lg:[&>*:first-child]:order-2" : ""
        }`}
      >
        {/* Texto */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span
              className="inline-block text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded"
              style={{ backgroundColor: `${cor}22`, color: cor }}
            >
              {etiqueta}
            </span>
            {novo && (
              <span
                className="text-xs font-semibold px-2 py-1 rounded text-white"
                style={{ backgroundColor: cor }}
              >
                {t("Novo")}
              </span>
            )}
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold leading-tight">
            {titulo}
          </h2>
          <p className="mt-3 text-secondary leading-relaxed">{descricao}</p>
          <ul className="mt-6 flex flex-col gap-3">
            {pontos.map((p) => (
              <li key={p} className="flex items-start gap-2.5">
                <span
                  className="h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: `${cor}22`, color: cor }}
                >
                  <Check size={12} strokeWidth={3} />
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
          backgroundColor: VENDAS,
          width: small ? 24 : 30,
          height: small ? 24 : 30,
          fontSize: small ? 13 : 16,
        }}
      >
        G
      </div>
      <span
        className={`font-display font-bold tracking-tight ${
          small ? "text-sm" : "text-base"
        }`}
      >
        GIGS<span className="text-muted"> CONTROL</span>
      </span>
    </div>
  );
}

function Indicador({
  icon,
  cor,
  label,
}: {
  icon: React.ReactNode;
  cor: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span style={{ color: cor }}>{icon}</span>
      {label}
    </span>
  );
}

function FeatureCard({
  icon,
  color,
  title,
  desc,
  novo,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  desc: string;
  novo?: boolean;
}) {
  const t = useT();
  return (
    <div className="card-interactive">
      <div className="flex items-center justify-between mb-3">
        <div
          className="h-10 w-10 rounded-md flex items-center justify-center"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {icon}
        </div>
        {novo && (
          <span
            className="text-[0.65rem] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${color}22`, color }}
          >
            {t("Novo")}
          </span>
        )}
      </div>
      <h3 className="text-sm font-bold mb-1">{title}</h3>
      <p className="text-xs text-secondary leading-relaxed">{desc}</p>
    </div>
  );
}

function Passo({
  n,
  cor,
  icon,
  title,
  desc,
}: {
  n: number;
  cor: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="card relative">
      <div className="flex items-center gap-3 mb-3">
        <span
          className="h-10 w-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${cor}1f`, color: cor }}
        >
          {icon}
        </span>
        <span
          className="font-display text-3xl font-extrabold leading-none"
          style={{ color: `${cor}` }}
        >
          {n}
        </span>
      </div>
      <h3 className="text-base font-bold mb-1">{title}</h3>
      <p className="text-sm text-secondary leading-relaxed">{desc}</p>
    </div>
  );
}

function Destaque({
  icon,
  cor,
  title,
  desc,
}: {
  icon: React.ReactNode;
  cor: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="h-10 w-10 rounded-md flex items-center justify-center"
        style={{ backgroundColor: `${cor}1f`, color: cor }}
      >
        {icon}
      </div>
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="text-xs text-secondary leading-relaxed">{desc}</p>
    </div>
  );
}
