import { EventData, Transaction, UserRole, PendingRequest } from '../types';

// Connection Status Event Logic
const dispatchStatus = (isOnline: boolean, message?: string) => {
  const event = new CustomEvent('hms-connection-status', { 
    detail: { isOnline, message } 
  });
  window.dispatchEvent(event);
};

// Generic Fetch Wrapper
const api = async (endpoint: string, options: RequestInit = {}) => {
  try {
    const res = await fetch(`/api/${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });

    if (res.status === 503) {
      dispatchStatus(false, 'Database Disconnected');
      throw new Error('Database Disconnected');
    }

    if (!res.ok) {
      // Try to parse JSON error, fall back to text if failed (e.g., 404 HTML or Proxy Error)
      let errorInfo;
      try {
        errorInfo = await res.json();
      } catch (e) {
        const text = await res.text();
        // Create a descriptive error from the status and text body
        throw new Error(`Server Error (${res.status}): ${text.substring(0, 100)}`);
      }
      
      throw new Error(errorInfo.error || `API Error: ${res.status}`);
    }

    dispatchStatus(true);
    return await res.json();
  } catch (error: any) {
    // If it's a network error (fetch failed completely)
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      dispatchStatus(false, 'Network Error: Cannot connect to server');
    } else if (error.message !== 'Database Disconnected') {
      // Don't override the specific DB error
      console.error(error);
    }
    throw error;
  }
};

export const checkHealth = async (): Promise<void> => {
  await api('health');
};

// --- Auth Services ---

export const authenticate = async (username: string, password: string): Promise<{ success: boolean; role?: UserRole; error?: string }> => {
  try {
    return await api('auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  } catch (e: any) {
    return { success: false, error: e.message || 'Connection failed' };
  }
};

export const updateCredentials = async (role: UserRole, newUsername: string, newPassword?: string): Promise<void> => {
  await api('auth/update', {
    method: 'PUT',
    body: JSON.stringify({ role, username: newUsername, password: newPassword })
  });
};

export const resetAdminPassword = async (confirmedUsername: string, newPassword: string): Promise<boolean> => {
  const res = await api('auth/reset-admin', {
    method: 'POST',
    body: JSON.stringify({ confirmedUsername, newPassword })
  });
  return res.success;
};

export const getPublicCredentials = async () => {
  try {
    return await api('auth/credentials');
  } catch (e) {
    return { adminUsername: 'Admin', userUsername: 'User', assistantUsername: 'Assistant' };
  }
};

// --- Request / Approval Services ---

export const createRequest = async (
  type: PendingRequest['type'], 
  data: any, 
  description: string, 
  requestedBy: string
): Promise<void> => {
  const request: PendingRequest = {
    id: crypto.randomUUID(),
    type,
    data,
    description,
    timestamp: new Date().toISOString(),
    requestedBy,
    isRead: false
  };
  await api('requests', {
    method: 'POST',
    body: JSON.stringify(request)
  });
};

export const updateRequest = async (id: string, data: any, description: string): Promise<void> => {
  await api(`requests/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ 
      data, 
      description,
      timestamp: new Date().toISOString(),
      isRead: false
    })
  });
};

export const getPendingRequests = async (): Promise<PendingRequest[]> => {
  return await api('requests');
};

export const getPendingRequestsByEvent = async (eventId: string): Promise<PendingRequest[]> => {
  const allReqs = await getPendingRequests();
  return allReqs.filter(req => req.data && req.data.eventId === eventId);
};

export const deleteRequest = async (id: string): Promise<void> => {
  await api(`requests/${id}`, { method: 'DELETE' });
};

export const approveRequest = async (req: PendingRequest): Promise<void> => {
  switch (req.type) {
    case 'create_event':
      await createEvent(req.data.name);
      break;
    case 'delete_event':
      await deleteEvent(req.data.eventId);
      break;
    case 'add_transaction':
      await addTransaction(req.data.eventId, req.data.transaction);
      break;
    case 'update_transaction':
      await updateTransaction(req.data.eventId, req.data.transaction);
      break;
    case 'delete_transaction':
      await deleteTransaction(req.data.eventId, req.data.transactionId);
      break;
  }
  await deleteRequest(req.id);
};

export const markAllRequestsAsRead = async (): Promise<void> => {
  await api('requests/mark-read', { method: 'POST' });
};

export const getUnreadRequestCount = async (): Promise<number> => {
  const reqs = await getPendingRequests();
  return reqs.filter((r: PendingRequest) => !r.isRead).length;
};

// --- Event Services ---

export const getEvents = async (): Promise<EventData[]> => {
  try {
    return await api('events');
  } catch (e) {
    console.error(e);
    return [];
  }
};

export const getDeletedEvents = async (): Promise<EventData[]> => {
  try {
    return await api('events/deleted');
  } catch (e) {
    return [];
  }
};

export const getEventById = async (id: string): Promise<EventData | undefined> => {
  try {
    return await api(`events/${id}`);
  } catch (e) {
    return undefined;
  }
};

export const createEvent = async (name: string): Promise<EventData> => {
  const newEvent: EventData = {
    id: crypto.randomUUID(),
    name,
    isDeleted: false,
    transactions: []
  };
  return await api('events', {
    method: 'POST',
    body: JSON.stringify(newEvent)
  });
};

export const deleteEvent = async (id: string): Promise<void> => {
  await api(`events/${id}/delete`, { method: 'PUT' });
};

export const restoreEvent = async (id: string): Promise<void> => {
  await api(`events/${id}/restore`, { method: 'PUT' });
};

export const permanentlyDeleteEvent = async (id: string): Promise<void> => {
  await api(`events/${id}`, { method: 'DELETE' });
};

// --- Transaction Services ---

export const addTransaction = async (eventId: string, transaction: Omit<Transaction, 'id'>): Promise<Transaction> => {
  const newTx: Transaction = {
    ...transaction,
    id: crypto.randomUUID()
  };
  return await api(`events/${eventId}/transactions`, {
    method: 'POST',
    body: JSON.stringify(newTx)
  });
};

export const updateTransaction = async (eventId: string, updatedTx: Transaction): Promise<void> => {
  await api(`events/${eventId}/transactions/${updatedTx.id}`, {
    method: 'PUT',
    body: JSON.stringify(updatedTx)
  });
};

export const deleteTransaction = async (eventId: string, transactionId: string): Promise<void> => {
  await api(`events/${eventId}/transactions/${transactionId}`, {
    method: 'DELETE'
  });
};