export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  onboarding_complete: boolean;
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  dob?: string;
  phone?: string;
  avatar?: string;
  status?: string;
  education?: string;
  goals?: string;
  gender?: "male" | "female" | "other";
  onboarding_complete: boolean;
  created_at: string;
}

export interface Family {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  created_by: string;
  created_at: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  role: "admin" | "member";
  profile?: Profile;
  joined_at: string;
}

export interface FamilyInvite {
  id: string;
  family_id: string;
  code: string;
  created_by: string;
  expires_at: string;
  max_uses: number;
  use_count: number;
  is_active: boolean;
}

export interface Post {
  id: string;
  family_id: string;
  author_id: string;
  content: string;
  media_urls: string[];
  author?: Profile;
  created_at: string;
  like_count?: number;
  comment_count?: number;
  liked_by_me?: boolean;
}

export interface PostComment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  author?: { id: string; name: string; avatar?: string };
  created_at: string;
}

export interface Message {
  id: string;
  family_id: string;
  sender_id: string;
  content: string;
  sender?: Profile;
  created_at: string;
}

export interface TreeMember {
  id: string;
  family_id: string;
  profile_id?: string;
  name: string;
  dob?: string;
  dod?: string;
  gender?: "male" | "female" | "other";
  photo?: string;
  status?: string;
  notes?: string;
  is_placeholder: boolean;
  is_deceased: boolean;
}

export interface TreeRelationship {
  id: string;
  family_id: string;
  member_id: string;
  related_member_id: string;
  type: "parent" | "child" | "spouse" | "sibling";
}

export const DOCUMENT_CATEGORIES = [
  "Aadhaar Card",
  "PAN Card",
  "Passport",
  "Driving License",
  "Voter ID",
  "Birth Certificate",
  "Marriage Certificate",
  "Property Documents",
  "Bank Documents",
  "Insurance",
  "Educational Certificate",
  "Medical Records",
  "Other",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export interface Document {
  id: string;
  family_id: string;
  uploaded_by: string;
  member_id?: string;
  name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  description?: string;
  category: string;
  visibility: "public" | "private";
  created_at: string;
}

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}
