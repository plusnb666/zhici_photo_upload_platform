import client from './client';

export const tagsAPI = {
  list: () => client.get('/tags'),
  create: (name: string, color?: string) => client.post('/tags', { name, color }),
  delete: (id: number) => client.delete(`/tags/${id}`),
};
