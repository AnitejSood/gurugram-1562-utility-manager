import { createClient } from '@supabase/supabase-js';
import { localStore } from './localStore';
import type { Tenant, Submission, Bill } from './localStore';

// Retrieve environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if credentials are set. If not, fallback to Demo Mode using localStorage
export const isDemoMode = !supabaseUrl || !supabaseAnonKey || supabaseUrl === 'YOUR_SUPABASE_URL';

if (isDemoMode) {
  console.warn(
    'Supabase URL and Anon Key are missing. Application is running in Demo Mode with LocalStorage storage.'
  );
}

// Initialize actual Supabase client if not in Demo Mode
export const supabase = !isDemoMode
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Helper to convert File or Blob to Base64 String for localStorage storage in Demo Mode
const convertBlobToBase64 = (blob: Blob | File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Unified gateway interface for all database and storage actions
export const db = {
  // --- TENANTS ---
  async getTenants(): Promise<Tenant[]> {
    if (isDemoMode) {
      return localStore.getTenants();
    }
    const { data, error } = await supabase!
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async saveTenant(tenant: Omit<Tenant, 'id' | 'created_at'> & { id?: string }): Promise<Tenant> {
    if (isDemoMode) {
      return localStore.saveTenant(tenant);
    }
    if (tenant.id) {
      // Update
      const { data, error } = await supabase!
        .from('tenants')
        .update(tenant)
        .eq('id', tenant.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      // Insert
      const { data, error } = await supabase!
        .from('tenants')
        .insert([tenant])
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  async deleteTenant(id: string): Promise<void> {
    if (isDemoMode) {
      localStore.deleteTenant(id);
      return;
    }
    const { error } = await supabase!
      .from('tenants')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // --- SUBMISSIONS ---
  async getSubmissions(): Promise<Submission[]> {
    if (isDemoMode) {
      return localStore.getSubmissions();
    }
    // Fetch submissions joined with tenant info
    const { data, error } = await supabase!
      .from('submissions')
      .select(`
        *,
        tenants (
          name,
          flat_number
        )
      `)
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    
    return (data || []).map((sub: any) => ({
      ...sub,
      tenant_name: sub.tenants?.name || 'Unknown Tenant',
      flat_number: sub.tenants?.flat_number || 'N/A'
    }));
  },

  async saveSubmission(submission: Omit<Submission, 'id' | 'status' | 'submitted_at'>): Promise<Submission> {
    if (isDemoMode) {
      return localStore.saveSubmission(submission);
    }
    const { data, error } = await supabase!
      .from('submissions')
      .insert([submission])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateSubmissionStatus(id: string, status: 'approved' | 'rejected', reading?: number): Promise<void> {
    if (isDemoMode) {
      localStore.updateSubmissionStatus(id, status, reading);
      return;
    }
    const updatePayload: any = { status };
    if (reading !== undefined) {
      updatePayload.reading = reading;
    }
    const { error } = await supabase!
      .from('submissions')
      .update(updatePayload)
      .eq('id', id);
    if (error) throw error;
  },

  // --- BILLS ---
  async getBills(): Promise<Bill[]> {
    if (isDemoMode) {
      return localStore.getBills();
    }
    const { data, error } = await supabase!
      .from('bills')
      .select(`
        *,
        tenants (
          name,
          flat_number
        )
      `)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return (data || []).map((bill: any) => ({
      ...bill,
      tenant_name: bill.tenants?.name || 'Deleted Tenant',
      flat_number: bill.tenants?.flat_number || 'N/A'
    }));
  },

  async saveBill(bill: Omit<Bill, 'id' | 'created_at'>): Promise<Bill> {
    if (isDemoMode) {
      return localStore.saveBill(bill);
    }
    // Save bill
    const { data, error } = await supabase!
      .from('bills')
      .insert([bill])
      .select()
      .single();
    if (error) throw error;

    // Update tenant's last reading to the current reading of this bill
    const { error: tenantError } = await supabase!
      .from('tenants')
      .update({ last_reading: bill.current_reading })
      .eq('id', bill.tenant_id);
    if (tenantError) throw tenantError;

    return data;
  },

  async updateBillPaidStatus(id: string, status: 'unpaid' | 'paid'): Promise<void> {
    if (isDemoMode) {
      localStore.updateBillPaidStatus(id, status);
      return;
    }
    const { error } = await supabase!
      .from('bills')
      .update({ 
        status, 
        paid_at: status === 'paid' ? new Date().toISOString() : null 
      })
      .eq('id', id);
    if (error) throw error;
  },

  // --- SETTINGS ---
  async getSettings(): Promise<Record<string, string>> {
    if (isDemoMode) {
      return localStore.getSettings();
    }
    const { data, error } = await supabase!
      .from('settings')
      .select('*');
    if (error) throw error;
    
    const settingsMap: Record<string, string> = {};
    (data || []).forEach((item: any) => {
      settingsMap[item.key] = item.value;
    });
    return settingsMap;
  },

  async saveSetting(key: string, value: string): Promise<void> {
    if (isDemoMode) {
      localStore.saveSetting(key, value);
      return;
    }
    const { error } = await supabase!
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw error;
  },

  // --- FILE STORAGE UPLOADS ---
  async uploadMeterPhoto(file: File): Promise<string> {
    if (isDemoMode) {
      // In demo mode, convert the file to a Data URL (base64) so it renders correctly locally
      return await convertBlobToBase64(file);
    }
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 11)}_${Date.now()}.${fileExt}`;
    const filePath = `meters/${fileName}`;

    const { error } = await supabase!
      .storage
      .from('meter-photos')
      .upload(filePath, file);

    if (error) throw error;

    // Get public URL
    const { data } = supabase!
      .storage
      .from('meter-photos')
      .getPublicUrl(filePath);

    return data.publicUrl;
  },

  async uploadBillImage(blob: Blob, fileNameWithoutExt: string): Promise<string> {
    if (isDemoMode) {
      // Convert to Base64 in demo mode
      return await convertBlobToBase64(blob);
    }

    const filePath = `bills/${fileNameWithoutExt}_${Date.now()}.png`;

    const { error } = await supabase!
      .storage
      .from('bill-images')
      .upload(filePath, blob, {
        contentType: 'image/png'
      });

    if (error) throw error;

    // Get public URL
    const { data } = supabase!
      .storage
      .from('bill-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }
};
export type { Tenant, Submission, Bill };
