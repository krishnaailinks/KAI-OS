"use client";

import { supabase } from './supabase';

export const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers();

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  return headers;
};

export const apiFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const authHeaders = await getAuthHeaders();
  const headers = new Headers(init.headers);

  authHeaders.forEach((value, key) => {
    if (!headers.has(key)) headers.set(key, value);
  });

  return fetch(input, {
    ...init,
    headers,
  });
};
