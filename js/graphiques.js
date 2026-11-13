/* DecotesGraphiques : composants graphiques en SVG et HTML, sans bibliothèque.
   Chaque composant reçoit des données déjà calculées et renvoie un élément prêt à insérer.
   Les couleurs viennent de classes CSS (.v1 à .v4, .v-muet…) définies dans style.css pour le thème clair
   et le thème sombre : aucun style en ligne, compatible avec la politique de sécurité de la page.
   Tout texte (noms de séries, libellés) est inséré avec textContent. */
(function (racine) {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const estNombre = (v) => typeof v === "number" && Number.isFinite(v);

  function s(balise, attrs, enfants) {
    const e = document.createElementNS(NS, balise);
    for (const [k, v] of Object.entries(attrs || {})) if (v !== null && v !== undefined) e.setAttribute(k, v);
    for (const c of [].concat(enfants || [])) if (c) e.append(c);
    return e;
  }
  function h(balise, attrs, enfants) {
    const e = document.createElement(balise);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "texte") e.textContent = v;
      else if (v !== null && v !== undefined) e.setAttribute(k, v);
    }
    for (const c of [].concat(enfants || [])) if (c) e.append(c);
    return e;
  }
  const texteSvg = (attrs, t) => { const e = s("text", attrs); e.textContent = t; return e; };

  /** Graduations « rondes » (1, 2, 2,5, 5 × 10^n) couvrant [min, max]. */
  function graduations(min, max, cible) {
    if (!(max > min)) { max = min + 1; }
    const brut = (max - min) / Math.max(1, cible);
    const p = Math.pow(10, Math.floor(Math.log10(brut)));
    const pas = [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= brut) || 10 * p;
    const debut = Math.floor(min / pas) * pas, fin = Math.ceil(max / pas) * pas;
    const t = [];
    for (let v = debut; v <= fin + pas / 2; v += pas) t.push(Math.round(v / pas) * pas);
    return t;
  }

  // ---------------------------------------------------------------- Infobulle partagée
  function infobulle(conteneur) {
    const bulle = h("div", { class: "g-bulle", role: "status", hidden: "" });
    conteneur.append(bulle);
    return {
      montrer(lignes, x, y) {
        bulle.replaceChildren(...lignes.map((l) => h("div", { class: "g-bulle-ligne" }, [
          l.couleur ? h("span", { class: "g-cle " + l.couleur }) : null,
          h("strong", { texte: l.valeur }),
          l.nom ? h("span", { texte: l.nom }) : null,
        ])));
        bulle.hidden = false;
        // Placée au-dessus du point, sans sortir du conteneur.
        const lc = conteneur.clientWidth, lb = bulle.offsetWidth;
        const gauche = Math.min(Math.max(4, x - lb / 2), Math.max(4, lc - lb - 4));
        bulle.style.left = gauche + "px";
        bulle.style.top = Math.max(0, y - bulle.offsetHeight - 10) + "px";
      },
      cacher() { bulle.hidden = true; },
    };
  }

  // ---------------------------------------------------------------- Répartition (barre segmentée fine + liste chiffrée)
  /**
   * parts : [{ nom, valeur, couleur: "v1".."v4" }] dans l'ordre d'affichage (ordre fixe des classes, jamais trié).
   * options : { formatMontant(v), formatPart(p), libelle }
   * La liste sous la barre donne nom, montant et part : c'est aussi la vue « tableau » du graphique.
   */
  function repartition(parts, options) {
    const total = parts.reduce((t, p) => t + Math.max(0, p.valeur || 0), 0);
    const racineEl = h("div", { class: "g-repartition" });
    const bulle = infobulle(racineEl);
    const barre = h("div", { class: "g-barre", role: "img", "aria-label": options.libelle || "Répartition" });
    for (const p of parts) {
      if (!(p.valeur > 0) || !(total > 0)) continue;
      const part = p.valeur / total;
      const seg = h("div", { class: "g-seg " + p.couleur, tabindex: "0", "aria-label": `${p.nom} : ${options.formatMontant(p.valeur)}, ${options.formatPart(part)}` });
      seg.style.flexGrow = String(part);
      const montrer = () => {
        const r = seg.getBoundingClientRect(), rc = racineEl.getBoundingClientRect();
        bulle.montrer([{ valeur: options.formatMontant(p.valeur), nom: `${p.nom} · ${options.formatPart(part)}`, couleur: p.couleur }], r.left - rc.left + r.width / 2, r.top - rc.top);
      };
      seg.addEventListener("pointerenter", montrer); seg.addEventListener("focus", montrer);
      seg.addEventListener("pointerleave", bulle.cacher); seg.addEventListener("blur", bulle.cacher);
      barre.append(seg);
    }
    if (!(total > 0)) barre.append(h("div", { class: "g-seg g-vide" }));
    const liste = h("ul", { class: "g-liste" }, parts.map((p) => h("li", {}, [
      h("span", { class: "g-pastille " + p.couleur }),
      h("span", { class: "g-nom", texte: p.nom }),
      h("span", { class: "g-montant", texte: options.formatMontant(p.valeur || 0) }),
      h("span", { class: "g-part", texte: total > 0 ? options.formatPart((p.valeur || 0) / total) : "–" }),
    ])));
    racineEl.append(barre, liste);
    return racineEl;
  }

  // ---------------------------------------------------------------- Jauge (cash dans une zone)
  /**
   * { part (0-1), min, max, echelleMax (ex. 0,4), etat: "ok"|"bas"|"haut", libelle }
   * La piste est un ton clair de la même teinte ; la zone visée est marquée ; le texte dit l'état (jamais la couleur seule).
   */
  function jauge(o) {
    const echelle = o.echelleMax || Math.max(0.3, Math.min(1, (o.part || 0) * 1.25));
    const pos = (v) => Math.min(100, Math.max(0, (v / echelle) * 100));
    const racineEl = h("div", { class: "g-jauge", role: "meter", "aria-valuemin": "0", "aria-valuemax": String(Math.round(echelle * 100)),
      "aria-valuenow": String(Math.round((o.part || 0) * 100)), "aria-label": o.libelle });
    const piste = h("div", { class: "g-piste" });
    const zone = h("div", { class: "g-zone" });
    zone.style.left = pos(o.min) + "%"; zone.style.width = pos(o.max) - pos(o.min) + "%";
    const rempli = h("div", { class: "g-rempli " + (o.etat === "bas" ? "attention" : "") });
    rempli.style.width = pos(o.part || 0) + "%";
    piste.append(zone, rempli);
    const reperes = h("div", { class: "g-reperes" });
    for (const v of [o.min, o.max]) {
      const r = h("span", { texte: Math.round(v * 100) + " %" });
      r.style.left = pos(v) + "%";
      reperes.append(r);
    }
    racineEl.append(piste, reperes);
    return racineEl;
  }

  // ---------------------------------------------------------------- Mini-courbe (tendance d'un ratio)
  /** valeurs : [nombre] ; une seule série, ton neutre, dernier point mis en valeur. */
  function miniCourbe(valeurs, libelle) {
    const L = 120, H = 36, m = 5;
    const v = valeurs.filter(estNombre);
    const svg = s("svg", { class: "g-mini", viewBox: `0 0 ${L} ${H}`, width: L, height: H, role: "img", "aria-label": libelle || "" });
    if (v.length < 2) return svg;
    const min = Math.min(...v), max = Math.max(...v), et = max - min || Math.abs(max) || 1;
    const X = (i) => m + ((L - 2 * m) * i) / (v.length - 1);
    const Y = (x) => H - m - ((H - 2 * m) * (x - min)) / et;
    svg.append(s("polyline", { class: "g-mini-ligne", points: v.map((x, i) => `${X(i).toFixed(1)},${Y(x).toFixed(1)}`).join(" ") }));
    svg.append(s("circle", { class: "g-mini-fin", cx: X(v.length - 1).toFixed(1), cy: Y(v[v.length - 1]).toFixed(1), r: 4 }));
    return svg;
  }

  // ---------------------------------------------------------------- Courbe (évolution, projection)
  /**
   * spec : {
   *   series: [{ nom, couleur: "v1"|"v-muet", points: [{ x, y }] }],   x numériques (horodatage ou année), alignés entre séries
   *   bande: { couleur, points: [{ x, bas, haut }] } (facultatif, zone entre deux valeurs)
   *   aire: true pour remplir sous une série unique ; zero: true pour partir de 0
   *   formatX(x), formatY(y) (graduations), formatValeur(y) (infobulle et étiquettes), titreX(x) (infobulle)
   *   infos(i): lignes supplémentaires de l'infobulle ; hauteur ; libelle (nom accessible)
   * }
   * Le dessin s'adapte à la largeur réelle du conteneur et se refait quand elle change.
   */
  function courbe(spec) {
    const racineEl = h("div", { class: "g-courbe" });
    const bulle = infobulle(racineEl);
    const hauteur = spec.hauteur || 220;
    let largeurDessinee = 0;

    function dessiner() {
      const L = Math.max(260, Math.floor(racineEl.clientWidth || 600));
      if (L === largeurDessinee) return;
      largeurDessinee = L;
      const grille = spec.series[0] ? spec.series[0].points : [];
      const mg = { haut: 14, bas: 26, gauche: 52, droite: spec.etiquettesFin === false ? 12 : 64 };
      const lp = L - mg.gauche - mg.droite, hp = hauteur - mg.haut - mg.bas;
      const toutesY = spec.series.flatMap((se) => se.points.map((p) => p.y)).concat(spec.bande ? spec.bande.points.flatMap((p) => [p.bas, p.haut]) : []).filter(estNombre);
      if (!grille.length || !toutesY.length) return;
      let ymin = Math.min(...toutesY), ymax = Math.max(...toutesY);
      if (spec.zero) ymin = Math.min(0, ymin);
      if (ymax === ymin) { ymax = ymax * 1.05 + 1; ymin = spec.zero ? 0 : ymin * 0.95; }
      const ticks = graduations(ymin, ymax, 4);
      ymin = ticks[0]; ymax = ticks[ticks.length - 1];
      const xs = grille.map((p) => p.x), xmin = xs[0], xmax = xs[xs.length - 1];
      const X = (x) => mg.gauche + (xmax === xmin ? lp / 2 : (lp * (x - xmin)) / (xmax - xmin));
      const Y = (y) => mg.haut + hp - (hp * (y - ymin)) / (ymax - ymin);

      const svg = s("svg", { class: "g-svg", width: L, height: hauteur, viewBox: `0 0 ${L} ${hauteur}`, role: "img", "aria-label": spec.libelle || "", tabindex: "0" });
      // Grille et graduations (discrètes).
      for (const t of ticks) {
        svg.append(s("line", { class: t === ticks[0] ? "g-axe" : "g-grille", x1: mg.gauche, x2: L - mg.droite, y1: Y(t).toFixed(1), y2: Y(t).toFixed(1) }));
        svg.append(texteSvg({ class: "g-graduation", x: mg.gauche - 8, y: (Y(t) + 4).toFixed(1), "text-anchor": "end" }, spec.formatY(t)));
      }
      const nbX = Math.min(grille.length, Math.max(2, Math.floor(lp / 90)));
      const pasX = (grille.length - 1) / (nbX - 1 || 1);
      const indicesX = [...new Set(Array.from({ length: nbX }, (_, k) => Math.round(k * pasX)))];
      for (const i of indicesX) {
        const x = X(grille[i].x);
        svg.append(texteSvg({ class: "g-graduation", x: x.toFixed(1), y: hauteur - 8, "text-anchor": i === 0 ? "start" : i === grille.length - 1 ? "end" : "middle" }, spec.formatX(grille[i].x)));
      }
      // Bande (fourchette).
      if (spec.bande && spec.bande.points.length > 1) {
        const bp = spec.bande.points;
        const d = bp.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)},${Y(p.haut).toFixed(1)}`).join("") +
          bp.slice().reverse().map((p) => `L${X(p.x).toFixed(1)},${Y(p.bas).toFixed(1)}`).join("") + "Z";
        svg.append(s("path", { class: "g-bande " + spec.bande.couleur, d }));
      }
      // Séries.
      for (const se of spec.series) {
        const pts = se.points.filter((p) => estNombre(p.y));
        if (!pts.length) continue;
        const d = pts.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join("");
        if (spec.aire && spec.series.length === 1 && pts.length > 1) {
          svg.append(s("path", { class: "g-aire " + se.couleur, d: d + `L${X(pts[pts.length - 1].x).toFixed(1)},${Y(ymin).toFixed(1)}L${X(pts[0].x).toFixed(1)},${Y(ymin).toFixed(1)}Z` }));
        }
        svg.append(s("path", { class: "g-ligne " + se.couleur, d }));
        const fin = pts[pts.length - 1];
        svg.append(s("circle", { class: "g-point " + se.couleur, cx: X(fin.x).toFixed(1), cy: Y(fin.y).toFixed(1), r: 4 }));
      }
      // Étiquettes de fin (valeur au bout de chaque série), écartées si elles se chevauchent.
      if (spec.etiquettesFin !== false) {
        const fins = spec.series.map((se) => ({ se, p: se.points[se.points.length - 1] })).filter((f) => f.p && estNombre(f.p.y))
          .map((f) => ({ ...f, y: Y(f.p.y) })).sort((a, b) => a.y - b.y);
        for (let i = 1; i < fins.length; i++) if (fins[i].y - fins[i - 1].y < 14) fins[i].y = fins[i - 1].y + 14;
        for (const f of fins) svg.append(texteSvg({ class: "g-etiquette", x: (L - mg.droite + 8).toFixed(1), y: (f.y + 4).toFixed(1) }, spec.formatValeur(f.p.y)));
      }
      // Réticule et infobulle : le pointeur trouve l'abscisse la plus proche.
      const reticule = s("line", { class: "g-reticule", y1: mg.haut, y2: mg.haut + hp, visibility: "hidden" });
      const marqueurs = spec.series.map((se) => s("circle", { class: "g-point " + se.couleur, r: 4, visibility: "hidden" }));
      svg.append(reticule, ...marqueurs);
      const zone = s("rect", { class: "g-zone-survol", x: mg.gauche, y: mg.haut, width: lp, height: hp });
      svg.append(zone);
      let courant = -1;
      function montrer(i) {
        courant = Math.max(0, Math.min(grille.length - 1, i));
        const x = X(grille[courant].x);
        reticule.setAttribute("x1", x.toFixed(1)); reticule.setAttribute("x2", x.toFixed(1)); reticule.setAttribute("visibility", "visible");
        const lignes = [];
        spec.series.forEach((se, k) => {
          const p = se.points[courant];
          if (p && estNombre(p.y)) {
            marqueurs[k].setAttribute("cx", x.toFixed(1)); marqueurs[k].setAttribute("cy", Y(p.y).toFixed(1)); marqueurs[k].setAttribute("visibility", "visible");
            lignes.push({ valeur: spec.formatValeur(p.y), nom: se.nom, couleur: se.couleur });
          } else marqueurs[k].setAttribute("visibility", "hidden");
        });
        if (spec.bande && spec.bande.points[courant]) {
          const b = spec.bande.points[courant];
          lignes.push({ valeur: `${spec.formatValeur(b.bas)} – ${spec.formatValeur(b.haut)}`, nom: spec.bande.nom, couleur: spec.bande.couleur });
        }
        if (spec.infos) lignes.push(...spec.infos(courant));
        lignes.unshift({ valeur: spec.titreX ? spec.titreX(grille[courant].x) : spec.formatX(grille[courant].x) });
        const yHaut = Math.min(...spec.series.map((se) => (se.points[courant] && estNombre(se.points[courant].y) ? Y(se.points[courant].y) : hauteur)));
        bulle.montrer(lignes, x, yHaut);
      }
      function cacher() {
        courant = -1; reticule.setAttribute("visibility", "hidden");
        marqueurs.forEach((m) => m.setAttribute("visibility", "hidden")); bulle.cacher();
      }
      function indiceDepuis(evt) {
        const r = svg.getBoundingClientRect();
        const x = ((evt.clientX - r.left) / r.width) * L;
        let meilleur = 0, ecart = Infinity;
        grille.forEach((p, i) => { const e = Math.abs(X(p.x) - x); if (e < ecart) { ecart = e; meilleur = i; } });
        return meilleur;
      }
      svg.addEventListener("pointermove", (e) => montrer(indiceDepuis(e)));
      svg.addEventListener("pointerleave", cacher);
      svg.addEventListener("blur", cacher);
      svg.addEventListener("focus", () => montrer(grille.length - 1));
      svg.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); montrer((courant < 0 ? grille.length - 1 : courant) + (e.key === "ArrowLeft" ? -1 : 1)); }
        if (e.key === "Escape") cacher();
      });
      const ancien = racineEl.querySelector("svg.g-svg");
      if (ancien) ancien.replaceWith(svg); else racineEl.prepend(svg);
    }

    // Légende (deux séries ou plus) : un trait par série, jamais la couleur seule.
    const entrees = spec.series.length + (spec.bande ? 1 : 0);
    if (entrees >= 2) {
      racineEl.append(h("ul", { class: "g-legende" }, spec.series.map((se) => h("li", {}, [h("span", { class: "g-trait " + se.couleur }), h("span", { texte: se.nom })]))
        .concat(spec.bande ? [h("li", {}, [h("span", { class: "g-carre " + spec.bande.couleur }), h("span", { texte: spec.bande.nom })])] : [])));
    }
    if (typeof ResizeObserver === "function") new ResizeObserver(() => dessiner()).observe(racineEl);
    requestAnimationFrame(dessiner);
    racineEl.dessiner = () => { largeurDessinee = 0; dessiner(); };
    return racineEl;
  }

  // ---------------------------------------------------------------- Barres classées (comparer des parts)
  /** items : [{ nom, valeur, texte }] ; une seule teinte, du plus grand au plus petit, sur une même ligne de base. */
  function barresClassees(items, libelle) {
    const tries = items.filter((i) => estNombre(i.valeur) && i.valeur > 0).sort((a, b) => b.valeur - a.valeur);
    const max = tries.length ? tries[0].valeur : 1;
    const liste = h("ul", { class: "g-barres", "aria-label": libelle || "" });
    for (const i of tries) {
      const val = h("div", { class: "g-barre-val" });
      val.style.width = Math.max(1, (i.valeur / max) * 100) + "%";
      liste.append(h("li", {}, [h("span", { class: "g-nom", texte: i.nom }), h("span", { class: "g-montant", texte: i.texte }), h("div", { class: "g-barre-fond" }, val)]));
    }
    if (!tries.length) liste.append(h("li", { class: "g-vide-texte", texte: "Aucune participation saisie." }));
    return liste;
  }

  // ---------------------------------------------------------------- Radar (critères normalisés)
  /**
   * axes : [{ court, titre, score (0 à 2, ou null si non renseigné), texte (valeur lisible), seuil (texte), respecte }]
   * Échelle commune : 1 = seuil tout juste atteint (cercle marqué), 2 = très largement atteint.
   * La zone entre 1 et 2 est la « zone visée ». Un axe non renseigné est montré mais n'est pas relié.
   */
  function radar(axes, libelle) {
    const racineEl = h("div", { class: "g-radar" });
    const bulle = infobulle(racineEl);
    let largeurDessinee = 0;
    function dessiner() {
      const L = Math.max(280, Math.min(520, Math.floor(racineEl.clientWidth || 360)));
      if (L === largeurDessinee) return;
      largeurDessinee = L;
      const H = Math.round(L * 0.86), cx = L / 2, cy = H / 2 + 4;
      const R = Math.min(L * 0.30, H * 0.36);
      const n = axes.length;
      const angle = (i) => -Math.PI / 2 + (2 * Math.PI * i) / n;
      const pt = (i, sc) => [cx + Math.cos(angle(i)) * R * (sc / 2), cy + Math.sin(angle(i)) * R * (sc / 2)];
      const poly = (sc) => axes.map((_, i) => pt(i, sc).map((v) => v.toFixed(1)).join(",")).join(" ");
      const svg = s("svg", { class: "g-svg g-radar-svg", width: L, height: H, viewBox: `0 0 ${L} ${H}`, role: "img", "aria-label": libelle || "" });
      // Zone visée (entre le seuil et le plafond), anneaux et rayons discrets.
      svg.append(s("path", { class: "g-radar-zone", d: `M${poly(2).replace(/ /g, "L")}Z M${poly(1).split(" ").reverse().join("L")}Z`, "fill-rule": "evenodd" }));
      for (const sc of [0.5, 1.5, 2]) svg.append(s("polygon", { class: "g-grille g-radar-anneau", points: poly(sc) }));
      svg.append(s("polygon", { class: "g-radar-seuil", points: poly(1) }));
      axes.forEach((a, i) => {
        const [x, y] = pt(i, 2);
        svg.append(s("line", { class: "g-grille", x1: cx, y1: cy, x2: x.toFixed(1), y2: y.toFixed(1) }));
        const [lx, ly] = pt(i, 2.28);
        const cos = Math.cos(angle(i));
        const ancre = Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end";
        const t = texteSvg({ class: "g-radar-axe" + (a.score === null ? " na" : ""), x: lx.toFixed(1), y: (ly + 4).toFixed(1), "text-anchor": ancre }, a.court + (a.score === null ? " (n.d.)" : ""));
        svg.append(t);
      });
      svg.append(texteSvg({ class: "g-graduation", x: (cx + 4).toFixed(1), y: (cy - R / 2 - 3).toFixed(1) }, "seuil"));
      // Polygone des valeurs (axes renseignés seulement).
      const pts = axes.map((a, i) => (a.score === null ? null : pt(i, Math.max(0.04, a.score))));
      const valides = pts.filter(Boolean);
      if (valides.length >= 3) svg.append(s("polygon", { class: "g-radar-valeur v1", points: valides.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ") }));
      axes.forEach((a, i) => {
        if (!pts[i]) return;
        const [x, y] = pts[i];
        const g = s("g", { class: "g-radar-point", tabindex: "0", role: "img", "aria-label": `${a.titre} : ${a.texte}, seuil ${a.seuil}, ${a.respecte ? "respecté" : "non respecté"}` });
        g.append(s("circle", { class: "g-zone-survol", cx: x.toFixed(1), cy: y.toFixed(1), r: 14 }));
        const point = s("circle", { class: "g-point v1" + (a.respecte ? "" : " creux"), cx: x.toFixed(1), cy: y.toFixed(1), r: 5 });
        g.append(point);
        const montrer = () => {
          const r = point.getBoundingClientRect(), rc = racineEl.getBoundingClientRect();
          bulle.montrer([{ valeur: a.texte, nom: a.titre }, { valeur: (a.respecte ? "✓ " : "✕ ") + "seuil " + a.seuil }], r.left - rc.left + r.width / 2, r.top - rc.top);
        };
        g.addEventListener("pointerenter", montrer); g.addEventListener("focus", montrer);
        g.addEventListener("pointerleave", bulle.cacher); g.addEventListener("blur", bulle.cacher);
        svg.append(g);
      });
      const ancien = racineEl.querySelector("svg.g-svg");
      if (ancien) ancien.replaceWith(svg); else racineEl.prepend(svg);
    }
    racineEl.append(h("ul", { class: "g-legende" }, [
      h("li", {}, [h("span", { class: "g-trait v1" }), h("span", { texte: "La société" })]),
      h("li", {}, [h("span", { class: "g-trait g-seuil-cle" }), h("span", { texte: "Seuil du critère" })]),
      h("li", {}, [h("span", { class: "g-carre g-zone-cle" }), h("span", { texte: "Zone visée" })]),
    ]));
    if (typeof ResizeObserver === "function") new ResizeObserver(() => dessiner()).observe(racineEl);
    requestAnimationFrame(dessiner);
    return racineEl;
  }

  const api = { repartition, jauge, miniCourbe, courbe, barresClassees, radar, graduations };
  racine.DecotesGraphiques = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
