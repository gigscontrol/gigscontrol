/**
 * CATÁLOGO DE PERMISSÕES (fonte da verdade, versionável).
 *
 * Modelo novo: as permissões são por VÍNCULO (usuário × artista), semeadas por
 * um perfil (preset) e personalizáveis por checkbox. Este arquivo lista TODAS as
 * permissões possíveis. Adicionar módulo/permissão no futuro = só estender aqui.
 *
 * `nivel`:
 *   - "artista"   → a permissão vale POR artista (vai no vínculo membros_artista).
 *   - "workspace" → é administrativa da agência (não é por-artista; gestão global).
 *
 * `existe`: true = já há operação real no app que essa chave protege (dá pra
 * fazer enforcement hoje). false = "slot" pronto pra quando a feature nascer
 * (aparece no editor marcado "(em breve)"). Mantido à prova de futuro.
 */

import { SETORES_AGENDA } from "./setoresAgenda";

export type ModuloPermissao =
  | "agenda"
  | "vendas"
  | "financeiro"
  | "contratos"
  | "contatos"
  | "anotacoes"
  | "agencia";

export type NivelPermissao = "artista" | "workspace";

export type Permissao = {
  chave: string;
  modulo: ModuloPermissao;
  nivel: NivelPermissao;
  label: string;
  existe: boolean;
};

export const MODULOS: { id: ModuloPermissao; label: string }[] = [
  { id: "agenda", label: "Agenda" },
  { id: "vendas", label: "Vendas" },
  { id: "financeiro", label: "Financeiro" },
  { id: "contratos", label: "Contratos" },
  { id: "contatos", label: "Contatos" },
  { id: "anotacoes", label: "Anotações" },
  { id: "agencia", label: "Agência" },
];

export const CATALOGO: Permissao[] = [
  // ---------------- AGENDA (por artista) ----------------
  //
  // ⚠️ MUDANÇA DE SIGNIFICADO — L5 (agenda vira SÓ VISUALIZAÇÃO de SHOW).
  // Até aqui, `agenda.editar_todos` era a chave que cancelava e editava SHOW, e
  // `agenda.criar` era a que criava SHOW. NÃO É MAIS:
  //
  //   criar show     → vendas.criar_venda
  //   editar show    → vendas.editar_venda (próprios) | vendas.editar_todos
  //   cancelar show  → vendas.cancelar_venda | vendas.editar_todos
  //   excluir show   → vendas.excluir_venda | vendas.editar_todos
  //
  // As chaves de agenda abaixo continuam existindo e continuam sendo enforçadas,
  // porém APENAS sobre os ITENS DE AGENDA (agenda_items: voo, transporte
  // terrestre e evento personalizado) — que é justamente o que "Acesso total"
  // na agenda passa a poder criar/editar/excluir.
  //
  // REVOGAÇÃO DELIBERADA: quem hoje tem `agenda.editar_todos` e NENHUMA chave de
  // vendas PERDE cancelar/editar show; quem tem `agenda.criar` sem
  // `vendas.criar_venda` PERDE "Novo Show". Presets afetados: ver perfis.ts
  // (equipe/manager). Isto foi pedido pelo dono: mexer em show é papel de quem
  // tem permissão de VENDAS.
  // LEGADO — a leitura da agenda virou UMA CHAVE POR SETOR (setoresAgenda.ts).
  // Estas duas continuam VÁLIDAS porque há vínculos gravados com elas; são
  // expandidas nos setores equivalentes na leitura da sessão
  // (`expandirLegadoAgenda`), nos dois lados. Não gravar mais.
  { chave: "agenda.ver", modulo: "agenda", nivel: "artista", label: "Ver agenda — básico (legado)", existe: true },
  { chave: "agenda.ver_detalhado", modulo: "agenda", nivel: "artista", label: "Ver agenda — completo (legado)", existe: true },
  // Um item por SETOR da ficha do show — a fonte é `setoresAgenda.ts`.
  ...SETORES_AGENDA.map((s) => ({
    chave: s.chave,
    modulo: "agenda" as const,
    nivel: "artista" as const,
    label: `Ver na agenda — ${s.label}`,
    existe: true,
  })),
  { chave: "agenda.criar", modulo: "agenda", nivel: "artista", label: "Criar voo, transporte terrestre e evento personalizado", existe: true },
  { chave: "agenda.editar", modulo: "agenda", nivel: "artista", label: "Editar os voos/transportes/eventos que ele criou", existe: true },
  { chave: "agenda.editar_todos", modulo: "agenda", nivel: "artista", label: "Editar qualquer voo/transporte/evento", existe: true },
  { chave: "agenda.excluir", modulo: "agenda", nivel: "artista", label: "Excluir os voos/transportes/eventos que ele criou", existe: true },
  { chave: "agenda.excluir_todos", modulo: "agenda", nivel: "artista", label: "Excluir qualquer voo/transporte/evento", existe: true },

  // ---------------- VENDAS (por artista) ----------------
  { chave: "vendas.ver", modulo: "vendas", nivel: "artista", label: "Ver vendas", existe: true },
  // Granularidade: ver a lista de ORÇAMENTOS separada da de vendas (no artista,
  // lê privacidade.orcamentosVer; na equipe, chave própria por vínculo).
  { chave: "vendas.ver_orcamentos", modulo: "vendas", nivel: "artista", label: "Ver orçamentos", existe: true },
  { chave: "vendas.ver_proprios", modulo: "vendas", nivel: "artista", label: "Ver só as vendas que ele criou", existe: true },
  { chave: "vendas.criar_orcamento", modulo: "vendas", nivel: "artista", label: "Criar orçamento", existe: true },
  { chave: "vendas.editar_orcamento", modulo: "vendas", nivel: "artista", label: "Editar orçamento", existe: true },
  { chave: "vendas.excluir_orcamento", modulo: "vendas", nivel: "artista", label: "Excluir orçamento", existe: true },
  { chave: "vendas.converter", modulo: "vendas", nivel: "artista", label: "Converter orçamento em venda", existe: true },
  { chave: "vendas.criar_venda", modulo: "vendas", nivel: "artista", label: "Criar venda", existe: true },
  { chave: "vendas.editar_venda", modulo: "vendas", nivel: "artista", label: "Editar venda", existe: true },
  { chave: "vendas.cancelar_venda", modulo: "vendas", nivel: "artista", label: "Cancelar venda", existe: true },
  { chave: "vendas.excluir_venda", modulo: "vendas", nivel: "artista", label: "Excluir venda", existe: true },
  { chave: "vendas.editar_todos", modulo: "vendas", nivel: "artista", label: "Editar todas as vendas (não só as que ele criou) — legado", existe: true },
  // --- VENDAS v2 (autoria: criado por ele × criado por outros). As chaves acima
  // viram LEGADO: seguem no catálogo (válidas) mas os presets/gates usam estas.
  // `expandirLegadoEquipe` traduz as antigas nestas na leitura. ---
  { chave: "vendas.criar", modulo: "vendas", nivel: "artista", label: "Criar orçamento e venda (converte os próprios, vê o que criou)", existe: true },
  { chave: "vendas.editar_proprios", modulo: "vendas", nivel: "artista", label: "Editar venda criada por ele", existe: true },
  { chave: "vendas.cancelar_proprios", modulo: "vendas", nivel: "artista", label: "Cancelar venda criada por ele", existe: true },
  { chave: "vendas.ver_outros", modulo: "vendas", nivel: "artista", label: "Ver orçamento e venda criada por outros", existe: true },
  { chave: "vendas.editar_outros", modulo: "vendas", nivel: "artista", label: "Editar venda criada por outros", existe: true },
  { chave: "vendas.converter_outros", modulo: "vendas", nivel: "artista", label: "Converter orçamento criado por outros em venda", existe: true },
  { chave: "vendas.cancelar_outros", modulo: "vendas", nivel: "artista", label: "Cancelar venda criada por outros", existe: true },

  // ---------------- FINANCEIRO (por artista) ----------------
  // Hoje o app controla parcelas/pagamentos das vendas. Receita/despesa/
  // comissão/aprovação ainda não existem como operação → slots (existe:false).
  // ver_caches e ver_pagamentos FUNDIDAS aqui (chave única): ver o financeiro
  // = ver cachês e pagamentos. As duas chaves antigas foram removidas do catálogo.
  { chave: "financeiro.ver", modulo: "financeiro", nivel: "artista", label: "Ver o financeiro (caches, pagamentos e taxa/líquido)", existe: true },
  { chave: "financeiro.ver_saldo", modulo: "financeiro", nivel: "artista", label: "Ver o saldo", existe: false },
  { chave: "financeiro.ver_despesas", modulo: "financeiro", nivel: "artista", label: "Ver as despesas", existe: false },
  { chave: "financeiro.ver_comissoes", modulo: "financeiro", nivel: "artista", label: "Ver as comissões", existe: false },
  { chave: "financeiro.registrar_pagamento", modulo: "financeiro", nivel: "artista", label: "Registrar pagamento", existe: true },
  { chave: "financeiro.editar_pagamento", modulo: "financeiro", nivel: "artista", label: "Editar pagamento", existe: true },
  { chave: "financeiro.cancelar_pagamento", modulo: "financeiro", nivel: "artista", label: "Desfazer/cancelar pagamento", existe: true },
  { chave: "financeiro.registrar_recebimento", modulo: "financeiro", nivel: "artista", label: "Registrar recebimento", existe: false },
  { chave: "financeiro.criar_receita", modulo: "financeiro", nivel: "artista", label: "Lançar receita", existe: false },
  { chave: "financeiro.criar_despesa", modulo: "financeiro", nivel: "artista", label: "Lançar despesa", existe: false },
  { chave: "financeiro.editar_receita", modulo: "financeiro", nivel: "artista", label: "Editar receita", existe: false },
  { chave: "financeiro.editar_despesa", modulo: "financeiro", nivel: "artista", label: "Editar despesa", existe: false },
  { chave: "financeiro.excluir_lancamento", modulo: "financeiro", nivel: "artista", label: "Excluir lançamento", existe: false },
  { chave: "financeiro.aprovar_pagamento", modulo: "financeiro", nivel: "artista", label: "Aprovar pagamento", existe: false },
  { chave: "financeiro.aprovar_recebimento", modulo: "financeiro", nivel: "artista", label: "Aprovar recebimento", existe: false },
  // --- FINANCEIRO v2 (autoria via VENDA-mãe: parcela.venda_id → vendas.criado_por/
  // artist_id). "Editar o financeiro" INCLUI cancelar/baixar parcela. Taxa da
  // agência FORA. As chaves antigas (ver/registrar/editar/cancelar_pagamento)
  // viram legado e são expandidas nestas na leitura. ---
  { chave: "financeiro.ver_proprios", modulo: "financeiro", nivel: "artista", label: "Ver o financeiro da venda criada por ele", existe: true },
  { chave: "financeiro.editar_proprios", modulo: "financeiro", nivel: "artista", label: "Editar o financeiro da venda criada por ele (inclui cancelar/baixar parcela)", existe: true },
  { chave: "financeiro.informar_proprios", modulo: "financeiro", nivel: "artista", label: "Informar o pagamento da venda criada por ele", existe: true },
  { chave: "financeiro.fixar_proprios", modulo: "financeiro", nivel: "artista", label: "Fixar a cobrança da venda criada por ele", existe: true },
  { chave: "financeiro.ver_outros", modulo: "financeiro", nivel: "artista", label: "Ver o financeiro da venda criada por outros", existe: true },
  { chave: "financeiro.editar_outros", modulo: "financeiro", nivel: "artista", label: "Editar o financeiro da venda criada por outros (inclui cancelar/baixar parcela)", existe: true },
  { chave: "financeiro.informar_outros", modulo: "financeiro", nivel: "artista", label: "Informar o pagamento da venda criada por outros", existe: true },
  { chave: "financeiro.fixar_outros", modulo: "financeiro", nivel: "artista", label: "Fixar a cobrança da venda criada por outros", existe: true },

  // ---------------- CONTRATOS (por artista) — sem "assinar" ----------------
  // Assinar é feito pelo contratante via link gerado (fluxo /assinar/[token]),
  // não é ação de membro da equipe.
  { chave: "contratos.ver", modulo: "contratos", nivel: "artista", label: "Ver contratos — legado", existe: true },
  // contratos.criar sobrevive como chave v2 (EMBUTE ver os que ele criou +
  // gerar a partir de modelo). Serve de própria-autoria pra ver/editar o próprio.
  { chave: "contratos.criar", modulo: "contratos", nivel: "artista", label: "Criar contrato (inclui ver os que criou e gerar de modelo)", existe: true },
  { chave: "contratos.editar", modulo: "contratos", nivel: "artista", label: "Editar contrato — legado", existe: true },
  { chave: "contratos.cancelar", modulo: "contratos", nivel: "artista", label: "Cancelar contrato — legado", existe: true },
  // contratos.excluir REMOVIDO do catálogo: excluir contrato = admin-only
  // assumido, não delegável (some do editor e do pacote do artista). O
  // enforcement de exclusão trata admin direto, sem passar por chave.
  { chave: "contratos.editar_todos", modulo: "contratos", nivel: "artista", label: "Editar todos os contratos — legado", existe: true },
  // --- CONTRATOS v2 (autoria = contratos.criado_por; artista via venda_id →
  // vendas.artist_id). Excluir contrato gerado segue admin-only. ---
  { chave: "contratos.cancelar_proprios", modulo: "contratos", nivel: "artista", label: "Cancelar contrato criado por ele", existe: true },
  { chave: "contratos.ver_outros", modulo: "contratos", nivel: "artista", label: "Ver contrato criado por outros", existe: true },
  { chave: "contratos.cancelar_outros", modulo: "contratos", nivel: "artista", label: "Cancelar contrato criado por outros", existe: true },
  // Modelo de contrato = molde reutilizável (workspace-level; a chave mora no
  // vínculo e o gate usa a UNIÃO dos vínculos). ≠ excluir um contrato gerado.
  { chave: "contratos.criar_modelo", modulo: "contratos", nivel: "artista", label: "Criar modelo de contrato", existe: true },
  { chave: "contratos.excluir_modelo", modulo: "contratos", nivel: "artista", label: "Excluir modelo de contrato", existe: true },

  // ---------------- CONTATOS (por artista) ----------------
  // Escopo de visualização: todos OU só os que o próprio criou.
  { chave: "contatos.ver", modulo: "contatos", nivel: "artista", label: "Ver todos os contatos — legado", existe: true },
  // contatos.ver_proprios e contatos.criar sobrevivem como chaves v2.
  { chave: "contatos.ver_proprios", modulo: "contatos", nivel: "artista", label: "Ver contato criado por ele", existe: true },
  { chave: "contatos.criar", modulo: "contatos", nivel: "artista", label: "Criar contato", existe: true },
  { chave: "contatos.editar", modulo: "contatos", nivel: "artista", label: "Editar contato — legado", existe: true },
  { chave: "contatos.excluir", modulo: "contatos", nivel: "artista", label: "Excluir contato — legado", existe: true },
  // --- CONTATOS v2 (contratantes E casas; workspace-level → gate por UNIÃO dos
  // vínculos; autoria = criado_por, nulo = "de outros"). "Editar" cobre atualizar. ---
  { chave: "contatos.editar_proprios", modulo: "contatos", nivel: "artista", label: "Editar contato criado por ele", existe: true },
  { chave: "contatos.excluir_proprios", modulo: "contatos", nivel: "artista", label: "Excluir contato criado por ele", existe: true },
  { chave: "contatos.ver_outros", modulo: "contatos", nivel: "artista", label: "Ver contato criado por outros", existe: true },
  { chave: "contatos.editar_outros", modulo: "contatos", nivel: "artista", label: "Editar contato criado por outros", existe: true },
  { chave: "contatos.excluir_outros", modulo: "contatos", nivel: "artista", label: "Excluir contato criado por outros", existe: true },
  // Sem rota implementada ainda (achado só referência na página de Privacidade,
  // texto de política — não há endpoint de exportação real). Slot futuro.
  { chave: "contatos.exportar", modulo: "contatos", nivel: "artista", label: "Exportar contatos", existe: false },

  // ---------------- ANOTAÇÕES (por artista) ----------------
  // A nota carrega `artist_id` (etiqueta de artista) — é esse campo que amarra
  // a permissão ao vínculo. ZERO migration: as chaves moram no jsonb
  // membros_artista.permissoes, como as dos outros módulos.
  //
  // COMPATIBILIDADE (importante): até aqui anotações eram governadas por um
  // BOOLEANO GLOBAL (profiles.pode_criar_anotacoes → sessao.podeCriarAnotacoes)
  // e a leitura ficava só com a RLS. As chaves abaixo NÃO revogam nada de quem
  // já tinha acesso — o gate (src/lib/api/permissoes.ts) soma o legado em OU e
  // só passa a filtrar por chave quando o admin de fato configurou alguma
  // `anotacoes.*` no vínculo. Ver `governadoPorChavesAnotacoes`.
  { chave: "anotacoes.ver", modulo: "anotacoes", nivel: "artista", label: "Ver anotações", existe: true },
  { chave: "anotacoes.criar", modulo: "anotacoes", nivel: "artista", label: "Criar anotação", existe: true },
  { chave: "anotacoes.editar", modulo: "anotacoes", nivel: "artista", label: "Editar as anotações (mesmo as de outros)", existe: true },
  { chave: "anotacoes.excluir", modulo: "anotacoes", nivel: "artista", label: "Excluir as anotações (mesmo as de outros)", existe: true },

  // ---------------- AGÊNCIA (workspace — administrativo, NÃO por-artista) ----------------
  // Gestão da agência é ADMIN-ONLY ASSUMIDO — não delegável. Todas marcadas
  // existe:false de propósito: não há enforcement por CHAVE do catálogo (o
  // admin/super-admin passa direto no motor) e elas NÃO aparecem no editor de
  // permissões por-artista. Ficam listadas só para documentar o universo.
  { chave: "agencia.criar_artista", modulo: "agencia", nivel: "workspace", label: "Criar artista", existe: false }, // admin-only assumido — não delegável
  { chave: "agencia.editar_artista", modulo: "agencia", nivel: "workspace", label: "Editar artista", existe: false }, // admin-only assumido — não delegável
  { chave: "agencia.excluir_artista", modulo: "agencia", nivel: "workspace", label: "Excluir artista", existe: false }, // admin-only assumido — não delegável
  { chave: "agencia.criar_usuario", modulo: "agencia", nivel: "workspace", label: "Criar usuários", existe: false }, // admin-only assumido — não delegável
  { chave: "agencia.editar_usuario", modulo: "agencia", nivel: "workspace", label: "Editar usuários", existe: false }, // admin-only assumido — não delegável
  { chave: "agencia.excluir_usuario", modulo: "agencia", nivel: "workspace", label: "Excluir usuários", existe: false }, // admin-only assumido — não delegável
  { chave: "agencia.alterar_permissoes", modulo: "agencia", nivel: "workspace", label: "Alterar permissões", existe: false }, // admin-only assumido — não delegável
  { chave: "agencia.criar_perfil", modulo: "agencia", nivel: "workspace", label: "Criar perfis", existe: false }, // admin-only assumido — não delegável
  { chave: "agencia.editar_perfil", modulo: "agencia", nivel: "workspace", label: "Editar perfis", existe: false }, // admin-only assumido — não delegável
  { chave: "agencia.config_agencia", modulo: "agencia", nivel: "workspace", label: "Configurações da agência", existe: false }, // admin-only assumido — não delegável
  { chave: "agencia.ver_lixeira", modulo: "agencia", nivel: "workspace", label: "Ver e restaurar itens da lixeira", existe: false }, // admin-only assumido — não delegável
  { chave: "agencia.ver_historico", modulo: "agencia", nivel: "workspace", label: "Ver o histórico/auditoria do workspace", existe: false }, // admin-only assumido — não delegável

  // ---------------- AGÊNCIA — anotações (workspace, permissão formal) ----------------
  // INTEGRADA ao modelo (D7): permissão workspace-level real, editável no modal
  // do usuário. O enforcement lê profiles.pode_criar_anotacoes
  // (sessao.podeCriarAnotacoes) — zero migration. existe:true porque há operação
  // real que ela protege (criar pastas de anotações).
  { chave: "agencia.criar_pastas_anotacoes", modulo: "agencia", nivel: "workspace", label: "Criar pastas de anotações", existe: true },
];

/** Set de todas as chaves válidas (validação rápida). */
export const CHAVES_VALIDAS: ReadonlySet<string> = new Set(CATALOGO.map((p) => p.chave));

/**
 * Só as chaves de NÍVEL ARTISTA — as únicas que podem ir num VÍNCULO
 * (membros_artista). Fonte única da verdade: qualquer validação de permissão
 * por-artista (schema de vínculo, criação de usuário, serviço de equipe) deve
 * consumir ESTE set, para que chaves administrativas de workspace (agencia.*)
 * NUNCA sejam gravadas num vínculo por-artista.
 */
export const CHAVES_ARTISTA_VALIDAS: ReadonlySet<string> = new Set(
  CATALOGO.filter((p) => p.nivel === "artista").map((p) => p.chave)
);
