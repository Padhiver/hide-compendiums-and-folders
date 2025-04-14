import { SettingsApp } from './modules/SettingsApp.js';

// Identifiant unique du module
const MODULE_ID = 'hide-compendiums-and-folders';
// Clés pour les paramètres Foundry VTT
const COMPENDIUM_SETTING_KEY = 'hiddenCompendiums';
const FOLDER_SETTING_KEY = 'hiddenFolders';

/**
 * Hook d'initialisation du module.
 * Enregistre les paramètres, le menu de configuration, précharge les templates Handlebars
 * et enregistre les helpers Handlebars nécessaires.
 */
Hooks.once('init', async () => {
  // Précharger les templates Handlebars pour l'application de configuration
  const templatesToLoad = [
    `modules/${MODULE_ID}/templates/settings-app.hbs`,
    `modules/${MODULE_ID}/templates/folder-row.hbs`
  ];
  await loadTemplates(templatesToLoad);

  // Enregistrer un helper Handlebars pour calculer l'indentation dans le template
  if (!Handlebars.helpers.multiply) {
    Handlebars.registerHelper('multiply', function (a, b) {
      return a * b;
    });
  }

  // --- Enregistrement des Paramètres ---

  // Stocke la liste des IDs des compendiums que l'utilisateur souhaite masquer
  game.settings.register(MODULE_ID, COMPENDIUM_SETTING_KEY, {
    name: game.i18n.localize('HIDECOMPENDIUM.SETTINGS.HIDDENLIST_COMPENDIUMS.NAME'),
    hint: game.i18n.localize('HIDECOMPENDIUM.SETTINGS.HIDDENLIST_COMPENDIUMS.HINT'),
    scope: 'world',
    config: false,
    type: Array,
    default: [],
  });

  // Stocke la liste des IDs des dossiers que l'utilisateur souhaite masquer
  game.settings.register(MODULE_ID, FOLDER_SETTING_KEY, {
    name: game.i18n.localize('HIDECOMPENDIUM.SETTINGS.HIDDENLIST_FOLDERS.NAME'),
    hint: game.i18n.localize('HIDECOMPENDIUM.SETTINGS.HIDDENLIST_FOLDERS.HINT'),
    scope: 'client',
    config: false,
    type: Array,
    default: [],
  });

  // --- Enregistrement du Menu de Configuration ---
  // Ajoute un bouton dans les paramètres du module pour ouvrir notre fenêtre de configuration
  game.settings.registerMenu(MODULE_ID, 'settingsMenu', {
    name: game.i18n.localize('HIDECOMPENDIUM.SETTINGS.MENU.NAME'), // Nom affiché dans la liste des menus
    label: game.i18n.localize('HIDECOMPENDIUM.SETTINGS.MENU.LABEL'), // Texte du bouton d'ouverture
    icon: "fas fa-eye-slash",
    type: SettingsApp,
    restricted: true        
  });

  console.log(`${MODULE_ID} | Initialisation terminée.`); 
});

/**
 * Hook exécuté après le rendu de l'onglet Compendiums.
 * Masque les compendiums et dossiers sélectionnés par l'utilisateur,
 * et masque également les dossiers devenus vides suite au masquage de leur contenu.
 */
Hooks.on('renderCompendiumDirectory', (app, html, data) => {
  // Récupérer les listes d'IDs à masquer depuis les paramètres
  const hiddenCompendiums = game.settings.get(MODULE_ID, COMPENDIUM_SETTING_KEY) || [];
  const hiddenFolders = game.settings.get(MODULE_ID, FOLDER_SETTING_KEY) || [];

  // --- Masquage des Compendiums ---
  if (hiddenCompendiums.length > 0) {
    html.querySelectorAll('li.directory-item.compendium').forEach(element => {
      const packId = element.dataset.pack;
      if (packId && hiddenCompendiums.includes(packId)) {
        element.style.setProperty('display', 'none', 'important');
        element.style.setProperty('visibility', 'hidden', 'important');
        element.classList.add('module-hidden-compendium');
      }
    });
  }

  // --- Masquage des Dossiers (choix explicite de l'utilisateur) ---
  if (hiddenFolders.length > 0) {
    html.querySelectorAll('li.directory-item.folder').forEach(element => {
      const folderId = element.dataset.folderId;
      if (folderId && hiddenFolders.includes(folderId)) {
        element.style.setProperty('display', 'none', 'important');
        element.style.setProperty('visibility', 'hidden', 'important');
        element.classList.add('module-hidden-folder');
      }
    });
  }

  // --- Masquage des Dossiers Devenus Vides (optionnel mais utile) ---
  // Parcourt les dossiers qui n'ont PAS été cachés explicitement
  html.querySelectorAll('li.directory-item.folder:not(.module-hidden-folder)').forEach(folderElement => {
    // Vérifie s'il reste des compendiums visibles DANS ce dossier
    const visibleCompendiums = folderElement.querySelectorAll(':scope > ol.directory-list > li.directory-item.compendium:not(.module-hidden-compendium)');
    // Vérifie s'il y avait des compendiums au total
    const totalCompendiums = folderElement.querySelectorAll(':scope > ol.directory-list > li.directory-item.compendium');

    if (visibleCompendiums.length === 0 && totalCompendiums.length > 0) {
       // Masque le dossier s'il est devenu vide
       folderElement.style.setProperty('display', 'none', 'important');
       folderElement.style.setProperty('visibility', 'hidden', 'important');
    }
  });
});