'use client';

import { useState } from 'react';
import { Download, Upload, Loader2 } from 'lucide-react';

interface ExcelUploaderProps {
  onSuccess?: () => void;
}

export default function ExcelUploader({ onSuccess }: ExcelUploaderProps) {
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const username = localStorage.getItem('ctc_user') || 'issarase.l';

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('username', username);

    try {
      const res = await fetch('/api/projects/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        alert(`🎉 ${data.message}`);
        if (onSuccess) onSuccess();
      } else {
        alert(`❌ เกิดข้อผิดพลาด: ${data.error || 'Upload ไม่สำเร็จ'}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* 📥 ปุ่มดาวน์โหลด Template มาตรฐาน */}
      <a
        href="/project_template.xlsx"
        download="project_template.xlsx"
        className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-3 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 shadow-xs cursor-pointer"
        title="ดาวน์โหลดไฟล์ Template Excel มาตรฐาน"
      >
        <Download className="w-4 h-4 text-slate-500" />
        <span>โหลด Template</span>
      </a>

      {/* 📁 ปุ่มอัปโหลดไฟล์ */}
      <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium inline-flex items-center gap-2 shadow-xs transition-all active:scale-95">
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>กำลังประมวลผล...</span>
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            <span>อัปโหลด Excel โครงการ</span>
          </>
        )}
        <input
          type="file"
          accept=".xlsx, .xls"
          onChange={handleFileUpload}
          disabled={loading}
          className="hidden"
        />
      </label>
    </div>
  );
}