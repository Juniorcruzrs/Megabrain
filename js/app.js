/**
 * AgroSat Brasil — js/app.js
 * --------------------------------------------------
 * Orquestrador principal: navegação entre módulos, busca de área,
 * integração real com Open-Meteo (clima/histórico) e Nominatim
 * (geocodificação), dashboard, alertas, relatórios e marketplace.
 */

const AgroApp = (() => {

  let state = {
    lat: null,
    lng: null,
    label: null,
    clima: null,
    historico: null,
    soloSeed: 0
  };

  let chartHist = null;
  let chartChuva = null;

  // ---------------------------------------------------------
  // UTIL
  // ---------------------------------------------------------
  function toast(msg, ms = 2600){
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("is-show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("is-show"), ms);
  }

  function setText(id, val){
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function seedFromCoords(lat, lng){
    return Math.abs(Math.round((lat * 1000 + lng * 1000)));
  }

  // Classificação simplificada de bioma/solo por faixa de latitude/longitude.
  // É uma heurística geográfica simples (não substitui levantamento pedológico real),
  // útil para dar contexto imediato no protótipo.
  function classificarSolo(lat, lng){
    if (lat > -2 && lng < -55) return "Latossolo Amazônico (floresta)";
    if (lat <= -2 && lat > -10 && lng < -50) return "Latossolo / Argissolo (transição Amazônia-Cerrado)";
    if (lat <= -10 && lat > -24 && lng < -45) return "Latossolo Vermelho (Cerrado)";
    if (lat <= -24 && lat > -34) return "Argissolo / Nitossolo (Pampa/Sul)";
    if (lat <= -2 && lng >= -45) return "Neossolo / Luvissolo (Caatinga)";
    if (lat <= -10 && lng >= -45 && lng < -34) return "Latossolo Costeiro (Mata Atlântica)";
    return "Latossolo Misto";
  }

  function riscoSecaTexto(prob, umidade){
    return AgroAI.classificarRisco(prob, umidade);
  }

  // ---------------------------------------------------------
  // NAVEGAÇÃO
  // ---------------------------------------------------------
  function initNav(){
    document.querySelectorAll(".navitem[data-view]").forEach(btn => {
      btn.addEventListener("click", () => switchView(btn.dataset.view));
    });

    document.getElementById("btnBurger").addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("is-open");
    });
  }

  const titles = {
    dashboard: "Dashboard",
    mapa: "Mapa Satelital",
    alertas: "Alertas Climáticos",
    historico: "Histórico",
    relatorios: "Relatórios",
    ia: "IA Analítica",
    marketplace: "Marketplace Rural"
  };

  function switchView(view){
    document.querySelectorAll(".navitem[data-view]").forEach(b => b.classList.toggle("is-active", b.dataset.view === view));
    document.querySelectorAll(".view").forEach(v => v.classList.remove("is-active"));
    document.getElementById("view-" + view).classList.add("is-active");
    setText("viewTitle", titles[view] || view);
    document.getElementById("sidebar").classList.remove("is-open");

    if (view === "mapa"){
      AgroMap.init();
      AgroMap.invalidate();
    }
    if (view === "historico" && state.lat !== null){
      loadHistorico();
    }
  }

  // ---------------------------------------------------------
  // TEMA
  // ---------------------------------------------------------
  function initTheme(){
    const saved = localStorage.getItem("agrosat_theme") || "dark";
    document.body.dataset.theme = saved;
    updateThemeLabel();
    document.getElementById("btnTheme").addEventListener("click", () => {
      const next = document.body.dataset.theme === "dark" ? "light" : "dark";
      document.body.dataset.theme = next;
      localStorage.setItem("agrosat_theme", next);
      updateThemeLabel();
    });
  }
  function updateThemeLabel(){
    const isDark = document.body.dataset.theme === "dark";
    document.querySelector("#btnTheme span").textContent = isDark ? "Modo claro" : "Modo escuro";
  }

  // ---------------------------------------------------------
  // BUSCA (coordenadas / endereço / CPF-CNPJ)
  // ---------------------------------------------------------
  function initSearch(){
    document.querySelectorAll(".stab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".stab").forEach(t => t.classList.remove("is-active"));
        tab.classList.add("is-active");
        document.querySelectorAll(".searchbar__field").forEach(f => f.classList.add("is-hidden"));
        document.querySelector(`.searchbar__field[data-field="${tab.dataset.mode}"]`).classList.remove("is-hidden");

        const hint = document.getElementById("searchHint");
        if (tab.dataset.mode === "coord") hint.textContent = "Apenas coordenadas dentro do território brasileiro são aceitas.";
        if (tab.dataset.mode === "endereco") hint.textContent = "Busca via OpenStreetMap, restrita a endereços no Brasil.";
        if (tab.dataset.mode === "doc") hint.textContent = "Modo demonstrativo — qualquer CPF/CNPJ com formato válido é aceito nesta versão.";
      });
    });

    document.getElementById("searchForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const mode = document.querySelector(".stab.is-active").dataset.mode;
      const btn = document.getElementById("btnBuscar");
      btn.disabled = true;
      const original = btn.innerHTML;
      btn.innerHTML = "Analisando…";

      try {
        if (mode === "coord") await buscarPorCoordenadas();
        else if (mode === "endereco") await buscarPorEndereco();
        else await buscarPorDocumento();
      } catch (err){
        toast(err.message || "Erro ao buscar área.");
      } finally {
        btn.disabled = false;
        btn.innerHTML = original;
      }
    });
  }

  async function buscarPorCoordenadas(){
    const lat = parseFloat(document.getElementById("inputLat").value.replace(",", "."));
    const lng = parseFloat(document.getElementById("inputLng").value.replace(",", "."));
    if (isNaN(lat) || isNaN(lng)) throw new Error("Informe latitude e longitude válidas.");
    if (!AgroMap.isInsideBrasil(lat, lng)) throw new Error("Coordenada fora do território brasileiro.");
    await selecionarArea(lat, lng, `Lat ${lat.toFixed(4)}, Lng ${lng.toFixed(4)}`);
  }

  async function buscarPorEndereco(){
    const q = document.getElementById("inputEndereco").value.trim();
    if (!q) throw new Error("Digite um endereço ou cidade.");
    const url = `${AGROSAT_CONFIG.apis.nominatim}?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
    if (!res.ok) throw new Error("Falha ao consultar o serviço de endereços.");
    const data = await res.json();
    if (!data.length) throw new Error("Endereço não encontrado no território brasileiro.");
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (!AgroMap.isInsideBrasil(lat, lng)) throw new Error("Endereço encontrado está fora do território brasileiro.");
    await selecionarArea(lat, lng, data[0].display_name.split(",").slice(0,3).join(","));
  }

  async function buscarPorDocumento(){
    const doc = document.getElementById("inputDoc").value.trim();
    const limpo = doc.replace(/\D/g, "");
    if (limpo.length !== 11 && limpo.length !== 14) throw new Error("CPF deve ter 11 dígitos ou CNPJ 14 dígitos.");
    // DEMO: sem base real de CPF/CNPJ x propriedade conectada ainda.
    // Em produção, este passo consultaria uma base autorizada (ex: CAR — Cadastro Ambiental Rural)
    // para localizar a área vinculada ao documento.
    toast("Modo demonstrativo: nenhuma base de CPF/CNPJ x propriedade conectada ainda. Usando área de exemplo.");
    const lat = -12.5 + (Math.random() - 0.5) * 4;
    const lng = -47 + (Math.random() - 0.5) * 6;
    await selecionarArea(lat, lng, `Propriedade vinculada a ${doc} (demo)`);
  }

  function onMapClick(lat, lng){
    if (!AgroMap.isInsideBrasil(lat, lng)){
      toast("Ponto fora do território brasileiro — selecione uma área dentro do Brasil.");
      return;
    }
    selecionarArea(lat, lng, `Lat ${lat.toFixed(4)}, Lng ${lng.toFixed(4)}`);
  }

  async function selecionarArea(lat, lng, label){
    state.lat = lat;
    state.lng = lng;
    state.label = label;
    state.soloSeed = seedFromCoords(lat, lng);

    const r = AgroMap.setPoint(lat, lng, label);
    if (!r.ok) { toast("Ponto fora do território brasileiro."); return; }

    setText("locLabelDash", label);
    setText("locLabelHist", label);

    await loadClima(lat, lng);
    renderDashboard();
    renderAlertas();
    switchView("dashboard");
    toast("Área analisada: " + label);
  }

  // ---------------------------------------------------------
  // CLIMA (Open-Meteo — dados reais)
  // ---------------------------------------------------------
  async function loadClima(lat, lng){
    const url = `${AGROSAT_CONFIG.apis.openMeteoBase}?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,relative_humidity_2m,precipitation` +
      `&daily=precipitation_probability_max,temperature_2m_max,temperature_2m_min,precipitation_sum` +
      `&timezone=auto&forecast_days=7`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("Falha ao consultar dados climáticos.");
    const data = await res.json();
    state.clima = data;
    return data;
  }

  // ---------------------------------------------------------
  // DASHBOARD
  // ---------------------------------------------------------
  function renderDashboard(){
    const c = state.clima;
    if (!c) return;

    const temp = c.current.temperature_2m;
    const umidadeAr = c.current.relative_humidity_2m;
    const chuvaProb = c.daily.precipitation_probability_max[0] ?? 0;

    // Estimativas derivadas (não há sensor de solo público gratuito para todo o Brasil;
    // estas métricas são modeladas a partir de clima + variação local determinística).
    const seedFrac = (state.soloSeed % 100) / 100;
    const umidadeSolo = Math.max(8, Math.min(85, umidadeAr * 0.6 + chuvaProb * 0.25 + seedFrac * 10));
    const ndvi = Math.max(0.05, Math.min(0.92, 0.35 + (umidadeSolo/100)*0.4 + seedFrac*0.15));
    const tipoSolo = classificarSolo(state.lat, state.lng);
    const risco = riscoSecaTexto(chuvaProb, umidadeSolo);

    const score = AgroAI.calcularScore({ ndvi, umidadeSolo, riscoSeca: risco });

    setText("heroScore", score);
    setText("heroDesc", `Índice combinado de vegetação, umidade e risco de seca para a área selecionada.`);
    document.getElementById("barNdvi").style.width = (ndvi*100) + "%";
    document.getElementById("barUmidade").style.width = umidadeSolo + "%";
    document.getElementById("barSeca").style.width = (risco === "Alto" ? 80 : risco === "Moderado" ? 50 : 20) + "%";

    setText("metricTemp", temp.toFixed(1) + "°C");
    setText("metricTempSub", `umidade do ar ${umidadeAr}%`);

    setText("metricChuva", chuvaProb + "%");
    setText("metricChuvaSub", "probabilidade nas próximas 24h");

    setText("metricSolo", tipoSolo);
    setText("metricSoloSub", "classificação por bioma/região");

    setText("metricUmidade", umidadeSolo.toFixed(0) + "%");
    setText("metricNdvi", ndvi.toFixed(2));
    setText("metricNdviSub", ndvi > 0.6 ? "vegetação densa" : ndvi > 0.3 ? "vegetação moderada" : "vegetação esparsa");
    setText("metricSeca", risco);

    // forecast 7 dias
    const row = document.getElementById("forecastRow");
    row.innerHTML = "";
    const dias = c.daily.time;
    dias.forEach((d, i) => {
      const dt = new Date(d + "T12:00:00");
      const diaSemana = dt.toLocaleDateString("pt-BR", { weekday: "short" });
      const tmax = c.daily.temperature_2m_max[i];
      const prob = c.daily.precipitation_probability_max[i] ?? 0;
      const div = document.createElement("div");
      div.className = "fday";
      div.innerHTML = `<div class="fday__d">${diaSemana}</div><div class="fday__t">${tmax.toFixed(0)}°</div><div class="fday__r">${prob}% chuva</div>`;
      row.appendChild(div);
    });

    state.derived = { temp, umidadeAr, chuvaProb, umidadeSolo, ndvi, tipoSolo, risco, score };
  }

  // ---------------------------------------------------------
  // ALERTAS (heurística baseada nos dados reais carregados)
  // ---------------------------------------------------------
  function renderAlertas(){
    const list = document.getElementById("alertList");
    list.innerHTML = "";
    const d = state.derived;
    const badge = document.getElementById("badgeAlertas");

    const alerts = [];
    if (!d){
      list.innerHTML = `<p class="muted">Selecione uma área para gerar alertas.</p>`;
      badge.textContent = "0";
      return;
    }

    if (d.risco === "Alto") alerts.push({
      nivel: "alta", titulo: "Risco alto de seca",
      desc: "Umidade do solo baixa combinada com baixa probabilidade de chuva nos próximos dias."
    });
    if (d.chuvaProb > 70) alerts.push({
      nivel: "moderada", titulo: "Alta probabilidade de chuva forte",
      desc: `Previsão de ${d.chuvaProb}% de chance de precipitação — atenção a possíveis alagamentos em áreas baixas.`
    });
    if (d.temp > 34) alerts.push({
      nivel: "moderada", titulo: "Temperatura elevada",
      desc: `Temperatura atual de ${d.temp.toFixed(1)}°C pode acelerar a evapotranspiração e estresse hídrico das plantas.`
    });
    if (d.ndvi < 0.25) alerts.push({
      nivel: "alta", titulo: "Vegetação esparsa detectada",
      desc: "Índice NDVI baixo sugere baixa cobertura vegetal ativa na área monitorada."
    });
    if (alerts.length === 0) alerts.push({
      nivel: "baixa", titulo: "Nenhum risco relevante identificado",
      desc: "As condições atuais da área estão dentro da faixa esperada."
    });

    badge.textContent = String(alerts.filter(a => a.nivel !== "baixa").length);

    alerts.forEach(a => {
      const div = document.createElement("div");
      div.className = `alertcard alertcard--${a.nivel}`;
      div.innerHTML = `
        <div class="alertcard__icon"><svg viewBox="0 0 24 24"><path d="M12 2 1 21h22L12 2Zm0 6 6.5 11h-13L12 8Zm-1 3v4h2v-4h-2Zm0 5.5v2h2v-2h-2Z"/></svg></div>
        <div><h3>${a.titulo}</h3><p>${a.desc}</p></div>
        <time>${new Date().toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}</time>
      `;
      list.appendChild(div);
    });
  }

  // ---------------------------------------------------------
  // HISTÓRICO (Open-Meteo Archive — dados reais)
  // ---------------------------------------------------------
  async function loadHistorico(){
    if (state.lat === null) return;
    const fim = new Date();
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 30);
    const fmt = (d) => d.toISOString().slice(0,10);

    try {
      const url = `${AGROSAT_CONFIG.apis.openMeteoArchive}?latitude=${state.lat}&longitude=${state.lng}` +
        `&start_date=${fmt(inicio)}&end_date=${fmt(fim)}` +
        `&daily=temperature_2m_mean,precipitation_sum&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Falha ao consultar histórico.");
      const data = await res.json();
      state.historico = data;
      renderHistorico(data);
    } catch (err){
      toast("Não foi possível carregar o histórico agora.");
    }
  }

  function renderHistorico(data){
    const labels = data.daily.time.map(d => d.slice(5).replace("-", "/"));
    const temps = data.daily.temperature_2m_mean;
    const chuva = data.daily.precipitation_sum;

    const ctx1 = document.getElementById("chartHistorico");
    const ctx2 = document.getElementById("chartChuvaHist");

    if (chartHist) chartHist.destroy();
    if (chartChuva) chartChuva.destroy();

    const gridColor = "rgba(244,239,227,0.08)";
    const textColor = getComputedStyle(document.body).getPropertyValue("--ink-dim") || "#ccc";

    chartHist = new Chart(ctx1, {
      type: "line",
      data: { labels, datasets: [{ label: "Temp. média (°C)", data: temps, borderColor: "#3FAE6C", backgroundColor: "rgba(63,174,108,0.15)", fill:true, tension:0.35, pointRadius:0 }] },
      options: { responsive:true, plugins:{ legend:{ labels:{ color:textColor } } }, scales:{ x:{ ticks:{ color:textColor, maxTicksLimit:10 }, grid:{ color:gridColor } }, y:{ ticks:{ color:textColor }, grid:{ color:gridColor } } } }
    });

    chartChuva = new Chart(ctx2, {
      type: "bar",
      data: { labels, datasets: [{ label: "Precipitação (mm)", data: chuva, backgroundColor: "#C9824F" }] },
      options: { responsive:true, plugins:{ legend:{ labels:{ color:textColor } } }, scales:{ x:{ ticks:{ color:textColor, maxTicksLimit:10 }, grid:{ color:gridColor } }, y:{ ticks:{ color:textColor }, grid:{ color:gridColor } } } }
    });
  }

  // ---------------------------------------------------------
  // MAPA — controles de camada
  // ---------------------------------------------------------
  function initMapControls(){
    document.querySelectorAll(".mlayer").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".mlayer").forEach(b => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        AgroMap.setLayer(btn.dataset.layer);
      });
    });
  }

  // ---------------------------------------------------------
  // RELATÓRIOS (PDF / CSV)
  // ---------------------------------------------------------
  function initRelatorios(){
    document.getElementById("btnExportPdf").addEventListener("click", exportarPDF);
    document.getElementById("btnExportXls").addEventListener("click", exportarCSV);
  }

  function checarAreaSelecionada(){
    if (!state.derived){
      toast("Selecione uma área antes de exportar.");
      return false;
    }
    return true;
  }

  function exportarPDF(){
    if (!checarAreaSelecionada()) return;
    const d = state.derived;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("AgroSat Brasil — Relatório de Monitoramento", 14, 18);
    doc.setFontSize(10);
    doc.text(`Área: ${state.label || "-"}`, 14, 28);
    doc.text(`Coordenadas: ${state.lat.toFixed(5)}, ${state.lng.toFixed(5)}`, 14, 34);
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 40);

    doc.setFontSize(12);
    doc.text("Dados ambientais", 14, 52);
    doc.setFontSize(10);
    const linhas = [
      `Temperatura: ${d.temp.toFixed(1)} °C`,
      `Umidade do ar: ${d.umidadeAr}%`,
      `Probabilidade de chuva (24h): ${d.chuvaProb}%`,
      `Umidade do solo (estimada): ${d.umidadeSolo.toFixed(0)}%`,
      `Índice NDVI (estimado): ${d.ndvi.toFixed(2)}`,
      `Tipo de solo: ${d.tipoSolo}`,
      `Risco de seca: ${d.risco}`,
      `Índice geral de saúde da área: ${d.score}/100`
    ];
    linhas.forEach((l, i) => doc.text(l, 14, 60 + i*7));

    doc.setFontSize(8);
    doc.text("Métricas de solo/NDVI são estimativas modeladas a partir de dados climáticos públicos (Open-Meteo).", 14, 60 + linhas.length*7 + 10);
    doc.text("Não substituem laudo agronômico ou sensoriamento remoto certificado.", 14, 60 + linhas.length*7 + 15);

    doc.save("agrosat_relatorio.pdf");
    setText("reportStatus", "PDF gerado e baixado com sucesso.");
  }

  function exportarCSV(){
    if (!checarAreaSelecionada()) return;
    const d = state.derived;
    const rows = [
      ["Campo","Valor"],
      ["Área", state.label || ""],
      ["Latitude", state.lat],
      ["Longitude", state.lng],
      ["Temperatura (C)", d.temp.toFixed(1)],
      ["Umidade do ar (%)", d.umidadeAr],
      ["Probabilidade de chuva 24h (%)", d.chuvaProb],
      ["Umidade do solo estimada (%)", d.umidadeSolo.toFixed(0)],
      ["NDVI estimado", d.ndvi.toFixed(2)],
      ["Tipo de solo", d.tipoSolo],
      ["Risco de seca", d.risco],
      ["Índice geral (0-100)", d.score]
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "agrosat_relatorio.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setText("reportStatus", "Arquivo CSV (compatível com Excel) baixado com sucesso.");
  }

  // ---------------------------------------------------------
  // IA ANALÍTICA
  // ---------------------------------------------------------
  function initIA(){
    document.getElementById("btnGerarIA").addEventListener("click", () => {
      if (!state.derived){ toast("Selecione uma área primeiro."); return; }
      const texto = AgroAI.gerarAnaliseLocal({
        local: state.label,
        temperatura: state.derived.temp,
        chuvaProb: state.derived.chuvaProb,
        ndvi: state.derived.ndvi,
        umidadeSolo: state.derived.umidadeSolo,
        riscoSeca: state.derived.risco,
        tipoSolo: state.derived.tipoSolo,
        score: state.derived.score
      });
      document.getElementById("iaResumo").textContent = texto;
    });
  }

  // ---------------------------------------------------------
  // MARKETPLACE
  // ---------------------------------------------------------
  const seedProdutos = [
    { nome:"Sementes de soja certificadas", categoria:"Sementes e mudas", preco:189.9, local:"Sorriso, MT", rating:4.8, desc:"Lote certificado, alta germinação." },
    { nome:"Trator 75cv — locação diária", categoria:"Maquinário", preco:650, local:"Rio Verde, GO", rating:4.6, desc:"Disponível com operador ou sem operador." },
    { nome:"Consultoria agronômica via satélite", categoria:"Serviços técnicos", preco:320, local:"Londrina, PR", rating:5.0, desc:"Laudo com base em NDVI e clima." },
    { nome:"Frete de grãos — caçamba 30t", categoria:"Transporte", preco:4.5, local:"Cuiabá, MT", rating:4.4, desc:"Preço por km, frota própria." },
    { nome:"Mudas de eucalipto", categoria:"Sementes e mudas", preco:2.3, local:"Três Lagoas, MS", rating:4.7, desc:"Mudas clonais de alta produtividade." }
  ];

  async function initMarketplace(){
    await renderMarketplace();
    document.getElementById("mktSearch").addEventListener("input", renderMarketplace);
    document.getElementById("btnNovoProduto").addEventListener("click", () => openModal("modalProduto"));
    document.getElementById("formProduto").addEventListener("submit", async (e) => {
      e.preventDefault();
      const produto = {
        nome: document.getElementById("prodNome").value,
        categoria: document.getElementById("prodCategoria").value,
        preco: parseFloat(document.getElementById("prodPreco").value),
        local: document.getElementById("prodLocal").value,
        desc: document.getElementById("prodDesc").value,
        rating: 0
      };
      await AgroFirebase.salvarProduto(produto);
      closeModal("modalProduto");
      e.target.reset();
      toast("Anúncio publicado.");
      renderMarketplace();
    });
  }

  async function renderMarketplace(){
    const grid = document.getElementById("mktGrid");
    const q = (document.getElementById("mktSearch").value || "").toLowerCase();
    const salvos = await AgroFirebase.listarProdutos();
    const todos = [...salvos, ...seedProdutos];
    const filtrados = todos.filter(p => !q || p.nome.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q) || p.local.toLowerCase().includes(q));

    grid.innerHTML = "";
    if (!filtrados.length){
      grid.innerHTML = `<p class="muted">Nenhum produto encontrado.</p>`;
      return;
    }

    filtrados.forEach(p => {
      const card = document.createElement("article");
      card.className = "mktcard";
      card.innerHTML = `
        <span class="mktcard__cat">${p.categoria.toUpperCase()}</span>
        <h3>${p.nome}</h3>
        <span class="mktcard__price">R$ ${Number(p.preco).toFixed(2)}</span>
        <span class="mktcard__loc">📍 ${p.local}</span>
        <span class="mktcard__rating">${p.rating ? "★".repeat(Math.round(p.rating)) + " " + p.rating.toFixed(1) : "Sem avaliações ainda"}</span>
        <div class="mktcard__actions">
          <button class="btn btn--ghost btn-chat">Chat</button>
          <button class="btn btn--primary btn-negociar">Negociar</button>
        </div>
      `;
      card.querySelector(".btn-chat").addEventListener("click", () => toast("Chat entre usuários — estrutura pronta para conectar ao Firestore em tempo real."));
      card.querySelector(".btn-negociar").addEventListener("click", () => toast("Negociação iniciada (demo) com o fornecedor de " + p.local));
      grid.appendChild(card);
    });
  }

  // ---------------------------------------------------------
  // LOGIN / MODAIS
  // ---------------------------------------------------------
  function openModal(id){
    document.getElementById(id).classList.add("is-open");
    document.getElementById(id).setAttribute("aria-hidden", "false");
  }
  function closeModal(id){
    document.getElementById(id).classList.remove("is-open");
    document.getElementById(id).setAttribute("aria-hidden", "true");
  }

  function initAuth(){
    let perfilSelecionado = "proprietario";

    document.getElementById("btnLogin").addEventListener("click", () => {
      const user = AgroFirebase.getCurrentUser();
      if (user){
        AgroFirebase.logout().then(() => {
          setText("loginLabel", "Entrar");
          toast("Sessão encerrada.");
        });
      } else {
        openModal("modalLogin");
      }
    });
    document.getElementById("btnCloseLogin").addEventListener("click", () => closeModal("modalLogin"));
    document.getElementById("btnCloseProduto").addEventListener("click", () => closeModal("modalProduto"));

    document.querySelectorAll(".ptab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".ptab").forEach(t => t.classList.remove("is-active"));
        tab.classList.add("is-active");
        perfilSelecionado = tab.dataset.profile;
      });
    });

    document.getElementById("btnGoogleLogin").addEventListener("click", async () => {
      const user = await AgroFirebase.loginGoogle(perfilSelecionado);
      setText("loginLabel", user.nome.split(" ")[0]);
      closeModal("modalLogin");
      toast(`Bem-vindo, perfil: ${perfilSelecionado}.`);
    });

    document.getElementById("formDocLogin").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const doc = document.getElementById("loginDoc").value;
        const user = await AgroFirebase.loginDocumento(doc, perfilSelecionado);
        setText("loginLabel", user.tipo);
        closeModal("modalLogin");
        toast(`Acesso liberado — perfil: ${perfilSelecionado}.`);
      } catch (err){
        toast(err.message);
      }
    });

    const existente = AgroFirebase.getCurrentUser();
    if (existente) setText("loginLabel", existente.nome ? existente.nome.split(" ")[0] : existente.tipo);
  }

  // ---------------------------------------------------------
  // INIT GERAL
  // ---------------------------------------------------------
  function init(){
    initTheme();
    initNav();
    initSearch();
    initMapControls();
    initRelatorios();
    initIA();
    initMarketplace();
    initAuth();
    AgroMap.init();

    // Área padrão de demonstração: Sorriso, MT (polo agrícola)
    selecionarArea(-12.5447, -55.7217, "Sorriso, MT (exemplo)");
  }

  document.addEventListener("DOMContentLoaded", init);

  if ("serviceWorker" in navigator){
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        // Falha silenciosa: PWA é progressivo, app funciona sem SW.
      });
    });
  }

  return { onMapClick };
})();

window.AgroApp = AgroApp;
