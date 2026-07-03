"use client";

import Link from "next/link";
import LogoGC from "@/components/LogoGC";
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
  Plane,
  Globe2,
  Mail,
  Table2,
  FolderClosed,
  ChevronDown,
  UserCog,
} from "lucide-react";
import {
  MockAgenda,
  MockVendas,
  MockFinanceiro,
  MockDashboard,
  MockContratos,
} from "@/components/landing/Mockups";
import { Reveal, FundoHero, CenaHero } from "@/components/landing/Efeitos";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useT } from "@/lib/i18n";

// Identidade Signal Blue — cor de ação única da marca. Mantida como hex
// porque vários realces concatenam opacidade (ex.: `${BRAND}22`), o que não
// funciona com var(--brand). Alinhada a --brand em globals.css.
const BRAND = "#3D7BFF";
const SUCESSO = "#3CE08C";

/** Anel de foco visível para teclado (acessibilidade), na cor da marca. */
const FOCO =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-main)] rounded-md";

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
              style={{ backgroundColor: BRAND }}
            >
              {t("Começar grátis")}
            </Link>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden">
        {/* Glow de fundo */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(620px circle at 72% 8%, rgba(61,123,255,0.16), transparent 60%), radial-gradient(560px circle at 18% 30%, rgba(74,196,255,0.12), transparent 60%), radial-gradient(700px circle at 50% 80%, rgba(40,71,215,0.10), transparent 65%)",
          }}
        />
        {/* Malha de pontos interativa (acende perto do mouse) */}
        <FundoHero />

        <div className="relative max-w-[1200px] mx-auto px-6 pt-20 pb-12 text-center">
          <Reveal>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-surface/70 text-xs text-secondary mb-7">
              <Sparkles size={13} style={{ color: BRAND }} />
              {t("O CRM feito para agências e artistas da música")}
            </div>
          </Reveal>

          <Reveal delay={90}>
            <h1 className="font-display text-[2.7rem] leading-[1.04] sm:text-6xl font-extrabold tracking-tight max-w-4xl mx-auto">
              {t("Sua agência inteira.")}{" "}
              <span className="bg-gradient-to-r from-[var(--brand)] to-[var(--brand-2)] bg-clip-text text-transparent">
                {t("Um só controle.")}
              </span>
            </h1>
          </Reveal>

          <Reveal delay={180}>
            <p className="mt-6 text-base sm:text-lg text-secondary max-w-2xl mx-auto leading-relaxed">
              {t("Agenda, vendas, financeiro, contratos e equipe — tudo conectado, do orçamento no WhatsApp ao cachê no bolso. Feito para DJs, cantores, MCs e agências.")}
            </p>
          </Reveal>

          <Reveal delay={260}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/planos"
                className={`btn text-sm px-6 py-3 text-white shadow-[0_8px_24px_-6px_rgba(61,123,255,0.5)] transition-transform hover:scale-[1.03] ${FOCO}`}
                style={{ backgroundColor: BRAND }}
              >
                {t("Começar grátis")}
                <ArrowRight size={16} />
              </Link>
              <Link
                href="#recursos"
                className={`btn btn-secondary text-sm px-6 py-3 ${FOCO}`}
              >
                {t("Conhecer os módulos")}
              </Link>
            </div>
          </Reveal>

          <Reveal delay={330}>
            <p className="mt-4 text-xs text-muted">
              {t("Sem cartão de crédito para testar · Configure em minutos · Cancele quando quiser")}
            </p>
          </Reveal>

          {/* Indicadores (fiéis às features, sem números inventados) */}
          <Reveal delay={400}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 text-xs text-secondary">
              <Indicador icon={<Layers size={14} />} cor={BRAND} label={t("6 módulos integrados")} />
              <Indicador icon={<MessageCircle size={14} />} cor={BRAND} label={t("Proposta no WhatsApp")} />
              <Indicador icon={<FileSignature size={14} />} cor={BRAND} label={t("Contrato com assinatura")} />
              <Indicador icon={<ShieldCheck size={14} />} cor={BRAND} label={t("Permissões por artista")} />
            </div>
          </Reveal>
        </div>

        {/* Mockup grande da dashboard — tilt 3D + chips flutuantes */}
        <div className="relative max-w-[1080px] mx-auto px-6 pb-24">
          <div
            aria-hidden
            className="absolute -inset-x-10 -top-6 bottom-10 pointer-events-none blur-2xl opacity-60"
            style={{
              background:
                "radial-gradient(closest-side, rgba(61,123,255,0.18), transparent)",
            }}
          />
          <Reveal delay={200} y={40}>
            <CenaHero
              chips={[
                <ChipFlutuante
                  key="contrato"
                  icon={<FileSignature size={15} />}
                  cor={SUCESSO}
                  titulo={t("Contrato assinado")}
                  sub={t("agora mesmo, pelo celular")}
                />,
                <ChipFlutuante
                  key="voo"
                  icon={<Plane size={15} />}
                  cor={BRAND}
                  titulo={t("Voo importado do voucher")}
                  sub={t("PDF lido pela IA")}
                />,
                <ChipFlutuante
                  key="parcela"
                  icon={<Wallet size={15} />}
                  cor={SUCESSO}
                  titulo={t("Parcela recebida")}
                  sub={t("cachê em dia")}
                />,
                <ChipFlutuante
                  key="show"
                  icon={<CalendarRange size={15} />}
                  cor={BRAND}
                  titulo={t("Show confirmado")}
                  sub={t("sábado · 22h")}
                />,
              ]}
            >
              <BrowserFrame legenda={t("Painel principal — visão geral da operação")}>
                <MockDashboard />
              </BrowserFrame>
            </CenaHero>
          </Reveal>
        </div>
      </section>

      {/* ===== A DOR ===== */}
      <section className="border-y border-border bg-surface/40">
        <div className="max-w-[1200px] mx-auto px-6 py-16">
          <Reveal>
            <div className="text-center mb-10">
              <h2 className="font-display text-2xl sm:text-4xl font-bold">
                {t("Você fecha o show. E aí começa o caos.")}
              </h2>
              <p className="mt-3 text-secondary max-w-xl mx-auto">
                {t("O orçamento está no e-mail. A data, na planilha. O voo, no WhatsApp. O contrato… em algum lugar.")}
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: <Mail size={16} />, texto: t("Orçamento perdido na caixa de entrada") },
              { icon: <Table2 size={16} />, texto: t("Data duplicada na planilha da escala") },
              { icon: <MessageCircle size={16} />, texto: t("Voo enterrado no grupo da equipe") },
              { icon: <FolderClosed size={16} />, texto: t("Contrato esperando assinatura") },
            ].map((c, i) => (
              <Reveal key={i} delay={i * 90}>
                <div className="card h-full flex items-start gap-2.5 opacity-90">
                  <span className="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0 bg-elevated text-muted">
                    {c.icon}
                  </span>
                  <p className="text-xs text-secondary leading-relaxed pt-1">{c.texto}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={300}>
            <p className="mt-10 text-center text-sm sm:text-base font-medium max-w-2xl mx-auto">
              {t("O GIGS CONTROL junta tudo num só lugar —")}{" "}
              <span style={{ color: BRAND }}>
                {t("e cada pessoa da equipe vê exatamente o que precisa ver.")}
              </span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ===== PRA QUEM É ===== */}
      <section className="max-w-[1200px] mx-auto px-6 pt-14 pb-2">
        <Reveal>
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
        </Reveal>
      </section>

      {/* ===== MÓDULOS (grade) ===== */}
      <section id="recursos" className="max-w-[1200px] mx-auto px-6 py-16 scroll-mt-20">
        <Reveal>
          <div className="text-center mb-12">
            <h2 className="font-display text-2xl sm:text-4xl font-bold">
              {t("Tudo que a operação precisa")}
            </h2>
            <p className="mt-3 text-secondary max-w-xl mx-auto">
              {t("Seis módulos que conversam entre si — um dado entra uma vez e flui do orçamento ao cachê.")}
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: <CalendarRange size={20} />,
              title: t("Agenda"),
              desc: t("Shows, voos e eventos de todos os artistas num calendário só — com voucher de voo lido por IA."),
            },
            {
              icon: <FileText size={20} />,
              title: t("Vendas"),
              desc: t("Orçamentos profissionais, proposta no WhatsApp e conversão em venda com um clique."),
            },
            {
              icon: <Wallet size={20} />,
              title: t("Financeiro"),
              desc: t("Parcelas, vencimentos e cachês — quem pagou, quem deve e quando vence."),
            },
            {
              icon: <FileSignature size={20} />,
              title: t("Contratos"),
              desc: t("Gerados a partir da venda e assinados pelo link, com selfie e verificação facial."),
            },
            {
              icon: <Users size={20} />,
              title: t("Contatos"),
              desc: t("Contratantes, casas e cidades do mundo todo — sua rede é o seu ativo."),
            },
            {
              icon: <UserCog size={20} />,
              title: t("Equipe"),
              desc: t("Permissões por artista: cada pessoa da equipe vê e faz só o que deve."),
              novo: true,
            },
          ].map((m, i) => (
            <Reveal key={m.title} delay={i * 70}>
              <FeatureCard icon={m.icon} color={BRAND} title={m.title} desc={m.desc} novo={m.novo} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== COMO FUNCIONA ===== */}
      <section className="border-y border-border bg-surface/40">
        <div className="max-w-[1200px] mx-auto px-6 py-16">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="font-display text-2xl sm:text-4xl font-bold">
                {t("Do WhatsApp ao palco em 3 passos")}
              </h2>
              <p className="mt-3 text-secondary max-w-xl mx-auto">
                {t("O fluxo que a sua agência já faz — só que organizado e sem perder nada pelo caminho.")}
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <MessageCircle size={18} />,
                title: t("Orçou, enviou"),
                desc: t("Monte o orçamento com um ou vários artistas e mande a proposta formatada direto no WhatsApp."),
              },
              {
                icon: <Zap size={18} />,
                title: t("Fechou, agendou"),
                desc: t("Orçamento aceito vira venda, entra como show na agenda e gera as parcelas no financeiro — automático."),
              },
              {
                icon: <FileSignature size={18} />,
                title: t("Assinou, garantiu"),
                desc: t("Gere o contrato do show e colete a assinatura pelo link, com CPF, selfie e reconhecimento facial."),
              },
            ].map((p, i) => (
              <Reveal key={p.title} delay={i * 110}>
                <Passo n={i + 1} cor={BRAND} icon={p.icon} title={p.title} desc={p.desc} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FUNCIONALIDADES (texto + mockup) ===== */}
      <SecaoFuncionalidade
        cor={BRAND}
        etiqueta={t("Agenda de Shows")}
        titulo={t("O mês inteiro de cada artista, num olhar")}
        descricao={t("Shows, voos, transportes e eventos no mesmo calendário — de todos os artistas de uma vez ou filtrado por DJ. Cada evento traz contratante, local, logística e detalhes num clique.")}
        pontos={[
          t("Importe o voucher do voo em PDF — a IA preenche companhia, horário e conexão"),
          t("Sincronização com o Google Calendar do artista"),
          t("Rotas no mapa para planejar as dobras do fim de semana"),
        ]}
        mockup={<MockAgenda />}
        legenda={t("Agenda de Shows — escala de todos os artistas")}
        inverter={false}
      />

      <SecaoFuncionalidade
        cor={BRAND}
        etiqueta={t("Orçamentos & Vendas")}
        titulo={t("Do orçamento no WhatsApp ao show fechado")}
        descricao={t("Monte orçamentos profissionais com múltiplos DJs, logística e valores. Envie a proposta formatada pelo WhatsApp e, quando aceita, transforme em venda com um clique.")}
        pontos={[
          t("Orçamento com vários artistas no mesmo evento"),
          t("Proposta formatada enviada direto no WhatsApp"),
          t("Aceitou? Vira venda, show na agenda e parcelas no financeiro"),
        ]}
        mockup={<MockVendas />}
        legenda={t("Vendas — histórico de orçamentos e conversões")}
        inverter={true}
      />

      <SecaoFuncionalidade
        cor={BRAND}
        etiqueta={t("Controle Financeiro")}
        titulo={t("Cada cachê, cada parcela, sob controle")}
        descricao={t("Cada venda gera as parcelas automaticamente. Acompanhe vencimentos, registre pagamentos e veja num relance o que está pago, pendente ou atrasado — por artista ou geral.")}
        pontos={[
          t("Parcelas geradas automaticamente a cada venda"),
          t("Status de pago, pendente e atrasado"),
          t("Visão clara de recebimentos por período e por artista"),
        ]}
        mockup={<MockFinanceiro />}
        legenda={t("Financeiro — controle de parcelas e pagamentos")}
        inverter={false}
      />

      <SecaoFuncionalidade
        cor={BRAND}
        etiqueta={t("Contratos & Assinatura")}
        titulo={t("Contrato pronto e assinado, sem ferramenta extra")}
        descricao={t("Gere o contrato direto da venda, com seus modelos e os dados já preenchidos. Envie o link por WhatsApp e a pessoa assina pelo celular — com CPF, selfie e reconhecimento facial. Sem imprimir, sem escanear, sem implorar.")}
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
          {[
            {
              icon: <Globe2 size={18} />,
              title: t("Feito pro mundo"),
              desc: t("6 idiomas, cobrança em real ou dólar e cidades de qualquer país."),
            },
            {
              icon: <Sparkles size={18} />,
              title: t("IA de verdade"),
              desc: t("Voucher de voo em PDF vira item na agenda automaticamente."),
            },
            {
              icon: <FileSignature size={18} />,
              title: t("Assinatura pelo link"),
              desc: t("Selfie e verificação facial no celular — sem imprimir nem escanear."),
            },
            {
              icon: <ShieldCheck size={18} />,
              title: t("Permissão cirúrgica"),
              desc: t("Acesso por artista e por função. Cada um vê só o que deve."),
            },
          ].map((d, i) => (
            <Reveal key={d.title} delay={i * 90}>
              <Destaque icon={d.icon} cor={BRAND} title={d.title} desc={d.desc} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== PLANOS (teaser) ===== */}
      <section className="max-w-[1200px] mx-auto px-6 pt-16">
        <Reveal>
          <div
            className="rounded-2xl border border-border px-8 py-10 flex flex-col lg:flex-row items-center justify-between gap-6"
            style={{
              background:
                "radial-gradient(420px circle at 12% 0%, rgba(61,123,255,0.14), transparent 70%), var(--bg-surface)",
            }}
          >
            <div className="text-center lg:text-left">
              <h2 className="font-display text-xl sm:text-2xl font-bold">
                {t("Do artista solo à agência com 40 artistas")}
              </h2>
              <p className="mt-2 text-sm text-secondary max-w-xl">
                {t("Comece no plano Individual e cresça sem trocar de ferramenta — mensal ou anual, em real ou dólar.")}
              </p>
            </div>
            <Link
              href="/planos"
              className={`btn btn-secondary text-sm px-6 py-3 flex-shrink-0 ${FOCO}`}
            >
              {t("Comparar planos")}
              <ArrowRight size={15} />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ===== FAQ ===== */}
      <section className="max-w-[760px] mx-auto px-6 py-16">
        <Reveal>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-center mb-8">
            {t("Perguntas frequentes")}
          </h2>
        </Reveal>
        <div className="flex flex-col gap-3">
          {[
            {
              q: t("Preciso instalar alguma coisa?"),
              a: t("Não. O GIGS CONTROL roda no navegador — no computador, no tablet e no celular."),
            },
            {
              q: t("Meus dados ficam seguros?"),
              a: t("Cada agência tem um espaço isolado, e as permissões controlam o que cada pessoa da equipe enxerga."),
            },
            {
              q: t("O artista tem acesso?"),
              a: t("Sim. Ele acompanha a própria agenda e os próprios números — sem enxergar os outros artistas."),
            },
            {
              q: t("Funciona fora do Brasil?"),
              a: t("Sim. São 6 idiomas, cobrança em real ou dólar e cidades de qualquer país do mundo."),
            },
            {
              q: t("E se a minha agência crescer?"),
              a: t("É só subir de plano — seus dados e sua equipe continuam exatamente onde estavam."),
            },
            {
              q: t("Consigo cancelar quando quiser?"),
              a: t("Sim, direto na plataforma, sem multa e sem burocracia."),
            },
          ].map((f, i) => (
            <Reveal key={f.q} delay={i * 60}>
              <details className="card group">
                <summary className={`cursor-pointer list-none flex items-center justify-between gap-3 text-sm font-semibold ${FOCO}`}>
                  {f.q}
                  <ChevronDown
                    size={16}
                    className="flex-shrink-0 text-muted transition-transform duration-300 group-open:rotate-180"
                  />
                </summary>
                <p className="mt-3 text-sm text-secondary leading-relaxed">{f.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== CTA FINAL ===== */}
      <section className="max-w-[1200px] mx-auto px-6 pb-20">
        <Reveal y={34}>
          <div
            className="relative overflow-hidden rounded-2xl border border-border px-6 py-14 text-center"
            style={{
              background:
                "radial-gradient(500px circle at 50% 0%, rgba(61,123,255,0.16), transparent 70%), var(--bg-surface)",
            }}
          >
            <h2 className="font-display text-2xl sm:text-4xl font-bold">
              {t("Sua agência vai crescer. A planilha, não.")}
            </h2>
            <p className="mt-3 text-secondary max-w-md mx-auto">
              {t("Junte agenda, vendas, financeiro e contratos hoje — e passe a semana fechando shows, não caçando informação.")}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/planos"
                className={`btn text-sm px-6 py-3 text-white shadow-[0_8px_24px_-6px_rgba(61,123,255,0.5)] transition-transform hover:scale-[1.03] ${FOCO}`}
                style={{ backgroundColor: BRAND }}
              >
                {t("Começar grátis agora")}
                <ArrowRight size={16} />
              </Link>
              <Link href="/login" className={`btn btn-secondary text-sm px-6 py-3 ${FOCO}`}>
                {t("Entrar")}
              </Link>
            </div>
          </div>
        </Reveal>
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
   Chip flutuante — micro-momento do produto ao redor do hero
   ============================================================ */
function ChipFlutuante({
  icon,
  cor,
  titulo,
  sub,
}: {
  icon: React.ReactNode;
  cor: string;
  titulo: string;
  sub?: string;
}) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl border border-border bg-surface/90 backdrop-blur px-3.5 py-2.5"
      style={{ boxShadow: "0 12px 32px rgba(0,0,0,0.45)" }}
    >
      <span
        className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${cor}1f`, color: cor }}
      >
        {icon}
      </span>
      <span className="flex flex-col text-left">
        <span className="text-xs font-semibold whitespace-nowrap">{titulo}</span>
        {sub && <span className="text-[0.65rem] text-muted whitespace-nowrap">{sub}</span>}
      </span>
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
        <Reveal y={30}>
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
        </Reveal>

        {/* Mockup */}
        <Reveal y={40} delay={120}>
          <BrowserFrame legenda={legenda}>{mockup}</BrowserFrame>
        </Reveal>
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
  return <LogoGC size={small ? 24 : 30} variant="gradient" withWordmark />;
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
    <div className="card-interactive h-full">
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
    <div className="card relative h-full">
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
