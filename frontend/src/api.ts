import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inject Authorization headers dynamically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('family_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Types
export interface User {
  id: number;
  username: string;
  role: 'admin' | 'member';
  created_at: string;
}

export interface FamilyMember {
  id: number;
  name: string;
  created_at: string;
}

export interface FamilyExpense {
  id: number;
  family_member_id: number;
  amount: number;
  category: string;
  description: string | null;
  date: string; // YYYY-MM-DD
  added_by: number | null;
  created_at: string;
}

export interface Business {
  id: number;
  name: string;
  description: string | null;
  created_by: number | null;
  created_at: string;
}

export interface BusinessRecord {
  id: number;
  business_id: number;
  month: string; // YYYY-MM
  cost: number;
  revenue: number;
  expenses: number;
  custom_data: Record<string, any>;
  added_by: number | null;
  created_at: string;
}

// Authentication API methods
export const authApi = {
  login: async (username: string, password: string): Promise<string> => {
    const response = await api.post('/auth/login-json', { username, password });
    const { access_token } = response.data;
    localStorage.setItem('family_token', access_token);
    return access_token;
  },
  logout: () => {
    localStorage.removeItem('family_token');
  },
  getCurrentUser: async (): Promise<User> => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  register: async (username: string, password: string, role: string = 'member'): Promise<User> => {
    const response = await api.post('/auth/register', { username, password, role });
    return response.data;
  }
};

// Family Member API methods
export const familyApi = {
  list: async (): Promise<FamilyMember[]> => {
    const response = await api.get('/family-members');
    return response.data;
  },
  create: async (name: string): Promise<FamilyMember> => {
    const response = await api.post('/family-members', { name });
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/family-members/${id}`);
  }
};

// Family Expense API methods
export const expenseApi = {
  listByMember: async (familyMemberId: number): Promise<FamilyExpense[]> => {
    const response = await api.get(`/expenses/${familyMemberId}`);
    return response.data;
  },
  create: async (payload: {
    family_member_id: number;
    amount: number;
    category: string;
    description?: string;
    date?: string;
  }): Promise<FamilyExpense> => {
    const response = await api.post('/expenses', payload);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/expenses/${id}`);
  }
};

// Business API methods
export const businessApi = {
  list: async (): Promise<Business[]> => {
    const response = await api.get('/businesses');
    return response.data;
  },
  create: async (name: string, description?: string): Promise<Business> => {
    const response = await api.post('/businesses', { name, description });
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/businesses/${id}`);
  },
  listRecords: async (businessId: number): Promise<BusinessRecord[]> => {
    const response = await api.get(`/businesses/${businessId}/records`);
    return response.data;
  },
  saveRecord: async (payload: {
    business_id: number;
    month: string;
    cost: number;
    revenue: number;
    expenses: number;
    custom_data: Record<string, any>;
  }): Promise<BusinessRecord> => {
    const response = await api.post('/business-records', payload);
    return response.data;
  }
};
