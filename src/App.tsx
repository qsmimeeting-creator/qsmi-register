/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle, 
  Lock, 
  AlertCircle, 
  Search, 
  ChevronLeft, 
  ChevronDown, 
  ArrowRight, 
  Trash2, 
  IdCard, 
  Activity, 
  X, 
  Download, 
  XCircle, 
  School, 
  GraduationCap, 
  Phone, 
  Edit2, 
  Syringe,
  User 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Registration, VaccineData } from './types';
import { firebaseService } from './services/firebaseService';

// --- Constants ---
const MONTHS_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const UNIVERSITIES = ['จุฬาลงกรณ์มหาวิทยาลัย', 'มหาวิทยาลัยเกษตรศาสตร์', 'มหาวิทยาลัยมหิดล', 'มหาวิทยาลัยเทคโนโลยีมหานคร'];
const YEAR_LEVELS = ['ปี 1', 'ปี 2', 'ปี 3', 'ปี 4', 'ปี 5', 'ปี 6', 'อาจารย์/เจ้าหน้าที่', 'บุคคลทั่วไป'];
const NAME_PREFIXES = ['นาย', 'นาง', 'นางสาว', 'อื่นๆ'];
const VACCINE_NAMES = ['SPEEDA', 'PVRV', 'PCEC'];
const TREATMENT_TYPES = ['Pre-exposure', 'Post-exposure', 'Booster', 'Advice'];
const INJECTION_OPTIONS: Record<string, string[]> = {
  'Pre-exposure': ['IM x 2 ครั้ง (D0-7)', 'IM x 3 ครั้ง (D0-7-21/28)', 'ID 1 จุด x 3 ครั้ง (D0-7-21/28)', 'ID 2 จุด x 2 ครั้ง (D0-7)'],
  'Post-exposure': ['IM x 5 ครั้ง (D0-3-7-14-28)', 'ID 2 จุด x 4 ครั้ง (D0-3-7-28)'],
  'Booster': ['IM x 1 ครั้ง (D0)', 'IM x 2 ครั้ง (D0-3)', 'ID 1 จุด x 1 ครั้ง (D0)', 'ID 4 จุด x 1 ครั้ง (D0)', 'ID 1 จุด x 2 ครั้ง (D0-3)'],
  'Advice': [] 
};

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || '1234';

// --- Helpers ---
const formatDateShort = (d: any) => {
  if (!d) return '-';
  const date = d.toDate ? d.toDate() : new Date(d);
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
};

const maskCitizenId = (id: string) => id && id.length >= 4 ? id.slice(0, -4).replace(/./g, 'X') + id.slice(-4) : id;

const validateThaiCitizenID = (id: string) => {
  if (!id || id.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseFloat(id.charAt(i)) * (13 - i);
  return (11 - sum % 11) % 10 === parseFloat(id.charAt(12));
};

const formatThaiCitizenID = (id: string) => {
  if (!id) return '';
  const cleaned = id.replace(/\D/g, '');
  let formatted = cleaned;
  if (cleaned.length > 0) formatted = cleaned.substring(0, 1);
  if (cleaned.length > 1) formatted += '-' + cleaned.substring(1, 5);
  if (cleaned.length > 5) formatted += '-' + cleaned.substring(5, 10);
  if (cleaned.length > 10) formatted += '-' + cleaned.substring(10, 12);
  if (cleaned.length > 12) formatted += '-' + cleaned.substring(12, 13);
  return formatted;
};

const formatThaiPhoneNumber = (phoneNumber: string) => {
  if (!phoneNumber) return '';
  const cleaned = phoneNumber.replace(/\D/g, '');
  let formatted = cleaned;
  if (cleaned.length > 3) formatted = cleaned.slice(0, 3) + '-' + cleaned.slice(3);
  if (cleaned.length > 6) formatted = formatted.slice(0, 7) + '-' + formatted.slice(7);
  return formatted;
};

export default function App() {
  const [view, setView] = useState<'check-id' | 'register-form' | 'success' | 'admin-login' | 'admin-dashboard'>('check-id');
  const [bookings, setBookings] = useState<Registration[]>([]);
  const [currentBooking, setCurrentBooking] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);

  const [checkIdInput, setCheckIdInput] = useState('');
  const [formData, setFormData] = useState<Omit<Registration, 'id' | 'createdAt' | 'status'>>({ 
    prefix: 'นาย', otherPrefix: '', firstName: '', lastName: '', gender: 'ชาย',
    dobDay: '1', dobMonth: '1', dobYearBE: '', age: 0, phone: '',
    university: '', yearLevel: '', studentId: '' , citizenId: ''
  });

  // Admin State
  const [adminSearch, setAdminSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visibleCount, setVisibleCount] = useState(5);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Registration>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletePin, setDeletePin] = useState('');
  const [adminPinInput, setAdminPinInput] = useState('');
  
  // Vaccine State
  const [showVaccineModal, setShowVaccineModal] = useState(false);
  const [vaccineFormData, setVaccineFormData] = useState<{
    id: string | null; name: string; serviceDate: string; hn: string; 
    vaccineName: string; treatmentType: string; injectionMethod: string; note: string;
  }>({
    id: null, name: '', serviceDate: '', hn: '', 
    vaccineName: '', treatmentType: '', injectionMethod: '', note: ''
  });
  const [errorModal, setErrorModal] = useState({ show: false, message: '', title: 'แจ้งเตือน' });

  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    firebaseService.testConnection();
    const savedSession = localStorage.getItem('qsmi_admin_session');
    if (savedSession === 'true') {
      setView('admin-dashboard');
    } else {
      setLoading(false);
    }
  }, []);

  const loadAdminData = async (reset = false, search = '') => {
    try {
      if (reset) {
        setLoading(true);
        setLastDoc(null);
      } else {
        setLoadingMore(true);
      }
      
      const currentLastDoc = reset ? null : lastDoc;
      const { data, lastDoc: newLastDoc, hasMore: newHasMore } = await firebaseService.getRegistrationsPage(10, currentLastDoc, search);
      
      if (reset) {
        setBookings(data);
      } else {
        setBookings(prev => {
          // Prevent duplicates
          const existingIds = new Set(prev.map(b => b.id));
          const newUniqueData = data.filter(b => !existingIds.has(b.id));
          return [...prev, ...newUniqueData];
        });
      }
      
      setLastDoc(newLastDoc);
      setHasMore(newHasMore);
    } catch (error) {
      console.error("Error loading admin data:", error);
      setErrorModal({ show: true, title: 'Error', message: 'ไม่สามารถโหลดข้อมูลได้' });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (view === 'admin-dashboard') {
      loadAdminData(true, adminSearch);
    }
  }, [view]);

  // Handle search with debounce
  useEffect(() => {
    if (view === 'admin-dashboard') {
      const timer = setTimeout(() => {
        loadAdminData(true, adminSearch);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [adminSearch]);


  const resetToHome = () => {
    setCheckIdInput('');
    setFormData({ 
      prefix: 'นาย', otherPrefix: '', firstName: '', lastName: '', gender: 'ชาย',
      dobDay: '1', dobMonth: '1', dobYearBE: '', age: 0, phone: '',
      university: '', yearLevel: '', studentId: '', citizenId: ''
    });
    setCurrentBooking(null);
    setView('check-id');
  };

  const filteredBookings = bookings;


  // Form Effects
  useEffect(() => {
    if (formData.prefix === 'นาย') setFormData(prev => ({ ...prev, gender: 'ชาย', otherPrefix: '' }));
    else if (['นาง', 'นางสาว'].includes(formData.prefix)) setFormData(prev => ({ ...prev, gender: 'หญิง', otherPrefix: '' }));
    else if (formData.prefix === 'อื่นๆ') setFormData(prev => ({ ...prev, gender: '' })); 
  }, [formData.prefix]);

  useEffect(() => {
    if (formData.dobYearBE && formData.dobYearBE.length === 4 && formData.dobMonth && formData.dobDay) {
      const today = new Date();
      const birthYearAD = parseInt(formData.dobYearBE) - 543;
      let age = today.getFullYear() - birthYearAD;
      
      const m = today.getMonth() - (parseInt(formData.dobMonth) - 1);
      if (m < 0 || (m === 0 && today.getDate() < parseInt(formData.dobDay))) {
          age--;
      }
      setFormData(prev => ({ ...prev, age: age >= 0 ? age : 0 }));
    } else {
        setFormData(prev => ({ ...prev, age: 0 }));
    }
  }, [formData.dobYearBE, formData.dobMonth, formData.dobDay]);

  useEffect(() => {
      if (['อาจารย์/เจ้าหน้าที่', 'บุคคลทั่วไป'].includes(formData.yearLevel)) setFormData(prev => ({ ...prev, studentId: '' }));
  }, [formData.yearLevel]);

  // Edit Form Effects
  useEffect(() => {
    if (showEditModal) {
        if (editFormData.prefix === 'นาย') setEditFormData(prev => ({ ...prev, gender: 'ชาย', otherPrefix: '' }));
        else if (['นาง', 'นางสาว'].includes(editFormData.prefix || '')) setEditFormData(prev => ({ ...prev, gender: 'หญิง', otherPrefix: '' }));
        else if (editFormData.prefix !== 'อื่นๆ') setEditFormData(prev => ({ ...prev, otherPrefix: '' }));
    }
  }, [editFormData.prefix, showEditModal]);

  useEffect(() => {
    if (showEditModal && editFormData.dobYearBE && editFormData.dobYearBE.length === 4 && editFormData.dobMonth && editFormData.dobDay) {
      const today = new Date();
      const birthYearAD = parseInt(editFormData.dobYearBE) - 543;
      let age = today.getFullYear() - birthYearAD;
      
      const m = today.getMonth() - (parseInt(editFormData.dobMonth) - 1);
      if (m < 0 || (m === 0 && today.getDate() < parseInt(editFormData.dobDay))) {
          age--;
      }
      setEditFormData(prev => ({ ...prev, age: age >= 0 ? age : 0 }));
    }
  }, [editFormData.dobYearBE, editFormData.dobMonth, editFormData.dobDay, showEditModal]);

  // Vaccine Logic
  useEffect(() => {
      if (showVaccineModal) {
          if (vaccineFormData.treatmentType && vaccineFormData.treatmentType !== 'Advice') {
              const options = INJECTION_OPTIONS[vaccineFormData.treatmentType] || [];
              setVaccineFormData(prev => ({ ...prev, injectionMethod: options.length > 0 ? options[0] : '-' }));
          } else {
              setVaccineFormData(prev => ({ ...prev, injectionMethod: '', vaccineName: '' }));
          }
      }
  }, [vaccineFormData.treatmentType, showVaccineModal]);

  const handleCheckID = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checkIdInput.length !== 13) {
      setErrorModal({ show: true, title: 'แจ้งเตือน', message: 'กรุณากรอกเลขบัตรประชาชนให้ครบ 13 หลัก' });
      return;
    }
    if (!validateThaiCitizenID(checkIdInput)) {
      setErrorModal({ show: true, title: 'แจ้งเตือน', message: 'เลขบัตรประชาชนไม่ถูกต้อง\nกรุณาตรวจสอบข้อมูลอีกครั้ง' });
      return;
    }

    setLoading(true);
    try {
      const existing = await firebaseService.checkCitizenId(checkIdInput);
      if (existing) {
        setCurrentBooking(existing);
        setView('success');
      } else {
        setFormData(prev => ({ ...prev, citizenId: checkIdInput }));
        setView('register-form');
      }
    } catch (error) {
      setErrorModal({ show: true, title: 'Error', message: 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูล' });
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName || !formData.phone || !formData.dobYearBE || !formData.university || !formData.yearLevel || !formData.gender) {
      setErrorModal({ show: true, title: 'แจ้งเตือน', message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (รวมถึงเพศ)' });
      return;
    }

    if (formData.prefix === 'อื่นๆ' && !formData.otherPrefix) {
      setErrorModal({ show: true, title: 'แจ้งเตือน', message: 'กรุณาระบุคำนำหน้า' });
      return;
    }

    if (formData.phone.length < 9) {
      setErrorModal({ show: true, title: 'แจ้งเตือน', message: 'เบอร์โทรศัพท์ไม่ถูกต้อง' });
      return;
    }

    if (formData.dobYearBE.length !== 4) {
      setErrorModal({ show: true, title: 'แจ้งเตือน', message: 'ปี พ.ศ. เกิดไม่ถูกต้อง' });
      return;
    }

    if (!['อาจารย์/เจ้าหน้าที่', 'บุคคลทั่วไป'].includes(formData.yearLevel) && !formData.studentId) {
      setErrorModal({ show: true, title: 'แจ้งเตือน', message: 'กรุณากรอกรหัสนักศึกษา' });
      return;
    }

    setLoading(true);
    try {
      const newBooking = await firebaseService.createRegistration(formData);
      setCurrentBooking(newBooking);
      setView('success');
    } catch (err) {
      setErrorModal({ show: true, title: 'Error', message: 'บันทึกข้อมูลไม่สำเร็จ: ' + err });
    }
    setLoading(false);
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPinInput === ADMIN_PASSWORD) {
      localStorage.setItem('qsmi_admin_session', 'true');
      setView('admin-dashboard');
    } else {
      setErrorModal({ show: true, title: 'แจ้งเตือน', message: 'รหัสผ่านไม่ถูกต้อง' });
    }
  };

  const saveEditing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData.id) return;
    
    if (!editFormData.gender) {
      setErrorModal({ show: true, title: 'แจ้งเตือน', message: 'กรุณาระบุเพศ' });
      return;
    }

    setLoading(true);
    try {
      await firebaseService.updateRegistration(editFormData.id, editFormData);
      setBookings(prev => prev.map(b => b.id === editFormData.id ? { ...b, ...editFormData } : b));
      setShowEditModal(false);
      setErrorModal({ show: true, title: 'สำเร็จ', message: 'บันทึกการแก้ไขข้อมูลเรียบร้อยแล้ว' });
    } catch (err) {
      setErrorModal({ show: true, title: 'Error', message: 'Error updating: ' + err });
    }
    setLoading(false);
  };

  const confirmDelete = async () => {
    if (deletePin !== ADMIN_PASSWORD) {
      setErrorModal({ show: true, title: 'ผิดพลาด', message: 'รหัสผ่านไม่ถูกต้อง' });
      return;
    }
    if (!deleteTargetId) return;
    setLoading(true);
    try {
      await firebaseService.deleteRegistration(deleteTargetId);
      setBookings(prev => prev.filter(b => b.id !== deleteTargetId));
      setShowDeleteConfirm(false);
      setErrorModal({ show: true, title: 'สำเร็จ', message: 'ลบข้อมูลเรียบร้อยแล้ว' });
    } catch (err) {
      setErrorModal({ show: true, title: 'ผิดพลาด', message: 'เกิดข้อผิดพลาดในการลบ' });
    }
    setLoading(false);
  };

  const saveVaccineData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaccineFormData.id) return;
    
    if (!vaccineFormData.treatmentType) {
      setErrorModal({ show: true, title: 'แจ้งเตือน', message: 'กรุณาเลือกการรักษา (Treatment)' });
      return;
    }

    const isAdvice = vaccineFormData.treatmentType === 'Advice';
    const newVaccineData: VaccineData = {
      serviceDate: vaccineFormData.serviceDate,
      hn: vaccineFormData.hn,
      vaccineName: isAdvice ? '-' : vaccineFormData.vaccineName,
      treatmentType: vaccineFormData.treatmentType,
      injectionMethod: isAdvice ? '-' : vaccineFormData.injectionMethod,
      note: vaccineFormData.note
    };
    setLoading(true);
    try {
      await firebaseService.updateRegistration(vaccineFormData.id, { vaccineData: newVaccineData });
      setBookings(prev => prev.map(b => b.id === vaccineFormData.id ? { ...b, vaccineData: newVaccineData } : b));
      setShowVaccineModal(false);
      setErrorModal({ show: true, title: 'สำเร็จ', message: 'บันทึกข้อมูลการฉีดวัคซีนเรียบร้อยแล้ว' });
    } catch (err) {
      setErrorModal({ show: true, title: 'Error', message: 'Error updating vaccine data' });
    }
    setLoading(false);
  };

  const exportCSV = async () => {
    if (!startDate || !endDate) {
      setErrorModal({ show: true, title: 'แจ้งเตือน', message: 'กรุณาเลือกวันที่เริ่มต้นและวันที่สิ้นสุด' });
      return;
    }

    setLoading(true);
    try {
      const dataToExport = await firebaseService.getRegistrationsByDateRange(new Date(startDate), new Date(endDate));
      
      if (dataToExport.length === 0) {
        setErrorModal({ show: true, title: 'แจ้งเตือน', message: 'ไม่มีข้อมูลในช่วงเวลาที่เลือก' });
        setLoading(false);
        return;
      }

      const headers = "ID,วันที่ลงทะเบียน,คำนำหน้า,ชื่อ,นามสกุล,เพศ,เลขบัตรประชาชน,เบอร์โทรศัพท์,วัน/เดือน/ปี ค.ศ. เกิด,อายุ,มหาวิทยาลัย/หน่วยงาน,ชั้นปี/สถานะ,รหัสนักศึกษา,วันที่มารับบริการ,HN.,การรักษา,การฉีด,ชื่อวัคซีน,หมายเหตุ\n";
      const rows = dataToExport.map(b => {
        const prefix = b.prefix === 'อื่นๆ' ? b.otherPrefix : b.prefix;
        const dobStr = `${b.dobDay}/${b.dobMonth}/${parseInt(b.dobYearBE)-543}`;
        const createdAt = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        const tsString = createdAt.toLocaleString('th-TH');
        return `"${b.id}","${tsString}","${prefix}","${b.firstName}","${b.lastName}","${b.gender}","${b.citizenId}","'${b.phone}","${dobStr}","${b.age}","${b.university}","${b.yearLevel}","${b.studentId || '-'}","${b.vaccineData?.serviceDate || '-'}","${b.vaccineData?.hn || '-'}","${b.vaccineData?.treatmentType || '-'}","${b.vaccineData?.injectionMethod || '-'}","${b.vaccineData?.vaccineName || '-'}","${b.vaccineData?.note || '-'}"`;
      }).join("\n");
      
      const csvContent = "\uFEFF" + headers + rows;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `registration_data_${startDate}_to_${endDate}.csv`);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      setErrorModal({ 
        show: true, 
        title: 'Error', 
        message: 'ไม่สามารถดาวน์โหลดข้อมูลได้' 
      });
    }
    setLoading(false);
  };

  // --- Render Functions ---
  const renderCheckID = () => (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center p-4 text-[#212529]">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden"
      >
        <header className="bg-[#C8102E] text-white p-8 md:p-12 text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-black/10 rounded-full blur-3xl"></div>
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner"
          >
            <Activity className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-2xl md:text-3xl font-black relative z-10 tracking-tight leading-tight">ระบบลงทะเบียน</h1>
          <p className="text-white/70 text-sm md:text-base font-medium relative z-10 mt-2">กรอกข้อมูลเพื่อเริ่มต้นการลงทะเบียน</p>
        </header>
        <div className="p-8 md:p-10">
          <form onSubmit={handleCheckID} noValidate className="space-y-8">
            <div className="text-center">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">เลขบัตรประจำตัวประชาชน</label>
              <div className="relative group">
                <input 
                  required 
                  autoFocus 
                  type="tel" 
                  maxLength={17} 
                  value={formatThaiCitizenID(checkIdInput)}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (val.length <= 13) setCheckIdInput(val);
                  }}
                  className="w-full text-center text-2xl md:text-3xl font-bold tracking-widest bg-gray-50 border-2 border-transparent rounded-2xl p-5 focus:bg-white focus:border-[#C8102E] focus:ring-4 focus:ring-[#C8102E]/10 outline-none transition-all placeholder:text-gray-200"
                  placeholder="X-XXXX-XXXXX-XX-X"
                />
              </div>
            </div>
            <button 
              type="submit" 
              disabled={loading} 
              className={`w-full bg-[#C8102E] text-white font-black py-5 rounded-2xl shadow-[0_10px_30px_rgba(200,16,46,0.3)] transition-all active:scale-[0.97] flex justify-center items-center gap-3 text-lg ${loading ? 'opacity-70 cursor-wait' : 'hover:bg-[#a00d25] hover:shadow-[0_15px_40px_rgba(200,16,46,0.4)]'}`}
            >
              {loading ? 'กำลังโหลดข้อมูล...' : <>ตรวจสอบ / ลงทะเบียน <ArrowRight className="w-6 h-6" /></>}
            </button>
            <div className="text-center pt-4">
              <button 
                type="button" 
                onClick={() => { setView('admin-login'); setAdminPinInput(''); }} 
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold text-gray-400 hover:text-[#C8102E] hover:bg-[#C8102E]/5 transition-all uppercase tracking-widest"
              >
                <Lock className="w-3 h-3" /> Staff Access
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );

  const renderRegisterForm = () => {
    const isStudent = !['อาจารย์/เจ้าหน้าที่', 'บุคคลทั่วไป'].includes(formData.yearLevel);
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center p-2 md:p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden my-4 md:my-10"
        >
          <header className="bg-[#212529] text-white p-4 md:p-6 flex items-center gap-4">
            <button onClick={() => setView('check-id')} className="p-2 hover:bg-white/10 rounded-full"><ChevronLeft /></button>
            <div className="overflow-hidden">
              <h1 className="text-lg md:text-xl font-bold truncate">กรอกข้อมูลลงทะเบียน</h1>
              <p className="text-xs text-gray-400 truncate">เลขบัตรประชาชน: {formatThaiCitizenID(formData.citizenId)}</p>
            </div>
          </header>
          <form onSubmit={handleFormSubmit} noValidate className="p-5 md:p-10 space-y-8">
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                <div className="w-8 h-8 bg-[#C8102E]/10 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-[#C8102E]" />
                </div>
                <h3 className="text-gray-900 font-bold text-base uppercase tracking-wider">ข้อมูลส่วนตัว</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">คำนำหน้า <span className="text-[#C8102E]">*</span></label>
                  <select 
                    value={formData.prefix} 
                    onChange={e => {
                      const newPrefix = e.target.value;
                      let newGender = formData.gender;
                      if (['นาย', 'ด.ช.'].includes(newPrefix)) newGender = 'ชาย';
                      else if (['นาง', 'นางสาว', 'ด.ญ.'].includes(newPrefix)) newGender = 'หญิง';
                      else if (newPrefix === 'อื่นๆ') newGender = '';
                      setFormData({...formData, prefix: newPrefix, gender: newGender});
                    }} 
                    className="w-full bg-white border border-gray-200 rounded-xl p-3.5 text-base outline-none focus:ring-2 focus:ring-[#C8102E] focus:border-transparent transition-all"
                  >
                    {NAME_PREFIXES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                {formData.prefix === 'อื่นๆ' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">ระบุคำนำหน้า <span className="text-[#C8102E]">*</span></label>
                    <input 
                      required 
                      type="text" 
                      className="w-full bg-white border border-gray-200 rounded-xl p-3.5 text-base outline-none focus:ring-2 focus:ring-[#C8102E] focus:border-transparent transition-all" 
                      value={formData.otherPrefix} 
                      onChange={e => setFormData({...formData, otherPrefix: e.target.value})} 
                    />
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">ชื่อ <span className="text-[#C8102E]">*</span></label>
                  <input 
                    required 
                    type="text" 
                    className="w-full bg-white border border-gray-200 rounded-xl p-3.5 text-base outline-none focus:ring-2 focus:ring-[#C8102E] focus:border-transparent transition-all" 
                    value={formData.firstName} 
                    onChange={e => setFormData({...formData, firstName: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">นามสกุล <span className="text-[#C8102E]">*</span></label>
                  <input 
                    required 
                    type="text" 
                    className="w-full bg-white border border-gray-200 rounded-xl p-3.5 text-base outline-none focus:ring-2 focus:ring-[#C8102E] focus:border-transparent transition-all" 
                    value={formData.lastName} 
                    onChange={e => setFormData({...formData, lastName: e.target.value})} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">เพศ <span className="text-[#C8102E]">*</span></label>
                  <select 
                    required 
                    className="w-full bg-white border border-gray-200 rounded-xl p-3.5 text-base outline-none focus:ring-2 focus:ring-[#C8102E] focus:border-transparent transition-all" 
                    value={formData.gender} 
                    onChange={e => setFormData({...formData, gender: e.target.value})}
                  >
                    <option value="" disabled>กรุณาเลือก</option>
                    <option value="ชาย">ชาย</option>
                    <option value="หญิง">หญิง</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">เบอร์โทรศัพท์ (10 หลัก) <span className="text-[#C8102E]">*</span></label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-4 w-4 h-4 text-gray-400" />
                    <input 
                      required 
                      type="tel" 
                      maxLength={12} 
                      className="w-full pl-12 bg-white border border-gray-200 rounded-xl p-3.5 text-base outline-none focus:ring-2 focus:ring-[#C8102E] focus:border-transparent transition-all" 
                      placeholder="0XX-XXX-XXXX" 
                      value={formatThaiPhoneNumber(formData.phone)} 
                      onChange={e => { 
                        const val = e.target.value.replace(/\D/g, ''); 
                        if (val.length <= 10) setFormData({...formData, phone: val}); 
                      }} 
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-3">
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">วัน/เดือน/ปี พ.ศ. เกิด <span className="text-[#C8102E]">*</span></label>
                  <div className="grid grid-cols-3 gap-3">
                    <select className="bg-white border border-gray-200 rounded-xl p-3.5 text-base outline-none focus:ring-2 focus:ring-[#C8102E] transition-all" value={formData.dobDay} onChange={e => setFormData({...formData, dobDay: e.target.value})}>
                      {Array.from({length: 31}, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select className="bg-white border border-gray-200 rounded-xl p-3.5 text-base outline-none focus:ring-2 focus:ring-[#C8102E] transition-all" value={formData.dobMonth} onChange={e => setFormData({...formData, dobMonth: e.target.value})}>
                      {MONTHS_TH.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                    </select>
                    <input 
                      type="tel" 
                      placeholder="พ.ศ." 
                      maxLength={4} 
                      className="bg-white border border-gray-200 rounded-xl p-3.5 text-base outline-none focus:ring-2 focus:ring-[#C8102E] focus:border-transparent transition-all" 
                      value={formData.dobYearBE} 
                      onChange={e => setFormData({...formData, dobYearBE: e.target.value})} 
                    />
                  </div>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">อายุ</label>
                  <input type="text" readOnly className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3.5 text-base text-center font-bold text-[#C8102E] outline-none" value={formData.age ? `${formData.age} ปี` : '-'} />
                </div>
              </div>
            </div>

            <div className="space-y-6 pt-4">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                <div className="w-8 h-8 bg-[#C8102E]/10 rounded-lg flex items-center justify-center">
                  <School className="w-4 h-4 text-[#C8102E]" />
                </div>
                <h3 className="text-gray-900 font-bold text-base uppercase tracking-wider">ข้อมูลการศึกษา/อาชีพ</h3>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">มหาวิทยาลัย/หน่วยงาน <span className="text-[#C8102E]">*</span></label>
                <div className="relative">
                  <School className="absolute left-4 top-4 w-4 h-4 text-gray-400" />
                  <select 
                    required 
                    className="w-full pl-12 bg-white border border-gray-200 rounded-xl p-3.5 text-base outline-none focus:ring-2 focus:ring-[#C8102E] focus:border-transparent transition-all" 
                    value={formData.university} 
                    onChange={e => setFormData({...formData, university: e.target.value})}
                  >
                    <option value="" disabled>กรุณาเลือก</option>
                    {UNIVERSITIES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">ชั้นปี/สถานะ <span className="text-[#C8102E]">*</span></label>
                  <select 
                    required 
                    className="w-full bg-white border border-gray-200 rounded-xl p-3.5 text-base outline-none focus:ring-2 focus:ring-[#C8102E] focus:border-transparent transition-all" 
                    value={formData.yearLevel} 
                    onChange={e => setFormData({...formData, yearLevel: e.target.value})}
                  >
                    <option value="" disabled>กรุณาเลือก</option>
                    {YEAR_LEVELS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                {isStudent && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">รหัสนักศึกษา</label>
                    <div className="relative">
                      <GraduationCap className="absolute left-4 top-4 w-4 h-4 text-gray-400" />
                      <input 
                        required 
                        type="tel" 
                        maxLength={15} 
                        className="w-full pl-12 bg-white border border-gray-200 rounded-xl p-3.5 text-base outline-none focus:ring-2 focus:ring-[#C8102E] focus:border-transparent transition-all" 
                        placeholder="ระบุรหัสนักศึกษา" 
                        value={formData.studentId} 
                        onChange={e => setFormData({...formData, studentId: e.target.value.replace(/\D/g, '')})} 
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="pt-8">
              <button 
                type="submit" 
                disabled={loading} 
                className={`w-full bg-[#198754] text-white font-bold py-4.5 rounded-2xl shadow-lg shadow-green-900/20 transition-all flex justify-center items-center gap-3 text-lg ${loading ? 'opacity-70 cursor-wait' : 'hover:bg-[#146c43] hover:shadow-xl active:scale-[0.98]'}`}
              >
                {loading ? 'กำลังบันทึก...' : <><CheckCircle className="w-6 h-6" /> ยืนยันการลงทะเบียน</>}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  };

  const renderSuccess = () => {
    if (!currentBooking) return null;
    const data = currentBooking;
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4 overflow-hidden relative">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#198754]/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#C8102E]/5 rounded-full blur-3xl"></div>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.12)] border border-gray-100"
        >
          <div className="bg-[#198754] h-3 w-full"></div>
          <div className="p-8 md:p-10">
            <div className="flex justify-center mb-8">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                className="w-24 h-24 bg-[#198754] rounded-full flex items-center justify-center shadow-[0_10px_25px_rgba(25,135,84,0.4)]"
              >
                <CheckCircle className="w-12 h-12 text-white" />
              </motion.div>
            </div>
            <div className="text-center mb-10">
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">ลงทะเบียนสำเร็จ</h2>
              <p className="text-gray-500 mt-2 font-medium">กรุณาแสดงหน้าจอนี้ต่อเจ้าหน้าที่</p>
            </div>
            
            <div className="bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 p-8 relative">
              <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#f8f9fa] rounded-full border-r-2 border-gray-200"></div>
              <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#f8f9fa] rounded-full border-l-2 border-gray-200"></div>
              
              <div className="space-y-6">
                <div className="text-center border-b-2 border-gray-100 pb-6">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">REGISTRATION ID</p>
                  <p className="text-4xl font-black text-[#C8102E] tracking-tighter break-all leading-none">{data.id}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">วันที่ทำรายการ</p>
                    <p className="font-bold text-gray-900 text-base">{formatDateShort(data.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">สถานะ</p>
                    <p className="font-bold text-[#198754] text-base">{data.status}</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                  <div className="flex justify-between items-start gap-4">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">ชื่อ-สกุล</span> 
                    <span className="font-bold text-gray-900 text-right leading-tight">{`${data.prefix === 'อื่นๆ' ? data.otherPrefix : data.prefix} ${data.firstName} ${data.lastName}`}</span>
                  </div>
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">เลขบัตรฯ</span> 
                    <span className="font-bold text-gray-900">{maskCitizenId(data.citizenId)}</span>
                  </div>
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">อายุ</span> 
                    <span className="font-bold text-gray-900">{data.age} ปี</span>
                  </div>
                  <div className="flex justify-between items-start gap-4">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">สถาบัน</span> 
                    <span className="font-bold text-gray-900 text-right leading-tight">{data.university}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10">
              <button 
                onClick={resetToHome} 
                className="w-full py-5 bg-[#212529] text-white font-black rounded-2xl shadow-xl active:scale-[0.97] transition-all flex items-center justify-center gap-3 text-lg hover:bg-black"
              >
                <ArrowRight className="w-6 h-6" /> กลับหน้าหลัก
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  const renderAdminLogin = () => (
    <div className="min-h-screen bg-[#212529] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-[#C8102E]/30 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-500/10 rounded-full blur-[120px]"></div>
      </div>

      <motion.form 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onSubmit={handleAdminLogin} 
        className="w-full max-w-sm bg-white/5 backdrop-blur-2xl p-8 md:p-12 rounded-[3rem] border border-white/10 shadow-2xl space-y-10"
      >
        <div className="text-center space-y-3">
          <div className="w-20 h-20 bg-[#C8102E] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-[#C8102E]/30 ring-4 ring-white/5">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-white text-3xl font-black tracking-tight">Staff Access</h2>
          <p className="text-white/40 font-medium text-sm uppercase tracking-[0.2em]">Restricted Area</p>
        </div>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-white/50 text-[10px] font-black uppercase tracking-widest ml-4">Password</label>
            <input 
              type="password" 
              autoFocus
              value={adminPinInput} 
              onChange={e => setAdminPinInput(e.target.value)} 
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white text-2xl font-black tracking-[0.5em] text-center outline-none focus:ring-4 focus:ring-[#C8102E]/20 focus:border-[#C8102E] transition-all placeholder:text-white/10" 
              placeholder="••••" 
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading} 
            className={`w-full bg-[#C8102E] text-white font-black py-5 rounded-2xl shadow-2xl shadow-[#C8102E]/20 transition-all active:scale-[0.97] text-lg ${loading ? 'opacity-70 cursor-wait' : 'hover:bg-[#a00d25] hover:shadow-[#C8102E]/30'}`}
          >
            {loading ? 'Authenticating...' : 'Login to Dashboard'}
          </button>
          
          <button 
            type="button" 
            onClick={() => { setView('check-id'); setAdminPinInput(''); }} 
            className="w-full py-3 text-white/40 hover:text-white font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Registration
          </button>
        </div>
      </motion.form>
    </div>
  );

  const renderAdminDashboard = () => {
    const displayBookings = bookings;
    
    return (
      <div className="min-h-screen bg-gray-100 p-4 relative">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">รายชื่อผู้ลงทะเบียน ({bookings.length})</h1>
            <button 
              onClick={() => { localStorage.removeItem('qsmi_admin_session'); setView('check-id'); setAdminPinInput(''); }} 
              className="w-full md:w-auto px-4 py-2 bg-gray-200 rounded-lg text-sm font-bold"
            >
              Logout
            </button>
          </div>

          <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm mb-6 flex flex-col lg:flex-row gap-6 justify-between items-stretch lg:items-end">
            <div className="flex-1 w-full flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-600">ค้นหาข้อมูล</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#C8102E] focus:border-transparent outline-none transition-all" 
                  placeholder="ชื่อ, นามสกุล, เลขบัตรประชาชน, รหัสลงทะเบียน..." 
                  value={adminSearch} 
                  onChange={(e) => setAdminSearch(e.target.value)} 
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-stretch sm:items-end">
              <div className="flex-1 flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-600">ตั้งแต่วันที่</label>
                <input 
                  type="date" 
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#C8102E] outline-none h-[42px]" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                />
              </div>
              <div className="flex-1 flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-600">ถึงวันที่</label>
                <input 
                  type="date" 
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#C8102E] outline-none h-[42px]" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                />
              </div>
              <div className="flex flex-col justify-end">
                <button 
                  onClick={exportCSV} 
                  className="w-full sm:w-auto py-2.5 px-6 bg-[#198754] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#146c43] transition-colors h-[42px] shadow-sm"
                >
                  <Download className="w-4 h-4" /> ดาวน์โหลด (CSV)
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="p-4">Reg ID / Date</th>
                    <th className="p-4">Name</th>
                    <th className="p-4">Citizen ID / Phone</th>
                    <th className="p-4">University / Status</th>
                    <th className="p-4">Vaccine Info</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displayBookings.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-gray-400">ไม่พบข้อมูล</td></tr>
                  ) : (
                    displayBookings.map(b => (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <td className="p-4 align-top">
                          <div className="font-bold text-[#C8102E]">{b.id}</div>
                          <div className="text-xs text-gray-500">{formatDateShort(b.createdAt)}</div>
                        </td>
                        <td className="p-4 align-top">
                          <div className="font-bold">{`${b.prefix === 'อื่นๆ' ? b.otherPrefix : b.prefix} ${b.firstName} ${b.lastName}`}</div>
                          <div className="text-xs text-gray-500">{b.gender}</div>
                        </td>
                        <td className="p-4 align-top">
                          <div className="text-sm">{formatThaiCitizenID(b.citizenId)}</div>
                          <div className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Phone className="w-3 h-3"/> {formatThaiPhoneNumber(b.phone)}</div>
                        </td>
                        <td className="p-4 align-top">
                          <div className="text-sm">{b.university}</div>
                          <div className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded inline-block mt-1">{b.yearLevel} {b.studentId && `(${b.studentId})`}</div>
                        </td>
                        <td className="p-4 align-top">
                          {b.vaccineData ? (
                            <div className="text-xs space-y-1">
                              <div className="font-bold text-[#198754]">{b.vaccineData.vaccineName}</div>
                              <div>{b.vaccineData.treatmentType}</div>
                              <div className="text-gray-500">{b.vaccineData.injectionMethod}</div>
                              <div className="text-gray-400">{formatDateShort(b.vaccineData.serviceDate)}</div>
                              {b.vaccineData.hn && <div className="text-blue-600 font-medium">HN: {b.vaccineData.hn}</div>}
                              {b.vaccineData.note && <div className="text-gray-400 italic">*{b.vaccineData.note}</div>}
                            </div>
                          ) : (<span className="text-gray-400 text-xs">-</span>)}
                        </td>
                        <td className="p-4 align-top text-center">
                          <div className="flex gap-2 justify-center">
                            <button 
                              onClick={() => {
                                setVaccineFormData({
                                  id: b.id,
                                  name: `${b.prefix === 'อื่นๆ' ? b.otherPrefix : b.prefix} ${b.firstName} ${b.lastName}`,
                                  serviceDate: b.vaccineData?.serviceDate || new Date().toISOString().split('T')[0],
                                  hn: b.vaccineData?.hn || '',
                                  vaccineName: b.vaccineData?.vaccineName || '',
                                  treatmentType: b.vaccineData?.treatmentType || '',
                                  injectionMethod: b.vaccineData?.injectionMethod || '',
                                  note: b.vaccineData?.note || ''
                                });
                                setShowVaccineModal(true);
                              }} 
                              className="p-2 border border-gray-200 rounded text-gray-600 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-colors" 
                              title="เพิ่มข้อมูลวัคซีน"
                            >
                              <Syringe className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => {
                                setEditFormData(b);
                                setShowEditModal(true);
                              }} 
                              className="p-2 border border-gray-200 rounded text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors" 
                              title="แก้ไข"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => {
                                setDeleteTargetId(b.id);
                                setShowDeleteConfirm(true);
                              }} 
                              className="p-2 border border-gray-200 rounded text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors" 
                              title="ลบ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {hasMore && (
              <div className="p-4 text-center border-t border-gray-100 bg-gray-50">
                <button 
                  onClick={() => loadAdminData(false, adminSearch)} 
                  disabled={loadingMore}
                  className="text-sm font-bold text-gray-600 hover:text-[#C8102E] transition-colors flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
                >
                  {loadingMore ? 'กำลังโหลด...' : 'แสดงเพิ่มเติม'} <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Edit Modal */}
        <AnimatePresence>
          {showEditModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
              >
                <div className="bg-[#212529] p-5 md:p-8 text-white flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-lg">
                      <Edit2 className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <h3 className="font-black text-lg md:text-2xl tracking-tight">แก้ไขข้อมูลลงทะเบียน</h3>
                  </div>
                  <button onClick={() => setShowEditModal(false)} className="text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <form onSubmit={saveEditing} className="flex-1 overflow-y-auto p-5 md:p-10 space-y-8">
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                      <div className="w-8 h-8 bg-[#C8102E]/10 rounded-lg flex items-center justify-center">
                        <User className="w-4 h-4 text-[#C8102E]" />
                      </div>
                      <h3 className="text-gray-900 font-bold text-base uppercase tracking-wider">ข้อมูลส่วนตัว</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div className="flex flex-col gap-1.5">
                        <label className="block text-sm font-bold text-gray-700">คำนำหน้า</label>
                        <select 
                          className="w-full border border-gray-200 rounded-xl p-3 text-base outline-none focus:ring-2 focus:ring-[#C8102E] bg-white" 
                          value={editFormData.prefix} 
                          onChange={e => {
                            const newPrefix = e.target.value;
                            let newGender = editFormData.gender;
                            if (['นาย', 'ด.ช.'].includes(newPrefix)) newGender = 'ชาย';
                            else if (['นาง', 'นางสาว', 'ด.ญ.'].includes(newPrefix)) newGender = 'หญิง';
                            else if (newPrefix === 'อื่นๆ') newGender = '';
                            setEditFormData({...editFormData, prefix: newPrefix, gender: newGender});
                          }}
                        >
                          {NAME_PREFIXES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      {editFormData.prefix === 'อื่นๆ' && (
                        <div className="md:col-span-2 flex flex-col gap-1.5">
                          <label className="block text-sm font-bold text-gray-700">ระบุคำนำหน้า</label>
                          <input 
                            type="text" 
                            className="w-full border border-gray-200 rounded-xl p-3 text-base outline-none focus:ring-2 focus:ring-[#C8102E]" 
                            value={editFormData.otherPrefix} 
                            onChange={e => setEditFormData({...editFormData, otherPrefix: e.target.value})} 
                          />
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="flex flex-col gap-1.5">
                        <label className="block text-sm font-bold text-gray-700">ชื่อ</label>
                        <input type="text" className="w-full border border-gray-200 rounded-xl p-3 text-base outline-none focus:ring-2 focus:ring-[#C8102E]" value={editFormData.firstName} onChange={e => setEditFormData({...editFormData, firstName: e.target.value})} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="block text-sm font-bold text-gray-700">นามสกุล</label>
                        <input type="text" className="w-full border border-gray-200 rounded-xl p-3 text-base outline-none focus:ring-2 focus:ring-[#C8102E]" value={editFormData.lastName} onChange={e => setEditFormData({...editFormData, lastName: e.target.value})} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="flex flex-col gap-1.5">
                        <label className="block text-sm font-bold text-gray-700">เพศ</label>
                        <select 
                          className="w-full border border-gray-200 rounded-xl p-3 text-base outline-none focus:ring-2 focus:ring-[#C8102E] bg-white" 
                          value={editFormData.gender} 
                          onChange={e => setEditFormData({...editFormData, gender: e.target.value})}
                        >
                          <option value="" disabled>กรุณาเลือก</option>
                          <option value="ชาย">ชาย</option>
                          <option value="หญิง">หญิง</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="block text-sm font-bold text-gray-700">เบอร์โทรศัพท์</label>
                        <input type="tel" className="w-full border border-gray-200 rounded-xl p-3 text-base outline-none focus:ring-2 focus:ring-[#C8102E]" value={editFormData.phone} maxLength={10} onChange={e => setEditFormData({...editFormData, phone: e.target.value.replace(/\D/g,'')})} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                      <div className="md:col-span-3 space-y-1.5">
                        <label className="block text-sm font-bold text-gray-700">วัน/เดือน/ปี พ.ศ. เกิด</label>
                        <div className="grid grid-cols-3 gap-3">
                          <select className="border border-gray-200 rounded-xl p-3 text-base outline-none focus:ring-2 focus:ring-[#C8102E] bg-white" value={editFormData.dobDay} onChange={e => setEditFormData({...editFormData, dobDay: e.target.value})}>{Array.from({length: 31}, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}</select>
                          <select className="border border-gray-200 rounded-xl p-3 text-base outline-none focus:ring-2 focus:ring-[#C8102E] bg-white" value={editFormData.dobMonth} onChange={e => setEditFormData({...editFormData, dobMonth: e.target.value})}>{MONTHS_TH.map((m, i) => <option key={m} value={i+1}>{m}</option>)}</select>
                          <input type="tel" className="border border-gray-200 rounded-xl p-3 text-base outline-none focus:ring-2 focus:ring-[#C8102E]" placeholder="พ.ศ." value={editFormData.dobYearBE} maxLength={4} onChange={e => setEditFormData({...editFormData, dobYearBE: e.target.value})} />
                        </div>
                      </div>
                      <div className="md:col-span-1 flex flex-col gap-1.5">
                        <label className="block text-sm font-bold text-gray-700 text-center">อายุ</label>
                        <div className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-base text-center font-black text-[#C8102E]">{editFormData.age ? `${editFormData.age} ปี` : '-'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                      <div className="w-8 h-8 bg-[#C8102E]/10 rounded-lg flex items-center justify-center">
                        <School className="w-4 h-4 text-[#C8102E]" />
                      </div>
                      <h3 className="text-gray-900 font-bold text-base uppercase tracking-wider">ข้อมูลการศึกษา/อาชีพ</h3>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="block text-sm font-bold text-gray-700">มหาวิทยาลัย/หน่วยงาน</label>
                      <select className="w-full border border-gray-200 rounded-xl p-3 text-base outline-none focus:ring-2 focus:ring-[#C8102E] bg-white" value={editFormData.university} onChange={e => setEditFormData({...editFormData, university: e.target.value})}>
                        {UNIVERSITIES.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="flex flex-col gap-1.5">
                        <label className="block text-sm font-bold text-gray-700">ชั้นปี/สถานะ</label>
                        <select className="w-full border border-gray-200 rounded-xl p-3 text-base outline-none focus:ring-2 focus:ring-[#C8102E] bg-white" value={editFormData.yearLevel} onChange={e => setEditFormData({...editFormData, yearLevel: e.target.value})}>
                          {YEAR_LEVELS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                      {!['อาจารย์/เจ้าหน้าที่', 'บุคคลทั่วไป'].includes(editFormData.yearLevel || '') && (
                        <div className="flex flex-col gap-1.5">
                          <label className="block text-sm font-bold text-gray-700">รหัสนักศึกษา</label>
                          <input type="tel" maxLength={15} className="w-full border border-gray-200 rounded-xl p-3 text-base outline-none focus:ring-2 focus:ring-[#C8102E]" value={editFormData.studentId} onChange={e => setEditFormData({...editFormData, studentId: e.target.value.replace(/\D/g, '')})} />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-5 md:p-8 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row gap-3 shrink-0 rounded-b-[2.5rem] -mx-5 md:-mx-10 -mb-5 md:-mb-10">
                    <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-4 border border-gray-200 rounded-2xl font-bold text-gray-600 hover:bg-white transition-colors">ยกเลิก</button>
                    <button type="submit" disabled={loading} className="flex-1 py-4 bg-[#198754] text-white rounded-2xl font-bold hover:bg-[#146c43] transition-colors shadow-lg shadow-green-600/20 disabled:opacity-50">บันทึกข้อมูล</button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Vaccine Modal */}
        <AnimatePresence>
          {showVaccineModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
              >
                <div className="bg-[#212529] p-5 md:p-8 text-white flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-lg">
                      <Syringe className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <h3 className="font-black text-lg md:text-2xl tracking-tight">เพิ่มข้อมูลการฉีดวัคซีน</h3>
                  </div>
                  <button onClick={() => setShowVaccineModal(false)} className="text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <form onSubmit={saveVaccineData} className="flex-1 overflow-y-auto p-5 md:p-10 space-y-8">
                  <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 flex flex-col gap-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">ผู้รับบริการ</label>
                    <p className="font-black text-xl md:text-2xl text-gray-900 leading-tight">{vaccineFormData.name}</p>
                  </div>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="flex flex-col gap-1.5">
                        <label className="block text-sm font-bold text-gray-700">วันที่มารับบริการ</label>
                        <input 
                          type="date" 
                          required 
                          max={new Date().toISOString().split('T')[0]} 
                          className="w-full border border-gray-200 rounded-xl p-3 text-base outline-none focus:ring-2 focus:ring-[#C8102E] focus:border-transparent transition-all bg-white" 
                          value={vaccineFormData.serviceDate} 
                          onChange={e => setVaccineFormData({...vaccineFormData, serviceDate: e.target.value})} 
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="block text-sm font-bold text-gray-700">HN.</label>
                        <input 
                          type="tel" 
                          className="w-full border border-gray-200 rounded-xl p-3 text-base outline-none focus:ring-2 focus:ring-[#C8102E] focus:border-transparent transition-all bg-white" 
                          placeholder="ระบุ HN (7-10 หลัก)" 
                          minLength={7} 
                          maxLength={10} 
                          value={vaccineFormData.hn} 
                          onChange={e => setVaccineFormData({...vaccineFormData, hn: e.target.value.replace(/\D/g, '')})} 
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="block text-sm font-bold text-gray-700">การรักษา (Treatment) <span className="text-red-500">*</span></label>
                      <select 
                        required 
                        className="w-full border border-gray-200 rounded-xl p-3 text-base outline-none focus:ring-2 focus:ring-[#C8102E] focus:border-transparent transition-all bg-white" 
                        value={vaccineFormData.treatmentType} 
                        onChange={e => setVaccineFormData({...vaccineFormData, treatmentType: e.target.value})}
                      >
                        <option value="" disabled>กรุณาเลือก</option>
                        {TREATMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    {vaccineFormData.treatmentType && vaccineFormData.treatmentType !== 'Advice' && (
                      <div className="space-y-5">
                        <div className="flex flex-col gap-1.5">
                          <label className="block text-sm font-bold text-gray-700">การฉีด (Injection)</label>
                          <select 
                            className="w-full border border-gray-200 rounded-xl p-3 text-base outline-none focus:ring-2 focus:ring-[#C8102E] focus:border-transparent transition-all bg-white" 
                            value={vaccineFormData.injectionMethod} 
                            onChange={e => setVaccineFormData({...vaccineFormData, injectionMethod: e.target.value})}
                          >
                            {INJECTION_OPTIONS[vaccineFormData.treatmentType]?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="block text-sm font-bold text-gray-700">ชื่อวัคซีน</label>
                          <select 
                            className="w-full border border-gray-200 rounded-xl p-3 text-base outline-none focus:ring-2 focus:ring-[#C8102E] focus:border-transparent transition-all bg-white" 
                            value={vaccineFormData.vaccineName} 
                            onChange={e => setVaccineFormData({...vaccineFormData, vaccineName: e.target.value})}
                          >
                            <option value="" disabled>กรุณาเลือก</option>
                            {VACCINE_NAMES.map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <label className="block text-sm font-bold text-gray-700">หมายเหตุ (Note)</label>
                      <textarea 
                        className="w-full border border-gray-200 rounded-xl p-3 h-24 resize-none outline-none focus:ring-2 focus:ring-[#C8102E] focus:border-transparent transition-all bg-white" 
                        placeholder="ระบุรายละเอียดเพิ่มเติม (ถ้ามี)" 
                        value={vaccineFormData.note} 
                        onChange={e => setVaccineFormData({...vaccineFormData, note: e.target.value})} 
                      />
                    </div>
                  </div>
                  <div className="p-5 md:p-8 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row gap-3 shrink-0 rounded-b-[2.5rem] -mx-5 md:-mx-10 -mb-5 md:-mb-10">
                    <button type="button" onClick={() => setShowVaccineModal(false)} className="flex-1 py-4 border border-gray-200 rounded-2xl font-bold text-gray-600 hover:bg-white transition-colors">ยกเลิก</button>
                    <button type="submit" disabled={loading} className="flex-1 py-4 bg-[#198754] text-white rounded-2xl font-bold hover:bg-[#146c43] transition-colors shadow-lg shadow-green-600/20 disabled:opacity-50">บันทึกข้อมูล</button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Confirm Modal */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden p-8 md:p-10 text-center"
              >
                <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-600/10">
                  <Trash2 className="w-10 h-10 text-red-600" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">ยืนยันการลบข้อมูล</h3>
                <p className="text-gray-500 font-medium mb-8 leading-relaxed">กรุณากรอกรหัสผ่านเพื่อยืนยันการลบข้อมูลนี้</p>
                <input 
                  type="password" 
                  autoFocus 
                  className="w-full border-2 border-gray-100 rounded-2xl p-4 text-center text-2xl font-black tracking-[0.5em] mb-8 outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 transition-all bg-gray-50" 
                  placeholder="••••" 
                  value={deletePin} 
                  onChange={e => setDeletePin(e.target.value)} 
                />
                <div className="flex flex-col sm:flex-row gap-3">
                  <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-4 border border-gray-200 rounded-2xl font-bold text-gray-600 hover:bg-gray-50 transition-colors">ยกเลิก</button>
                  <button onClick={confirmDelete} disabled={loading} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20 disabled:opacity-50">ลบข้อมูล</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="font-sans">
      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p className="mt-4 font-bold text-gray-500 animate-pulse">กำลังโหลดข้อมูล...</p>
        </div>
      )}
      
      <AnimatePresence mode="wait">
        {view === 'check-id' && renderCheckID()}
        {view === 'register-form' && renderRegisterForm()}
        {view === 'success' && renderSuccess()}
        {view === 'admin-login' && renderAdminLogin()}
        {view === 'admin-dashboard' && renderAdminDashboard()}
      </AnimatePresence>

      {/* Error Modal */}
      <AnimatePresence>
        {errorModal.show && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-8 md:p-10 text-center">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg ${errorModal.title === 'สำเร็จ' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-[#C8102E]'}`}>
                  {errorModal.title === 'สำเร็จ' ? <CheckCircle className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">{errorModal.title}</h3>
                <p className="text-gray-500 font-medium mb-8 leading-relaxed whitespace-pre-line">{errorModal.message}</p>
                <button 
                  onClick={() => setErrorModal({ ...errorModal, show: false })} 
                  className="w-full py-5 bg-[#212529] text-white font-black rounded-2xl shadow-xl active:scale-[0.97] transition-all hover:bg-black text-lg"
                >
                  ตกลง
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
