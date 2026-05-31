export interface Tenant {
  id: string;
  name: string;
  phone: string;
  flat_number: string;
  status: 'active' | 'inactive';
  water_charge: number;
  motor_charge: number;
  motor_charge_rule: 'add' | 'deduct' | 'none';
  default_maintenance: number;
  last_reading: number;
  password: string;
  created_at: string;
}

export interface Submission {
  id: string;
  tenant_id: string;
  tenant_name?: string;
  flat_number?: string;
  reading: number;
  photo_url: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  notes?: string;
}

export interface Bill {
  id: string;
  tenant_id: string;
  tenant_name: string;
  flat_number: string;
  submission_id?: string;
  month: string;
  previous_reading: number;
  current_reading: number;
  units_consumed: number;
  rate_per_unit: number;
  electricity_charge: number;
  water_charge: number;
  motor_charge: number;
  motor_charge_rule: 'add' | 'deduct' | 'none';
  maintenance_charge: number;
  total_amount: number;
  bill_image_url: string;
  status: 'unpaid' | 'paid';
  paid_at?: string;
  created_at: string;
}

export interface Setting {
  key: string;
  value: string;
}

// Initial seed data to populate localStore for a beautiful instantly working demonstration
const DEFAULT_TENANTS: Tenant[] = [
  {
    id: '6d2146f3-ec84-49c7-9759-40eb61903bb2',
    name: 'Mr. Aditya',
    phone: '7889548580',
    flat_number: 'Set 2 (Ground Floor)',
    status: 'active',
    water_charge: 350,
    motor_charge: 150,
    motor_charge_rule: 'deduct', // Motor is on his meter, so deduct Rs 150
    default_maintenance: 5000,
    last_reading: 16663, // Updated to highest reading from April bill (starts May reading from here)
    password: '7889548580',
    created_at: new Date('2026-04-02T12:00:00Z').toISOString(),
  },
  {
    id: '49c42c94-d4b9-472e-84cf-cbff6cd37bb2',
    name: 'Mr. Shivam',
    phone: '9872321681',
    flat_number: 'Set 1 (Ground Floor)',
    status: 'active',
    water_charge: 350,
    motor_charge: 150,
    motor_charge_rule: 'add', // Water pump motor used by him, add Rs 150
    default_maintenance: 0,
    last_reading: 14802, // Updated to highest reading from April bill (starts May reading from here)
    password: '9872321681',
    created_at: new Date('2026-04-05T12:00:00Z').toISOString(),
  }
];

const DEFAULT_SETTINGS = {
  rate_per_unit: '10',
  default_water_charge: '350',
  default_motor_charge: '150',
};

// Seed initial history
const DEFAULT_BILLS: Bill[] = [
  {
    id: 'bill-aditya-initial',
    tenant_id: '6d2146f3-ec84-49c7-9759-40eb61903bb2',
    tenant_name: 'Mr. Aditya',
    flat_number: 'Set 2 (Ground Floor)',
    month: 'April 2026',
    previous_reading: 16559,
    current_reading: 16663,
    units_consumed: 104,
    rate_per_unit: 10,
    electricity_charge: 1040,
    water_charge: 350,
    motor_charge: 150,
    motor_charge_rule: 'deduct',
    maintenance_charge: 5000,
    total_amount: 6240, // 1040 + 350 - 150 + 5000 = 6240
    bill_image_url: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&w=800&q=80', // placeholder for seed
    status: 'paid',
    paid_at: new Date('2026-05-04T10:00:00Z').toISOString(),
    created_at: new Date('2026-05-04T09:00:00Z').toISOString(),
  },
  {
    id: 'bill-shivam-initial',
    tenant_id: '49c42c94-d4b9-472e-84cf-cbff6cd37bb2',
    tenant_name: 'Mr. Shivam',
    flat_number: 'Set 1 (Ground Floor)',
    month: 'April 2026',
    previous_reading: 14399,
    current_reading: 14802,
    units_consumed: 403,
    rate_per_unit: 10,
    electricity_charge: 4030,
    water_charge: 350,
    motor_charge: 150,
    motor_charge_rule: 'add',
    maintenance_charge: 0,
    total_amount: 4530, // 4030 + 350 + 150 = 4530
    bill_image_url: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&w=800&q=80',
    status: 'paid',
    paid_at: new Date('2026-05-05T14:30:00Z').toISOString(),
    created_at: new Date('2026-05-04T09:30:00Z').toISOString(),
  }
];

export const localStore = {
  init() {
    if (!localStorage.getItem('utility_tenants')) {
      localStorage.setItem('utility_tenants', JSON.stringify(DEFAULT_TENANTS));
    } else {
      try {
        const tenants = JSON.parse(localStorage.getItem('utility_tenants') || '[]');
        let updated = false;
        tenants.forEach((t: Tenant) => {
          if (t.id === '6d2146f3-ec84-49c7-9759-40eb61903bb2') {
            if (t.phone !== '7889548580' || t.password !== '7889548580') {
              t.phone = '7889548580';
              t.password = '7889548580';
              updated = true;
            }
          }
          if (t.id === '49c42c94-d4b9-472e-84cf-cbff6cd37bb2') {
            if (t.phone !== '9872321681' || t.password !== '9872321681') {
              t.phone = '9872321681';
              t.password = '9872321681';
              updated = true;
            }
          }
        });
        if (updated) {
          localStorage.setItem('utility_tenants', JSON.stringify(tenants));
        }
      } catch (e) {
        console.error('Migration error', e);
      }
    }
    if (!localStorage.getItem('utility_settings')) {
      localStorage.setItem('utility_settings', JSON.stringify(DEFAULT_SETTINGS));
    }
    if (!localStorage.getItem('utility_submissions')) {
      localStorage.setItem('utility_submissions', JSON.stringify([]));
    }
    if (!localStorage.getItem('utility_bills')) {
      localStorage.setItem('utility_bills', JSON.stringify(DEFAULT_BILLS));
    }
  },

  getTenants(): Tenant[] {
    this.init();
    return JSON.parse(localStorage.getItem('utility_tenants') || '[]');
  },

  saveTenant(tenant: Omit<Tenant, 'id' | 'created_at'> & { id?: string }): Tenant {
    this.init();
    const tenants = this.getTenants();
    const id = tenant.id || Math.random().toString(36).substring(2, 11);
    const newTenant: Tenant = {
      ...tenant,
      id,
      created_at: tenant.id ? (tenants.find(t => t.id === id)?.created_at || new Date().toISOString()) : new Date().toISOString()
    } as Tenant;

    const existingIndex = tenants.findIndex(t => t.id === id);
    if (existingIndex > -1) {
      tenants[existingIndex] = newTenant;
    } else {
      tenants.push(newTenant);
    }
    localStorage.setItem('utility_tenants', JSON.stringify(tenants));
    return newTenant;
  },

  deleteTenant(id: string): void {
    const tenants = this.getTenants().filter(t => t.id !== id);
    localStorage.setItem('utility_tenants', JSON.stringify(tenants));
  },

  getSubmissions(): Submission[] {
    this.init();
    const submissions: Submission[] = JSON.parse(localStorage.getItem('utility_submissions') || '[]');
    const tenants = this.getTenants();
    
    // Join tenant info for display
    return submissions.map(sub => {
      const tenant = tenants.find(t => t.id === sub.tenant_id);
      return {
        ...sub,
        tenant_name: tenant ? tenant.name : 'Unknown Tenant',
        flat_number: tenant ? tenant.flat_number : 'N/A'
      };
    });
  },

  saveSubmission(submission: Omit<Submission, 'id' | 'status' | 'submitted_at'>): Submission {
    this.init();
    const submissions = JSON.parse(localStorage.getItem('utility_submissions') || '[]');
    const newSubmission: Submission = {
      ...submission,
      id: Math.random().toString(36).substring(2, 11),
      status: 'pending',
      submitted_at: new Date().toISOString()
    };
    submissions.push(newSubmission);
    localStorage.setItem('utility_submissions', JSON.stringify(submissions));
    return newSubmission;
  },

  updateSubmissionStatus(id: string, status: 'approved' | 'rejected', reading?: number): void {
    this.init();
    const submissions = JSON.parse(localStorage.getItem('utility_submissions') || '[]');
    const index = submissions.findIndex((s: any) => s.id === id);
    if (index > -1) {
      submissions[index].status = status;
      if (reading !== undefined) {
        submissions[index].reading = reading;
      }
      localStorage.setItem('utility_submissions', JSON.stringify(submissions));
    }
  },

  getBills(): Bill[] {
    this.init();
    return JSON.parse(localStorage.getItem('utility_bills') || '[]');
  },

  saveBill(bill: Omit<Bill, 'id' | 'created_at'>): Bill {
    this.init();
    const bills = this.getBills();
    const newBill: Bill = {
      ...bill,
      id: Math.random().toString(36).substring(2, 11),
      created_at: new Date().toISOString()
    };
    bills.push(newBill);
    localStorage.setItem('utility_bills', JSON.stringify(bills));

    // Update tenant's last reading as well
    const tenants = this.getTenants();
    const tenantIndex = tenants.findIndex(t => t.id === bill.tenant_id);
    if (tenantIndex > -1) {
      tenants[tenantIndex].last_reading = bill.current_reading;
      localStorage.setItem('utility_tenants', JSON.stringify(tenants));
    }

    return newBill;
  },

  updateBillPaidStatus(id: string, status: 'unpaid' | 'paid'): void {
    this.init();
    const bills = this.getBills();
    const index = bills.findIndex(b => b.id === id);
    if (index > -1) {
      bills[index].status = status;
      bills[index].paid_at = status === 'paid' ? new Date().toISOString() : undefined;
      localStorage.setItem('utility_bills', JSON.stringify(bills));
    }
  },

  getSettings(): Record<string, string> {
    this.init();
    return JSON.parse(localStorage.getItem('utility_settings') || '{}');
  },

  saveSetting(key: string, value: string): void {
    this.init();
    const settings = this.getSettings();
    settings[key] = value;
    localStorage.setItem('utility_settings', JSON.stringify(settings));
  }
};
