# SPEC 06 — Esquema de Supabase: `games` y `scores`

> **Status:** Implentado
> **Depends on:** SPEC 04
> **Date:** 2026-09-22
> **Objective:** Crear en Supabase las tablas `games` (catálogo, sembrada desde `lib/data.ts`) y `scores` (historial de puntuaciones vacío) con RLS básico, sin conectar todavía ninguna pantalla de la app a leerlas o escribirlas.

## Por qué existe este spec

SPEC 04 dejó el cliente de Supabase configurado pero explícitamente sin ninguna tabla ni esquema. Este spec dise��a y crea las dos tablas que sostendrán el catálogo de juegos y el historial de puntuaciones en Supabase, como base para que un spec futuro conecte `/games`, `/juego/[id]`, `/jugar/[id]` y `/salon` a datos reales. Se mantiene deliberadamente acotado al esquema: no hay autenticación real todavía (queda pendiente en otro spec), así que las políticas de seguridad de este spec son intencionalmente permisivas y temporales — se documentan como tales.

## Scope

**In:**

- Migración SQL versionada en `supabase/migrations/<timestamp>_games_and_scores.sql` que crea:
  - Tabla `games`: mismas columnas que la interfaz `Game` de `lib/data.ts` (`id` texto como PK usando el mismo slug que ya usa la app, `title`, `short`, `long`, `cat` con `CHECK` de los 4 valores válidos, `cover`, `color` con `CHECK` de los 4 valores válidos, `best` entero, `plays` texto).
  - Tabla `scores`: `id` uuid PK (`gen_random_uuid()`), `game_id` texto con `FOREIGN KEY` a `games(id)`, `player_name` texto, `score` entero, `created_at` timestamptz (`default now()`).
  - Índice sobre `scores (game_id, score desc)` para consultas de leaderboard por juego.
  - RLS habilitado en ambas tablas: lectura pública abierta en `games` y `scores`; inserción pública abierta en `scores`; ninguna política de escritura en `games` (solo lectura).
  - Seed idempotente (`ON CONFLICT (id) DO NOTHING`) que inserta las 8 filas de `GAMES` en `lib/data.ts`, con los mismos valores exactos.
- Aplicar la migración al proyecto real de Supabase vía la herramienta MCP `mcp__supabase__apply_migration`.
- Verificación del esquema, del seed y de las políticas RLS usando las herramientas MCP de Supabase (`list_tables`, `execute_sql`, `get_advisors`) y, para probar RLS desde la anon key, un script temporal con `lib/supabase/client.ts` (no se commitea, mismo enfoque que la verificación de SPEC 04).

**Out of scope (para futuros specs):**

- Conectar `/games`, `/juego/[id]`, `/jugar/[id]` o `/salon` a leer o escribir contra `games`/`scores` — la UI sigue usando `lib/data.ts`/`lib/storage.ts` sin cambios.
- Autenticación real y cualquier política RLS que dependa de `auth.uid()` — mientras no exista, `scores` queda con inserción abierta a cualquiera con la anon key, documentado como decisión temporal.
- Migrar los datos ya guardados en `localStorage` (`av_scores`) hacia `scores`.
- Calcular `games.best`/`games.plays` a partir de datos reales de `scores` — se siembran igual que en `lib/data.ts` (valores mock/decorativos) y quedan estáticos.
- Adoptar la CLI completa de Supabase (`supabase init`, `supabase/config.toml`, `supabase db push`) — solo se versiona el archivo SQL de esta migración puntual.
- Tests automatizados.

## Data model

```sql
-- supabase/migrations/<timestamp>_games_and_scores.sql

create table if not exists games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  cat text not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover text not null,
  color text not null check (color in ('cyan', 'magenta', 'green', 'yellow')),
  best integer not null default 0,
  plays text not null default '0'
);

create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references games (id),
  player_name text not null,
  score integer not null,
  created_at timestamptz not null default now()
);

create index if not exists scores_game_id_score_idx
  on scores (game_id, score desc);

alter table games enable row level security;
alter table scores enable row level security;

create policy "games are publicly readable"
  on games for select using (true);

create policy "scores are publicly readable"
  on scores for select using (true);

create policy "anyone can insert a score"
  on scores for insert with check (true);

insert into games (id, title, short, long, cat, cover, color, best, plays) values
  ('bloque-buster', 'BLOQUE BUSTER', 'Rebota la pelota y destruye muros de neón.', 'Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles. ¿Hasta dónde llegará tu racha?', 'ARCADE', 'cover-bricks', 'cyan', 28450, '12.4K'),
  ('caida', 'CAÍDA', 'Encaja las piezas antes de que el techo te aplaste.', 'Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.', 'PUZZLE', 'cover-tetro', 'magenta', 184220, '31.8K'),
  ('serpentina', 'SERPENTINA', 'Crece sin morder tu propia cola.', 'Una serpiente de luz recorre la grilla buscando núcleos magenta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso y se devora a sí misma.', 'ARCADE', 'cover-snake', 'green', 7820, '9.1K'),
  ('gloton', 'GLOTÓN', 'Devora puntos y escapa de los fantasmas.', 'Un círculo glotón patrulla un laberinto coleccionando puntos luminosos. Cuatro espectros lo persiguen, pero cada cierto tiempo aparece una píldora que invierte los papeles.', 'ARCADE', 'cover-glot', 'yellow', 96400, '27.2K'),
  ('invasores', 'INVASORES', 'Defiende el planeta de filas alienígenas.', 'Olas de pixeles hostiles descienden formación tras formación. Mueve tu cañón en horizontal y abre fuego con precisión, antes de que toquen la superficie.', 'SHOOTER', 'cover-invaders', 'green', 54190, '18.0K'),
  ('rocas', 'ROCAS', 'Pulveriza asteroides en gravedad cero.', 'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Cuidado con los OVNIs en el horizonte.', 'SHOOTER', 'cover-rocas', 'yellow', 41200, '15.6K'),
  ('ranaria', 'RANARIA', 'Cruza la autopista de pixeles.', 'Salta entre carriles de coches a toda velocidad y troncos a la deriva en el río. Llega a los nenúfares antes de que se acabe el tiempo.', 'ARCADE', 'cover-rana', 'green', 18900, '6.4K'),
  ('duelo-pixel', 'DUELO PIXEL', 'Dos paletas. Una pelota. Reflejos máximos.', 'El duelo más puro: dos paletas verticales se enfrentan por rebotar una pelota luminosa. Modo solitario contra la CPU o partida local a dos jugadores.', 'VERSUS', 'cover-duelo', 'cyan', 24, '4.2K')
on conflict (id) do nothing;
```

`<timestamp>` sigue el formato `YYYYMMDDHHmmss` (convención de migraciones de Supabase), generado al momento de implementar.

## Implementation plan

1. Crear `supabase/migrations/<timestamp>_games_and_scores.sql` con el DDL completo de arriba (tablas, constraints, índice, RLS, políticas, seed). Verificación: revisión manual de sintaxis SQL.
2. Aplicar la migración al proyecto real de Supabase con `mcp__supabase__apply_migration`, usando el mismo nombre que el archivo. Verificación: la herramienta responde sin error.
3. Confirmar el esquema con `mcp__supabase__list_tables` (verbose): `games` y `scores` existen con las columnas, constraints y la FK esperados, y RLS habilitado en ambas. Verificación: la salida de la herramienta coincide con el DDL.
4. Confirmar el seed con `mcp__supabase__execute_sql`: `select count(*) from games` devuelve 8, cada fila coincide con la entrada correspondiente de `GAMES` en `lib/data.ts`, y `select count(*) from scores` devuelve 0. Verificación: los valores devueltos coinciden exactamente.
5. Probar las políticas RLS con un script temporal (no commiteado) usando `lib/supabase/client.ts` de SPEC 04 y la anon key: confirmar que se puede `select` sobre `games` y `scores`, que se puede `insert` en `scores`, y que un intento de `insert`/`update`/`delete` sobre `games` falla por RLS. Revertir/borrar el script al terminar. Verificación: cada operación se comporta como se espera y no queda código de prueba en el repo.
6. Revisión final: correr `mcp__supabase__get_advisors` (tipo `security`) y confirmar que no hay advertencias inesperadas más allá de la ya conocida por dejar `scores` con inserción abierta (documentada como decisión de este spec); confirmar con `git status` que ningún archivo de `app/`, `components/` o `lib/data.ts`/`lib/storage.ts` cambió.

## Acceptance criteria

- [ ] `supabase/migrations/<timestamp>_games_and_scores.sql` existe en el repo con el DDL completo.
- [ ] La tabla `games` existe con columnas `id` (text, PK), `title`, `short`, `long`, `cat` (con `CHECK`), `cover`, `color` (con `CHECK`), `best` (integer), `plays` (text).
- [ ] La tabla `scores` existe con columnas `id` (uuid, PK), `game_id` (FK a `games.id`), `player_name`, `score` (integer), `created_at` (timestamptz).
- [ ] Existe un índice sobre `scores (game_id, score desc)`.
- [ ] RLS está habilitado en `games` y en `scores`.
- [ ] Con la anon key se puede leer (`select`) `games` y `scores`.
- [ ] Con la anon key se puede insertar en `scores`.
- [ ] Con la anon key, `insert`/`update`/`delete` sobre `games` fallan (bloqueados por RLS).
- [ ] `games` contiene exactamente 8 filas, una por cada entrada de `GAMES` en `lib/data.ts`, con los mismos valores.
- [ ] `scores` está vacía después de aplicar la migración.
- [ ] Insertar en `scores` con un `game_id` inexistente falla por la restricción de clave foránea.
- [ ] Insertar en `games` con un `cat` o `color` fuera de los valores permitidos falla por el `CHECK` constraint.
- [ ] Ningún archivo de `app/`, `components/`, `lib/data.ts` o `lib/storage.ts` cambia en este spec.
- [ ] No queda en el repo ningún script de prueba usado para verificar RLS.
- [ ] `npm run build` sigue completando sin errores.

## Decisiones

- **Sí:** este spec crea solo el esquema y lo siembra; no conecta ninguna pantalla de la app a Supabase. Decisión explícita del usuario — evita mezclar diseño de base de datos con wiring de 4 pantallas distintas en un mismo spec.
- **No:** hacer también el wiring de `/games`/`/juego/[id]`/`/jugar/[id]`/`/salon` en este spec. Queda para un spec futuro, una vez validado el esquema.
- **Sí:** `player_name` como texto libre en `scores`, sin relación a un usuario real. Decisión explícita del usuario — coherente con que no hay autenticación real todavía; se migra a una FK real cuando exista un spec de auth.
- **No:** bloquear este spec hasta que exista autenticación real. Se prefiere tener el esquema listo antes, aunque la identidad sea débil por ahora.
- **Sí:** RLS habilitado con lectura pública abierta en ambas tablas, inserción abierta en `scores`, y `games` de solo lectura desde el cliente. Decisión explícita del usuario — mismo nivel de "confianza" que ya existe hoy (todo es client-side sin validación en `localStorage`), documentado como temporal hasta que haya auth real para políticas por usuario.
- **No:** dejar las tablas sin RLS. Aunque el resultado práctico de seguridad es similar en esta fase, tener RLS habilitado con políticas explícitas es más auditable y evita la advertencia genérica de "RLS disabled" en el dashboard de Supabase.
- **Sí:** columnas de `games` calcadas 1:1 de la interfaz `Game` de `lib/data.ts`, incluyendo `best`/`plays` como los mismos valores mock/decorativos de hoy. Decisión explícita del usuario — evita rediseñar el modelo de datos antes de que exista una necesidad real derivada de partidas jugadas.
- **No:** excluir `best`/`plays` o calcularlos desde `scores`. Se revisita cuando un spec futuro conecte lecturas/escrituras reales.
- **Sí:** `scores` arranca vacía, sin datos de ejemplo. Decisión explícita del usuario — el leaderboard mock actual (`seededScores()`) no se toca en este spec, así que sembrar datos de ejemplo en `scores` no tendría ningún consumidor todavía.
- **Sí:** `text` + `CHECK` para `cat`/`color` en vez de `ENUM` nativo de Postgres. Decisión explícita del usuario — evita la fricción de migrar un `ENUM` si se agrega una categoría/color nuevo más adelante, mientras sigue rechazando valores inválidos.
- **No:** `ENUM` nativo. Más "correcto" formalmente, pero más rígido para iterar.
- **Sí:** versionar el DDL como `supabase/migrations/<timestamp>_games_and_scores.sql` en el repo, aplicado luego vía `mcp__supabase__apply_migration`. Decisión explícita del usuario — dado que el proyecto no tiene la CLI de Supabase, este archivo es la única fuente de verdad legible en git de lo que existe en la base de datos remota.
- **No:** aplicar el SQL solo vía MCP sin dejar rastro en el repo. Hubiera dejado el esquema documentado únicamente en el dashboard remoto de Supabase, invisible en `git log`/code review.

## Riesgos

| Riesgo                                                                                                                                                                   | Mitigación                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inserción abierta en `scores` permite que cualquiera con la anon key inserte puntuaciones falsas o arbitrarias                                                           | Decisión explícita y temporal de este spec; hoy no hay ninguna pantalla que lea `scores`, así que no hay impacto visible todavía. Se endurece con políticas por usuario cuando exista autenticación real. |
| Divergencia entre el seed de `games` y `lib/data.ts` si uno de los dos cambia sin actualizar el otro                                                                     | Mientras la UI no lea de Supabase (fuera de alcance de este spec), `lib/data.ts` sigue siendo la única fuente de verdad que ve el usuario; la tabla `games` es un adelanto para cuando se conecte.        |
| Sin la CLI de Supabase, aplicar la migración manualmente vía MCP puede desincronizarse del archivo SQL versionado si alguien edita el esquema directo desde el dashboard | El archivo `supabase/migrations/<timestamp>_games_and_scores.sql` queda como referencia; `mcp__supabase__list_migrations` permite comparar contra lo aplicado realmente en el proyecto.                   |

## Qué **no** incluye este spec

- Conectar `/games`, `/juego/[id]`, `/jugar/[id]` o `/salon` a Supabase.
- Autenticación real o políticas RLS basadas en `auth.uid()`.
- Migración de los datos existentes en `localStorage` (`av_scores`) hacia `scores`.
- Cálculo de `best`/`plays` a partir de datos reales.
- Adopción de la CLI completa de Supabase.
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propio spec futuro.
