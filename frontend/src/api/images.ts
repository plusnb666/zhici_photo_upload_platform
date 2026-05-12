import client from './client';

const publicClient = client;

export const imagesAPI = {
  upload: (formData: FormData) =>
    client.post('/images/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  list: (params?: { page?: number; limit?: number; tag?: string; search?: string; sort?: string }) =>
    client.get('/images', { params }),
  listPublic: (params?: { page?: number; limit?: number; tag?: string; search?: string; sort?: string }) =>
    client.get('/public/images', { params }),
  get: (id: number) => client.get(`/images/${id}`),
  getPublic: (id: number) => client.get(`/public/images/${id}`),
  update: (id: number, data: { alt_text?: string; is_public?: boolean }) =>
    client.patch(`/images/${id}`, data),
  delete: (id: number) => client.delete(`/images/${id}`),
  batchDelete: (ids: number[]) => client.post('/images/batch-delete', { ids }),
  toggleTag: (id: number, tagId: number) => client.post(`/images/${id}/toggle-tag`, { tag_id: tagId }),
  addTags: (id: number, tagNames: string[]) => client.post(`/images/${id}/tags`, { tag_names: tagNames }),
  removeTag: (imageId: number, tagId: number) => client.delete(`/images/${imageId}/tags/${tagId}`),
};
