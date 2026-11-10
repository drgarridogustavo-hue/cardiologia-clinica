(function () {
  "use strict";

  var STORAGE_KEY = "cc_progreso_v1";

  var state = {
    temas: [],
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
        var archivos = manifest.temas || [];
        return Promise.all(
          archivos.map(function (archivo) {
            return fetch("datos/" + archivo).then(function (res) {
              if (!res.ok) throw new Error("No se pudo leer datos/" + archivo);
              return res.json();
            });
          })
        );
      })
      .then(function (temas) {
        state.temas = temas;
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

  // ---------- Temas ----------

  function renderTemas() {
    var lista = document.getElementById("temas-lista");
    lista.innerHTML = "";
    state.temas.forEach(function (tema) {
      var card = document.createElement("div");
      card.className = "card";
      var estudiado = estaEstudiado(tema.id);
      card.innerHTML =
        '<div class="categoria">' + escapeHtml(tema.categoria || "") + "</div>" +
        "<h3>" + escapeHtml(tema.titulo) + "</h3>" +
        "<p>" + escapeHtml(tema.resumen || "") + "</p>" +
        '<div class="estado' + (estudiado ? " estudiado" : "") + '">' +
        (estudiado ? "✓ Estudiado" : "Sin estudiar") +
        "</div>";
      card.addEventListener("click", function () {
        mostrarDetalleTema(tema);
      });
      lista.appendChild(card);
    });
  }

  function mostrarDetalleTema(tema) {
    document.getElementById("temas-lista").classList.add("hidden");
    var detalle = document.getElementById("tema-detalle");
    detalle.classList.remove("hidden");

    var bloques = (tema.secciones || [])
      .map(function (s) {
        return (
          '<section class="bloque"><h4>' +
          escapeHtml(s.titulo) +
          "</h4><p>" +
          escapeHtml(s.contenido) +
          "</p></section>"
        );
      })
      .join("");

    var puntos = (tema.puntosClave || [])
      .map(function (p) {
        return "<li>" + escapeHtml(p) + "</li>";
      })
      .join("");

    var estudiado = estaEstudiado(tema.id);

    detalle.innerHTML =
      '<button class="btn-volver" type="button">&larr; Volver a Temas</button>' +
      "<h2>" + escapeHtml(tema.titulo) + "</h2>" +
      '<p class="resumen">' + escapeHtml(tema.resumen || "") + "</p>" +
      bloques +
      (puntos
        ? '<section class="bloque"><h4>Puntos clave</h4><ul class="puntos-clave">' + puntos + "</ul></section>"
        : "") +
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
      var pasos = tema.algoritmo.pasos
        .map(function (p) {
          return "<li>" + escapeHtml(p) + "</li>";
        })
        .join("");
      card.innerHTML =
        '<div class="categoria">' + escapeHtml(tema.titulo) + "</div>" +
        "<h3>" + escapeHtml(tema.algoritmo.titulo) + "</h3>" +
        '<ol class="algoritmo-pasos">' + pasos + "</ol>";
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
  });
})();
