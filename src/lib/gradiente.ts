/**
 * Degradê SUTIL de uma única cor — brilho leve → cor base → sombra leve, no
 * MESMO tom (ex.: vermelho→vermelho), no espírito da logo (não é de uma cor
 * pra outra). Usado nas bolinhas de cor do artista, avatares/faixas e barras
 * por-artista.
 */
export function gradienteSutil(cor: string): string {
  return `linear-gradient(135deg, color-mix(in srgb, ${cor} 74%, #ffffff), ${cor} 50%, color-mix(in srgb, ${cor} 82%, #000000))`;
}
