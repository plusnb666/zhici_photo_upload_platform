// 上传页面
// 功能：
//   1. 拖拽上传（Ant Design Dragger 组件）
//   2. 多文件上传（最多 10 个）
//   3. 上传时可选标签
//   4. 上传完成后跳转到图库页面
//   5. 刷新图片缓存（invalidate React Query）
//
// 核心机制：beforeUpload={() => false} 阻止自动上传
//   文件先加入 fileList，用户点击"上传"按钮时才手动调用 API

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Button, Card, message, Space, Tag, Select, Divider } from 'antd';
import { InboxOutlined, CloudUploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { imagesAPI } from '../../api/images';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ALLOWED_IMAGE_TYPES, UPLOAD_MAX_SIZE_GB } from '../../utils/constants';

const { Dragger } = Upload;  // 拖拽上传组件

export function UploadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [fileList, setFileList] = useState<UploadFile[]>([]); // 待上传文件列表
  const [tags, setTags] = useState<string[]>([]);             // 上传时附带的标签

  // ── 上传 Mutation ──
  // mutationFn 从 fileList 取出 originFileObj 构建 FormData，手动调用上传 API
  const uploadMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      fileList.forEach((f) => {
        if (f.originFileObj) {
          formData.append('files', f.originFileObj);  // 字段名为 files，支持多文件
        }
      });
      if (tags.length > 0) {
        formData.append('tags', JSON.stringify(tags));  // 标签以 JSON 字符串传递
      }
      return imagesAPI.upload(formData);
    },
    onSuccess: () => {
      message.success('上传成功');
      setFileList([]);  // 清空文件列表
      setTags([]);      // 清空标签
      queryClient.invalidateQueries({ queryKey: ['images'] });  // 刷新图库缓存
      navigate('/gallery');  // 跳转到图库
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || '上传失败');
    },
  });

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <Card title="上传图片">
        {/* 拖拽上传区：beforeUpload=false 阻止自动上传，文件仅加入列表 */}
        <Dragger
          multiple
          fileList={fileList}
          onChange={({ fileList: fl }) => setFileList(fl)}
          beforeUpload={() => false}       // 阻止 Ant Design 自动上传
          accept={ALLOWED_IMAGE_TYPES.join(',')}  // 文件类型限制
          maxCount={10}                    // 单次最多 10 个文件
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p>点击或拖拽文件到此区域上传</p>
          <p style={{ color: '#999' }}>支持 PNG, JPEG, GIF, WebP, BMP，单文件最大 {UPLOAD_MAX_SIZE_GB}GB</p>
        </Dragger>

        <Divider />

        <Space direction="vertical" style={{ width: '100%' }}>
          {/* 标签选择：mode="tags" 支持自定义输入新标签 */}
          <div>
            <Select
              mode="tags"
              placeholder="添加标签（可选）"
              value={tags}
              onChange={setTags}
              style={{ width: '100%' }}
            />
          </div>
          {/* 上传按钮 */}
          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            onClick={() => uploadMutation.mutate()}
            loading={uploadMutation.isPending}
            disabled={fileList.length === 0}
            size="large"
            block
          >
            上传 {fileList.length} 个文件
          </Button>
        </Space>
      </Card>
    </div>
  );
}
