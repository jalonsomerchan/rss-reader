# Guía para usar y modificar este template Astro

Este documento explica cómo debe trabajar una IA o desarrollador sobre esta plantilla sin convertirla en un proyecto demasiado específico.

## Objetivo del template

Este repositorio sirve como punto de partida para crear proyectos Astro rápidos, estáticos, traducibles y desplegables en GitHub Pages.

La plantilla debe seguir siendo:

- Reutilizable.
- Ligera.
- Fácil de copiar.
- Fácil de traducir.
- Compatible con GitHub Pages.
- Con SEO técnico básico.
- Con tests smoke simples.

## Estructura principal

```text
src/
├── components/          # Componentes Astro reutilizables
├── config/              # Configuración central del sitio
├── i18n/                # Traducciones y helpers
├── layouts/             # Layouts base
├── pages/               # Rutas Astro
└── styles/              # CSS global
```

## Archivos que debes conocer

### `astro.config.mjs`

Contiene:

- `site`
- `base`
- i18n nativo de Astro
- integraciones
- plugin de Tailwind para Vite

No cambies `base` sin revisar `docs/github-pages.md`.

### `src/config/site.ts`

Configuración central del proyecto:

- nombre
- descripción
- URL
- autor
- idiomas
- etiquetas de idiomas

Cuando un nuevo proyecto use esta plantilla, este será uno de los primeros archivos a editar.

### `src/layouts/BaseLayout.astro`

Layout base para páginas.

Incluye:

- HTML principal
- `lang`
- `<title>`
- meta description
- canonical
- favicon
- manifest
- Open Graph
- Twitter Cards
- header
- footer

Las páginas nuevas deberían usar este layout salvo que exista una razón clara para no hacerlo.

### `src/components/`

Componentes base:

- `Button.astro`
- `Container.astro`
- `Header.astro`
- `Footer.astro`

Antes de crear componentes nuevos, revisa si alguno de estos puede reutilizarse o extenderse.

### `src/i18n/`

Sistema de traducciones sencillo.

Consulta `docs/i18n-guide.md` antes de tocar idiomas o textos visibles.

## Cómo crear una nueva página

Para una página normal del idioma por defecto:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import Container from '../components/Container.astro';
import { defaultLocale } from '../config/site';
import { useTranslations } from '../i18n/ui';

const locale = defaultLocale;
const t = useTranslations(locale);
---

<BaseLayout title="Título" description={t('site.description')} locale={locale}>
  <Container class="py-12">
    <h1>Título</h1>
  </Container>
</BaseLayout>
```

Para páginas que necesiten versión por idioma, crea una ruta dinámica dentro de `src/pages/[locale]/` y usa `getStaticPaths()` con `locales`.

## Reglas de diseño

Sigue siempre `docs/design-system.md`.

Resumen rápido:

- Mobile first.
- HTML semántico.
- Un único `h1` por página.
- Componentes accesibles.
- Buen contraste.
- Sin fuentes externas.
- JavaScript de cliente solo cuando sea necesario.
- Variables CSS globales para colores y tokens.

## Reglas de SEO

Toda página indexable debe tener:

- título único
- descripción clara
- canonical correcto
- estructura con headings semánticos
- contenido útil
- enlaces internos cuando tenga sentido

`BaseLayout.astro` ya da una base SEO. No dupliques metas manualmente salvo necesidad concreta.

## Reglas de componentes

Cuando crees un componente:

- Que sea reutilizable.
- Que acepte props simples.
- Que no dependa de datos globales salvo que sea necesario.
- Que no incluya textos fijos si se va a usar en varias páginas o idiomas.
- Que respete light/dark mode si aplica.
- Que no añada JS de cliente si puede ser HTML/CSS.

## Reglas de dependencias

Antes de añadir una dependencia, pregúntate:

1. ¿Astro o el navegador ya resuelven esto?
2. ¿Se puede hacer con un componente pequeño?
3. ¿La dependencia será útil para muchos proyectos derivados?
4. ¿Aumenta mucho el mantenimiento del template?

Si la respuesta no está clara, no añadas la dependencia.

## Checklist para IA antes de cerrar una tarea

- La página o componente nuevo usa `BaseLayout` si corresponde.
- Los textos visibles están traducidos si son UI reutilizable.
- Las rutas internas respetan `getLocalizedPath` o `BASE_URL`.
- No hay rutas absolutas problemáticas para GitHub Pages.
- No se han añadido dependencias innecesarias.
- Se actualizaron tests smoke si se añadió infraestructura.
- Se actualizó documentación si cambió una convención.
- El cambio sigue `docs/design-system.md`.
