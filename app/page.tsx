'use client';

import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Trash2, 
  Plus, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  MapPin,
  Tag,
  Loader2,
  Building2,
  ChevronDown,
  ChevronUp,
  RotateCw,
  LogOut,
  Lock,
  User
} from 'lucide-react';

export default function StockDashboard() {
  // Auth State
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState<string | null>(null);
  const [loginUserInput, setLoginUserInput] = useState('');
  const [loginPassInput, setLoginPassInput] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Dashboard State
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});

  // Loading States
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingCustomer, setSyncingCustomer] = useState<Record<string, boolean>>({});

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [newOppNumber, setNewOppNumber] = useState('');
  const [loading, setLoading] = useState(false);

  // เช็กว่ามี Session ล็อกอินค้างไว้ไหมเมื่อเปิดเว็บ
  useEffect(() => {
    const savedUser = localStorage.getItem('ctc_user');
    const savedPass = localStorage.getItem('ctc_pass');
    if (savedUser && savedPass) {
      setCurrentUser(savedUser);
      setCurrentPassword(savedPass);
      fetchDashboardData(savedUser);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUserInput || !loginPassInput) return alert('กรุณากรอก Username และ Password');

    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUserInput.trim(), password: loginPassInput.trim() })
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('ctc_user', loginUserInput.trim());
        localStorage.setItem('ctc_pass', loginPassInput.trim());
        setCurrentUser(loginUserInput.trim());
        setCurrentPassword(loginPassInput.trim());
        fetchDashboardData(loginUserInput.trim());
      } else {
        alert(`ล็อกอินไม่สำเร็จ: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
      localStorage.removeItem('ctc_user');
      localStorage.removeItem('ctc_pass');
      setCurrentUser(null);
      setCurrentPassword(null);
      setCustomers([]);
    }
  };

  const fetchDashboardData = async (username: string) => {
    try {
      const res = await fetch(`/api/get-opps?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      if (data.success) {
        setCustomers(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch Customers:', err);
    }
  };

  const toggleExpand = (custName: string) => {
    setExpandedCustomers(prev => ({ ...prev, [custName]: !prev[custName] }));
  };

  const handleResyncSingle = async (custName: string) => {
    if (!currentUser || !currentPassword) return;

    setSyncingCustomer(prev => ({ ...prev, [custName]: true }));
    try {
      const res = await fetch('/api/resync-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: custName,
          stockUsername: currentUser,
          stockPassword: currentPassword
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`อัปเดตสต็อกสดเรียบร้อย! พบ ${data.count} รายการสำหรับ ${custName}`);
        fetchDashboardData(currentUser);
      } else {
        alert(`เกิดข้อผิดพลาด: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSyncingCustomer(prev => ({ ...prev, [custName]: false }));
    }
  };

  const handleResyncAll = async () => {
    if (customers.length === 0) return alert('ไม่มีรายการลูกค้าในระบบของคุณ');
    if (!currentUser || !currentPassword) return;

    setSyncingAll(true);
    let successCount = 0;

    for (const cust of customers) {
      try {
        const res = await fetch('/api/resync-customer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: cust.customerName,
            stockUsername: currentUser,
            stockPassword: currentPassword
          })
        });
        const data = await res.json();
        if (data.success) successCount++;
      } catch (err) {
        console.error(err);
      }
    }

    setSyncingAll(false);
    alert(`อัปเดตสต็อกสดเสร็จสิ้น (${successCount}/${customers.length} ไซท์)`);
    fetchDashboardData(currentUser);
  };

  const handleAddOpp = async () => {
    if (!customerName) return alert('กรุณากรอกชื่อลูกค้า / โครงการ');
    if (!currentUser || !currentPassword) return;

    setLoading(true);
    try {
      const res = await fetch('/api/sync-opp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          customerName: customerName.trim(),
          oppNumber: newOppNumber.trim(), 
          stockUsername: currentUser,
          stockPassword: currentPassword
        })
      });

      const data = await res.json();
      if (data.success) {
        alert(`ดึงข้อมูลสำเร็จ! พบสินค้า ${data.totalItemsFound} รายการสำหรับลูกค้า ${customerName}`);
        setIsModalOpen(false);
        setCustomerName('');
        setNewOppNumber('');
        fetchDashboardData(currentUser);
      } else {
        alert(`เกิดข้อผิดพลาด: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomer = async (custName: string) => {
    if (confirm(`คุณต้องการลบลูกค้า "${custName}" ออกจากระบบของคุณหรือไม่?`)) {
      try {
        const res = await fetch('/api/delete-opp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerName: custName })
        });
        if ((await res.json()).success && currentUser) {
          fetchDashboardData(currentUser);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const getStatusBadge = (qty: number) => {
    if (qty > 1) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" /> พร้อมใช้งาน ({qty})
        </span>
      );
    } else if (qty === 1) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="w-3.5 h-3.5" /> เหลือ 1 ชิ้น
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle className="w-3.5 h-3.5" /> ของหมด (0)
        </span>
      );
    }
  };

  const filteredCustomers = customers.filter(cust => {
    const term = searchTerm.toLowerCase();
    const matchCustomer = cust.customerName.toLowerCase().includes(term);
    const matchOpp = cust.oppNumbers.some((opp: string) => opp.toLowerCase().includes(term));
    const matchItem = cust.items.some((item: any) => 
      item.item_name.toLowerCase().includes(term) || 
      item.stock_code.toLowerCase().includes(term) ||
      (item.remark && item.remark.toLowerCase().includes(term))
    );
    return matchCustomer || matchOpp || matchItem;
  });

  // 🔒 ถ้ายังไม่ได้ล็อกอิน ให้โชว์หน้า Login หน้าแรก
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-xl border border-slate-200/80">
          <div className="text-center mb-8">
            <div className="bg-blue-600 w-12 h-12 rounded-2xl text-white flex items-center justify-center mx-auto mb-4 shadow-md shadow-blue-200">
              <Package className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">เข้าสู่ระบบ CTC Stock</h1>
            <p className="text-xs text-slate-500 mt-1">ใช้ Username & Password เดียวกับระบบสต็อก CTC เดิม</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" /> ชื่อผู้ใช้ (Username)
              </label>
              <input 
                type="text"
                placeholder="เช่น issarase.l"
                value={loginUserInput}
                onChange={(e) => setLoginUserInput(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-slate-400" /> รหัสผ่าน (Password)
              </label>
              <input 
                type="password"
                placeholder="••••••••"
                value={loginPassInput}
                onChange={(e) => setLoginPassInput(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <button 
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-blue-200 transition-all active:scale-98 disabled:opacity-50"
            >
              {isLoggingIn && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isLoggingIn ? 'กำลังเข้าสู่ระบบ & ยืนยันรหัส...' : 'เข้าสู่ระบบ'}</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 🔓 ถ้าล็อกอินแล้ว โชว์หน้า Dashboard
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white shadow-sm">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Customer Stock Monitor</h1>
              <p className="text-xs text-slate-500">ระบบจัดการสต็อกส่วนตัวสำหรับผู้ใช้งาน</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-full text-xs font-medium text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{currentUser}</span>
            </div>

            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-slate-100 transition-colors"
              title="ออกจากระบบ"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-sm shadow-blue-200 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่ม OPP / ลูกค้าใหม่</span>
            </button>
            
            <button 
              onClick={handleResyncAll}
              disabled={syncingAll}
              className="flex items-center justify-center space-x-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              <RotateCw className={`w-4 h-4 text-blue-600 ${syncingAll ? 'animate-spin' : ''}`} />
              <span>{syncingAll ? 'กำลังดึงสต็อกสดทุกไซท์...' : 'ดึงสต็อกสดทั้งหมด'}</span>
            </button>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="ค้นหาชื่อลูกค้า, OPP, อะไหล่..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 shadow-sm"
            />
          </div>
        </div>

        <div className="space-y-6">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80 text-slate-400">
              <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-600">ไม่พบรายการลูกค้าของคุณ ({currentUser})</p>
              <p className="text-xs text-slate-400 mt-1">กดปุ่ม "เพิ่ม OPP / ลูกค้าใหม่" ด้านบนเพื่อเริ่มติดตามสต็อก</p>
            </div>
          ) : (
            filteredCustomers.map((cust) => {
              const isExpanded = expandedCustomers[cust.customerName] || false;
              const topItems = cust.items.slice(0, 3);
              const extraItems = cust.items.slice(3);
              const hasMore = extraItems.length > 0;
              const isSingleSyncing = syncingCustomer[cust.customerName] || false;

              return (
                <div key={cust.customerName} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden transition-all">
                  
                  <div className="bg-slate-50/80 border-b border-slate-100 px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <div className="bg-blue-100 p-2 rounded-lg text-blue-700">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-slate-800">{cust.customerName}</h2>
                          <span className="text-xs text-slate-400 font-medium bg-slate-200/60 px-2 py-0.5 rounded-full">
                            รวม {cust.items.length} รายการ
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[11px] text-slate-400">ผูกกับ OPP:</span>
                          {cust.oppNumbers.map((opp: string) => (
                            <span key={opp} className="bg-slate-200/80 text-slate-700 font-mono text-[11px] px-2 py-0.5 rounded font-medium">
                              {opp}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button 
                        onClick={() => handleResyncSingle(cust.customerName)}
                        disabled={isSingleSyncing}
                        className="p-2 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-white transition-colors"
                        title="ดึงสต็อกสดเฉพาะลูกค้ารายนี้"
                      >
                        <RotateCw className={`w-4 h-4 ${isSingleSyncing ? 'animate-spin text-blue-600' : ''}`} />
                      </button>

                      <button 
                        onClick={() => handleDeleteCustomer(cust.customerName)}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition-colors"
                        title="ลบลูกค้านี้ออกจากการดูแลของคุณ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400 font-semibold bg-slate-50/30">
                          <th className="py-3 px-6">รายการสินค้า / อะไหล่</th>
                          <th className="py-3 px-4">เลข OPP</th>
                          <th className="py-3 px-4">STOCK CODE</th>
                          <th className="py-3 px-4">LOCATION</th>
                          <th className="py-3 px-4 text-center">สถานะคงเหลือ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {topItems.map((item: any) => (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-6 max-w-xs sm:max-w-md">
                              <div className="font-medium text-slate-900 leading-snug">{item.item_name}</div>
                              {item.remark && (
                                <div className="text-xs text-slate-400 mt-1 flex items-center gap-1 max-w-sm truncate">
                                  <Tag className="w-3 h-3 flex-shrink-0 text-slate-300" />
                                  <span className="truncate">{item.remark}</span>
                                </div>
                              )}
                            </td>
                            <td className="py-4 px-4 font-mono text-xs font-semibold text-blue-600">
                              {item.opp_number}
                            </td>
                            <td className="py-4 px-4 font-mono text-xs text-slate-600">
                              {item.stock_code}
                            </td>
                            <td className="py-4 px-4">
                              <div className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                {item.location || '-'}
                              </div>
                            </td>
                            <td className="py-4 px-4 text-center">
                              {getStatusBadge(item.quantity)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {hasMore && (
                      <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="overflow-hidden">
                          <table className="w-full text-left border-collapse">
                            <tbody className="divide-y divide-slate-100 text-sm border-t border-slate-100">
                              {extraItems.map((item: any) => (
                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-4 px-6 max-w-xs sm:max-w-md">
                                    <div className="font-medium text-slate-900 leading-snug">{item.item_name}</div>
                                    {item.remark && (
                                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-1 max-w-sm truncate">
                                        <Tag className="w-3 h-3 flex-shrink-0 text-slate-300" />
                                        <span className="truncate">{item.remark}</span>
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-4 px-4 font-mono text-xs font-semibold text-blue-600">
                                    {item.opp_number}
                                  </td>
                                  <td className="py-4 px-4 font-mono text-xs text-slate-600">
                                    {item.stock_code}
                                  </td>
                                  <td className="py-4 px-4">
                                    <div className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                                      <MapPin className="w-3 h-3 text-slate-400" />
                                      {item.location || '-'}
                                    </div>
                                  </td>
                                  <td className="py-4 px-4 text-center">
                                    {getStatusBadge(item.quantity)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {hasMore && (
                    <div className="bg-slate-50/50 border-t border-slate-100 px-6 py-2.5 text-center">
                      <button 
                        onClick={() => toggleExpand(cust.customerName)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors py-1 px-3 rounded-lg hover:bg-blue-50"
                      >
                        <span>{isExpanded ? 'ย่อเก็บรายการ' : `แสดงเพิ่มเติม (อีก ${extraItems.length} รายการ)`}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Modal เพิ่มลูกค้าใหม่ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-1">➕ เพิ่ม OPP / ลูกค้าใหม่</h3>
            <p className="text-xs text-slate-500 mb-5">
              ใส่ชื่อลูกค้า และ เลข OPP เพื่อดึงสต็อกสดมาไว้ในรายการดูแลของคุณ ({currentUser})
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อลูกค้า / โครงการ</label>
                <input 
                  type="text"
                  placeholder="เช่น ธรรมศาสตร์, Siam Daikin"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เลข OPP <span className="text-slate-400 font-normal">(ระบุหรือไม่ก็ได้)</span>
                </label>
                <input 
                  type="text"
                  placeholder="เช่น 690076"
                  value={newOppNumber}
                  onChange={(e) => setNewOppNumber(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                  disabled={loading}
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={handleAddOpp}
                  disabled={loading}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{loading ? 'กำลังดึงสต็อกสด...' : '📥 ดึงข้อมูล'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}