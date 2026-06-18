# Guía i18n para agentes IA

Esta plantilla usa i18n nativo de Astro y traducciones en JSON. El objetivo es que añadir nuevos textos e idiomas sea sencillo, sin duplicar componentes ni layouts.

## Configuración principal

El i18n de Astro está en `astro.config.mjs`:

```js
i18n: {
  defaultLocale: 'es',
  locales: ['es', 'en'],
  routing: {
    prefixDefaultLocale: false,
  },
}
```

Esto significa:

- Español es el idioma por defecto.
- `/` sirve el idioma por defecto.
- `/en/` sirve inglés.
- Los idiomas secundarios sí llevan prefijo.

## Archivos de i18n

```text
src/i18n/
├── translations/
│   ├── es.json
│   └── en.json
└── ui.ts
```

`src/i18n/ui.ts` contiene:

- `useTranslations(locale)`
- `getLocalizedPath(path, locale)`
- `getAlternateLocales(currentLocale)`
- `getLocaleFromUrl(pathname)`
- `isLocale(locale)`

## Regla principal

No escribas textos visibles directamente en componentes compartidos si forman parte de la UI. Usa traducciones.

Correcto:

```astro
---
const t = useTranslations(locale);
---

<a href={homeUrl}>{t('nav.home')}</a>
```

Incorrecto:

```astro
<a href={homeUrl}>Inicio</a>
```

## Añadir una nueva clave de traducción

1. Añade la clave en `src/i18n/translations/es.json`.
2. Añade la misma clave en `src/i18n/translations/en.json`.
3. Usa la clave con `t('clave')`.

Ejemplo:

```json
{
  "features.title": "Características"
}
```

Uso:

```astro
<h2>{t('features.title')}</h2>
```

Los tests smoke comprueban que `es.json` y `en.json` tengan las mismas claves.

## Nombrado de claves

Usa prefijos por zona:

```text
site.description
nav.home
footer.createdWith
home.title
home.description
notFound.title
features.title
features.description
```

Reglas:

- Minúsculas.
- Separadas por puntos.
- Agrupadas por página o componente.
- No usar textos largos como clave.

Correcto:

```txt
home.hero.title
```

Incorrecto:

```txt
Plantilla base para proyectos Astro
```

## Añadir un nuevo idioma

Ejemplo: añadir francés.

### 1. Actualizar `astro.config.mjs`

```js
i18n: {
  defaultLocale: 'es',
  locales: ['es', 'en', 'fr'],
  routing: {
    prefixDefaultLocale: false,
  },
}
```

### 2. Actualizar `src/config/site.ts`

```ts
export const locales = ['es', 'en', 'fr'] as const;

export const localeLabels: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
  fr: 'Français',
};
```

### 3. Crear `src/i18n/translations/fr.json`

Debe tener las mismas claves que `es.json`.

### 4. Registrar el JSON en `src/i18n/ui.ts`

```ts
import fr from './translations/fr.json';

const translations: Record<Locale, typeof es> = {
  es,
  en,
  fr,
};
```

### 5. Actualizar tests si hace falta

Si los tests comprueban idiomas concretos, añadir el nuevo JSON.

## Crear páginas traducidas

Para el idioma por defecto se usa:

```text
src/pages/index.astro
```

Para idiomas secundarios se usa:

```text
src/pages/[locale]/index.astro
```

La ruta dinámica debe usar `getStaticPaths()`:

```astro
---
import { defaultLocale, locales } from '../../config/site';

export function getStaticPaths() {
  return locales
    .filter((locale) => locale !== defaultLocale)
    .map((locale) => ({ params: { locale } }));
}
---
```

## Rutas internas traducidas

Usa `getLocalizedPath` para enlaces internos:

```astro
---
import { getLocalizedPath } from '../i18n/ui';
const homeUrl = getLocalizedPath('/', locale);
---

<a href={homeUrl}>{t('nav.home')}</a>
```

No uses rutas absolutas como `/en/` si la web puede estar desplegada en GitHub Pages bajo `/repo/`.

## Selector de idioma

El selector básico está en `Header.astro` y usa:

- `getAlternateLocales(locale)`
- `getLocalizedPath('/', alternateLocale)`
- `localeLabels`

Si se añaden páginas profundas, el selector puede necesitar conservar la ruta actual. No implementarlo de forma compleja hasta que el proyecto lo necesite.

## SEO multidioma

Mínimo esperado:

- `<html lang={locale}>`.
- `title` traducido cuando sea necesario.
- `description` traducida.
- canonical correcto.

Opcional si el proyecto crece:

- `hreflang` por página.
- sitemap con alternates.
- rutas traducidas por slug.

No añadir complejidad de `hreflang` o slugs traducidos si no lo pide la tarea.

## Qué evitar

- Duplicar componentes solo para cambiar textos.
- Crear layouts separados por idioma sin necesidad.
- Mezclar idiomas en el mismo JSON.
- Añadir claves en un idioma y olvidarlas en otro.
- Usar rutas absolutas que ignoren `BASE_URL`.
- Traducir nombres técnicos o marcas que no deben traducirse.
