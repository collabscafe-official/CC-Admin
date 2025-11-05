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
  id: number;
  type: 'image' | 'video';
  thumbnailUrl: string;
  url: string;
  views: number;
  likes: number;
  comments: number;
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
