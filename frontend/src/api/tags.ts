import client from './client';

export const tagsAPI = {
  list: (search?: string) => client.get('/tags', { params: { search } }),
  create: (data: { name: string; color?: string }) => client.post('/tags', data),
  delete: (id: number) => client.delete(`/tags/${id}`),
};
