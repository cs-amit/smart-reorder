export type ConfidenceTier = 'confident' | 'learning' | 'cold' | 'Confident' | 'Learning' | 'Cold';

export type UserRole = 'distributor' | 'retailer';

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
  name?: string;
  created_at?: string;
  is_demo?: boolean;
}

export interface Distributor {
  id: string;
  distributor_id?: string;
  uid?: string;
  name: string;
  route?: string; // route / primary area name
  invite_code?: string;
  upi_id?: string;
  phone?: string;
  location?: string;
  created_at?: string;
  is_demo?: boolean;
  has_completed_onboarding?: boolean;
  as_of_date_override?: string;
}

export interface Product {
  id: string;
  distributor_id?: string;
  name: string;
  unit: string;
  wholesale_price: number;
  mrp: number;
  items_per_case: number;
  category: string;
}

export interface Outlet {
  id: string;
  distributor_id?: string;
  name: string;
  route: string;
  owner?: string;
  phone?: string;
}

export type OrderSource = 'distributor' | 'retailer' | 'retailer_app' | 'ocr_import' | 'ocr_invoice';

export interface Order {
  id: string;
  distributor_id?: string;
  outlet_id: string;
  outlet_name?: string;
  product_id: string;
  product_name?: string;
  date: string; // YYYY-MM-DD
  quantity: number;
  source?: OrderSource;
  placed_by?: string;
}

export interface NudgeAction {
  id: string;
  outlet_id: string;
  outlet_name: string;
  product_id: string;
  product_name: string;
  timestamp: string;
  status: 'logged';
  note?: string;
}

export interface NudgeRecord {
  id: string;
  distributor_id?: string;
  outlet_id: string;
  outlet_name?: string;
  outlet_route?: string;
  product_id: string;
  product_name?: string;
  product_unit?: string;
  message: string;
  sent_at: string;
  read: boolean;
  read_at?: string;
  suggested_quantity?: number;
  wholesale_price?: number;
}

export interface Retailer {
  id: string;
  uid: string;
  name: string;
  phone: string;
  linked_distributor_id: string;
  outlet_id?: string;
  joined_at?: string;
}

export interface OrderWithGap {
  id: string;
  date: string;
  quantity: number;
  gap_days: number | null;
  days_ago: number;
}

export interface PredictionResult {
  outlet_id: string;
  outlet_name: string;
  route: string;
  product_id: string;
  product_name: string;
  product_unit: string;
  wholesale_price: number;
  mrp: number;
  items_per_case: number;
  last_order_date: string;
  days_since_last_order: number;
  predicted_interval: number;
  predicted_next_date: string;
  predicted_next_reorder_date: string;
  confidence: ConfidenceTier;
  reasoning: string;
  status: 'overdue' | 'due_today' | 'due_soon' | 'upcoming';
  status_label: string;
  is_due: boolean;
  gaps?: number[];
  recent_gaps: number[];
  order_count: number;
  recent_average_quantity: number;
  order_history: OrderWithGap[];
  route_fallback_used?: boolean;
}

export interface CandidateOrderLine {
  id: string;
  raw_outlet_name: string;
  raw_product_name: string;
  quantity: number;
  date: string;
  matched_outlet_id: string | null;
  matched_outlet_name: string | null;
  matched_product_id: string | null;
  matched_product_name: string | null;
  confidence?: number;
  raw_text?: string;
  status: 'matched' | 'manual_review_needed';
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  as_of_date: string;
  message?: string;
}
