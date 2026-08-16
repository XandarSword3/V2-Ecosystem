'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  Upload, Trash2, Image as ImageIcon, Video, Search, Loader2, Check, X,
} from 'lucide-react';
import { toast } from 'sonner';

export interface UploadedFileItem {
  id?: string;
  name?: string;
  filename?: string;
  url: string;
  path?: string;
  size?: number;
  type?: string;
  createdAt?: string;
}

interface MediaLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  accept?: 'image' | 'video' | 'all';
}

export function MediaLibraryModal({
  isOpen,
  onClose,
  onSelect,
  accept = 'all',
}: MediaLibraryModalProps) {
  const [files, setFiles] = useState<UploadedFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video'>(accept === 'all' ? 'all' : accept);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/uploads');
      const data = res.data;
      const fileList: UploadedFileItem[] = Array.isArray(data)
        ? data
        : (data?.files || data?.items || []);
      setFiles(fileList);
    } catch (err: any) {
      toast.error('Failed to load uploads list');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchFiles();
      setSelectedUrl(null);
    }
  }, [isOpen, fetchFiles]);

  if (!isOpen) return null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFiles[0]);

    try {
      const res = await api.post('/admin/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('File uploaded successfully');
      const newUrl = res.data?.url || res.data?.file?.url;
      await fetchFiles();
      if (newUrl) {
        setSelectedUrl(newUrl);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (file: UploadedFileItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const filePath = file.path || file.filename || file.name;
    if (!filePath) return;

    try {
      await api.delete(`/admin/uploads/${encodeURIComponent(filePath)}`);
      toast.success('File deleted');
      if (selectedUrl === file.url) setSelectedUrl(null);
      fetchFiles();
    } catch (err: any) {
      toast.error('Failed to delete file');
    }
  };

  const isVideo = (file: UploadedFileItem) => {
    const url = file.url || file.name || '';
    return url.match(/\.(mp4|webm|ogg|mov)$/i) || file.type?.startsWith('video/');
  };

  const filteredFiles = files.filter((f) => {
    const name = f.name || f.filename || f.url || '';
    const matchesSearch = name.toLowerCase().includes(search.toLowerCase());
    const isVid = isVideo(f);

    if (!matchesSearch) return false;
    if (filterType === 'image') return !isVid;
    if (filterType === 'video') return isVid;
    return true;
  });

  const handleConfirmSelect = () => {
    if (selectedUrl) {
      onSelect(selectedUrl);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-4xl max-h-[85vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Media Library</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Select an asset from your property uploads or upload a new file</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Filter Type */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filterType === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('image')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filterType === 'image'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Images
            </button>
            <button
              onClick={() => setFilterType('video')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filterType === 'video'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Videos
            </button>
          </div>

          {/* Upload Button */}
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg cursor-pointer transition-colors shadow-sm disabled:opacity-50">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span>Upload New</span>
            <input
              type="file"
              onChange={handleUpload}
              disabled={uploading}
              accept={accept === 'image' ? 'image/*' : accept === 'video' ? 'video/*' : 'image/*,video/*'}
              className="hidden"
            />
          </label>
        </div>

        {/* Assets Grid */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <span className="text-xs">Loading media library...</span>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-center">
              <ImageIcon className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No media assets found</p>
              <p className="text-xs opacity-75 mt-0.5">Upload images or videos to populate your property asset library</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredFiles.map((file, i) => {
                const isVid = isVideo(file);
                const isSelected = selectedUrl === file.url;
                const fileName = file.name || file.filename || `Asset ${i + 1}`;

                return (
                  <div
                    key={file.url + i}
                    onClick={() => setSelectedUrl(file.url)}
                    className={`group relative flex flex-col rounded-xl border-2 overflow-hidden cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-600 ring-2 ring-indigo-500/30 shadow-md'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50 dark:bg-slate-800'
                    }`}
                  >
                    {/* Media preview */}
                    <div className="relative aspect-square w-full bg-slate-100 dark:bg-slate-900 overflow-hidden flex items-center justify-center">
                      {isVid ? (
                        <div className="relative w-full h-full flex items-center justify-center bg-slate-900">
                          <Video className="w-8 h-8 text-slate-400" />
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-white uppercase font-mono">
                            VIDEO
                          </span>
                        </div>
                      ) : (
                        <img
                          src={file.url}
                          alt={fileName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      )}

                      {/* Selected check badge */}
                      {isSelected && (
                        <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}

                      {/* Delete button on hover */}
                      <button
                        onClick={(e) => handleDelete(file, e)}
                        title="Delete asset"
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-slate-300 hover:text-red-400 hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* File metadata */}
                    <div className="p-2 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700/50">
                      <p className="text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate leading-tight">
                        {fileName}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <span className="text-xs text-slate-500">
            {selectedUrl ? '1 asset selected' : 'Select an asset to use in design'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmSelect}
              disabled={!selectedUrl}
              className="px-5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-lg transition-colors shadow-sm"
            >
              Select Asset
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
