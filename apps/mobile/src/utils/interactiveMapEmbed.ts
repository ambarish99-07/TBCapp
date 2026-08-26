/**
 * A self-authored Leaflet/OpenStreetMap page (unlike the static, keyless Google embed in
 * mapEmbed.ts) — needed here because this map has to be genuinely interactive: dragging or
 * tapping the pin posts the new coordinates back to React Native via
 * `window.ReactNativeWebView.postMessage`, which a cross-origin Google iframe embed could never
 * do. No API key needed, same reasoning as mapEmbed.ts.
 */
export function interactiveMapHtml(lat: number, lon: number): string {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;}</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', { zoomControl: false }).setView([${lat}, ${lon}], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  var marker = L.marker([${lat}, ${lon}], { draggable: true }).addTo(map);
  function post(lat, lon) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ lat: lat, lon: lon }));
  }
  marker.on('dragend', function() {
    var pos = marker.getLatLng();
    post(pos.lat, pos.lng);
  });
  map.on('click', function(e) {
    marker.setLatLng(e.latlng);
    post(e.latlng.lat, e.latlng.lng);
  });
  // Called via injectJavaScript from the RN side (search result tapped, GPS detected) — moves
  // the map/marker without a full WebView reload, which would otherwise reset zoom/pan.
  window.recenterMap = function(lat, lon) {
    map.setView([lat, lon], 16);
    marker.setLatLng([lat, lon]);
  };
</script>
</body></html>`;
}
