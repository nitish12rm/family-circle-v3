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
  last_seen?: string | null;
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
  likers?: { id: string; name: string; avatar?: string }[];
  tags?: string[];
}

export const FEED_TAGS = [
  { id: "urgent",    label: "Urgent",    emoji: "🚨", bg: "bg-red-500/15",     text: "text-red-400",     border: "border-red-500/30" },
  { id: "traveling", label: "Traveling", emoji: "✈️", bg: "bg-blue-500/15",    text: "text-blue-400",    border: "border-blue-500/30" },
  { id: "scenery",   label: "Scenery",   emoji: "🌄", bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30" },
  { id: "festival",  label: "Festival",  emoji: "🎉", bg: "bg-yellow-500/15",  text: "text-yellow-400",  border: "border-yellow-500/30" },
  { id: "funny",     label: "Funny",     emoji: "😂", bg: "bg-pink-500/15",    text: "text-pink-400",    border: "border-pink-500/30" },
  { id: "food",      label: "Food",      emoji: "🍽️", bg: "bg-orange-500/15",  text: "text-orange-400",  border: "border-orange-500/30" },
  { id: "milestone", label: "Milestone", emoji: "🏆", bg: "bg-purple-500/15",  text: "text-purple-400",  border: "border-purple-500/30" },
  { id: "memory",    label: "Memory",    emoji: "💫", bg: "bg-indigo-500/15",  text: "text-indigo-400",  border: "border-indigo-500/30" },
] as const;

export type FeedTagId = (typeof FEED_TAGS)[number]["id"];

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
  read_by: { id: string; name: string; avatar?: string }[];
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
  type: "parent" | "child" | "spouse" | "sibling" | "step_parent" | "step_child";
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

export interface Todo {
  id: string;
  user_id: string;
  title: string;
  completed: boolean;
  created_at: string;
}

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}
