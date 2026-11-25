# Nueva pestaña en carpeta (Zen Browser)

Mod para Zen Browser que añade la opción **«Nueva pestaña»** al menú contextual
de una carpeta de pestañas. Al pulsarla, la pestaña se crea **dentro de la
carpeta sobre la que hiciste clic derecho**, sin importar qué pestaña estuviera
activa.

- Funciona con carpetas y subcarpetas normales.
- Respeta `zen.urlbar.replace-newtab`: si está a `true`, escribes la dirección y
  pulsas Enter; la pestaña ya estará en la carpeta.
- La pestaña queda anclada (*pinned*), igual que el resto de pestañas dentro de
  las carpetas de Zen, y la primera URL visitada pasa a ser su URL anclada.
- El menú se oculta en carpetas *live*, vistas divididas y elementos que no son
  carpetas de Zen.
- Etiqueta en español si el navegador está en español; si no, usa `New tab`.

## Estado

Probado e instalado contra **Zen 1.24.3b** (Firefox 159) inspeccionando el
código interno (`#zenFolderActions`, `gZenFolders`, `BrowserCommands.openTab`).
La carga real se verifica con la preferencia `zen-folder-new-tab.loaded=true`.
Usa APIs internas de Zen, así que una actualización del navegador podría
requerir ajustes.

## Instalación

Este mod lleva JavaScript, por lo que Zen no lo carga con el instalador nativo
de mods (ese solo aplica CSS). Tienes dos opciones:

### Opción A: Sine (recomendada)

1. Instala [Sine](https://github.com/CosmoCreeper/Sine/releases/latest) en Zen.
2. El mod ya está publicado en `Ivancitoo-N/zen-folder-new-tab`.
3. En Zen: **Ajustes → Sine Mods**, activa `sine.allow-unsafe-js` (los scripts
   de repositorios personalizados no se ejecutan sin esto). Ya quedó activado
   en tu perfil.
4. En el instalador de repositorios personalizados escribe
   `Ivancitoo-N/zen-folder-new-tab` e instala. También puedes instalarlo desde
   la rama: `Ivancitoo-N/zen-folder-new-tab/tree/main`.
5. Reinicia Zen si Sine lo pide.

### Opción B: fx-autoconfig (sin Sine)

1. Instala [fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig) siguiendo
   su guía para tu sistema operativo.
2. Copia `folder-new-tab.uc.js` dentro de
   `<perfil-de-zen>/chrome/JS/` (crea la carpeta si no existe).
3. Reinicia Zen. Si es la primera vez, limpia la caché de inicio desde
   `about:support`.

Puedes encontrar tu perfil en `about:support → Profile Folder → Open Folder`.

## Uso

1. Crea una carpeta (clic derecho sobre una pestaña → *New Folder*).
2. Haz clic derecho sobre el nombre de la carpeta.
3. Pulsa **Nueva pestaña**.
4. La nueva pestaña aparece dentro de la carpeta, al final de sus pestañas.

## Desactivar o eliminar

- Con Sine: desactiva el mod en **Ajustes → Sine Mods**.
- Con fx-autoconfig: borra `folder-new-tab.uc.js` de `chrome/JS/` y reinicia.

## Solución de problemas

- **No aparece la opción:** comprueba que Sine tiene activado
  `sine.allow-unsafe-js` y que el mod está habilitado. Abre la consola del
  navegador (`Ctrl+Shift+J`) y busca mensajes `[zen-folder-new-tab]`.
- **Aparece pero la pestaña sale fuera de la carpeta:** probablemente Zen
  cambió su API interna. Revisa que `#zenFolderActions` y
  `BrowserCommands.openTab` sigan existiendo en la versión instalada.
- **Se abre la barra de direcciones pero no la pestaña:** es el comportamiento
  normal con `zen.urlbar.replace-newtab=true`; escribe la URL y pulsa Enter.
