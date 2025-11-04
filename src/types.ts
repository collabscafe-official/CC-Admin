export interface User {
  name: string;
  email: string;
  avatarUrl: string;
}

export interface AuthContextType {
  user: User | null;
  login: (email: string) => void;
  logout: () => void;
  isLoading: boolean;
}

export interface Influencer {
  id: number;
  date: string;
  time: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  status: 'Active' | 'Pending' | 'Inactive';
}

export interface Brand {
  id: number;
  date: string;
  time: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}
