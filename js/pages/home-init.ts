import * as FoxSvg from '../fox-svg';
import * as Pawprints from '../pawprints';
import * as MapType from '../map-type';
import { SIGNS } from '../signs';
import { t, formatNumber } from '../i18n';
import { $ } from '../dom';

// The SVG fox is shown until the 3D fox has loaded (and stays if 3D does not work).
$('#hero-fox').innerHTML = FoxSvg.svg('facing-viewer');
const learned = Pawprints.all();
$('#pawprint-count').textContent = formatNumber(learned.length);
const startPicture = `<svg viewBox="0 0 200 70" aria-hidden="true">
  <rect width="100" height="70" rx="6" fill="#4F8248"/><circle cx="20" cy="18" r="9" fill="#6A9C5B"/><circle cx="44" cy="52" r="10" fill="#6A9C5B"/><circle cx="80" cy="20" r="8" fill="#6A9C5B"/>
  <path d="M52,16 C70,8 92,20 90,40 C88,60 62,62 56,48 C50,36 40,24 52,16Z" fill="#2F6E9E"/>
  <path d="M104,35 h14 m-5,-6 l6,6 l-6,6" stroke="#8A7B62" stroke-width="3" fill="none" stroke-linecap="round"/>
  <rect x="122" width="78" height="70" rx="6" fill="#FBF8F0" stroke="#E7DCC5"/>
  <path d="M150,16 C166,8 186,20 184,40 C182,60 158,62 152,48 C146,36 138,24 150,16Z" fill="#71C8E6" stroke="#0067A5" stroke-width="2"/>
</svg>`;
// The start card of the orienteering map: the same Foxwood as an orienteering map.
const orienteeringStartPicture = `<svg viewBox="0 0 200 70" aria-hidden="true">
  <rect width="100" height="70" rx="6" fill="#4F8248"/><circle cx="20" cy="18" r="9" fill="#6A9C5B"/><circle cx="44" cy="52" r="10" fill="#6A9C5B"/><circle cx="80" cy="20" r="8" fill="#6A9C5B"/>
  <path d="M52,16 C70,8 92,20 90,40 C88,60 62,62 56,48 C50,36 40,24 52,16Z" fill="#2F6E9E"/>
  <path d="M104,35 h14 m-5,-6 l6,6 l-6,6" stroke="#8A7B62" stroke-width="3" fill="none" stroke-linecap="round"/>
  <rect x="122" width="78" height="70" rx="6" fill="#fff" stroke="#E7DCC5"/>
  <path d="M150,16 C166,8 186,20 184,40 C182,60 158,62 152,48 C146,36 138,24 150,16Z" fill="#00ACE0" stroke="#1a1a1a" stroke-width="1.2"/>
  <path d="M130,58 l6,-10 l6,10 Z" fill="none" stroke="#D848A0" stroke-width="2.2"/>
</svg>`;

// The grid shows only the signs of the chosen map type (map-type.ts).
// On the orienteering map a sign is learned under its own id (orienteering-<id>).
function drawGrid() {
  const orienteering = MapType.current() === 'orienteering';
  const learnedId = (id: string) => (orienteering ? `orienteering-${id}` : id);
  $('#section-heading').textContent = t(
    orienteering ? 'home.orienteeringHeading' : 'home.topoHeading',
  );
  const startLearned = learned.includes(orienteering ? 'orienteering-map' : 'map');
  const startCard = `<a class="sign-card intro${startLearned ? ' learned' : ''}" href="what-is-a-map.html">${orienteering ? orienteeringStartPicture : startPicture}<span>${t(orienteering ? 'home.startOrienteering' : 'home.startTopo')}</span><small>${startLearned ? t('home.learned') : t('home.startHere')}</small></a>`;
  $('#sign-grid').innerHTML =
    startCard +
    SIGNS.filter((sign) => MapType.belongsTo(sign))
      .map((sign) => {
        const details = MapType.details(sign);
        // A sign in both map types does not show the MML icon on the orienteering map until it has
        // an icon of its own.
        const icon = orienteering && !sign.only && !sign.orienteering?.icon ? null : details.icon;
        const picture = icon || '<div class="unknown">?</div>';
        if (!MapType.isReady(sign)) {
          return `<div class="sign-card coming-soon">${picture}<span>${details.name}</span><small>${t('home.comingSoon')}</small></div>`;
        }
        const isLearned = learned.includes(learnedId(sign.id));
        return `<a class="sign-card${isLearned ? ' learned' : ''}" href="sign.html?id=${sign.id}">${picture}<span>${details.name}</span>${isLearned ? `<small>${t('home.learned')}</small>` : ''}</a>`;
      })
      .join('');
}
drawGrid();
MapType.listen(drawGrid);
