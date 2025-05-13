import { DynamicCollection } from "@/types/collections";
import styles from "./TrendingCollections.module.scss";
import Image from "next/image";
import { CheckCircle } from "lucide-react";

// TabSelector Component
export const TabSelector = ({
  activeTab,
  onTabChange,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
}) => (
  <div className={styles.tabs}>
    <button
      className={`${styles.tabButton} ${
        activeTab === "trending" ? styles.activeTab : ""
      }`}
      onClick={() => onTabChange("trending")}
    >
      Trending
    </button>
    <button
      className={`${styles.tabButton} ${
        activeTab === "top" ? styles.activeTab : ""
      }`}
      onClick={() => onTabChange("top")}
    >
      Top
    </button>
  </div>
);

// Header Component
export const Header = ({
  activeTab,
  onTabChange,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
}) => (
  <div className={styles.header}>
    <TabSelector activeTab={activeTab} onTabChange={onTabChange} />
    <button className={styles.viewAllButton}>View all</button>
  </div>
);

// Empty State Component
export const EmptyState = () => (
  <div className={styles.emptyContainer}>
    <p>No collections found. Be the first to create a collection!</p>
  </div>
);

// Skeleton Components
const CollectionRowSkeleton = ({}: { index: number }) => (
  <div className={styles.collectionRow}>
    <div className={styles.rankCell}>
      <div className={styles.skeletonRank}></div>
    </div>
    <div className={styles.collectionCell}>
      <div className={styles.collectionInfo}>
        <div className={styles.skeletonImage}></div>
        <div className={styles.skeletonName}></div>
      </div>
    </div>
    <div className={styles.priceCell}>
      <div className={styles.skeletonPrice}></div>
    </div>
  </div>
);

// Skeleton Loader for Desktop and Mobile
const DesktopSkeletonTable = () => (
  <div className={styles.tableContainer}>
    <div className={styles.tableLayout}>
      {/* Left Column Header */}
      <div className={styles.columnHeader}>
        <div className={styles.rankHeader}>RANK</div>
        <div className={styles.collectionHeader}>COLLECTION</div>
        <div className={styles.priceHeader}>POOL PRICE</div>
      </div>

      {/* Right Column Header */}
      <div className={styles.columnHeader}>
        <div className={styles.rankHeader}>RANK</div>
        <div className={styles.collectionHeader}>COLLECTION</div>
        <div className={styles.priceHeader}>POOL PRICE</div>
      </div>

      {/* Left Column Skeleton */}
      <div className={styles.columnContent}>
        {[1, 2, 3, 4, 5].map((item) => (
          <CollectionRowSkeleton key={`skeleton-left-${item}`} index={item} />
        ))}
      </div>

      {/* Right Column Skeleton */}
      <div className={styles.columnContent}>
        {[1, 2, 3, 4, 5].map((item) => (
          <CollectionRowSkeleton key={`skeleton-right-${item}`} index={item} />
        ))}
      </div>
    </div>
  </div>
);

// Skeleton Loader for Mobile
export const MobileSkeletonTable = () => (
  <div className={styles.mobileContainer}>
    <div className={styles.mobileHeader}>
      <div className={styles.rankHeader}>RANK</div>
      <div className={styles.collectionHeader}>COLLECTION</div>
      <div className={styles.priceHeader}>POOL PRICE</div>
    </div>

    <div className={styles.mobileContent}>
      {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
        <CollectionRowSkeleton key={`skeleton-mobile-${item}`} index={item} />
      ))}
    </div>
  </div>
);

// Skeleton Loader Component
export const SkeletonLoader = () => (
  <>
    <DesktopSkeletonTable />
    <MobileSkeletonTable />
  </>
);

// Collection Row Component
const CollectionRow = ({
  collection,
  onCollectionClick,
  renderPoolPrice,
  handleImageError,
}: {
  collection: DynamicCollection;
  onCollectionClick: (id: string) => void;
  renderPoolPrice: (collection: DynamicCollection) => React.ReactNode;
  handleImageError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}) => (
  <div
    className={styles.collectionRow}
    onClick={() => onCollectionClick(collection.id)}
  >
    <div className={styles.rankCell}>{collection.rank}</div>
    <div className={styles.collectionCell}>
      <div className={styles.collectionInfo}>
        <div className={styles.imageContainer}>
          <Image
            src={collection.image || "/placeholder.svg"}
            alt={collection.name}
            width={40}
            height={40}
            className={styles.collectionImage}
            onError={handleImageError}
          />
        </div>
        <div className={styles.collectionName}>
          {collection.name}
          {collection.verified && (
            <CheckCircle size={14} className={styles.verifiedIcon} />
          )}
        </div>
      </div>
    </div>
    {renderPoolPrice(collection)}
  </div>
);

// Mobile Collection Table
export const MobileCollectionTable = ({
  collections,
  onCollectionClick,
  renderPoolPrice,
  handleImageError,
}: {
  collections: DynamicCollection[];
  onCollectionClick: (id: string) => void;
  renderPoolPrice: (collection: DynamicCollection) => React.ReactNode;
  handleImageError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}) => (
  <div className={styles.mobileContainer}>
    <div className={styles.mobileHeader}>
      <div className={styles.rankHeader}>RANK</div>
      <div className={styles.collectionHeader}>COLLECTION</div>
      <div className={styles.priceHeader}>POOL PRICE</div>
    </div>

    <div className={styles.mobileContent}>
      {collections.map((collection) => (
        <CollectionRow
          key={collection.id}
          collection={collection}
          onCollectionClick={onCollectionClick}
          renderPoolPrice={renderPoolPrice}
          handleImageError={handleImageError}
        />
      ))}
    </div>
  </div>
);

// Desktop Collection Table
export const DesktopCollectionTable = ({
  leftCollections,
  rightCollections,
  onCollectionClick,
  renderPoolPrice,
  handleImageError,
}: {
  leftCollections: DynamicCollection[];
  rightCollections: DynamicCollection[];
  onCollectionClick: (id: string) => void;
  renderPoolPrice: (collection: DynamicCollection) => React.ReactNode;
  handleImageError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}) => (
  <div className={styles.tableContainer}>
    <div className={styles.tableLayout}>
      {/* Left Column Header */}
      <div className={styles.columnHeader}>
        <div className={styles.rankHeader}>RANK</div>
        <div className={styles.collectionHeader}>COLLECTION</div>
        <div className={styles.priceHeader}>POOL PRICE</div>
      </div>

      {/* Right Column Header */}
      <div className={styles.columnHeader}>
        <div className={styles.rankHeader}>RANK</div>
        <div className={styles.collectionHeader}>COLLECTION</div>
        <div className={styles.priceHeader}>POOL PRICE</div>
      </div>

      {/* Left Column Content */}
      <div className={styles.columnContent}>
        {leftCollections.map((collection) => (
          <CollectionRow
            key={collection.id}
            collection={collection}
            onCollectionClick={onCollectionClick}
            renderPoolPrice={renderPoolPrice}
            handleImageError={handleImageError}
          />
        ))}
      </div>

      {/* Right Column Content */}
      <div className={styles.columnContent}>
        {rightCollections.map((collection) => (
          <CollectionRow
            key={collection.id}
            collection={collection}
            onCollectionClick={onCollectionClick}
            renderPoolPrice={renderPoolPrice}
            handleImageError={handleImageError}
          />
        ))}
      </div>
    </div>
  </div>
);
