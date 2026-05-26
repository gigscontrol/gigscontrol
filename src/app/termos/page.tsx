import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Placeholder de Termos de Uso.
 *
 * Substitua o texto abaixo pela versão definitiva (idealmente revisada
 * por um advogado). Por enquanto serve como link válido no checkbox do
 * signup pra cumprir o requisito de UX e LGPD.
 */
export default function TermosPage() {
  return (
    <div className="min-h-screen bg-main text-primary">
      <nav className="border-b border-border">
        <div className="max-w-[800px] mx-auto flex items-center justify-between px-6 h-16">
          <Link href="/" className="flex items-center gap-2">
            <div
              className="rounded-md flex items-center justify-center font-bold text-white h-7 w-7 text-sm"
              style={{ backgroundColor: "var(--module-vendas)" }}
            >
              G
            </div>
            <span className="font-bold tracking-tight text-base">
              GIGS<span className="text-muted"> CONTROL</span>
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary transition-colors"
          >
            <ArrowLeft size={13} />
            Voltar ao site
          </Link>
        </div>
      </nav>

      <article className="max-w-[800px] mx-auto px-6 py-12 prose prose-invert">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Termos de Uso</h1>
        <p className="text-xs text-muted mb-8">
          Última atualização: 26 de maio de 2026
        </p>

        <Secao titulo="1. Aceitação dos termos">
          Ao criar uma conta no GIGS CONTROL você concorda com estes Termos de
          Uso e com a Política de Privacidade. Se não concordar, não use o
          serviço.
        </Secao>

        <Secao titulo="2. Sobre o serviço">
          O GIGS CONTROL é uma plataforma de gestão para agências, artistas e
          equipes que trabalham com música. Oferece agenda, orçamentos,
          vendas, controle financeiro e cadastro de contatos.
        </Secao>

        <Secao titulo="3. Conta e segurança">
          Você é responsável por manter o sigilo da sua senha e por toda
          atividade realizada na sua conta. Avise imediatamente caso suspeite
          de acesso indevido.
        </Secao>

        <Secao titulo="4. Conteúdo do usuário">
          Você é o único responsável pelas informações cadastradas (artistas,
          contratos, valores, contatos). Não publicamos esses dados — eles
          ficam disponíveis apenas pra você e pra sua equipe.
        </Secao>

        <Secao titulo="5. Pagamentos e planos">
          Os preços de cada plano estão na página de Planos. A cobrança é
          recorrente conforme o ciclo escolhido (mensal ou anual). Sem
          fidelidade — cancele quando quiser.
        </Secao>

        <Secao titulo="6. Cancelamento e exclusão de conta">
          Você pode cancelar a assinatura ou excluir sua conta a qualquer
          momento pelas Configurações. Dados ficam por 30 dias na lixeira
          recuperável e por mais 180 dias em backup, antes de remoção
          definitiva.
        </Secao>

        <Secao titulo="7. Limitação de responsabilidade">
          O GIGS CONTROL é fornecido como está. Não nos responsabilizamos por
          perdas indiretas decorrentes do uso da plataforma. Recomendamos que
          você mantenha backups das informações críticas.
        </Secao>

        <Secao titulo="8. Mudanças nos termos">
          Estes termos podem ser atualizados ocasionalmente. Em mudanças
          relevantes, notificaremos por email com antecedência.
        </Secao>

        <Secao titulo="9. Contato">
          Dúvidas? Entre em contato pelo email{" "}
          <a href="mailto:contato@gigscontrol.com.br" className="text-primary underline">
            contato@gigscontrol.com.br
          </a>
          .
        </Secao>
      </article>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-primary mb-2">{titulo}</h2>
      <p className="text-sm text-secondary leading-relaxed">{children}</p>
    </section>
  );
}
