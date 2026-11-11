# Cardiología Clínica · Estudio

Sitio estático de repaso de cardiología clínica, con progreso guardado en el navegador (localStorage). Sin frameworks: HTML, CSS y JavaScript puros.

Foco actual: **cardiopatía isquémica**, organizado en 8 bloques siguiendo la estructura de *Braunwald. Tratado de Cardiología* (12.ª edición, Libby/Bonow/Mann/Tomaselli/Bhatt/Solomon, Elsevier España 2024) y las guías ESC / ACC-AHA vigentes.

## Estructura

```
index.html                Estructura de la app y las 4 pestañas
css/styles.css             Estilos (mobile-first, soporta modo oscuro)
js/app.js                  Lógica: carga de datos por bloque, pestañas, progreso, quiz
datos/manifest.json        Define los 8 bloques y qué archivo de tema carga cada uno
datos/<carpeta-bloque>/*.json   Un archivo JSON por tema, dentro de la carpeta de su bloque
datos/_plantilla/tema-plantilla.json  Plantilla vacía del esquema (no se carga en la app)
datos/otros/               Temas fuera del programa de isquémica (quedan aparte)
```

## Los 8 bloques

| # | Bloque | Carpeta |
|---|--------|---------|
| 1 | Fisiopatología y epidemiología | `01-fisiopatologia-epidemiologia` |
| 2 | Cardiopatía isquémica crónica: diagnóstico | `02-diagnostico-cronica` |
| 3 | Angina crónica: tratamiento médico | `03-tratamiento-medico-angina` |
| 4 | Revascularización | `04-revascularizacion` |
| 5 | Síndrome coronario agudo: diagnóstico | `05-sca-diagnostico` |
| 6 | IAM con elevación del ST (IAMCEST) | `06-iamcest` |
| 7 | SCA sin elevación del ST (IAMSEST / angina inestable) | `07-scasest` |
| 8 | Complicaciones y prevención secundaria | `08-complicaciones-prevencion` |

El bloque `otros` (carpeta `otros/`) guarda temas que no son de isquémica (hoy: Insuficiencia Cardíaca, con el esquema anterior más simple).

### Mapeo bloque → capítulo de Braunwald (12.ª edición)

Según el índice de capítulos de la edición consultada (Parte IV "Cardiología preventiva" y Parte V "Enfermedad cardiovascular ateroesclerótica"):

| Bloque | Capítulo(s) y página |
|---|---|
| 1. Fisiopatología y epidemiología | Cap. 24 "Biología vascular de la ateroesclerosis" (p. 425); Cap. 36 "Flujo sanguíneo coronario e isquemia miocárdica" (p. 609) |
| 2. Diagnóstico crónica | Cap. 35 "Abordaje del paciente con dolor torácico" (p. 599); Cap. 40 "Cardiopatía isquémica estable" (p. 739) |
| 3. Tratamiento médico angina | Cap. 40 "Cardiopatía isquémica estable" (p. 739) |
| 4. Revascularización | Cap. 41 "Intervención coronaria percutánea" (p. 786). El libro no tiene un capítulo propio de cirugía de revascularización (CABG) en este índice: para esa parte del bloque el contenido se apoya más en guías (ESC/ACC-AHA) que en Braunwald. |
| 5. SCA diagnóstico | Cap. 35 (p. 599); Cap. 39 (p. 714) |
| 6. IAMCEST | Cap. 37 "IAMCEST: fisiopatología y evolución clínica" (p. 636); Cap. 38 "IAMCEST: tratamiento" (p. 662) |
| 7. SCASEST | Cap. 39 "Síndromes coronarios agudos sin elevación del ST" (p. 714) |
| 8. Complicaciones y prevención | Caps. 37/38 (complicaciones post-IAM); Cap. 25 "Prevención primaria de las enfermedades cardiovasculares" (p. 442) |

Esto viene del índice de capítulos (títulos, autores, páginas), no del texto completo de cada capítulo. Sirve para citar `braunwald.referencia` con exactitud, pero el contenido clínico de cada tema (mecanismos, recomendaciones) se redacta sobre todo a partir de las guías ESC/ACC-AHA vigentes, verificadas al momento de escribir cada tema — no se parafrasea el texto del libro sin tenerlo a la vista.

## Pestañas

- **Temas**: agrupados por bloque; cada tarjeta abre el detalle y permite marcar "estudiado".
- **Algoritmos**: se generan automáticamente a partir del campo `algoritmo` de cada tema (lista de pasos simple, o nodos con ramas/conexiones).
- **Glosario**: se agrega automáticamente a partir del campo `glosario` de cada tema.
- **Estudiar**: resumen de progreso + quiz armado con las `preguntas` de todos los temas.

## Esquema de un tema (bloques 1-8)

Ver `datos/_plantilla/tema-plantilla.json` para la plantilla vacía. Campos:

```json
{
  "id": "iamcest",
  "titulo": "IAM con elevación del ST (IAMCEST)",
  "bloque": "iamcest",
  "estado": "borrador",
  "fechaRevision": null,
  "revisor": null,
  "braunwald": {
    "edicion": "13.ª edición",
    "referencia": "VERIFICAR — parte/capítulo exacto"
  },
  "guias": [
    { "organizacion": "ESC", "nombre": "...", "anio": 2023, "url": "https://..." }
  ],
  "resumen": "...",
  "diagnostico": "...",
  "tratamiento": "...",
  "recomendaciones": [
    { "texto": "...", "clase": "I", "nivelEvidencia": "A", "guia": "ESC 2023" }
  ],
  "algoritmo": {
    "titulo": "...",
    "nodos": [{ "id": "n1", "texto": "..." }],
    "conexiones": [{ "desde": "n1", "hasta": "n2", "etiqueta": "..." }]
  },
  "dosis": [
    { "farmaco": "...", "dosis": "VERIFICAR", "fuente": "..." }
  ],
  "glosario": [{ "termino": "...", "definicion": "..." }],
  "fuentes": [{ "titulo": "...", "url": "..." }],
  "preguntas": [
    { "pregunta": "...", "opciones": ["A", "B", "C", "D"], "respuesta": 0, "explicacion": "..." }
  ]
}
```

Todos los campos excepto `id`, `titulo` y `bloque` son opcionales: lo que falte, simplemente no aporta contenido a esa sección de la app.

`estado` puede ser `"borrador"`, `"verificado"` o `"revisado por cardiólogo"` (se muestra como insignia en la tarjeta y en el detalle).

### Reglas de contenido (para evitar errores clínicos)

1. **No copiar texto** de libros ni de guías: todo en palabras propias.
2. Cada entrada de `recomendaciones` lleva `clase`, `nivelEvidencia` y `guia` (con año) de origen real — verificado contra el documento vigente, no de memoria.
3. Cualquier valor en `dosis` que no esté confirmado contra la guía oficial o la ficha técnica va con `"dosis": "VERIFICAR"`. Nunca se inventa una dosis.
4. `braunwald.referencia` solo lleva parte/capítulo exactos si se verificaron contra la edición física; si no, se deja como `"VERIFICAR"`.
5. Si ESC y ACC/AHA difieren en una recomendación, se aclaran ambas por separado (no se mezclan en una sola entrada).

## Cómo agregar un tema nuevo

1. Copiar `datos/_plantilla/tema-plantilla.json` a la carpeta del bloque correspondiente, por ejemplo `datos/06-iamcest/iamcest.json`, y completarlo.
2. Agregar el nombre del archivo al array `temas` del bloque correspondiente en `datos/manifest.json`:

```json
{ "id": "iamcest", "...": "...", "temas": ["iamcest.json"] }
```

No se necesita ningún paso de build: la app lee los JSON directamente con `fetch`.

## Ver en local

Como la app usa `fetch` para leer los JSON, hay que servir los archivos por HTTP (no abrir `index.html` directamente con `file://`):

```bash
python3 -m http.server 8000
```

Y abrir `http://localhost:8000`.

## Publicar en GitHub Pages

1. Pushear este repositorio a GitHub.
2. En **Settings → Pages**, elegir **Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. El sitio queda publicado en `https://<usuario>.github.io/<repositorio>/`.
