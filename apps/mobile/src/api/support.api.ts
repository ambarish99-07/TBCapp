import type { CreateSupportTicketRequest, SupportTicket } from "@tbc/shared-types";
import { apiClient } from "./client";

/** Uploads a photo picked on the phone for a help request; returns the URL to attach. */
export async function uploadSupportPhoto(photo: { uri: string; mimeType?: string | null; fileName?: string | null }): Promise<string> {
  const form = new FormData();
  const type = photo.mimeType ?? "image/jpeg";
  // React Native's FormData takes this {uri, name, type} shape for a local file.
  form.append("image", { uri: photo.uri, name: photo.fileName ?? `photo.${type.split("/")[1] ?? "jpg"}`, type } as unknown as Blob);
  const { data } = await apiClient.post<{ url: string }>("/support/photo", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.url;
}

export async function createSupportTicket(request: CreateSupportTicketRequest): Promise<SupportTicket> {
  const { data } = await apiClient.post<{ ticket: SupportTicket }>("/support/tickets", request);
  return data.ticket;
}

export async function fetchMySupportTickets(): Promise<SupportTicket[]> {
  const { data } = await apiClient.get<{ tickets: SupportTicket[] }>("/support/tickets/mine");
  return data.tickets;
}
