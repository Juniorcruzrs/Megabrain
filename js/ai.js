/**
 * AgroSat Brasil — js/ai.js
 * --------------------------------------------------
 * Módulo de IA Analítica.
 *
 * Modo atual: heurística local determinística (sem custo, sem chave),
 * que combina os dados climáticos/solo já coletados em um texto de
 * análise e recomendações.
 *
 * Para plugar uma IA real (ex: Claude via API Anthropic):
 *   1. Crie um backend leve (Cloud Function do Firebase é suficiente)
 *      que receba os dados da área e chame a API com sua chave secreta
 *      (NUNCA exponha a chave da API no frontend).
 *   2. Troque a função `gerarAnaliseLocal` por uma chamada fetch()
 *      para esse backend, mantendo a mesma assinatura de retorno.
 */

const AgroAI = (() => {

  function classificarRisco(probabilidadeChuva, umidadeSolo){
    if (umidadeSolo < 25 && probabilidadeChuva < 20) return "Alto";
    if (umidadeSolo < 40 && probabilidadeChuva < 40) return "Moderado";
    return "Baixo";
  }

  function calcularScore({ ndvi, umidadeSolo, riscoSeca }){
    const ndviScore = Math.max(0, Math.min(100, ndvi * 100));
    const umidScore = Math.max(0, Math.min(100, umidadeSolo));
    const secaScore = riscoSeca === "Alto" ? 25 : riscoSeca === "Moderado" ? 60 : 95;
    return Math.round(ndviScore * 0.4 + umidScore * 0.35 + secaScore * 0.25);
  }

  function gerarAnaliseLocal(dados){
    const { local, temperatura, chuvaProb, ndvi, umidadeSolo, riscoSeca, tipoSolo, score } = dados;

    const linhas = [];
    linhas.push(`Análise da área${local ? " — " + local : ""}:`);
    linhas.push("");

    if (score >= 75){
      linhas.push(`O índice geral de saúde da área está em ${score}/100, classificado como BOM. As condições atuais favorecem o desenvolvimento da vegetação.`);
    } else if (score >= 45){
      linhas.push(`O índice geral de saúde da área está em ${score}/100, classificado como ATENÇÃO. Recomenda-se monitoramento mais frequente.`);
    } else {
      linhas.push(`O índice geral de saúde da área está em ${score}/100, classificado como CRÍTICO. Ação recomendada nos próximos dias.`);
    }
    linhas.push("");

    linhas.push(`• Vegetação (NDVI ${ndvi.toFixed(2)}): ${ndvi > 0.6 ? "vegetação densa e ativa" : ndvi > 0.3 ? "vegetação moderada, possível estresse hídrico" : "vegetação esparsa ou solo exposto"}.`);
    linhas.push(`• Umidade do solo (${umidadeSolo.toFixed(0)}%): ${umidadeSolo > 50 ? "adequada para a maioria das culturas" : umidadeSolo > 25 ? "abaixo do ideal — considere irrigação suplementar" : "crítica — risco de perda de produtividade"}.`);
    linhas.push(`• Temperatura (${temperatura.toFixed(1)}°C) e probabilidade de chuva (${chuvaProb}%): ${chuvaProb > 50 ? "previsão favorável de reposição hídrica nos próximos dias" : "baixa expectativa de chuva — acompanhe a irrigação"}.`);
    linhas.push(`• Risco de seca: ${riscoSeca}.`);
    linhas.push(`• Solo predominante na região: ${tipoSolo}.`);
    linhas.push("");

    linhas.push("Recomendação automática:");
    if (riscoSeca === "Alto"){
      linhas.push("Priorize irrigação ou manejo de retenção de água. Evite aplicação de defensivos que dependam de absorção foliar com baixa umidade.");
    } else if (riscoSeca === "Moderado"){
      linhas.push("Monitore a umidade do solo diariamente nos próximos 5 dias. Planeje irrigação preventiva se a previsão de chuva não se confirmar.");
    } else {
      linhas.push("Condições estáveis. Mantenha o monitoramento de rotina e aproveite a janela para atividades de manejo programadas.");
    }

    return linhas.join("\n");
  }

  return { classificarRisco, calcularScore, gerarAnaliseLocal };
})();
