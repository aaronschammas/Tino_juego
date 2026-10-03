// Arte de los objetos de cada escenario. Cada objeto tiene dos estados: con el problema y resuelto.
import { paintSprite } from './pixel.js';
import { getTreeSprite, TREE_ANCHOR } from './sprites.js';

const C = {
  ink: '#1a1c2c',
  metal: '#3a3f4b', metalDark: '#2b2f38', metalLight: '#565c6b', slot: '#1d2027',
  red: '#e53935', green: '#38d36b', yellow: '#ffcd75', white: '#f4f4f4', light: '#e3f2fd',
  wood: '#8a5a32', woodDark: '#6b4226', woodDeep: '#5e3a1f', woodLight: '#a1887f',
  leaf: '#4caf50', leafLight: '#66bb6a', leafDark: '#2e7d32', dry: '#8d6e3a', dryLight: '#a1887f',
  soil: '#6d4c41', soilTop: '#8d6e63', pot: '#b5651d', potRim: '#cd7f32',
  steel: '#b0bec5', steelDark: '#90a4ae', steelDeep: '#78909c', counter: '#cfd8dc',
  water: '#3b7dd8', waterLight: '#73b3f0', grey: '#9e9e9e', greyLight: '#bdbdbd', dust: '#d6d6d6',
  rug: '#c0392b', rugGold: '#f1c40f', bin: '#5c6b73', binLid: '#455a64', bag: '#2b2b2b',
  screen: '#6fb3ff', sofa: '#5c6bc0', sofaLight: '#7986cb', tomato: '#e53935', flower: '#ff6fa5',
};

/** Rack de servidores: LEDs rojos y quemado arriba cuando hay incendio. */
function servidor(bad) {
  return paintSprite(16, 28, (px) => {
    px(3, 4, 10, 22, C.metal);
    px(10, 4, 3, 22, C.metalDark);
    px(3, 3, 10, 1, C.metalLight);
    for (let i = 0; i < 5; i++) {
      px(4, 7 + i * 4, 6, 2, C.slot);
      px(5, 7 + i * 4, 1, 1, bad ? C.red : C.green);
      px(7, 7 + i * 4, 1, 1, bad && i % 2 ? C.red : C.green);
    }
    if (bad) px(3, 3, 10, 3, '#151515');
    px(4, 26, 2, 2, C.slot);
    px(10, 26, 2, 2, C.slot);
  });
}

/** Escritorio con monitor; con `phone`, un teléfono que se pone rojo cuando suena. */
function escritorio(bad, phone = true, screenAlert = false) {
  return paintSprite(24, 18, (px) => {
    px(15, 0, 7, 5, C.metalDark);
    px(16, 1, 5, 3, screenAlert ? C.red : C.screen);
    if (screenAlert) px(18, 1, 1, 2, C.white);
    px(18, 5, 1, 3, C.metalDark);
    px(2, 8, 20, 3, C.wood);
    px(2, 11, 20, 2, C.woodDark);
    px(3, 13, 2, 5, C.woodDeep);
    px(19, 13, 2, 5, C.woodDeep);
    if (phone) {
      px(5, 5, 7, 3, bad ? C.red : C.metal);
      px(4, 4, 9, 1, bad ? '#b71c1c' : C.metalDark);
    }
  });
}

/** Planta en maceta: mustia o verde con flor. */
function planta(bad) {
  return paintSprite(12, 18, (px) => {
    if (bad) {
      px(5, 8, 2, 4, '#7a5a2a');
      px(2, 10, 3, 1, C.dry);
      px(7, 10, 3, 1, C.dry);
      px(3, 9, 2, 1, C.dryLight);
      px(7, 9, 2, 1, C.dryLight);
    } else {
      px(5, 4, 2, 8, C.leafDark);
      px(2, 5, 3, 2, C.leaf);
      px(7, 3, 3, 2, C.leaf);
      px(2, 8, 3, 2, C.leafLight);
      px(7, 7, 3, 2, C.leafLight);
      px(5, 1, 2, 2, C.flower);
    }
    px(2, 11, 8, 2, C.potRim);
    px(3, 13, 6, 4, C.pot);
  });
}

/** Cocina con sartén: quemada cuando está en llamas. */
function sarten(bad) {
  return paintSprite(18, 20, (px) => {
    px(1, 6, 16, 13, '#e8e8e8');
    px(12, 6, 5, 13, '#c9c9c9');
    px(1, 5, 16, 1, C.grey);
    px(3, 10, 10, 7, C.metalDark);
    px(4, 11, 8, 3, '#45505e');
    px(3, 7, 1, 1, C.ink);
    px(6, 7, 1, 1, C.ink);
    px(4, 3, 9, 2, bad ? '#151515' : '#555b66');
    px(13, 4, 4, 1, '#3e2723');
  });
}

/** Tacho de basura: desbordado y abierto, o tapado y limpio. */
function basura(bad) {
  return paintSprite(14, 18, (px) => {
    px(2, 6, 10, 11, C.bin);
    px(9, 6, 3, 11, '#4a575e');
    if (bad) {
      px(2, 2, 10, 5, C.bag);
      px(4, 1, 4, 1, C.bag);
      px(8, 0, 5, 2, C.binLid);
      px(0, 15, 3, 2, '#8d6e63');
      px(11, 16, 3, 1, '#c0ca33');
    } else {
      px(1, 4, 12, 2, C.binLid);
      px(6, 3, 2, 1, C.binLid);
    }
  });
}

/** Mesada con pileta: montaña de platos sucios o una pila prolija. */
function platos(bad) {
  return paintSprite(20, 18, (px) => {
    px(1, 8, 18, 9, C.counter);
    px(13, 8, 6, 9, C.steel);
    px(0, 6, 20, 2, C.steelDark);
    px(4, 6, 8, 2, C.steelDeep);
    px(14, 1, 2, 5, C.steel);
    px(11, 1, 4, 1, C.steel);
    if (bad) {
      for (let i = 0; i < 6; i++) px(4 + (i % 2), 5 - i, 8, 1, i % 2 ? C.white : '#e0e0e0');
      px(6, 3, 2, 1, '#8d6e63');
      px(9, 1, 2, 1, C.dryLight);
      px(5, 0, 2, 1, '#8d6e63');
    } else {
      px(5, 4, 6, 2, '#ffffff');
      px(5, 3, 6, 1, C.light);
    }
  });
}

/** Alfombra del living: gris de polvo con montaña de mugre, o limpia y colorida. */
function polvo(bad) {
  return paintSprite(24, 12, (px) => {
    for (let r = 0; r < 12; r++) {
      const hw = r < 6 ? 2 * (r + 1) : 2 * (12 - r);
      px(12 - hw, r, hw * 2, 1, bad ? C.grey : C.rug);
    }
    if (bad) {
      px(8, 3, 8, 4, C.greyLight);
      px(10, 1, 4, 2, C.dust);
    } else {
      px(8, 5, 8, 2, C.rugGold);
      px(10, 4, 4, 4, C.rugGold);
    }
  }, null);
}

/** Canilla del jardín: abierta con charco o cerrada y seca. */
function canilla(bad) {
  return paintSprite(16, 22, (px) => {
    if (bad) {
      px(0, 18, 16, 4, C.water);
      px(2, 19, 5, 1, C.waterLight);
      px(10, 20, 4, 1, C.waterLight);
    }
    px(6, 6, 4, 14, C.woodLight);
    px(8, 6, 2, 14, '#8d6e63');
    px(4, 6, 8, 2, C.steel);
    px(4, 8, 2, 3, C.steel);
    px(8, 3, 2, 3, bad ? C.red : C.green);
  });
}

/** Cantero de la huerta: plantas secas o verdes con tomates. */
function huerta(bad) {
  return paintSprite(24, 14, (px) => {
    px(0, 7, 24, 2, C.soilTop);
    px(1, 9, 22, 4, C.soil);
    for (const x of [3, 9, 15, 21]) {
      if (bad) {
        px(x, 4, 1, 3, C.dryLight);
        px(x - 1, 4, 1, 1, '#bcaaa4');
      } else {
        px(x, 2, 1, 5, C.leafDark);
        px(x - 1, 3, 3, 2, '#43a047');
        px(x + 1, 2, 1, 1, C.tomato);
      }
    }
  });
}

/** Pasto: altísimo o cortado con florcitas. */
function pasto(bad) {
  return paintSprite(20, 16, (px) => {
    if (bad) {
      for (let i = 0; i < 10; i++) {
        const x = i * 2;
        const h = 8 + ((i * 7) % 5);
        px(x, 16 - h, 1, h, '#558b2f');
        px(x + 1, 18 - h, 1, h - 2, '#7cb342');
      }
    } else {
      px(1, 12, 18, 3, '#7cb342');
      for (let x = 2; x < 18; x += 3) px(x, 11, 1, 1, '#9ccc65');
      px(5, 10, 1, 1, '#fff59d');
      px(13, 10, 1, 1, '#f48fb1');
    }
  }, bad ? '#1d3324' : null);
}

/** Tramo de cerca: con tablas caídas o derecha. */
function cerca(bad) {
  return paintSprite(24, 16, (px) => {
    px(2, 4, 2, 12, '#8d6e63');
    if (bad) {
      px(0, 6, 10, 2, C.woodLight);
      px(0, 11, 8, 2, C.woodLight);
      px(12, 13, 9, 2, C.woodLight);
      px(16, 10, 7, 2, '#8d6e63');
    } else {
      px(20, 4, 2, 12, '#8d6e63');
      px(0, 6, 24, 2, C.woodLight);
      px(0, 11, 24, 2, C.woodLight);
    }
  });
}


/** Impresora: quemada arriba cuando está en llamas. */
function impresora(bad) {
  return paintSprite(18, 16, (px) => {
    px(1, 6, 16, 8, C.counter);
    px(12, 6, 5, 8, C.steel);
    px(3, 3, 12, 3, '#eceff1');
    px(5, 1, 8, 2, '#ffffff');
    px(3, 9, 12, 1, C.metalDark);
    px(13, 7, 2, 1, bad ? C.red : C.green);
    if (bad) px(1, 3, 16, 3, '#151515');
    px(2, 14, 2, 2, C.slot);
    px(14, 14, 2, 2, C.slot);
  });
}

/** Archivero metálico: con un cajón abierto y papeles cuando se prende fuego. */
function archivo(bad) {
  return paintSprite(14, 22, (px) => {
    px(1, 3, 12, 18, '#bcaaa4');
    px(9, 3, 4, 18, '#a1887f');
    for (let i = 0; i < 3; i++) {
      px(2, 5 + i * 6, 10, 1, '#8d6e63');
      px(6, 7 + i * 6, 2, 1, '#5d4037');
    }
    if (bad) {
      px(1, 3, 12, 2, '#151515');
      px(2, 9, 10, 3, '#ffffff');
    }
  });
}

/** Mancha o pila en el piso (escombros, tóner, hollín); resuelta no deja nada. */
function mancha(colors, pile) {
  return (bad) => {
    if (!bad) return paintSprite(1, 1, () => {}, null);
    return paintSprite(24, 12, (px) => {
      for (let r = 0; r < 12; r++) {
        const hw = (r < 6 ? 2 * (r + 1) : 2 * (12 - r)) - 2;
        if (hw > 0) px(12 - hw, r, hw * 2, 1, colors[0]);
      }
      px(6, 4, 3, 2, colors[1]);
      px(14, 6, 4, 2, colors[1]);
      if (pile) {
        px(8, 1, 8, 5, colors[1]);
        px(10, 0, 3, 2, colors[2]);
        px(14, 3, 3, 2, colors[2]);
      }
    }, null);
  };
}

/** Ventana con cortinas: rojas o quemadas. */
function cortinas(bad) {
  return paintSprite(16, 24, (px) => {
    px(2, 2, 12, 14, '#90caf9');
    px(2, 8, 12, 1, C.woodDark);
    px(7, 2, 1, 14, C.woodDark);
    px(1, 1, 14, 1, C.woodDark);
    px(1, 16, 14, 2, C.woodDark);
    const curtain = bad ? '#3e2723' : '#c0392b';
    px(0, 0, 4, 22, curtain);
    px(12, 0, 4, 22, curtain);
    if (bad) {
      px(1, 6, 2, 3, '#ef7d57');
      px(13, 10, 2, 3, '#ef7d57');
    }
  });
}

/** Cucarachas: mancha marrón en el piso (los bichos se dibujan aparte). */
function cucarachas(bad) {
  if (!bad) return paintSprite(1, 1, () => {}, null);
  return paintSprite(20, 10, (px) => {
    px(4, 3, 12, 4, '#6d4c41');
    px(2, 4, 16, 2, '#6d4c41');
    px(8, 2, 5, 1, '#8d6e63');
  }, null);
}

/** Cama: revuelta o tendida. */
function cama(bad) {
  return paintSprite(22, 16, (px) => {
    px(0, 4, 3, 12, C.woodDark);
    px(1, 9, 20, 5, C.wood);
    px(2, 6, 18, 4, '#ffffff');
    px(3, 6, 5, 3, '#e3f2fd');
    if (bad) {
      px(9, 5, 10, 3, '#5c6bc0');
      px(12, 3, 6, 2, '#7986cb');
      px(6, 10, 4, 2, '#5c6bc0');
    } else {
      px(9, 6, 11, 4, '#5c6bc0');
      px(9, 6, 11, 1, '#7986cb');
    }
    px(1, 14, 2, 2, C.woodDeep);
    px(19, 14, 2, 2, C.woodDeep);
  });
}

/** Charco grande de la inundación; resuelto no deja nada. */
function inundacion(bad) {
  if (!bad) return paintSprite(1, 1, () => {}, null);
  return paintSprite(28, 14, (px) => {
    for (let r = 0; r < 14; r++) {
      const hw = r < 7 ? 2 * (r + 1) : 2 * (14 - r);
      px(14 - hw, r, hw * 2, 1, C.water);
    }
    px(8, 5, 5, 1, C.waterLight);
    px(15, 8, 6, 1, C.waterLight);
  }, null);
}

/** Caño de agua: reventado o sano. */
function cano(bad) {
  return paintSprite(14, 20, (px) => {
    px(5, 0, 4, bad ? 8 : 18, C.steelDeep);
    px(5, 0, 1, bad ? 8 : 18, C.steel);
    if (bad) {
      px(5, 12, 4, 6, C.steelDeep);
      px(3, 8, 3, 2, C.steelDark);
      px(8, 9, 3, 2, C.steelDark);
    }
    px(2, 17, 10, 3, C.metalDark);
  });
}

/** Parrilla: brasas encendidas o cenizas apagadas. */
function parrilla(bad) {
  return paintSprite(18, 18, (px) => {
    px(2, 9, 2, 9, C.ink);
    px(14, 9, 2, 9, C.ink);
    px(1, 5, 16, 5, '#37474f');
    px(1, 4, 16, 1, '#546e7a');
    for (let x = 2; x < 16; x += 3) px(x, 2, 2, 2, bad ? '#ff7043' : C.grey);
    px(1, 3, 16, 1, C.metalDark);
  });
}

/** Pasto seco que se prende fuego; apagado queda corto y oscuro. */
function pastizal(bad) {
  return paintSprite(20, 16, (px) => {
    if (bad) {
      for (let i = 0; i < 10; i++) {
        const x = i * 2;
        const h = 7 + ((i * 5) % 4);
        px(x, 16 - h, 1, h, '#c0a060');
        px(x + 1, 18 - h, 1, h - 2, '#e0c080');
      }
    } else {
      px(1, 12, 18, 3, '#4a5d23');
      for (let x = 2; x < 18; x += 4) px(x, 11, 1, 1, '#33421a');
    }
  }, bad ? '#3e2f1c' : null);
}

/** Cantero vacío para replantar: tierra sola o brotes nuevos. */
function semillas(bad) {
  return paintSprite(24, 14, (px) => {
    px(0, 7, 24, 2, C.soilTop);
    px(1, 9, 22, 4, C.soil);
    if (!bad) for (const x of [4, 10, 16, 21]) px(x, 5, 1, 2, '#9ccc65');
    else px(18, 2, 4, 5, '#d7ccc8');
  });
}

/** Sillón decorativo del living. */
function sofa() {
  return paintSprite(24, 14, (px) => {
    px(0, 4, 24, 8, C.sofa);
    px(2, 2, 20, 4, C.sofaLight);
    px(0, 2, 3, 10, C.sofa);
    px(21, 2, 3, 10, C.sofa);
    px(2, 12, 2, 2, C.woodDeep);
    px(20, 12, 2, 2, C.woodDeep);
  });
}

const ART = {
  servidor,
  impresora,
  archivo,
  escombros: mancha(['#5d5d66', '#8d8d96', '#3c3c46'], true),
  toner: mancha(['#1a1c2c', '#2b2f38', '#1a1c2c'], false),
  telefono: escritorio,
  mail: (bad) => escritorio(false, false, bad),
  planta,
  sarten,
  cortinas,
  hollin: mancha(['#2b2b2b', '#454545', '#1a1a1a'], false),
  basura,
  cucarachas,
  platos,
  polvo,
  cama,
  canilla,
  inundacion,
  cano,
  parrilla,
  pastizal,
  huerta,
  semillas,
  pasto,
  cerca,
};
const cache = new Map();

/** Sprite y ancla (píxel que se apoya en el centro del tile) de un objeto de tarea en un estado. */
export function getObjectArt(kind, solved) {
  const key = `${kind}|${solved}`;
  if (!cache.has(key)) {
    const canvas = ART[kind](!solved);
    cache.set(key, { canvas, anchor: { x: Math.floor(canvas.width / 2), y: canvas.height - 4 } });
  }
  return cache.get(key);
}

/** Sprite y ancla de los objetos decorativos (no tienen problema que resolver). */
export function getDecorArt(kind, seed = 0) {
  const key = `decor|${kind}|${seed}`;
  if (!cache.has(key)) {
    let art;
    if (kind === 'arbol') art = { canvas: getTreeSprite(seed % 3), anchor: TREE_ANCHOR };
    else {
      const canvas = kind === 'sofa' ? sofa() : escritorio(false, false);
      art = { canvas, anchor: { x: Math.floor(canvas.width / 2), y: canvas.height - 4 } };
    }
    cache.set(key, art);
  }
  return cache.get(key);
}

export const OBJECT_KINDS = Object.keys(ART);
