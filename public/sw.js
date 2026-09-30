// Service worker: sivusto toimii ilman verkkoa (esim. kololla tai metsässä) ja voidaan asentaa kotivalikkoon.
//
// Ensimmäisellä käynnillä kaikki tiedostot tallennetaan välimuistiin (TIEDOSTOT). Sen jälkeen jokainen
// pyyntö haetaan ensin verkosta, jotta muutokset näkyvät heti, ja välimuistista vain, jos verkkoa ei ole
// tai se ei vastaa ajoissa (ODOTUS). Verkosta haettu tiedosto päivittää samalla välimuistin.
//
// Uusi tiedosto: TIEDOSTOT-lista ja VERSIO kirjoitetaan automaattisesti (vite.config.js), kun sivusto rakennetaan (npm run build).
// VERSIO on listan tiiviste, joten muuttunut sivusto asentaa listan uudelleen ja poistaa vanhan välimuistin.
const VERSIO = 'karttakoulu-1';
const ODOTUS = 3000; // ms, jonka jälkeen heikon verkon sijaan käytetään välimuistia

const TIEDOSTOT = [
  './',
  'index.html',
  'what-is-a-map.html',
  'sign.html',
  'manifest.webmanifest',
  'css/style.css',
  'kuvat/kuvake.svg',
  'kuvat/kuvake-180.png',
  'kuvat/kuvake-192.png',
  'kuvat/kuvake-512.png',
  'js/etusivu-kettu.js',
  'js/jaljet.js',
  'js/kartta-sivu.js',
  'js/karttatyyppi.js',
  'js/kettu.js',
  'js/kettu3d.js',
  'js/kettula.js',
  'js/maailma3d.js',
  'js/maasto.js',
  'js/merkit.js',
  'js/merkki-3d.js',
  'js/merkki-sivu.js',
  'js/nayttamo3d.js',
  'js/olennot3d.js',
  'js/opetus3d.js',
  'js/sovellus.js',
  'js/suunnistus.js',
  'js/symbolit.js',
  'js/kohtaukset/aidat.js',
  'js/kohtaukset/jarvi.js',
  'js/kohtaukset/kivi.js',
  'js/kohtaukset/maki.js',
  'js/kohtaukset/metsa.js',
  'js/kohtaukset/nakotorni.js',
  'js/kohtaukset/nuotio.js',
  'js/kohtaukset/pelto.js',
  'js/kohtaukset/pienet.js',
  'js/kohtaukset/polku.js',
  'js/kohtaukset/puro.js',
  'js/kohtaukset/rakennus.js',
  'js/kohtaukset/rastit.js',
  'js/kohtaukset/sahkolinja.js',
  'js/kohtaukset/silta.js',
  'js/kohtaukset/suo.js',
  'js/vendor/three.core.min.js',
  'js/vendor/three.module.min.js',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' ohittaa selaimen oman välimuistin, jotta tallennetaan varmasti uusin versio.
  e.waitUntil(
    caches.open(VERSIO)
      .then((v) => v.addAll(TIEDOSTOT.map((t) => new Request(t, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nimet) => Promise.all(nimet.filter((n) => n !== VERSIO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const pyynto = e.request;
  if (pyynto.method !== 'GET' || new URL(pyynto.url).origin !== location.origin) return;
  e.respondWith(verkostaTaiMuistista(pyynto));
});

// Sivut tallennetaan ilman kyselyosaa: sign.html?id=jarvi ja ?id=pelto ovat sama tiedosto.
function avain(pyynto) {
  if (pyynto.mode !== 'navigate') return pyynto;
  const osoite = new URL(pyynto.url);
  osoite.search = '';
  return osoite.href;
}

async function verkostaTaiMuistista(pyynto) {
  const muisti = await caches.open(VERSIO);
  // cache: 'no-cache' kysyy palvelimelta aina, onko tiedosto muuttunut, vaikka palvelin ei lähettäisi
  // Cache-Control-otsaketta. Muuten selain voi antaa vanhan tiedoston omasta välimuististaan.
  const verkosta = fetch(pyynto, { cache: 'no-cache' }).then((vastaus) => {
    if (vastaus.ok) muisti.put(avain(pyynto), vastaus.clone());
    return vastaus;
  });
  // ignoreVary: moduulikomennot lähettävät Origin-otsakkeen, ja Vary: Origin -vastaus ei muuten löytyisi.
  const muistista = () => muisti.match(avain(pyynto), { ignoreVary: true });

  // Verkko ehtii ensin: käytetään sitä. Verkko on hidas: käytetään välimuistia, jos tiedosto on siellä.
  const hidas = new Promise((valmis) => setTimeout(valmis, ODOTUS)).then(muistista);
  const nopein = await Promise.race([verkosta.catch(() => null), hidas]);
  if (nopein) return nopein;
  try {
    return await verkosta;
  } catch {
    return (await muistista()) || Response.error();
  }
}
