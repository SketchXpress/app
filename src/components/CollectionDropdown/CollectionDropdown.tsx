// src/components/CollectionDropdown/CollectionDropdown.tsx
import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Check, RefreshCw } from 'lucide-react';
import { usePoolStore } from '@/stores/poolStore';
import { DEFAULT_POOLS } from '@/components/RightPanel/utils';
import { useTransactionHistory } from '@/hooks/queries/useTransactionHistory';
import { toast } from 'react-toastify';
import styles from './CollectionDropdown.module.scss';

interface CollectionDropdownProps {
  mode: string;
}

// Interface for collection data
interface CollectionData {
  id: string;
  poolAddress: string;
  collectionName: string;
}

const CollectionDropdown: React.FC<CollectionDropdownProps> = ({ mode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [collections, setCollections] = useState<CollectionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { selectedPool, setSelectedPool, clearSelectedPool } = usePoolStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch transaction history data
  const { data: history, isLoading: historyLoading, error: historyError } = useTransactionHistory(100);

  // Current default pool based on mode
  const defaultPool = mode === 'kids' ? DEFAULT_POOLS.kids : DEFAULT_POOLS.pro;

  // Process transaction history to extract collections
  useEffect(() => {
    if (historyLoading) {
      setIsLoading(true);
      return;
    }

    if (historyError) {
      console.error("Error loading collections:", historyError);
      toast.error("Failed to load collections");
      setIsLoading(false);
      return;
    }

    if (history && history.length > 0) {
      try {
        // Create a map to track unique collections
        const collectionsMap = new Map<string, CollectionData>();

        // First, find collection names from createCollectionNft transactions
        const collectionNameMap = new Map<string, string>();

        history.forEach(tx => {
          if (tx.instructionName === "createCollectionNft" && tx.args?.name && tx.accounts) {
            const collectionMint = tx.accounts[1].toString();
            collectionNameMap.set(collectionMint, tx.args.name as string);
          }
        });

        // Then process pool creation transactions
        history.forEach(tx => {
          if (tx.instructionName === "createPool" && tx.poolAddress && tx.accounts) {
            const poolAddress = tx.poolAddress;

            // Try to get a name for the collection
            let collectionName = "";

            // If we have the collection mint in the accounts, try to look up its name
            if (tx.accounts.length > 1) {
              const collectionMint = tx.accounts[1].toString();
              collectionName = collectionNameMap.get(collectionMint) || "";
            }

            // If no name found, generate a generic one
            if (!collectionName) {
              collectionName = `Collection ${poolAddress.slice(0, 6)}...`;
            }

            // Only add if not already in the map
            if (!collectionsMap.has(poolAddress)) {
              collectionsMap.set(poolAddress, {
                id: poolAddress,
                poolAddress,
                collectionName,
              });
            }
          }
        });

        // Always include default pools if they're not already in the map
        if (!collectionsMap.has(DEFAULT_POOLS.kids.address)) {
          collectionsMap.set(DEFAULT_POOLS.kids.address, {
            id: 'kids',
            poolAddress: DEFAULT_POOLS.kids.address,
            collectionName: DEFAULT_POOLS.kids.name,
          });
        }

        if (!collectionsMap.has(DEFAULT_POOLS.pro.address)) {
          collectionsMap.set(DEFAULT_POOLS.pro.address, {
            id: 'pro',
            poolAddress: DEFAULT_POOLS.pro.address,
            collectionName: DEFAULT_POOLS.pro.name,
          });
        }

        // Convert map to array
        const collectionsArray = Array.from(collectionsMap.values());

        // Sort collections - put default pool for current mode first, then alphabetically
        collectionsArray.sort((a, b) => {
          // Default pool for current mode should be first
          if (a.poolAddress === defaultPool.address) return -1;
          if (b.poolAddress === defaultPool.address) return 1;

          // Other default pool next
          const otherDefaultPool = mode === 'kids' ? DEFAULT_POOLS.pro.address : DEFAULT_POOLS.kids.address;
          if (a.poolAddress === otherDefaultPool) return -1;
          if (b.poolAddress === otherDefaultPool) return 1;

          // Then sort alphabetically by name
          return a.collectionName.localeCompare(b.collectionName);
        });

        setCollections(collectionsArray);
        setIsLoading(false);

      } catch (error) {
        console.error("Error processing collections:", error);
        toast.error("Failed to process collections");
        setIsLoading(false);
      }
    } else {
      // No history data, just use default pools
      setCollections([
        {
          id: 'kids',
          poolAddress: DEFAULT_POOLS.kids.address,
          collectionName: DEFAULT_POOLS.kids.name,
        },
        {
          id: 'pro',
          poolAddress: DEFAULT_POOLS.pro.address,
          collectionName: DEFAULT_POOLS.pro.name,
        },
      ]);
      setIsLoading(false);
    }
  }, [history, historyLoading, historyError, defaultPool.address, mode]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectCollection = (poolAddress: string, collectionName: string) => {
    if (poolAddress === defaultPool.address) {
      // If selecting the default pool, just clear selection which will use default
      clearSelectedPool();
    } else {
      // Otherwise set the selected pool
      setSelectedPool({
        address: poolAddress,
        name: collectionName,
        id: poolAddress,
        type: "custom",
      });
    }
    setIsOpen(false);
  };

  // Get the currently selected collection name
  const getSelectedName = () => {
    if (selectedPool) {
      return selectedPool.name;
    }
    return defaultPool.name;
  };

  // Handle refresh button click
  const handleRefresh = () => {
    setIsLoading(true);
    // You can implement a refetch mechanism here if you have one
    // For now, just simulate a refresh by setting loading state
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className={styles.dropdownContainer} ref={dropdownRef}>
      <button
        className={styles.dropdownButton}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className={styles.buttonText}>{getSelectedName()}</span>
        {isOpen ? (
          <ChevronUp size={16} className={styles.icon} />
        ) : (
          <ChevronDown size={16} className={styles.icon} />
        )}
      </button>

      {isOpen && (
        <div className={styles.dropdownMenu}>
          <div className={styles.dropdownHeader}>
            <span>Select Collection</span>
            <button
              className={styles.refreshButton}
              onClick={handleRefresh}
              type="button"
              aria-label="Refresh collections"
            >
              <RefreshCw size={14} className={isLoading ? styles.rotating : ''} />
            </button>
          </div>

          {isLoading ? (
            <div className={styles.loadingItem}>Loading collections...</div>
          ) : (
            <>
              {collections.length > 0 ? (
                collections.map((collection) => (
                  <div
                    key={collection.id}
                    className={styles.dropdownItem}
                    onClick={() => handleSelectCollection(
                      collection.poolAddress,
                      collection.collectionName
                    )}
                  >
                    <span className={styles.collectionName}>
                      {collection.collectionName}
                    </span>
                    {(selectedPool?.address === collection.poolAddress ||
                      (!selectedPool && collection.poolAddress === defaultPool.address)) && (
                        <Check size={16} className={styles.checkIcon} />
                      )}
                  </div>
                ))
              ) : (
                <div className={styles.emptyMessage}>
                  No collections available
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CollectionDropdown;