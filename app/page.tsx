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
  User,
  SlidersHorizontal,
  Minus,
  Check,
  ArrowUpDown
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
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'items_desc' | 'items_asc'>('name_asc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});

  // Threshold Modal State
  const [thresholdModalOpen, setThresholdModalOpen] = useState(false);
  const [selectedItemForThreshold, setSelectedItemForThreshold] = useState<any>(null);
  const [newMinStockValue, setNewMinStockValue] = useState<number>(2);
  const [isUpdatingThreshold, setIsUpdatingThreshold] = useState(false);

  // 🗑️ Delete Confirmation Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Alert Notification Modal State
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [resultModalData, setResultModalData] = useState<{ title: string; message: string; isSuccess: boolean }>({
    title: '',
    message: '',
    isSuccess: true
  });

  // Loading States
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingCustomer, setSyncingCustomer] = useState<Record<string, boolean>>({});

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [newOppNumber, setNewOppNumber] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('ctc_user');
    const savedPass = localStorage.getItem('ctc_pass');
    if (savedUser && savedPass) {
      setCurrentUser(savedUser);
      setCurrentPassword(savedPass);
      fetchDashboardData(savedUser);
    }
  }, []);

  const showResultModal = (title: string, message: string, isSuccess = true) => {
    setResultModalData({ title, message, isSuccess });
    setResultModalOpen(true);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUserInput || !loginPassInput) return showResultModal('แจ้งเตือน', 'กรุณากรอก Username และ Password', false);

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
        showResultModal('ล็อกอินไม่สำเร็จ', data.error || 'โปรดตรวจสอบรหัสผ่านอีกครั้ง', false);
      }
    } catch (err: any) {
      showResultModal('เกิดข้อผิดพลาด', err.message, false);
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

  const openThresholdModal = (item: any) => {
    setSelectedItemForThreshold(item);
    setNewMinStockValue(item.min_stock ?? 2);
    setThresholdModalOpen(true);
  };

  const handleSaveThreshold = async () => {
    if (!selectedItemForThreshold) return;

    if (isNaN(newMinStockValue) || newMinStockValue < 1) {
      return showResultModal('แจ้งเตือน', 'กรุณากรอกตัวเลขจำนวนขั้นต่ำที่ถูกต้อง (อย่างน้อย 1 ชิ้น)', false);
    }

    setIsUpdatingThreshold(true);
    try {
      const res = await fetch('/api/update-threshold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: selectedItemForThreshold.id, minStock: newMinStockValue }),
      });
      const data = await res.json();
      if (data.success) {
        setThresholdModalOpen(false);
        if (currentUser) fetchDashboardData(currentUser);
        showResultModal('บันทึกสำเร็จ', 'อัปเดตเกณฑ์สต็อกคงเหลือเรียบร้อยแล้ว');
      } else {
        showResultModal('เกิดข้อผิดพลาด', data.error || 'ไม่สามารถอัปเดตเกณฑ์ได้', false);
      }
    } catch (err: any) {
      showResultModal('เกิดข้อผิดพลาด', err.message, false);
    } finally {
      setIsUpdatingThreshold(false);
    }
  };

  const handleResyncCustomer = async (custName: string) => {
    const username = currentUser || localStorage.getItem('ctc_user') || 'issarase.l';
    setSyncingCustomer(prev => ({ ...prev, [custName]: true }));

    try {
      const res = await fetch('/api/resync-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: username,
          customerName: custName,
        })
      });

      const data = await res.json();
      if (data.success) {
        const count = data.totalItemsFound ?? data.count ?? data.updatedCount ?? 0;
        showResultModal('อัปเดตสต็อกสดเรียบร้อย!', `พบ ${count} รายการสำหรับ ${custName}`);
        fetchDashboardData(username);
      } else {
        showResultModal('เกิดข้อผิดพลาด', data.error, false);
      }
    } catch (err: any) {
      showResultModal('เกิดข้อผิดพลาด', err.message, false);
    } finally {
      setSyncingCustomer(prev => ({ ...prev, [custName]: false }));
    }
  };

  const handleResyncAll = async () => {
    if (customers.length === 0) return showResultModal('แจ้งเตือน', 'ไม่มีรายการลูกค้าในระบบของคุณ', false);
    if (!currentUser) return;

    setSyncingAll(true);

    try {
      const fetchPromises = customers.map(cust => 
        fetch('/api/resync-customer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: currentUser,
            customerName: cust.customerName,
          })
        }).then(res => res.json()).catch(() => ({ success: false }))
      );

      const results = await Promise.all(fetchPromises);
      const successCount = results.filter(r => r.success).length;

      showResultModal('ดึงสต็อกสดเรียบร้อยแล้ว!', `อัปเดตข้อมูลเสร็จสิ้น (${successCount}/${customers.length} ไซท์)`);
      fetchDashboardData(currentUser);
    } catch (err: any) {
      showResultModal('เกิดข้อผิดพลาด', err.message, false);
    } finally {
      setSyncingAll(false);
    }
  };

  const handleAddOpp = async () => {
    if (!customerName) return showResultModal('แจ้งเตือน', 'กรุณากรอกชื่อลูกค้า / โครงการ', false);
    const username = currentUser || localStorage.getItem('ctc_user') || 'issarase.l';

    setLoading(true);
    try {
      const res = await fetch('/api/sync-opp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: username,
          customerName: customerName.trim(),
          oppNumber: newOppNumber.trim(),
        })
      });

      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        setCustomerName('');
        setNewOppNumber('');
        fetchDashboardData(username);
        showResultModal('ดึงข้อมูลสำเร็จ!', `พบสินค้า ${data.totalItemsFound || 0} รายการสำหรับลูกค้า ${customerName}`);
      } else {
        showResultModal('เกิดข้อผิดพลาด', data.error, false);
      }
    } catch (err: any) {
      showResultModal('เกิดข้อผิดพลาด', err.message, false);
    } finally {
      setLoading(false);
    }
  };

  // 🎯 เปิด Pop-up ยืนยันการลบ
  const handleDeleteCustomer = (custName: string) => {
    setCustomerToDelete(custName);
    setDeleteModalOpen(true);
  };

  // 🎯 กดยืนยันการลบจริง
  const confirmDeleteCustomer = async () => {
    if (!customerToDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch('/api/delete-opp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: customerToDelete, username: currentUser })
      });
      
      const data = await res.json();
      if (data.success && currentUser) {
        setDeleteModalOpen(false);
        fetchDashboardData(currentUser);
        showResultModal('ลบสำเร็จ', `ลบลูกค้า "${customerToDelete}" ออกจากรายการดูแลเรียบร้อยแล้ว`);
      } else {
        showResultModal('เกิดข้อผิดพลาด', data.error || 'ไม่สามารถลบข้อมูลได้', false);
      }
    } catch (err: any) {
      showResultModal('เกิดข้อผิดพลาด', err.message, false);
    } finally {
      setIsDeleting(false);
      setCustomerToDelete(null);
    }
  };

  const getStatusBadge = (item: any) => {
    const qty = item.quantity || 0;
    const minStock = item.min_stock ?? 2;

    if (qty >= minStock) {
      return (
        <button
          onClick={() => openThresholdModal(item)}
          title={`เกณฑ์ปัจจุบัน: ${minStock} ชิ้นขึ้นไป (คลิกเพื่อปรับตั้งค่า)`}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all active:scale-95 cursor-pointer shadow-2xs"
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> พร้อมใช้งาน ({qty})
        </button>
      );
    } else if (qty > 0) {
      return (
        <button
          onClick={() => openThresholdModal(item)}
          title={`ต่ำกว่าเกณฑ์ความปลอดภัย (${minStock} ชิ้น) คลิกเพื่อปรับตั้งค่า`}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all active:scale-95 cursor-pointer shadow-2xs"
        >
          <AlertTriangle className="w-3.5 h-3.5" /> เหลือ {qty} ชิ้น
        </button>
      );
    } else {
      return (
        <button
          onClick={() => openThresholdModal(item)}
          title="ของหมด (คลิกเพื่อปรับตั้งค่า)"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-all active:scale-95 cursor-pointer shadow-2xs"
        >
          <XCircle className="w-3.5 h-3.5" /> ของหมด (0)
        </button>
      );
    }
  };

  const processedCustomers = customers
    .filter(cust => {
      const term = searchTerm.toLowerCase();
      const matchCustomer = cust.customerName?.toLowerCase().includes(term);
      const matchOpp = cust.oppNumbers?.some((opp: string) => opp.toLowerCase().includes(term));
      const matchItem = cust.items?.some((item: any) => 
        item.item_name?.toLowerCase().includes(term) || 
        item.stock_code?.toLowerCase().includes(term) ||
        (item.remark && item.remark.toLowerCase().includes(term))
      );
      return matchCustomer || matchOpp || matchItem;
    })
    .sort((a, b) => {
      if (sortBy === 'name_asc') {
        return a.customerName.localeCompare(b.customerName, 'th');
      } else if (sortBy === 'name_desc') {
        return b.customerName.localeCompare(a.customerName, 'th');
      } else if (sortBy === 'items_desc') {
        return (b.items?.length || 0) - (a.items?.length || 0);
      } else if (sortBy === 'items_asc') {
        return (a.items?.length || 0) - (b.items?.length || 0);
      }
      return 0;
    });

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
              <span>{isLoggingIn ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

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

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative">
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 shadow-sm">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="bg-transparent focus:outline-none cursor-pointer pr-1 text-slate-700"
                >
                  <option value="name_asc">ชื่อลูกค้า (ก - ฮ)</option>
                  <option value="name_desc">ชื่อลูกค้า (ฮ - ก)</option>
                  <option value="items_desc">จำนวนสินค้า (มาก ➔ น้อย)</option>
                  <option value="items_asc">จำนวนสินค้า (น้อย ➔ มาก)</option>
                </select>
              </div>
            </div>

            <div className="relative w-full sm:w-72">
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
        </div>

        <div className="space-y-6">
          {processedCustomers.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80 text-slate-400">
              <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-600">ไม่พบรายการลูกค้าของคุณ ({currentUser})</p>
              <p className="text-xs text-slate-400 mt-1">กดปุ่ม "เพิ่ม OPP / ลูกค้าใหม่" ด้านบนเพื่อเริ่มติดตามสต็อก</p>
            </div>
          ) : (
            processedCustomers.map((cust) => {
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
                          {cust.oppNumbers?.map((opp: string) => (
                            <span key={opp} className="bg-slate-200/80 text-slate-700 font-mono text-[11px] px-2 py-0.5 rounded font-medium">
                              {opp}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button 
                        onClick={() => handleResyncCustomer(cust.customerName)}
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
                          <th className="py-3 px-4 text-center">สถานะคงเหลือ (คลิกเพื่อปรับเกณฑ์)</th>
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
                              {item.opp_number || 'N/A'}
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
                              {getStatusBadge(item)}
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
                                    {item.opp_number || 'N/A'}
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
                                    {getStatusBadge(item)}
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
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

      {/* Threshold Modal */}
      {thresholdModalOpen && selectedItemForThreshold && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-50 p-2.5 rounded-2xl text-blue-600">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">ตั้งค่าเกณฑ์คงเหลือปลอดภัย</h3>
                <p className="text-xs text-slate-500">สำหรับแจ้งเตือนสถานะสีเขียว</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl mb-5 border border-slate-100">
              <p className="text-xs font-semibold text-slate-800 line-clamp-2 leading-relaxed">
                {selectedItemForThreshold.item_name}
              </p>
              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500 font-mono">
                <span>Code: {selectedItemForThreshold.stock_code}</span>
                <span>•</span>
                <span>มีอยู่จริง: {selectedItemForThreshold.quantity} ชิ้น</span>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <label className="block text-xs font-semibold text-slate-700 text-center">
                จำนวนขั้นต่ำปลอดภัย (ชิ้น)
              </label>
              
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setNewMinStockValue(prev => Math.max(1, prev - 1))}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors active:scale-95"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <input
                  type="number"
                  min="1"
                  value={newMinStockValue}
                  onChange={(e) => setNewMinStockValue(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 text-center text-xl font-bold py-2 bg-slate-50 border border-slate-200 rounded-xl text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />

                <button
                  type="button"
                  onClick={() => setNewMinStockValue(prev => prev + 1)}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[11px] text-slate-400 text-center mt-1">
                หากมีของตั้งเเต่ <span className="font-semibold text-emerald-600">{newMinStockValue} ชิ้นขึ้นไป</span> จะขึ้นสีเขียว "พร้อมใช้งาน"
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setThresholdModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
                disabled={isUpdatingThreshold}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveThreshold}
                disabled={isUpdatingThreshold}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50"
              >
                {isUpdatingThreshold && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>บันทึกเกณฑ์</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🎨 🗑️ Custom Delete Confirmation Modal */}
      {deleteModalOpen && customerToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 mx-auto mb-4 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900 mb-1">
              ยืนยันการลบลูกค้า?
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              คุณต้องการลบลูกค้า <span className="font-bold text-slate-800">"{customerToDelete}"</span> ออกจากรายการดูแลของคุณหรือไม่?
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setCustomerToDelete(null);
                }}
                disabled={isDeleting}
                className="w-1/2 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmDeleteCustomer}
                disabled={isDeleting}
                className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDeleting ? 'กำลังลบ...' : 'ยืนยันลบ'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {resultModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 text-center">
            <div className={`w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center ${
              resultModalData.isSuccess ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            }`}>
              {resultModalData.isSuccess ? <Check className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>

            <h3 className="text-base font-bold text-slate-900 mb-1">
              {resultModalData.title}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              {resultModalData.message}
            </p>

            <button
              onClick={() => setResultModalOpen(false)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all active:scale-95 shadow-sm"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}
    </div>
  );
}