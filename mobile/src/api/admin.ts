import client from './client';

export const adminAPI = {
  stats: () => client.get('/admin/stats'),
  tagStats: () => client.get('/admin/stats/tags'),
  uploadTrend: () => client.get('/admin/stats/upload-trend'),
  listUsers: (params?: { page?: number; limit?: number; search?: string }) =>
    client.get('/admin/users', { params }),
  updateUser: (id: number, data: { role?: string }) =>
    client.patch(`/admin/users/${id}`, data),
  resetUserPassword: (id: number, password: string) =>
    client.patch(`/admin/users/${id}/password`, { password }),
  listImages: (params?: { page?: number; limit?: number; search?: string }) =>
    client.get('/admin/images', { params }),
  deleteImage: (id: number) => client.delete(`/admin/images/${id}`),
};
