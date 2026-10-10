import React, { useState, useRef } from 'react';
import { optimizeImage } from '../../utils/imageUpload';
import { storageUploadService } from '../../services/storageUploadService';
import { UploadCloud, Link as LinkIcon, X } from 'lucide-react';
import { Button } from './Button';

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  multiple?: boolean;
  maxImages?: number;
  label?: string;
  folder?: 'products' | 'collections';
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  images,
  onChange,
  multiple = true,
  maxImages = 8,
  label = 'Fotos do Produto',
  folder = 'products',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlField, setShowUrlField] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setLoading(true);

    try {
      const newImages: string[] = [];
      for (let i = 0; i < files.length; i++) {
        if (images.length + newImages.length >= maxImages) break;
        const file = files[i];
        if (file.type.startsWith('image/')) {
          try {
            const uploadedUrl = await storageUploadService.uploadImage(file, folder);
            newImages.push(uploadedUrl);
          } catch {
            const optimized = await optimizeImage(file, 1200);
            newImages.push(optimized);
          }
        }
      }

      if (multiple) {
        onChange([...images, ...newImages]);
      } else if (newImages.length > 0) {
        onChange([newImages[0]]);
      }
    } catch (err) {
      console.error('Erro ao processar imagem:', err);
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    if (multiple) {
      onChange([...images, urlInput.trim()]);
    } else {
      onChange([urlInput.trim()]);
    }
    setUrlInput('');
    setShowUrlField(false);
  };

  const handleRemove = (index: number) => {
    onChange(images.filter((_, idx) => idx !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold uppercase text-trigon-300">
          {label} {multiple && `(${images.length}/${maxImages})`}
        </label>
        <button
          type="button"
          onClick={() => setShowUrlField(!showUrlField)}
          className="text-xs text-crimson-400 hover:text-crimson-300 flex items-center gap-1 transition-colors"
        >
          <LinkIcon className="w-3 h-3" />
          <span>{showUrlField ? 'Ocultar URL' : 'Ou colar URL'}</span>
        </button>
      </div>

      {/* URL input field if toggled */}
      {showUrlField && (
        <div className="flex gap-2 animate-in fade-in duration-150">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Cole o link direto da imagem (https://...)"
            className="flex-1 px-3.5 py-2 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAddUrl}
          >
            Adicionar
          </Button>
        </div>
      )}

      {/* Upload Drag & Drop Area */}
      {(multiple || images.length === 0) && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-crimson-500 bg-crimson-950/20 shadow-glow-crimson'
              : 'border-trigon-750 hover:border-crimson-600/50 bg-trigon-950/60 hover:bg-trigon-950'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple={multiple}
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-trigon-900 border border-trigon-750 flex items-center justify-center text-crimson-400">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-semibold text-white">
                {loading ? 'Processando imagem...' : 'Clique para selecionar ou arraste as fotos aqui'}
              </p>
              <p className="text-[11px] text-trigon-400 mt-0.5">
                PNG, JPG, WEBP • Otimização automática
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Grid */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-1">
          {images.map((imgUrl, idx) => (
            <div
              key={idx}
              className="relative group w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-trigon-750 bg-trigon-950 p-1 shadow-md"
            >
              <img
                src={imgUrl}
                alt={`Preview ${idx + 1}`}
                className="w-full h-full object-contain rounded-lg"
              />

              {idx === 0 && multiple && (
                <span className="absolute bottom-1 left-1 right-1 bg-crimson-700/90 text-white text-[9px] uppercase font-bold text-center rounded py-0.5 shadow">
                  Principal
                </span>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(idx);
                }}
                className="absolute top-1 right-1 p-1 rounded-full bg-red-950/90 text-red-300 hover:text-white border border-red-600/50 shadow-md transition-all"
                title="Remover foto"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
