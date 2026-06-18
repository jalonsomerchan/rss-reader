# RSS Reader

Lector RSS móvil construido con Astro 6. Usa la API estática de `rss-source` para mostrar titulares con imagen, categorías personalizadas guardadas en `localStorage`, carga progresiva y acciones rápidas para compartir noticias.

Endpoint de datos usado por la app:

```txt
https://jalonsomerchan.github.io/rss-source/
```

## Funcionalidad principal

- Primera apertura con selector de categorías si todavía no hay preferencias guardadas.
- Guardado local de categorías favoritas en `localStorage`.
- Portada con tres pestañas: Mis categorías, Todo y Ajustes.
- Tarjetas móviles con título, imagen, fuente y tiempo relativo de publicación.
- Apertura de noticias originales en una pestaña nueva.
- Compartir con `navigator.share` en móviles y copia de enlace como alternativa.
- Carga progresiva mediante `IntersectionObserver` y archivos mensuales de la API cuando hacen falta más noticias.
- Soporte de light mode, dark mode, i18n y despliegues en raíz o subruta.

## API utilizada

La configuración vive en `src/config/rss.ts`.

Endpoints consumidos:

```txt
GET /sources.json
GET /indexes/portada.json
GET /indexes/categorias.json
GET /data/{fuenteId}/{anio}/{mes}.json
```

La app carga primero los índices para ofrecer una portada rápida. Cuando el usuario baja en el listado, consulta archivos mensuales por fuente para seguir añadiendo noticias sin depender solo de los índices.

## Requisitos

Usa Node 22. El repositorio incluye `.nvmrc`.

```sh
nvm use
npm ci
```

## Comandos

| Comando | Acción |
| --- | --- |
| `npm run dev` | Arranca el servidor local de Astro |
| `npm run build` | Genera la web estática en `dist/` |
| `npm run preview` | Previsualiza el build localmente |
| `npm test` | Ejecuta tests smoke básicos |
| `npm run format` | Formatea CSS, JS, JSON, Markdown, TS y YAML |
| `npm run format:check` | Comprueba formato |
| `npm run clean` | Borra `dist` y `.astro` |

## Estructura recomendada

```text
/
├── public/
│   ├── .nojekyll
│   ├── favicon.svg
│   ├── favicon.ico
│   ├── og-image.svg
│   └── scripts/
│       ├── rss-api.js
│       └── rss-reader.js
├── scripts/
│   └── clean.mjs
├── src/
│   ├── components/
│   │   ├── Button.astro
│   │   ├── Container.astro
│   │   ├── Footer.astro
│   │   ├── Header.astro
│   │   └── RssReaderApp.astro
│   ├── config/
│   │   ├── rss.ts
│   │   └── site.ts
│   ├── i18n/
│   │   ├── translations/
│   │   │   ├── en.json
│   │   │   └── es.json
│   │   └── ui.ts
│   ├── layouts/
│   │   └── BaseLayout.astro
│   ├── pages/
│   │   ├── [locale]/
│   │   │   └── index.astro
│   │   ├── 404.astro
│   │   ├── index.astro
│   │   ├── manifest.webmanifest.ts
│   │   └── robots.txt.ts
│   └── styles/
│       ├── global.css
│       └── reader.css
└── tests/
    └── smoke.test.mjs
```

## Traducciones e idiomas

El proyecto usa el i18n nativo de Astro en `astro.config.mjs` y una capa sencilla de traducciones en JSON.

Idioma por defecto:

```txt
/
```

Otros idiomas:

```txt
/en/
```

Para añadir o cambiar textos, actualiza todos los JSON dentro de:

```txt
src/i18n/translations/
```

Después usa las claves con `useTranslations(locale)`. Los tests comprueban que las claves de traducción estén alineadas entre los idiomas configurados.

## GitHub Pages

El despliegue está en `.github/workflows/pages.yml` y se ejecuta al hacer push a `main` o manualmente desde Actions.

El workflow:

1. Instala dependencias con `npm ci`.
2. Ejecuta `npm test`.
3. Genera el build estático con `npm run build`.
4. Sube `dist/` como artifact de GitHub Pages.
5. Publica con `actions/deploy-pages@v4`.

`astro.config.mjs` está preparado para GitHub Pages:

- `output: 'static'` genera una web totalmente estática.
- `site` se calcula como `https://OWNER.github.io` si no se define `ASTRO_SITE`.
- `base` se calcula como `/NOMBRE_DEL_REPO` dentro de GitHub Actions, por lo que este repo se publica bajo `/rss-reader/`.
- `public/.nojekyll` se copia a `dist/.nojekyll` para evitar procesamiento de Jekyll en Pages.

URL esperada tras fusionar en `main` y tener Pages configurado con origen GitHub Actions:

```txt
https://jalonsomerchan.github.io/rss-reader/
```

Puedes sobrescribirlo con variables de entorno si despliegas en dominio propio:

```env
ASTRO_SITE=https://example.com
ASTRO_BASE=/
```

## CI

`.github/workflows/ci.yml` ejecuta en pull requests:

```sh
npm ci
npm test
npm run build
```

Los tests son intencionadamente suaves: comprueban que la estructura mínima existe, que i18n sigue alineado, que la app RSS está cableada y que los workflows no desaparecen.

## Documentación para agentes IA

Antes de modificar el proyecto, una IA debe leer:

- `agents.md`: reglas principales del repositorio.
- `docs/ai-checklist.md`: checklist rápida antes de cerrar tareas.
- `docs/template-usage.md`: cómo usar y modificar la plantilla.
- `docs/i18n-guide.md`: cómo añadir textos, traducciones e idiomas.
- `docs/github-pages.md`: cómo evitar romper GitHub Pages y `base`.
- `docs/testing-guide.md`: cómo mantener tests smoke.
- `docs/design-system.md`: reglas visuales, SEO, accesibilidad y responsive.
