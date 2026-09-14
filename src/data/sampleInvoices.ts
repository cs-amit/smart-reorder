/**
 * Realistic sample invoices and order book slips formatted as SVG Base64 data URLs
 * for quick testing of the Gemini Vision order extraction pipeline.
 */

function svgToDataUrl(svgString: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
}

export interface SampleInvoicePreset {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  dataUrl: string;
  description: string;
}

export const SAMPLE_INVOICES: SampleInvoicePreset[] = [
  {
    id: 'sample_handwritten_slip',
    title: 'Daily Route Order Slip',
    subtitle: 'Handwritten Order Sheet (Ward Road)',
    badge: 'Handwritten',
    description: 'Order pad entries for Ramesh General Store & Sai Traders',
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 850" width="700" height="850">
        <rect width="700" height="850" fill="#fdfbf7" />
        <!-- Notebook margin and lines -->
        <line x1="80" y1="0" x2="80" y2="850" stroke="#fca5a5" stroke-width="2" />
        <line x1="0" y1="90" x2="700" y2="90" stroke="#cbd5e1" stroke-width="1.5" />
        <line x1="0" y1="140" x2="700" y2="140" stroke="#cbd5e1" stroke-width="1" />
        <line x1="0" y1="190" x2="700" y2="190" stroke="#cbd5e1" stroke-width="1" />
        <line x1="0" y1="240" x2="700" y2="240" stroke="#cbd5e1" stroke-width="1" />
        <line x1="0" y1="290" x2="700" y2="290" stroke="#cbd5e1" stroke-width="1" />
        <line x1="0" y1="340" x2="700" y2="340" stroke="#cbd5e1" stroke-width="1" />
        <line x1="0" y1="390" x2="700" y2="390" stroke="#cbd5e1" stroke-width="1" />
        <line x1="0" y1="440" x2="700" y2="440" stroke="#cbd5e1" stroke-width="1" />
        <line x1="0" y1="490" x2="700" y2="490" stroke="#cbd5e1" stroke-width="1" />
        <line x1="0" y1="540" x2="700" y2="540" stroke="#cbd5e1" stroke-width="1" />
        <line x1="0" y1="590" x2="700" y2="590" stroke="#cbd5e1" stroke-width="1" />
        <line x1="0" y1="640" x2="700" y2="640" stroke="#cbd5e1" stroke-width="1" />
        <line x1="0" y1="690" x2="700" y2="690" stroke="#cbd5e1" stroke-width="1" />
        <line x1="0" y1="740" x2="700" y2="740" stroke="#cbd5e1" stroke-width="1" />

        <!-- Header -->
        <text x="100" y="65" font-family="monospace" font-size="20" font-weight="bold" fill="#1e293b">ROUTE ORDER PAD - DATE: 05/09/2026</text>
        <text x="100" y="85" font-family="sans-serif" font-size="12" fill="#64748b">Salesman: Rajesh (Ward Road Route)</text>

        <!-- Entry 1 -->
        <text x="100" y="130" font-family="sans-serif" font-size="16" font-weight="bold" fill="#0f172a">1. Ramesh General Store</text>
        <text x="120" y="180" font-family="monospace" font-size="16" fill="#1e3a8a">- Parle-G Biscuits (family pack) : 12 cases</text>
        <text x="120" y="230" font-family="monospace" font-size="16" fill="#1e3a8a">- Maggi Noodles 12-pack : 6 cases</text>
        <text x="120" y="280" font-family="monospace" font-size="15" fill="#475569">Urgent delivery before 4 PM</text>

        <!-- Entry 2 -->
        <text x="100" y="380" font-family="sans-serif" font-size="16" font-weight="bold" fill="#0f172a">2. Sai Traders (Station Road)</text>
        <text x="120" y="430" font-family="monospace" font-size="16" fill="#1e3a8a">- Surf Excel Detergent 1kg : 8 cases</text>
        <text x="120" y="480" font-family="monospace" font-size="16" fill="#1e3a8a">- Colgate Toothpaste 200g : 5 cases</text>

        <!-- Entry 3 -->
        <text x="100" y="580" font-family="sans-serif" font-size="16" font-weight="bold" fill="#0f172a">3. Anand Provision Store</text>
        <text x="120" y="630" font-family="monospace" font-size="16" fill="#1e3a8a">- Dove Soap 6-pack : 4 cases</text>
        <text x="120" y="680" font-family="monospace" font-size="16" fill="#1e3a8a">- Parle-G Biscuits : 10 cases</text>

        <rect x="90" y="760" width="520" height="60" rx="8" fill="#f1f5f9" stroke="#cbd5e1" />
        <text x="110" y="795" font-family="sans-serif" font-size="13" font-weight="bold" fill="#334155">TOTAL DISPATCH: 45 CASES • ROUTE: WARD ROAD</text>
      </svg>
    `),
  },
  {
    id: 'sample_printed_tax_invoice',
    title: 'Wholesale Tax Invoice',
    subtitle: 'Printed Distributor Delivery Challan',
    badge: 'Printed Invoice',
    description: 'Tax Invoice for Lucky General Stores (5 items)',
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 850" width="700" height="850">
        <rect width="700" height="850" fill="#ffffff" />
        <rect x="25" y="25" width="650" height="800" fill="none" stroke="#334155" stroke-width="2" />

        <!-- Company Header -->
        <text x="50" y="65" font-family="sans-serif" font-size="22" font-weight="bold" fill="#0f172a">SHREE SAI FMCG DISTRIBUTORS</text>
        <text x="50" y="85" font-family="sans-serif" font-size="12" fill="#64748b">Godown No. 4, APMC Market Yard, Pune • Phone: +91 98230 11223</text>
        <text x="50" y="102" font-family="sans-serif" font-size="11" fill="#64748b">GSTIN: 27AABCS1429B1Z8 • State: Maharashtra</text>

        <line x1="25" y1="120" x2="675" y2="120" stroke="#334155" stroke-width="1.5" />

        <!-- Invoice Details -->
        <text x="50" y="145" font-family="sans-serif" font-size="12" font-weight="bold" fill="#334155">INVOICE NO: INV-2026/0891</text>
        <text x="50" y="165" font-family="sans-serif" font-size="12" fill="#334155">DATE: 2026-09-05</text>

        <text x="360" y="145" font-family="sans-serif" font-size="12" font-weight="bold" fill="#0f172a">BUYER: Lucky General Stores</text>
        <text x="360" y="165" font-family="sans-serif" font-size="11" fill="#475569">Proprietor: Vikram Lucky • Phone: 9823012348</text>
        <text x="360" y="180" font-family="sans-serif" font-size="11" fill="#475569">Address: Gandhi Chowk, Ward Road</text>

        <line x1="25" y1="200" x2="675" y2="200" stroke="#334155" stroke-width="1.5" />

        <!-- Table Header -->
        <rect x="25" y="200" width="650" height="35" fill="#f8fafc" />
        <text x="45" y="222" font-family="sans-serif" font-size="11" font-weight="bold" fill="#1e293b">SR</text>
        <text x="80" y="222" font-family="sans-serif" font-size="11" font-weight="bold" fill="#1e293b">DESCRIPTION OF GOODS</text>
        <text x="380" y="222" font-family="sans-serif" font-size="11" font-weight="bold" fill="#1e293b">QTY</text>
        <text x="460" y="222" font-family="sans-serif" font-size="11" font-weight="bold" fill="#1e293b">RATE</text>
        <text x="560" y="222" font-family="sans-serif" font-size="11" font-weight="bold" fill="#1e293b">AMOUNT</text>

        <!-- Rows -->
        <line x1="25" y1="270" x2="675" y2="270" stroke="#e2e8f0" />
        <text x="45" y="255" font-family="sans-serif" font-size="12" fill="#334155">1</text>
        <text x="80" y="255" font-family="sans-serif" font-size="12" font-weight="bold" fill="#0f172a">Parle-G Biscuits (family pack)</text>
        <text x="380" y="255" font-family="sans-serif" font-size="12" font-weight="bold" fill="#0f172a">10 cs</text>
        <text x="460" y="255" font-family="sans-serif" font-size="12" fill="#334155">₹480.00</text>
        <text x="560" y="255" font-family="sans-serif" font-size="12" fill="#334155">₹4,800.00</text>

        <line x1="25" y1="315" x2="675" y2="315" stroke="#e2e8f0" />
        <text x="45" y="300" font-family="sans-serif" font-size="12" fill="#334155">2</text>
        <text x="80" y="300" font-family="sans-serif" font-size="12" font-weight="bold" fill="#0f172a">Surf Excel Detergent 1kg</text>
        <text x="380" y="300" font-family="sans-serif" font-size="12" font-weight="bold" fill="#0f172a">6 cs</text>
        <text x="460" y="300" font-family="sans-serif" font-size="12" fill="#334155">₹1,320.00</text>
        <text x="560" y="300" font-family="sans-serif" font-size="12" fill="#334155">₹7,920.00</text>

        <line x1="25" y1="360" x2="675" y2="360" stroke="#e2e8f0" />
        <text x="45" y="345" font-family="sans-serif" font-size="12" fill="#334155">3</text>
        <text x="80" y="345" font-family="sans-serif" font-size="12" font-weight="bold" fill="#0f172a">Maggi Noodles (12-pack)</text>
        <text x="380" y="345" font-family="sans-serif" font-size="12" font-weight="bold" fill="#0f172a">8 cs</text>
        <text x="460" y="345" font-family="sans-serif" font-size="12" fill="#334155">₹576.00</text>
        <text x="560" y="345" font-family="sans-serif" font-size="12" fill="#334155">₹4,608.00</text>

        <line x1="25" y1="405" x2="675" y2="405" stroke="#e2e8f0" />
        <text x="45" y="390" font-family="sans-serif" font-size="12" fill="#334155">4</text>
        <text x="80" y="390" font-family="sans-serif" font-size="12" font-weight="bold" fill="#0f172a">Dove Soap (bar, 6-pack)</text>
        <text x="380" y="390" font-family="sans-serif" font-size="12" font-weight="bold" fill="#0f172a">5 cs</text>
        <text x="460" y="390" font-family="sans-serif" font-size="12" fill="#334155">₹960.00</text>
        <text x="560" y="390" font-family="sans-serif" font-size="12" fill="#334155">₹4,800.00</text>

        <!-- Total Box -->
        <rect x="360" y="470" width="300" height="90" fill="#f8fafc" stroke="#cbd5e1" />
        <text x="380" y="500" font-family="sans-serif" font-size="13" font-weight="bold" fill="#334155">Subtotal: ₹22,128.00</text>
        <text x="380" y="525" font-family="sans-serif" font-size="13" fill="#64748b">GST (18%): ₹3,983.04</text>
        <text x="380" y="548" font-family="sans-serif" font-size="15" font-weight="bold" fill="#047857">GRAND TOTAL: ₹26,111.00</text>
      </svg>
    `),
  },
];
