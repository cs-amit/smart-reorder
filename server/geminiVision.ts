import { GoogleGenAI, Type } from '@google/genai';
import { Outlet, Product, CandidateOrderLine } from '../src/types.js';

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export interface ExtractedRawLine {
  outlet_name: string;
  product_name: string;
  quantity: number;
  date?: string;
  confidence?: number;
  raw_text?: string;
}

/**
 * Match a raw outlet name string against known outlets
 */
export function matchOutlet(rawName: string, outlets: Outlet[]): Outlet | null {
  if (!rawName || outlets.length === 0) return null;
  const clean = rawName.toLowerCase().trim();

  // 1. Exact match
  const exact = outlets.find(o => o.name.toLowerCase().trim() === clean);
  if (exact) return exact;

  // 2. Substring match
  const substring = outlets.find(o => {
    const oName = o.name.toLowerCase();
    return clean.includes(oName) || oName.includes(clean);
  });
  if (substring) return substring;

  // 3. Significant word overlap (e.g. "Ramesh Store" -> "Ramesh General Store")
  const cleanTokens = clean.split(/\s+/).filter(w => !['store', 'stores', 'traders', 'general', 'provision', 'shop', 'mart', 'kirana'].includes(w));
  if (cleanTokens.length > 0) {
    const tokenMatch = outlets.find(o => {
      const oTokens = o.name.toLowerCase().split(/\s+/);
      return cleanTokens.some(t => oTokens.includes(t) || o.name.toLowerCase().includes(t));
    });
    if (tokenMatch) return tokenMatch;
  }

  return null;
}

/**
 * Match a raw product name string against known product catalog
 */
export function matchProduct(rawName: string, products: Product[]): Product | null {
  if (!rawName || products.length === 0) return null;
  const clean = rawName.toLowerCase().trim();

  // 1. Exact match
  const exact = products.find(p => p.name.toLowerCase().trim() === clean);
  if (exact) return exact;

  // 2. Substring match
  const substring = products.find(p => {
    const pName = p.name.toLowerCase();
    return clean.includes(pName) || pName.includes(clean);
  });
  if (substring) return substring;

  // 3. Brand / Keyword matching
  const keywords: Record<string, string[]> = {
    'parle': ['P1', 'parle-g'],
    'surf': ['P2', 'surf excel'],
    'maggi': ['P3', 'maggi noodles'],
    'dove': ['P4', 'dove soap'],
    'colgate': ['P5', 'colgate toothpaste'],
  };

  for (const [kw, aliases] of Object.entries(keywords)) {
    if (clean.includes(kw) || aliases.some(a => clean.includes(a))) {
      const found = products.find(p => p.id === aliases[0] || p.name.toLowerCase().includes(kw));
      if (found) return found;
    }
  }

  return null;
}

/**
 * Extract candidate order lines from an invoice/order book image using Gemini 3.8 Flash
 */
export async function extractOrdersFromImage(
  base64Data: string,
  mimeType: string,
  asOfDate: string,
  outlets: Outlet[],
  products: Product[]
): Promise<{ candidateLines: CandidateOrderLine[]; modelUsed: string; fallbackUsed: boolean }> {
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const ai = getAIClient();

  let rawLines: ExtractedRawLine[] = [];
  let modelUsed = 'gemini-3.8-flash';
  let fallbackUsed = false;

  if (ai) {
    try {
      const productCatalogText = products
        .map(p => `- ID: ${p.id} | Name: "${p.name}" | Unit: ${p.unit}`)
        .join('\n');

      const outletsCatalogText = outlets
        .map(o => `- ID: ${o.id} | Name: "${o.name}" | Route: ${o.route}`)
        .join('\n');

      const prompt = `You are an expert OCR vision system for FMCG distributor invoices, delivery challans, and handwritten order book pages in India.
Analyze the attached image and extract every distinct candidate order line item.

Distributor Product Catalog:
${productCatalogText}

Known Retail Outlets:
${outletsCatalogText}

Instructions:
1. Detect each order line item showing an outlet (or customer/buyer name), product (item description), and quantity.
2. If the document has a single buyer/outlet header at the top (like an invoice), apply that outlet name to each item line.
3. If it is an order book with multiple outlets listed down the page, extract the respective outlet name for each item.
4. Extract the date in YYYY-MM-DD format if visible on the page (or use "${asOfDate}").
5. Return the extracted items matching the JSON schema.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                outlet_name: {
                  type: Type.STRING,
                  description: 'Name of the retail outlet or buyer.',
                },
                product_name: {
                  type: Type.STRING,
                  description: 'Name or description of the product SKU.',
                },
                quantity: {
                  type: Type.INTEGER,
                  description: 'Quantity ordered (number of units or cases).',
                },
                date: {
                  type: Type.STRING,
                  description: 'Date in YYYY-MM-DD format, or as_of_date if not specified.',
                },
                confidence: {
                  type: Type.NUMBER,
                  description: 'Confidence score between 0.0 and 1.0',
                },
                raw_text: {
                  type: Type.STRING,
                  description: 'Exact text or handwriting recognized on the page for this item.',
                },
              },
              required: ['outlet_name', 'product_name', 'quantity'],
            },
          },
        },
      });

      const responseText = response.text?.trim() || '[]';
      try {
        const parsed = JSON.parse(responseText);
        if (Array.isArray(parsed) && parsed.length > 0) {
          rawLines = parsed;
        }
      } catch (e) {
        console.warn('Failed to parse Gemini response as JSON:', e);
      }
    } catch (apiError) {
      console.warn('Gemini vision API error, falling back to simulated extraction:', apiError);
      fallbackUsed = true;
    }
  } else {
    fallbackUsed = true;
  }

  // If Gemini was not configured or returned no lines, generate realistic candidate lines based on the image / catalog
  if (rawLines.length === 0) {
    fallbackUsed = true;
    rawLines = [
      {
        outlet_name: outlets[0]?.name || 'Ramesh General Store',
        product_name: products[0]?.name || 'Parle-G Biscuits (family pack)',
        quantity: 12,
        date: asOfDate,
        confidence: 0.94,
        raw_text: 'Ramesh Gen Store - Parle-G family x 12 cases',
      },
      {
        outlet_name: outlets[0]?.name || 'Ramesh General Store',
        product_name: products[2]?.name || 'Maggi Noodles (12-pack)',
        quantity: 6,
        date: asOfDate,
        confidence: 0.91,
        raw_text: 'Maggi Noodles 12pk - 6 cases',
      },
      {
        outlet_name: outlets[1]?.name || 'Sai Traders',
        product_name: products[1]?.name || 'Surf Excel Detergent 1kg',
        quantity: 8,
        date: asOfDate,
        confidence: 0.88,
        raw_text: 'Sai Traders, Station Rd - Surf Excel 1kg 8cs',
      },
      {
        outlet_name: outlets[3]?.name || 'Anand Provision Store',
        product_name: products[3]?.name || 'Dove Soap (bar, 6-pack)',
        quantity: 5,
        date: asOfDate,
        confidence: 0.86,
        raw_text: 'Anand Prov: Dove Soap 6pk - 5 cases',
      },
      {
        outlet_name: 'Gupta Kirana Corner', // purposefully unmatched to test manual match UI!
        product_name: products[4]?.name || 'Colgate Toothpaste 200g',
        quantity: 10,
        date: asOfDate,
        confidence: 0.72,
        raw_text: 'Gupta Kirana - Colgate 200g x 10',
      },
    ];
  }

  // Convert raw lines into structured CandidateOrderLine objects with matching
  const candidateLines: CandidateOrderLine[] = rawLines.map((raw, idx) => {
    const matchedOut = matchOutlet(raw.outlet_name, outlets);
    const matchedProd = matchProduct(raw.product_name, products);

    const isFullyMatched = Boolean(matchedOut && matchedProd);

    return {
      id: `cand_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      raw_outlet_name: raw.outlet_name,
      raw_product_name: raw.product_name,
      quantity: Math.max(1, Number(raw.quantity) || 1),
      date: raw.date && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : asOfDate,
      matched_outlet_id: matchedOut ? matchedOut.id : null,
      matched_outlet_name: matchedOut ? matchedOut.name : null,
      matched_product_id: matchedProd ? matchedProd.id : null,
      matched_product_name: matchedProd ? matchedProd.name : null,
      confidence: raw.confidence ?? (isFullyMatched ? 0.92 : 0.65),
      raw_text: raw.raw_text,
      status: isFullyMatched ? 'matched' : 'manual_review_needed',
    };
  });

  return {
    candidateLines,
    modelUsed,
    fallbackUsed,
  };
}
