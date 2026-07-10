/**
 * Feature flags do produto — liga/desliga estratégias sem apagar código.
 *
 * Mantemos o código da estratégia intacto atrás do flag: basta voltar o
 * valor pra `true` pra reativar, sem reescrever nada.
 */

/**
 * Teste grátis de 7 dias.
 *
 * Quando `false` (padrão atual): o trial NÃO é oferecido em lugar nenhum do
 * funil (Etapa 2 do onboarding, subtítulo do signup) e a rota
 * `POST /api/workspace/iniciar-trial` recusa a criação. Todo mundo escolhe
 * um plano e paga. A máquina de estado do trial (acesso.ts, webhooks) segue
 * existindo pra honrar trials legados, mas nenhum novo é criado.
 *
 * Decisão do dono (2026-07-10): desligar o trial por ora; deixar pronto pra
 * um teste A/B futuro dessa estratégia — é só voltar pra `true`.
 */
export const TRIAL_ATIVADO = false;
