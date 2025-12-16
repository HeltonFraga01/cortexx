/**
 * Image Block
 * 
 * Displays an image from a URL field with sizing and alignment options.
 */

import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import type { BlockComponentProps } from '@/types/page-builder';
import { cn } from '@/lib/utils';

/**
 * Validates if a string is a valid URL for image loading
 */
function isValidImageUrl(url: unknown): url is string {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  
  try {
    if (trimmed.startsWith('data:image/')) return true;
    if (trimmed.startsWith('/')) return true;
    const parsed = new URL(trimmed);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function ImageBlockComponent({
  block,
  record,
}: BlockComponentProps) {
  const { 
    imageField,
    altTextField,
    size = 'medium',
    alignment = 'center',
    rounded = 'none',
    objectFit = 'cover',
  } = block.props;

  const [imageError, setImageError] = useState(false);

  const rawImageUrl = imageField ? record[imageField] : null;
  const imageUrl = isValidImageUrl(rawImageUrl) ? rawImageUrl : null;
  const altText = altTextField ? String(record[altTextField] || '') : 'Imagem';

  const sizeClasses = {
    small: 'max-w-[200px] max-h-[150px]',
    medium: 'max-w-[400px] max-h-[300px]',
    large: 'max-w-[600px] max-h-[450px]',
    full: 'w-full max-h-[500px]',
  };

  const alignmentClasses = {
    left: 'mr-auto',
    center: 'mx-auto',
    right: 'ml-auto',
  };

  const roundedClasses = {
    none: 'rounded-none',
    small: 'rounded-md',
    medium: 'rounded-lg',
    large: 'rounded-xl',
    full: 'rounded-full',
  };

  const objectFitClasses = {
    cover: 'object-cover',
    contain: 'object-contain',
    fill: 'object-fill',
  };

  if (!imageUrl || imageError) {
    return (
      <div className={cn(
        'flex items-center justify-center bg-muted',
        sizeClasses[size as keyof typeof sizeClasses] || sizeClasses.medium,
        alignmentClasses[alignment as keyof typeof alignmentClasses] || alignmentClasses.center,
        roundedClasses[rounded as keyof typeof roundedClasses] || roundedClasses.none,
        'min-h-[100px]'
      )}>
        <ImageIcon className="h-12 w-12 text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={altText}
      onError={() => setImageError(true)}
      className={cn(
        sizeClasses[size as keyof typeof sizeClasses] || sizeClasses.medium,
        alignmentClasses[alignment as keyof typeof alignmentClasses] || alignmentClasses.center,
        roundedClasses[rounded as keyof typeof roundedClasses] || roundedClasses.none,
        objectFitClasses[objectFit as keyof typeof objectFitClasses] || objectFitClasses.cover,
        'block'
      )}
    />
  );
}

export default ImageBlockComponent;
