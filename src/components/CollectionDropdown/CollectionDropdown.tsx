/* eslint-disable @typescript-eslint/no-explicit-any */
import { toast } from "react-toastify";
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  KeyboardEvent,
} from "react";
import {
  ChevronDown,
  ChevronUp,
  Check,
  RefreshCw,
  AlertCircle,
  Wifi,
  WifiOff,
  Loader2,
  Search,
  X,
} from "lucide-react";

import { usePoolStore, Pool } from "@/stores/poolStore";
import {
  useRealTimeCollections,
  Pool as RealtimePool,
  Collection,
} from "@/hook/api/realtime/useRealTimeCollections";

import styles from "./CollectionDropdown.module.scss";

interface CollectionDropdownProps {
  mode: string;
  onSelectionChange?: (pool: Pool | null) => void;
  placeholder?: string;
  maxHeight?: number;
  showSearch?: boolean;
  disabled?: boolean;
}

interface EnhancedPool extends RealtimePool {
  collectionName: string;
  symbol?: string;
  score?: number;
}

const CollectionDropdown: React.FC<CollectionDropdownProps> = ({
  onSelectionChange,
  placeholder = "Select a collection...",
  maxHeight = 250,
  showSearch = true,
  disabled = false,
}) => {
  // State management
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const [isFullyLoaded, setIsFullyLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Refs
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const autoSelectTimeoutRef = useRef<NodeJS.Timeout>(undefined);
  const searchTimeoutRef = useRef<NodeJS.Timeout>(undefined);

  // Store and hooks
  const { selectedPool, setSelectedPool } = usePoolStore();

  const {
    pools,
    collections,
    lastUpdate,
    connectionState,
    isLoading,
    error,
    refresh,
    stats,
  } = useRealTimeCollections({
    enableSSE: true,
    fallbackPolling: true,
    newItemExpiry: 5 * 60 * 1000,
  });

  // Memoized enhanced pools with search scoring
  const enhancedPools = useMemo(() => {
    return pools.map((pool: RealtimePool) => {
      const collection = collections.find(
        (c: Collection) => c.collectionMint === pool.collectionMint
      );

      const collectionName =
        collection?.collectionName ||
        pool.collectionName ||
        `Collection ${pool.collectionMint.slice(0, 6)}...`;

      return {
        ...pool,
        collectionName,
        symbol: collection?.symbol,
      } as EnhancedPool;
    });
  }, [pools, collections]);

  // Filtered and sorted pools with fuzzy search
  const filteredPools = useMemo(() => {
    if (!searchTerm.trim()) {
      return enhancedPools.sort((a, b) => {
        // Sort by: selected first, then new items, then alphabetically
        if (selectedPool?.address === a.poolAddress) return -1;
        if (selectedPool?.address === b.poolAddress) return 1;
        if (a.isNew && !b.isNew) return -1;
        if (!a.isNew && b.isNew) return 1;
        return a.collectionName.localeCompare(b.collectionName);
      });
    }

    const searchLower = searchTerm.toLowerCase();

    return enhancedPools
      .map((pool) => {
        const nameMatch = pool.collectionName.toLowerCase();
        const symbolMatch = pool.symbol?.toLowerCase() || "";
        const addressMatch = pool.poolAddress.toLowerCase();

        let score = 0;

        // Exact matches get highest score
        if (nameMatch === searchLower) score += 100;
        else if (nameMatch.startsWith(searchLower)) score += 50;
        else if (nameMatch.includes(searchLower)) score += 25;

        // Symbol matches
        if (symbolMatch === searchLower) score += 80;
        else if (symbolMatch.startsWith(searchLower)) score += 40;
        else if (symbolMatch.includes(searchLower)) score += 20;

        // Address matches (lower priority)
        if (addressMatch.includes(searchLower)) score += 10;

        // Boost for currently selected
        if (selectedPool?.address === pool.poolAddress) score += 200;

        // Boost for new items
        if (pool.isNew) score += 15;

        return { ...pool, score };
      })
      .filter((pool) => pool.score > 0)
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [enhancedPools, searchTerm, selectedPool?.address]);

  // Smart loading state detection
  const isSmartLoading = useMemo(() => {
    if (!isLoading) return false;
    if (stats?.transactionsProcessed === 0) return true;
    return !isFullyLoaded && stats?.transactionsProcessed < 100;
  }, [isLoading, stats?.transactionsProcessed, isFullyLoaded]);

  // Enhanced auto-selection with retry logic
  useEffect(() => {
    if (
      enhancedPools.length > 0 &&
      !selectedPool &&
      !hasAutoSelected &&
      isFullyLoaded &&
      !isSmartLoading
    ) {
      // Clear any existing timeout
      if (autoSelectTimeoutRef.current) {
        clearTimeout(autoSelectTimeoutRef.current);
      }

      // Auto-select with slight delay for better UX
      autoSelectTimeoutRef.current = setTimeout(() => {
        const bestPool = enhancedPools[0];

        handleSelectCollection(
          bestPool.poolAddress,
          bestPool.collectionName,
          false
        );
        setHasAutoSelected(true);

        toast.success(`Auto-selected: ${bestPool.collectionName}`, {
          position: "bottom-left",
          autoClose: 2000,
          hideProgressBar: true,
        });
      }, 300);
    }

    return () => {
      if (autoSelectTimeoutRef.current) {
        clearTimeout(autoSelectTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enhancedPools,
    selectedPool,
    hasAutoSelected,
    isFullyLoaded,
    isSmartLoading,
  ]);

  // Enhanced loading state tracking
  useEffect(() => {
    if (stats?.transactionsProcessed > 0 && !isLoading) {
      const timer = setTimeout(() => {
        setIsFullyLoaded(true);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [stats?.transactionsProcessed, isLoading]);

  // Retry mechanism for connection failures
  useEffect(() => {
    if (error && connectionState === "error" && retryCount < 3) {
      const timeout = setTimeout(() => {
        setRetryCount((prev) => prev + 1);
        refresh();
      }, Math.min(2000 * Math.pow(2, retryCount), 10000));

      return () => clearTimeout(timeout);
    }
  }, [error, connectionState, retryCount, refresh]);

  // Enhanced click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm("");
        setFocusedIndex(-1);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        setSearchTerm("");
        setFocusedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape as any);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape as any);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && showSearch && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, showSearch]);

  // Enhanced selection handler with optimistic updates
  const handleSelectCollection = useCallback(
    (
      poolAddress: string,
      collectionName: string,
      showToast: boolean = true
    ) => {
      // Find the actual pool data to get all required properties
      const actualPool = enhancedPools.find(
        (p) => p.poolAddress === poolAddress
      );

      if (!actualPool) {
        console.error("Pool not found:", poolAddress);
        return;
      }

      // Create Pool object with correct structure for poolStore
      const poolData: Pool = {
        id: actualPool.poolAddress,
        address: actualPool.poolAddress,
        name: collectionName,
        type: "bonding-curve",
        description: `Collection: ${collectionName}`,
      };

      // Optimistic update
      setSelectedPool(poolData);
      setIsOpen(false);
      setSearchTerm("");
      setFocusedIndex(-1);

      // Callback for parent component
      onSelectionChange?.(poolData);

      if (showToast) {
        toast.success(`Selected: ${collectionName}`, {
          position: "bottom-left",
          autoClose: 1500,
          hideProgressBar: true,
        });
      }

      // Refresh data in background
      refresh();
    },
    [enhancedPools, setSelectedPool, onSelectionChange, refresh]
  );

  // Enhanced search with debouncing
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setFocusedIndex(-1);

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search for better performance
    searchTimeoutRef.current = setTimeout(() => {
      // Could add analytics or other side effects here
    }, 300);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!isOpen) return;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setFocusedIndex((prev) =>
            prev < filteredPools.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          event.preventDefault();
          setFocusedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredPools.length - 1
          );
          break;
        case "Enter":
          event.preventDefault();
          if (focusedIndex >= 0 && filteredPools[focusedIndex]) {
            const pool = filteredPools[focusedIndex];
            handleSelectCollection(pool.poolAddress, pool.collectionName);
          }
          break;
        case "Escape":
          event.preventDefault();
          setIsOpen(false);
          setSearchTerm("");
          setFocusedIndex(-1);
          break;
      }
    },
    [isOpen, filteredPools, focusedIndex, handleSelectCollection]
  );

  // Enhanced refresh with user feedback
  const handleRefresh = useCallback(() => {
    setRetryCount(0);
    refresh();
    toast.info("Refreshing collections...", {
      position: "bottom-left",
      autoClose: 1000,
      hideProgressBar: true,
    });
  }, [refresh]);

  // Get connection status with enhanced states
  const getConnectionStatus = useCallback(() => {
    switch (connectionState) {
      case "connected":
        return {
          icon: Wifi,
          color: "text-green-500",
          text: "Live",
          bgColor: "bg-green-50",
        };
      case "connecting":
        return {
          icon: Loader2,
          color: "text-yellow-500",
          text: "Connecting...",
          bgColor: "bg-yellow-50",
          spinning: true,
        };
      case "disconnected":
        return {
          icon: WifiOff,
          color: "text-gray-500",
          text: "Offline",
          bgColor: "bg-gray-50",
        };
      case "error":
        return {
          icon: AlertCircle,
          color: "text-red-500",
          text: "Error",
          bgColor: "bg-red-50",
        };
      default:
        return {
          icon: WifiOff,
          color: "text-gray-500",
          text: "Unknown",
          bgColor: "bg-gray-50",
        };
    }
  }, [connectionState]);

  const {
    icon: StatusIcon,
    color,
    text: statusText,
    bgColor,
    spinning,
  } = getConnectionStatus();

  const getSelectedName = () => {
    return selectedPool?.name || placeholder;
  };

  const isSelected = (poolAddress: string) => {
    return selectedPool?.address === poolAddress;
  };

  return (
    <div
      className={styles.dropdownContainer}
      ref={dropdownRef}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <button
        className={`${styles.dropdownButton} ${
          !selectedPool ? styles.noSelection : ""
        } ${disabled ? styles.disabled : ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        type="button"
        aria-haspopup="true"
        aria-expanded={isOpen}
        disabled={disabled || (!isFullyLoaded && isSmartLoading)}
        aria-label={
          selectedPool ? `Selected: ${selectedPool.name}` : placeholder
        }
      >
        <span
          className={`${styles.buttonText} ${
            !selectedPool ? styles.placeholder : ""
          }`}
        >
          {!isFullyLoaded && isSmartLoading ? (
            <div className={styles.loadingIndicator}>
              <Loader2 size={14} className={styles.rotating} />
              <span>Loading collections...</span>
            </div>
          ) : (
            getSelectedName()
          )}
        </span>

        <div className={styles.indicators}>
          <div className={`${styles.statusBadge} ${bgColor}`}>
            <StatusIcon
              size={12}
              className={`${color} ${spinning ? styles.rotating : ""}`}
            />
            <span className={styles.statusText}>{statusText}</span>
          </div>
        </div>

        {isOpen ? (
          <ChevronUp size={16} className={styles.icon} />
        ) : (
          <ChevronDown size={16} className={styles.icon} />
        )}
      </button>

      {isOpen && (
        <div
          className={styles.dropdownMenu}
          style={{ maxHeight: `${maxHeight}px` }}
        >
          <div className={styles.dropdownHeader}>
            <div className={styles.headerInfo}>
              <span className={styles.headerTitle}>Collections</span>
              <span className={styles.itemCount}>
                {filteredPools.length} of {enhancedPools.length}
              </span>
            </div>
            <div className={styles.headerActions}>
              {lastUpdate && (
                <span className={styles.lastUpdate}>
                  {Math.floor((Date.now() - lastUpdate) / 1000)}s ago
                </span>
              )}
              <button
                className={styles.refreshButton}
                onClick={handleRefresh}
                type="button"
                aria-label="Refresh collections"
                disabled={isLoading}
              >
                <RefreshCw
                  size={14}
                  className={isLoading ? styles.rotating : ""}
                />
              </button>
            </div>
          </div>

          {showSearch && (
            <div className={styles.searchContainer}>
              <Search size={16} className={styles.searchIcon} />
              <input
                ref={searchInputRef}
                type="text"
                className={styles.searchInput}
                placeholder="Search collections..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
              />
              {searchTerm && (
                <button
                  className={styles.clearSearch}
                  onClick={() => handleSearchChange("")}
                  type="button"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          <div className={styles.dropdownContent} ref={listRef}>
            {error && (
              <div className={styles.errorMessage}>
                <AlertCircle size={16} />
                <div className={styles.errorText}>
                  <span>Connection issue</span>
                  <small>
                    {retryCount > 0
                      ? `Retry ${retryCount}/3`
                      : "Using cached data"}
                  </small>
                </div>
              </div>
            )}

            {(!isFullyLoaded || isSmartLoading) && (
              <div className={styles.loadingIndicator}>
                <Loader2 size={18} className={styles.rotating} />
                <div className={styles.loadingText}>
                  <span>Loading collections...</span>
                  {stats?.transactionsProcessed > 0 && (
                    <small>
                      {stats.transactionsProcessed} transactions processed
                    </small>
                  )}
                </div>
              </div>
            )}

            {isFullyLoaded && !isSmartLoading && filteredPools.length === 0 ? (
              <div className={styles.emptyMessage}>
                {searchTerm ? (
                  <>
                    <Search size={20} />
                    <span>No collections found</span>
                    <small>Try adjusting your search terms</small>
                  </>
                ) : (
                  <>
                    <AlertCircle size={20} />
                    <span>No collections available</span>
                    <small>Create a collection pool to get started</small>
                  </>
                )}
              </div>
            ) : (
              <div className={styles.poolsList}>
                {filteredPools.map((pool, index) => (
                  <div
                    key={pool.poolAddress}
                    className={`${styles.dropdownItem} ${
                      isSelected(pool.poolAddress) ? styles.selected : ""
                    } ${pool.isNew ? styles.newItem : ""} ${
                      index === focusedIndex ? styles.focused : ""
                    }`}
                    onClick={() =>
                      handleSelectCollection(
                        pool.poolAddress,
                        pool.collectionName
                      )
                    }
                    onMouseEnter={() => setFocusedIndex(index)}
                    role="option"
                    aria-selected={isSelected(pool.poolAddress)}
                  >
                    <div className={styles.itemContent}>
                      <div className={styles.itemHeader}>
                        <span className={styles.collectionName}>
                          {pool.collectionName}
                        </span>
                        {pool.symbol && (
                          <span className={styles.symbol}>({pool.symbol})</span>
                        )}
                        {pool.isNew && (
                          <span className={styles.newBadge}>New</span>
                        )}
                      </div>

                      <div className={styles.itemDetails}>
                        <span className={styles.poolAddress}>
                          {pool.poolAddress.slice(0, 6)}...
                          {pool.poolAddress.slice(-4)}
                        </span>
                        {pool.basePrice && (
                          <span className={styles.price}>
                            {(parseInt(pool.basePrice) / 1e9).toFixed(4)} SOL
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected(pool.poolAddress) && (
                      <Check size={16} className={styles.checkIcon} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionDropdown;
