
export type UserRole = 'admin' | 'user' | 'assistant';

export interface User {
  username: string;
  role: UserRole;
  originalRole?: UserRole; // To track true role when switching views
}

export interface AuthCredentials {
  username: string;
  password?: string; // Optional when just passing user info
}

export type TransactionType = 'collection' | 'expense' | 'loan';

export interface Transaction {
  id: string; // UUID string
  name: string;
  amount: number;
  type: TransactionType;
  image?: string; // Base64 string
  date: string; // ISO Date string YYYY-MM-DD
  description?: string;
  
  // UI Only properties for pending requests
  _isPending?: boolean;
  _requestId?: string;
  _pendingAction?: 'add' | 'update' | 'delete';
  _pendingData?: Transaction; // To store the proposed changes for updates
}

export interface EventData {
  id: string; // UUID string
  name: string;
  isDeleted?: boolean; // Soft delete flag
  transactions: Transaction[];
}

export type RequestType = 'create_event' | 'delete_event' | 'add_transaction' | 'update_transaction' | 'delete_transaction';

export interface PendingRequest {
  id: string;
  type: RequestType;
  data: any; // Payload depends on type
  description: string; // Human readable summary
  timestamp: string;
  requestedBy: string;
  isRead?: boolean; // Track if admin has seen this notification
}

// Helper for PDF generation format
export interface TransactionPDFRow {
  date: string;
  name: string;
  type: string;
  amount: string;
}