// Classe définissant la fenêtre de configuration (ApplicationV2)
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// Réutilisation des constantes définies dans main.js
const MODULE_ID = 'hide-compendiums-and-folders';
const COMPENDIUM_SETTING_KEY = 'hiddenCompendiums';
const FOLDER_SETTING_KEY = 'hiddenFolders';

export class SettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["hide-compendium-dialog"],
    tag: "form", 
    // Options du gestionnaire de formulaire intégré V2
    form: {
      handler: SettingsApp.#onSubmit, 
      closeOnSubmit: false,           
    },
    // Position et taille
    position: {
      width: 600,
      height: "auto", // S'adapte au contenu
    },
    // Options spécifiques à la fenêtre (barre de titre, classes CSS)
    window: {
      title: "HIDECOMPENDIUM.SETTINGS.WINDOW_TITLE", 
      contentClasses: ["standard-form"], // Classes CSS pour le style
    },
  };

  /**
   * Getter pour retourner le titre localisé de la fenêtre.
   * @returns {string} Le titre traduit.
   */
  get title() {
    return game.i18n.localize(this.options.window.title);
  }

  /**
   * Déclare les "parties" de l'application V2 et leurs templates Handlebars associés.
   * @override
   */
  static PARTS = {
    // Partie principale du contenu
    content: {
      template: `modules/${MODULE_ID}/templates/settings-app.hbs`,
      classes: ["scrollable"]
    },
    // Partie pied de page (pour les boutons)
    footer: {
      template: "templates/generic/form-footer.hbs",
    }
  };

  /**
   * Prépare les données (contexte) à envoyer aux templates Handlebars avant le rendu.
   * @param {object} options - Options de rendu.
   * @returns {Promise<object>} Le contexte pour les templates.
   * @override
   */
  async _prepareContext(options) {
    // Récupérer les listes actuelles d'IDs cachés
    const hiddenCompendiums = game.settings.get(MODULE_ID, COMPENDIUM_SETTING_KEY) || [];
    const hiddenFolders = game.settings.get(MODULE_ID, FOLDER_SETTING_KEY) || [];

    // --- Groupement des Compendiums par Module/Système ---
    const packGroups = {};
    for (const pack of game.packs) {
      if (!pack.visible) continue; 
      const metadata = pack.metadata;
      const packageName = metadata.packageName;
      let packageTitle = game.i18n.localize('HIDECOMPENDIUM.SETTINGS.UNKNOWN_PACKAGE');

      // Déterminer le titre lisible (déjà localisé par Foundry)
      if (metadata.packageType === "system") { packageTitle = game.system.title; }
      else if (metadata.packageType === "module") {
        const module = game.modules.get(packageName);
        packageTitle = module ? module.title : packageName;
      }

      // Initialiser le groupe si nécessaire
      if (!packGroups[packageTitle]) {
        packGroups[packageTitle] = {
          title: packageTitle,
          packs: [],
          isPackGroup: true 
        };
      }

      // Ajouter les données du pack au groupe
      packGroups[packageTitle].packs.push({
        id: pack.collection,
        label: metadata.label,
        isHidden: hiddenCompendiums.includes(pack.collection)
      });
    }
    // Trier les groupes et les packs à l'intérieur
    const sortedPackGroups = Object.values(packGroups).sort((a, b) => a.title.localeCompare(b.title));
    sortedPackGroups.forEach(group => group.packs.sort((a, b) => a.label.localeCompare(b.label)));

    // --- Construction de la Hiérarchie des Dossiers ---
    const allFolders = game.folders.filter(f => f.type === "Compendium");
    const folderMap = new Map();
    const rootFolders = [];  

    // Créer des objets de données pour chaque dossier
    for (const folder of allFolders) {
      const folderData = {
        id: folder.id,
        label: folder.name, 
        isHidden: hiddenFolders.includes(folder.id),
        isFolder: true,
        parentId: folder.folder?.id ?? null, 
        children: [], 
        depth: 0      
      };
      folderMap.set(folder.id, folderData);
    }

    // Fonction récursive pour calculer la profondeur de chaque dossier dans l'arbre
    const calculateDepth = (folderData, depth) => {
        folderData.depth = depth;
        folderData.children.forEach(child => calculateDepth(child, depth + 1));
    };

    // Associer les enfants aux parents et identifier les racines
    folderMap.forEach(folderData => {
        if (folderData.parentId && folderMap.has(folderData.parentId)) {
            // Ajoute ce dossier comme enfant de son parent trouvé dans la map
            folderMap.get(folderData.parentId).children.push(folderData);
        } else {
            // Pas de parent (ou parent non trouvé), c'est un dossier racine
            rootFolders.push(folderData);
        }
    });

    // Trier les enfants de chaque dossier et calculer la profondeur à partir des racines
    folderMap.forEach(folderData => folderData.children.sort((a,b) => a.label.localeCompare(b.label)));
    rootFolders.sort((a,b) => a.label.localeCompare(b.label));
    rootFolders.forEach(root => calculateDepth(root, 0));

    // Créer le groupe "Dossiers" pour le template s'il y a des dossiers
    const folderHierarchyGroup = rootFolders.length > 0 ? {
        title: game.i18n.localize("HIDECOMPENDIUM.SETTINGS.FOLDER_GROUP_TITLE"),
        items: rootFolders, 
        isFolderHierarchyGroup: true 
    } : null;

    // --- Finalisation du Contexte ---
    // Combiner les groupes de packs et le groupe de dossiers
    const allGroups = [...sortedPackGroups];
    if (folderHierarchyGroup) {
      allGroups.push(folderHierarchyGroup);
    }

    // Retourner le contexte complet pour Handlebars
    return {
      groups: allGroups, 
      notes: game.i18n.localize('HIDECOMPENDIUM.SETTINGS.NOTES'), 
      // Configuration pour le bouton "Sauvegarder" dans le footer générique
      buttons: [
        { type: "submit", icon: "fa-solid fa-save", label: game.i18n.localize("SETTINGS.Save") }
      ]
    };
  }

  /**
   * Méthode appelée lors de la soumission du formulaire (clic sur sauvegarder).
   * Récupère les données, détermine quels compendiums/dossiers sont cochés pour être cachés,
   * et sauvegarde les IDs dans les paramètres correspondants.
   * @param {SubmitEvent} event - L'événement de soumission.
   * @param {HTMLFormElement} form - L'élément formulaire HTML.
   * @param {FormDataExtended} formData - Données du formulaire étendues par Foundry.
   * @private
   */
  static async #onSubmit(event, form, formData) {
    const submittedData = formData.object; 
    const hiddenCompendiumIds = [];
    const hiddenFolderIds = [];

    // Parcourir les données soumises pour trouver les éléments cochés
    for (const key in submittedData) {
      const isChecked = submittedData[key] === true;
      if (!isChecked) continue; 

      if (key.startsWith("hide.")) { // C'est un compendium
        const compendiumId = key.substring(5); // Extrait l'ID après "hide."
        if (compendiumId) hiddenCompendiumIds.push(compendiumId);
      } else if (key.startsWith("hideFolder.")) { // C'est un dossier
        const folderId = key.substring(11); // Extrait l'ID après "hideFolder."
        if (folderId) hiddenFolderIds.push(folderId);
      }
    }

    // Sauvegarder les deux listes d'IDs dans les paramètres respectifs
    await game.settings.set(MODULE_ID, COMPENDIUM_SETTING_KEY, hiddenCompendiumIds);
    await game.settings.set(MODULE_ID, FOLDER_SETTING_KEY, hiddenFolderIds);

    // Rafraîchir l'affichage de l'onglet compendiums pour appliquer les changements immédiatement
    if (ui.compendium) {
      ui.compendium.render(true);
    }
  }
}