// Small, self-contained shapes for the original screen-print artwork. The same
// paths, coordinates and colors are used at the press, on the train and in PNGs.
export const aftershowInkColors = {
  pink: '#db789c',
  yellow: '#eab455',
  blue: '#435ea5',
  red: '#c94f56',
};

export const aftershowArtViews = {
  audience: { label: '观众席', caption: '从台下看四个人' },
  guitar: { label: '吉他手旁', caption: '琴弦上方的手' },
  drums: { label: '鼓位', caption: '鼓棒给的提示' },
  wing: { label: '舞台侧面', caption: '从侧边交换眼神' },
};

const shape = (tag, attrs) => ({ tag, attrs });
const path = (d, attrs = {}) => shape('path', { d, ...attrs });
const circle = (cx, cy, r, attrs = {}) => shape('circle', { cx, cy, r, ...attrs });
const ellipse = (cx, cy, rx, ry, attrs = {}) => shape('ellipse', { cx, cy, rx, ry, ...attrs });
const rect = (x, y, width, height, attrs = {}) => shape('rect', { x, y, width, height, ...attrs });
const stroke = (d, width, attrs = {}) => path(d, {
  fill: 'none', stroke: 'currentColor', 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...attrs,
});
const tint = opacity => ({ opacity });
const effect = (attrs, ...children) => ({ ...shape('g', attrs), children });
const move = (x, y, ...children) => effect({ transform: `translate(${x} ${y})` }, ...children);

function dots(x, y, columns, rows, pitch, radius) {
  return effect(tint(.63), ...Array.from({ length: columns * rows }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return circle(x + column * pitch + (row % 2) * pitch / 2, y + row * pitch, radius);
  }));
}

function spark(x, y, size) {
  return move(x, y, path(`M0 ${-size}Q2 -3 ${size} 0Q2 3 0 ${size}Q-2 3 ${-size} 0Q-2 -3 0 ${-size}Z`));
}

function pulse(x, y, count, step = 13) {
  return effect({}, ...Array.from({ length: count }, (_, i) => {
    const height = 7 + (i * 9) % 23;
    return rect(x + i * step, y - height / 2, 4, height, { rx: 1 });
  }));
}

function audience(beat) {
  const breakInRhythm = beat === 5 ? -16 : beat === 8 ? 10 : 0;
  const drummer = beat === 6 ? -18 : 0;
  return {
    yellow: [
      circle(235, 287, 110, tint(.65)), path('M36 165L91 165L252 480H187Z', tint(.5)),
      path('M442 165H404L228 487H292Z', tint(.67)), ellipse(250, 457, 180, 34, tint(.5)),
      dots(55, 182, 5, 4, 8, 1.5), dots(374, 182, 6, 4, 8, 1.5),
    ],
    pink: [
      // Four bodies are deliberately kept distinct in the distant, front-of-house frame.
      path('M76 428L82 340Q88 319 111 319Q137 323 146 355L158 430H137L122 379L119 416L130 462H105L98 419L92 463H68Z'),
      path('M83 319Q71 301 80 280Q91 264 108 268Q127 268 135 282L145 327L129 316Q119 335 99 324L85 339Z'),
      path('M162 396L168 347Q178 327 195 327Q216 327 226 350L241 421H168Z'),
      circle(199, 311, 24), path('M184 296L187 275L209 292Z'),
      path('M237 426L252 337Q257 314 281 312Q306 315 317 343L335 451H313L296 397L294 460H272L275 396L256 457H235Z'),
      path('M261 309Q253 285 270 273Q287 265 301 278L307 314L293 306L274 321Z'),
      path('M334 437L347 345Q356 321 379 323Q403 326 412 353L436 444H416L398 394L404 464H383L378 418L358 463H337Z'),
      path('M349 315Q348 285 371 279Q397 274 408 297L419 332L398 324L389 309Q367 327 349 315Z'),
      move(0, breakInRhythm, stroke('M101 349L122 374L156 348', 10)),
      move(0, drummer, stroke('M179 337L177 317L157 299M216 341L224 320L239 304', 6)),
    ],
    blue: [
      path('M36 462L88 441L142 451L196 435L253 453L322 435L389 448L444 462V486H36Z', tint(.92)),
      stroke('M36 440H444M54 477Q239 438 427 477M163 168V258M320 168V274', 2.4),
      ellipse(199, 379, 47, 15, tint(.73)), circle(199, 402, 31),
      stroke('M157 379L151 441M239 379L246 439M183 398L216 398M199 391V414', 3, tint(.6)),
      move(0, breakInRhythm, path('M99 375Q108 360 129 367L164 332L170 339L137 381Q137 406 121 410Q93 412 99 375Z')),
      path('M270 371Q287 361 301 375L334 345L341 354L306 393Q301 414 284 414Q260 409 270 371Z'),
      path('M367 382Q377 367 395 376L421 351L426 359L402 392Q403 416 388 419Q362 418 367 382Z'),
      dots(47, 218, 4, 14, 7, 1.35), dots(409, 220, 4, 14, 7, 1.35),
    ],
    red: [
      stroke('M86 300L98 300M271 294L283 294M365 297L376 297', 3),
      move(0, drummer, stroke('M156 298L173 310M239 304L226 314', 3)),
      spark(157, beat === 5 ? 326 : 247, 12), spark(330, beat === 7 ? 318 : 236, 14),
      pulse(64, 212, beat), path('M398 191H428V211H398Z', tint(.82)),
    ],
  };
}

function guitar(beat) {
  const thumb = [-9, -5, -7, -1, -22, -9, 0, 15][beat - 1];
  const strings = Array.from({ length: 6 }, (_, i) => stroke(`M58 ${391 + i * 8}L441 ${291 + i * 8}`, i % 2 ? 1.8 : 3));
  return {
    yellow: [
      circle(284, 285, 119, tint(.54)), circle(284, 285, 90, tint(.16)),
      path('M36 165H141L310 489H246Z', tint(.38)),
      dots(61, 191, 6, 10, 8, 1.4), dots(386, 228, 6, 9, 8, 1.4),
    ],
    pink: [
      path('M37 168H125L158 215L125 282L71 282L37 252Z'),
      move(0, thumb,
        path('M104 226Q132 208 149 217L213 261L267 265Q297 267 312 283L331 306Q344 330 330 337Q318 344 307 328L294 314L269 310Q295 333 284 345Q275 354 258 341L235 326Q252 352 237 358Q228 361 215 350L167 316Q139 305 124 283L94 258Z'),
        stroke('M175 251L219 285L250 286M162 281Q174 294 199 301L235 326M214 302L269 310', 2, tint(.46)),
      ),
      path('M37 262L59 271L141 234L121 209L36 227Z', tint(.74)),
      stroke('M43 240L118 215M51 253L125 228', 3, tint(.6)),
    ],
    blue: [
      path('M42 359Q73 330 103 343Q118 351 128 378L66 400L161 473L91 494L35 476Z', tint(.85)),
      path('M62 380L441 280V336L84 445Z', tint(.22)), ...strings,
      stroke('M343 311L350 374M373 302L381 364M404 292L414 355M267 331L275 398M303 322L310 390M225 344L230 410M178 358L188 426', 3),
      rect(78, 373, 18, 67, { rx: 4, transform: 'rotate(-17 78 373)' }),
      dots(102, 447, 13, 6, 8, 1.8), dots(355, 430, 11, 6, 8, 1.7),
      stroke('M52 199L59 186M70 205L78 189M89 211L96 196', 3),
    ],
    red: [
      move(0, thumb, path('M299 313Q321 310 331 323Q326 341 308 352Q298 344 299 313Z')),
      spark(beat === 5 ? 355 : 373, beat === 5 ? 304 : 283, 16), spark(353, 209, 12),
      stroke('M413 201L429 184M417 219L440 215M404 190L407 175', 4),
      pulse(307, 468, beat),
    ],
  };
}

function drums(beat) {
  const cue = [-3, 6, 2, 13, 3, -19, -7, 19][beat - 1];
  return {
    yellow: [
      circle(255, 265, 103, tint(.48)), path('M377 161H426L282 472H213Z', tint(.62)),
      ellipse(133, 320, 93, 17, tint(.81)), ellipse(371, 304, 78, 20),
      dots(386, 178, 7, 9, 7, 1.6), dots(44, 385, 8, 12, 7, 1.4),
    ],
    pink: [
      path('M36 175L57 164L135 196L190 213L209 208L228 221L224 246L203 259L176 246L113 244L36 219Z'),
      path('M444 192L414 180L354 229L313 247L290 242L265 250L268 276L295 292L320 281L383 265L444 230Z'),
      move(0, cue,
        stroke('M217 226Q230 222 241 232M214 238Q230 233 238 243M271 251L261 256M273 267L264 271', 7),
        ellipse(223, 232, 14, 16), ellipse(278, 263, 16, 14),
      ),
      path('M36 181L101 197L91 237L36 221Z', tint(.66)),
      path('M444 193L396 215L415 247L444 229Z', tint(.66)),
    ],
    blue: [
      path('M85 363Q178 342 267 375L249 453Q174 487 101 451Z', tint(.85)),
      ellipse(174, 374, 93, 29, tint(.82)),
      stroke('M87 394Q179 425 263 397M96 441Q169 470 253 435M135 410V459M211 412V458', 3),
      path('M290 386Q348 353 416 379L406 441Q353 467 299 444Z', tint(.72)),
      ellipse(351, 381, 65, 18),
      stroke('M47 320Q119 291 219 320Q122 348 47 320ZM294 304Q376 269 449 304Q366 336 294 304ZM132 318L125 369M371 305L363 369M310 451L291 482M399 450L423 484', 4),
      stroke('M112 323L151 320M351 309L398 300M124 376L153 370M288 220L319 209', 2.4),
      path('M287 486L444 429V446L319 489Z', tint(.36)),
      stroke('M287 482L444 428M296 486L444 435M311 488L444 442M349 463L354 476M378 453L384 467M411 442L417 456', 1.6),
      dots(355, 458, 11, 4, 7, 1.3),
    ],
    red: [
      move(0, cue, stroke('M219 228L327 178M277 263L175 318', 5)),
      spark(327, 177 + cue, beat === 6 ? 17 : 9), spark(beat === 6 ? 252 : 221, beat === 6 ? 180 : 309, 12),
      pulse(57, 271, beat),
      stroke('M251 317L259 304M267 322L283 319M244 310L244 298', 3.3),
    ],
  };
}

function wing(beat) {
  const lean = beat >= 7 ? 9 : -3;
  const glance = beat === 7 ? 18 : beat === 5 ? -8 : 3;
  return {
    yellow: [
      circle(335, 287, 108, tint(.55)), ellipse(337, 286, 127, 137, tint(.17)),
      path('M401 166H437L187 487H101Z', tint(.59)),
      path('M40 386L185 270L300 488H36Z', tint(.33)), dots(364, 195, 11, 8, 7, 1.25),
    ],
    pink: [
      // Faces are in profile: a side-stage frame can show a glance across the set.
      move(lean, 0,
        path('M42 434Q43 345 92 327Q117 308 147 327Q187 349 197 395L216 490H36Z'),
        path('M69 344L63 303Q61 256 89 235Q117 214 149 223Q172 228 180 252L176 273L190 290L177 299L174 320Q168 340 141 339L136 362L100 353L88 313Z'),
        stroke('M88 317Q78 276 112 252Q133 240 156 240M142 304L164 307', 2.5, tint(.61)),
      ),
      path('M240 437Q242 366 282 348Q310 336 341 362Q377 396 381 488H204Z'),
      path('M272 347L285 322Q265 317 263 301L252 294L264 282L263 262Q272 235 302 234Q339 235 356 275L366 352L335 339L317 331L313 360Z'),
      stroke('M274 257Q299 243 327 271L344 321M280 306L297 304', 2.5, tint(.62)),
      path('M382 355Q396 324 422 325L446 343V487H365Z', tint(.74)),
      path('M397 325Q386 310 391 293Q403 268 427 276L444 292V337L429 330L421 303L412 324Z', tint(.74)),
    ],
    blue: [
      path('M36 164H55L89 490H36Z', tint(.89)), path('M36 464L444 381V487H36Z', tint(.56)),
      path('M107 481Q94 454 112 426Q133 396 159 429L288 395L292 405L166 449Q169 478 147 487Z'),
      stroke('M143 441L285 401M146 446L288 405M79 486Q238 456 430 432M257 483Q302 457 356 459', 2.9),
      path('M330 464L352 424L422 411L438 452Z', tint(.82)),
      stroke('M344 462L371 427L419 419M376 479Q364 468 389 455Q420 439 427 471', 3),
      dots(189, 183, 11, 8, 7, 1.4), dots(165, 467, 12, 4, 7, 1.3),
    ],
    red: [
      move(lean, 0, stroke('M151 280L164 281', 4.3)), stroke('M271 287L285 283', 4.3),
      stroke(`M187 282Q221 ${248 + glance} 252 285`, 2.6, { 'stroke-dasharray': '4 8' }),
      spark(223, 259 + glance, beat >= 7 ? 11 : 7), spark(383, 236, 13),
      pulse(326, 467, beat), path('M69 201L77 174L85 201Z', tint(.8)),
    ],
  };
}

const compositions = { audience, guitar, drums, wing };

export function aftershowArtwork(view, beat) {
  return (compositions[view] || audience)(Math.max(1, Math.min(8, Math.round(beat) || 1)));
}

// The stock grain is fixed across all impressions and preserved in the export.
export const aftershowPaperGrain = Array.from({ length: 410 }, (_, i) => {
  const x = (i * 149 + 27) % 479;
  const y = (i * i * 31 + i * 97 + 17) % 619;
  return `M${x} ${y}h${i % 6 === 0 ? 1.8 : .7}`;
}).join('');
