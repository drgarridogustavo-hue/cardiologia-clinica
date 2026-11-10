# Cardiología Clínica · Estudio

Sitio estático de repaso de cardiología clínica, con progreso guardado en el navegador (localStorage). Sin frameworks: HTML, CSS y JavaScript puros.

## Estructura

```
index.html        Estructura de la app y las 4 pestañas
css/styles.css     Estilos (mobile-first, soporta modo oscuro)
js/app.js          Lógica: carga de datos, pestañas, progreso, quiz
datos/manifest.json  Lista de archivos de temas a cargar
datos/*.json        Un archivo JSON por tema
```

## Pestañas

- **Temas**: lista de temas, con vista de detalle y marcado de "estudiado".
- **Algoritmos**: se generan automáticamente a partir del campo `algoritmo` de cada tema.
- **Glosario**: se agrega automáticamente a partir del campo `glosario` de cada tema.
- **Estudiar**: resumen de progreso + quiz armado con las `preguntas` de todos los temas.

## Cómo agregar un tema nuevo

1. Crear un archivo `datos/mi-tema.json` con esta forma:

```json
{
  "id": "mi-tema",
  "titulo": "Título del tema",
  "categoria": "Categoría",
  "resumen": "Resumen breve (1-2 líneas).",
  "secciones": [
    { "titulo": "Definición", "contenido": "..." }
  ],
  "algoritmo": {
    "titulo": "Algoritmo de...",
    "pasos": ["Paso 1", "Paso 2"]
  },
  "puntosClave": ["Punto clave 1"],
  "glosario": [
    { "termino": "Sigla", "definicion": "Definición breve." }
  ],
  "preguntas": [
    {
      "pregunta": "¿...?",
      "opciones": ["A", "B", "C", "D"],
      "respuesta": 0,
      "explicacion": "Por qué la opción correcta es A."
    }
  ]
}
```

`algoritmo`, `puntosClave`, `glosario` y `preguntas` son opcionales: si un tema no los tiene, simplemente no aporta contenido a esas pestañas.

2. Agregar el nombre del archivo a `datos/manifest.json`:

```json
{ "temas": ["insuficiencia-cardiaca.json", "mi-tema.json"] }
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
2. En **Settings → Pages**, elegir **Deploy from a branch**, rama `main` (o `master`), carpeta `/ (root)`.
3. El sitio queda publicado en `https://<usuario>.github.io/<repositorio>/`.
