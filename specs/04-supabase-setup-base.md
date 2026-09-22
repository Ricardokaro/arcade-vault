# SPEC 04 — Integración base de Supabase

> **Status:** Implementado
> **Depends on:** (ninguno)
> **Date:** 2026-09-22
> **Objective:** Dejar configurado el cliente de Supabase para Next.js App Router (browser + server) con variables de entorno y una verificación de conexión, sin migrar todavía autenticación ni ninguna funcionalidad existente.

## Por qué existe este spec

Hasta ahora Arcade Vault no tiene backend: la sesión vive en `localStorage` (`av_user`) y las puntuaciones en `localStorage` (`av_scores`), con datos de catálogo mock en `lib/data.ts` (ver SPEC 01). El usuario ya tiene un proyecto de Supabase creado y conectado (vacío, 0 tablas en `public`). Este spec es deliberadamente pequeño: solo deja el "cableado" de Supabase listo (paquetes, clientes, variables de entorno, verificación de conexión) para que specs futuros (autenticación real, persistencia de puntuaciones, catálogo en BD) puedan apoyarse en él sin repetir este setup. No toca ningún flujo existente del producto.

## Scope

**In:**

- Nuevas dependencias `@supabase/supabase-js` y `@supabase/ssr` en `package.json`.
- `lib/supabase/client.ts` — cliente de Supabase para Client Components / navegador, creado con `createBrowserClient` de `@supabase/ssr`.
- `lib/supabase/server.ts` — cliente de Supabase para Server Components / Route Handlers, creado con `createServerClient` de `@supabase/ssr`, usando el manejo de cookies vigente en Next.js 16 (revisar `node_modules/next/dist/docs/` para la API actual de `cookies()` antes de implementarlo, según indica `AGENTS.md`).
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, agregadas a `.env.local.example` (placeholders vacíos, versionado) junto a las ya existentes de Resend (SPEC 03). `.env.local` real (con los valores del proyecto del usuario) se crea localmente y ya está cubierto por `.env*` en `.gitignore`.
- Verificación manual de conexión durante la implementación: una llamada real (p. ej. `supabase.auth.getUser()`, que hace un round-trip de red contra el endpoint de autenticación del proyecto sin requerir tablas propias ni sesión activa) ejecutada tanto desde el cliente browser como desde el cliente server, confirmando que `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` son válidas. Esta verificación se hace con código temporal (script o `console.log` de prueba) que **no queda commiteado** — no se agrega ningún endpoint, página ni tabla de prueba permanente al repo.

**Out of scope (para futuros specs):**

- Autenticación real (Supabase Auth reemplazando `av_user`/`lib/storage.ts`) — decisión explícita del usuario, va en un spec aparte.
- Persistencia de puntuaciones (`av_scores`) o del catálogo (`GAMES`/`CATS`) en tablas de Supabase.
- Cualquier tabla, migración SQL o política RLS — este spec no crea esquema de base de datos.
- Row Level Security, roles, o `service_role` key — no se usa ninguna key distinta de la `anon` pública.
- Modo invitado y su relación con sesiones reales — sin cambios, sigue funcionando igual que hoy (SPEC 01), no se toca.
- Migración de datos existentes en `localStorage` de navegadores actuales hacia Supabase.
- Tests automatizados.

## Data model

Este spec no introduce estructuras de datos ni tablas en Supabase — no hay migraciones SQL ni cambios en `lib/data.ts`. Únicamente agrega el contrato de configuración (variables de entorno):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Implementation plan

1. Instalar `@supabase/supabase-js` y `@supabase/ssr` (`npm install @supabase/supabase-js @supabase/ssr`). Verificación: `npm install` corre sin errores y ambos paquetes quedan en `package.json`.
2. Agregar `NEXT_PUBLIC_SUPABASE_URL=` y `NEXT_PUBLIC_SUPABASE_ANON_KEY=` a `.env.local.example`, con un comentario corto indicando que se obtienen del dashboard del proyecto de Supabase (Settings → API). Verificación: el archivo queda versionado con las dos variables vacías; `.env.local` local con los valores reales no aparece en `git status`.
3. Crear `lib/supabase/client.ts` con `createBrowserClient(url, anonKey)` de `@supabase/ssr`, leyendo `process.env.NEXT_PUBLIC_SUPABASE_URL` y `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`, exportado como una función `createClient()` (no un singleton a nivel de módulo, para evitar compartir estado entre requests). Verificación: el archivo compila sin errores de TypeScript.
4. Antes de escribir el cliente de servidor, revisar en `node_modules/next/dist/docs/` la API vigente de `cookies()` en Next.js 16 (async o no) para Route Handlers/Server Components. Crear `lib/supabase/server.ts` con `createServerClient(url, anonKey, { cookies: {...} })` de `@supabase/ssr`, implementando `get`/`set`/`remove` sobre el store de cookies según la API confirmada, exportado como una función `createClient()` async si la API de `cookies()` lo requiere. Verificación: el archivo compila sin errores de TypeScript y sin warnings de Next.js sobre uso incorrecto de `cookies()`.
5. Verificar la conexión real: con `npm run dev` corriendo y `.env.local` con las credenciales reales del proyecto, ejecutar temporalmente `supabase.auth.getUser()` desde el cliente de `lib/supabase/client.ts` (por ejemplo en un `useEffect` de prueba en cualquier página) y desde el cliente de `lib/supabase/server.ts` (por ejemplo en un Server Component de prueba), confirmar en consola que la llamada resuelve sin error de red/configuración (se espera `{ user: null }` con o sin un error de tipo "sesión ausente", nunca un error de API key inválida o de DNS), y luego **revertir/eliminar ese código de prueba** antes de dar el spec por terminado. Verificación: la consola del navegador y la terminal del servidor muestran la respuesta esperada; el diff final no incluye el código de prueba.
6. Revisión final: confirmar que `npm run dev` y `npm run build` siguen funcionando sin errores, que ningún flujo existente (login mock, puntuaciones, catálogo) cambió de comportamiento, y que no quedó ningún archivo ni ruta de prueba temporal en el repo.

## Acceptance criteria

- [ ] `npm install` instala `@supabase/supabase-js` y `@supabase/ssr` sin errores.
- [ ] `.env.local.example` incluye `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` vacías, versionadas; `.env.local` (si existe localmente) no aparece en `git status`.
- [ ] `lib/supabase/client.ts` exporta una función que crea un cliente de Supabase para uso en Client Components, usando `@supabase/ssr`.
- [ ] `lib/supabase/server.ts` exporta una función que crea un cliente de Supabase para uso en Server Components/Route Handlers, usando `@supabase/ssr` y el manejo de cookies vigente en Next.js 16.
- [ ] Con credenciales reales en `.env.local`, una llamada de prueba (`supabase.auth.getUser()`) desde ambos clientes responde sin error de configuración/red, confirmando que el proyecto de Supabase es alcanzable.
- [ ] No queda en el repo ningún archivo, ruta, componente o tabla de prueba usada únicamente para la verificación del paso anterior.
- [ ] `npm run lint` no reporta errores nuevos.
- [ ] `npm run build` completa sin errores.
- [ ] `npm run dev` levanta la app sin errores en consola del navegador ni del servidor, y ningún flujo existente (login mock, biblioteca, reproductor, salón) cambia de comportamiento.

## Decisiones

- **Sí:** alcance limitado a "setup base" (paquetes, clientes, env vars, verificación de conexión), sin auth ni persistencia de datos. Decisión explícita del usuario — quiere la integración lista como base para specs futuros, sin acoplar esta pieza a una decisión de auth o de esquema de datos todavía no tomada.
- **No:** incluir autenticación real en este mismo spec. Se deja para un spec dedicado, como pidió el usuario explícitamente.
- **Sí:** `@supabase/ssr` además de `@supabase/supabase-js`, con un cliente separado para browser y otro para server. Es el patrón oficial de Supabase para App Router y evita rehacer el setup cuando llegue el spec de autenticación real (que sí necesita cookies de sesión manejadas correctamente en Server Components/Route Handlers).
- **No:** un único cliente compartido entre browser y server. Mezclaría dos contextos de ejecución distintos y complicaría el manejo de cookies más adelante.
- **Sí:** un archivo por contexto (`lib/supabase/client.ts` y `lib/supabase/server.ts`), dentro de `lib/supabase/`. Decisión explícita del usuario, y consistente con la separación por responsabilidad que ya existe en `lib/data.ts` / `lib/storage.ts`.
- **Sí:** nombres de variables de entorno `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, los estándar que genera el dashboard de Supabase. Evita fricción al copiar/pegar credenciales y es el naming que espera `@supabase/ssr` en los ejemplos oficiales.
- **Sí:** verificar la conexión con una llamada real a un endpoint del sistema (`auth.getUser()`) en vez de crear una tabla de prueba. Decisión explícita del usuario — no se quiere dejar esquema de base de datos en este spec, y este endpoint no requiere ninguna tabla propia.
- **No:** crear una tabla temporal para probar el round-trip de datos. Descartado por el usuario para mantener el proyecto de Supabase sin esquema hasta que un spec futuro lo defina a propósito.
- **Sí:** el código usado para verificar la conexión es temporal y se elimina antes de cerrar el spec. Evita dejar código muerto o rutas de prueba en producción solo para un chequeo puntual de configuración.
- **No:** usar la `service_role` key en este spec. Solo se necesita la key pública `anon` para el setup base; la `service_role` implica más riesgo de seguridad y no hace falta hasta que exista lógica de servidor que la requiera.
- **No:** tocar el modo invitado ni cualquier flujo de `/login` existente. Ese comportamiento se queda igual hasta que exista un spec de autenticación real.

## Riesgos

| Riesgo                                                                                                               | Mitigación                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` ausentes o inválidas en un entorno (local o deploy)       | Los clientes fallan al instanciarse o la llamada de verificación devuelve un error claro de configuración; no hay ningún flujo de producto que dependa todavía de estos clientes, así que no hay regresión visible para el usuario final. |
| Cambios de API en Next.js 16 respecto al manejo de `cookies()` en Server Components/Route Handlers (ver `AGENTS.md`) | El paso 4 del plan exige revisar `node_modules/next/dist/docs/` antes de implementar `lib/supabase/server.ts`, igual que el riesgo ya documentado en SPEC 01.                                                                             |
| Dejar accidentalmente código de verificación (rutas, componentes de prueba) commiteado                               | El paso 5 del plan y el criterio de aceptación correspondiente exigen explícitamente revertir ese código antes de cerrar el spec.                                                                                                         |

## Qué **no** incluye este spec

- Autenticación real con Supabase Auth (reemplazo de `av_user`).
- Persistencia de puntuaciones (`av_scores`) o del catálogo de juegos en tablas de Supabase.
- Cualquier tabla, migración SQL o política de Row Level Security.
- Uso de la `service_role` key.
- Cambios al modo invitado o a cualquier flujo existente de `/login`, biblioteca, reproductor o salón de la fama.
- Migración de datos ya existentes en `localStorage` hacia Supabase.
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propio spec futuro.
