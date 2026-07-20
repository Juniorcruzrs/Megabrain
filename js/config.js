/**
 * AgroSat Brasil — Configuração Central
 * --------------------------------------------------
 * Preencha as chaves abaixo quando tiver suas credenciais.
 * Nenhuma chave é obrigatória para rodar o núcleo do app
 * (Dashboard + Mapa), que usa serviços públicos sem chave.
 */

const AGROSAT_CONFIG = {

  // ── FIREBASE ──────────────────────────────────────────
  // Crie um projeto em https://console.firebase.google.com
  // Ative: Authentication (Google + Email/Senha), Firestore, Storage.
  // Cole o objeto "firebaseConfig" gerado pelo console aqui:
  firebase: {
    apiKey: "COLE_AQUI",
    authDomain: "COLE_AQUI.firebaseapp.com",
    projectId: "COLE_AQUI",
    storageBucket: "COLE_AQUI.appspot.com",
    messagingSenderId: "COLE_AQUI",
    appId: "COLE_AQUI"
  },
  firebaseEnabled: false, // mude para true após preencher as chaves acima

  // ── APIS DE CLIMA E MAPA (gratuitas, sem chave) ───────
  apis: {
    // Open-Meteo: previsão do tempo e histórico climático, gratuito, sem chave.
    openMeteoBase: "https://api.open-meteo.com/v1/forecast",
    openMeteoArchive: "https://archive-api.open-meteo.com/v1/archive",
    // Nominatim (OpenStreetMap): geocodificação de endereço, gratuito, sem chave.
    nominatim: "https://nominatim.openstreetmap.org/search",
    // Tiles de satélite Esri World Imagery, gratuito, sem chave, uso não comercial.
    esriSatelliteTiles: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    // Tiles padrão OpenStreetMap.
    osmTiles: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  },

  // ── ÁREA DE COBERTURA ──────────────────────────────────
  // Bounding box aproximado do território brasileiro,
  // usado para restringir buscas e o mapa ao Brasil.
  brasilBounds: {
    north: 5.27,
    south: -33.75,
    west: -73.99,
    east: -34.79
  },
  brasilCenter: { lat: -14.235, lng: -51.9253 },

  // ── FLAGS DE MÓDULO ────────────────────────────────────
  // Indica quais módulos já têm integração real vs. dados simulados.
  // Usado pela UI para exibir o selo "DEMO" quando aplicável.
  moduleStatus: {
    dashboard: "live",
    mapa: "live",
    alertas: "demo",
    historico: "live",
    relatoriosPDF: "demo",
    iaAnalitica: "demo",
    marketplace: "demo",
    authGoogle: "demo",
    authCpfCnpj: "demo"
  }
};
