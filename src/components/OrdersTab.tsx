import React, { useState, useMemo } from 'react';
import { Order, Outlet, Product, OrderSource } from '../types';
import {
  FileText,
  Search,
  Filter,
  Calendar,
  Store,
  Package,
  Layers,
  Truck,
  ScanText,
  DollarSign,
  TrendingUp,
  Camera,
} from 'lucide-react';
import { BUTTON_STYLES, CARD_STYLE } from '../lib/theme';

interface OrdersTabProps {
  orders: Order[];
  outlets: Outlet[];
  products: Product[];
  asOfDate: string;
  onOpenPhotoImport?: () => void;
}

export const OrdersTab: React.FC<OrdersTabProps> = ({
  orders,
  outlets,
  products,
  asOfDate,
  onOpenPhotoImport,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>('all');
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>('all');

  // Enriched orders with outlet and product metadata, sorted chronologically (newest first)
  const enrichedOrders = useMemo(() => {
    return orders
      .map(ord => {
        const outlet = outlets.find(o => o.id === ord.outlet_id);
        const product = products.find(p => p.id === ord.product_id);
        const price = product?.wholesale_price || 0;
        const totalValue = ord.quantity * price;

        // Calculate days ago relative to asOfDate
        const d1 = new Date(asOfDate).getTime();
        const d2 = new Date(ord.date).getTime();
        const diffDays = Math.max(0, Math.round((d1 - d2) / (1000 * 60 * 60 * 24)));

        return {
          ...ord,
          outletName: outlet?.name || ord.outlet_id,
          outletRoute: outlet?.route || 'Standard',
          productName: product?.name || ord.product_id,
          productUnit: product?.unit || 'case',
          wholesalePrice: price,
          totalValue,
          daysAgo: diffDays,
          source: ord.source || 'distributor',
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [orders, outlets, products, asOfDate]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return enrichedOrders.filter(ord => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        ord.id.toLowerCase().includes(q) ||
        ord.outletName.toLowerCase().includes(q) ||
        ord.productName.toLowerCase().includes(q) ||
        ord.date.includes(q);

      const matchesOutlet =
        selectedOutletFilter === 'all' || ord.outlet_id === selectedOutletFilter;

      const matchesSource =
        selectedSourceFilter === 'all' || ord.source === selectedSourceFilter;

      return matchesSearch && matchesOutlet && matchesSource;
    });
  }, [enrichedOrders, searchQuery, selectedOutletFilter, selectedSourceFilter]);

  // Total summary metrics
  const metrics = useMemo(() => {
    const totalValue = filteredOrders.reduce((sum, o) => sum + o.totalValue, 0);
    const totalCases = filteredOrders.reduce((sum, o) => sum + o.quantity, 0);
    return {
      count: filteredOrders.length,
      totalValue,
      totalCases,
    };
  }, [filteredOrders]);

  const getSourceBadge = (source: OrderSource) => {
    switch (source) {
      case 'retailer':
      case 'retailer_app':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4]">
            <Store className="w-3 h-3 mr-1 text-[#0F766E]" />
            Placed by Retailer
          </span>
        );
      case 'ocr_import':
      case 'ocr_invoice':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
            <ScanText className="w-3 h-3 mr-1 text-[#2563EB]" />
            From Photo
          </span>
        );
      case 'distributor':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0]">
            <Truck className="w-3 h-3 mr-1 text-[#64748B]" />
            Added by You
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Stats */}
      <div className={`${CARD_STYLE} p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}>
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-[#0F172A] tracking-tight">
              All Orders
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0]">
              Newest First
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Every order across all your shops
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="px-3 py-1.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
            <span className="text-[#64748B]">Total Orders:</span>{' '}
            <strong className="text-[#0F172A] font-bold">{metrics.count}</strong>
          </div>
          <div className="px-3 py-1.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
            <span className="text-[#64748B]">Volume:</span>{' '}
            <strong className="text-[#0F172A] font-bold">{metrics.totalCases} cases</strong>
          </div>
          <div className="px-3 py-1.5 bg-[#F0FDFA] text-[#0F766E] rounded-lg border border-[#99F6E4]">
            <span className="text-[#0F766E]">Value:</span>{' '}
            <strong className="font-bold">₹{metrics.totalValue.toLocaleString('en-IN')}</strong>
          </div>
          {onOpenPhotoImport && (
            <button
              id="orders-import-photo-btn"
              type="button"
              onClick={onOpenPhotoImport}
              className={`${BUTTON_STYLES.primary} text-xs py-1.5 px-3 ml-1`}
            >
              <Camera className="w-3.5 h-3.5 mr-1" />
              <span>Import from photo</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className={`${CARD_STYLE} p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3`}>
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="orders-search-input"
            type="text"
            placeholder="Search by Order ID, outlet, or product..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs sm:text-sm text-[#0F172A] placeholder-[#64748B]/60 focus:outline-hidden focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] transition-colors"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {/* Outlet Filter */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-[#64748B]" />
            <span className="text-xs font-medium text-[#64748B]">Outlet:</span>
            <select
              id="orders-outlet-filter"
              value={selectedOutletFilter}
              onChange={e => setSelectedOutletFilter(e.target.value)}
              className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#0F172A] px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-[#0F766E] max-w-[160px] truncate"
            >
              <option value="all">All Outlets ({outlets.length})</option>
              {outlets.map(o => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          {/* Placement Method Filter */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <span className="text-xs font-medium text-[#64748B]">Placed via:</span>
            <select
              id="orders-source-filter"
              value={selectedSourceFilter}
              onChange={e => setSelectedSourceFilter(e.target.value)}
              className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#0F172A] px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-[#0F766E]"
            >
              <option value="all">All Sources</option>
              <option value="retailer">Placed by Retailer</option>
              <option value="distributor">Added by You</option>
              <option value="ocr_import">From Photo</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className={`${CARD_STYLE} overflow-hidden`}>
        {filteredOrders.length === 0 ? (
          <div className="py-16 text-center text-[#64748B] text-sm">
            No orders found matching your search or filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm" id="orders-log-table">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                  <th className="py-3 px-4">Order ID & Date</th>
                  <th className="py-3 px-4">Retail Outlet</th>
                  <th className="py-3 px-4">Product Ordered</th>
                  <th className="py-3 px-4">Quantity</th>
                  <th className="py-3 px-4">Wholesale Value</th>
                  <th className="py-3 px-4">Placement Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredOrders.map(ord => (
                  <tr
                    key={ord.id}
                    id={`order-row-${ord.id}`}
                    className="hover:bg-[#F8FAFC] transition-colors"
                  >
                    {/* Order ID & Date */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-[#0F172A]">
                          {ord.id}
                        </span>
                        <span className="text-[11px] text-[#64748B]">
                          {ord.date} ({ord.daysAgo === 0 ? 'Today' : `${ord.daysAgo}d ago`})
                        </span>
                      </div>
                    </td>

                    {/* Outlet */}
                    <td className="py-3.5 px-4 font-medium text-[#0F172A]">
                      <div className="flex flex-col">
                        <span className="font-semibold text-[#0F172A]">{ord.outletName}</span>
                        <span className="text-[11px] text-[#64748B]">
                          Route: {ord.outletRoute}
                        </span>
                      </div>
                    </td>

                    {/* Product */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-[#0F172A]">{ord.productName}</span>
                        <span className="text-[11px] text-[#64748B]">
                          ₹{ord.wholesalePrice}/{ord.productUnit}
                        </span>
                      </div>
                    </td>

                    {/* Quantity */}
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-sm text-[#0F172A]">
                        {ord.quantity}
                      </span>{' '}
                      <span className="text-xs text-[#64748B]">{ord.productUnit}s</span>
                    </td>

                    {/* Wholesale Value */}
                    <td className="py-3.5 px-4 font-bold text-[#0F766E]">
                      ₹{ord.totalValue.toLocaleString('en-IN')}
                    </td>

                    {/* Source / Placed via */}
                    <td className="py-3.5 px-4">
                      {getSourceBadge(ord.source as OrderSource)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
