/**
 * Migration script: AbaNinja → SWIGS Workflow
 * Client: ADLR Cosmetic Auto (info@adlrcosmeticauto.ch)
 *
 * Usage: cd backend && node scripts/migrate-abaninja-adlr.js
 *
 * This script imports:
 * - 16 clients → 16 Projects (one per client)
 * - 80 services/products → Services
 * - 33 invoices → Custom Invoices
 * - 16 active quotes → Quotes
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
// AbaNinja DATA — ADLR Cosmetic Auto
// ============================================================

const CLIENTS = [
  { num: "A0001", name: "Car Cosmetic Sàrl", type: "company", street: "Route suisse 47", zip: "1196", city: "Gland", phone: "+41 79 341 75 63", contact: "Anthony Suan" },
  { num: "A0002", name: "Julien Léonard", type: "person", street: "", zip: "1955", city: "St-Pierre-de-Clages" },
  { num: "A0003", name: "Corentin Flaction", type: "person", street: "", zip: "1955", city: "St-Pierre-de-Clages" },
  { num: "A0004", name: "Didier Georgy", type: "person", street: "Chemin du Toulin 5C", zip: "1907", city: "Saxon" },
  { num: "A0005", name: "François Schmaltzried", type: "person", street: "", zip: "1955", city: "St-Pierre-de-Clages" },
  { num: "A0006", name: "CERATECHPRO REUSSE GmbH", type: "company", street: "Boden 4", zip: "6376", city: "Emmetten", contact: "Arnaud Reusse", phone: "0754197556", archived: true },
  { num: "A0007", name: "Garage AMR", type: "company", street: "Chemin de l'Autoroute 55", zip: "1958", city: "St-Léonard" },
  { num: "A0008", name: "Gael Gaillard", type: "person", street: "", zip: "1964", city: "Conthey" },
  { num: "A0009", name: "Client Passage", type: "person", street: "-", zip: "1955", city: "Saint-Pierre-De-Clages" },
  { num: "A001",  name: "Fabian Kozelsky", type: "person", street: "Passage de la Matze 3", zip: "1950", city: "Sion", phone: "+41 79 523 71 27" },
  { num: "A0010", name: "Gaillard Charly et fils SA", type: "company", street: "Route de la Blanchette 2", zip: "1976", city: "Erde" },
  { num: "A0011", name: "Garage Sédunois SA", type: "company", street: "Route de Riddes 115", zip: "1950", city: "Sion" },
  { num: "A0012", name: "David Papilloud", type: "person", street: "", zip: "1955", city: "St-Pierre-de-Clages" },
  { num: "A0013", name: "SEB Automobile Sàrl", type: "company", street: "Rue du Petit Pont 59", zip: "1964", city: "Conthey" },
  { num: "A0014", name: "Kozelsky Sàrl", type: "company", street: "Passage de la Matze 3", zip: "1950", city: "Sion" },
  { num: "A0015", name: "ALPARK SA", type: "company", street: "Chemin Lambien 12", zip: "1950", city: "Sion", phone: "+41 27 324 42 42" }
];

const SERVICES = [
  // Services (hourly-based detailing)
  { key: "001", name: "Lavage manuel", desc: "Méthode des deux seaux - gant extra doux", price: 100, type: "hourly", cat: "Lavage" },
  { key: "002", name: "Prélavage au canon à mousse", price: 100, type: "hourly", cat: "Lavage" },
  { key: "003", name: "Lavage roues, pneus et arches", price: 100, type: "hourly", cat: "Lavage" },
  { key: "004", name: "Décontamination chimique #1 (dégoudronnant)", price: 100, type: "hourly", cat: "Décontamination" },
  { key: "005", name: "Décontamination chimique #2 (ferreux)", price: 100, type: "hourly", cat: "Décontamination" },
  { key: "006", name: "Décontamination mécanique (clay bar)", price: 100, type: "hourly", cat: "Décontamination" },
  { key: "007", name: "Rinçage final et séchage carrosserie", price: 100, type: "hourly", cat: "Lavage" },
  { key: "008", name: "Masquage joints et plastiques", price: 100, type: "hourly", cat: "Polissage" },
  { key: "009", name: "Polissage carrosserie (1 étape, -70% microrayures)", price: 110, type: "hourly", cat: "Polissage" },
  { key: "0010", name: "Lavage compartiment moteur", price: 100, type: "hourly", cat: "Lavage" },
  { key: "010", name: "Polissage phares et feux", price: 110, type: "fixed", cat: "Polissage" },
  { key: "011", name: "Dégraissage avant protection", price: 100, type: "hourly", cat: "Protection" },
  { key: "012", name: "Application cire #1 (1 couche)", price: 100, type: "hourly", cat: "Protection" },
  { key: "013", name: "Application cire #2 (2 couches)", price: 100, type: "hourly", cat: "Protection" },
  { key: "014", name: "Traitement céramique carrosserie/phares (2 couches)", price: 110, type: "hourly", cat: "Protection" },
  { key: "016", name: "Nettoyage châssis", price: 100, type: "hourly", cat: "Lavage" },
  { key: "017", name: "Aspiration/dépoussiérage intérieur", price: 100, type: "hourly", cat: "Intérieur" },
  { key: "018", name: "Soin des cuirs", desc: "Nettoyage puis nutrition de chaque cm2 de cuirs", price: 100, type: "hourly", cat: "Intérieur" },
  { key: "019", name: "Shampooing sièges en tissus", price: 100, type: "hourly", cat: "Intérieur" },
  { key: "020", name: "Rinçage", price: 100, type: "hourly", cat: "Lavage" },
  { key: "021", name: "Séchage manuel", price: 100, type: "hourly", cat: "Lavage" },
  { key: "022", name: "Lavage partie visible jantes", price: 100, type: "hourly", cat: "Lavage" },
  { key: "023", name: "Lavage flancs de pneus", price: 100, type: "hourly", cat: "Lavage" },
  { key: "024", name: "Séchage passages de portes", price: 100, type: "hourly", cat: "Lavage" },
  { key: "025", name: "Aspiration habitacle", price: 100, type: "hourly", cat: "Intérieur" },
  { key: "026", name: "Dépoussiérage tableau de bord et console", price: 100, type: "hourly", cat: "Intérieur" },
  { key: "027", name: "Nettoyage des vitres", price: 100, type: "hourly", cat: "Intérieur" },
  { key: "028", name: "Finition satinée pneus", price: 100, type: "hourly", cat: "Finition" },
  { key: "029", name: "Polissage carbone intérieur", price: 110, type: "hourly", cat: "Polissage" },
  { key: "030", name: "Nettoyage ceintures", price: 100, type: "hourly", cat: "Intérieur" },
  { key: "031", name: "Polissage lunette arrière", price: 110, type: "hourly", cat: "Polissage" },
  { key: "033", name: "Céramique vitres extérieures (forfait)", desc: "En 1 couche", price: 250, type: "fixed", cat: "Protection" },
  { key: "0034", name: "Nettoyage passages de portes", price: 100, type: "hourly", cat: "Intérieur" },
  { key: "034", name: "Céramique jantes extérieur (forfait)", desc: "En 1 couche", price: 250, type: "fixed", cat: "Protection" },
  { key: "035", name: "Céramique intégralité jantes (forfait)", desc: "Face int, ext + étrier", price: 600, type: "fixed", cat: "Protection" },
  { key: "35", name: "Lavage approfondi jantes/pneus/passages roues", price: 100, type: "hourly", cat: "Lavage" },
  { key: "0035", name: "Aspiration poussée habitacle", price: 100, type: "hourly", cat: "Intérieur" },
  { key: "0036", name: "Cire protection express carrosserie", desc: "Durée ~2 semaines", price: 100, type: "hourly", cat: "Protection" },
  { key: "37", name: "Polissage et correction vernis (véhicule neuf)", price: 110, type: "hourly", cat: "Polissage" },
  { key: "0039", name: "Dépoussiérage/nettoyage tableau de bord complet", price: 100, type: "hourly", cat: "Intérieur" },
  { key: "050", name: "Forfait polish", desc: "Correction vernis véhicule neuf", price: 680, type: "fixed", cat: "Polissage" },
  { key: "S0001", name: "Forfait polish et céramique", desc: "Correction vernis + protection céramique", price: 1600, type: "fixed", cat: "Forfait" },
  { key: "S0002", name: "Travail en sous-traitance", price: 100, type: "hourly", cat: "Autre" },
  { key: "S0003", name: "Céramique plastiques et joints extérieurs", price: 100, type: "hourly", cat: "Protection" },
  { key: "P0001", name: "Bon cadeau", price: 150, type: "fixed", cat: "Autre" }
];

// Invoices (active, non-cancelled) with their line items
const INVOICES = [
  {
    number: "R0001", status: "paid", date: "2025-02-16", dueDate: "2025-03-18",
    clientNum: "A0003", total: 250, poNumber: "",
    positions: [
      { desc: "Lavage partie visible des jantes", qty: 0.15, price: 100, total: 15 },
      { desc: "Prélavage au canon à mousse", qty: 0.15, price: 100, total: 15 },
      { desc: "Lavage manuel", qty: 0.25, price: 100, total: 25 },
      { desc: "Rinçage final et séchage", qty: 0.15, price: 100, total: 15 },
      { desc: "Séchage passages de portes", qty: 0.05, price: 100, total: 5 },
      { desc: "Aspiration/dépoussiérage intérieur", qty: 0.55, price: 100, total: 55 },
      { desc: "Nettoyage des vitres", qty: 0.1, price: 100, total: 10 },
      { desc: "Finition satinée pneus", qty: 0.1, price: 100, total: 10 },
      { desc: "Shampooing sièges en tissus", qty: 0.5, price: 100, total: 50 },
      { desc: "Lavage approfondi jantes démontées", qty: 0.5, price: 100, total: 50 }
    ]
  },
  {
    number: "R0002", status: "paid", date: "2025-03-10", dueDate: "2025-04-09",
    clientNum: "A0005", total: 180, poNumber: "",
    positions: [
      { desc: "Lavage partie visible des jantes", qty: 0.15, price: 100, total: 15 },
      { desc: "Prélavage au canon à mousse", qty: 0.2, price: 100, total: 20 },
      { desc: "Lavage manuel", qty: 0.35, price: 100, total: 35 },
      { desc: "Rinçage final et séchage", qty: 0.15, price: 100, total: 15 },
      { desc: "Séchage passages de portes", qty: 0.15, price: 100, total: 15 },
      { desc: "Aspiration/dépoussiérage intérieur", qty: 0.75, price: 100, total: 75 },
      { desc: "Nettoyage des vitres", qty: 0.15, price: 100, total: 15 },
      { desc: "Finition satinée pneus", qty: 0.1, price: 100, total: 10 }
    ]
  },
  {
    number: "R0003", status: "paid", date: "2025-03-20", dueDate: "2025-04-01",
    clientNum: "A0004", total: 749, poNumber: "",
    positions: [
      { desc: "Prélavage au canon à mousse", qty: 1, price: 100, total: 100 },
      { desc: "Décontamination chimique #1 (dégoudronnant)", qty: 0.33, price: 100, total: 33 },
      { desc: "Décontamination chimique #2 (ferreux)", qty: 0.33, price: 100, total: 33 },
      { desc: "Décontamination mécanique (clay bar)", qty: 0.33, price: 100, total: 33 },
      { desc: "Polissage carrosserie 1 étape", qty: 5, price: 110, total: 550 }
    ]
  },
  {
    number: "R0005", status: "paid", date: "2025-03-25", dueDate: "2025-04-19",
    clientNum: "A0006", total: 680, poNumber: "Ferrari 296 GTS",
    positions: [{ desc: "Forfait polish — Correction vernis véhicule neuf", qty: 1, price: 680, total: 680 }]
  },
  {
    number: "R0006", status: "paid", date: "2025-03-25", dueDate: "2025-04-16",
    clientNum: "A0006", total: 680, poNumber: "Purosangue gris clair",
    positions: [{ desc: "Forfait polish — Correction vernis véhicule neuf", qty: 1, price: 680, total: 680 }]
  },
  {
    number: "R0007", status: "paid", date: "2025-03-25", dueDate: "2025-04-19",
    clientNum: "A0006", total: 1600, poNumber: "718 Cayman RS",
    positions: [{ desc: "Forfait polish et céramique", qty: 1, price: 1600, total: 1600 }]
  },
  {
    number: "R0008", status: "paid", date: "2025-03-28", dueDate: "2025-04-27",
    clientNum: "A0006", total: 680, poNumber: "Purosangue Nero ZFF06VTB000319564",
    positions: [{ desc: "Forfait polish — Correction vernis véhicule neuf", qty: 1, price: 680, total: 680 }]
  },
  {
    number: "R0009", status: "paid", date: "2025-04-02", dueDate: "2025-04-27",
    clientNum: "A0006", total: 680, poNumber: "Purosangue Nero ZFF06VTB000321351",
    positions: [{ desc: "Forfait polish — Correction vernis véhicule neuf", qty: 1, price: 680, total: 680 }]
  },
  {
    number: "R0011", status: "paid", date: "2025-04-22", dueDate: "2025-05-22",
    clientNum: "A0001", total: 1340.20, poNumber: "",
    positions: [{ desc: "Produits Alchimy7 (commande complète)", qty: 1, price: 1340.20, total: 1340.20 }]
  },
  {
    number: "R0016", status: "paid", date: "2025-05-29", dueDate: "2025-06-25",
    clientNum: "A0007", total: 630, poNumber: "Porsche 718 Cayman",
    positions: [
      { desc: "Prélavage au canon à mousse", qty: 0.25, price: 100, total: 25 },
      { desc: "Lavage manuel", qty: 0.5, price: 100, total: 50 },
      { desc: "Décontamination chimique #1", qty: 0.25, price: 100, total: 25 },
      { desc: "Décontamination chimique #2", qty: 0.25, price: 100, total: 25 },
      { desc: "Décontamination mécanique", qty: 0.25, price: 100, total: 25 },
      { desc: "Masquage joints et plastiques", qty: 0.5, price: 100, total: 50 },
      { desc: "Polissage carrosserie 1 étape", qty: 7, price: 100, total: 700 }
    ]
  },
  {
    number: "R0017", status: "paid", date: "2025-05-29", dueDate: "2025-06-28",
    clientNum: "A0001", total: 1250, poNumber: "Mois de Mai 2025",
    positions: [{ desc: "Travail en sous-traitance", qty: 25, price: 50, total: 1250 }]
  },
  {
    number: "R0018", status: "paid", date: "2025-06-10", dueDate: "2025-06-20",
    clientNum: "A0010", total: 1856.90, poNumber: "Entretien véhicule entreprise",
    positions: [
      { desc: "Prélavage au canon à mousse", qty: 0.25, price: 100, total: 25 },
      { desc: "Lavage roues/pneus/arches", qty: 0.5, price: 100, total: 50 },
      { desc: "Lavage manuel", qty: 0.33, price: 100, total: 33 },
      { desc: "Décontamination chimique #1", qty: 0.33, price: 100, total: 33 },
      { desc: "Décontamination chimique #2", qty: 0.33, price: 100, total: 33 },
      { desc: "Décontamination mécanique", qty: 0.33, price: 100, total: 33 },
      { desc: "Rinçage final et séchage", qty: 0.5, price: 100, total: 50 },
      { desc: "Masquage joints et plastiques", qty: 1, price: 100, total: 100 },
      { desc: "Polissage et correction vernis (véhicule neuf)", qty: 6, price: 100, total: 600 },
      { desc: "Dégraissage avant protection", qty: 1, price: 100, total: 100 },
      { desc: "CarPro Professionnel 50ml", qty: 1, price: 139.90, total: 139.90 },
      { desc: "Traitement céramique carrosserie/phares (2 couches)", qty: 6, price: 110, total: 660 }
    ]
  },
  {
    number: "R0021", status: "paid", date: "2025-06-20", dueDate: "2025-06-30",
    clientNum: "A0007", total: 700, poNumber: "Audi RS6 C7",
    positions: [
      { desc: "Prélavage au canon à mousse", qty: 0.25, price: 100, total: 25 },
      { desc: "Lavage manuel", qty: 0.5, price: 100, total: 50 },
      { desc: "Décontamination chimique #1", qty: 0.25, price: 100, total: 25 },
      { desc: "Décontamination chimique #2", qty: 0.25, price: 100, total: 25 },
      { desc: "Décontamination mécanique", qty: 0.25, price: 100, total: 25 },
      { desc: "Masquage joints et plastiques", qty: 0.5, price: 100, total: 50 },
      { desc: "Polissage carrosserie 1 étape", qty: 8, price: 100, total: 800 }
    ]
  },
  {
    number: "R0022", status: "paid", date: "2025-06-28", dueDate: "2025-07-28",
    clientNum: "A0001", total: 800, poNumber: "",
    positions: [{ desc: "Travail en sous-traitance", qty: 16, price: 50, total: 800 }]
  },
  {
    number: "R0024", status: "paid", date: "2025-07-08", dueDate: "2025-08-07",
    clientNum: "A0011", total: 300, poNumber: "Camionette Kozelsky",
    positions: [
      { desc: "Nettoyage passages de portes", qty: 0.5, price: 100, total: 50 },
      { desc: "Aspiration poussée habitacle", qty: 1, price: 100, total: 100 },
      { desc: "Dépoussiérage/nettoyage tableau de bord complet", qty: 1, price: 100, total: 100 },
      { desc: "Nettoyage des vitres", qty: 0.5, price: 100, total: 50 }
    ]
  },
  {
    number: "R0025", status: "paid", date: "2025-08-04", dueDate: "2025-09-03",
    clientNum: "A0007", total: 700, poNumber: "",
    positions: [
      { desc: "Décontamination mécanique (clay bar)", qty: 0.5, price: 100, total: 50 },
      { desc: "Polissage carrosserie 1 étape", qty: 9.5, price: 100, total: 950 }
    ]
  },
  {
    number: "R0026", status: "paid", date: "2025-08-17", dueDate: "2025-09-16",
    clientNum: "A0009", total: 210, poNumber: "Porsche Cayman GT4 Noir uni",
    positions: [
      { desc: "Nettoyage passages de portes", qty: 0.2, price: 100, total: 20 },
      { desc: "Aspiration poussée habitacle", qty: 0.5, price: 100, total: 50 },
      { desc: "Dépoussiérage/nettoyage tableau de bord complet", qty: 0.55, price: 100, total: 55 },
      { desc: "Nettoyage des vitres", qty: 0.25, price: 100, total: 25 },
      { desc: "Shampooing sièges en tissus", qty: 1.5, price: 100, total: 150 }
    ]
  },
  {
    number: "R0027", status: "paid", date: "2025-08-17", dueDate: "2025-09-16",
    clientNum: "A0009", total: 240, poNumber: "",
    positions: [
      { desc: "Lavage approfondi jantes/pneus/passages roues", qty: 0.4, price: 100, total: 40 },
      { desc: "Prélavage au canon à mousse", qty: 0.15, price: 100, total: 15 },
      { desc: "Rinçage", qty: 0.1, price: 100, total: 10 },
      { desc: "Lavage manuel", qty: 0.5, price: 100, total: 50 },
      { desc: "Rinçage", qty: 0.1, price: 100, total: 10 },
      { desc: "Séchage manuel", qty: 0.1, price: 100, total: 10 },
      { desc: "Nettoyage passages de portes", qty: 0.25, price: 100, total: 25 },
      { desc: "Séchage passages de portes", qty: 0.2, price: 100, total: 20 },
      { desc: "Aspiration poussée habitacle", qty: 0.5, price: 100, total: 50 },
      { desc: "Dépoussiérage/nettoyage tableau de bord complet", qty: 0.5, price: 100, total: 50 },
      { desc: "Nettoyage des vitres", qty: 0.2, price: 100, total: 20 }
    ]
  },
  {
    number: "R0028", status: "paid", date: "2025-08-17", dueDate: "2025-09-16",
    clientNum: "A0009", total: 240, poNumber: "Audi RSQ8",
    positions: [
      { desc: "Lavage approfondi jantes/pneus/passages roues", qty: 0.35, price: 100, total: 35 },
      { desc: "Prélavage au canon à mousse", qty: 0.1, price: 100, total: 10 },
      { desc: "Lavage manuel", qty: 0.5, price: 100, total: 50 },
      { desc: "Séchage manuel", qty: 0.2, price: 100, total: 20 },
      { desc: "Nettoyage passages de portes", qty: 0.3, price: 100, total: 30 },
      { desc: "Séchage passages de portes", qty: 0.3, price: 100, total: 30 },
      { desc: "Aspiration poussée habitacle", qty: 0.5, price: 100, total: 50 },
      { desc: "Dépoussiérage/nettoyage tableau de bord complet", qty: 0.45, price: 100, total: 45 },
      { desc: "Nettoyage des vitres", qty: 0.2, price: 100, total: 20 },
      { desc: "Finition satinée pneus", qty: 0.1, price: 100, total: 10 }
    ]
  },
  {
    number: "R0029", status: "paid", date: "2025-09-23", dueDate: "2025-10-23",
    clientNum: "A0009", total: 150, poNumber: "",
    positions: [{ desc: "Prestations detailing (facture importée)", qty: 1, price: 150, total: 150 }]
  },
  {
    number: "R0030", status: "paid", date: "2025-10-02", dueDate: "2025-10-27",
    clientNum: "A0013", total: 495, poNumber: "Macan Turbo",
    positions: [
      { desc: "Nettoyage passages de portes", qty: 0.25, price: 100, total: 25 },
      { desc: "Aspiration poussée habitacle", qty: 0.65, price: 100, total: 65 },
      { desc: "Dépoussiérage/nettoyage tableau de bord complet", qty: 0.55, price: 100, total: 55 },
      { desc: "Nettoyage des vitres", qty: 0.25, price: 100, total: 25 },
      { desc: "Soin des cuirs", qty: 3, price: 100, total: 300 },
      { desc: "Shampooing plancher de coffre", qty: 0.25, price: 100, total: 25 }
    ]
  },
  {
    number: "R0031", status: "paid", date: "2025-10-26", dueDate: "2025-11-25",
    clientNum: "A0009", total: 200, poNumber: "",
    positions: [
      { desc: "Prélavage au canon à mousse", qty: 0.5, price: 100, total: 50 },
      { desc: "Lavage roues/pneus/arches", qty: 0.5, price: 100, total: 50 },
      { desc: "Aspiration poussée habitacle", qty: 0.5, price: 100, total: 50 },
      { desc: "Dépoussiérage/nettoyage tableau de bord complet", qty: 0.5, price: 100, total: 50 }
    ]
  },
  {
    number: "R0032", status: "paid", date: "2025-10-26", dueDate: "2025-11-25",
    clientNum: "A0009", total: 150, poNumber: "Skoda Kodiak blanc",
    positions: [
      { desc: "Prélavage au canon à mousse", qty: 0.5, price: 100, total: 50 },
      { desc: "Lavage roues/pneus/arches", qty: 0.5, price: 100, total: 50 },
      { desc: "Dépoussiérage/nettoyage tableau de bord complet", qty: 0.5, price: 100, total: 50 }
    ]
  },
  {
    number: "R0033", status: "paid", date: "2025-11-08", dueDate: "2025-12-08",
    clientNum: "A0009", total: 80, poNumber: "Bus entreprise",
    positions: [{ desc: "Polissage des phares et des feux", qty: 1, price: 100, total: 100 }]
  },
  {
    number: "R0034", status: "paid", date: "2025-11-08", dueDate: "2025-12-08",
    clientNum: "A0009", total: 250, poNumber: "Dacia Duster",
    positions: [
      { desc: "Lavage approfondi jantes/pneus/passages roues", qty: 0.5, price: 100, total: 50 },
      { desc: "Prélavage au canon à mousse", qty: 0.15, price: 100, total: 15 },
      { desc: "Lavage manuel", qty: 0.6, price: 100, total: 60 },
      { desc: "Séchage manuel", qty: 0.15, price: 100, total: 15 },
      { desc: "Nettoyage passages de portes", qty: 0.25, price: 100, total: 25 },
      { desc: "Séchage passages de portes", qty: 0.3, price: 100, total: 30 },
      { desc: "Aspiration poussée habitacle", qty: 0.65, price: 100, total: 65 },
      { desc: "Dépoussiérage/nettoyage tableau de bord complet", qty: 0.55, price: 100, total: 55 },
      { desc: "Nettoyage des vitres", qty: 0.25, price: 100, total: 25 },
      { desc: "Finition satinée pneus", qty: 0.1, price: 100, total: 10 },
      { desc: "Shampooing sièges en tissus", qty: 1.5, price: 100, total: 150 }
    ]
  },
  {
    number: "R0038", status: "paid", date: "2025-12-01", dueDate: "2025-12-31",
    clientNum: "A0009", total: 450, poNumber: "Golf Break",
    positions: [
      { desc: "Soin des cuirs", qty: 3.125, price: 100, total: 312.50 },
      { desc: "Céramique vitres extérieures (forfait)", qty: 1, price: 250, total: 250 }
    ]
  },
  {
    number: "R0039", status: "paid", date: "2025-12-01", dueDate: "2025-12-31",
    clientNum: "A0009", total: 200, poNumber: "Porsche 911 Blanche",
    positions: [
      { desc: "Lavage approfondi jantes/pneus/passages roues", qty: 0.5, price: 100, total: 50 },
      { desc: "Prélavage au canon à mousse", qty: 0.1, price: 100, total: 10 },
      { desc: "Lavage manuel", qty: 0.45, price: 100, total: 45 },
      { desc: "Séchage manuel", qty: 0.1, price: 100, total: 10 },
      { desc: "Nettoyage passages de portes", qty: 0.25, price: 100, total: 25 },
      { desc: "Séchage passages de portes", qty: 0.2, price: 100, total: 20 },
      { desc: "Aspiration poussée habitacle", qty: 0.5, price: 100, total: 50 },
      { desc: "Dépoussiérage/nettoyage tableau de bord complet", qty: 0.4, price: 100, total: 40 }
    ]
  },
  {
    number: "R0040", status: "paid", date: "2025-12-21", dueDate: "2026-01-20",
    clientNum: "A0010", total: 2188.90, poNumber: "Véhicule entreprise",
    positions: [{ desc: "Entretien véhicule (divers prestations)", qty: 1, price: 2188.90, total: 2188.90 }]
  },
  {
    number: "R0041", status: "paid", date: "2025-12-29", dueDate: "2026-02-09",
    clientNum: "A001", total: 150, poNumber: "",
    positions: [{ desc: "Bon cadeau N°1", qty: 1, price: 150, total: 150 }]
  },
  {
    number: "R0042", status: "paid", date: "2026-01-15", dueDate: "2026-02-14",
    clientNum: "A0007", total: 50, poNumber: "",
    positions: [{ desc: "Céramique vitres Soft 99 12 mois", qty: 2, price: 25, total: 50 }]
  },
  {
    number: "R0043", status: "paid", date: "2026-01-18", dueDate: "2026-02-17",
    clientNum: "A0010", total: 1609, poNumber: "Volkswagen Amarok noir",
    positions: [{ desc: "Entretien véhicule", qty: 1, price: 1609, total: 1609 }]
  },
  {
    number: "R0044", status: "paid", date: "2026-01-23", dueDate: "2026-02-14",
    clientNum: "A0014", total: 574, poNumber: "Ford Transit, bus londonien, camionette frigorifique",
    positions: [
      { desc: "Polissage des phares et des feux", qty: 1, price: 110, total: 110 },
      { desc: "Céramique plastiques et joints extérieurs", qty: 2, price: 100, total: 200 },
      { desc: "Lavage manuel", qty: 2, price: 100, total: 200 },
      { desc: "Séchage manuel", qty: 1.5, price: 100, total: 150 },
      { desc: "Finition satinée pneus", qty: 0.5, price: 100, total: 50 },
      { desc: "Polissage capot", qty: 1, price: 110, total: 110 }
    ]
  },
  {
    number: "R0047", status: "sent", date: "2026-02-27", dueDate: "2026-03-26",
    clientNum: "A0015", total: 175, poNumber: "Porsche GT3 blanche",
    positions: [
      { desc: "Lavage partie visible des jantes", qty: 0.15, price: 100, total: 15 },
      { desc: "Prélavage au canon à mousse", qty: 0.2, price: 100, total: 20 },
      { desc: "Lavage manuel", qty: 0.25, price: 100, total: 25 },
      { desc: "Rinçage final et séchage", qty: 0.15, price: 100, total: 15 },
      { desc: "Séchage passages de portes", qty: 0.15, price: 100, total: 15 },
      { desc: "Aspiration/dépoussiérage intérieur", qty: 0.65, price: 100, total: 65 },
      { desc: "Nettoyage des vitres", qty: 0.1, price: 100, total: 10 },
      { desc: "Finition satinée pneus", qty: 0.1, price: 100, total: 10 }
    ]
  }
];

// Active quotes (non-cancelled, non-converted, non-archived)
const QUOTES = [
  { clientNum: "A0015", status: "draft", amount: 1605, poNumber: "Audi RS4 noir",
    positions: [{ desc: "Prestations detailing Audi RS4 noir", qty: 1, price: 1605, total: 1605 }] },
  { clientNum: "A0009", status: "sent", amount: 2585, poNumber: "BMW 340 (formule complète)",
    positions: [{ desc: "Formule complète BMW 340", qty: 1, price: 2585, total: 2585 }] },
  { clientNum: "A0009", status: "sent", amount: 1605, poNumber: "BMW 340 (formule standard)",
    positions: [{ desc: "Formule standard BMW 340", qty: 1, price: 1605, total: 1605 }] },
  { clientNum: "A0009", status: "sent", amount: 360, poNumber: "Volkswagen Caddy",
    positions: [{ desc: "Prestations detailing VW Caddy", qty: 1, price: 360, total: 360 }] },
  { clientNum: "A0009", status: "sent", amount: 230, poNumber: "Skoda RS",
    positions: [{ desc: "Prestations detailing Skoda RS", qty: 1, price: 230, total: 230 }] },
  { clientNum: "A0009", status: "sent", amount: 450, poNumber: "Mercedes",
    positions: [{ desc: "Prestations detailing Mercedes", qty: 1, price: 450, total: 450 }] },
  { clientNum: "A0009", status: "draft", amount: 415, poNumber: "Nissan GTR",
    positions: [{ desc: "Prestations detailing Nissan GTR", qty: 1, price: 415, total: 415 }] },
  { clientNum: "A0007", status: "draft", amount: 1872.45, poNumber: "BMW X3M bleu",
    positions: [{ desc: "Prestations detailing BMW X3M bleu", qty: 1, price: 1872.45, total: 1872.45 }] },
  { clientNum: "A001", status: "draft", amount: 1859.10, poNumber: "Audi RS6 ABT",
    positions: [{ desc: "Prestations detailing Audi RS6 ABT", qty: 1, price: 1859.10, total: 1859.10 }] },
  { clientNum: "A0009", status: "draft", amount: 2255.10, poNumber: "Golf Break",
    positions: [{ desc: "Prestations detailing Golf Break", qty: 1, price: 2255.10, total: 2255.10 }] }
];

// ============================================================
// MIGRATION
// ============================================================

async function migrate() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/swigs-workflow';
  console.log(`Connecting to ${MONGODB_URI}...`);
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB\n');

  // 1. Find user
  let user = await User.findOne({ email: 'info@adlrcosmeticauto.ch' });
  if (!user) {
    console.error('❌ User info@adlrcosmeticauto.ch not found! Create account first.');
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`✓ Found user: ${user.name} (${user._id})`);
  const userId = user._id;

  // 2. Check/create default status
  let defaultStatus = await Status.findOne({ userId, isDefault: true });
  if (!defaultStatus) {
    const existingStatuses = await Status.find({ userId });
    if (existingStatuses.length > 0) {
      defaultStatus = existingStatuses[0];
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
  }
  console.log(`✓ Using status: "${defaultStatus.name}"`);

  // Find "Terminé" status for completed projects
  let completedStatus = await Status.findOne({ userId, name: 'Terminé' });
  if (!completedStatus) completedStatus = defaultStatus;

  // 3. Create services
  const existingServices = await Service.find({ userId });
  if (existingServices.length > 0) {
    console.log(`⚠ ${existingServices.length} services already exist, skipping service creation`);
  } else {
    const serviceDocs = SERVICES.map((s, i) => ({
      userId,
      name: `[${s.key}] ${s.name}`,
      description: s.desc || '',
      category: s.cat || 'other',
      priceType: s.type,
      unitPrice: s.price,
      isActive: true,
      order: i
    }));
    await Service.insertMany(serviceDocs);
    console.log(`✓ Created ${serviceDocs.length} services`);
  }

  // 4. Create projects (one per client)
  const projectMap = {}; // clientNum → projectId
  const existingProjects = await Project.find({ userId });

  // Match existing projects by AbaNinja client number in notes
  for (const p of existingProjects) {
    const match = p.notes?.match(/AbaNinja: (A\d+)/);
    if (match) {
      projectMap[match[1]] = p._id;
    }
  }

  for (const client of CLIENTS) {
    if (projectMap[client.num]) continue;

    const address = [client.street, `${client.zip} ${client.city}`].filter(s => s && s !== '-').join(', ');
    const project = await Project.create({
      userId,
      name: client.type === 'company' ? client.name : client.name,
      client: {
        name: client.name,
        company: client.type === 'company' ? client.name : undefined,
        phone: client.phone || undefined,
        address: address || undefined,
        street: client.street && client.street !== '-' ? client.street : undefined,
        zip: client.zip || undefined,
        city: client.city || undefined,
        country: 'CH'
      },
      status: client.archived ? completedStatus._id : defaultStatus._id,
      tags: ['import-abaninja'],
      notes: `AbaNinja: ${client.num}${client.contact ? `\nContact: ${client.contact}` : ''}`
    });
    projectMap[client.num] = project._id;
  }
  console.log(`✓ Created/mapped ${Object.keys(projectMap).length} projects`);

  // 5. Create invoices
  const existingInvoiceNumbers = new Set(
    (await Invoice.find({ project: { $in: Object.values(projectMap) } }, 'number')).map(i => i.number)
  );

  let invoiceCount = 0;
  for (const inv of INVOICES) {
    if (existingInvoiceNumbers.has(`ADLR-${inv.number}`)) {
      console.log(`  → Skipping existing invoice ADLR-${inv.number}`);
      continue;
    }
    const projectId = projectMap[inv.clientNum];
    if (!projectId) {
      console.log(`  ⚠ No project for client ${inv.clientNum}, skipping invoice ${inv.number}`);
      continue;
    }

    const customLines = inv.positions.map(p => ({
      description: p.desc + (inv.poNumber ? ` — ${inv.poNumber}` : ''),
      quantity: p.qty,
      unitPrice: p.price,
      total: p.total
    }));

    const subtotal = inv.total; // AbaNinja invoices are VAT-free (non-assujetti)
    const vatRate = 0; // ADLR is not VAT-registered based on invoice data
    const vatAmount = 0;

    const invoice = new Invoice({
      project: projectId,
      number: `ADLR-${inv.number}`,
      invoiceType: 'custom',
      customLines,
      subtotal,
      vatRate,
      vatAmount,
      total: inv.total,
      status: inv.status,
      issueDate: new Date(inv.date),
      dueDate: new Date(inv.dueDate),
      paidAt: inv.status === 'paid' ? new Date(inv.dueDate) : undefined,
      paidAmount: inv.status === 'paid' ? inv.total : 0,
      notes: inv.poNumber ? `Véhicule: ${inv.poNumber}` : 'Import AbaNinja',
      skipReminders: true
    });
    await invoice.save();
    invoiceCount++;
  }
  console.log(`✓ Created ${invoiceCount} invoices`);

  // 6. Create quotes
  let quoteCount = 0;
  for (let i = 0; i < QUOTES.length; i++) {
    const q = QUOTES[i];
    const projectId = projectMap[q.clientNum];
    if (!projectId) {
      console.log(`  ⚠ No project for client ${q.clientNum}, skipping quote`);
      continue;
    }

    const lines = q.positions.map(p => ({
      description: p.desc,
      quantity: p.qty,
      unitPrice: p.price,
      total: p.total
    }));

    const subtotal = q.amount;
    const vatRate = 0;
    const vatAmount = 0;
    const validUntil = new Date();
    validUntil.setMonth(validUntil.getMonth() + 1); // Valid 1 month

    const quoteNumber = `ADLR-D${String(i + 1).padStart(4, '0')}`;
    const quote = new Quote({
      project: projectId,
      number: quoteNumber,
      lines,
      subtotal,
      vatRate,
      vatAmount,
      total: q.amount,
      status: q.status === 'approved' ? 'signed' : q.status,
      issueDate: new Date(),
      validUntil,
      notes: q.poNumber ? `Véhicule: ${q.poNumber}` : 'Import AbaNinja'
    });
    await quote.save();
    quoteCount++;
  }
  console.log(`✓ Created ${quoteCount} quotes`);

  // 7. Summary
  console.log('\n====================================');
  console.log('Migration ADLR Cosmetic Auto complete!');
  console.log('====================================');
  console.log(`User: ${user.email} (${userId})`);
  console.log(`Projects: ${Object.keys(projectMap).length}`);
  console.log(`Invoices: ${invoiceCount}`);
  console.log(`Quotes: ${quoteCount}`);
  console.log(`Services: ${SERVICES.length}`);

  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
