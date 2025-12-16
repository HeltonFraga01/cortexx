/**
 * Avatar Block
 * 
 * Displays an avatar image with name and optional status badge.
 * Properly renders images from URL fields with graceful fallback.
 */

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User } from 'lucide-react';
import type { BlockComponentProps } from '@/types/page-builder';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Validates if a string is a valid URL for image loading
 */
function isValidImageUrl(url: unknown): url is string {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  
  // Check for common image URL patterns
  try {
    // Accept data URLs
    if (trimmed.startsWith('data:image/')) return true;
    // Accept relative paths
    if (trimmed.startsWith('/')) return true;
    // Validate absolute URLs
    const parsed = new URL(trimmed);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function AvatarBlockComponent({
  block,
  record,
}: BlockComponentProps) {
  const { 
    imageField, 
    nameField, 
    statusField,
    size = 'large',
    alignment = 'center',
  } = block.props;

  // Track image load errors for fallback
  const [imageError, setImageError] = useState(false);

  // Get values from record
  const rawImageUrl = imageField ? record[imageField] : null;
  const imageUrl = isValidImageUrl(rawImageUrl) ? rawImageUrl : null;
  const name = nameField ? String(record[nameField] || '') : '';
  const status = statusField ? record[statusField] : null;
  const initials = name ? getInitials(name) : '';

  // Determine if we should show the image
  const showImage = imageUrl && !imageError;

  // Size classes
  const sizeClasses = {
    small: 'h-16 w-16',
    medium: 'h-24 w-24',
    large: 'h-32 w-32',
  };

  const textSizeClasses = {
    small: 'text-lg',
    medium: 'text-xl',
    large: 'text-2xl sm:text-3xl',
  };

  const alignmentClasses = {
    left: 'items-start text-left',
    center: 'items-center text-center',
    right: 'items-end text-right',
  };

  // Handle image load error
  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <div className={`flex flex-col ${alignmentClasses[alignment as keyof typeof alignmentClasses] || alignmentClasses.center} gap-4 py-4`}>
      <Avatar className={`${sizeClasses[size as keyof typeof sizeClasses] || sizeClasses.large} border-4 border-background shadow-lg`}>
        {showImage && (
          <AvatarImage 
            src={imageUrl} 
            alt={name || 'Avatar'} 
            onError={handleImageError}
          />
        )}
        <AvatarFallback className="text-2xl bg-primary/10">
          {initials || <User className="h-12 w-12 text-muted-foreground" />}
        </AvatarFallback>
      </Avatar>
      
      {name && (
        <div className="space-y-1">
          <h2 className={`font-bold ${textSizeClasses[size as keyof typeof textSizeClasses] || textSizeClasses.large}`}>
            {name}
          </h2>
          {status && (
            <Badge variant="secondary">
              {String(status)}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

export default AvatarBlockComponent;
