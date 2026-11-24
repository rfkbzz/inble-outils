// Moteur de mots fléchés — port JS du moteur de KHAO (atelier/kdp-fleches/moteur.py), sans dépendance.
// Utilisable dans le navigateur (window.MF) et dans Node (module.exports).
(function (root) {
  "use strict";

  // Générateur pseudo-aléatoire à graine (mulberry32) : mêmes graines = mêmes grilles.
  function rngFrom(seed) {
    let a = seed >>> 0;
    const f = function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.int = (n) => Math.floor(f() * n);
    f.choice = (arr) => arr[f.int(arr.length)];
    f.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = f.int(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
    return f;
  }

  function norm(s) {
    return s.normalize("NFD").toUpperCase().replace(/[^A-Z]/g, "");
  }

  // Texte « MOT|déf 1;déf 2 » -> { MOT: [déf...] }
  function parseLexique(texte) {
    const lex = {};
    for (let ligne of texte.split(/\r?\n/)) {
      ligne = ligne.trim();
      if (!ligne || ligne[0] === "#" || ligne.indexOf("|") < 0) continue;
      const i = ligne.indexOf("|");
      const mot = norm(ligne.slice(0, i));
      const ds = ligne.slice(i + 1).split(";").map((d) => d.trim()).filter(Boolean);
      if (mot.length < 2 || !ds.length) continue;
      if (!lex[mot]) lex[mot] = [];
      for (const d of ds) if (!lex[mot].includes(d)) lex[mot].push(d);
    }
    return lex;
  }

  // Emplacements des mots d'un gabarit ; null si invalide.
  function slotsDuGabarit(g, R, C) {
    const slots = [];
    const inRun = Array.from({ length: R }, () => new Array(C).fill(false));
    for (let r = 0; r < R; r++) {
      let c = 0;
      while (c < C) {
        if (g[r][c] !== "#") {
          let d = c;
          while (d < C && g[r][d] !== "#") d++;
          const L = d - c;
          if (L >= 2) {
            if (c !== 0 && g[r][c - 1] !== "#") return null;
            if (c === 0) return null;
            slots.push([r, c, "H", L]);
            for (let k = c; k < d; k++) inRun[r][k] = true;
          }
          c = d;
        } else c++;
      }
    }
    for (let c = 0; c < C; c++) {
      let r = 0;
      while (r < R) {
        if (g[r][c] !== "#") {
          let d = r;
          while (d < R && g[d][c] !== "#") d++;
          const L = d - r;
          if (L >= 2) {
            if (r === 0) return null;
            slots.push([r, c, "V", L]);
            for (let k = r; k < d; k++) inRun[k][c] = true;
          }
          r = d;
        } else r++;
      }
    }
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (g[r][c] !== "#" && !inRun[r][c]) return null;
    return slots;
  }

  function gabaritReseau(R, C, rng, maxlen, maxDiese) {
    const a = rng.choice([1, 2, 3]), b = rng.choice([1, 2, 3]), m = rng.choice([4, 5, 6]), o = rng.int(m);
    const g = [];
    for (let r = 0; r < R; r++) {
      g.push([]);
      for (let c = 0; c < C; c++) g[r].push(r === 0 || c === 0 || (a * r + b * c + o) % m === 0 ? "#" : ".");
    }
    for (let k = 0; k < 6; k++) {
      const r = 1 + rng.int(R - 1), c = 1 + rng.int(C - 1);
      const old = g[r][c];
      g[r][c] = old === "." ? "#" : ".";
      if (slotsDuGabarit(g, R, C) === null) g[r][c] = old;
    }
    const s = slotsDuGabarit(g, R, C);
    if (!s || s.some((x) => x[3] > maxlen)) return null;
    let n = 0; for (const row of g) for (const x of row) if (x === "#") n++;
    if (n / (R * C) > maxDiese) return null;
    return { g, s };
  }

  function scoreGabarit(s) {
    const n = s.length;
    const courts = s.filter((x) => x[3] <= 3).length;
    return courts / n - (0.3 * s.filter((x) => x[3] >= 4 && x[3] <= 6).length) / n;
  }

  // Nombre de mots imposés qu'un gabarit peut accueillir (un emplacement par mot, longueurs égales).
  function capacite(slots, imposes) {
    const dispo = {};
    for (const x of slots) dispo[x[3]] = (dispo[x[3]] || 0) + 1;
    let n = 0;
    for (const m of imposes) if (dispo[m.length] > 0) { dispo[m.length]--; n++; }
    return n;
  }

  function meilleurGabarit(R, C, rng, tirages, maxlen, maxDiese, imposes) {
    let best = null, bs = 99;
    for (let i = 0; i < tirages; i++) {
      const t = gabaritReseau(R, C, rng, maxlen, maxDiese);
      if (!t) continue;
      let sc = scoreGabarit(t.s);
      if (imposes && imposes.length) sc -= 2 * capacite(t.s, imposes) / imposes.length; // accueillir les mots imposés d'abord
      if (sc < bs) { best = t; bs = sc; }
    }
    return best;
  }

  // Remplissage par retour arrière (heuristique du slot le plus contraint). limiteMs = temps max.
  function remplir(g, slots, lex, rng, limiteMs, interdits, imposes, sautsMax) {
    const R = g.length, C = g[0].length;
    const cases = slots.map(([r, c, d, L]) => Array.from({ length: L }, (_, k) => (d === "H" ? [r, c + k] : [r + k, c])));
    const grille = Array.from({ length: R }, () => new Array(C).fill(null));
    const parLong = {};
    for (const m of Object.keys(lex)) if (!interdits || !interdits.has(m)) (parLong[m.length] = parLong[m.length] || []).push(m);
    const utilises = new Set();
    const choix = new Map();
    const t0 = Date.now();

    const poses = [];
    const ordreImp = imposes && imposes.length ? rng.shuffle(imposes.slice()).sort((x, y) => y.length - x.length) : [];

    function candidats(i) {
      const cs = cases[i];
      const pat = cs.map(([r, c]) => grille[r][c]);
      const res = [];
      for (const m of parLong[cs.length] || []) {
        if (utilises.has(m)) continue;
        let ok = true;
        for (let k = 0; k < pat.length; k++) if (pat[k] !== null && pat[k] !== m[k]) { ok = false; break; }
        if (ok) res.push(m);
      }
      return res;
    }

    function dfs() {
      if (Date.now() - t0 > limiteMs) return false;
      let meilleur = -1, mc = null;
      let reste = 0;
      for (let i = 0; i < slots.length; i++) {
        if (choix.has(i)) continue;
        reste++;
        const cd = candidats(i);
        if (!cd.length) { if (typeof process !== 'undefined' && process.env.MF_DEBUG2) console.error('slot sans candidat', slots[i].join(','), cases[i].map(([r, c]) => grille[r][c] || '.').join(''), 'choisis', choix.size); return false; }
        if (mc === null || cd.length < mc.length) { meilleur = i; mc = cd; if (cd.length === 1) break; }
      }
      if (!reste) return true;
      rng.shuffle(mc);
      for (const m of mc.slice(0, 40)) {
        const sauve = cases[meilleur].map(([r, c]) => [r, c, grille[r][c]]);
        cases[meilleur].forEach(([r, c], k) => { grille[r][c] = m[k]; });
        choix.set(meilleur, m); utilises.add(m);
        if (dfs()) return true;
        utilises.delete(m); choix.delete(meilleur);
        for (const [r, c, v] of sauve) grille[r][c] = v;
        if (Date.now() - t0 > limiteMs) return false;
      }
      return false;
    }

    // Mots imposés : recherche avec retour arrière. Chaque mot est posé dans un emplacement de sa longueur
    // (anticipation : les emplacements croisés doivent garder un mot possible), puis on remplit le reste.
    // Un mot qui ne peut pas être posé est sauté en dernier recours.
    let nbDfs = 0, sauts = 0;
    function poserImposes(idx) {
      if (Date.now() - t0 > limiteMs || nbDfs > 12) return false;
      if (idx >= ordreImp.length) { if (++nbDfs > 12) return false; return dfs(); }
      const m = ordreImp[idx];
      const libres = [];
      for (let i = 0; i < slots.length; i++) {
        if (choix.has(i) || cases[i].length !== m.length) continue;
        let ok = true;
        for (let k = 0; k < m.length; k++) { const v = grille[cases[i][k][0]][cases[i][k][1]]; if (v !== null && v !== m[k]) { ok = false; break; } }
        if (ok) libres.push(i);
      }
      rng.shuffle(libres);
      if (!utilises.has(m)) for (const i of libres.slice(0, 8)) {
        const sauve = cases[i].map(([r, c]) => [r, c, grille[r][c]]);
        cases[i].forEach(([r, c], k) => { grille[r][c] = m[k]; });
        choix.set(i, m); utilises.add(m); poses.push(m);
        let viable = true;
        for (let j = 0; j < slots.length && viable; j++) {
          if (choix.has(j)) continue;
          if (!cases[j].some(([r, c]) => cases[i].some(([r2, c2]) => r === r2 && c === c2))) continue;
          if (!candidats(j).length) viable = false;
        }
        if (viable && poserImposes(idx + 1)) return true;
        poses.pop(); utilises.delete(m); choix.delete(i);
        for (const [r, c, v] of sauve) grille[r][c] = v;
        if (Date.now() - t0 > limiteMs) return false;
      }
      if (sauts >= (sautsMax || 0)) return false;
      sauts++;
      const r = poserImposes(idx + 1); // mot sauté
      sauts--;
      return r;
    }

    const okDfs = poserImposes(0);
    if (typeof process !== 'undefined' && process.env.MF_DEBUG) console.error('pose', poses.length + '/' + ordreImp.length, 'ok', okDfs, Date.now() - t0 + 'ms');
    if (!okDfs) return null;
    const mots = slots.map((s, i) => ({ r: s[0], c: s[1], dir: s[2], len: s[3], mot: choix.get(i) }));
    return { grille, mots, poses };
  }

  // Place les définitions : chaque mot a sa case-définition juste avant (à gauche si H, au-dessus si V).
  // Une case # peut porter 2 définitions (une H, une V). Renvoie defs[r][c] = [{dir, texte}].
  function placerDefinitions(g, mots, lex, rng) {
    const R = g.length, C = g[0].length;
    const defs = Array.from({ length: R }, () => Array.from({ length: C }, () => []));
    const dejaVu = new Map(); // mot -> index de définition utilisée (varier si le mot revient)
    for (const w of mots) {
      const [dr, dc] = w.dir === "H" ? [w.r, w.c - 1] : [w.r - 1, w.c];
      const options = lex[w.mot] || [];
      const texte = options.length ? options[rng.int(options.length)] : "?";
      defs[dr][dc].push({ dir: w.dir, texte, mot: w.mot });
    }
    return defs;
  }

  // API : faireGrille({R, C, lex, seed, maxlen, maxDiese, limiteMs, essais, interdits, imposes})
  // imposes = mots à placer en priorité (prénoms, thème). Résultat : .placesImposes / .manquants.
  function faireGrille(opt) {
    const R = opt.R || 9, C = opt.C || 8;
    const rng = opt.rng || rngFrom(opt.seed || 1);
    const imposes = [...new Set((opt.imposes || []).map(norm).filter((m) => m.length >= 2 && m.length < Math.max(R, C)))].filter((m) => opt.lex[m]);
    const plusLong = imposes.reduce((a, m) => Math.max(a, m.length), 0);
    const maxlen = opt.maxlen || Math.max(7, plusLong), maxDiese = opt.maxDiese || 0.42;
    const essais = opt.essais || 60, limiteMs = opt.limiteMs || 1500;
    let meilleure = null;
    const tDebut = Date.now(), budget = opt.budgetMs || 5000;
    if (!imposes.length) {
      for (let i = 0; i < essais; i++) {
        const t = meilleurGabarit(R, C, rng, i < 10 ? 40 : 6, maxlen, maxDiese, imposes);
        if (!t) continue;
        const rem = remplir(t.g, t.s, opt.lex, rng, limiteMs, opt.interdits, []);
        if (rem) { meilleure = { t, rem, places: [] }; break; }
      }
    } else {
      // Redémarrages rapides (échec vite, nouveau gabarit) : bien plus efficace qu'une longue recherche.
      // Au début tous les mots imposés sont exigés ; plus le temps passe, plus on tolère de mots sautés.
      let i = 0;
      while (Date.now() - tDebut < budget) {
        const frac = (Date.now() - tDebut) / budget;
        const mini = Math.ceil(imposes.length / 3), niveaux = imposes.length - mini + 1;
        const k = imposes.length - Math.min(niveaux - 1, Math.floor(frac * niveaux)); // on exige un peu moins de mots à chaque palier
        const sous = rng.shuffle(imposes.slice()).slice(0, k);
        const t = meilleurGabarit(R, C, rng, 4, maxlen, maxDiese, imposes);
        i++;
        if (!t) continue;
        const rem = remplir(t.g, t.s, opt.lex, rng, opt.tentativeMs || 40, opt.interdits, sous, 0);
        if (!rem) continue;
        const dansGrille = new Set(rem.mots.map((w) => w.mot));
        const places = imposes.filter((m) => dansGrille.has(m));
        if (!meilleure || places.length > meilleure.places.length) meilleure = { t, rem, places };
        if (places.length === imposes.length) break;
      }
    }
    if (!meilleure && imposes.length) {
      for (let i = 0; i < essais && !meilleure; i++) {
        const t = meilleurGabarit(R, C, rng, 6, maxlen, maxDiese, []);
        const rem = t && remplir(t.g, t.s, opt.lex, rng, limiteMs, opt.interdits, []);
        if (rem) meilleure = { t, rem, places: [] };
      }
    }
    if (!meilleure) return null;
    const { t, rem, places } = meilleure;
    const defs = placerDefinitions(t.g, rem.mots, opt.lex, rng);
    return { R, C, gabarit: t.g, lettres: rem.grille, mots: rem.mots, defs, imposes, placesImposes: places, manquants: imposes.filter((m) => !places.includes(m)) };
  }

  const MF = { rngFrom, norm, parseLexique, faireGrille, slotsDuGabarit };
  if (typeof module !== "undefined" && module.exports) module.exports = MF;
  else root.MF = MF;
})(typeof window !== "undefined" ? window : this);
