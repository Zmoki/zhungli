/*! Жунгли · https://zhungli.zmoki.xyz/ · Copyright (c) 2026 Zarema Khalilova. All rights reserved. No copying, hosting or reuse without permission. See LICENSE. */
// Plant silhouettes shown when a plant has no photo. Colors come from CSS tokens (.lf, .pot…).
const POT_SVG = '<path class="pot2" d="M17 41h30v5H17z"/><path class="pot" d="M18 44h28l-3 16H21z"/>';
const SHAPES = {
  leafy: `<path class="st" d="M32 44C31 34 27 26 21 19M32 44c1-11 5-19 12-26M32 44V22"/>
    <path class="lf2" d="M21 20C11 18 6 9 10 3c8 1 14 7 13 15z"/><path class="lf" d="M44 19c9-3 14-11 11-17-8 0-14 6-13 14z"/>
    <path class="lf" d="M32 24c-8-4-10-13-5-19 3 2 5 4 5 4s2-2 5-4c5 6 3 15-5 19z"/>${POT_SVG}`,
  trailing: `<path class="st" d="M24 42c-6 2-10 7-11 16M40 42c6 2 9 6 10 13M32 42c0-8 2-14 6-18"/>
    <ellipse class="lf" cx="14" cy="49" rx="4.5" ry="3.2" transform="rotate(-50 14 49)"/><ellipse class="lf2" cx="12" cy="58" rx="4.5" ry="3.2" transform="rotate(40 12 58)"/>
    <ellipse class="lf" cx="50" cy="48" rx="4.5" ry="3.2" transform="rotate(50 50 48)"/><ellipse class="lf2" cx="51" cy="57" rx="4.5" ry="3.2" transform="rotate(-40 51 57)"/>
    <ellipse class="lf" cx="38" cy="25" rx="7" ry="5" transform="rotate(-35 38 25)"/><ellipse class="lf2" cx="27" cy="31" rx="7" ry="5" transform="rotate(35 27 31)"/>
    <ellipse class="lf3" cx="34" cy="37" rx="6" ry="4"/>${POT_SVG}`,
  succulent: `<path class="lf2" d="M32 41c-10 0-18-4-21-10 7-1 14 2 19 7zM32 41c10 0 18-4 21-10-7-1-14 2-19 7z"/>
    <path class="lf" d="M32 41c-7-3-12-10-12-18 6 3 10 9 12 15zM32 41c7-3 12-10 12-18-6 3-10 9-12 15z"/>
    <path class="lf3" d="M32 41c-4-5-5-12-2-19 1-1 3-1 4 0 3 7 2 14-2 19z"/>${POT_SVG}`,
  cactus: `<path class="lf" d="M27 41V14a5 5 0 0 1 10 0v27z"/><path class="lf2" d="M27 30h-5a4 4 0 0 1-4-4v-8a3 3 0 0 1 6 0v6h3zM37 25h4v-7a3 3 0 0 1 6 0v8a4 4 0 0 1-4 4h-6z"/>
    <circle class="bl" cx="32" cy="9" r="3"/>${POT_SVG}`,
  orchid: `<path class="lf" d="M32 41c-9 1-17-2-20-7 7-2 14 0 18 5zM32 41c9 1 17-2 20-7-7-2-14 0-18 5z"/>
    <path class="st" d="M33 40c0-14 3-26 14-32"/><circle class="bl" cx="40" cy="15" r="5"/><circle class="bl" cx="47" cy="9" r="4.2"/><circle class="bl" cx="35" cy="24" r="4.6"/>
    <circle class="lf3" cx="40" cy="15" r="1.6"/><circle class="lf3" cx="35" cy="24" r="1.4"/>${POT_SVG}`,
  palm: `<path class="st" d="M32 42V20M32 42C28 30 22 22 12 18M32 42c4-12 10-20 20-24"/>
    <path class="lf" d="M32 22c-2-8 0-15 4-20 3 7 1 14-4 20zM14 19c-7-4-10-10-9-15 6 1 10 6 9 15z"/><path class="lf2" d="M50 18c7-4 10-10 9-15-6 1-10 6-9 15zM22 26c-9 0-15-4-17-8 7-2 13 1 17 8zM42 26c9 0 15-4 17-8-7-2-13 1-17 8z"/>${POT_SVG}`,
  flowering: `<ellipse class="lf2" cx="20" cy="37" rx="9" ry="5" transform="rotate(-20 20 37)"/><ellipse class="lf2" cx="44" cy="37" rx="9" ry="5" transform="rotate(20 44 37)"/>
    <ellipse class="lf" cx="32" cy="33" rx="10" ry="7"/><circle class="bl" cx="24" cy="24" r="5"/><circle class="bl" cx="38" cy="21" r="5.5"/><circle class="bl" cx="31" cy="14" r="4.5"/>
    <circle class="ye" cx="24" cy="24" r="1.6"/><circle class="ye" cx="38" cy="21" r="1.8"/><circle class="ye" cx="31" cy="14" r="1.5"/>${POT_SVG}`,
  herbs: `<path class="st" d="M24 42c0-8-2-14-6-19M32 42V18M40 42c0-8 2-14 6-19"/>
    <ellipse class="lf" cx="18" cy="22" rx="5" ry="6.5" transform="rotate(-25 18 22)"/><ellipse class="lf2" cx="32" cy="14" rx="5" ry="7"/><ellipse class="lf" cx="46" cy="22" rx="5" ry="6.5" transform="rotate(25 46 22)"/>
    <ellipse class="lf3" cx="25" cy="31" rx="4.5" ry="5.5" transform="rotate(-35 25 31)"/><ellipse class="lf3" cx="39" cy="31" rx="4.5" ry="5.5" transform="rotate(35 39 31)"/>${POT_SVG}`,
  // Alocasia: arrow-shaped leaves on long stems
  arrow: `<path class="st" d="M32 44C30 34 24 26 18 21M32 44V16M32 44c2-10 8-18 14-23"/>
    <path class="lf2" transform="translate(17 17) rotate(-32) scale(1.15)" d="M0-12c7 6 8 16 6 21L0 5l-6 4c-2-5-1-15 6-21z"/>
    <path class="lf" transform="translate(32 11) scale(1.25)" d="M0-12c7 6 8 16 6 21L0 5l-6 4c-2-5-1-15 6-21z"/>
    <path class="lf2" transform="translate(47 17) rotate(32) scale(1.15)" d="M0-12c7 6 8 16 6 21L0 5l-6 4c-2-5-1-15 6-21z"/>
    <path class="vein" d="M32 1v16M17 7l2 13M47 7l-2 13"/>${POT_SVG}`,
  // Monstera: big split leaves
  split: `<path class="st" d="M30 44c-1-8-3-12-6-15M34 44c2-6 5-9 9-11"/>
    <path class="lf" d="M24 4c11 0 18 8 17 17-1 8-8 12-15 12-9 0-16-6-16-15C10 10 16 4 24 4z"/>
    <path class="lf2" d="M45 22c7 0 11 5 10 11-1 5-5 8-10 8-6 0-10-4-10-10 0-5 4-9 10-9z"/>
    <path class="cut" d="M12 14l7 3M11 22l8 0M15 29l6-4M37 10l-6 5M40 19l-7 1M43 26l4 2M54 29l-5 1M51 37l-4-3"/>${POT_SVG}`,
  // Philodendron: heart-shaped leaves hanging from the stems
  heart: `<path class="st" d="M32 44C29 34 24 26 20 21M32 44V14M32 44c3-10 8-17 12-22"/>
    <path class="lf2" transform="translate(19 24) rotate(18) scale(1.25)" d="M0 10C-9 4-11-6-5-9c3-1 5 1 5 3 0-2 2-4 5-3 6 3 4 13-5 19z"/>
    <path class="lf" transform="translate(32 18) scale(1.35)" d="M0 10C-9 4-11-6-5-9c3-1 5 1 5 3 0-2 2-4 5-3 6 3 4 13-5 19z"/>
    <path class="lf2" transform="translate(45 25) rotate(-18) scale(1.25)" d="M0 10C-9 4-11-6-5-9c3-1 5 1 5 3 0-2 2-4 5-3 6 3 4 13-5 19z"/>
    <path class="vein" d="M32 11v17"/>${POT_SVG}`,
  // Aglaonema, dieffenbachia, peace lily: upright variegated leaves
  upright: `<g><ellipse class="lf2" cx="32" cy="22" rx="5" ry="13" transform="rotate(-42 32 44)"/><ellipse class="lf" cx="32" cy="20" rx="5.5" ry="14" transform="rotate(-20 32 44)"/>
    <ellipse class="lf2" cx="32" cy="22" rx="5" ry="13" transform="rotate(42 32 44)"/><ellipse class="lf" cx="32" cy="20" rx="5.5" ry="14" transform="rotate(20 32 44)"/>
    <ellipse class="lf" cx="32" cy="17" rx="6" ry="15"/>
    <ellipse class="lf3" cx="32" cy="18" rx="2.2" ry="10"/><ellipse class="lf3" cx="32" cy="22" rx="2" ry="8" transform="rotate(-20 32 44)"/><ellipse class="lf3" cx="32" cy="22" rx="2" ry="8" transform="rotate(20 32 44)"/></g>${POT_SVG}`,
  // Ficus, radermachera: a small tree
  tree: `<path class="trunk" d="M30 44V28h4v16z"/><path class="st" d="M32 30l-6-5M32 27l6-5"/>
    <circle class="lf2" cx="22" cy="20" r="9"/><circle class="lf2" cx="43" cy="19" r="9"/><circle class="lf" cx="32" cy="12" r="10"/>
    <circle class="lf" cx="26" cy="25" r="7"/><circle class="lf" cx="39" cy="25" r="7"/><circle class="lf3" cx="29" cy="9" r="3"/><circle class="lf3" cx="41" cy="16" r="2.5"/>${POT_SVG}`,
  // Calathea, stromanthe, ctenanthe: oval patterned leaves
  prayer: `<ellipse class="lf2" cx="32" cy="22" rx="7" ry="13" transform="rotate(-38 32 44)"/><ellipse class="lf2" cx="32" cy="22" rx="7" ry="13" transform="rotate(38 32 44)"/>
    <ellipse class="lf" cx="32" cy="18" rx="8" ry="15"/>
    <path class="vein" d="M32 4v28M32 10l-5 3M32 10l5 3M32 17l-6 3M32 17l6 3M32 24l-5 3M32 24l5 3"/>
    <path class="vein" transform="rotate(-38 32 44)" d="M32 11v22"/><path class="vein" transform="rotate(38 32 44)" d="M32 11v22"/>${POT_SVG}`,
  // Coleus: colorful leaves
  coleus: `<path class="st" d="M32 44V20M32 34l-9-6M32 30l9-7"/>
    <ellipse class="co" cx="20" cy="26" rx="8" ry="6" transform="rotate(-25 20 26)"/><ellipse class="co" cx="44" cy="23" rx="8" ry="6" transform="rotate(25 44 23)"/>
    <ellipse class="co" cx="24" cy="13" rx="6.5" ry="8.5" transform="rotate(-20 24 13)"/><ellipse class="co" cx="40" cy="11" rx="6.5" ry="8.5" transform="rotate(20 40 11)"/>
    <ellipse class="co" cx="32" cy="7" rx="5" ry="6.5"/>${POT_SVG}`,
  cutting: `<path class="gl" d="M20 26h24v30a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4z"/><path class="jar" d="M20 24v32a4 4 0 0 0 4 4h16a4 4 0 0 0 4-4V24"/>
    <path class="rt" d="M32 50c-2 3-4 5-7 6M32 50c1 3 3 5 6 6M32 50v7"/><path class="st" d="M32 50V14"/>
    <ellipse class="lf" cx="25" cy="16" rx="7" ry="4" transform="rotate(25 25 16)"/><ellipse class="lf2" cx="39" cy="10" rx="7" ry="4" transform="rotate(-25 39 10)"/>`,
};

// Catalog plants by id; others are guessed from the name and what they grow in.
const SHAPE_BY_ID = {
  'g-easy': 'trailing', 'g-humid': 'prayer', 'g-succ': 'succulent', 'g-cactus': 'cactus', 'g-flower': 'flowering', 'g-orchid': 'orchid', 'g-herbs': 'herbs',
  'alo-regal': 'arrow', 'alo-black': 'arrow', 'alo-cuc': 'arrow', 'alo-polly': 'arrow', 'alo-silver': 'arrow',
  'mon-del': 'split', 'mon-adan': 'trailing', 'phi-eru': 'heart', 'phi-birkin': 'heart', 'phi-congo': 'heart',
  'agl-siam': 'upright', 'agl-silver': 'upright', 'agl-pink': 'upright', 'dif-camille': 'upright', 'dif-gm': 'upright', spath: 'upright', zz: 'upright',
  'stro-tri': 'prayer', cten: 'prayer', ficus: 'tree', raderm: 'tree', anth: 'flowering', coleus1: 'coleus', coleus2: 'coleus',
  chamae: 'palm', rhapis: 'palm', strel1: 'palm', kolya: 'palm', banana: 'palm', phal: 'orchid', cuttings: 'cutting',
};
function shapeOf(d) {
  if (!d) return 'leafy';
  if (SHAPE_BY_ID[d.id]) return SHAPE_BY_ID[d.id];
  const s = String(d.species || '').toLowerCase();
  if (d.type === 'water' || /черен/.test(s)) return 'cutting';
  if (d.type === 'bark' || /орхид|фаленопс|дендроб/.test(s)) return 'orchid';
  if (/кактус|опунц|маммил|эхинок/.test(s)) return 'cactus';
  if (d.type === 'dry' || /суккул|эхевер|хаворт|алоэ|толстян|каланхо|сансев/.test(s)) return 'succulent';
  if (/пальм|стрелиц|драцен|юкк|банан|хамедор|рапис/.test(s)) return 'palm';
  if (/алоказ|колоказ|ксантосом/.test(s)) return 'arrow';
  if (/монстер|ракафор/.test(s)) return 'split';
  if (/филодендр/.test(s)) return 'heart';
  if (/аглаонем|диффенбах|спатифил|замиокул|аспидистр/.test(s)) return 'upright';
  if (/фикус|радермах|дерев|лимон|оливк|кофе|мирт|лавр/.test(s)) return 'tree';
  if (/калате|строман|ктенант|марант/.test(s)) return 'prayer';
  if (/колеус/.test(s)) return 'coleus';
  if (/потос|сциндапс|хойя|плющ|традеск|пеперон|филодендрон скан/.test(s)) return 'trailing';
  if (/фиалк|бегони|гербер|цвет|роз|герань|пеларгон|антуриум/.test(s)) return 'flowering';
  if (/базилик|мят|петруш|укроп|розмарин|тимьян|рассад|зелень/.test(s)) return 'herbs';
  return 'leafy';
}
const plantSvg = (d) => `<svg class="pl" viewBox="0 0 64 64" aria-hidden="true">${SHAPES[shapeOf(d)]}</svg>`;
