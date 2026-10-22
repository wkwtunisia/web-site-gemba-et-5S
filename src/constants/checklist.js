/**
 * Source de vérité pour la checklist 5S.
 * L'ordre est celui du fichier Excel, entre "Pilote de la zone" et "Total points".
 * Chaque question est suivie d'une colonne "Action /Pilote / DateN" (N = 1..26, sans N pour la 1ère).
 */
export const QUESTIONS = [
  "Pas d'objets inutiles (objets, outils, matériaux) non liés au processus/ production en cours (également dans les armoires, casiers)",
  "Pas d'affichages inutiles",
  "Les équipements et outillages partagés par plusieurs lignes/postes sont placés dans un espace commun",
  "Pas d'objet, outillage, matériel, produit chimique,… présentant un risque sécurité",
  "Tous les éléments mobiles (outillage, gabarit)) ont un emplacement de stockage défini",
  "Les objets fréquemment utilisés sont situés à proximité de leur point d'utilisation",
  "Chaque chose à sa place, lorsqu'elle n'est pas utilisée",
  "Tous les objets sont dans leur état standard (armoires électriques, tiroirs, couvercles fermés, ,,,)",
  "Un marquage au sol est réalisé",
  "Accès libre au matériel incendie et issues de secours",
  "La zone de travail est propre et en bon état : sol, zoning, machines et équipements, câbles, outillages, conteneurs,postes et table de contrôle, documentation, armoires, racks, étagères, panneaux ...",
  "Les sources de saleté (fuite d'eau, d'huile) sont détectées et assignée pour l'élimination",
  "Kit de nettoyage disponible, accessible et adapté",
  "Tri sélectif du déchets / rebuts est respecté",
  "Chaque lieu de stockage défini pour un objet mobile (outillage, gabarit de contrôle,...) est identifié",
  "Les conditions standards Visuel 5S du périmètre sont respectés (y compris les armoires, tiroirs, luminaires et surfaces en contact direct avec le produit)",
  "Tous les objets/ contenants (y compris pour déchets) sont clairement identifiés",
  "Les instructions de nettoyage et de tri sélectif sont définis",
  "Marquage des zones, des canalisations et des équipements est réalisé",
  "Un standard de kit de nettoyage est défini et est disponible",
  "Un affichage visuel défini le standard du port des EPI",
  "Les standards définis dans la zone sont connues et respectées par tous les membres de l'équipe (y compris les nouveaux arrivants)",
  "Présence et respect du planning 5S",
  "Le personnel porte les EPI",
  "Tableau de marche et indicateurs du tableau de bord à jour",
  "Le flux de production (lay-out) est clair et respecté",
]

/** Noms des colonnes "action" correspondantes, dans l'ordre. */
export const ACTION_HEADERS = QUESTIONS.map((_, i) =>
  i === 0 ? 'Action /Pilote / Date' : `Action /Pilote / Date${i + 1}`
)

/** Noms des colonnes fixes identifiant un audit. */
export const META_HEADERS = {
  date:    'Date',
  auditor: 'Auditeur',
  zone:    'Zone/ Ligne/ Poste',
  pilot:   'Pilote de la zone',
  total:   'Total points',
}

export const MAX_POINTS = QUESTIONS.length
