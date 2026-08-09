import type { SavedRecipient, SaveRecipientRequest } from "@tbc/shared-types";
import { apiClient } from "./client";

export async function fetchSavedRecipients(): Promise<SavedRecipient[]> {
  const { data } = await apiClient.get<{ recipients: SavedRecipient[] }>("/me/recipients");
  return data.recipients;
}

export async function createSavedRecipient(payload: SaveRecipientRequest): Promise<SavedRecipient> {
  const { data } = await apiClient.post<{ recipient: SavedRecipient }>("/me/recipients", payload);
  return data.recipient;
}

export async function updateSavedRecipient(id: string, payload: SaveRecipientRequest): Promise<SavedRecipient> {
  const { data } = await apiClient.patch<{ recipient: SavedRecipient }>(`/me/recipients/${id}`, payload);
  return data.recipient;
}

export async function deleteSavedRecipient(id: string): Promise<void> {
  await apiClient.delete(`/me/recipients/${id}`);
}
