import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Banknote, 
  Receipt, 
  HandCoins, 
  Wallet, 
  Plus,
  Download,
  X,
  Trash2,
  RotateCcw,
  Save,
  User as UserIcon,
  FlaskConical,
  Check,
  Settings
} from 'lucide-react';
import { Header } from '../components/Header';
import { StatsCard } from '../components/StatsCard';
import { EventData, User, UserRole, PendingRequest } from '../types';
import { 
  getEvents, 
  createEvent, 
  getPublicCredentials, 
  updateCredentials, 
  getDeletedEvents, 
  restoreEvent, 
  permanentlyDeleteEvent,
  createRequest,
  getPendingRequests,
  approveRequest,
  deleteRequest,
  getUnreadRequestCount,
  markAllRequestsAsRead
} from '../services/db';

interface DashboardProps {
  user: User;
  onLogout: () => void;
  onSwitchRole: (role: UserRole) => void;
  testingMode: boolean;
  onToggleTestingMode: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, onSwitchRole, testingMode, onToggleTestingMode }) => {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  
  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'recycle'>('general');
  const [deletedEvents, setDeletedEvents] = useState<EventData[]>([]);
  const [recycleDeleteId, setRecycleDeleteId] = useState<string | null>(null);
  
  // Request Modal State
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Credentials State
  const [adminCreds, setAdminCreds] = useState({ username: '', password: '' });
  const [userCreds, setUserCreds] = useState({ username: '', password: '' });
  const [assistantCreds, setAssistantCreds] = useState({ username: '', password: '' });
  const [credStatus, setCredStatus] = useState('');

  const navigate = useNavigate();

  const loadEvents = async () => {
    const data = await getEvents();
    setEvents(data);
    setLoading(false);
  };

  const loadSettingsData = async () => {
    if (user.role !== 'admin') return;
    const creds = await getPublicCredentials();
    setAdminCreds({ username: creds.adminUsername, password: '' });
    setUserCreds({ username: creds.userUsername, password: '' });
    setAssistantCreds({ username: creds.assistantUsername, password: '' });
    
    const del = await getDeletedEvents();
    setDeletedEvents(del);
  };

  const loadRequests = async () => {
    if (user.role === 'admin') {
      const reqs = await getPendingRequests();
      setPendingRequests(reqs);
    }
  };

  const loadUnread = async () => {
    if (user.role === 'admin') {
      const count = await getUnreadRequestCount();
      setUnreadCount(count);
    }
  };

  useEffect(() => {
    loadEvents();
    if (user.role === 'admin') {
      loadRequests();
      loadUnread();
    }
  }, [user.role]);

  useEffect(() => {
    if (isSettingsOpen) {
      loadSettingsData();
    }
  }, [isSettingsOpen]);

  useEffect(() => {
    if (isRequestsOpen) {
      loadRequests();
    }
  }, [isRequestsOpen]);

  const handleOpenRequests = async () => {
    setIsRequestsOpen(true);
    if (unreadCount > 0) {
      await markAllRequestsAsRead();
      setUnreadCount(0); // Optimistic update
    }
    loadRequests();
  };

  const handleCreateEvent = async () => {
    if (!newEventName.trim()) return;

    if (user.role === 'assistant') {
      await createRequest(
        'create_event',
        { name: newEventName },
        `Create Event: "${newEventName}"`,
        user.username
      );
      alert("Request to create event sent to Admin for approval.");
    } else {
      await createEvent(newEventName);
    }
    
    setNewEventName('');
    setIsModalOpen(false);
    loadEvents();
  };

  const handleUpdateCredentials = async (role: UserRole) => {
    setCredStatus('Saving...');
    try {
      if (role === 'admin') {
        if (!adminCreds.username) return;
        await updateCredentials('admin', adminCreds.username, adminCreds.password || undefined);
      } else if (role === 'assistant') {
        if (!assistantCreds.username) return;
        await updateCredentials('assistant', assistantCreds.username, assistantCreds.password || undefined);
      } else {
        if (!userCreds.username) return;
        await updateCredentials('user', userCreds.username, userCreds.password || undefined);
      }
      setCredStatus('Saved successfully!');
      setTimeout(() => setCredStatus(''), 2000);
    } catch (e) {
      setCredStatus('Error saving.');
    }
  };

  const handleRestore = async (id: string) => {
    await restoreEvent(id);
    loadSettingsData();
    loadEvents();
  };

  const handlePermanentDelete = (id: string) => {
    setRecycleDeleteId(id);
  };

  const executePermanentDelete = async () => {
    if (recycleDeleteId) {
      await permanentlyDeleteEvent(recycleDeleteId);
      loadSettingsData();
      setRecycleDeleteId(null);
    }
  };

  const handleApproveRequest = async (req: PendingRequest) => {
    try {
      await approveRequest(req);
      // Update state immediately for smoother UI
      setPendingRequests(prev => prev.filter(r => r.id !== req.id));
      loadEvents();
    } catch (error) {
      console.error("Failed to approve request", error);
      alert("Failed to execute request action.");
    }
  };

  const handleRejectRequest = async (id: string) => {
    // Removed confirmation dialog for immediate action
    try {
      await deleteRequest(id);
      // Immediately update UI state
      setPendingRequests(prev => prev.filter(req => req.id !== id));
      // Ensure sync
      loadRequests();
      loadUnread();
    } catch (e) {
      console.error("Failed to reject request", e);
      alert("Failed to reject request. Please try again.");
    }
  };

  // Calculate Global Stats
  let totalCollection = 0;
  let totalExpense = 0;
  let totalLoan = 0;

  const recentTransactions: any[] = [];

  events.forEach(event => {
    event.transactions.forEach(t => {
      if (t.type === 'collection') totalCollection += t.amount;
      if (t.type === 'expense') totalExpense += t.amount;
      if (t.type === 'loan') totalLoan += t.amount;
      
      // Store all transactions to show recent activity regardless of date
      recentTransactions.push({ ...t, eventName: event.name });
    });
  });

  // Sort by date descending to get most recent first
  recentTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Loan does not affect remaining balance
  const remainingBalance = totalCollection - totalExpense;

  const handleDownloadAllPDF = () => {
    const doc = new jsPDF();
    // PDF Generation Code (Same as before)
    doc.setFontSize(24);
    doc.setTextColor(0, 79, 148);
    doc.text('HMS Finance Management', 105, 20, { align: 'center' });
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Comprehensive Financial Report', 105, 30, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(108, 117, 125);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 105, 38, { align: 'center' });
    doc.setLineWidth(0.5);
    doc.setDrawColor(0, 79, 148);
    doc.line(14, 45, 196, 45);
    doc.setFontSize(14);
    doc.setTextColor(0, 79, 148);
    doc.text('Global Summary', 14, 55);
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Collection: PKR ${totalCollection.toLocaleString()}`, 14, 65);
    doc.text(`Total Expense: PKR ${totalExpense.toLocaleString()}`, 14, 72);
    doc.text(`Total Loan: PKR ${totalLoan.toLocaleString()}`, 14, 79);
    doc.text(`Remaining Balance: PKR ${remainingBalance.toLocaleString()}`, 14, 86);
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text('Detailed breakdown by event follows on subsequent pages.', 14, 100);

    events.forEach((event) => {
      doc.addPage();
      doc.setFontSize(18);
      doc.setTextColor(0, 79, 148);
      doc.text(`Event: ${event.name}`, 14, 20);
      const c = event.transactions.filter(t => t.type === 'collection').reduce((acc, t) => acc + t.amount, 0);
      const e = event.transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
      const l = event.transactions.filter(t => t.type === 'loan').reduce((acc, t) => acc + t.amount, 0);
      const b = c - e; // Balance excludes loan
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      const summaryY = 28;
      doc.text(`Collections: PKR ${c.toLocaleString()}`, 14, summaryY);
      doc.text(`Expenses: PKR ${e.toLocaleString()}`, 70, summaryY);
      doc.text(`Loans: PKR ${l.toLocaleString()}`, 120, summaryY);
      doc.text(`Balance: PKR ${b.toLocaleString()}`, 165, summaryY);
      const tableRows = event.transactions
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(t => [
          t.date,
          t.name,
          t.type === 'collection' ? t.amount.toLocaleString() : '-',
          t.type === 'expense' ? t.amount.toLocaleString() : '-',
          t.type === 'loan' ? t.amount.toLocaleString() : '-'
        ]);
      autoTable(doc, {
        startY: 35,
        head: [['Date', 'Title', 'Collection (PKR)', 'Expense (PKR)', 'Loan (PKR)']],
        body: tableRows,
        headStyles: { fillColor: [0, 79, 148], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          2: { halign: 'right', textColor: [76, 201, 240] },
          3: { halign: 'right', textColor: [220, 38, 38] },
          4: { halign: 'right', textColor: [248, 150, 30] },
        },
        styles: { lineColor: [226, 232, 240], lineWidth: 0.1, fontSize: 9 },
        theme: 'grid'
      });
    });
    doc.save('HMS_Finance_Report.pdf');
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <Header 
        user={user} 
        onLogout={onLogout} 
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenRequests={user.role === 'admin' ? handleOpenRequests : undefined}
        notificationCount={unreadCount}
        onSwitchRole={onSwitchRole}
        testingMode={testingMode}
      />

      <main className="max-w-[1200px] mx-auto px-4 py-8">
        {/* Global Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard title="Total Collection" amount={totalCollection} icon={Banknote} iconColor="text-[#4cc9f0]" />
          <StatsCard title="Total Expense" amount={totalExpense} icon={Receipt} iconColor="text-red-600" />
          <StatsCard title="Total Loan" amount={totalLoan} icon={HandCoins} iconColor="text-[#f8961e]" />
          <StatsCard title="Remaining Balance" amount={remainingBalance} icon={Wallet} iconColor="text-[#004f94]" amountColor="text-[#004f94]" />
        </div>

        {/* Events Dashboard */}
        <div className="bg-white rounded-xl shadow-sm mb-8 overflow-hidden border border-gray-100">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white">
            <h2 className="text-2xl text-[#004f94] font-bold">Event Dashboard</h2>
            <div className="flex gap-2">
              <button 
                onClick={handleDownloadAllPDF}
                className="flex items-center gap-2 bg-[#004f94] text-white px-4 py-2 rounded-lg hover:bg-[#00386b] transition-colors font-medium shadow-sm"
              >
                <Download size={18} /> Download Report
              </button>
              {(user.role === 'admin' || user.role === 'assistant') && (
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-2 bg-[#004f94] text-white px-4 py-2 rounded-lg hover:bg-[#00386b] transition-colors font-medium shadow-md"
                >
                  <Plus size={18} /> {user.role === 'assistant' ? 'Request Event' : 'Create Event'}
                </button>
              )}
            </div>
          </div>
          
          <div className="p-6">
            {loading ? (
              <div className="text-center py-10 text-[#6c757d]">Loading database...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.length === 0 && <p className="text-gray-500">No events found. Create one to get started.</p>}
                {events.map(event => {
                   const c = event.transactions.filter(t => t.type === 'collection').reduce((acc, t) => acc + t.amount, 0);
                   const e = event.transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
                   const l = event.transactions.filter(t => t.type === 'loan').reduce((acc, t) => acc + t.amount, 0);
                   const b = c - e; // Balance excludes loan

                   return (
                     <div key={event.id} className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md hover:translate-y-[-5px] transition-all duration-300 group">
                       <h3 className="text-xl font-bold text-[#004f94] mb-4 pb-2 border-b border-gray-100">{event.name}</h3>
                       <div className="flex justify-between mb-6 text-center">
                         <div>
                           <div className="text-lg font-bold text-[#4cc9f0]">{c > 1000 ? `${(c/1000).toFixed(1)}k` : c}</div>
                           <div className="text-xs text-[#6c757d] font-medium">Coll.</div>
                         </div>
                         <div>
                           <div className="text-lg font-bold text-red-600">{e > 1000 ? `${(e/1000).toFixed(1)}k` : e}</div>
                           <div className="text-xs text-[#6c757d] font-medium">Exp.</div>
                         </div>
                         <div>
                           <div className="text-lg font-bold text-[#f8961e]">{l > 1000 ? `${(l/1000).toFixed(1)}k` : l}</div>
                           <div className="text-xs text-[#6c757d] font-medium">Loan</div>
                         </div>
                         <div>
                           <div className="text-lg font-bold text-[#004f94]">{b > 1000 ? `${(b/1000).toFixed(1)}k` : b}</div>
                           <div className="text-xs text-[#6c757d] font-medium">Bal.</div>
                         </div>
                       </div>
                       <div className="flex gap-2">
                         <button 
                           onClick={() => navigate(`/event/${event.id}`)}
                           className="flex-1 py-2.5 bg-[rgba(0,79,148,0.1)] text-[#004f94] rounded-lg hover:bg-[#004f94] hover:text-white text-sm font-bold transition-all"
                         >
                           Manage Event
                         </button>
                       </div>
                     </div>
                   );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl shadow-sm mb-8 border border-gray-100">
          <div className="p-6 border-b border-gray-100 bg-white rounded-t-xl">
             <h2 className="text-xl text-[#004f94] font-bold">Recent Transactions</h2>
          </div>
          <div className="p-6">
            {recentTransactions.length === 0 ? (
              <p className="text-[#6c757d] text-center py-4">No recent transactions</p>
            ) : (
              <div className="flex flex-col">
                {recentTransactions.slice(0, 7).map((t, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors rounded-lg">
                    <div>
                      <div className="font-semibold text-[#212529]">{t.name}</div>
                      <div className="text-sm text-[#6c757d]">{t.eventName} • {new Date(t.date).toLocaleDateString()}</div>
                    </div>
                    <div className={`font-bold ${
                      t.type === 'collection' ? 'text-[#4cc9f0]' : 
                      t.type === 'expense' ? 'text-red-600' : 'text-[#f8961e]'
                    }`}>
                      {t.type === 'collection' ? '+' : '-'}PKR {t.amount.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000] backdrop-blur-sm">
          <div className="bg-white rounded-xl p-8 w-[90%] max-w-[500px] shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-[#004f94]">{user.role === 'assistant' ? 'Request Event' : 'Create New Event'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="mb-6">
              <label className="block font-semibold mb-1 text-[#212529]">Event Name</label>
              <input 
                type="text" 
                className="w-full p-3 border border-gray-300 bg-gray-50 text-gray-900 rounded-lg focus:bg-white focus:border-[#004f94] focus:ring-2 focus:ring-[#004f94] focus:ring-opacity-20 outline-none transition-all"
                placeholder="Enter event name"
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-4">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateEvent}
                className="px-6 py-2 bg-[#004f94] text-white rounded-lg font-bold shadow-lg hover:bg-[#00386b] transition-colors"
              >
                {user.role === 'assistant' ? 'Send Request' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Requests Modal (Approval Center) */}
      {isRequestsOpen && user.role === 'admin' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000] backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl w-full max-w-[700px] shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b bg-gray-50">
               <h3 className="text-2xl font-bold text-[#004f94]">Pending Approvals</h3>
               <button onClick={() => setIsRequestsOpen(false)} className="text-gray-400 hover:text-red-600 transition-colors">
                 <X size={24} />
               </button>
            </div>
            <div className="p-0 overflow-y-auto flex-1">
              {pendingRequests.length === 0 ? (
                 <div className="text-center py-12 text-gray-500">
                   <p>No pending requests.</p>
                   <p className="text-sm mt-2">Actions taken by the Assistant will appear here.</p>
                 </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {pendingRequests.map((req) => (
                    <div key={req.id} className="p-6 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="font-bold text-[#212529] text-lg mb-1">{req.description}</div>
                          <div className="text-sm text-gray-500 flex gap-2 items-center flex-wrap">
                             <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs uppercase font-bold">{req.type.replace('_', ' ')}</span>
                             <span>Requested by <span className="font-semibold text-gray-700">{req.requestedBy}</span></span>
                             <span className="text-gray-300">•</span>
                             <span>{new Date(req.timestamp).toLocaleString()}</span>
                          </div>
                          {req.type.includes('transaction') && req.data.transaction && (
                             <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded text-sm">
                               <div className="grid grid-cols-2 gap-4">
                                 <div>
                                   <span className="text-[#212529] font-semibold block mb-1">Amount:</span> 
                                   <strong className="text-[#212529] text-lg">PKR {req.data.transaction.amount.toLocaleString()}</strong>
                                 </div>
                                 <div>
                                   <span className="text-[#212529] font-semibold block mb-1">Type:</span> 
                                   <span className={`uppercase font-bold px-2 py-1 rounded text-xs ${
                                     req.data.transaction.type === 'collection' ? 'bg-cyan-100 text-cyan-800' :
                                     req.data.transaction.type === 'expense' ? 'bg-red-100 text-red-800' :
                                     'bg-orange-100 text-orange-800'
                                   }`}>
                                     {req.data.transaction.type}
                                   </span>
                                 </div>
                               </div>
                             </div>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-end gap-3 mt-4">
                         <button 
                           type="button"
                           onClick={(e) => {
                             e.stopPropagation();
                             handleRejectRequest(req.id);
                           }}
                           className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold text-sm transition-colors shadow-md"
                         >
                           Reject
                         </button>
                         <button 
                           type="button"
                           onClick={(e) => {
                             e.stopPropagation();
                             handleApproveRequest(req);
                           }}
                           className="px-4 py-2 bg-[#004f94] text-white rounded-lg hover:bg-[#00386b] font-semibold text-sm transition-colors flex items-center gap-2 shadow-md"
                         >
                           <Check size={16} /> Approve
                         </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000] backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl w-full max-w-[600px] shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-2xl font-bold text-[#004f94]">Settings</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-red-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex border-b">
              <button 
                onClick={() => setSettingsTab('general')}
                className={`flex-1 py-3 font-semibold text-sm transition-colors ${settingsTab === 'general' ? 'text-[#004f94] border-b-2 border-[#004f94]' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                Account Management
              </button>
              <button 
                onClick={() => setSettingsTab('recycle')}
                className={`flex-1 py-3 font-semibold text-sm transition-colors ${settingsTab === 'recycle' ? 'text-[#004f94] border-b-2 border-[#004f94]' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                Recycle Bin
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {settingsTab === 'general' ? (
                <div className="space-y-8">
                  {/* Testing Mode Settings */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="font-bold text-[#004f94] mb-4 flex items-center gap-2">
                      <FlaskConical size={18} /> Testing Mode
                    </h4>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[#212529]">Enable Role Switching</div>
                        <div className="text-xs text-[#6c757d] mt-1">
                          Allows you to switch between Admin, Assistant, and User views to verify permissions and UI.
                        </div>
                      </div>
                      <button
                        onClick={onToggleTestingMode}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${testingMode ? 'bg-[#004f94]' : 'bg-gray-300'}`}
                      >
                        <span
                          className={`${testingMode ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Admin Settings */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="font-bold text-[#004f94] mb-4 flex items-center gap-2">
                      <UserIcon size={18} /> Update Admin Credentials
                    </h4>
                    <div className="space-y-3">
                       <div>
                         <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Username</label>
                         <input 
                           type="text" 
                           className="w-full p-3 border border-gray-300 bg-gray-50 text-gray-900 rounded-lg focus:bg-white focus:border-[#004f94] focus:ring-2 focus:ring-[#004f94] focus:ring-opacity-20 outline-none transition-all"
                           value={adminCreds.username}
                           onChange={(e) => setAdminCreds({...adminCreds, username: e.target.value})}
                         />
                       </div>
                       <div>
                         <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">New Password (Optional)</label>
                         <input 
                           type="password" 
                           className="w-full p-3 border border-gray-300 bg-gray-50 text-gray-900 rounded-lg focus:bg-white focus:border-[#004f94] focus:ring-2 focus:ring-[#004f94] focus:ring-opacity-20 outline-none transition-all"
                           placeholder="Leave blank to keep current"
                           value={adminCreds.password}
                           onChange={(e) => setAdminCreds({...adminCreds, password: e.target.value})}
                         />
                       </div>
                       <div className="flex justify-end mt-2">
                          <button 
                            onClick={() => handleUpdateCredentials('admin')}
                            className="bg-[#004f94] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#00386b] transition-colors"
                          >
                            Update Admin
                          </button>
                       </div>
                    </div>
                  </div>

                  {/* Assistant Settings */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="font-bold text-[#004f94] mb-4 flex items-center gap-2">
                      <UserIcon size={18} /> Update Assistant Credentials
                    </h4>
                    <div className="space-y-3">
                       <div>
                         <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Username</label>
                         <input 
                           type="text" 
                           className="w-full p-3 border border-gray-300 bg-gray-50 text-gray-900 rounded-lg focus:bg-white focus:border-[#004f94] focus:ring-2 focus:ring-[#004f94] focus:ring-opacity-20 outline-none transition-all"
                           value={assistantCreds.username}
                           onChange={(e) => setAssistantCreds({...assistantCreds, username: e.target.value})}
                         />
                       </div>
                       <div>
                         <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">New Password (Optional)</label>
                         <input 
                           type="password" 
                           className="w-full p-3 border border-gray-300 bg-gray-50 text-gray-900 rounded-lg focus:bg-white focus:border-[#004f94] focus:ring-2 focus:ring-[#004f94] focus:ring-opacity-20 outline-none transition-all"
                           placeholder="Leave blank to keep current"
                           value={assistantCreds.password}
                           onChange={(e) => setAssistantCreds({...assistantCreds, password: e.target.value})}
                         />
                       </div>
                       <div className="flex justify-end mt-2">
                          <button 
                            onClick={() => handleUpdateCredentials('assistant')}
                            className="bg-[#004f94] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#00386b] transition-colors"
                          >
                            Update Assistant
                          </button>
                       </div>
                    </div>
                  </div>

                  {/* User Settings */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="font-bold text-[#004f94] mb-4 flex items-center gap-2">
                      <UserIcon size={18} /> Update User Credentials
                    </h4>
                    <div className="space-y-3">
                       <div>
                         <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Username</label>
                         <input 
                           type="text" 
                           className="w-full p-3 border border-gray-300 bg-gray-50 text-gray-900 rounded-lg focus:bg-white focus:border-[#004f94] focus:ring-2 focus:ring-[#004f94] focus:ring-opacity-20 outline-none transition-all"
                           value={userCreds.username}
                           onChange={(e) => setUserCreds({...userCreds, username: e.target.value})}
                         />
                       </div>
                       <div>
                         <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">New Password (Optional)</label>
                         <input 
                           type="password" 
                           className="w-full p-3 border border-gray-300 bg-gray-50 text-gray-900 rounded-lg focus:bg-white focus:border-[#004f94] focus:ring-2 focus:ring-[#004f94] focus:ring-opacity-20 outline-none transition-all"
                           placeholder="Leave blank to keep current"
                           value={userCreds.password}
                           onChange={(e) => setUserCreds({...userCreds, password: e.target.value})}
                         />
                       </div>
                       <div className="flex justify-end mt-2">
                          <button 
                            onClick={() => handleUpdateCredentials('user')}
                            className="bg-[#004f94] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#00386b] transition-colors"
                          >
                            Update User
                          </button>
                       </div>
                    </div>
                  </div>

                  {credStatus && (
                    <div className={`p-3 rounded text-center text-sm font-bold ${credStatus.includes('Error') ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                      {credStatus}
                    </div>
                  )}
                </div>
              ) : (
                /* Recycle Bin Tab */
                <div className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex items-start gap-3">
                    <RotateCcw className="text-yellow-600 shrink-0 mt-1" size={20} />
                    <div className="text-sm text-yellow-800">
                      <p className="font-bold mb-1">Deleted Events</p>
                      <p>Events here are hidden from the dashboard but can be restored. Permanently deleting them removes all associated data forever.</p>
                    </div>
                  </div>
                  
                  {deletedEvents.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 italic">Recycle bin is empty</div>
                  ) : (
                    <div className="space-y-3">
                      {deletedEvents.map(evt => (
                        <div key={evt.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <div>
                            <div className="font-bold text-[#212529]">{evt.name}</div>
                            <div className="text-xs text-gray-500">{evt.transactions.length} transactions</div>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleRestore(evt.id)}
                              className="p-2 text-[#004f94] hover:bg-blue-100 rounded transition-colors"
                              title="Restore"
                            >
                              <RotateCcw size={18} />
                            </button>
                            <button 
                              onClick={() => handlePermanentDelete(evt.id)}
                              className="p-2 text-red-600 hover:bg-red-100 rounded transition-colors"
                              title="Permanently Delete"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Modal Footer (if needed, currently mostly inside scroll area) */}
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Modal */}
      {recycleDeleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1100] backdrop-blur-sm">
          <div className="bg-white rounded-lg p-8 w-[90%] max-w-[400px] shadow-xl text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="text-red-600" size={32} />
            </div>
            <h3 className="text-xl font-bold text-[#004f94] mb-2">Permanently Delete?</h3>
            <p className="text-[#6c757d] mb-6">
              This action cannot be undone. All transactions associated with this event will be lost forever.
            </p>
            <div className="flex justify-center gap-4">
              <button 
                onClick={() => setRecycleDeleteId(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={executePermanentDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold shadow-md"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};