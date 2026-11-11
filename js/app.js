(function () {
  "use strict";

  var STORAGE_KEY = "cc_progreso_v1";

  var state = {
    bloques: [], // [{ id, numero, titulo, carpeta, temas: [tema, ...] }]
    temas: [], // lista plana de todos los temas (con _bloqueTitulo adjunto)
    quiz: {
      preguntas: [],
      indice: 0,
      correctas: 0,
      respondida: false
    }
  };

  function cargarProgreso() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { estudiados: [] };
      var datos = JSON.parse(raw);
      if (!datos.estudiados) datos.estudiados = [];
      return datos;
    } catch (e) {
      return { estudiados: [] };
    }
  }

  function guardarProgreso(progreso) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progreso));
    } catch (e) {
      // localStorage no disponible (modo privado, cuota excedida, etc.)
    }
  }

  function marcarEstudiado(id, estudiado) {
    var progreso = cargarProgreso();
    var idx = progreso.estudiados.indexOf(id);
    if (estudiado && idx === -1) progreso.estudiados.push(id);
    if (!estudiado && idx !== -1) progreso.estudiados.splice(idx, 1);
    guardarProgreso(progreso);
    return progreso;
  }

  function estaEstudiado(id) {
    return cargarProgreso().estudiados.indexOf(id) !== -1;
  }

  // ---------- Carga de datos ----------

  function cargarDatos() {
    var estado = document.getElementById("estado-carga");
    estado.textContent = "Cargando temas…";
    return fetch("datos/manifest.json")
      .then(function (res) {
        if (!res.ok) throw new Error("No se pudo leer datos/manifest.json");
        return res.json();
      })
      .then(function (manifest) {
        var bloques = manifest.bloques || [];
        return Promise.all(
          bloques.map(function (bloque) {
            var archivos = bloque.temas || [];
            return Promise.all(
              archivos.map(function (archivo) {
                var ruta = "datos/" + bloque.carpeta + "/" + archivo;
                return fetch(ruta).then(function (res) {
                  if (!res.ok) throw new Error("No se pudo leer " + ruta);
                  return res.json();
                });
              })
            ).then(function (temas) {
              return {
                id: bloque.id,
                numero: bloque.numero,
                titulo: bloque.titulo,
                temas: temas
              };
            });
          })
        );
      })
      .then(function (bloques) {
        state.bloques = bloques;
        state.temas = [];
        bloques.forEach(function (bloque) {
          bloque.temas.forEach(function (tema) {
            tema._bloqueTitulo = bloque.titulo;
            state.temas.push(tema);
          });
        });
        estado.textContent = "";
      })
      .catch(function (err) {
        estado.textContent = "Error al cargar los datos: " + err.message;
        console.error(err);
      });
  }

  // ---------- Pestañas ----------

  function inicializarTabs() {
    var botones = document.querySelectorAll(".tab-btn");
    botones.forEach(function (btn) {
      btn.addEventListener("click", function () {
        cambiarTab(btn.getAttribute("data-tab"));
      });
    });
  }

  function cambiarTab(nombre) {
    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === nombre);
    });
    document.querySelectorAll(".tab-panel").forEach(function (panel) {
      panel.classList.toggle("active", panel.id === "tab-" + nombre);
    });
    if (nombre === "estudiar") actualizarResumenProgreso();
  }

  // ---------- Metadatos comunes (estado / revisor) ----------

  function badgeEstado(tema) {
    if (!tema.estado) return "";
    var clases = { borrador: "badge-borrador", verificado: "badge-verificado", "revisado por cardiólogo": "badge-revisado" };
    var clase = clases[tema.estado] || "badge-borrador";
    return '<span class="badge ' + clase + '">' + escapeHtml(tema.estado) + "</span>";
  }

  // ---------- Temas ----------

  function renderTemas() {
    var lista = document.getElementById("temas-lista");
    lista.innerHTML = "";

    state.bloques.forEach(function (bloque) {
      var seccion = document.createElement("div");
      seccion.className = "bloque-seccion";

      var encabezado = document.createElement("h2");
      encabezado.className = "bloque-titulo";
      encabezado.textContent =
        (bloque.numero ? bloque.numero + ". " : "") + bloque.titulo + " (" + bloque.temas.length + ")";
      seccion.appendChild(encabezado);

      if (bloque.temas.length === 0) {
        var vacio = document.createElement("p");
        vacio.className = "bloque-vacio";
        vacio.textContent = "Todavía no hay temas cargados en este bloque.";
        seccion.appendChild(vacio);
      } else {
        bloque.temas.forEach(function (tema) {
          var card = document.createElement("div");
          card.className = "card";
          var estudiado = estaEstudiado(tema.id);
          card.innerHTML =
            '<div class="categoria">' + escapeHtml(tema.categoria || tema._bloqueTitulo || "") + "</div>" +
            "<h3>" + escapeHtml(tema.titulo) + " " + badgeEstado(tema) + "</h3>" +
            "<p>" + escapeHtml(tema.resumen || "") + "</p>" +
            '<div class="estado' + (estudiado ? " estudiado" : "") + '">' +
            (estudiado ? "✓ Estudiado" : "Sin estudiar") +
            "</div>";
          card.addEventListener("click", function () {
            mostrarDetalleTema(tema);
          });
          seccion.appendChild(card);
        });
      }

      lista.appendChild(seccion);
    });
  }

  function renderBloqueTexto(titulo, contenido) {
    if (!contenido) return "";
    return '<section class="bloque"><h4>' + escapeHtml(titulo) + "</h4><p>" + escapeHtml(contenido) + "</p></section>";
  }

  function renderRecomendaciones(recomendaciones) {
    if (!recomendaciones || recomendaciones.length === 0) return "";
    var items = recomendaciones
      .map(function (r) {
        var tags = [];
        if (r.clase) tags.push('<span class="tag tag-clase">Clase ' + escapeHtml(r.clase) + "</span>");
        if (r.nivelEvidencia) tags.push('<span class="tag tag-nivel">Nivel ' + escapeHtml(r.nivelEvidencia) + "</span>");
        if (r.guia) tags.push('<span class="tag tag-guia">' + escapeHtml(r.guia) + "</span>");
        return (
          '<li class="recomendacion"><p>' + escapeHtml(r.texto) + '</p><div class="tags">' + tags.join("") + "</div></li>"
        );
      })
      .join("");
    return '<section class="bloque"><h4>Recomendaciones</h4><ul class="recomendaciones-lista">' + items + "</ul></section>";
  }

  function renderDosis(dosis) {
    if (!dosis || dosis.length === 0) return "";
    var items = dosis
      .map(function (d) {
        var necesitaVerificar = !d.dosis || /verificar/i.test(d.dosis);
        var detalles = "";
        if (d.indicacion) detalles += '<div class="dosis-detalle"><strong>Indicación:</strong> ' + escapeHtml(d.indicacion) + "</div>";
        if (d.ajusteRenal) detalles += '<div class="dosis-detalle"><strong>Ajuste renal:</strong> ' + escapeHtml(d.ajusteRenal) + "</div>";
        if (d.ajusteHepatico) detalles += '<div class="dosis-detalle"><strong>Ajuste hepático:</strong> ' + escapeHtml(d.ajusteHepatico) + "</div>";
        if (d.contraindicaciones) detalles += '<div class="dosis-detalle"><strong>Contraindicaciones:</strong> ' + escapeHtml(d.contraindicaciones) + "</div>";
        if (d.efectosAdversos) detalles += '<div class="dosis-detalle"><strong>Efectos adversos principales:</strong> ' + escapeHtml(d.efectosAdversos) + "</div>";
        return (
          '<li class="dosis-item' + (necesitaVerificar ? " dosis-sin-verificar" : "") + '">' +
          "<strong>" + escapeHtml(d.farmaco) + ":</strong> " +
          escapeHtml(d.dosis || "VERIFICAR") +
          (necesitaVerificar ? ' <span class="tag tag-verificar">VERIFICAR</span>' : "") +
          (d.fuente ? ' <span class="fuente-dosis">(' + escapeHtml(d.fuente) + ")</span>" : "") +
          detalles +
          "</li>"
        );
      })
      .join("");
    return '<section class="bloque"><h4>Dosis</h4><ul class="dosis-lista">' + items + "</ul></section>";
  }

  function renderGuiasYFuentes(tema) {
    var partes = [];
    if (tema.guias && tema.guias.length > 0) {
      var guias = tema.guias
        .map(function (g) {
          var nombre = [g.organizacion, g.nombre, g.anio].filter(Boolean).join(" · ");
          return g.url ? '<li><a href="' + encodeURI(g.url) + '" target="_blank" rel="noopener">' + escapeHtml(nombre) + "</a></li>" : "<li>" + escapeHtml(nombre) + "</li>";
        })
        .join("");
      partes.push('<section class="bloque"><h4>Guías utilizadas</h4><ul class="fuentes-lista">' + guias + "</ul></section>");
    }
    if (tema.fuentes && tema.fuentes.length > 0) {
      var fuentes = tema.fuentes
        .map(function (f) {
          return f.url ? '<li><a href="' + encodeURI(f.url) + '" target="_blank" rel="noopener">' + escapeHtml(f.titulo || f.url) + "</a></li>" : "<li>" + escapeHtml(f.titulo || "") + "</li>";
        })
        .join("");
      partes.push('<section class="bloque"><h4>Fuentes</h4><ul class="fuentes-lista">' + fuentes + "</ul></section>");
    }
    if (tema.braunwald && tema.braunwald.referencia) {
      partes.push(
        '<section class="bloque"><h4>Braunwald</h4><p>' +
          escapeHtml(tema.braunwald.edicion || "") +
          " — " +
          escapeHtml(tema.braunwald.referencia) +
          "</p></section>"
      );
    }
    return partes.join("");
  }

  function renderMetaRevision(tema) {
    var partes = [];
    if (tema.revisor) partes.push("Revisor: " + escapeHtml(tema.revisor));
    if (tema.fechaRevision) partes.push("Última revisión: " + escapeHtml(tema.fechaRevision));
    if (partes.length === 0) return "";
    return '<p class="meta-revision">' + partes.join(" · ") + "</p>";
  }

  function mostrarDetalleTema(tema) {
    document.getElementById("temas-lista").classList.add("hidden");
    var detalle = document.getElementById("tema-detalle");
    detalle.classList.remove("hidden");

    var contenidoLegacy = (tema.secciones || [])
      .map(function (s) {
        return renderBloqueTexto(s.titulo, s.contenido);
      })
      .join("");

    var contenidoNuevo =
      renderBloqueTexto("Diagnóstico", tema.diagnostico) +
      renderBloqueTexto("Tratamiento", tema.tratamiento) +
      renderRecomendaciones(tema.recomendaciones) +
      renderDosis(tema.dosis);

    var puntos = (tema.puntosClave || [])
      .map(function (p) {
        return "<li>" + escapeHtml(p) + "</li>";
      })
      .join("");

    var estudiado = estaEstudiado(tema.id);

    detalle.innerHTML =
      '<button class="btn-volver" type="button">&larr; Volver a Temas</button>' +
      "<h2>" + escapeHtml(tema.titulo) + " " + badgeEstado(tema) + "</h2>" +
      renderMetaRevision(tema) +
      '<p class="resumen">' + escapeHtml(tema.resumen || "") + "</p>" +
      contenidoLegacy +
      contenidoNuevo +
      (puntos
        ? '<section class="bloque"><h4>Puntos clave</h4><ul class="puntos-clave">' + puntos + "</ul></section>"
        : "") +
      renderGuiasYFuentes(tema) +
      '<label class="marcar-estudiado"><input type="checkbox" id="check-estudiado"' +
      (estudiado ? " checked" : "") +
      "> Marcar como estudiado</label>";

    detalle.querySelector(".btn-volver").addEventListener("click", function () {
      detalle.classList.add("hidden");
      document.getElementById("temas-lista").classList.remove("hidden");
      renderTemas();
    });

    detalle.querySelector("#check-estudiado").addEventListener("change", function (e) {
      marcarEstudiado(tema.id, e.target.checked);
    });
  }

  // ---------- Algoritmos ----------

  function renderPasosAlgoritmoLegacy(pasos) {
    var items = pasos.map(function (p) { return "<li>" + escapeHtml(p) + "</li>"; }).join("");
    return '<ol class="algoritmo-pasos">' + items + "</ol>";
  }

  function renderNodosAlgoritmo(algoritmo) {
    var nodos = algoritmo.nodos || [];
    var conexiones = algoritmo.conexiones || [];
    if (nodos.length === 0) return "";

    var salientes = {};
    conexiones.forEach(function (c) {
      if (!salientes[c.desde]) salientes[c.desde] = [];
      salientes[c.desde].push(c);
    });

    var items = nodos
      .map(function (n) {
        var ramas = (salientes[n.id] || [])
          .map(function (c) {
            var destino = nodos.find(function (nd) { return nd.id === c.hasta; });
            var textoDestino = destino ? destino.texto : c.hasta;
            return (
              '<li class="algoritmo-rama">&rarr; ' +
              (c.etiqueta ? "<strong>" + escapeHtml(c.etiqueta) + ":</strong> " : "") +
              escapeHtml(textoDestino) +
              "</li>"
            );
          })
          .join("");
        return (
          '<li class="algoritmo-nodo"><div class="algoritmo-nodo-texto">' +
          escapeHtml(n.texto) +
          "</div>" +
          (ramas ? '<ul class="algoritmo-ramas">' + ramas + "</ul>" : "") +
          "</li>"
        );
      })
      .join("");

    return '<ol class="algoritmo-pasos">' + items + "</ol>";
  }

  function renderAlgoritmos() {
    var lista = document.getElementById("algoritmos-lista");
    lista.innerHTML = "";
    var conAlgoritmo = state.temas.filter(function (t) {
      return t.algoritmo;
    });

    if (conAlgoritmo.length === 0) {
      lista.innerHTML = '<p class="estado-carga">Todavía no hay algoritmos cargados.</p>';
      return;
    }

    conAlgoritmo.forEach(function (tema) {
      var card = document.createElement("div");
      card.className = "card";
      var cuerpo = tema.algoritmo.pasos
        ? renderPasosAlgoritmoLegacy(tema.algoritmo.pasos)
        : renderNodosAlgoritmo(tema.algoritmo);
      card.innerHTML =
        '<div class="categoria">' + escapeHtml(tema.titulo) + "</div>" +
        "<h3>" + escapeHtml(tema.algoritmo.titulo || "") + "</h3>" +
        cuerpo;
      lista.appendChild(card);
    });
  }

  // ---------- Glosario ----------

  function obtenerGlosarioCompleto() {
    var terminos = {};
    state.temas.forEach(function (tema) {
      (tema.glosario || []).forEach(function (item) {
        terminos[item.termino.toLowerCase()] = item;
      });
    });
    return Object.keys(terminos)
      .sort()
      .map(function (k) {
        return terminos[k];
      });
  }

  function renderGlosario(filtro) {
    var lista = document.getElementById("glosario-lista");
    var items = obtenerGlosarioCompleto();
    if (filtro) {
      var f = filtro.toLowerCase();
      items = items.filter(function (it) {
        return it.termino.toLowerCase().indexOf(f) !== -1 || it.definicion.toLowerCase().indexOf(f) !== -1;
      });
    }
    if (items.length === 0) {
      lista.innerHTML = '<p class="estado-carga">Sin resultados.</p>';
      return;
    }
    lista.innerHTML = items
      .map(function (it) {
        return (
          '<div class="glossary-item"><dl><dt>' +
          escapeHtml(it.termino) +
          "</dt><dd>" +
          escapeHtml(it.definicion) +
          "</dd></dl></div>"
        );
      })
      .join("");
  }

  function inicializarGlosario() {
    document.getElementById("glosario-buscar").addEventListener("input", function (e) {
      renderGlosario(e.target.value);
    });
  }

  // ---------- Estudiar (quiz + progreso) ----------

  function actualizarResumenProgreso() {
    var progreso = cargarProgreso();
    var total = state.temas.length;
    var estudiados = progreso.estudiados.filter(function (id) {
      return state.temas.some(function (t) {
        return t.id === id;
      });
    }).length;
    var pct = total > 0 ? Math.round((estudiados / total) * 100) : 0;
    document.getElementById("progreso-texto").textContent =
      estudiados + " de " + total + " temas estudiados (" + pct + "%)";
    document.getElementById("progreso-barra").style.width = pct + "%";
  }

  function obtenerTodasLasPreguntas() {
    var preguntas = [];
    state.temas.forEach(function (tema) {
      (tema.preguntas || []).forEach(function (p) {
        preguntas.push(Object.assign({ tema: tema.titulo }, p));
      });
    });
    // orden aleatorio simple
    for (var i = preguntas.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = preguntas[i];
      preguntas[i] = preguntas[j];
      preguntas[j] = tmp;
    }
    return preguntas;
  }

  function iniciarQuiz() {
    state.quiz.preguntas = obtenerTodasLasPreguntas();
    state.quiz.indice = 0;
    state.quiz.correctas = 0;
    state.quiz.respondida = false;

    if (state.quiz.preguntas.length === 0) {
      document.getElementById("quiz-container").innerHTML =
        '<p class="estado-carga">Todavía no hay preguntas cargadas en los temas.</p>';
      document.getElementById("quiz-container").classList.remove("hidden");
      document.getElementById("estudiar-inicio").classList.add("hidden");
      return;
    }

    document.getElementById("estudiar-inicio").classList.add("hidden");
    document.getElementById("quiz-container").classList.remove("hidden");
    renderPreguntaActual();
  }

  function renderPreguntaActual() {
    var cont = document.getElementById("quiz-container");
    var q = state.quiz.preguntas[state.quiz.indice];

    if (!q) {
      renderResultadoFinal();
      return;
    }

    var opciones = q.opciones
      .map(function (op, i) {
        return '<button class="quiz-opcion" data-indice="' + i + '" type="button">' + escapeHtml(op) + "</button>";
      })
      .join("");

    cont.innerHTML =
      '<div class="quiz-progreso">Pregunta ' +
      (state.quiz.indice + 1) +
      " de " +
      state.quiz.preguntas.length +
      " · " +
      escapeHtml(q.tema) +
      "</div>" +
      '<div class="quiz-pregunta">' + escapeHtml(q.pregunta) + "</div>" +
      '<div class="quiz-opciones">' + opciones + "</div>" +
      '<div id="quiz-explicacion" class="hidden"></div>' +
      '<button id="btn-siguiente" class="btn-primary hidden" type="button">Siguiente</button>';

    cont.querySelectorAll(".quiz-opcion").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (state.quiz.respondida) return;
        responderPregunta(q, parseInt(btn.getAttribute("data-indice"), 10));
      });
    });

    document.getElementById("btn-siguiente").addEventListener("click", function () {
      state.quiz.indice++;
      state.quiz.respondida = false;
      renderPreguntaActual();
    });
  }

  function responderPregunta(pregunta, indiceElegido) {
    state.quiz.respondida = true;
    var esCorrecta = indiceElegido === pregunta.respuesta;
    if (esCorrecta) state.quiz.correctas++;

    document.querySelectorAll(".quiz-opcion").forEach(function (btn) {
      var i = parseInt(btn.getAttribute("data-indice"), 10);
      if (i === pregunta.respuesta) btn.classList.add("correcta");
      else if (i === indiceElegido) btn.classList.add("incorrecta");
    });

    var exp = document.getElementById("quiz-explicacion");
    if (pregunta.explicacion) {
      exp.textContent = pregunta.explicacion;
      exp.classList.remove("hidden");
      exp.className = "quiz-explicacion";
    }
    document.getElementById("btn-siguiente").classList.remove("hidden");
  }

  function renderResultadoFinal() {
    var cont = document.getElementById("quiz-container");
    var total = state.quiz.preguntas.length;
    var pct = total > 0 ? Math.round((state.quiz.correctas / total) * 100) : 0;
    cont.innerHTML =
      '<div class="quiz-resultado">' +
      '<div class="puntaje">' + state.quiz.correctas + " / " + total + "</div>" +
      "<p>" + pct + "% de respuestas correctas</p>" +
      '<button id="btn-volver-estudiar" class="btn-primary" type="button">Volver</button>' +
      "</div>";
    document.getElementById("btn-volver-estudiar").addEventListener("click", function () {
      cont.classList.add("hidden");
      document.getElementById("estudiar-inicio").classList.remove("hidden");
      actualizarResumenProgreso();
    });
  }

  function inicializarEstudiar() {
    document.getElementById("btn-iniciar-quiz").addEventListener("click", iniciarQuiz);
    document.getElementById("btn-reset-progreso").addEventListener("click", function () {
      if (confirm("¿Reiniciar todo el progreso guardado en este navegador?")) {
        guardarProgreso({ estudiados: [] });
        actualizarResumenProgreso();
        renderTemas();
      }
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

  // ---------- Arranque ----------

  document.addEventListener("DOMContentLoaded", function () {
    inicializarTabs();
    inicializarGlosario();
    inicializarEstudiar();
    cargarDatos().then(function () {
      renderTemas();
      renderAlgoritmos();
      renderGlosario("");
      actualizarResumenProgreso();
    });
    if (window.EcgModulo) window.EcgModulo.init();
  });
})();
