(function () {
  "use strict";

  var STORAGE_KEY = "cc_ecg_progreso_v1";
  var DT = 0.004; // paso de muestreo, en segundos

  var LEAD_ORDEN = ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"];
  var LEAD_GRID = [
    ["I", "aVR", "V1", "V4"],
    ["II", "aVL", "V2", "V5"],
    ["III", "aVF", "V3", "V6"]
  ];

  var state = {
    casos: [],
    casoActualIndice: -1,
    opcionesMostradas: null,
    corregido: false
  };

  // ---------- Progreso (localStorage) ----------

  function cargarProgreso() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function guardarProgreso(progreso) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progreso));
    } catch (e) {
      // no disponible
    }
  }

  function registrarResultado(casoId, acierto) {
    var progreso = cargarProgreso();
    var entrada = progreso[casoId] || { intentos: 0, aciertosConsecutivos: 0, ultimoResultado: null };
    entrada.intentos++;
    entrada.aciertosConsecutivos = acierto ? entrada.aciertosConsecutivos + 1 : 0;
    entrada.ultimoResultado = acierto ? "correcto" : "incorrecto";
    progreso[casoId] = entrada;
    guardarProgreso(progreso);
    return entrada;
  }

  function estadoCaso(casoId) {
    var progreso = cargarProgreso();
    var entrada = progreso[casoId];
    if (!entrada || entrada.intentos === 0) return "pendiente";
    if (entrada.aciertosConsecutivos >= 2) return "dominado";
    if (entrada.ultimoResultado === "incorrecto") return "repasar";
    return "pendiente";
  }

  // ---------- Síntesis de la forma de onda ----------

  function valorST(frac, st, shape) {
    st = st || 0;
    if (shape === "concava") return st + 0.25 * (Math.abs(st) > 0.01 ? Math.abs(st) : 0.3) * Math.sqrt(frac);
    if (shape === "convexa") return st * (1 - 0.15 * frac * frac);
    if (shape === "descendente" || shape === "downsloping") return st - Math.abs(st || 0.3) * 0.4 * frac;
    if (shape === "ascendente" || shape === "upsloping") return st * (1 - 0.6 * frac);
    return st; // horizontal / flat
  }

  function muestrasLatido(lead, timing, beatLen) {
    var samples = [];
    var i, frac;

    // Onda P (semi-seno)
    var nP = Math.max(1, Math.round(timing.pDur / DT));
    for (i = 0; i < nP; i++) samples.push(lead.p * Math.sin(Math.PI * (i / nP)));

    // Segmento PR (isoeléctrico)
    var nPR = Math.max(1, Math.round(timing.prSeg / DT));
    for (i = 0; i < nPR; i++) samples.push(0);

    // Complejo QRS: baseline -> Q -> R -> S -> baseline (lineal a trozos)
    var nQRS = Math.max(2, Math.round(timing.qrsDur / DT));
    var ctrlT = [0, 0.15, 0.40, 0.70, 1.0];
    var ctrlV = [0, lead.q || 0, lead.r || 0, lead.s || 0, 0];
    for (i = 0; i < nQRS; i++) {
      frac = i / nQRS;
      var seg = 0;
      while (seg < ctrlT.length - 2 && frac > ctrlT[seg + 1]) seg++;
      var t0 = ctrlT[seg], t1 = ctrlT[seg + 1];
      var localFrac = t1 > t0 ? (frac - t0) / (t1 - t0) : 0;
      var v = ctrlV[seg] + (ctrlV[seg + 1] - ctrlV[seg]) * localFrac;
      samples.push(v);
    }

    // Segmento ST
    var nST = Math.max(1, Math.round(timing.stSegDur / DT));
    var stEnd = 0;
    for (i = 0; i < nST; i++) {
      frac = i / nST;
      stEnd = valorST(frac, lead.st, lead.stShape);
      samples.push(stEnd);
    }

    // Onda T (continúa desde el final del ST hacia la amplitud T y vuelve a la línea de base)
    var nT = Math.max(1, Math.round(timing.tDur / DT));
    for (i = 0; i < nT; i++) {
      frac = i / nT;
      var forma = Math.sin(Math.PI * frac);
      samples.push(stEnd * (1 - frac) + (lead.t || 0) * forma);
    }

    // Segmento TP (relleno isoeléctrico hasta completar la duración del latido)
    var usado = timing.pDur + timing.prSeg + timing.qrsDur + timing.stSegDur + timing.tDur;
    var restante = Math.max(0, beatLen - usado);
    var nTP = Math.max(0, Math.round(restante / DT));
    for (i = 0; i < nTP; i++) samples.push(0);

    return samples;
  }

  function calcularTiming(caso) {
    var qrsDur = (caso.qrsDurMs || 100) / 1000;
    var timing = { pDur: 0.09, prSeg: 0.07, qrsDur: qrsDur, stSegDur: 0.10, tDur: 0.18 };
    var beatLen = 60 / (caso.frecuenciaCardiaca || 75);
    var usado = timing.pDur + timing.prSeg + timing.qrsDur + timing.stSegDur + timing.tDur;
    if (usado > beatLen * 0.92) {
      var factor = (beatLen * 0.92) / usado;
      timing.pDur *= factor;
      timing.prSeg *= factor;
      timing.stSegDur *= factor;
      timing.tDur *= factor;
    }
    return { timing: timing, beatLen: beatLen };
  }

  // ---------- Dibujo SVG ----------

  function lineasGrid(x, y, w, h) {
    var out = "";
    var minor = 4; // px por mm
    var i;
    for (i = 0; i <= w; i += minor) {
      var major = Math.round(i / minor) % 5 === 0;
      out += '<line x1="' + (x + i) + '" y1="' + y + '" x2="' + (x + i) + '" y2="' + (y + h) + '" class="ecg-grid-line' + (major ? " ecg-grid-major" : "") + '" />';
    }
    for (i = 0; i <= h; i += minor) {
      var majorH = Math.round(i / minor) % 5 === 0;
      out += '<line x1="' + x + '" y1="' + (y + i) + '" x2="' + (x + w) + '" y2="' + (y + i) + '" class="ecg-grid-line' + (majorH ? " ecg-grid-major" : "") + '" />';
    }
    return out;
  }

  function trazoPath(samples, x0, yBase, pxPerSec, pxPerMv) {
    var d = "";
    for (var i = 0; i < samples.length; i++) {
      var x = x0 + i * DT * pxPerSec;
      var y = yBase - samples[i] * pxPerMv;
      d += (i === 0 ? "M " : "L ") + x.toFixed(1) + " " + y.toFixed(1) + " ";
    }
    return d;
  }

  function construirSVG(caso) {
    var calc = calcularTiming(caso);
    var timing = calc.timing, beatLen = calc.beatLen;
    var pxPerSec = 100, pxPerMv = 40;

    var boxW = 210, boxH = 150, padPre = 0.18; // seg de línea de base antes del latido
    var cols = 4, rows = 3;
    var gridW = boxW * cols, gridH = boxH * rows;
    var stripH = 130;
    var totalW = gridW + 20;
    var totalH = gridH + stripH + 30;

    var svg = "";
    svg += '<rect x="0" y="0" width="' + totalW + '" height="' + totalH + '" class="ecg-fondo" />';

    var r, c;
    for (r = 0; r < rows; r++) {
      for (c = 0; c < cols; c++) {
        var leadName = LEAD_GRID[r][c];
        var bx = 10 + c * boxW, by = 10 + r * boxH;
        svg += lineasGrid(bx, by, boxW, boxH);
        var leadParams = caso.leads[leadName];
        var samples = [];
        var nPad = Math.round(padPre / DT);
        for (var i = 0; i < nPad; i++) samples.push(0);
        samples = samples.concat(muestrasLatido(leadParams, timing, beatLen));
        var yBase = by + boxH * 0.62;
        var path = trazoPath(samples, bx + 6, yBase, pxPerSec, pxPerMv);
        svg += '<path d="' + path + '" class="ecg-trazo" />';
        svg += '<text x="' + (bx + 8) + '" y="' + (by + 18) + '" class="ecg-etiqueta">' + leadName + "</text>";
      }
    }

    // Tira de ritmo (derivación II)
    var sy = 10 + gridH + 15;
    svg += lineasGrid(10, sy, gridW, stripH);
    var stripSeconds = 6;
    var stripSamples = [];
    var beatsNeeded = Math.ceil(stripSeconds / beatLen) + 1;
    for (var b = 0; b < beatsNeeded; b++) {
      stripSamples = stripSamples.concat(muestrasLatido(caso.leads["II"], timing, beatLen));
    }
    var yBaseStrip = sy + stripH * 0.55;
    var stripPath = trazoPath(stripSamples, 10 + 6, yBaseStrip, pxPerSec, pxPerMv);
    svg += '<path d="' + stripPath + '" class="ecg-trazo" />';
    svg += '<text x="18" y="' + (sy + 18) + '" class="ecg-etiqueta">II (ritmo)</text>';

    // Marca de calibración (10 mm = 1 mV)
    var calX = 12, calY1 = sy + stripH - 10, calY2 = calY1 - 40;
    svg +=
      '<path d="M ' + calX + " " + calY1 + " L " + calX + " " + calY2 + " L " + (calX + 20) + " " + calY2 + " L " + (calX + 20) + " " + calY1 + '" class="ecg-calibracion" />';

    return (
      '<svg viewBox="0 0 ' + totalW + " " + totalH + '" width="' + totalW + '" height="' + totalH + '" xmlns="http://www.w3.org/2000/svg">' + svg + "</svg>"
    );
  }

  // ---------- Carga de datos ----------

  function cargarCasos() {
    return fetch("datos/ecg/manifest.json")
      .then(function (res) {
        return res.json();
      })
      .then(function (manifest) {
        var archivos = manifest.casos || [];
        return Promise.all(
          archivos.map(function (archivo) {
            return fetch("datos/ecg/casos/" + archivo).then(function (res) {
              return res.json();
            });
          })
        );
      })
      .then(function (casos) {
        state.casos = casos;
      })
      .catch(function (err) {
        console.error("Error al cargar casos de ECG:", err);
      });
  }

  // ---------- Render: lista ----------

  function badgeEstadoCaso(casoId) {
    var est = estadoCaso(casoId);
    var textos = { pendiente: "Pendiente", dominado: "✓ Dominado", repasar: "Para repasar" };
    var clases = { pendiente: "", dominado: "estudiado", repasar: "para-repasar" };
    return '<span class="estado-ecg ' + clases[est] + '">' + textos[est] + "</span>";
  }

  function renderListaCasos(filtro) {
    var lista = document.getElementById("ecg-lista");
    if (!lista) return;
    var dominados = state.casos.filter(function (c) { return estadoCaso(c.id) === "dominado"; }).length;
    var resumen = document.getElementById("ecg-resumen");
    if (resumen) resumen.textContent = dominados + " de " + state.casos.length + " casos dominados";

    var casosFiltrados = state.casos.filter(function (c) {
      if (!filtro || filtro === "todos") return true;
      return estadoCaso(c.id) === filtro;
    });

    lista.innerHTML = "";
    if (casosFiltrados.length === 0) {
      lista.innerHTML = '<p class="estado-carga">No hay casos en este filtro.</p>';
      return;
    }

    casosFiltrados.forEach(function (caso) {
      var card = document.createElement("div");
      card.className = "card";
      card.innerHTML =
        '<div class="categoria">' + escapeHtml(caso.dificultad || "") + "</div>" +
        "<h3>" + escapeHtml(caso.titulo) + "</h3>" +
        "<p>" + escapeHtml(caso.contextoClinico || "").slice(0, 90) + "…</p>" +
        badgeEstadoCaso(caso.id);
      card.addEventListener("click", function () {
        abrirCaso(state.casos.indexOf(caso));
      });
      lista.appendChild(card);
    });
  }

  function inicializarFiltros() {
    var botones = document.querySelectorAll(".ecg-filtro");
    botones.forEach(function (btn) {
      btn.addEventListener("click", function () {
        botones.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        renderListaCasos(btn.getAttribute("data-filtro"));
      });
    });
  }

  // ---------- Render: detalle / quiz ----------

  function abrirCaso(indice) {
    state.casoActualIndice = indice;
    state.corregido = false;
    document.getElementById("ecg-lista-vista").classList.add("hidden");
    document.getElementById("ecg-detalle").classList.remove("hidden");
    renderDetalleCaso();
  }

  function mezclarOpciones(caso) {
    var indices = caso.opcionesDiagnostico.map(function (_, i) { return i; });
    for (var i = indices.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = indices[i]; indices[i] = indices[j]; indices[j] = tmp;
    }
    return indices;
  }

  function renderDetalleCaso() {
    var caso = state.casos[state.casoActualIndice];
    var cont = document.getElementById("ecg-detalle");
    state.opcionesMostradas = mezclarOpciones(caso);

    var opcionesHtml = state.opcionesMostradas
      .map(function (idxOriginal, i) {
        return (
          '<button class="quiz-opcion" data-idx-original="' + idxOriginal + '" type="button">' +
          escapeHtml(caso.opcionesDiagnostico[idxOriginal]) +
          "</button>"
        );
      })
      .join("");

    var leadsHtml = LEAD_ORDEN.map(function (nombre) {
      return '<button class="ecg-lead-toggle" data-lead="' + nombre + '" type="button">' + nombre + "</button>";
    }).join("");

    cont.innerHTML =
      '<button class="btn-volver" type="button">&larr; Volver a la lista</button>' +
      "<h2>" + escapeHtml(caso.titulo) + "</h2>" +
      '<p class="resumen">' + escapeHtml(caso.contextoClinico) + "</p>" +
      '<p class="meta-revision">FC: ' + caso.frecuenciaCardiaca + " lpm · Ritmo: " + escapeHtml(caso.ritmo) + "</p>" +
      '<p class="ecg-hint">Deslizá el trazado hacia los costados para ver las 12 derivaciones →</p>' +
      '<div class="ecg-scroll">' + construirSVG(caso) + "</div>" +
      '<section class="bloque"><h4>1. ¿Cuál es el diagnóstico más probable?</h4>' +
      '<div class="quiz-opciones">' + opcionesHtml + "</div></section>" +
      '<section class="bloque"><h4>2. ¿Qué derivaciones muestran la alteración principal?</h4>' +
      '<div class="ecg-leads-select">' + leadsHtml + "</div></section>" +
      '<button id="btn-corregir-ecg" class="btn-primary" type="button">Corregir</button>' +
      '<div id="ecg-resultado" class="hidden"></div>';

    cont.querySelector(".btn-volver").addEventListener("click", function () {
      cont.classList.add("hidden");
      document.getElementById("ecg-lista-vista").classList.remove("hidden");
      renderListaCasos("todos");
    });

    cont.querySelectorAll(".quiz-opcion").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (state.corregido) return;
        cont.querySelectorAll(".quiz-opcion").forEach(function (b) { b.classList.remove("seleccionada"); });
        btn.classList.add("seleccionada");
      });
    });

    cont.querySelectorAll(".ecg-lead-toggle").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (state.corregido) return;
        btn.classList.toggle("seleccionada");
      });
    });

    document.getElementById("btn-corregir-ecg").addEventListener("click", corregirCaso);
  }

  function corregirCaso() {
    if (state.corregido) return;
    var caso = state.casos[state.casoActualIndice];
    var cont = document.getElementById("ecg-detalle");

    var btnDiagElegido = cont.querySelector(".quiz-opcion.seleccionada");
    if (!btnDiagElegido) {
      alert("Elegí un diagnóstico antes de corregir.");
      return;
    }

    state.corregido = true;
    var idxElegido = parseInt(btnDiagElegido.getAttribute("data-idx-original"), 10);
    var diagnosticoCorrecto = idxElegido === caso.respuestaCorrecta;

    cont.querySelectorAll(".quiz-opcion").forEach(function (btn) {
      var idx = parseInt(btn.getAttribute("data-idx-original"), 10);
      if (idx === caso.respuestaCorrecta) btn.classList.add("correcta");
      else if (btn.classList.contains("seleccionada")) btn.classList.add("incorrecta");
    });

    var derivacionesElegidas = Array.prototype.slice
      .call(cont.querySelectorAll(".ecg-lead-toggle.seleccionada"))
      .map(function (b) { return b.getAttribute("data-lead"); });
    var derivacionesCorrectas = caso.derivacionesAfectadas || [];

    cont.querySelectorAll(".ecg-lead-toggle").forEach(function (btn) {
      var lead = btn.getAttribute("data-lead");
      var enCorrecta = derivacionesCorrectas.indexOf(lead) !== -1;
      var fueElegida = derivacionesElegidas.indexOf(lead) !== -1;
      if (enCorrecta && fueElegida) btn.classList.add("correcta");
      else if (!enCorrecta && fueElegida) btn.classList.add("incorrecta");
      else if (enCorrecta && !fueElegida) btn.classList.add("omitida");
    });

    var aciertosLead = derivacionesElegidas.filter(function (l) { return derivacionesCorrectas.indexOf(l) !== -1; }).length;
    var erroresLead = derivacionesElegidas.filter(function (l) { return derivacionesCorrectas.indexOf(l) === -1; }).length;
    var omitidasLead = derivacionesCorrectas.filter(function (l) { return derivacionesElegidas.indexOf(l) === -1; }).length;

    var entrada = registrarResultado(caso.id, diagnosticoCorrecto);

    var hallazgos = (caso.hallazgosClave || []).map(function (h) { return "<li>" + escapeHtml(h) + "</li>"; }).join("");

    var resumenLeads = derivacionesCorrectas.length === 0
      ? "No hay derivaciones con alteración principal en este caso (es un trazado normal)."
      : "Derivaciones correctas identificadas: " + aciertosLead + "/" + derivacionesCorrectas.length +
        (erroresLead > 0 ? " · Marcadas de más: " + erroresLead : "") +
        (omitidasLead > 0 ? " · Sin marcar (deberían estarlo): " + omitidasLead : "");

    var resultado = document.getElementById("ecg-resultado");
    resultado.className = "ecg-resultado-caja " + (diagnosticoCorrecto ? "correcto" : "incorrecto");
    resultado.innerHTML =
      "<p><strong>" + (diagnosticoCorrecto ? "✓ Diagnóstico correcto." : "✗ Diagnóstico incorrecto.") + "</strong> " +
      "El diagnóstico era: " + escapeHtml(caso.opcionesDiagnostico[caso.respuestaCorrecta]) + "</p>" +
      "<p>" + resumenLeads + "</p>" +
      '<h4>Hallazgos clave</h4><ul class="puntos-clave">' + hallazgos + "</ul>" +
      "<h4>Explicación</h4><p>" + escapeHtml(caso.explicacion) + "</p>" +
      '<p class="meta-revision">Fuente: ' + escapeHtml(caso.fuente || "") + "</p>" +
      '<p class="meta-revision">Intentos en este caso: ' + entrada.intentos + " · Aciertos consecutivos: " + entrada.aciertosConsecutivos + "</p>" +
      '<button id="btn-reintentar-ecg" class="btn-secondary" type="button">Reintentar este caso</button>' +
      '<button id="btn-siguiente-ecg" class="btn-primary" type="button">Siguiente caso</button>';
    resultado.classList.remove("hidden");

    document.getElementById("btn-reintentar-ecg").addEventListener("click", function () {
      abrirCaso(state.casoActualIndice);
    });
    document.getElementById("btn-siguiente-ecg").addEventListener("click", function () {
      var siguiente = (state.casoActualIndice + 1) % state.casos.length;
      abrirCaso(siguiente);
    });
  }

  // ---------- Utilidades ----------

  function escapeHtml(str) {
    if (str === undefined || str === null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---------- Inicialización pública ----------

  window.EcgModulo = {
    init: function () {
      inicializarFiltros();
      return cargarCasos().then(function () {
        renderListaCasos("todos");
      });
    }
  };
})();
