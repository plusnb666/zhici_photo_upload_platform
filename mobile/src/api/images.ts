import client from './client';

export const imagesAPI = {
  upload: (formData: FormData) =>
    client.post('/images/upload', formData),
  list: (params?: { page?: number; limit?: number; tag?: string; search?: string; sort?: string }) =>
    client.get('/images', { params }),
  listPublic: (params?: { page?: number; limit?: number; tag?: string; search?: string; sort?: string }) =>
    client.get('/public/images', { params }),
  get: (id: number) => client.get(`/images/${id}`),
  getPublic: (id: number) => client.get(`/public/images/${id}`),
  update: (id: number, data: { filename?: string; alt_text?: string }) =>
    client.patch(`/images/${id}`, data),
  delete: (id: number) => client.delete(`/images/${id}`),
  toggleTag: (id: number, tagId: number) => client.post(`/images/${id}/toggle-tag`, { tag_id: tagId }),
  addTags: (id: number, tagNames: string[]) => client.post(`/images/${id}/tags`, { tag_names: tagNames }),
  removeTag: (imageId: number, tagId: number) => client.delete(`/images/${imageId}/tags/${tagId}`),
  listComments: (id: number) => client.get(`/images/${id}/comments`),
  createComment: (id: number, content: string) => client.post(`/images/${id}/comments`, { content }),
  deleteComment: (id: number, commentId: number) => client.delete(`/images/${id}/comments/${commentId}`),
  listPublicComments: (id: number) => client.get(`/public/images/${id}/comments`),
};
