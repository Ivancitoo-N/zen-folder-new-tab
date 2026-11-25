// ==UserScript==
// @name         Zen Folder: Nueva pestaña
// @namespace    zen-folder-new-tab
// @version      1.0.0
// @description  Añade "Nueva pestaña" al menú contextual de las carpetas de Zen Browser.
// @include      chrome://browser/content/browser.xhtml
// @load-order   100
// ==/UserScript==

// Añade una entrada «Nueva pestaña» al menú que aparece al hacer clic derecho
// sobre una carpeta de pestañas de Zen. La pestaña se crea dentro de esa
// carpeta (igual que el resto de pestañas de carpeta: se ancla/pinned).
//
// Funciona con Zen 1.23+/1.24+ y se puede cargar con Sine o fx-autoconfig.
(() => {
  "use strict";

  if (window.location.href !== "chrome://browser/content/browser.xhtml") {
    return;
  }

  // Evita duplicados si Sine recarga el script sin reiniciar el navegador.
  const KEY = "__zenFolderNewTab";
  window[KEY]?.destroy?.();

  const MENU_ITEM_ID = "context_zenFolderNewTab";
  const EMPTY_PAGES = new Set(["about:blank", "about:newtab", "about:home"]);

  let menu = null;
  let item = null;
  let currentFolder = null;
  let targetFolder = null;
  let sourceWorkspaceId = null;
  let commandActive = false;
  let urlbarObserver = null;
  let destroyed = false;

  const awaitingFirstPage = new WeakSet();

  const isSpanish = (() => {
    try {
      return Services.locale.appLocaleAsBCP47.toLowerCase().startsWith("es");
    } catch {
      return /^es\b/i.test(navigator.language || "");
    }
  })();
  const LABEL = isSpanish ? "Nueva pestaña" : "New tab";

  // Las carpetas «live», las vistas divididas y las carpetas ya cerradas no
  // deben capturar la pestaña.
  const usableFolder = folder =>
    Boolean(
      folder?.isZenFolder &&
      folder.isConnected &&
      !folder.isLiveFolder &&
      !folder.hasAttribute("split-view-group")
    );

  // Misma resolución que usa Zen en su propio popupshowing de #zenFolderActions.
  const resolveFolder = event => {
    const target =
      menu?.triggerNode ?? event?.explicitOriginalTarget ?? event?.target;
    if (!target) return null;

    if (gBrowser.isTabGroupLabel?.(target)) return target.group;

    const parent = target.parentElement;
    if (parent && gBrowser.isTabGroupLabel?.(parent)) return parent.group;

    if (
      target.classList?.contains("tab-group-label-container") &&
      parent?.isZenFolder
    ) {
      return parent;
    }

    if (target.isZenFolder) return target;
    return target.closest?.("zen-folder") || null;
  };

  const onPopupShowing = event => {
    if (event.target !== menu) return;
    const folder = resolveFolder(event);
    currentFolder = usableFolder(folder) ? folder : null;
    item.hidden = !currentFolder;
  };

  const onPopupHidden = event => {
    if (event.target !== menu) return;
    currentFolder = null;
  };

  // Mueve la pestaña recién creada a la carpeta elegida y la deja al final de
  // las pestañas reales de esa carpeta (encima de las demás en la barra).
  const placeInFolder = (tab, folder, workspaceId) => {
    if (destroyed || !tab || tab.closing || !usableFolder(folder)) return;
    if (
      tab.hasAttribute("zen-essential") ||
      tab.hasAttribute("zen-glance-tab")
    ) {
      return;
    }
    if (
      workspaceId &&
      tab.getAttribute("zen-workspace-id") !== workspaceId
    ) {
      return;
    }

    if (tab.group !== folder) {
      // addTabs la desagrupa de donde estuviera, la ancla y la mete en folder.
      folder.addTabs([tab]);
    }

    const previous = folder.tabs
      .filter(t => t !== tab && !t.hasAttribute("zen-empty-tab"))
      .at(-1);
    if (previous?.isConnected) {
      gBrowser.moveTabAfter(tab, previous);
    }
    gBrowser.tabContainer?._invalidateCachedTabs?.();

    awaitingFirstPage.add(tab);
  };

  const onTabOpen = event => {
    if (!targetFolder) return;
    // Con zen.urlbar.replace-newtab=true la pestaña se crea al confirmar la
    // barra de direcciones, no dentro de openTab().
    if (!commandActive && !gURLBar?.hasAttribute("zen-newtab")) return;

    const folder = targetFolder;
    const workspaceId = sourceWorkspaceId;
    targetFolder = null;
    sourceWorkspaceId = null;

    const tab = event.target;
    // Deja que el manejador TabOpen de Zen termine primero.
    Promise.resolve().then(() => placeInFolder(tab, folder, workspaceId));
  };

  const onCommand = event => {
    if (event.target !== item || !currentFolder) return;

    targetFolder = currentFolder;
    sourceWorkspaceId =
      gBrowser.selectedTab?.getAttribute("zen-workspace-id") || null;
    commandActive = true;

    try {
      if (typeof BrowserCommands?.openTab === "function") {
        // Igual que Ctrl+T: respeta replace-newtab y el resto de preferencias.
        BrowserCommands.openTab();
      } else {
        // Fallback por si cambia la API interna de Zen.
        const tab = gBrowser.addTrustedTab("about:newtab", {
          triggeringPrincipal:
            Services.scriptSecurityManager.getSystemPrincipal(),
        });
        gBrowser.selectedTab = tab;
      }
    } catch (error) {
      targetFolder = null;
      sourceWorkspaceId = null;
      console.error("[zen-folder-new-tab]", error);
    } finally {
      commandActive = false;
    }
  };

  const onUrlbarChange = () => {
    if (!targetFolder) return;
    // El usuario canceló la barra (Esc): no queremos capturar otra pestaña.
    if (!gURLBar?.hasAttribute("zen-newtab")) {
      targetFolder = null;
      sourceWorkspaceId = null;
    }
  };

  // Igual que hace Zen al anclar una pestaña: la URL real visitada pasa a ser
  // la URL anclada, en vez de quedar fijado about:blank/about:newtab.
  const progressListener = {
    onLocationChange(browser, webProgress, request, location) {
      if (!webProgress.isTopLevel) return;
      const tab = gBrowser.getTabForBrowser(browser);
      if (!tab || !awaitingFirstPage.has(tab)) return;
      if (EMPTY_PAGES.has(location.spec)) return;

      awaitingFirstPage.delete(tab);
      if (!tab.pinned) return;

      try {
        const sync = window.gZenWindowSync?.setPinnedTabState?.(tab);
        if (sync?.then) {
          sync.then(() =>
            window.gZenPinnedTabManager?.resetPinChangedUrl?.(tab)
          );
        } else {
          window.gZenPinnedTabManager?.resetPinChangedUrl?.(tab);
        }
      } catch (error) {
        console.warn("[zen-folder-new-tab] No se pudo actualizar la URL anclada", error);
      }
    },
  };

  const install = () => {
    if (destroyed) return;
    menu = document.getElementById("zenFolderActions");
    if (!menu) return;

    item = document.createXULElement("menuitem");
    item.id = MENU_ITEM_ID;
    item.setAttribute("label", LABEL);
    item.classList.add("zen-folder-new-tab-item");

    const anchor =
      document.getElementById("context_zenFolderRename") ||
      menu.firstElementChild;
    menu.insertBefore(item, anchor);

    // Marca de estado: permite comprobar que Sine cargó el script.
    try {
      Services.prefs.setBoolPref("zen-folder-new-tab.loaded", true);
    } catch {}

    menu.addEventListener("popupshowing", onPopupShowing);
    menu.addEventListener("popuphidden", onPopupHidden);
    menu.addEventListener("command", onCommand);
    window.addEventListener("TabOpen", onTabOpen);
    gBrowser.addTabsProgressListener(progressListener);

    if (gURLBar) {
      urlbarObserver = new MutationObserver(onUrlbarChange);
      urlbarObserver.observe(gURLBar, { attributeFilter: ["zen-newtab"] });
    }
  };

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;

    menu?.removeEventListener("popupshowing", onPopupShowing);
    menu?.removeEventListener("popuphidden", onPopupHidden);
    menu?.removeEventListener("command", onCommand);
    window.removeEventListener("TabOpen", onTabOpen);
    gBrowser?.removeTabsProgressListener?.(progressListener);
    urlbarObserver?.disconnect();
    item?.remove();

    if (window[KEY]?.destroy === destroy) delete window[KEY];
  };

  window[KEY] = { destroy };
  window.addEventListener("unload", destroy, { once: true });
  // Sine llama a esto al desactivar, eliminar o recargar el mod.
  window.addUnloadListener?.(destroy);

  const ready =
    typeof delayedStartupPromise?.then === "function"
      ? delayedStartupPromise
      : new Promise(resolve => {
          if (document.readyState === "complete") {
            resolve();
          } else {
            window.addEventListener("DOMContentLoaded", resolve, { once: true });
          }
        });

  ready.then(install).catch(error =>
    console.error("[zen-folder-new-tab] Error al instalar", error)
  );
})();
