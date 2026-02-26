/**
 * Migration script: AbaNinja → SWIGS Workflow
 * Client: Moontain Studio (info@moontain.ch)
 *
 * Usage: cd backend && node scripts/migrate-abaninja-moontain.js
 *
 * This script imports:
 * - 22 clients → 22 Projects (one per client)
 * - 22 services/products → Services
 * - 22 invoices → Custom Invoices
 * - 1 quote → Quote
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import User from '../src/models/User.js';
import Status from '../src/models/Status.js';
import Project from '../src/models/Project.js';
import Invoice from '../src/models/Invoice.js';
import Quote from '../src/models/Quote.js';
import Service from '../src/models/Service.js';
import Settings from '../src/models/Settings.js';
import Counter from '../src/models/Counter.js';

// ============================================================
// AbaNinja DATA
// ============================================================

const CLIENTS = [
  { num: "A0001", name: "Fabienne Sauthier", email: "fasauthier@bluewin.ch", address: "Chemin de Perojet 10", zip: "1976", city: "Aven" },
  { num: "A0002", name: "Maud Sauthier", email: "famillesauthier@netplus.ch", address: "Chemin d'Allève 3", zip: "1976", city: "Erde" },
  { num: "A0003", name: "Dylan Roh", email: null, address: "", zip: "1976", city: "Aven" },
  { num: "A0004", name: "Speed-L", email: "info@speed-l.ch", address: "Place de la Gare 11", zip: "1950", city: "Sion", company: "Speed-L" },
  { num: "A0005", name: "Buffet de la Gare - Chez Claude", email: "gplaschy@yahoo.fr", address: "Avenue de la Gare 2", zip: "1955", city: "St-Pierre-de-Clages", company: "Buffet de la Gare - Chez Claude" },
  { num: "A0006", name: "Musées cantonaux", email: "Romaine.SYBURRA@admin.vs.ch", address: "Rue des Châteaux 14", zip: "1950", city: "Sion", company: "Musées cantonaux" },
  { num: "A0007", name: "Anne-Valérie Liand", email: null, address: "Av. du Grand-Champsec 2B", zip: "1950", city: "Sion" },
  { num: "A0008", name: "Delphine Bagnoud", email: null, address: "", zip: "1965", city: "Savièse" },
  { num: "A0009", name: "Colla Images", email: "sophie@collaimages.com", address: "Morasses 10", zip: "1920", city: "Martigny", company: "Colla Images" },
  { num: "A0010", name: "Refuge du Lac de Derborence", email: "info@refugederborence.ch", address: "Batterie Place du Village 3", zip: "1976", city: "Aven", company: "Refuge du Lac de Derborence" },
  { num: "A0012", name: "WA Risk Solutions", email: "s.clausen@wa-risk.ch", address: "Avenue de la Gare 30", zip: "1950", city: "Sion", company: "WA Risk Solutions" },
  { num: "A0013", name: "Evelyne Luyet", email: null, address: "Rte de la Motone 31", zip: "1965", city: "Savièse" },
  { num: "A0014", name: "ADLR Cosmetic Auto", email: "info@adlrcosmeticauto.ch", address: "Rue des vignettes 9b", zip: "1957", city: "Ardon", company: "ADLR Cosmetic Auto" },
  { num: "A0015", name: "Moontain Digital", email: "info@moontain-digital.ch", address: "Chemin d'Allève 3", zip: "1976", city: "Erde", company: "Moontain Digital" },
  { num: "A0016", name: "Gîte de Lodze", email: "olivierf@gitedelodze.ch", address: "", zip: "1976", city: "Erde", company: "Gîte de Lodze" },
  { num: "A0017", name: "Swigs SA", email: "info@swigs.ch", address: "Route de Saclentse 385", zip: "1996", city: "Saclentse", company: "Swigs SA" },
  { num: "A0018", name: "Jerome Dessimoz", email: null, address: "Route de Tsandoute 35", zip: "1976", city: "Erde" },
  { num: "A0019", name: "Catherine Meister", email: null, address: "Chemin d'Allève 4", zip: "1976", city: "Erde" },
  { num: "A0020", name: "Musées cantonaux - Section Promotion", email: "Ludivine.ALBERGANTI@admin.vs.ch", address: "Rue des Châteaux 14", zip: "1950", city: "Sion", company: "Musées cantonaux - Section Promotion" },
  { num: "A0021", name: "Jean-Michel Cajeux", email: "info@refugederborence.ch", address: "Rue de la Madeleine 38", zip: "1963", city: "Vétroz" },
  { num: "A0022", name: "IMPACT'COM SÀRL", email: null, address: "Route Cantonale 209", zip: "1963", city: "Vétroz", company: "IMPACT'COM SÀRL" },
  { num: "A0023", name: "Zhubi Sauthier Immobilier", email: "info@zhubi-sauthier.ch", address: "Chemin des écoliers 3", zip: "1964", city: "Conthey", company: "Zhubi Sauthier Immobilier" }
];

const SERVICES = [
  { number: "S0001", name: "Mise à jour site internet", group: "Site web", unitPrice: 100, unit: "HUR", taxRate: 0, type: "service" },
  { number: "S0002", name: "Mise en page et mise en ligne contenu pour réseaux sociaux et site internet", group: "Réseaux sociaux", unitPrice: 100, unit: "HUR", taxRate: 0, type: "service" },
  { number: "S0003", name: "Conception et mise en page de documents imprimés", group: "Design et graphisme", unitPrice: 120, unit: "HUR", taxRate: 8.1, type: "service" },
  { number: "S0004", name: "Scan photo", group: "Photographie", unitPrice: 80, unit: "C62", taxRate: null, type: "service" },
  { number: "S0005", name: "Séance portrait famille - En extérieur", group: "Photographie", unitPrice: 320, unit: "HUR", taxRate: 0, type: "service", desc: "Séance 1h : Environ 80-100 photos prises durant la séance\n15 photos retouchées en couleur + noir&blanc" },
  { number: "S0006", name: "Shooting immobilier", group: "Photographie", unitPrice: 100, unit: "HUR", taxRate: 0, type: "service" },
  { number: "S0007", name: "Tri et traitement de photos", group: "Photographie", unitPrice: 90, unit: "HUR", taxRate: 8.1, type: "service" },
  { number: "S0008", name: "Shooting photo - Événement", group: "Photographie", unitPrice: 100, unit: "HUR", taxRate: 8.1, type: "service", desc: "Prises de vue pendant l'événement\nGestion du matériel\nSélection rapide des meilleures photos" },
  { number: "S0009", name: "Libération des droits d'utilisation des images", group: "Photographie", unitPrice: 150, unit: "C62", taxRate: 8.1, type: "service" },
  { number: "S0010", name: "Export et transfert des fichiers", group: "Photographie", unitPrice: 80, unit: "HUR", taxRate: 8.1, type: "service" },
  { number: "S0011", name: "Préparation et utilisation de matériel photo professionnel", group: "Photographie", unitPrice: 80, unit: "HUR", taxRate: 8.1, type: "service" },
  { number: "S0012", name: "Hébergement et maintenance du site vitrine – Année 2026", group: "Site web", unitPrice: 400, unit: "C62", taxRate: 8.1, type: "service", desc: "Hébergement serveur, sauvegardes, supervision et maintenance de la plateforme d'administration incluse." },
  { number: "S0013", name: "Développement d'un site vitrine", group: "Site web", unitPrice: 2500, unit: "C62", taxRate: 8.1, type: "service", desc: "Conception et design personnalisé\nDéveloppement technique\nCréation d'un nom de domaine\nHébergement à la charge du client (~ CHF 400.- / année)" },
  { number: "S0014", name: "Reportage photo professionnel", group: "Photographie", unitPrice: 800, unit: "C62", taxRate: 8.1, type: "service" },
  { number: "S0015", name: "Campagne de communication sur les réseaux sociaux", group: "Réseaux sociaux", unitPrice: 600, unit: "C62", taxRate: 8.1, type: "service" },
  { number: "S0016", name: "Prise de vue vidéo | Tournage", group: "Vidéo", unitPrice: 120, unit: "HUR", taxRate: 8.1, type: "service" },
  { number: "S0017", name: "Postproduction vidéo | Montage", group: "Vidéo", unitPrice: 100, unit: "HUR", taxRate: 8.1, type: "service" },
  { number: "S0018", name: "Coordination de projet | Suivi", group: "Gestion de projet", unitPrice: 100, unit: "HUR", taxRate: 8.1, type: "service" },
  { number: "S0019", name: "Voix off | Scénario & capture", group: "Vidéo", unitPrice: 120, unit: "HUR", taxRate: 8.1, type: "service" },
  // Products
  { number: "P0001", name: "Lot de cartes postales", group: "Gallerie", unitPrice: 80, unit: "C62", taxRate: 0, type: "product", desc: "Vente 4.00 CHF / Pièce - Rabais 75% (1.00 CHF Pièce)" },
  { number: "P0002", name: "Impression Alu-Dibond", group: "Gallerie", unitPrice: 200, unit: "C62", taxRate: 0, type: "product", desc: "18x56 cm\nImpression sur Alu-dibond\nSupport pour crochet en L" },
  { number: "P0004", name: "Calendrier bureau 2026", group: "Gallerie", unitPrice: 40, unit: "C62", taxRate: 0, type: "product" }
];

// Invoices with line items (from v2 API)
const INVOICES = [
  {
    number: "R0023", ref: "2026.14.CB - Claude \"Buffet de la gare\"", status: "sent", date: "2026-02-18", dueDate: "2026-03-20",
    clientNum: "A0005", total: 487, discount: 15, notes: "",
    positions: [
      { desc: "Mise à jour site internet - St-Valentin\n\nAjout et adaptation de l'évènement - St-Valentin\nOptimisation du SEO", qty: 2, total: 200 },
      { desc: "Développement page d'accueil\n\nAjout de l'évènement prioritaire sur la page d'accueil\nAmélioration de l'administration pour la gestion des priorités", qty: 1.5, total: 180 },
      { desc: "Mise à jour site internet - Page d'accueil\n\nMise en page et graphisme de l'évènement embarqué en priorité\nModifications de l'image d'accueil", qty: 1, total: 100 },
      { desc: "Mise à jour site internet - Horaires\n\nAjout des horaires sur le pied de page et la page de contact", qty: 0.5, total: 50 }
    ]
  },
  {
    number: "R0022", ref: "2025.12.CB - Claude \"Buffet de la gare\" - 2ème partie", status: "draft", date: "2026-01-29", dueDate: "2026-02-26",
    clientNum: "A0005", total: 891.85, discount: 25, notes: "Offre de bienvenue : - 25%",
    positions: [
      { desc: "Reportage photo professionnel :\nPrise de vue sur place :\nPortraits du personnel et du chef\nMise en scène et shooting de plats & boissons\nMatériel professionnel inclus (éclairage, fond, etc.)\nPost-production et retouche des images (20–30 photos livrées)\nLivraison en format optimisé web + haute définition", qty: 1, total: 500 },
      { desc: "Campagne de communication sur les réseaux sociaux\nCréation de nouvelles pages Facebook & Instagram (ou reprise si possible)\nCréation de la ligne éditoriale et charte visuelle\nPlan de communication sur 1 mois", qty: 1, total: 600 }
    ]
  },
  {
    number: "R0021", ref: "2025.12.CB - Claude \"Buffet de la gare\" - 1ère partie", status: "sent", date: "2026-01-29", dueDate: "2026-02-26",
    clientNum: "A0005", total: 1702.60, discount: 25, notes: "Offre de bienvenue : - 25%",
    positions: [
      { desc: "Développement d'un site vitrine\nConception et design personnalisé\nDéveloppement technique\nCréation d'un nom de domaine\nHébergement à la charge du client (~ CHF 400.- / année)", qty: 1, total: 1800 },
      { desc: "Reportage photo professionnel :\nPhotos du bâtiment extérieur et intérieur\nLivraison en format optimisé web + haute définition", qty: 1, total: 300 }
    ]
  },
  {
    number: "R0020", ref: "", status: "paid", date: "2026-01-27", dueDate: "2026-02-26",
    clientNum: "A0005", total: 497.25, discount: 0, notes: "",
    positions: [
      { desc: "Hébergement et maintenance du site vitrine – Année 2025 - 2 mois\nHébergement serveur, sauvegardes, supervision et maintenance de la plateforme d'administration incluse.", qty: 1, total: 60 },
      { desc: "Hébergement et maintenance du site vitrine – Année 2026\nHébergement serveur, sauvegardes, supervision et maintenance de la plateforme d'administration incluse.", qty: 1, total: 400 }
    ]
  },
  {
    number: "R0019", ref: "2026.06.EB - Impact'com \"Projet Aluphoto\"", status: "paid", date: "2026-01-27", dueDate: "2026-02-26",
    clientNum: "A0022", total: 413.50, discount: 25, notes: "Offre de bienvenue : -25%",
    positions: [
      { desc: "Préparation de matériel photo professionnel", qty: 0.5, total: 40 },
      { desc: "Shooting photo - Mise en valeur entreprise\nPrises de vue\nGestion du matériel", qty: 2, total: 240 },
      { desc: "Tri et traitement de photos", qty: 2, total: 180 },
      { desc: "Libération des droits d'utilisation des images", qty: 1, total: 50 }
    ]
  },
  {
    number: "R0018", ref: "2026.07.FC - Speed-L", status: "paid", date: "2026-01-19", dueDate: "2026-02-18",
    clientNum: "A0004", total: 432.40, discount: 0, notes: "",
    positions: [
      { desc: "Hébergement et maintenance du site vitrine – Année 2026\nHébergement serveur, sauvegardes, supervision et maintenance de la plateforme d'administration incluse.", qty: 1, total: 400 }
    ]
  },
  {
    number: "R0017", ref: "2026.02.JC", status: "draft", date: "2026-01-02", dueDate: "2026-01-31",
    clientNum: "A0010", total: 248.10, discount: 15, notes: "Rabais fidélité : - 15%",
    positions: [
      { desc: "Conception et mise en page de documents imprimés", qty: 1, total: 120 },
      { desc: "16.02.2026 / 09:15 - 10:00 et 16:15 - 17:00 / 1,5 h\nMise en page et mise en ligne contenu pour réseaux sociaux et site internet - Postes 2026", qty: 1.5, total: 150 }
    ]
  },
  {
    number: "R0016", ref: "2025.03.JMC", status: "paid", date: "2025-12-18", dueDate: "2026-01-17",
    clientNum: "A0021", total: 120, discount: 25, notes: "Rabais fidélité : -25%",
    positions: [
      { desc: "Calendrier bureau 2026", qty: 4, total: 160 }
    ]
  },
  {
    number: "R0015", ref: "2025.18.CI - Colla Images", status: "paid", date: "2025-12-15", dueDate: "2026-01-14",
    clientNum: "A0009", total: 382.50, discount: 25, notes: "Rabais collaboration long terme : -25%",
    positions: [
      { desc: "Shooting photo - Chantier\nPrises de vue pendant le chantier\nGestion du matériel\nSélection rapide des meilleures photos", qty: 3.5, total: 350 },
      { desc: "Préparation du matériel et organisation", qty: 1, total: 80 },
      { desc: "Tri et mise à disposition des images", qty: 1, total: 80 }
    ]
  },
  {
    number: "R0014", ref: "2025.11.RS", status: "paid", date: "2025-12-09", dueDate: "2026-01-08",
    clientNum: "A0006", total: 960, discount: 25, notes: "Réduction de 25% : Collaboration long terme",
    positions: [
      { desc: "Scan photo - 5 boîtes\n\nTravail sur une période de 2 jours à raison de 8 heures par jour comprenant :\nLa préparation du post de numérisation\nLa préparation et la manipulation soigneuse des parts d'herbiers\nLa numérisation en haute résolution\nLe traitement et la vérification des fichiers numériques\nLa livraison des fichiers selon les standards convenus", qty: 2, total: 1280 }
    ]
  },
  {
    number: "R0013", ref: "2025.17.CI - Colla Images - Norton Peak", status: "paid", date: "2025-12-01", dueDate: "2025-12-31",
    clientNum: "A0009", total: 345, discount: 25, notes: "Rabais collaboration long terme : -25%",
    positions: [
      { desc: "Repérages\n\nVisite du lieu\nAnalyse de la lumière et des espaces\nPréparation du matériel et du plan de prises de vue", qty: 1, total: 60 },
      { desc: "Shooting photo - Événement\nPrises de vue pendant l'événement\nGestion du matériel\nSélection rapide des meilleures photos", qty: 4, total: 400 }
    ]
  },
  {
    number: "R0012", ref: "2025.16.CM", status: "paid", date: "2025-11-24", dueDate: "2025-12-24",
    clientNum: "A0019", total: 296, discount: 20, notes: "Rabais 20% : Offre de bienvenue",
    positions: [
      { desc: "Shooting immobilier\n\nSession photo complète : pièces, détails, ambiances\nRéalisation de 20 à 40 photos (selon taille du logement)\nDurée estimée : 1h à 1h30", qty: 1, total: 100 },
      { desc: "Tri et traitement de photos\n\nSélection des images\nRetouches : luminosité, cadrage, couleurs, verticales, ...\nLivraison de 15 à 25 photos retouchées en HD pour Airbnb", qty: 3, total: 270 }
    ]
  },
  {
    number: "R0011", ref: "2025.11.RS", status: "paid", date: "2025-12-02", dueDate: "2026-01-01",
    clientNum: "A0006", total: 7680, discount: 25, notes: "Réduction de 25% : Collaboration long terme",
    positions: [
      { desc: "Numérisation - Herbiers du Musée de la nature\n\nTravail sur une période de 16 jours à raison de 8 heures par jour comprenant :\nLa préparation du post de numérisation\nLa préparation et la manipulation soigneuse des parts d'herbiers\nLa numérisation en haute résolution\nLe traitement et la vérification des fichiers numériques\nLa livraison des fichiers selon les standards convenus", qty: 128, total: 10240 }
    ]
  },
  {
    number: "R0010", ref: "2025.13.FS", status: "paid", date: "2025-11-20", dueDate: "2025-12-20",
    clientNum: "A0001", total: 450, discount: 25, notes: "Rabais famille : -25%",
    positions: [
      { desc: "Impression Alu-Dibond\n18x56 cm\nImpression sur Alu-dibond\nSupport pour crochet en L", qty: 3, total: 600 },
      { desc: "Préparation des fichiers d'impression\nHarmonisation colorimétrique\nCalibrage, cadrage et adaptation au format final (triptyque)\n\nService offert !", qty: 0, total: 0 }
    ]
  },
  {
    number: "R0008", ref: "", status: "paid", date: "2025-11-14", dueDate: "2025-12-14",
    clientNum: "A0002", total: 465, discount: 0, notes: "",
    positions: [
      { desc: "Lot de calendriers bureau et mural", qty: 1, total: 465 }
    ]
  },
  {
    number: "R0001", ref: "2024.03.JC - Jean-Michel Cajeux - Refuge du Lac", status: "paid", date: "2025-11-13", dueDate: "2025-12-13",
    clientNum: "A0010", total: 1003, discount: 15, notes: "Réduction de 15% : Fidélité Refuge du Lac de Derborence",
    positions: [
      { desc: "Mise à jour site internet - Début de saison 2025", qty: 1.5, total: 150 },
      { desc: "Mise en page et mise en ligne contenu pour réseaux sociaux et site internet - \"78ème édition du Trophée des Muverans\"", qty: 1, total: 100 },
      { desc: "Mise en page et mise en ligne contenu pour réseaux sociaux et site internet - \"Menu fête des mères 2025\"", qty: 1, total: 100 },
      { desc: "Mise en page et mise en ligne contenu pour réseaux sociaux et site internet - \"Fermeture exceptionnelle\"", qty: 1, total: 100 },
      { desc: "Mise en page et mise en ligne contenu pour réseaux sociaux et site internet - \"Concours statue bouquetin\", relance et mise avant évènement", qty: 2.5, total: 250 },
      { desc: "Conception et mise en page d'affiche - Affiche et bulletins de vote - \"Concours statue bouquetin\"", qty: 1.5, total: 150 },
      { desc: "Mise en page et mise en ligne contenu pour réseaux sociaux et site internet - \"La Cuvée - Gin Derbo\"", qty: 1, total: 100 },
      { desc: "Lot de cartes postales\nVente 4.00 CHF / Pièce - Rabais 75% (1.00 CHF Pièce)", qty: 1, total: 80 },
      { desc: "Mise en page et mise en ligne contenu pour réseaux sociaux et site internet - \"Menu chasse 2025\"", qty: 1.5, total: 150 }
    ]
  },
  // Imported invoices (PDF-only, no line items) — single line with total
  {
    number: "R0003", ref: "2025.07.FC", status: "paid", date: "2025-11-10", dueDate: "2025-12-10",
    clientNum: "A0004", total: 600, discount: 0, notes: "Facture importée depuis AbaNinja",
    positions: [{ desc: "Prestations (facture importée)", qty: 1, total: 600 }],
    imported: true
  },
  {
    number: "R0002", ref: "", status: "paid", date: "2025-10-29", dueDate: "2025-11-28",
    clientNum: "A0004", total: 1665, discount: 0, notes: "Facture importée depuis AbaNinja",
    positions: [{ desc: "Prestations (facture importée)", qty: 1, total: 1665 }],
    imported: true
  },
  {
    number: "R0005", ref: "2025.13.CO", status: "paid", date: "2025-10-31", dueDate: "2025-11-30",
    clientNum: "A0009", total: 210, discount: 0, notes: "Facture importée depuis AbaNinja",
    positions: [{ desc: "Prestations (facture importée)", qty: 1, total: 210 }],
    imported: true
  },
  {
    number: "R0009", ref: "", status: "paid", date: "2025-09-26", dueDate: "2025-10-26",
    clientNum: "A0009", total: 1920, discount: 0, notes: "Facture importée depuis AbaNinja",
    positions: [{ desc: "Prestations (facture importée)", qty: 1, total: 1920 }],
    imported: true
  },
  {
    number: "R0004", ref: "", status: "paid", date: "2025-09-23", dueDate: "2025-10-23",
    clientNum: "A0012", total: 384, discount: 0, notes: "Facture importée depuis AbaNinja",
    positions: [{ desc: "Prestations (facture importée)", qty: 1, total: 384 }],
    imported: true
  },
  {
    number: "R0006", ref: "2025.02.EL", status: "paid", date: "2025-10-22", dueDate: "2025-11-22",
    clientNum: "A0013", total: 2120, discount: 0, notes: "Facture importée depuis AbaNinja",
    positions: [{ desc: "Prestations (facture importée)", qty: 1, total: 2120 }],
    imported: true
  }
];

const QUOTES = [
  {
    number: "O0010", ref: "2026.16.ZF - Zhubi Immobilier", status: "sent", date: "2026-02-19", validUntil: "2026-03-21",
    clientNum: "A0023", total: 2756.55, discount: 15,
    notes: "Proposition pour la réalisation de trois capsules vidéo (chantier, bien immobilier terminé et présentation de l'agence).\nLes prestations incluent la préparation, le tournage, la post-production complète ainsi que la livraison optimisée pour les réseaux sociaux.\nRabais famille : 15%",
    positions: [
      { desc: "Réalisation capsule vidéo – Chantier\n\nPréparation, ½ journée de tournage sur site, sélection et traitement des images, montage structuré et dynamique, étalonnage, sound design, livraison & réseaux sociaux.", qty: 1, total: 1000 },
      { desc: "Réalisation capsule vidéo – Bien immobilier terminé\n\nPréparation artistique, ½ journée de tournage, mise en valeur des volumes et de la lumière, montage soigné, étalonnage, sound design, livraison optimisée.", qty: 1, total: 1000 },
      { desc: "Réalisation capsule vidéo – Présentation de l'agence\n\nPréparation narrative, ½ journée de tournage, captation ambiance et équipe, montage dynamique et humain, étalonnage, sound design, livraison finale optimisée.", qty: 1, total: 1000 }
    ]
  }
];

// ============================================================
// CATEGORY MAPPING
// ============================================================

const CATEGORY_MAP = {
  'Site web': 'development',
  'Réseaux sociaux': 'consulting',
  'Photographie': 'other',
  'Design et graphisme': 'design',
  'Vidéo': 'other',
  'Gestion de projet': 'consulting',
  'Gallerie': 'other'
};

const PRICE_TYPE_MAP = {
  'HUR': 'hourly',
  'C62': 'fixed'
};

// ============================================================
// MIGRATION
// ============================================================

async function migrate() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/swigs-workflow';
  console.log(`Connecting to ${MONGODB_URI}...`);
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB\n');

  // 1. Find or create user
  let user = await User.findOne({ email: 'info@moontain.ch' });
  if (!user) {
    user = await User.create({ email: 'info@moontain.ch', name: 'Moontain Studio', isActive: true });
    console.log(`✓ Created user: ${user._id}`);
  } else {
    console.log(`✓ Found existing user: ${user._id}`);
  }
  const userId = user._id;

  // 2. Check/create default status
  let defaultStatus = await Status.findOne({ userId, isDefault: true });
  if (!defaultStatus) {
    // Check if any statuses exist for this user
    const existingStatuses = await Status.find({ userId });
    if (existingStatuses.length > 0) {
      defaultStatus = existingStatuses[0];
      console.log(`✓ Using existing status: "${defaultStatus.name}"`);
    } else {
      const statuses = [
        { userId, name: 'En cours', color: '#3B82F6', order: 0, isDefault: true },
        { userId, name: 'En attente', color: '#F59E0B', order: 1, isDefault: false },
        { userId, name: 'Terminé', color: '#10B981', order: 2, isDefault: false },
        { userId, name: 'Archivé', color: '#6B7280', order: 3, isDefault: false }
      ];
      const created = await Status.insertMany(statuses);
      defaultStatus = created[0];
      console.log(`✓ Created ${created.length} statuses`);
    }
  } else {
    console.log(`✓ Found existing default status: "${defaultStatus.name}"`);
  }

  // 3. Create/update settings
  const settings = await Settings.getSettings(userId);
  if (settings && !settings.company?.name) {
    settings.company = {
      name: 'Moontain Studio',
      email: 'info@moontain.ch',
      country: 'CH'
    };
    settings.invoicing = {
      ...settings.invoicing,
      invoicePrefix: 'FAC-',
      quotePrefix: 'DEV-',
      defaultVatRate: 8.1,
      defaultPaymentTerms: 30
    };
    await settings.save();
    console.log('✓ Updated settings');
  } else {
    console.log('✓ Settings already configured');
  }

  // 4. Create services
  const existingServices = await Service.find({ userId });
  if (existingServices.length > 0) {
    console.log(`⚠ ${existingServices.length} services already exist, skipping service creation`);
  } else {
    const serviceDocs = SERVICES.map((s, i) => ({
      userId,
      name: `[${s.number}] ${s.name}`,
      description: s.desc || '',
      category: CATEGORY_MAP[s.group] || 'other',
      priceType: PRICE_TYPE_MAP[s.unit] || 'fixed',
      unitPrice: s.unitPrice,
      isActive: true,
      order: i
    }));
    await Service.insertMany(serviceDocs);
    console.log(`✓ Created ${serviceDocs.length} services`);
  }

  // 5. Create projects (one per client)
  const projectMap = {}; // clientNum → projectId
  const existingProjects = await Project.find({ userId });

  if (existingProjects.length > 0) {
    console.log(`⚠ ${existingProjects.length} projects already exist, checking for matches...`);
    // Try to match existing projects by client name
    for (const p of existingProjects) {
      const client = CLIENTS.find(c => c.name === p.client?.name || c.name === p.name);
      if (client) {
        projectMap[client.num] = p._id;
      }
    }
  }

  // Determine which clients need projects
  const clientsWithDocs = new Set();
  INVOICES.forEach(inv => clientsWithDocs.add(inv.clientNum));
  QUOTES.forEach(q => clientsWithDocs.add(q.clientNum));

  // Match existing projects by AbaNinja client number in notes
  for (const p of existingProjects) {
    const match = p.notes?.match(/Client AbaNinja: (A\d+)/);
    if (match) {
      projectMap[match[1]] = p._id;
    }
  }

  // Create missing projects
  for (const client of CLIENTS) {
    if (projectMap[client.num]) continue; // already mapped

    const fullAddress = [client.address, `${client.zip} ${client.city}`].filter(Boolean).join(', ');
    const project = await Project.create({
      userId,
      name: client.company || client.name,
      client: {
        name: client.name,
        email: client.email || undefined,
        company: client.company || undefined,
        address: fullAddress || undefined
      },
      status: defaultStatus._id,
      tags: ['import-abaninja'],
      notes: `Client AbaNinja: ${client.num}`
    });
    projectMap[client.num] = project._id;
  }
  console.log(`✓ Created/mapped ${Object.keys(projectMap).length} projects`);

  // 6. Create invoices
  const existingInvoiceNumbers = new Set(
    (await Invoice.find({ number: { $in: INVOICES.map(i => i.number) } }, 'number')).map(i => i.number)
  );
  if (existingInvoiceNumbers.size > 0) {
    console.log(`⚠ ${existingInvoiceNumbers.size} invoices already exist, will skip duplicates`);
  }
  {
    let invoiceCount = 0;
    for (const inv of INVOICES) {
      if (existingInvoiceNumbers.has(inv.number)) {
        console.log(`  → Skipping existing invoice ${inv.number}`);
        continue;
      }
      const projectId = projectMap[inv.clientNum];
      if (!projectId) {
        console.log(`  ⚠ No project for client ${inv.clientNum}, skipping invoice ${inv.number}`);
        continue;
      }

      // Build custom lines — apply discount proportionally to each line
      const discountMultiplier = inv.discount > 0 ? (1 - inv.discount / 100) : 1;
      const customLines = inv.positions
        .filter(p => p.total > 0 || p.qty > 0)
        .map(p => {
          const adjustedTotal = Math.round(p.total * discountMultiplier * 100) / 100;
          const qty = p.qty || 1;
          const unitPrice = qty > 0 ? Math.round((adjustedTotal / qty) * 100) / 100 : adjustedTotal;
          return {
            description: p.desc,
            quantity: qty,
            unitPrice,
            total: adjustedTotal
          };
        });

      const subtotal = customLines.reduce((sum, l) => sum + l.total, 0);
      const vatRate = 8.1;
      const vatAmount = Math.round(subtotal * (vatRate / 100) * 100) / 100;
      const total = Math.round((subtotal + vatAmount) * 100) / 100;

      const invoice = new Invoice({
        project: projectId,
        number: inv.number,
        invoiceType: 'custom',
        customLines,
        subtotal: Math.round(subtotal * 100) / 100,
        vatRate,
        vatAmount,
        total: inv.total, // Use AbaNinja's exact total
        status: inv.status,
        issueDate: new Date(inv.date),
        dueDate: new Date(inv.dueDate),
        paidAt: inv.status === 'paid' ? new Date(inv.dueDate) : undefined,
        notes: [inv.ref, inv.notes, inv.discount > 0 ? `Remise ${inv.discount}% appliquée` : ''].filter(Boolean).join('\n'),
        skipReminders: true // Don't send reminders for imported invoices
      });
      await invoice.save();
      invoiceCount++;
    }
    console.log(`✓ Created ${invoiceCount} invoices`);
  }

  // 7. Create quote
  const existingQuoteNumbers = new Set(
    (await Quote.find({ number: { $in: QUOTES.map(q => q.number) } }, 'number')).map(q => q.number)
  );
  {
    for (const q of QUOTES) {
      if (existingQuoteNumbers.has(q.number)) {
        console.log(`  → Skipping existing quote ${q.number}`);
        continue;
      }
      const projectId = projectMap[q.clientNum];
      if (!projectId) {
        console.log(`  ⚠ No project for client ${q.clientNum}, skipping quote ${q.number}`);
        continue;
      }

      // Build lines — apply discount proportionally
      const discountMultiplier = q.discount > 0 ? (1 - q.discount / 100) : 1;
      const lines = q.positions.map(p => {
        const adjustedTotal = Math.round(p.total * discountMultiplier * 100) / 100;
        const qty = p.qty || 1;
        const unitPrice = qty > 0 ? Math.round((adjustedTotal / qty) * 100) / 100 : adjustedTotal;
        return {
          description: p.desc,
          quantity: qty,
          unitPrice,
          total: adjustedTotal
        };
      });

      const subtotal = lines.reduce((sum, l) => sum + l.total, 0);
      const vatRate = 8.1;
      const vatAmount = Math.round(subtotal * (vatRate / 100) * 100) / 100;

      const quote = new Quote({
        project: projectId,
        number: q.number,
        lines,
        subtotal: Math.round(subtotal * 100) / 100,
        vatRate,
        vatAmount,
        total: q.total, // Use AbaNinja's exact total
        status: q.status,
        issueDate: new Date(q.date),
        validUntil: new Date(q.validUntil),
        notes: [q.ref, q.notes].filter(Boolean).join('\n')
      });
      await quote.save();
    }
    console.log(`✓ Created ${QUOTES.length} quotes`);
  }

  // 8. Summary
  console.log('\n====================================');
  console.log('Migration complete!');
  console.log('====================================');
  console.log(`User: ${user.email} (${userId})`);
  console.log(`Projects: ${Object.keys(projectMap).length}`);
  console.log(`Invoices: ${INVOICES.length}`);
  console.log(`Quotes: ${QUOTES.length}`);
  console.log(`Services: ${SERVICES.length}`);

  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
