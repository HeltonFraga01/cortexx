import { MessageCircle } from 'lucide-react';
import { useBrandingConfig } from '@/hooks/useBranding';

interface SupportButtonProps {
  phoneNumber?: string;
}

/**
 * Generates WhatsApp URL for the given phone number
 * @param phoneNumber - Phone number (digits only)
 * @returns WhatsApp URL in format https://wa.me/{phoneNumber}
 */
export function generateWhatsAppUrl(phoneNumber: string): string {
  return `https://wa.me/${phoneNumber}`;
}

/**
 * Sidebar support button that opens WhatsApp chat
 * Designed to be placed in sidebar, above logout button
 * Uses official WhatsApp green color (#25D366)
 */
export function SupportButton({ phoneNumber }: SupportButtonProps) {
  const handleClick = () => {
    if (!phoneNumber) return;
    const url = generateWhatsAppUrl(phoneNumber);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!phoneNumber) return null;

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
      style={{ backgroundColor: '#25D366' }}
      aria-label="Abrir chat de suporte no WhatsApp"
    >
      <MessageCircle className="h-5 w-5 text-white flex-shrink-0" />
      <span className="text-white font-medium truncate">Suporte</span>
    </button>
  );
}

/**
 * Sidebar support button that reads phone from branding config
 * Use this in layouts that have access to BrandingContext
 */
export function SidebarSupportButton() {
  const brandingConfig = useBrandingConfig();
  
  if (!brandingConfig.supportPhone) {
    return null;
  }
  
  return <SupportButton phoneNumber={brandingConfig.supportPhone} />;
}

/**
 * Mobile icon-only support button for top bar
 * Displays just the WhatsApp icon, suitable for mobile header
 */
export function MobileSupportButton() {
  const brandingConfig = useBrandingConfig();
  
  if (!brandingConfig.supportPhone) {
    return null;
  }

  const handleClick = () => {
    const url = generateWhatsAppUrl(brandingConfig.supportPhone!);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      onClick={handleClick}
      className="p-2 rounded-md transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
      style={{ color: '#25D366' }}
      aria-label="Abrir chat de suporte no WhatsApp"
    >
      <MessageCircle className="h-5 w-5" />
    </button>
  );
}

export default SupportButton;
