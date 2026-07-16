"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import LandingNav from "@/components/landing/LandingNav";
import { Check, ArrowRight, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import {
  PLANOS,
  formatarPreco,
  formatarPrecoCurto,
  precoPorMes,
  economiaAnual,
  descontoAnualPct,
  totalAnual,
  totalUsuarios,
  valorMensal,
  valorAnual,
  type CicloCobranca,
  type Plano,
} from "@/lib/planos";
import { useT, useMoeda } from "@/lib/i18n";

export default function PlanosPage() {
  const t = useT();
  const [ciclo, setCiclo] = useState<CicloCobranca>("mensal");
  const [inicio, setInicio] = useState(0);
  // Quantos cards aparecem por vez — responsivo (1 no mobile, 2 em tablet, 3 desktop)
  const [visiveis, setVisiveis] = useState(3);

  useEffect(() => {
    function ajustar() {
      const w = window.innerWidth;
      const novo = w < 640 ? 1 : w < 1024 ? 2 : 3;
      setVisiveis(novo);
      setInicio((i) => Math.min(i, Math.max(0, PLANOS.length - novo)));
    }
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, []);

  const maxInicio = Math.max(0, PLANOS.length - visiveis);
  const podeVoltar = inicio > 0;
  const podeAvancar = inicio < maxInicio;

  return (
    <div className="min-h-screen bg-main text-primary">
      {/* NAV — mesmo menu de topo da landing (links viram /#seção aqui) */}
      <LandingNav />

      {/* HEADER */}
      <section className="relative overflow-hidden max-w-[1200px] mx-auto px-6 pt-16 pb-8 text-center">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(600px circle at 50% -10%, var(--glow-hero), var(--glow-fade) 60%)",
          }}
        />
        <div className="relative">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary transition-colors mb-6"
        >
          <ArrowLeft size={13} />
          {t("Voltar")}
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          {t("Planos e preços do Gigs Control")}
        </h1>
        <p className="mt-3 text-secondary text-sm max-w-lg mx-auto">
          {t("Do artista que gere a própria carreira à agência com 50 nomes. Todos os planos incluem agenda, vendas, financeiro e contatos.")}
        </p>

        {/* Toggle Mensal / Anual */}
        <div className="mt-8 flex items-center justify-center">
          <div className="inline-flex items-center gap-1 bg-surface border border-border rounded-full p-1">
            <button
              onClick={() => setCiclo("mensal")}
              className={`text-sm font-medium px-4 py-1.5 rounded-full transition-colors ${
                ciclo === "mensal"
                  ? "bg-elevated text-primary"
                  : "text-muted hover:text-secondary"
              }`}
            >
              {t("Mensal")}
            </button>
            <button
              onClick={() => setCiclo("anual")}
              className={`text-sm font-medium px-4 py-1.5 rounded-full transition-colors inline-flex items-center gap-2 ${
                ciclo === "anual"
                  ? "bg-elevated text-primary"
                  : "text-muted hover:text-secondary"
              }`}
            >
              {t("Anual")}
              <span
                className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full text-white"
                style={{ backgroundColor: "var(--brand)" }}
              >
                {t("ECONOMIZE")}
              </span>
            </button>
          </div>
        </div>
        {ciclo === "anual" && (
          <p className="mt-3 text-xs text-muted">
            {t("Planos anuais são cobrados uma vez ao ano. Preço exibido por mês.")}
          </p>
        )}
        </div>
      </section>

      {/* CARROSSEL DE PLANOS */}
      <section className="max-w-[1200px] mx-auto px-6 pb-20">
        <div className="flex items-center gap-3">
          {/* Seta esquerda */}
          <CarrosselBtn
            direcao="esquerda"
            ativo={podeVoltar}
            onClick={() => setInicio((i) => Math.max(0, i - 1))}
          />

          {/* Janela do carrossel */}
          <div className="flex-1 overflow-hidden">
            <div
              className="flex gap-4 transition-transform duration-300 ease-smooth"
              style={{
                transform: `translateX(calc(-${inicio} * (100% / ${visiveis}) - ${inicio} * (1rem / ${visiveis})))`,
              }}
            >
              {PLANOS.map((plano) => (
                <div
                  key={plano.id}
                  className="flex-shrink-0"
                  style={{
                    width: `calc((100% - ${visiveis - 1} * 1rem) / ${visiveis})`,
                  }}
                >
                  <PlanoCard plano={plano} ciclo={ciclo} />
                </div>
              ))}
            </div>
          </div>

          {/* Seta direita */}
          <CarrosselBtn
            direcao="direita"
            ativo={podeAvancar}
            onClick={() => setInicio((i) => Math.min(maxInicio, i + 1))}
          />
        </div>

        {/* Indicadores de página */}
        <div className="flex items-center justify-center gap-1.5 mt-6">
          {Array.from({ length: maxInicio + 1 }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setInicio(idx)}
              aria-label={t("Ver planos a partir do {n}", { n: idx + 1 })}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: idx === inicio ? 24 : 8,
                backgroundColor:
                  idx === inicio ? "var(--brand)" : "var(--border-strong)",
              }}
            />
          ))}
        </div>

        {/* Dica de navegação */}
        {podeAvancar && (
          <p className="text-center text-xs text-muted mt-3">
            {t("Navegue para o lado para ver os planos Agência Plus e Agência Max →")}
          </p>
        )}

        <div className="mt-10 text-center">
          <p className="text-xs text-muted">
            {t("Precisa de mais de 50 artistas ou condições especiais?")}{" "}
            <Link
              href="/login"
              className="underline hover:text-secondary transition-colors"
            >
              {t("Fale com a gente")}
            </Link>
            .
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-surface/50">
        <div className="max-w-[800px] mx-auto px-6 py-14">
          <h2 className="text-xl font-bold text-center mb-8">{t("Perguntas frequentes")}</h2>
          <div className="flex flex-col gap-3">
            <Faq
              p={t("Qual a diferença entre mensal e anual?")}
              r={t("No plano anual você paga uma vez ao ano com um preço por mês mais baixo. No mensal, a cobrança é mês a mês com flexibilidade total.")}
            />
            <Faq
              p={t("O que conta como 'artista'?")}
              r={t("Cada DJ, cantor ou MC que você gerencia na plataforma. O plano limita quantos podem estar ativos ao mesmo tempo.")}
            />
            <Faq
              p={t("Como funciona o limite de usuários?")}
              r={t("Cada plano inclui 1 admin (você), uma cota de artistas e uma cota de usuários adicionais — produtores, vendedores e financeiro. O total de logins é a soma dos três.")}
            />
            <Faq
              p={t("Posso trocar de plano depois?")}
              r={t("Sim. Você pode subir ou descer de plano conforme a operação cresce, respeitando os limites de cada um.")}
            />
            <Faq
              p={t("Cada pessoa vê tudo?")}
              r={t("Não. O Admin controla o que cada papel acessa. Artistas, por exemplo, nunca veem dados de outros artistas.")}
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-[1200px] mx-auto px-6 py-8 text-center">
          <p className="text-xs text-muted">
            © {new Date().getFullYear()} GIGS CONTROL — {t("Gestão para a música.")}
          </p>
        </div>
      </footer>
    </div>
  );
}

// ---------- Subcomponentes ----------

function CarrosselBtn({
  direcao,
  ativo,
  onClick,
}: {
  direcao: "esquerda" | "direita";
  ativo: boolean;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <button
      onClick={onClick}
      disabled={!ativo}
      aria-label={direcao === "esquerda" ? t("Planos anteriores") : t("Próximos planos")}
      className="h-10 w-10 rounded-full border flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-25 disabled:cursor-not-allowed"
      style={{
        borderColor: ativo ? "var(--border-strong)" : "var(--border-color)",
        backgroundColor: "var(--bg-surface)",
      }}
    >
      {direcao === "esquerda" ? (
        <ChevronLeft size={18} className="text-secondary" />
      ) : (
        <ChevronRight size={18} className="text-secondary" />
      )}
    </button>
  );
}

function PlanoCard({ plano, ciclo }: { plano: Plano; ciclo: CicloCobranca }) {
  const t = useT();
  const moeda = useMoeda();
  const preco = precoPorMes(plano, ciclo, moeda);
  const desconto = descontoAnualPct(plano);
  const economia = economiaAnual(plano, moeda);

  return (
    <div
      className="card flex flex-col relative h-full"
      style={
        plano.destaque
          ? {
              borderColor: "var(--brand)",
              boxShadow: "0 0 0 1px var(--brand)",
            }
          : undefined
      }
    >
      {plano.destaque && (
        <span
          className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[0.6rem] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full text-white whitespace-nowrap"
          style={{ backgroundColor: "var(--brand)" }}
        >
          {t("Mais popular")}
        </span>
      )}

      <div className="mb-4">
        <h3 className="text-base font-bold">{plano.nome}</h3>
        <p className="text-xs text-muted mt-0.5 min-h-[2.5rem]">{plano.tagline}</p>
      </div>

      {/* Preço */}
      <div className="mb-4">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold tabular-nums">
            {formatarPreco(preco, moeda)}
          </span>
          <span className="text-xs text-muted">{t("/mês")}</span>
        </div>

        {ciclo === "anual" ? (
          <div className="mt-1.5 flex flex-col gap-0.5">
            <span className="text-[0.7rem] text-muted line-through tabular-nums">
              {formatarPreco(valorMensal(plano, moeda), moeda)}{t("/mês no mensal")}
            </span>
            <span
              className="text-[0.7rem] font-semibold"
              style={{ color: "var(--brand)" }}
            >
              {t("Economize")} {formatarPrecoCurto(economia, moeda)} {t("por ano")} ({desconto}%)
            </span>
            <span className="text-[0.7rem] text-muted">
              {formatarPrecoCurto(totalAnual(plano, moeda), moeda)} {t("cobrados no ano")}
            </span>
          </div>
        ) : (
          <div className="mt-1.5">
            <span className="text-[0.7rem] text-muted">
              {t("ou")} {formatarPreco(valorAnual(plano, moeda) / 12, moeda)}{t("/mês no plano anual")}
            </span>
          </div>
        )}
      </div>

      {/* Limites */}
      <div className="flex gap-2 mb-1">
        <div className="flex-1 bg-elevated border border-border rounded-md py-2 text-center">
          <div className="text-base font-bold tabular-nums">{plano.maxArtistas}</div>
          <div className="text-[0.6rem] text-muted uppercase tracking-wide">
            {plano.maxArtistas === 1 ? t("artista") : t("artistas")}
          </div>
        </div>
        <div className="flex-1 bg-elevated border border-border rounded-md py-2 text-center">
          <div className="text-base font-bold tabular-nums">
            {totalUsuarios(plano)}
          </div>
          <div className="text-[0.6rem] text-muted uppercase tracking-wide">
            {t("usuários")}
          </div>
        </div>
      </div>
      <p className="text-[0.65rem] text-muted mb-4 text-center">
        1 admin + {plano.maxArtistas}{" "}
        {plano.maxArtistas === 1 ? t("artista") : t("artistas")} +{" "}
        {plano.maxUsuariosAdicionais} {t("adicionais")}
      </p>

      {/* Recursos */}
      <ul className="flex flex-col gap-2 mb-6 flex-1">
        {plano.recursos.map((r) => (
          <li key={r} className="flex items-start gap-2 text-xs text-secondary">
            <Check
              size={13}
              className="flex-shrink-0 mt-0.5"
              style={{ color: "var(--brand)" }}
            />
            {r}
          </li>
        ))}
      </ul>

      <Link
        href={`/signup?plano=${plano.id}&ciclo=${ciclo}`}
        className="btn text-sm w-full justify-center"
        style={
          plano.destaque
            ? { backgroundColor: "var(--brand)", color: "#fff" }
            : {
                backgroundColor: "var(--bg-elevated)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-color)",
              }
        }
      >
        {t("Assinar")}
        <ArrowRight size={14} />
      </Link>
    </div>
  );
}

function Faq({ p, r }: { p: string; r: string }) {
  return (
    <div className="card">
      <h3 className="text-sm font-semibold mb-1">{p}</h3>
      <p className="text-xs text-secondary leading-relaxed">{r}</p>
    </div>
  );
}
