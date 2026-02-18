# SWIGS Workflow - Data Analysis Report
**Date:** 2026-02-13
**Database:** swigs-workflow (Production - 192.168.110.59)
**Total Collections:** 17

---

## Executive Summary

### Key Findings
1. **Events feature is UNUSED** - 0 events in database despite being a core feature
2. **Invoices rely 100% on quotes or manual entry** - No event-based billing
3. **Strong quote workflow adoption** - 5 quotes with partial invoicing feature actively used
4. **Automations created but inactive** - 5 automations exist, 0 active
5. **Email templates feature UNUSED** - 0 custom templates
6. **Strong revenue** - CHF 16,729.58 total across 15 invoices (14 paid, 1 sent)

### Usage Patterns
- **Active features:** Projects, Invoices, Quotes, PlannedBlocks, Statuses, Services, History
- **Unused features:** Events (time tracking), Email Templates, Automations (active)
- **Business model:** Quote-based billing (not time-based)

---

## 1. Volumetrie (Document Count)

| Collection | Count | Status |
|------------|-------|--------|
| **automations** | 5 | Created but inactive |
| **automationruns** | 2 | Minimal usage |
| **clients** | 10 | Active |
| **cmseventcaches** | 0 | Unused |
| **emailtemplates** | 0 | **UNUSED** |
| **events** | 0 | **UNUSED - Critical** |
| **histories** | 92 | Active audit trail |
| **invoices** | 15 | **Active** |
| **plannedblocks** | 11 | Active |
| **projects** | 9 | **Active** |
| **quotes** | 5 | **Active** |
| **services** | 6 | Active |
| **sessions** | 50 | Active (12 valid) |
| **settings** | 7 | Active |
| **status** | 7 | Duplicate collection |
| **statuses** | 7 | **Active** |
| **users** | 6 | Active |

**Note:** Collections `status` and `statuses` both exist with same data - potential cleanup needed.

---

## 2. Analysis by Collection

### Projects (9 documents)
**Status:** ACTIVE - Core feature

**Distribution by status:**
- 5 different statuses used (ObjectId references)
- All 9 projects are active (archivedAt: null)
- 100% have client information filled

**Field usage:**
- **Description:** 7/9 (78%) - Good adoption
- **Tags:** 0/9 (0%) - **UNUSED field**
- **Notes:** 0/9 (0%) - **UNUSED field**

**Schema validation:** ✅ Matches Mongoose model
- userId present on all documents (multi-tenant working)
- Position schema matches (x, y, order)
- Client embedded schema working correctly

**Sample structure:**
```javascript
{
  name: 'Site Web kozelsky.ch',
  description: 'Création du site web kozelsky.ch',
  client: {
    name: 'Kozelsky Sàrl',
    company: 'Kozelsky Sàrl'
  },
  status: ObjectId('697cdb6841c13da88f5bbfc7'),
  tags: [],  // Never used
  position: { x: null, y: null, order: 5 },
  userId: ObjectId('698213f6aa3f218aae0adf3b')
}
```

**Recommendations:**
- Consider removing `tags` and `notes` fields (0% usage)
- Position feature used for ordering (order field), x/y coordinates unused

---

### Events (0 documents)
**Status:** UNUSED - **CRITICAL FINDING**

**Impact:**
- Time tracking feature completely unused
- No hours/action/expense logging
- Event-based invoicing workflow non-functional
- Invoices cannot be created from billable events

**Schema:** Full event tracking system exists but unused:
- Types: hours, action, expense
- Fields: hours, hourlyRate, amount, billed, invoice
- Indexes optimized for billing queries

**Hypothesis:**
- User prefers quote-based workflow over time tracking
- Business model: Fixed-price quotes → Invoices (not hourly billing)
- Event UI/UX may be too complex or not discoverable

**Recommendations:**
1. **Short-term:** Add analytics to understand why feature is unused
2. **Medium-term:** Consider simplifying event entry UI
3. **Long-term:** If usage remains 0%, consider deprecating feature to reduce complexity

---

### Invoices (15 documents)
**Status:** ACTIVE - Core revenue feature

**By status:**
- **paid:** 14 invoices (CHF 15,108.08)
- **sent:** 1 invoice (CHF 1,621.50)
- **Total revenue:** CHF 16,729.58

**Invoice composition:**
- **With events:** 0/15 (0%) - Events feature unused
- **With quotes:** 3/15 (20%) - Quote-based invoicing
- **With customLines:** 0/15 (0%) - Custom lines unused
- **Empty invoices:** 12/15 (80%) - **Red flag**

**Schema validation:** ✅ Mostly matches model
- Unexpected: Old invoices use `number: 'R0001'` format instead of `FAC-YEAR-###`
- invoiceType field missing (added later, default 'standard' in schema)

**Sample invoice:**
```javascript
{
  number: 'R0001',  // Old format
  project: ObjectId('698099aa18638a4a335987ab'),
  events: [],       // Always empty
  quotes: [],       // Mostly empty
  subtotal: 1219.9,
  vatRate: 0,
  vatAmount: 0,
  total: 1219.9,
  status: 'paid'
}
```

**Critical issue:** 80% of invoices have no line items (events/quotes/customLines empty)
- How are these invoices created?
- Likely manual total entry without itemization
- Violates invoice snapshot principle

**Recommendations:**
1. Investigate how empty invoices are created
2. Enforce at least one line item (quotes, events, or customLines)
3. Migrate old invoice numbers to new format
4. Add `invoiceType` field to existing documents

---

### Quotes (5 documents)
**Status:** ACTIVE - Well-used feature

**By status:**
- **partial:** 2 quotes (40%) - Partial invoicing feature used!
- **draft:** 1 quote (20%)
- **sent:** 1 quote (20%)
- **invoiced:** 1 quote (20%)
- **signed:** 0 quotes (0%)

**Conversion funnel:**
- Total quotes: 5
- Sent: 2+ (40%+)
- Signed: 0 (0%)
- Invoiced: 3 (60% - including partials)

**Partial invoicing feature:** ✅ Actively used
```javascript
{
  status: 'partial',
  total: 3243,
  invoicedAmount: 900,
  invoices: [
    {
      invoice: ObjectId('69859af1f5e850abde7ef5b7'),
      amount: 900,
      invoicedAt: ISODate('2026-02-06T07:40:33.921Z')
    }
  ]
}
```

**Schema validation:** ✅ Perfect match
- New partial invoicing feature working correctly
- Legacy `invoice` field present alongside new `invoices` array
- All required fields present

**Recommendations:**
- Feature well-adopted, no changes needed
- Monitor conversion rate (currently 60% quoted → invoiced)

---

### PlannedBlocks (11 documents)
**Status:** ACTIVE - Calendar/planning feature

**Sample:**
```javascript
{
  project: ObjectId('697cd4f03e55eb3feed7e269'),
  start: ISODate('2026-01-26T05:30:00.000Z'),
  end: ISODate('2026-01-26T09:00:00.000Z'),
  userId: ObjectId('698213f6aa3f218aae0adf3b')
}
```

**Analysis:**
- 11 blocks across projects
- User is planning work time blocks
- No orphaned blocks (all have valid project refs)

---

### Automations (5 documents)
**Status:** CREATED BUT INACTIVE

**Stats:**
- Total automations: 5
- Active: 0 (0%)
- Inactive: 5 (100%)

**Sample automation:**
```javascript
{
  name: 'tets',
  isActive: false,
  triggerType: 'order.created',
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      label: 'Nouvelle commande',
      connections: []  // No actions connected
    }
  ],
  stats: {
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0
  }
}
```

**AutomationRuns (2 documents):**
- Both completed successfully
- Likely test runs during development

**Analysis:**
- User explored automation feature
- Created automations but never activated them
- Trigger: `order.created` (CMS integration)
- No connected action nodes

**Hypothesis:**
- Feature too complex to configure
- No clear use case
- Prefer manual workflows

**Recommendations:**
1. Provide automation templates (common workflows)
2. Simplify node connection UI
3. Add use case examples
4. Consider removing if usage stays 0%

---

### Statuses (7 documents)
**Status:** ACTIVE - Workflow management

**All statuses (ordered):**
1. Nouveau (gray)
2. Devis (orange)
3. En cours (blue)
4. Facturé (purple)
5. Payé (green)
6. Maintenance (pink)
7. App Swigs (cyan)

**Analysis:**
- Clear workflow pipeline
- Status colors assigned
- Custom to user's business process
- Well-organized (order field used)

**Note:** Duplicate collection `status` exists with same data (cleanup needed)

---

### Services (6 documents)
**Status:** ACTIVE - Service catalog

**All services:**
1. Abonnement SWIGS PRO
2. Hébergement suisse
3. Site vitrine - pack de base
4. Modification Sites
5. Site avec gestion de contenu (CMS)
6. Projet web sur mesure / application

**Analysis:**
- Service catalog defined
- Mix of recurring (hosting, subscription) and project-based services
- No pricing visible in sample (rate field exists in schema)

---

### Clients (10 documents)
**Status:** ACTIVE - Standalone client records

**Sample:**
```javascript
{
  name: 'GTS Global Trade Services Sarl',
  company: 'GTS Global Trade Services Sarl',
  email: '',  // Often empty
  phone: '',  // Often empty
  address: 'Route de la Drague 18, 1950 Sion, Suisse',
  clientNumber: 'A0001'
}
```

**Analysis:**
- 10 standalone clients + 9 embedded in projects
- Client numbering system: A0001, A0002...
- Email/phone often empty (not required)
- Addresses filled when available

---

### History (92 documents)
**Status:** ACTIVE - Audit trail working

**Top 10 actions:**
1. **status_change:** 47 (51%) - Main activity
2. **project_created:** 9
3. **quote_created:** 7
4. **quote_sent:** 5
5. **invoice_paid:** 5
6. **invoice_created:** 5
7. **quote_signed:** 4
8. **invoice_sent:** 3
9. **event_deleted:** 2 (events were tested then deleted)
10. **event_added:** 2

**Analysis:**
- Strong audit trail (92 entries for 9 projects)
- Status changes dominate (workflow management)
- Event actions rare (only 4 total, all deleted)
- Full invoice/quote lifecycle tracked

---

### Users & Sessions
**Users:** 6 total
**Sessions:** 50 total, 12 active (not revoked)

**Analysis:**
- Multi-user system working
- Session management active
- Reasonable active session count

---

### Email Templates (0 documents)
**Status:** UNUSED

**Analysis:**
- Feature completely unused
- Email templates exist in Settings collection instead:
  - quoteSubject, quoteBody
  - invoiceSubject, invoiceBody
- Likely duplicate functionality

**Recommendations:**
- EmailTemplate collection may be obsolete
- Settings-based templates preferred
- Consider deprecating collection

---

### Settings (7 documents)
**Status:** ACTIVE - One per user

**Sample:**
```javascript
{
  company: {
    name: 'SWIGS',
    address: '',  // Often empty
    siret: '',
    vatNumber: '',
    email: '',
    phone: '',
    logo: null
  },
  invoicing: {
    invoicePrefix: 'FAC-',
    quotePrefix: 'DEV-',
    defaultVatRate: 8.1,
    defaultPaymentTerms: 30,
    defaultHourlyRate: 150
  },
  personalization: {
    cardStyle: 'left-border',
    cardSize: 'medium'
  },
  emailTemplates: {
    quoteSubject: 'Mon devis {number} - {projectName}',
    quoteBody: '...',
    invoiceSubject: 'Facture {number} - {projectName}',
    invoiceBody: '...'
  }
}
```

**Analysis:**
- Multi-tenant settings working (userId present)
- Company info often incomplete
- Email templates stored here (not EmailTemplate collection)
- Personalization preferences used
- VAT rate: 8.1% (Swiss standard)

---

## 3. Orphaned Data Analysis

**Results:** ✅ No orphaned data found

- Events without project: 0
- Invoices without project: 0
- Quotes without project: 0
- PlannedBlocks without project: 0

**Data integrity:** Excellent - All relationships valid

---

## 4. Schema vs Reality

### Matches (✅)
- **Projects:** Perfect match with Mongoose schema
- **Quotes:** Perfect match, new partial invoicing feature working
- **Clients:** Schema matches
- **PlannedBlocks:** Schema matches
- **Statuses:** Schema matches

### Discrepancies (⚠️)

1. **Invoice.number format**
   - Schema expects: `FAC-YEAR-###` (via generateNumber())
   - Reality: Old format `R0001`, `R0002`...
   - **Action:** Migration needed

2. **Invoice.invoiceType missing**
   - Schema defines: `enum: ['standard', 'custom'], default: 'standard'`
   - Reality: Field not present in documents
   - **Action:** Add field to existing documents or remove from schema

3. **Duplicate collections**
   - `status` and `statuses` both exist with identical data
   - **Action:** Drop one collection

4. **Events schema unused**
   - Full schema defined with indexes
   - 0 documents in collection
   - **Action:** Consider deprecating or improving UX

### Missing Features in Data

1. **Project.tags** - Field exists, 0% usage
2. **Project.notes** - Field exists, 0% usage
3. **Invoice.notes** - Field exists, rarely used
4. **Invoice.pdfPath** - Null in sample (PDF generation unused?)
5. **Quote.pdfPath** - Null in sample

---

## 5. Usage Patterns

### Primary Workflow
**Quote → Invoice → Payment**

1. Create project with client info
2. Create quote with line items
3. Send quote to client
4. Client signs/accepts quote
5. Create invoice from quote (full or partial)
6. Mark invoice as paid

**Evidence:**
- 5 quotes, 3 invoiced (60% conversion)
- 2 partial quotes (progressive invoicing)
- 14/15 invoices paid (93% collection rate)
- 0 events (not using time tracking)

### Secondary Workflows

1. **Status management:**
   - 47 status changes logged
   - Clear workflow: Nouveau → Devis → En cours → Facturé → Payé

2. **Project planning:**
   - 11 planned blocks
   - Calendar-based work allocation

3. **Client management:**
   - Standalone client records (10)
   - Embedded in projects (9)

### Unused Workflows

1. **Time tracking (Events):**
   - 0 documents
   - Feature completely unused
   - Event-to-invoice workflow non-functional

2. **Email automations:**
   - 5 automations created
   - 0 active
   - Prefer manual email sending

3. **Custom invoice lines:**
   - Feature exists
   - 0 usage
   - All invoices from quotes or empty

---

## 6. Business Insights

### Revenue Analysis
- **Total invoiced:** CHF 16,729.58
- **Paid:** CHF 15,108.08 (90.3%)
- **Outstanding:** CHF 1,621.50 (9.7%)
- **Average invoice:** CHF 1,115.31

### Project Velocity
- 9 active projects
- 0 archived projects
- 7 custom statuses for workflow
- 11 planned work blocks

### Customer Base
- 10+ unique clients
- Mix of web projects and subscriptions
- Strong payment rate (93% invoices paid)

---

## 7. Data Quality Assessment

### Excellent (A+)
- **Referential integrity:** No orphaned documents
- **Multi-tenancy:** userId consistently applied
- **Audit trail:** 92 history entries for 9 projects
- **Invoice payment tracking:** paidAt dates accurate

### Good (B)
- **Project metadata:** 78% have descriptions
- **Client data:** All projects have client info
- **Status workflow:** Clear progression

### Needs Improvement (C)
- **Invoice line items:** 80% invoices have no items (events/quotes/customLines empty)
- **Company info in Settings:** Often incomplete
- **PDF generation:** pdfPath always null

### Poor (D)
- **Project tags/notes:** 0% usage
- **Events feature:** 0 documents (feature failure)
- **Email templates collection:** 0 documents
- **Automations:** 0 active

---

## 8. Recommendations

### Priority 1: Critical (Immediate)

1. **Investigate empty invoices**
   - 12/15 invoices have no line items
   - How are totals calculated?
   - Enforce data integrity: require at least one line item

2. **Events feature adoption or deprecation**
   - 0% usage despite being core feature
   - Options:
     - A) Improve UX/discoverability
     - B) Deprecate and remove (reduce complexity)
   - Decision needed: Is time tracking essential?

3. **Invoice number format migration**
   - Migrate `R0001` → `FAC-2025-001`
   - Ensure generateNumber() is used

### Priority 2: Important (Short-term)

4. **Clean up duplicate collections**
   - Drop `status` collection (keep `statuses`)
   - Verify no dependencies

5. **Add invoiceType field to existing invoices**
   - Schema defines it, documents missing it
   - Run migration: `db.invoices.updateMany({}, {$set: {invoiceType: 'standard'}})`

6. **Remove unused fields**
   - Project.tags (0% usage)
   - Project.notes (0% usage)
   - Or promote their usage in UI

7. **EmailTemplate collection cleanup**
   - 0 documents, functionality duplicated in Settings
   - Consider deprecating collection

### Priority 3: Nice-to-have (Medium-term)

8. **Automation feature improvements**
   - 5 created, 0 active
   - Add templates for common workflows
   - Simplify UI for connecting nodes

9. **PDF generation**
   - pdfPath always null
   - Is feature broken or unused?
   - Test and document

10. **Company info completion**
    - Settings.company often incomplete
    - Prompt users to complete during onboarding

### Priority 4: Analytics (Ongoing)

11. **Add feature usage tracking**
    - Which features are opened/used?
    - Track Events page views
    - Identify UX friction points

12. **Monitor conversion rates**
    - Quote → Signed (currently 0%)
    - Quote → Invoiced (currently 60%)
    - Invoice → Paid (currently 93%)

---

## 9. Conclusions

### What's Working Well
- ✅ **Quote-based workflow:** Well-adopted, partial invoicing feature used
- ✅ **Invoice management:** Good payment tracking (93% paid)
- ✅ **Project organization:** Clear status workflow, audit trail
- ✅ **Data integrity:** No orphaned documents
- ✅ **Multi-tenancy:** userId consistently applied

### Critical Issues
- ❌ **Events feature unused:** 0 documents (feature failure)
- ❌ **80% invoices have no line items:** Data integrity issue
- ❌ **Automations inactive:** 5 created, 0 active

### User Behavior Profile
- **Business model:** Fixed-price quotes, not hourly billing
- **Workflow:** Manual, not automated
- **Features valued:** Projects, Quotes, Invoices, Status tracking
- **Features ignored:** Time tracking, Automations, Email templates

### Strategic Decision Needed
**Should SWIGS Workflow focus on:**
- A) **Quote-based agencies** (current user) → Simplify, remove events
- B) **Time-tracking consultants** → Fix events UX, promote feature
- C) **Both** → Maintain complexity, improve discoverability

Current data suggests user prefers **fixed-price quote workflow** over **hourly time tracking**.

---

## Appendix: Raw Data Samples

### Collections Overview
```
automations: 5
automationruns: 2
clients: 10
cmseventcaches: 0
emailtemplates: 0
events: 0
histories: 92
invoices: 15
plannedblocks: 11
projects: 9
quotes: 5
services: 6
sessions: 50 (12 active)
settings: 7
status: 7 (duplicate)
statuses: 7
users: 6
```

---

**Report generated:** 2026-02-13
**Database:** swigs-workflow @ 192.168.110.59
**Analysis method:** MongoDB queries + Mongoose schema comparison
**Data integrity:** ✅ Excellent (no orphans, valid refs)
