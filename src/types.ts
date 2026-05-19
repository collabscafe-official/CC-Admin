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

export interface Package {
  id: number;
  title: string;
  description: string;
  price: number;
  currency: string;
  platform: string;
  deliverable: string;
  deliveryTime: number;
}

export interface ContentHighlight {
  _id: string;
  src: string;
  media_type?: 'image' | 'video';
  url?: string;
  position?: number;
  // Stats are mocked in the original scaffold — backend doesn't populate them.
  views?: number;
  likes?: number;
  comments?: number;
}

export interface FaqItem {
  id: number;
  question: string;
  answer: string;
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
  // New filter fields
  is_active: number;
  is_email_verified: number;
  is_profile_completed: number;
  is_approved_by_admin: number;
  is_featured: number;
  country: string;
  state: string;
  city: string;
  gender: string;
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
