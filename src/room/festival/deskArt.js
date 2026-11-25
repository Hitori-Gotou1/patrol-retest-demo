import { art, circle, inset, line, rect, registration, text, weft } from './art.js';
import { examplePatch, hoopArt } from './patch.js';
import { filmStripArt, initialAnimation } from './animation.js';
import { initialRoom, roomArt } from './soundcheck.js';

export function deskArtwork({ onDesk = false } = {}) {
  const width = 430, height = 245;
  const backdrop = (fill, texture) => onDesk ? '' : rect(0, 0, width, height, fill) + weft(width, height, texture, 5)
    + registration(24, 24, texture) + registration(406, 221, texture);
  const animation = initialAnimation();
  const binding = '#30232d';
  return {
    patch: art(width, height, backdrop('#544039', '#c69771')
      + '<path d="M23 189Q59 184 75 155Q106 94 63 86Q32 84 46 111Q61 135 95 109L127 87" fill="none" stroke="#e5af53" stroke-width="2.5"/>'
      + '<g transform="rotate(-10 224 121)"><ellipse cx="226" cy="134" rx="99" ry="101" fill="#251e25" opacity=".44"/>'
      + inset(hoopArt(examplePatch(), { onDesk }), 74, 0, 271, 229) + '</g>'
      + '<path d="M350 48Q354 64 340 105L333 119" fill="none" stroke="#d8c5ad" stroke-width="3"/>'
      + circle(351, 46, 3, '#f5e8ba')),
    animation: art(width, height, backdrop('#848fa4', '#4e596f')
      + '<path d="M61 48L385 60L371 215L46 202Z" fill="#373340" opacity=".5"/>'
      + '<rect x="48" y="30" width="326" height="174" rx="8" fill="#d5bd9e" stroke="#584955" stroke-width="5"/>'
      + '<rect x="62" y="45" width="298" height="142" rx="2" fill="#f3e4c6" stroke="#7e6370" stroke-width="3"/>'
      + inset(filmStripArt(animation, undefined, { columns: 3, caption: false }), 72, 56, 278, 124)
      + '<path d="M371 147L396 165L406 156" fill="none" stroke="#352d38" stroke-width="9" stroke-linecap="round"/>'
      + circle(404, 156, 8, '#dcb079', 'stroke="#62495a" stroke-width="2"')),
    soundcheck: art(width, height, backdrop('#43584f', '#9cb292')
      + '<g transform="rotate(7 212 120)"><rect x="84" y="17" width="277" height="204" fill="#273637" opacity=".55"/>'
      + rect(76, 12, 276, 202, '#c9ac86')
      + inset(roomArt({ ...initialRoom(), listener: { x: 7, y: 12 }, seat: 'rear' }), 86, 20, 255, 185) + '</g>'
      + '<circle cx="367" cy="43" r="12" fill="#d8b984" stroke="#5b5646" stroke-width="3"/>'
      + '<path d="M352 51L380 36" stroke="#5b5646" stroke-width="2"/>'),
    zine: art(width, height, backdrop('#bd8580', '#694450')
      + '<path d="M30 75L184 35L388 77L397 217L221 182L43 214Z" fill="#322733" opacity=".38"/>'
      + '<path d="M48 52L208 30L209 181L57 203Z" fill="#f8e9cf" stroke="#a37568" stroke-width="1.5"/>'
      + '<path d="M208 30L369 58L380 210L209 181Z" fill="#f3d9bd" stroke="#a37568" stroke-width="1.5"/>'
      + line({ x: 208, y: 32 }, { x: 209, y: 181 }, '#af7d70', 2)
      + '<g transform="rotate(-8 124 104)">'
      + text(75, 75, 'STARRY', 14, '#50343e', 'font-weight="800" letter-spacing="2"')
      + text(74, 103, '地下文化祭', 18, '#50343e', 'font-weight="800"')
      + '<path d="M79 127H174M79 137H156M79 147H169" stroke="#a17968" stroke-width="1.25"/></g>'
      + '<g transform="rotate(10 290 114)"><path d="M253 88L345 87L345 156L253 157Z" fill="#eed19b" stroke="#ac7367"/>'
      + '<path d="M265 138L292 104L311 139L329 108" fill="none" stroke="#835768" stroke-width="2"/><circle cx="292" cy="104" r="4" fill="#684858"/></g>'
      + '<path d="M355 64L347 84L355 81L361 87L371 69Z" fill="#86495d"/>')
  };
}
