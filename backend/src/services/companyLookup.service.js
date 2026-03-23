/**
 * Swiss Company Lookup Service — UID Register SOAP API
 * https://www.bfs.admin.ch/bfs/en/home/registers/enterprise-register/enterprise-identification/uid-register/uid-interfaces.html
 *
 * No authentication required. Returns company data from the official Swiss UID register.
 */
import { parseStringPromise } from 'xml2js';

const UID_ENDPOINT = 'https://www.uid-wse.admin.ch/V5.0/PublicServices.svc';

// eCH-0097 legal form codes → our internal values
const LEGAL_FORM_MAP = {
  '0101': 'raison_individuelle', // Einzelunternehmen / Entreprise individuelle
  '0104': 'snc',                 // Kollektivgesellschaft / SNC
  '0105': 'senc',                // Kommanditgesellschaft / SEnC
  '0106': 'sa',                  // Aktiengesellschaft / SA
  '0107': 'sa',                  // Kommanditaktiengesellschaft (rare, map to SA)
  '0108': 'sarl',                // GmbH / Sàrl
  '0109': 'cooperative',         // Genossenschaft / Coopérative
  '0110': 'fondation',           // Stiftung / Fondation
  '0302': 'raison_individuelle', // Zweigniederlassung / Succursale
  '0220': 'association',         // Verein / Association
  '0221': 'association',         // Verein / Association (variant)
};

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Strip XML namespace prefixes for easier parsing
function stripNS(name) {
  return name.replace(/^.*:/, '');
}

// Extract text value from XML node (may be string or {_: value, $: attrs})
function val(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'object' && node._) return node._;
  return String(node);
}

/**
 * Search Swiss companies by name via UID Register SOAP API
 * @param {string} name - Company name (min 3 chars)
 * @param {number} maxResults - Max results to return (default 10)
 * @returns {Array<{uid, name, legalForm, street, zip, city, canton, vatStatus}>}
 */
export async function searchCompany(name, maxResults = 10) {
  if (!name || name.trim().length < 3) return [];

  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:uid="http://www.uid.admin.ch/xmlns/uid-wse"
  xmlns:uid5="http://www.uid.admin.ch/xmlns/uid-wse/5">
  <soap:Body>
    <uid:Search>
      <uid:searchParameters>
        <uid5:uidEntitySearchParameters>
          <uid5:organisationName>${escapeXml(name.trim())}</uid5:organisationName>
        </uid5:uidEntitySearchParameters>
      </uid:searchParameters>
    </uid:Search>
  </soap:Body>
</soap:Envelope>`;

  const response = await fetch(UID_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': '"http://www.uid.admin.ch/xmlns/uid-wse/IPublicServices/Search"',
    },
    body: soapBody,
  });

  if (!response.ok) {
    throw new Error(`UID API error: ${response.status}`);
  }

  const xml = await response.text();

  const parsed = await parseStringPromise(xml, {
    explicitArray: false,
    tagNameProcessors: [stripNS],
    valueProcessors: [(v) => v], // keep as strings
  });

  const body = parsed?.Envelope?.Body;

  // Check for SOAP fault
  if (body?.Fault) {
    const faultMsg = body.Fault.faultstring || body.Fault.Reason?.Text?._ || 'Unknown SOAP fault';
    throw new Error(`UID API fault: ${faultMsg}`);
  }

  const result = body?.SearchResponse?.SearchResult;
  if (!result?.uidEntitySearchResultItem) return [];

  const items = Array.isArray(result.uidEntitySearchResultItem)
    ? result.uidEntitySearchResultItem
    : [result.uidEntitySearchResultItem];

  return items.slice(0, maxResults).map(item => {
    const org = item?.organisation?.organisation;
    if (!org) return null;

    const id = org.organisationIdentification || {};
    const addr = org.address || {};
    const vat = item?.organisation?.vatRegisterInformation;

    // Format UID: CHE + 9 digits → CHE-XXX.XXX.XXX
    const uidNum = val(id?.uid?.uidOrganisationId);
    const uidFormatted = uidNum
      ? `CHE-${uidNum.replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3')}`
      : '';

    const legalFormCode = val(id.legalForm);

    return {
      uid: uidFormatted,
      name: val(id.organisationName),
      legalForm: LEGAL_FORM_MAP[legalFormCode] || 'raison_individuelle',
      legalFormCode,
      street: [val(addr.street), val(addr.houseNumber)].filter(Boolean).join(' '),
      zip: val(addr.swissZipCode),
      city: val(addr.town),
      canton: val(addr.cantonAbbreviation),
      isVatSubject: val(vat?.vatStatus) === '2', // 2 = active
    };
  }).filter(Boolean);
}
