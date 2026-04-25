import axios from 'axios';

/**
 * Hardcoded to the dev machine's LAN IP so physical devices on the same Wi-Fi
 * (Expo Go) can reach the .NET API. The backend must be bound to 0.0.0.0:5159.
 *
 * Override via EXPO_PUBLIC_API_URL if needed (e.g. for emulators or staging).
 */
function resolveApiBaseUrl(): string {
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) return override;

  return 'http://192.168.1.107:5159';
}

export const API_BASE_URL = resolveApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

api.interceptors.request.use((config) => {
  if (authToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// ---------- Auth API ----------

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginWithKeyPayload {
  accessKey: string;
}

export interface RegisterPayload {
  fullName: string;
  email?: string;
  phoneNumber?: string;
  role?: number;
}

export interface UserDto {
  id: number;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  role: number;
  uniqueAccessKey: string;
  totalCredits: number;
  remainingCredits: number;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: UserDto;
}

export interface RegisterResponse {
  user: UserDto;
  accessKey: string;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/api/auth/login', payload);
  return data;
}

export async function loginWithKey(
  payload: LoginWithKeyPayload,
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/api/auth/login-key', payload);
  return data;
}

export async function register(payload: RegisterPayload): Promise<RegisterResponse> {
  const { data } = await api.post<RegisterResponse>('/api/auth/register', payload);
  return data;
}

// ---------- Users / Admin API ----------

export const ROLE = {
  Admin: 0,
  PT: 1,
  Member: 2,
} as const;

export interface AssignCreditsPayload {
  userId: number;
  amount: number;
}

export interface AssignCreditsResponse {
  message: string;
  userId: number;
  totalCredits: number;
  remainingCredits: number;
}

export async function getMembers(): Promise<UserDto[]> {
  const { data } = await api.get<UserDto[]>('/api/users/members');
  return data;
}

export async function assignCredits(
  payload: AssignCreditsPayload
): Promise<AssignCreditsResponse> {
  const { data } = await api.post<AssignCreditsResponse>(
    '/api/users/assign-credits',
    payload
  );
  return data;
}

// ---------- Availability / Booking API ----------

export interface AvailabilityDto {
  id: number;
  ptId: number;
  ptName: string;
  slotStart: string;
  slotEnd: string;
  isBooked: boolean;
}

export interface SetSlotsResponse {
  createdCount: number;
  skippedDuplicateCount: number;
  slots: AvailabilityDto[];
}

export interface TrainerDto {
  id: number;
  fullName: string;
  email: string;
}

export interface AppointmentDto {
  id: number;
  memberId: number;
  memberName: string;
  ptId: number;
  ptName: string;
  appointmentDate: string;
  status: string;
  remainingCredits: number;
}

export async function getTrainers(): Promise<TrainerDto[]> {
  const { data } = await api.get<TrainerDto[]>('/api/availability/trainers');
  return data;
}

export async function getSlotsForPt(ptId: number): Promise<AvailabilityDto[]> {
  const { data } = await api.get<AvailabilityDto[]>(`/api/availability/pt/${ptId}`);
  return data;
}

export async function getMySlots(): Promise<AvailabilityDto[]> {
  const { data } = await api.get<AvailabilityDto[]>('/api/availability/mine');
  return data;
}

export async function setMySlots(
  slots: { slotStart: string; slotEnd: string }[]
): Promise<SetSlotsResponse> {
  const { data } = await api.post<SetSlotsResponse>('/api/availability/set-slots', {
    slots,
  });
  return data;
}

export async function bookAppointment(availabilityId: number): Promise<AppointmentDto> {
  const { data } = await api.post<AppointmentDto>('/api/appointments/book', {
    availabilityId,
  });
  return data;
}

export async function getMyAppointments(): Promise<AppointmentDto[]> {
  const { data } = await api.get<AppointmentDto[]>('/api/appointments/mine');
  return data;
}

// Re-fetch the current user's profile so credits/role stay in sync after mutations.
export async function getCurrentUser(): Promise<UserDto> {
  const { data } = await api.get<UserDto>('/api/auth/me');
  return data;
}

// ---------- Chat API ----------

export interface MessageDto {
  id: number;
  senderId: number;
  senderName: string;
  receiverId: number;
  receiverName: string;
  content: string;
  timestamp: string;
  isRead: boolean;
}

export interface ConversationDto {
  otherUserId: number;
  otherUserName: string;
  otherUserRole: number;
  lastMessage: string;
  lastTimestamp: string;
  unreadCount: number;
}

export interface BulkSendResponse {
  sentCount: number;
  failedMemberIds: number[];
}

export async function getConversations(): Promise<ConversationDto[]> {
  const { data } = await api.get<ConversationDto[]>('/api/chat/conversations');
  return data;
}

export async function getChatHistory(
  otherUserId: number,
  before?: string,
  pageSize = 50,
): Promise<MessageDto[]> {
  const params: Record<string, string | number> = { pageSize };
  if (before) params.before = before;
  const { data } = await api.get<MessageDto[]>(`/api/chat/history/${otherUserId}`, {
    params,
  });
  return data;
}

export async function sendChatMessage(
  receiverId: number,
  content: string,
): Promise<MessageDto> {
  const { data } = await api.post<MessageDto>('/api/chat/send', {
    receiverId,
    content,
  });
  return data;
}

export async function bulkSendMessage(
  memberIds: number[],
  content: string,
): Promise<BulkSendResponse> {
  const { data } = await api.post<BulkSendResponse>('/api/chat/bulk-send', {
    memberIds,
    content,
  });
  return data;
}
