/**
 * AgroSat Brasil — js/map.js
 * --------------------------------------------------
 * Mapa satelital usando Leaflet + tiles públicos (Esri World Imagery / OSM).
 * Restrito visualmente ao território brasileiro via maxBounds.
 */

const AgroMap = (() => {

  let map = null;
  let marker = null;
  let circle = null;
  let currentLayer = null;
  let drawnItems = null;
  let selectedPolygon = null;
  const layers = {};

  function isInsideBrasil(lat, lng){
    const b = AGROSAT_CONFIG.brasilBounds;
    return lat <= b.north && lat >= b.south && lng >= b.west && lng <= b.east;
  }

  function init(){
    if (map) return map;

    const b = AGROSAT_CONFIG.brasilBounds;
    const southWest = L.latLng(b.south - 6, b.west - 6);
    const northEast = L.latLng(b.north + 6, b.east + 6);
    const brBounds = L.latLngBounds(southWest, northEast);

    map = L.map("map", {
      center: [AGROSAT_CONFIG.brasilCenter.lat, AGROSAT_CONFIG.brasilCenter.lng],
      zoom: 4,
      minZoom: 4,
      maxZoom: 17,
      maxBounds: brBounds,
      maxBoundsViscosity: 0.6
    });

    layers.satelite = L.tileLayer(AGROSAT_CONFIG.apis.esriSatelliteTiles, {
      attribution: "Tiles &copy; Esri — World Imagery",
      maxZoom: 17
    });

    layers.ruas = L.tileLayer(AGROSAT_CONFIG.apis.osmTiles, {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19
    });

    // Camada "NDVI" simulada: overlay visual só para fins demonstrativos,
    // já que NDVI real exigiria uma API de sensoriamento remoto paga (ex: Sentinel Hub).
    layers.ndvi = L.tileLayer(AGROSAT_CONFIG.apis.esriSatelliteTiles, {
      attribution: "Tiles &copy; Esri (overlay NDVI simulado)",
      maxZoom: 17,
      className: "ndvi-tint"
    });

    currentLayer = layers.satelite;
    currentLayer.addTo(map);

    if (typeof L.Control.Draw !== 'undefined'){
      drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);

      map.addControl(new L.Control.Draw({
        draw:{polygon:true,rectangle:true,circle:false,polyline:false,marker:false,circlemarker:false},
        edit:{featureGroup:drawnItems}
      }));

      map.on(L.Draw.Event.CREATED, function(e){
        drawnItems.clearLayers();
        drawnItems.addLayer(e.layer);
        selectedPolygon = e.layer.toGeoJSON();
        window.dispatchEvent(new CustomEvent('agrosat:polygon',{detail:selectedPolygon}));
      });
    }

    // Contorno aproximado do território brasileiro (ilustrativo)
    L.rectangle(
      [[b.south, b.west], [b.north, b.east]],
      { color: "#3FAE6C", weight: 1, fill: false, dashArray: "4 6", opacity: 0.5 }
    ).addTo(map);

    map.on("move", updateTelemetry);
    map.on("zoom", updateTelemetry);
    map.on("click", (e) => {
      if (window.AgroApp) window.AgroApp.onMapClick(e.latlng.lat, e.latlng.lng);
    });

    updateTelemetry();
    return map;
  }

  function updateTelemetry(){
    if (!map) return;
    const c = map.getCenter();
    const teleLat = document.getElementById("teleLat");
    const teleLng = document.getElementById("teleLng");
    const teleZoom = document.getElementById("teleZoom");
    if (teleLat) teleLat.textContent = c.lat.toFixed(6);
    if (teleLng) teleLng.textContent = c.lng.toFixed(6);
    if (teleZoom) teleZoom.textContent = map.getZoom();
  }

  function setLayer(name){
    if (!map || !layers[name]) return;
    if (currentLayer) map.removeLayer(currentLayer);
    currentLayer = layers[name];
    currentLayer.addTo(map);
  }

  function setPoint(lat, lng, label){
    if (!map) init();
    if (!isInsideBrasil(lat, lng)){
      return { ok:false, reason: "fora_do_brasil" };
    }
    if (marker) map.removeLayer(marker);
    if (circle) map.removeLayer(circle);

    marker = L.marker([lat, lng]).addTo(map);
    if (label) marker.bindPopup(label).openPopup();

    circle = L.circle([lat, lng], {
      radius: 4000,
      color: "#3FAE6C",
      fillColor: "#3FAE6C",
      fillOpacity: 0.12,
      weight: 1.4
    }).addTo(map);

    map.flyTo([lat, lng], 11, { duration: 1.1 });
    updateTelemetry();
    return { ok:true };
  }

  function invalidate(){
    if (map) setTimeout(() => map.invalidateSize(), 200);
  }

  function getSelectedPolygon(){ return selectedPolygon; }
  return { init, setLayer, setPoint, isInsideBrasil, invalidate, getSelectedPolygon };
})();
