/* eslint-disable @typescript-eslint/no-explicit-any */
export interface HeliusNFTFile {
  uri: string;
  cdn_uri?: string;
  mime?: string;
}

export interface HeliusNFTMetadata {
  name?: string;
  symbol?: string;
  description?: string;
  image?: string;
  attributes?: Array<{
    trait_type?: string;
    value?: string;
  }>;
  token_standard?: string;
}

export interface HeliusNFTContent {
  $schema?: string;
  json_uri?: string;
  files?: HeliusNFTFile[];
  metadata?: HeliusNFTMetadata;
  links?: {
    image?: string;
  };
}

export interface HeliusNFTGrouping {
  group_key?: string;
  group_value?: string;
}

export interface HeliusNFT {
  id: string;
  interface: string;
  content: HeliusNFTContent;
  authorities?: unknown[];
  compression?: unknown;
  grouping?: HeliusNFTGrouping[];
  royalty?: unknown;
  creators?: unknown[];
  ownership?: {
    owner?: string;
  };
  supply?: unknown;
  mutable?: boolean;
  burnt?: boolean;
  token_info?: unknown;
}

export interface HeliusRPCResponse {
  jsonrpc: string;
  id: string;
  result: {
    total: number;
    limit: number;
    page: number;
    items: HeliusNFT[];
  };
  error?: {
    code: number;
    message: string;
  };
}

export interface NFT {
  id: string;
  mintAddress: string;
  name: string;
  image: string;
  price: string;
  collectionId: string;
  collectionName: string;
  uri?: string;
}

export interface HeliusTransaction {
  signature: string;
  description?: string;
  type?: string;
  source?: string;
  fee?: number;
  feePayer: string;
  slot?: number;
  timestamp?: number;
  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  tokenTransfers?: any[];
  accountData?: any[];
  transactionError?: any;
  instructions: any[];
  events?: any;
}

export interface HeliusNFTFile {
  uri: string;
  cdn_uri?: string;
  mime?: string;
}

export interface HeliusNFTMetadata {
  name?: string;
  symbol?: string;
  description?: string;
  image?: string;
  attributes?: Array<{
    trait_type?: string;
    value?: string;
  }>;
  token_standard?: string;
}

export interface HeliusNFTContent {
  $schema?: string;
  json_uri?: string;
  files?: HeliusNFTFile[];
  metadata?: HeliusNFTMetadata;
  links?: {
    image?: string;
  };
}

export interface HeliusNFTGrouping {
  group_key?: string;
  group_value?: string;
}

export interface HeliusNFT {
  id: string;
  interface: string;
  content: HeliusNFTContent;
  authorities?: unknown[];
  compression?: unknown;
  grouping?: HeliusNFTGrouping[];
  royalty?: unknown;
  creators?: unknown[];
  ownership?: {
    owner?: string;
  };
  supply?: unknown;
  mutable?: boolean;
  burnt?: boolean;
  token_info?: unknown;
}

export interface HeliusRPCResponse {
  jsonrpc: string;
  id: string;
  result: {
    total: number;
    limit: number;
    page: number;
    items: HeliusNFT[];
  };
  error?: {
    code: number;
    message: string;
  };
}
