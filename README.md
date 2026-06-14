# PokeTeam

PokeTeam es una aplicacion web para crear, editar, guardar, importar y exportar equipos Pokemon. Esta construida con Angular y consume datos de PokeAPI para obtener especies, tipos, habilidades, objetos, naturalezas, movimientos, sprites y estadisticas base.

El proyecto esta pensado como una herramienta practica para componer equipos competitivos: permite buscar Pokemon, configurar su set y mantener varios equipos guardados en Firebase Firestore.

## Funcionalidades

- Busqueda de Pokemon por nombre con resultados obtenidos desde PokeAPI.
- Creacion de equipos de hasta 6 Pokemon.
- Gestion de multiples equipos guardados en Firestore.
- Edicion de nombre del equipo activo.
- Configuracion individual de cada Pokemon:
  - nivel;
  - habilidad;
  - objeto equipado;
  - naturaleza;
  - tera tipo;
  - movimientos;
  - IVs y EVs.
- Calculo de estadisticas finales en base a nivel, IVs, EVs y naturaleza.
- Limite competitivo de EVs: 252 por estadistica y 510 totales.
- Selector de movimientos con tipo, potencia, precision, categoria y efecto.
- Importacion y exportacion de equipos en formato texto compatible con sets tipo Pokemon Showdown.
- Carga de iconos de tipo y sprites para mejorar la lectura visual del equipo.

## Stack tecnico

- Angular 20
- TypeScript
- Angular Signals
- RxJS
- Firebase Firestore
- pokenode-ts
- PokeAPI
- Karma + Jasmine para pruebas unitarias

## Requisitos

- Node.js compatible con Angular 20
- npm
- Acceso a internet para consultar PokeAPI y Firebase
- Proyecto Firebase con Firestore habilitado si se desea usar persistencia propia

## Instalacion

Clona el repositorio e instala las dependencias:

```bash
npm install
```

## Ejecucion local

Inicia el servidor de desarrollo:

```bash
npm start
```

La aplicacion quedara disponible en:

```text
http://localhost:4200/
```

Angular recargara automaticamente la aplicacion cuando detecte cambios en el codigo fuente.

## Scripts disponibles

```bash
npm start
```

Ejecuta la aplicacion en modo desarrollo con `ng serve`.

```bash
npm run build
```

Compila la aplicacion y genera los artefactos en `dist/`.

```bash
npm run watch
```

Compila en modo desarrollo y queda observando cambios.

```bash
npm test
```

Ejecuta las pruebas unitarias con Karma y Jasmine.

## Configuracion de Firebase

La configuracion de Firebase se encuentra en:

```text
src/app/shared/firebase/firebase.config.ts
```

El repositorio incluye una configuracion directa para inicializar Firebase y Firestore. Para un entorno real o compartido, se recomienda sustituir esos valores por los de tu propio proyecto Firebase y aplicar reglas de seguridad adecuadas en Firestore.

La coleccion utilizada para guardar equipos es:

```text
teams
```

Cada documento representa un equipo y almacena:

- `name`: nombre del equipo.
- `members`: lista de Pokemon configurados.
- `updatedAt`: marca temporal de la ultima actualizacion.

## Formato de importacion y exportacion

PokeTeam puede importar y exportar equipos en formato texto. Ejemplo:

```text
Garchomp @ Life Orb
Ability: Rough Skin
Level: 50
Tera Type: Ground
EVs: 252 Atk / 4 Def / 252 Spe
Jolly Nature
- Earthquake
- Dragon Claw
- Swords Dance
- Protect
```

El parser reconoce bloques separados por lineas en blanco y procesa campos como:

- objeto equipado;
- habilidad;
- nivel;
- tera tipo;
- EVs;
- IVs;
- naturaleza;
- movimientos.

Si el texto contiene mas de 6 Pokemon, solo se importan los primeros 6.

## Estructura del proyecto

```text
src/
  app/
    shell/                  Contenedor principal de la aplicacion
    shared/
      firebase/             Inicializacion de Firebase y Firestore
      ui/                   Componentes reutilizables
      util/                 Constantes y utilidades compartidas
    team/
      data/                 Acceso a PokeAPI, Firestore, mapeadores y parser de texto
      models/               Modelos de dominio, DTOs y view models
      pages/                Pagina principal del constructor de equipos
      ui/                   Componentes de busqueda, resultados, panel y tarjeta Pokemon
```

## Arquitectura

La funcionalidad principal se organiza alrededor de `TeamFacade`, que centraliza el estado de la pantalla y coordina la comunicacion entre los componentes, PokeAPI y Firestore.

- `PokemonApi`: encapsula las llamadas a PokeAPI mediante `pokenode-ts`.
- `PokemonMapper`: transforma DTOs externos en modelos preparados para la interfaz.
- `TeamRepository`: gestiona lectura y escritura de equipos en Firestore.
- `team-text.parser`: convierte texto de equipos en estructuras importables.
- Componentes UI: renderizan busqueda, resultados, panel de equipo y edicion individual de Pokemon.

## Flujo de uso

1. Busca un Pokemon escribiendo al menos 2 letras.
2. Agrega el Pokemon al equipo.
3. Ajusta habilidad, objeto, naturaleza, nivel, tera tipo, movimientos, IVs y EVs.
4. Guarda el equipo o crea uno nuevo desde el panel lateral.
5. Exporta el equipo a texto o importa sets existentes.

## Pruebas

Ejecuta:

```bash
npm test
```

El proyecto usa Karma y Jasmine. Las pruebas existentes cubren componentes y utilidades seleccionadas.

## Build de produccion

Genera una build optimizada con:

```bash
npm run build
```

Los archivos resultantes se generaran en:

```text
dist/
```

## Fuentes de datos

- PokeAPI: datos de Pokemon, movimientos, objetos, naturalezas y recursos relacionados.
- Firebase Firestore: persistencia de equipos creados por el usuario.
- Repositorio de sprites de PokeAPI: imagenes de objetos y recursos visuales.

## Consideraciones

- La busqueda depende de la disponibilidad de PokeAPI.
- La persistencia depende de la configuracion y reglas de Firestore.
- Los movimientos se filtran priorizando grupos de version recientes definidos en el mapper.
- La aplicacion no incluye autenticacion; si se despliega publicamente, es importante revisar las reglas de seguridad de Firebase.

## Licencia

Este repositorio no declara una licencia explicita. Define una antes de distribuir, publicar o reutilizar el proyecto fuera de un entorno privado.
