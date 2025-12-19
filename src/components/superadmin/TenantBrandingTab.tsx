import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface TenantBranding {
  app_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  primary_foreground: string | null;
  secondary_foreground: string | null;
  custom_home_html: string | null;
  support_phone: string | null;
  og_image_url: string | null;
}

interface TenantBrandingTabProps {
  tenantId: string;
}

// Helper to get CSRF token
const getCsrfToken = async (): Promise<string | null> => {
  try {
    const response = await fetch('/api/auth/csrf-token', { credentials: 'include' });
    const data = await response.json();
    return data.csrfToken || null;
  } catch {
    return null;
  }
};

// Validate hex color format
const isValidHexColor = (color: string): boolean => {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
};

export function TenantBrandingTab({ tenantId }: TenantBrandingTabProps) {
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<TenantBranding>({
    app_name: '',
    logo_url: null,
    primary_color: '#0ea5e9',
    secondary_color: '#64748b',
    primary_foreground: null,
    secondary_foreground: null,
    custom_home_html: null,
    support_phone: null,
    og_image_url: null
  });

  const fetchBranding = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/superadmin/tenants/${tenantId}/branding`,
        { credentials: 'include' }
      );
      
      if (!response.ok) {
        if (response.status === 404) {
          // No branding yet, use defaults
          return;
        }
        throw new Error('Failed to fetch branding');
      }
      
      const data = await response.json();
      if (data.success && data.data) {
        setBranding(data.data);
        setFormData(data.data);
      }
    } catch (error) {
      toast.error('Failed to load branding settings');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  const handleSave = async () => {
    // Validate colors
    if (formData.primary_color && !isValidHexColor(formData.primary_color)) {
      toast.error('Invalid primary color format. Use #RRGGBB or #RGB');
      return;
    }
    if (formData.secondary_color && !isValidHexColor(formData.secondary_color)) {
      toast.error('Invalid secondary color format. Use #RRGGBB or #RGB');
      return;
    }
    if (formData.primary_foreground && !isValidHexColor(formData.primary_foreground)) {
      toast.error('Invalid primary foreground color format. Use #RRGGBB or #RGB');
      return;
    }
    if (formData.secondary_foreground && !isValidHexColor(formData.secondary_foreground)) {
      toast.error('Invalid secondary foreground color format. Use #RRGGBB or #RGB');
      return;
    }

    try {
      setSaving(true);
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/superadmin/tenants/${tenantId}/branding`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'CSRF-Token': csrfToken })
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Branding updated successfully');
        setBranding(data.data);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update branding');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (branding) {
      setFormData(branding);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Configure the tenant's brand identity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>App Name</Label>
              <Input
                value={formData.app_name}
                onChange={(e) => setFormData({ ...formData, app_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Support Phone</Label>
              <Input
                placeholder="+55 11 99999-9999"
                value={formData.support_phone || ''}
                onChange={(e) => setFormData({ ...formData, support_phone: e.target.value || null })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Logo URL</Label>
            <Input
              placeholder="https://example.com/logo.png"
              value={formData.logo_url || ''}
              onChange={(e) => setFormData({ ...formData, logo_url: e.target.value || null })}
            />
            {formData.logo_url && (
              <div className="mt-2 p-4 bg-muted rounded-md">
                <img 
                  src={formData.logo_url} 
                  alt="Logo preview" 
                  className="h-12 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>OG Image URL</Label>
            <Input
              placeholder="https://example.com/og-image.png"
              value={formData.og_image_url || ''}
              onChange={(e) => setFormData({ ...formData, og_image_url: e.target.value || null })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Colors</CardTitle>
          <CardDescription>Define the color scheme for the tenant</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="#0ea5e9"
                  value={formData.primary_color}
                  onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                  className="flex-1"
                />
                <div 
                  className="w-10 h-10 rounded border"
                  style={{ backgroundColor: formData.primary_color }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Secondary Color</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="#64748b"
                  value={formData.secondary_color}
                  onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                  className="flex-1"
                />
                <div 
                  className="w-10 h-10 rounded border"
                  style={{ backgroundColor: formData.secondary_color }}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary Foreground (optional)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="#ffffff"
                  value={formData.primary_foreground || ''}
                  onChange={(e) => setFormData({ ...formData, primary_foreground: e.target.value || null })}
                  className="flex-1"
                />
                {formData.primary_foreground && (
                  <div 
                    className="w-10 h-10 rounded border"
                    style={{ backgroundColor: formData.primary_foreground }}
                  />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Secondary Foreground (optional)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="#ffffff"
                  value={formData.secondary_foreground || ''}
                  onChange={(e) => setFormData({ ...formData, secondary_foreground: e.target.value || null })}
                  className="flex-1"
                />
                {formData.secondary_foreground && (
                  <div 
                    className="w-10 h-10 rounded border"
                    style={{ backgroundColor: formData.secondary_foreground }}
                  />
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom Home HTML</CardTitle>
          <CardDescription>Custom HTML content for the landing page (optional)</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="<div>Custom HTML content...</div>"
            value={formData.custom_home_html || ''}
            onChange={(e) => setFormData({ ...formData, custom_home_html: e.target.value || null })}
            rows={6}
            className="font-mono text-sm"
          />
        </CardContent>
      </Card>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={handleReset} disabled={saving}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
        <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white">
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}

export default TenantBrandingTab;
