/**
 * Rolagem programática respeitando "reduzir movimento" do sistema: suave por
 * padrão; instantânea pra quem pediu menos movimento (a rolagem suave longa
 * é das animações que mais incomodam quem tem sensibilidade vestibular).
 */
export function comportamentoRolagem(): ScrollBehavior {
  if (typeof window === "undefined" || !window.matchMedia) return "auto";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
