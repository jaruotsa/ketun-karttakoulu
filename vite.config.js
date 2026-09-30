// Vite: kolme sivua (index, what-is-a-map, sign). Julkaistava sivusto syntyy kansioon dist/.
import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// Kirjoittaa sw.js:n TIEDOSTOT-listaan kaikki rakennetut tiedostot ja VERSIOksi listan tiivisteen,
// jolloin laitteet tallentavat uudet tiedostot ja poistavat vanhan välimuistin joka julkaisussa.
function serviceWorkerLista() {
  let ulos;
  const kaikki = (kansio) =>
    readdirSync(kansio).flatMap((n) => {
      const polku = join(kansio, n);
      return statSync(polku).isDirectory() ? kaikki(polku) : [polku];
    });
  return {
    name: 'service-worker-lista',
    apply: 'build',
    configResolved: (c) => {
      ulos = join(c.root, c.build.outDir);
    },
    closeBundle() {
      const tiedostot = kaikki(ulos)
        .map((t) => relative(ulos, t))
        .filter((t) => t !== 'sw.js')
        .sort();
      const versio = createHash('sha256')
        .update(tiedostot.map((t) => t + readFileSync(join(ulos, t)).length).join())
        .digest('hex')
        .slice(0, 10);
      const polku = join(ulos, 'sw.js');
      const lista = ['./', ...tiedostot].map((t) => `  '${t}',`).join('\n');
      const teksti = readFileSync(polku, 'utf8')
        .replace(/const VERSIO = '[^']*';/, `const VERSIO = 'karttakoulu-${versio}';`)
        .replace(/const TIEDOSTOT = \[[\s\S]*?\n\];/, `const TIEDOSTOT = [\n${lista}\n];`);
      writeFileSync(polku, teksti);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [serviceWorkerLista()],
  build: {
    rollupOptions: {
      input: {
        index: 'index.html',
        'what-is-a-map': 'what-is-a-map.html',
        sign: 'sign.html',
      },
    },
    chunkSizeWarningLimit: 900,
  },
  server: { port: 8765 },
  preview: { port: 8765 },
});
