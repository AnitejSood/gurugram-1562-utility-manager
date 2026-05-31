import React, { useState, useEffect, useRef } from 'react';
import { db, isDemoMode } from './supabaseClient';
import type { Tenant, Submission, Bill } from './supabaseClient';
import { generateBillReceiptBlob, ReceiptPreview } from './components/BillGenerator';
import type { BillData } from './components/BillGenerator';
import { 
  Plus, 
  CheckCircle, 
  Droplet, 
  Zap, 
  Settings, 
  Users, 
  FileText, 
  LogOut, 
  Lock, 
  Upload, 
  Clock, 
  CreditCard, 
  ArrowRight, 
  Image, 
  Share2, 
  Database, 
  Check, 
  AlertTriangle,
  Sun,
  Moon,
  Info
} from 'lucide-react';

function App() {
  // Navigation & Auth States
  const [role, setRole] = useState<'landing' | 'tenant' | 'admin'>('landing');
  const [adminPasscode, setAdminPasscode] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [tenantPassword, setTenantPassword] = useState('');
  const [isLightMode, setIsLightMode] = useState(false);

  // Database States
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({
    rate_per_unit: '10',
    default_water_charge: '350',
    default_motor_charge: '150'
  });

  // Admin Active Tab
  const [adminTab, setAdminTab] = useState<'overview' | 'submissions' | 'tenants' | 'history' | 'settings'>('overview');

  // Tenant Submit States
  const [tenantReading, setTenantReading] = useState('');
  const [tenantPhoto, setTenantPhoto] = useState<File | null>(null);
  const [tenantPhotoPreview, setTenantPhotoPreview] = useState<string | null>(null);
  const [isSubmittingReading, setIsSubmittingReading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Admin Action States
  const [reviewingSubmission, setReviewingSubmission] = useState<Submission | null>(null);
  const [reviewReading, setReviewReading] = useState('');
  const [reviewMaintenance, setReviewMaintenance] = useState('0');
  const [reviewWaterCharge, setReviewWaterCharge] = useState('350');
  const [reviewMotorCharge, setReviewMotorCharge] = useState('150');
  const [isApproving, setIsApproving] = useState(false);
  const [viewingBillUrl, setViewingBillUrl] = useState<string | null>(null);
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);

  // Manage Tenant States
  const [editingTenant, setEditingTenant] = useState<Partial<Tenant> | null>(null);
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);

  // Notification States
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Load Initial Data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const fetchedTenants = await db.getTenants();
      const fetchedSubmissions = await db.getSubmissions();
      const fetchedBills = await db.getBills();
      const fetchedSettings = await db.getSettings();

      setTenants(fetchedTenants);
      setSubmissions(fetchedSubmissions);
      setBills(fetchedBills);
      if (Object.keys(fetchedSettings).length > 0) {
        setSettings(prev => ({ ...prev, ...fetchedSettings }));
      }
    } catch (err: any) {
      showNotification(err.message || 'Error fetching data', 'error');
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Toggle Theme
  const toggleTheme = () => {
    setIsLightMode(!isLightMode);
    document.documentElement.classList.toggle('light-mode');
  };

  // Admin Authentication
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPasscode === 'sood1311') {
      setIsAdminAuthenticated(true);
      setRole('admin');
      setAdminPasscode('');
      showNotification('Access Granted. Welcome Admin!', 'success');
    } else {
      showNotification('Invalid Passcode. Please try again.', 'error');
    }
  };

  // Tenant Authentication
  const handleTenantLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const tenant = tenants.find(t => t.id === selectedTenantId);
    if (!tenant) return;

    // Hardcoded password validation for primary tenants to prevent cross-viewing
    const nameLower = tenant.name.toLowerCase();
    let isValid = false;

    if (nameLower.includes('aditya') && tenantPassword === '7889548580') {
      isValid = true;
    } else if (nameLower.includes('shivam') && tenantPassword === '9872321681') {
      isValid = true;
    } else if (tenant.password && tenant.password === tenantPassword) {
      isValid = true;
    }

    if (isValid) {
      setRole('tenant');
      setTenantPassword('');
      showNotification(`Welcome back, ${tenant.name}!`, 'success');
    } else {
      showNotification('Incorrect password. Please try again.', 'error');
    }
  };

  // Tenant Reading Upload Handling
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setTenantPhoto(file);
      const previewUrl = URL.createObjectURL(file);
      setTenantPhotoPreview(previewUrl);
    }
  };

  const handleTenantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantId) {
      showNotification('Please select your name', 'error');
      return;
    }
    if (!tenantReading || isNaN(Number(tenantReading))) {
      showNotification('Please enter a valid numeric meter reading', 'error');
      return;
    }
    if (!tenantPhoto) {
      showNotification('Please upload a clear photo of your meter reading', 'error');
      return;
    }

    const tenant = tenants.find(t => t.id === selectedTenantId);
    if (tenant && Number(tenantReading) < tenant.last_reading) {
      if (!window.confirm(`The reading entered (${tenantReading}) is LESS than your last recorded reading (${tenant.last_reading}). Are you sure you want to submit?`)) {
        return;
      }
    }

    setIsSubmittingReading(true);
    try {
      // 1. Upload photo to Storage
      const photoUrl = await db.uploadMeterPhoto(tenantPhoto);

      // 2. Save submission details
      await db.saveSubmission({
        tenant_id: selectedTenantId,
        reading: Number(tenantReading),
        photo_url: photoUrl
      });

      showNotification('Meter reading submitted successfully! Awaiting admin review.', 'success');
      
      // Reset form
      setTenantReading('');
      setTenantPhoto(null);
      setTenantPhotoPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      // Refresh
      fetchData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to submit reading', 'error');
    } finally {
      setIsSubmittingReading(false);
    }
  };

  // Admin Approval Calculation Setup
  const openReviewModal = (submission: Submission) => {
    const tenant = tenants.find(t => t.id === submission.tenant_id);
    setReviewingSubmission(submission);
    setReviewReading(submission.reading.toString());
    setReviewWaterCharge(tenant ? tenant.water_charge.toString() : settings.default_water_charge);
    setReviewMotorCharge(tenant ? tenant.motor_charge.toString() : settings.default_motor_charge);
    setReviewMaintenance(tenant ? tenant.default_maintenance.toString() : '0');
  };

  // Compile calculations dynamically based on modal parameters
  const getApprovalCalculations = () => {
    if (!reviewingSubmission) return null;
    const tenant = tenants.find(t => t.id === reviewingSubmission.tenant_id);
    if (!tenant) return null;

    const previousReading = tenant.last_reading;
    const currentReading = Number(reviewReading) || 0;
    const unitsConsumed = Math.max(0, currentReading - previousReading);
    const rate = Number(settings.rate_per_unit) || 10;
    const electricityCharge = unitsConsumed * rate;
    const waterCharge = Number(reviewWaterCharge) || 0;
    const motorCharge = Number(reviewMotorCharge) || 0;
    const maintenanceCharge = Number(reviewMaintenance) || 0;

    let totalAmount = electricityCharge + waterCharge + maintenanceCharge;
    if (tenant.motor_charge_rule === 'add') {
      totalAmount += motorCharge;
    } else if (tenant.motor_charge_rule === 'deduct') {
      totalAmount -= motorCharge;
    }

    return {
      tenant,
      previousReading,
      currentReading,
      unitsConsumed,
      rate,
      electricityCharge,
      waterCharge,
      motorCharge,
      motorChargeRule: tenant.motor_charge_rule,
      maintenanceCharge,
      totalAmount
    };
  };

  const handleApproveBill = async () => {
    const calc = getApprovalCalculations();
    if (!reviewingSubmission || !calc) return;

    if (calc.currentReading < calc.previousReading) {
      if (!window.confirm('The current reading is less than the previous reading. Proceed anyway?')) {
        return;
      }
    }

    setIsApproving(true);
    try {
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const currentMonth = `${monthNames[new Date().getMonth()]} ${new Date().getFullYear()}`;

      const billData: BillData = {
        tenantName: calc.tenant.name,
        flatNumber: calc.tenant.flat_number,
        month: currentMonth,
        previousReading: calc.previousReading,
        currentReading: calc.currentReading,
        unitsConsumed: calc.unitsConsumed,
        ratePerUnit: calc.rate,
        electricityCharge: calc.electricityCharge,
        waterCharge: calc.waterCharge,
        motorCharge: calc.motorCharge,
        motorChargeRule: calc.motorChargeRule,
        maintenanceCharge: calc.maintenanceCharge,
        totalAmount: calc.totalAmount
      };

      // 1. Generate Bill Image PNG Blob from Canvas
      const blob = await generateBillReceiptBlob(billData);

      // 2. Upload generated bill image to Storage
      const fileNameStr = `${calc.tenant.name.replace(/\s+/g, '_')}_${currentMonth.replace(/\s+/g, '_')}`;
      const billImageUrl = await db.uploadBillImage(blob, fileNameStr);

      // 3. Save Bill entry to database
      await db.saveBill({
        tenant_id: calc.tenant.id,
        tenant_name: calc.tenant.name,
        flat_number: calc.tenant.flat_number,
        submission_id: reviewingSubmission.id,
        month: currentMonth,
        previous_reading: calc.previousReading,
        current_reading: calc.currentReading,
        units_consumed: calc.unitsConsumed,
        rate_per_unit: calc.rate,
        electricity_charge: calc.electricityCharge,
        water_charge: calc.waterCharge,
        motor_charge: calc.motorCharge,
        motor_charge_rule: calc.motorChargeRule,
        maintenance_charge: calc.maintenanceCharge,
        total_amount: calc.totalAmount,
        bill_image_url: billImageUrl,
        status: 'unpaid'
      });

      // 4. Update the tenant submission status to approved
      await db.updateSubmissionStatus(reviewingSubmission.id, 'approved', calc.currentReading);

      showNotification(`Bill approved and generated successfully for ${calc.tenant.name}!`, 'success');
      setReviewingSubmission(null);
      fetchData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to approve bill', 'error');
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectSubmission = async (id: string) => {
    if (!window.confirm('Are you sure you want to reject this submission?')) return;
    try {
      await db.updateSubmissionStatus(id, 'rejected');
      showNotification('Submission rejected', 'info');
      setReviewingSubmission(null);
      fetchData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to reject submission', 'error');
    }
  };

  // Add/Edit Tenant Save Handler
  const handleSaveTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant?.name || !editingTenant?.phone || !editingTenant?.flat_number) {
      showNotification('Please fill in all required tenant details', 'error');
      return;
    }

    try {
      const payload: Omit<Tenant, 'id' | 'created_at'> & { id?: string } = {
        name: editingTenant.name,
        phone: editingTenant.phone,
        flat_number: editingTenant.flat_number,
        status: editingTenant.status || 'active',
        water_charge: Number(editingTenant.water_charge) ?? 350,
        motor_charge: Number(editingTenant.motor_charge) ?? 150,
        motor_charge_rule: editingTenant.motor_charge_rule || 'none',
        default_maintenance: Number(editingTenant.default_maintenance) || 0,
        last_reading: Number(editingTenant.last_reading) || 0,
        password: editingTenant.password || '1234',
        id: editingTenant.id
      };

      await db.saveTenant(payload);
      showNotification(`Tenant ${editingTenant.id ? 'updated' : 'added'} successfully`, 'success');
      setIsTenantModalOpen(false);
      setEditingTenant(null);
      fetchData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to save tenant', 'error');
    }
  };

  const handleDeleteTenant = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to completely remove tenant ${name}? This will also delete their submission history.`)) return;
    try {
      await db.deleteTenant(id);
      showNotification(`Tenant ${name} removed`, 'info');
      fetchData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete tenant', 'error');
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await db.saveSetting('rate_per_unit', settings.rate_per_unit);
      await db.saveSetting('default_water_charge', settings.default_water_charge);
      await db.saveSetting('default_motor_charge', settings.default_motor_charge);
      showNotification('Global rates updated successfully', 'success');
      fetchData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to update rates', 'error');
    }
  };

  // Mark Bill Paid
  const handleTogglePaidStatus = async (billId: string, currentStatus: 'unpaid' | 'paid') => {
    const nextStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
    try {
      await db.updateBillPaidStatus(billId, nextStatus);
      showNotification(`Bill marked as ${nextStatus.toUpperCase()}`, 'success');
      fetchData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to update payment status', 'error');
    }
  };

  // Get WhatsApp Link
  const getWhatsAppLink = (bill: Bill) => {
    const tenant = tenants.find(t => t.id === bill.tenant_id);
    const phone = tenant ? tenant.phone.replace(/[^0-9]/g, '') : '';
    // If it's a demo base64 url, replace it with a shorter string so the WhatsApp link length doesn't overflow
    const imageUrl = bill.bill_image_url.startsWith('data:') 
      ? '(Demo Mode: Image Saved Locally)' 
      : bill.bill_image_url;

    // Format message
    const message = `Hello ${bill.tenant_name},
Here is your utility statement (Electricity & Water combined) for *${bill.month}*:

• Prev Reading: ${bill.previous_reading}
• Current Reading: ${bill.current_reading}
• Electricity Consumption: ${bill.units_consumed} Units @ ₹${bill.rate_per_unit}/unit = *₹${bill.electricity_charge}*
• Fixed Water Charge: *₹${bill.water_charge}*
• Motor Charge adjustment: *${bill.motor_charge_rule === 'deduct' ? '-' : bill.motor_charge_rule === 'add' ? '+' : ''}₹${bill.motor_charge}* (${bill.motor_charge_rule === 'deduct' ? 'Deducted' : bill.motor_charge_rule === 'add' ? 'Added' : 'N/A'})
${bill.maintenance_charge > 0 ? `• Maintenance: *₹${bill.maintenance_charge}*\n` : ''}
*Total Amount Due: ₹${bill.total_amount}*

View / Download your digital bill receipt here:
${imageUrl}

Please pay online and reply with the payment screenshot. Thank you!`;

    return `https://api.whatsapp.com/send?phone=${phone.startsWith('91') ? phone : '91' + phone}&text=${encodeURIComponent(message)}`;
  };

  // Copy Bill Text to clipboard
  const copyBillText = (bill: Bill) => {
    const imageUrl = bill.bill_image_url.startsWith('data:') 
      ? '(Demo Mode: Image Saved Locally)' 
      : bill.bill_image_url;

    const message = `Hello ${bill.tenant_name},
Here is your utility statement (Electricity & Water combined) for *${bill.month}*:

• Prev Reading: ${bill.previous_reading}
• Current Reading: ${bill.current_reading}
• Electricity Consumption: ${bill.units_consumed} Units @ ₹${bill.rate_per_unit}/unit = *₹${bill.electricity_charge}*
• Fixed Water Charge: *₹${bill.water_charge}*
• Motor Charge adjustment: *${bill.motor_charge_rule === 'deduct' ? '-' : bill.motor_charge_rule === 'add' ? '+' : ''}₹${bill.motor_charge}* (${bill.motor_charge_rule === 'deduct' ? 'Deducted' : bill.motor_charge_rule === 'add' ? 'Added' : 'N/A'})
${bill.maintenance_charge > 0 ? `• Maintenance: *₹${bill.maintenance_charge}*\n` : ''}
*Total Amount Due: ₹${bill.total_amount}*

View / Download your digital bill receipt here:
${imageUrl}

Please pay online and reply with the payment screenshot. Thank you!`;

    navigator.clipboard.writeText(message)
      .then(() => showNotification('Statement details copied to clipboard!', 'success'))
      .catch(() => showNotification('Failed to copy to clipboard', 'error'));
  };

  // Calculations for Admin Overview Stats
  const pendingSubmissions = submissions.filter(s => s.status === 'pending');
  const unpaidBills = bills.filter(b => b.status === 'unpaid');
  const totalUnpaidAmount = unpaidBills.reduce((acc, curr) => acc + curr.total_amount, 0);
  const monthlyRevenue = bills.filter(b => b.status === 'paid' && b.month === `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][new Date().getMonth()]} ${new Date().getFullYear()}`).reduce((acc, curr) => acc + curr.total_amount, 0);

  return (
    <div className="app-container">
      {/* Decorative Blur Blobs */}
      <div className="bg-glow-container">
        <div className="bg-glow-blob blob-1"></div>
        <div className="bg-glow-blob blob-2"></div>
        <div className="bg-glow-blob blob-3"></div>
      </div>

      {/* Global Notifications */}
      {notification && (
        <div className={`notification glass-panel animate-slide-up ${notification.type}`}>
          {notification.type === 'success' && <CheckCircle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Modern Header Navigation */}
      <header className="glass-panel main-header animate-fade-in">
        <div className="logo-section">
          <div className="logo-icon-wrapper">
            <Zap className="electricity-icon" size={18} />
            <Droplet className="water-icon" size={14} />
          </div>
          <div>
            <h2>Gurugram 1562 Utility Manager</h2>
            <p className="app-subtitle">Electricity & Water combined billing system</p>
          </div>
        </div>

        <div className="header-actions">
          {/* Database mode indicator */}
          <div className="db-indicator-pill">
            {isDemoMode ? (
              <span className="demo-pill">
                <Info size={12} />
                Demo Mode (Local)
              </span>
            ) : (
              <span className="supabase-pill">
                <Database size={12} />
                Supabase Connected
              </span>
            )}
          </div>

          {/* Theme Toggle */}
          <button className="btn-icon theme-toggle-btn" onClick={toggleTheme} title="Toggle light/dark mode">
            {isLightMode ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          {role !== 'landing' && (
            <button className="btn btn-secondary btn-small" onClick={() => { setRole('landing'); setIsAdminAuthenticated(false); }}>
              <LogOut size={16} />
              Exit Panel
            </button>
          )}
        </div>
      </header>

      <main className="main-content-layout">
        
        {/* ==================== 1. LANDING PORTAL ==================== */}
        {role === 'landing' && (
          <div className="portal-selection-container animate-slide-up">
            <div className="portal-header">
              <h1>Select Portal Portal</h1>
              <p>Welcome! Please select your entry gate to manage or submit utility statements.</p>
            </div>

            <div className="portal-grid">
              {/* Tenant Login Entry Card */}
              <div className="glass-panel glass-panel-hover portal-card">
                <div className="portal-card-icon-wrapper tenant-purple">
                  <Users size={32} />
                </div>
                <h3>Tenant Dashboard</h3>
                <p>Upload a fresh meter photo, input your current readings manually, and track/view approved bill summaries.</p>
                
                <form onSubmit={handleTenantLogin} style={{ width: '100%' }}>
                  <div className="input-group" style={{ marginTop: '20px', width: '100%' }}>
                    <label className="input-label">Choose your name</label>
                    <select 
                      className="input-field" 
                      value={selectedTenantId} 
                      onChange={(e) => { setSelectedTenantId(e.target.value); setTenantPassword(''); }}
                    >
                      <option value="">-- Choose Tenant --</option>
                      {tenants.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.flat_number})</option>
                      ))}
                    </select>
                  </div>

                  {selectedTenantId && (
                    <div className="input-group animate-fade-in" style={{ width: '100%' }}>
                      <label className="input-label">Password</label>
                      <input 
                        type="password" 
                        className="input-field"
                        placeholder="Enter Tenant Password..."
                        value={tenantPassword}
                        onChange={(e) => setTenantPassword(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  <button 
                    type="submit"
                    className="btn btn-primary" 
                    style={{ width: '100%', marginTop: '10px' }}
                    disabled={!selectedTenantId || !tenantPassword}
                  >
                    Enter Tenant Space
                    <ArrowRight size={16} />
                  </button>
                </form>
              </div>

              {/* Admin Login Entry Card */}
              <div className="glass-panel glass-panel-hover portal-card">
                <div className="portal-card-icon-wrapper admin-cyan">
                  <Lock size={32} />
                </div>
                <h3>Landlord / Admin Portal</h3>
                <p>Add/Remove tenants, review uploads, correct manual entries, adjust default charges, and print bills.</p>
                
                <form onSubmit={handleAdminLogin} style={{ width: '100%', marginTop: '20px' }}>
                  <div className="input-group">
                    <label className="input-label">Passcode</label>
                    <input 
                      type="password" 
                      className="input-field"
                      placeholder="Enter Admin Password..."
                      value={adminPasscode}
                      onChange={(e) => setAdminPasscode(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', background: 'linear-gradient(135deg, var(--secondary) 0%, #0891b2 100%)', boxShadow: '0 4px 14px 0 var(--secondary-glow)' }}>
                    Verify & Enter
                    <ArrowRight size={16} />
                  </button>
                </form>
              </div>
            </div>

            {/* Quick Demo setup assistance banner for user guidance */}
            {isDemoMode && (
              <div className="glass-panel demo-instructions-card">
                <h4>💡 Getting Started in Demo Mode</h4>
                <p>The app has automatically loaded test accounts for <strong>Mr. Aditya</strong> and <strong>Mr. Shivam</strong>. You can enter the Tenant Space to submit a mock reading, then enter Admin Space using passcode <code>sood1311</code> to review, customize charges (like Aditya's 5000 maintenance), auto-generate the PNG bill invoice, and print/share it!</p>
              </div>
            )}
          </div>
        )}

        {/* ==================== 2. TENANT DASHBOARD ==================== */}
        {role === 'tenant' && (() => {
          const tenant = tenants.find(t => t.id === selectedTenantId);
          const tenantBills = bills.filter(b => b.tenant_id === selectedTenantId);
          const tenantSubmissions = submissions.filter(s => s.tenant_id === selectedTenantId);

          if (!tenant) return null;

          return (
            <div className="tenant-dashboard-layout animate-slide-up">
              {/* Back to landing & Title */}
              <div className="dashboard-title-row">
                <div>
                  <span className="tenant-badge-indicator">Tenant Member</span>
                  <h1>Welcome, {tenant.name}</h1>
                  <p className="text-muted">{tenant.flat_number} • Phone: {tenant.phone}</p>
                </div>
                <button className="btn btn-secondary" onClick={() => setRole('landing')}>
                  Logout
                </button>
              </div>

              <div className="dashboard-grid">
                
                {/* Submit New Meter Reading Form */}
                <div className="glass-panel card-container">
                  <div className="card-header">
                    <Zap size={22} className="card-header-icon" />
                    <h3>Submit Monthly Reading</h3>
                  </div>

                  <div className="info-block glass-panel">
                    <span className="info-block-title">Your Previous Stored Reading:</span>
                    <h2 className="info-block-value">{tenant.last_reading} units</h2>
                    <p className="info-block-footer">Submit readings in the beginning of each month.</p>
                  </div>

                  <form onSubmit={handleTenantSubmit} style={{ marginTop: '20px' }}>
                    <div className="input-group">
                      <label className="input-label">Current Meter Reading (Manually)</label>
                      <input 
                        type="number" 
                        className="input-field" 
                        placeholder={`Must be greater than ${tenant.last_reading}`}
                        value={tenantReading}
                        onChange={(e) => setTenantReading(e.target.value)}
                        required
                        disabled={isSubmittingReading}
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label">Meter Reading Proof Photo</label>
                      <div className="photo-upload-zone" onClick={() => fileInputRef.current?.click()}>
                        {tenantPhotoPreview ? (
                          <div className="upload-preview-container">
                            <img src={tenantPhotoPreview} alt="Meter Preview" className="upload-preview-img" />
                            <div className="change-photo-overlay">
                              <Upload size={18} />
                              Change Photo
                            </div>
                          </div>
                        ) : (
                          <div className="upload-placeholder">
                            <Upload size={32} />
                            <p>Click to upload a clear meter photo</p>
                            <span>Supports JPG, PNG</span>
                          </div>
                        )}
                      </div>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handlePhotoChange} 
                        style={{ display: 'none' }} 
                        accept="image/*"
                        required
                      />
                    </div>

                    <button 
                      type="submit" 
                      className="btn btn-primary" 
                      style={{ width: '100%', marginTop: '10px' }}
                      disabled={isSubmittingReading}
                    >
                      {isSubmittingReading ? (
                        <>
                          <Clock className="spin" size={16} />
                          Uploading and Submitting...
                        </>
                      ) : (
                        <>
                          Submit Reading
                          <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Tenant Bills History */}
                <div className="tenant-history-panel">
                  {/* Bill Summaries */}
                  <div className="glass-panel card-container">
                    <div className="card-header">
                      <FileText size={22} className="card-header-icon" />
                      <h3>Your Bill History</h3>
                    </div>

                    {tenantBills.length === 0 ? (
                      <p className="no-data-text">No bills generated for you yet. Your landlord will approve your reading submissions first.</p>
                    ) : (
                      <div className="history-bills-list">
                        {tenantBills.map(bill => (
                          <div key={bill.id} className="glass-panel history-bill-card">
                            <div className="bill-card-header">
                              <div>
                                <h4>{bill.month}</h4>
                                <p className="text-muted">Total: {bill.units_consumed} Units (Reading: {bill.previous_reading} - {bill.current_reading})</p>
                              </div>
                              <span className={`badge ${bill.status === 'paid' ? 'badge-approved' : 'badge-unpaid'}`}>
                                {bill.status === 'paid' ? 'Paid' : 'Unpaid'}
                              </span>
                            </div>

                            <div className="bill-card-charges">
                              <div className="charge-mini-row">
                                <span>Electricity ({bill.units_consumed} units @ ₹{bill.rate_per_unit}):</span>
                                <strong>₹{bill.electricity_charge}</strong>
                              </div>
                              <div className="charge-mini-row">
                                <span>Fixed Water:</span>
                                <strong>₹{bill.water_charge}</strong>
                              </div>
                              <div className="charge-mini-row">
                                <span>Motor Charges:</span>
                                <strong>
                                  {bill.motor_charge_rule === 'deduct' ? '-' : bill.motor_charge_rule === 'add' ? '+' : ''}₹{bill.motor_charge}
                                </strong>
                              </div>
                              {bill.maintenance_charge > 0 && (
                                <div className="charge-mini-row">
                                  <span>Maintenance:</span>
                                  <strong>₹{bill.maintenance_charge}</strong>
                                </div>
                              )}
                              <div className="charge-total-divider"></div>
                              <div className="charge-mini-row grand-total-text">
                                <span>Grand Total:</span>
                                <strong>₹{bill.total_amount}</strong>
                              </div>
                            </div>

                            <div className="bill-card-actions">
                              <button 
                                className="btn btn-secondary btn-small"
                                onClick={() => setViewingBillUrl(bill.bill_image_url)}
                              >
                                <Image size={14} />
                                View Receipt Image
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Submission History Status */}
                  <div className="glass-panel card-container" style={{ marginTop: '20px' }}>
                    <div className="card-header">
                      <Clock size={20} className="card-header-icon" />
                      <h3>Reading Uploads History</h3>
                    </div>

                    {tenantSubmissions.length === 0 ? (
                      <p className="no-data-text">You have not submitted any readings yet.</p>
                    ) : (
                      <div className="glass-table-container">
                        <table className="glass-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Submitted Reading</th>
                              <th>Photo Proof</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tenantSubmissions.map(sub => (
                              <tr key={sub.id}>
                                <td>{new Date(sub.submitted_at).toLocaleDateString('en-IN')}</td>
                                <td>{sub.reading}</td>
                                <td>
                                  <button className="btn-icon" onClick={() => setViewingPhotoUrl(sub.photo_url)} title="View uploaded photo">
                                    <Image size={14} />
                                  </button>
                                </td>
                                <td>
                                  <span className={`badge ${
                                    sub.status === 'approved' ? 'badge-approved' : 
                                    sub.status === 'rejected' ? 'badge-rejected' : 'badge-pending'
                                  }`}>
                                    {sub.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          );
        })()}

        {/* ==================== 3. ADMIN PORTAL ==================== */}
        {role === 'admin' && isAdminAuthenticated && (
          <div className="admin-dashboard-layout animate-slide-up">
            
            {/* Admin Header Title */}
            <div className="dashboard-title-row">
              <div>
                <span className="admin-badge-indicator">System Administrator</span>
                <h1>Admin Control Panel</h1>
                <p className="text-muted">Control rates, edit/approve submissions, and manage tenant records</p>
              </div>
              <div className="admin-header-tabs glass-panel">
                <button className={`tab-btn ${adminTab === 'overview' ? 'active' : ''}`} onClick={() => setAdminTab('overview')}>
                  Overview
                </button>
                <button className={`tab-btn ${adminTab === 'submissions' ? 'active' : ''}`} onClick={() => setAdminTab('submissions')}>
                  Submissions ({pendingSubmissions.length})
                </button>
                <button className={`tab-btn ${adminTab === 'tenants' ? 'active' : ''}`} onClick={() => setAdminTab('tenants')}>
                  Tenants
                </button>
                <button className={`tab-btn ${adminTab === 'history' ? 'active' : ''}`} onClick={() => setAdminTab('history')}>
                  Bills ({unpaidBills.length} unpaid)
                </button>
                <button className={`tab-btn ${adminTab === 'settings' ? 'active' : ''}`} onClick={() => setAdminTab('settings')}>
                  Settings
                </button>
              </div>
            </div>

            {/* TAB CONTENT: 1. OVERVIEW */}
            {adminTab === 'overview' && (
              <div className="admin-overview-grid animate-fade-in">
                
                {/* Stats Panel */}
                <div className="stats-row">
                  <div className="glass-panel stat-card">
                    <Clock className="stat-icon" size={24} style={{ color: 'var(--warning)' }} />
                    <div className="stat-data">
                      <h3>{pendingSubmissions.length}</h3>
                      <p>Pending Reading Reviews</p>
                    </div>
                  </div>

                  <div className="glass-panel stat-card">
                    <AlertTriangle className="stat-icon" size={24} style={{ color: 'var(--danger)' }} />
                    <div className="stat-data">
                      <h3>{unpaidBills.length}</h3>
                      <p>Unpaid Invoices</p>
                    </div>
                  </div>

                  <div className="glass-panel stat-card">
                    <CreditCard className="stat-icon" size={24} style={{ color: 'var(--secondary)' }} />
                    <div className="stat-data">
                      <h3>₹{totalUnpaidAmount}</h3>
                      <p>Total Outstanding Dues</p>
                    </div>
                  </div>

                  <div className="glass-panel stat-card">
                    <Check className="stat-icon" size={24} style={{ color: 'var(--success)' }} />
                    <div className="stat-data">
                      <h3>₹{monthlyRevenue}</h3>
                      <p>This Month Received Revenue</p>
                    </div>
                  </div>
                </div>

                <div className="dashboard-grid" style={{ marginTop: '20px' }}>
                  {/* Left Column: Quick Reviews */}
                  <div className="glass-panel card-container">
                    <div className="card-header">
                      <Clock size={20} className="card-header-icon" />
                      <h3>Awaiting Action</h3>
                    </div>

                    {pendingSubmissions.length === 0 ? (
                      <div className="empty-state">
                        <CheckCircle size={40} style={{ color: 'var(--success)', marginBottom: '12px' }} />
                        <p>All clean! There are no pending tenant meter readings to approve right now.</p>
                      </div>
                    ) : (
                      <div className="pending-reviews-list">
                        {pendingSubmissions.map(sub => {
                          const tenant = tenants.find(t => t.id === sub.tenant_id);
                          return (
                            <div key={sub.id} className="glass-panel review-strip-card">
                              <div className="review-strip-info">
                                <h4>{sub.tenant_name}</h4>
                                <p className="text-muted">{sub.flat_number} • Stored last reading: {tenant?.last_reading ?? 0}</p>
                                <span className="entered-reading-indicator">
                                  Entered: <strong>{sub.reading}</strong>
                                </span>
                              </div>
                              <div className="review-strip-actions">
                                <button className="btn btn-secondary btn-small" onClick={() => setViewingPhotoUrl(sub.photo_url)}>
                                  <Image size={14} />
                                  Proof Photo
                                </button>
                                <button className="btn btn-primary btn-small" onClick={() => openReviewModal(sub)}>
                                  Review & Approve
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Active Tenants Quick Overview */}
                  <div className="glass-panel card-container">
                    <div className="card-header">
                      <Users size={20} className="card-header-icon" />
                      <h3>Tenant Directory & Last Readings</h3>
                    </div>
                    <div className="glass-table-container">
                      <table className="glass-table">
                        <thead>
                          <tr>
                            <th>Tenant</th>
                            <th>Flat</th>
                            <th>Last Reading</th>
                            <th>Motor Rules</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tenants.map(t => (
                            <tr key={t.id}>
                              <td>{t.name}</td>
                              <td>{t.flat_number}</td>
                              <td><strong>{t.last_reading}</strong></td>
                              <td>
                                <span className="motor-rule-pill" style={{ 
                                  backgroundColor: t.motor_charge_rule === 'add' ? 'rgba(16, 185, 129, 0.12)' : t.motor_charge_rule === 'deduct' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255,255,255,0.05)',
                                  color: t.motor_charge_rule === 'add' ? 'var(--success)' : t.motor_charge_rule === 'deduct' ? 'var(--danger)' : 'var(--text-muted)'
                                }}>
                                  {t.motor_charge_rule === 'add' ? '+150 Motor' : t.motor_charge_rule === 'deduct' ? '-150 Motor' : 'None'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* TAB CONTENT: 2. SUBMISSIONS LIST */}
            {adminTab === 'submissions' && (
              <div className="glass-panel card-container animate-fade-in">
                <div className="card-header">
                  <Clock size={22} className="card-header-icon" />
                  <h3>Tenant Meter Submissions Review</h3>
                </div>

                {submissions.length === 0 ? (
                  <p className="no-data-text">No submissions received in the database yet.</p>
                ) : (
                  <div className="glass-table-container">
                    <table className="glass-table">
                      <thead>
                        <tr>
                          <th>Tenant</th>
                          <th>Flat</th>
                          <th>Submitted Reading</th>
                          <th>Date / Time</th>
                          <th>Photo proof</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {submissions.map(sub => (
                          <tr key={sub.id}>
                            <td>{sub.tenant_name}</td>
                            <td>{sub.flat_number}</td>
                            <td><strong>{sub.reading}</strong></td>
                            <td>{new Date(sub.submitted_at).toLocaleString('en-IN')}</td>
                            <td>
                              <button className="btn btn-secondary btn-small" onClick={() => setViewingPhotoUrl(sub.photo_url)}>
                                <Image size={12} />
                                View Proof
                              </button>
                            </td>
                            <td>
                              <span className={`badge ${
                                sub.status === 'approved' ? 'badge-approved' : 
                                sub.status === 'rejected' ? 'badge-rejected' : 'badge-pending'
                              }`}>
                                {sub.status}
                              </span>
                            </td>
                            <td>
                              {sub.status === 'pending' ? (
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button className="btn btn-success btn-small" onClick={() => openReviewModal(sub)}>
                                    Approve Bill
                                  </button>
                                  <button className="btn btn-danger btn-small" onClick={() => handleRejectSubmission(sub.id)}>
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-muted" style={{ fontSize: '0.85rem' }}>Reviewed</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: 3. TENANTS MANAGEMENT */}
            {adminTab === 'tenants' && (
              <div className="glass-panel card-container animate-fade-in">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={22} className="card-header-icon" />
                    <h3>Tenant Directory</h3>
                  </div>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => {
                      setEditingTenant({
                        name: '',
                        phone: '',
                        flat_number: '',
                        status: 'active',
                        water_charge: Number(settings.default_water_charge),
                        motor_charge: Number(settings.default_motor_charge),
                        motor_charge_rule: 'none',
                        default_maintenance: 0,
                        last_reading: 0
                      });
                      setIsTenantModalOpen(true);
                    }}
                  >
                    <Plus size={16} />
                    Add Tenant
                  </button>
                </div>

                {tenants.length === 0 ? (
                  <p className="no-data-text">No tenants configured yet. Click "Add Tenant" to create records.</p>
                ) : (
                  <div className="glass-table-container">
                    <table className="glass-table">
                      <thead>
                        <tr>
                          <th>Tenant Name</th>
                          <th>Flat Number</th>
                          <th>Phone</th>
                          <th>Last Reading</th>
                          <th>Water Charge</th>
                          <th>Motor Charge Adjustments</th>
                          <th>Default Maintenance</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tenants.map(t => (
                          <tr key={t.id}>
                            <td><strong>{t.name}</strong></td>
                            <td>{t.flat_number}</td>
                            <td>{t.phone}</td>
                            <td>{t.last_reading}</td>
                            <td>₹{t.water_charge}</td>
                            <td>
                              <span className={`badge ${
                                t.motor_charge_rule === 'add' ? 'badge-approved' : 
                                t.motor_charge_rule === 'deduct' ? 'badge-rejected' : 'badge-pending'
                              }`} style={{ textTransform: 'capitalize' }}>
                                {t.motor_charge_rule === 'add' && `+₹${t.motor_charge} Add`}
                                {t.motor_charge_rule === 'deduct' && `-₹${t.motor_charge} Deduct`}
                                {t.motor_charge_rule === 'none' && 'No Motor Charge'}
                              </span>
                            </td>
                            <td>₹{t.default_maintenance}</td>
                            <td>
                              <span className={`badge ${t.status === 'active' ? 'badge-approved' : 'badge-unpaid'}`}>
                                {t.status}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button 
                                  className="btn btn-secondary btn-small"
                                  onClick={() => {
                                    setEditingTenant(t);
                                    setIsTenantModalOpen(true);
                                  }}
                                >
                                  Edit
                                </button>
                                <button 
                                  className="btn btn-danger btn-small"
                                  onClick={() => handleDeleteTenant(t.id, t.name)}
                                >
                                  Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: 4. BILL HISTORY */}
            {adminTab === 'history' && (
              <div className="glass-panel card-container animate-fade-in">
                <div className="card-header">
                  <FileText size={22} className="card-header-icon" />
                  <h3>Approved Invoices Ledger</h3>
                </div>

                {bills.length === 0 ? (
                  <p className="no-data-text">No bills generated yet.</p>
                ) : (
                  <div className="glass-table-container">
                    <table className="glass-table">
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th>Tenant</th>
                          <th>Consumption</th>
                          <th>Total Amount</th>
                          <th>Receipt</th>
                          <th>Payment Status</th>
                          <th>Toggle Payment</th>
                          <th>Share WhatsApp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bills.map(bill => (
                          <tr key={bill.id}>
                            <td><strong>{bill.month}</strong></td>
                            <td>{bill.tenant_name} ({bill.flat_number})</td>
                            <td style={{ fontSize: '0.85rem' }}>
                              Reading: {bill.previous_reading} → {bill.current_reading} ({bill.units_consumed} Units)
                            </td>
                            <td><strong>₹{bill.total_amount}</strong></td>
                            <td>
                              <button className="btn btn-secondary btn-small" onClick={() => setViewingBillUrl(bill.bill_image_url)}>
                                <Image size={12} />
                                View PNG
                              </button>
                            </td>
                            <td>
                              <span className={`badge ${bill.status === 'paid' ? 'badge-approved' : 'badge-unpaid'}`}>
                                {bill.status}
                              </span>
                            </td>
                            <td>
                              <button 
                                className={`btn btn-small ${bill.status === 'paid' ? 'btn-secondary' : 'btn-success'}`}
                                onClick={() => handleTogglePaidStatus(bill.id, bill.status)}
                              >
                                {bill.status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                              </button>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <a 
                                  href={getWhatsAppLink(bill)} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="btn btn-primary btn-small whatsapp-link-btn"
                                  style={{ display: 'inline-flex', background: '#25D366', boxShadow: 'none', padding: '8px 12px' }}
                                >
                                  <Share2 size={12} />
                                  Share
                                </a>
                                <button
                                  className="btn btn-secondary btn-small"
                                  style={{ padding: '8px 12px' }}
                                  onClick={() => copyBillText(bill)}
                                  title="Copy bill details text"
                                >
                                  Copy
                                </button>
                              </div>
                            </td>

                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: 5. SETTINGS RATES */}
            {adminTab === 'settings' && (
              <div className="glass-panel card-container animate-fade-in" style={{ maxWidth: '600px' }}>
                <div className="card-header">
                  <Settings size={22} className="card-header-icon" />
                  <h3>Global Rate Settings</h3>
                </div>

                <form onSubmit={handleSaveSettings} style={{ marginTop: '10px' }}>
                  <div className="input-group">
                    <label className="input-label">Electricity Unit Cost (₹ per unit)</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={settings.rate_per_unit}
                      onChange={(e) => setSettings(prev => ({ ...prev, rate_per_unit: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Default Water Charge (₹ per month)</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={settings.default_water_charge}
                      onChange={(e) => setSettings(prev => ({ ...prev, default_water_charge: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Default Motor Charge (₹ per month)</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={settings.default_motor_charge}
                      onChange={(e) => setSettings(prev => ({ ...prev, default_motor_charge: e.target.value }))}
                      required
                    />
                  </div>

                  <button type="submit" className="btn btn-primary">
                    Save Config Settings
                  </button>
                </form>
              </div>
            )}

          </div>
        )}

      </main>

      {/* ==================== 4. MODALS & OVERLAYS ==================== */}

      {/* MODAL 1: VIEW PROOF METER PHOTO */}
      {viewingPhotoUrl && (
        <div className="modal-overlay" onClick={() => setViewingPhotoUrl(null)}>
          <div className="modal-content glass-panel animate-slide-up" style={{ maxWidth: '500px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Uploaded Meter Reading Photo</h3>
              <button className="btn-icon" onClick={() => setViewingPhotoUrl(null)}>✕</button>
            </div>
            <div style={{ marginTop: '15px', textAlign: 'center' }}>
              <img 
                src={viewingPhotoUrl} 
                alt="Uploaded Meter Proof" 
                style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)' }} 
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: VIEW COMPLETED BILL PNG */}
      {viewingBillUrl && (
        <div className="modal-overlay" onClick={() => setViewingBillUrl(null)}>
          <div className="modal-content glass-panel animate-slide-up" style={{ maxWidth: '480px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Bill Receipt Preview</h3>
              <button className="btn-icon" onClick={() => setViewingBillUrl(null)}>✕</button>
            </div>
            <div style={{ marginTop: '15px', textAlign: 'center', backgroundColor: '#f1f5f9', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
              <img 
                src={viewingBillUrl} 
                alt="Approved Statement Receipt" 
                style={{ maxWidth: '100%', borderRadius: '4px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <a 
                href={viewingBillUrl} 
                download="Gurugram_1562_Utility_Bill.png" 
                className="btn btn-primary"
                style={{ flex: 1, textDecoration: 'none', textAlign: 'center' }}
              >
                Download PNG File
              </a>
              <button className="btn btn-secondary" onClick={() => setViewingBillUrl(null)} style={{ flex: 1 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADMIN BILL APPROVAL PIPELINE */}
      {reviewingSubmission && (() => {
        const calc = getApprovalCalculations();
        if (!calc) return null;

        return (
          <div className="modal-overlay">
            <div className="modal-content glass-panel animate-slide-up review-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Approve Bill: {calc.tenant.name}</h3>
                <button className="btn-icon" onClick={() => setReviewingSubmission(null)}>✕</button>
              </div>

              <div className="review-grid">
                
                {/* Inputs & Parameters Column */}
                <div className="review-inputs-column">
                  <div className="input-group">
                    <label className="input-label">Submitted Reading (Double check photo)</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={reviewReading}
                      onChange={(e) => setReviewReading(e.target.value)}
                      required
                    />
                    <span className="helper-label-text">
                      Previous Stored Reading: <strong>{calc.previousReading}</strong> units
                    </span>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Water Charge (₹)</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={reviewWaterCharge}
                      onChange={(e) => setReviewWaterCharge(e.target.value)}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Motor Charge Adjustment (₹)</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={reviewMotorCharge}
                      onChange={(e) => setReviewMotorCharge(e.target.value)}
                      required
                    />
                    <span className="helper-label-text">
                      Motor Rule: <strong>{calc.motorChargeRule === 'add' ? 'Added (+)' : calc.motorChargeRule === 'deduct' ? 'Deducted (-)' : 'None'}</strong>
                    </span>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Add Maintenance Charge (₹)</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={reviewMaintenance}
                      onChange={(e) => setReviewMaintenance(e.target.value)}
                      required
                    />
                  </div>

                  {/* Math Breakdown Table */}
                  <div className="glass-panel review-calculations-breakdown">
                    <h4>Calculations Summary:</h4>
                    <div className="breakdown-row">
                      <span>Units Consumed:</span>
                      <span>{calc.unitsConsumed} Units</span>
                    </div>
                    <div className="breakdown-row">
                      <span>Electricity Charge:</span>
                      <span>₹{calc.electricityCharge}</span>
                    </div>
                    <div className="breakdown-row">
                      <span>Water Charge:</span>
                      <span>+₹{calc.waterCharge}</span>
                    </div>
                    <div className="breakdown-row">
                      <span>Motor Adjustment:</span>
                      <span>
                        {calc.motorChargeRule === 'add' ? '+' : calc.motorChargeRule === 'deduct' ? '-' : ''}₹{calc.motorCharge}
                      </span>
                    </div>
                    <div className="breakdown-row">
                      <span>Maintenance:</span>
                      <span>+₹{calc.maintenanceCharge}</span>
                    </div>
                    <div className="breakdown-divider"></div>
                    <div className="breakdown-row final-total-row">
                      <span>Final Due Total:</span>
                      <strong>₹{calc.totalAmount}</strong>
                    </div>
                  </div>

                  <div className="review-btn-row">
                    <button className="btn btn-danger" onClick={() => handleRejectSubmission(reviewingSubmission.id)}>
                      Reject Reading
                    </button>
                    <button className="btn btn-success" onClick={handleApproveBill} disabled={isApproving}>
                      {isApproving ? (
                        <>
                          <Clock className="spin" size={14} />
                          Generating...
                        </>
                      ) : (
                        'Generate & Approve'
                      )}
                    </button>
                  </div>
                </div>

                {/* Live Preview Column */}
                <div className="review-preview-column">
                  <div className="preview-header">
                    <h4>Proof Photo vs Bill Receipt Preview</h4>
                  </div>
                  <div className="preview-split-box">
                    <div className="preview-pane">
                      <span className="pane-label">Submitted Proof Photo</span>
                      <img src={reviewingSubmission.photo_url} alt="Proof" className="mini-preview-image" />
                    </div>
                    <div className="preview-pane">
                      <span className="pane-label">Live Receipt Image Render</span>
                      <ReceiptPreview 
                        data={{
                          tenantName: calc.tenant.name,
                          flatNumber: calc.tenant.flat_number,
                          month: `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][new Date().getMonth()]} ${new Date().getFullYear()}`,
                          previousReading: calc.previousReading,
                          currentReading: calc.currentReading,
                          unitsConsumed: calc.unitsConsumed,
                          ratePerUnit: calc.rate,
                          electricityCharge: calc.electricityCharge,
                          waterCharge: calc.waterCharge,
                          motorCharge: calc.motorCharge,
                          motorChargeRule: calc.motorChargeRule,
                          maintenanceCharge: calc.maintenanceCharge,
                          totalAmount: calc.totalAmount
                        }}
                      />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 4: ADD/EDIT TENANT RECORD */}
      {isTenantModalOpen && editingTenant && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-slide-up" style={{ maxWidth: '500px', width: '90%' }}>
            <div className="modal-header">
              <h3>{editingTenant.id ? 'Edit Tenant Details' : 'Add New Tenant'}</h3>
              <button className="btn-icon" onClick={() => { setIsTenantModalOpen(false); setEditingTenant(null); }}>✕</button>
            </div>

            <form onSubmit={handleSaveTenant} style={{ marginTop: '15px' }}>
              <div className="input-group">
                <label className="input-label">Tenant Name *</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={editingTenant.name || ''}
                  onChange={(e) => setEditingTenant(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Mr. Aditya"
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Phone Number * (For WhatsApp sharing)</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={editingTenant.phone || ''}
                  onChange={(e) => setEditingTenant(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="e.g. 9876543210 (without country code)"
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Flat / House Number *</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={editingTenant.flat_number || ''}
                  onChange={(e) => setEditingTenant(prev => ({ ...prev, flat_number: e.target.value }))}
                  placeholder="e.g. First Floor (Flat 1)"
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Initial Electricity Meter Reading *</label>
                <input 
                  type="number" 
                  className="input-field" 
                  value={editingTenant.last_reading ?? 0}
                  onChange={(e) => setEditingTenant(prev => ({ ...prev, last_reading: Number(e.target.value) }))}
                  placeholder="Initial starting reading"
                  required
                  disabled={!!editingTenant.id} // Stored readings should not be randomly overwritten from this modal once active
                />
                {editingTenant.id && (
                  <span className="helper-label-text">
                    Note: To correct a reading error, approve a new submission with corrected value instead.
                  </span>
                )}
              </div>

              <div className="input-group">
                <label className="input-label">Motor Charge Rule</label>
                <select 
                  className="input-field" 
                  value={editingTenant.motor_charge_rule || 'none'}
                  onChange={(e) => setEditingTenant(prev => ({ ...prev, motor_charge_rule: e.target.value as any }))}
                >
                  <option value="none">No Motor Charges</option>
                  <option value="add">Add Motor Charge (Shivam style - pumps water)</option>
                  <option value="deduct">Deduct Motor Charge (Aditya style - runs on his meter)</option>
                </select>
              </div>

              <div className="grid-2-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="input-group">
                  <label className="input-label">Default Water (₹)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={editingTenant.water_charge ?? settings.default_water_charge}
                    onChange={(e) => setEditingTenant(prev => ({ ...prev, water_charge: Number(e.target.value) }))}
                    required
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Default Motor (₹)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={editingTenant.motor_charge ?? settings.default_motor_charge}
                    onChange={(e) => setEditingTenant(prev => ({ ...prev, motor_charge: Number(e.target.value) }))}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Default Maintenance Charge (₹)</label>
                <input 
                  type="number" 
                  className="input-field" 
                  value={editingTenant.default_maintenance ?? 0}
                  onChange={(e) => setEditingTenant(prev => ({ ...prev, default_maintenance: Number(e.target.value) }))}
                  placeholder="e.g. 5000"
                />
              </div>

              <div className="input-group">
                <label className="input-label">Access Password *</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={editingTenant.password || ''}
                  onChange={(e) => setEditingTenant(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Password for tenant space..."
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Tenant Status</label>
                <select 
                  className="input-field" 
                  value={editingTenant.status || 'active'}
                  onChange={(e) => setEditingTenant(prev => ({ ...prev, status: e.target.value as any }))}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Save Record
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => { setIsTenantModalOpen(false); setEditingTenant(null); }} style={{ flex: 1 }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
