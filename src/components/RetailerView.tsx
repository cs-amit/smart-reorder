import React, { useState, useEffect } from 'react';
import {
  Outlet,
  Product,
  PredictionResult,
  Distributor,
  Retailer,
  Order,
} from '../types';
import { RetailerJoinScreen } from './RetailerJoinScreen';
import { RetailerHomeScreen } from './RetailerHomeScreen';
import {
  ensureRetailerUserUid,
  fetchRetailerProfile,
  clearRetailerSession,
  JoinDistributorResult,
} from '../lib/firestoreService';
import { Loader2 } from 'lucide-react';

interface RetailerViewProps {
  outlets: Outlet[];
  products: Product[];
  predictions: PredictionResult[];
  orders: Order[];
  distributor: Distributor | null;
  asOfDate: string;
  initialOutletId?: string;
  initialProductId?: string;
  onOrderPlaced: () => void;
  // When set, shows this retailer's data instead of the signed-in user's own —
  // used by the demo distributor account to preview the retailer experience.
  previewAsUid?: string;
  // Reports the actual outlet linked to the signed-in retailer up to the parent,
  // so shared chrome (like the header) shows the right store instead of guessing.
  onOutletResolved?: (outlet: Outlet | null) => void;
}

export const RetailerView: React.FC<RetailerViewProps> = ({
  outlets,
  products,
  predictions,
  orders,
  distributor,
  asOfDate,
  initialOutletId,
  initialProductId,
  onOrderPlaced,
  previewAsUid,
  onOutletResolved,
}) => {
  const [retailerUid, setRetailerUid] = useState<string>('');
  const [retailer, setRetailer] = useState<Retailer | null>(null);
  const [linkedDistributor, setLinkedDistributor] = useState<Distributor | null>(null);
  const [linkedOutlet, setLinkedOutlet] = useState<Outlet | null>(null);
  const [wasMatched, setWasMatched] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Keep the parent informed of which outlet is actually linked to this retailer
  useEffect(() => {
    onOutletResolved?.(linkedOutlet);
  }, [linkedOutlet, onOutletResolved]);

  // Initialize retailer session
  useEffect(() => {
    let isMounted = true;
    async function initRetailer() {
      try {
        setIsLoading(true);
        const uid = previewAsUid || (await ensureRetailerUserUid());
        if (!isMounted) return;
        setRetailerUid(uid);

        const profileData = await fetchRetailerProfile(uid);
        if (!isMounted) return;

        if (profileData.retailer) {
          setRetailer(profileData.retailer);
          setLinkedDistributor(profileData.distributor || null);
          setLinkedOutlet(profileData.outlet || null);
        } else {
          setRetailer(null);
          setLinkedDistributor(null);
          setLinkedOutlet(null);
        }
      } catch (err) {
        console.warn('Init retailer profile warning:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    initRetailer();
    return () => {
      isMounted = false;
    };
  }, [previewAsUid]);

  const handleJoined = (result: JoinDistributorResult) => {
    setRetailer(result.retailer);
    setLinkedDistributor(result.distributor);
    setLinkedOutlet(result.outlet);
    setWasMatched(result.wasMatched);
    // Notify parent to refresh catalog/outlets in case a new outlet was created
    onOrderPlaced();
  };

  const handleDisconnect = () => {
    if (retailerUid) {
      clearRetailerSession(retailerUid);
    }
    setRetailer(prev => (prev ? { ...prev, linked_distributor_id: undefined, outlet_id: undefined } : null));
    setLinkedDistributor(null);
    setLinkedOutlet(null);
    setWasMatched(false);
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-[#64748B] space-y-3">
        <Loader2 className="w-6 h-6 animate-spin text-[#0F766E]" />
        <span className="text-sm font-medium">Checking retailer connection...</span>
      </div>
    );
  }

  // If retailer has actively linked with a distributor, show the functional Retailer Home Screen
  if (retailer && retailer.linked_distributor_id && linkedDistributor) {
    return (
      <RetailerHomeScreen
        retailer={retailer}
        distributor={linkedDistributor}
        outlet={linkedOutlet}
        outlets={outlets}
        products={products}
        predictions={predictions}
        orders={orders}
        asOfDate={asOfDate}
        wasMatched={wasMatched}
        onDisconnect={handleDisconnect}
        onOrderPlaced={onOrderPlaced}
      />
    );
  }

  // Otherwise, show the Retailer Join Screen requiring an invite code
  return (
    <RetailerJoinScreen
      uid={retailerUid}
      activeDistributor={null}
      onJoined={handleJoined}
    />
  );
};
