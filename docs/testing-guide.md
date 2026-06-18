# Guía de tests para agentes IA

Esta plantilla usa tests smoke con `node:test`. La intención no es tener una suite pesada, sino detectar que la plantilla conserva su estructura mínima y no se rompe al hacer cambios.

## Archivos relacionados

```text
package.json
tests/smoke.test.mjs
.github/workflows/ci.yml
.github/workflows/pages.yml
```

## Comando principal

```sh
npm test
```

Actualmente ejecuta:

```sh
node --test tests/*.test.mjs
```

## Qué deben comprobar los tests

Los tests smoke deben comprobar cosas básicas y estables:

- Existe `package.json`.
- Existe `astro.config.mjs`.
- Existe `src/layouts/BaseLayout.astro`.
- Existen componentes base.
- Existen páginas importantes.
- Existen workflows de CI y Pages.
- Existen traducciones base.
- Los JSON de traducciones tienen las mismas claves.
- Los scripts importantes siguen definidos.

## Qué no deben comprobar

Evitar tests frágiles como:

- Clases CSS exactas de un botón.
- Textos completos de un párrafo largo.
- Orden exacto de todo el README.
- Detalles visuales que pueden cambiar.
- Snapshots grandes.
- Dependencias de red.
- Tests end-to-end pesados.

## Cuándo actualizar tests

Actualiza `tests/smoke.test.mjs` cuando:

- Añadas una carpeta estructural importante.
- Añadas un nuevo workflow imprescindible.
- Cambies el sistema i18n.
- Añadas un nuevo fichero de configuración que no debería desaparecer.
- Cambies scripts principales en `package.json`.

No hace falta actualizar tests por cambios puramente visuales.

## Cómo añadir una comprobación simple

Ejemplo para verificar que existe un archivo:

```js
assert.equal(existsSync(join(root, 'src/config/site.ts')), true);
```

Ejemplo para verificar que un archivo contiene una palabra importante:

```js
const astroConfig = readText('astro.config.mjs');
assert.match(astroConfig, /i18n/);
```

Ejemplo para verificar JSON alineados:

```js
const es = readJson('src/i18n/translations/es.json');
const en = readJson('src/i18n/translations/en.json');

assert.deepEqual(Object.keys(en).sort(), Object.keys(es).sort());
```

## CI

El workflow `.github/workflows/ci.yml` debe ejecutar:

```sh
npm ci
npm test
npm run build
```

El workflow `.github/workflows/pages.yml` también debe ejecutar tests antes de desplegar.

## Regla para agentes

Si una tarea modifica estructura, i18n, workflows, scripts o configuración base, revisa si los tests smoke deben actualizarse.

Si una tarea solo cambia diseño o contenido, normalmente no hace falta tocar tests.

## Qué evitar

- Borrar tests para arreglar un fallo.
- Convertir tests smoke en una suite compleja.
- Añadir Playwright, Vitest u otras dependencias salvo petición clara.
- Hacer tests que dependan de internet.
- Hacer tests que fallen por pequeños cambios de copy o diseño.
