import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/useToast';
import { Palette, Upload, Eye, Save } from 'lucide-react';

const brandingSchema = z.object({
  app_name: z.string().min(1, 'App name is required').max(50, 'App name too long'),
  logo_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  primary_color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color'),
  secondary_color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color'),
  primary_foreground: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color'),
  secondary_foreground: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color'),
  custom_home_html: z.string().optional(),
  support_phone: z.string().optional(),
  og_image_url: z.string().url('Invalid URL').optional().or(z.literal(''))
});

type BrandingFormData = z.infer<typeof brandingSchema>;

interface TenantBranding {
  id: string;
  tenant_id: string;
  app_name: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  primary_foreground: string;
  secondary_foreground: string;
  custom_home_html?: string;
  support_phone?: string;
  og_image_url?: string;
  created_at: string;
  updated_at: string;
}

export function TenantBranding() {
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  const form = useForm<BrandingFormData>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      app_name: 'WUZAPI',
      logo_url: '',
      primary_color: '#3B82F6',
      secondary_color: '#F1F5F9',
      primary_foreground: '#FFFFFF',
      secondary_foreground: '#0F172A',
      custom_home_html: '',
      support_phone: '',
      og_image_url: ''
    }
  });

  const watchedValues = form.watch();

  const loadBranding = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/tenant/branding', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load branding');
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        setBranding(data.data);
        form.reset({
          app_name: data.data.app_name || 'WUZAPI',
          logo_url: data.data.logo_url || '',
          primary_color: data.data.primary_color || '#3B82F6',
          secondary_color: data.data.secondary_color || '#F1F5F9',
          primary_foreground: data.data.primary_foreground || '#FFFFFF',
          secondary_foreground: data.data.secondary_foreground || '#0F172A',
          custom_home_html: data.data.custom_home_html || '',
          support_phone: data.data.support_phone || '',
          og_image_url: data.data.og_image_url || ''
        });
      }
    } catch (error) {
      console.error('Error loading branding:', error);
      toast({
        title: 'Error',
        description: 'Failed to load branding configuration',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data: BrandingFormData) => {
    try {
      setIsSaving(true);
      
      const response = await fetch('/api/tenant/branding', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to update branding');
      }

      const result = await response.json();
      
      if (result.success) {
        setBranding(result.data);
        toast({
          title: 'Success',
          description: 'Branding updated successfully'
        });
      } else {
        throw new Error(result.error || 'Failed to update branding');
      }
    } catch (error) {
      console.error('Error updating branding:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update branding',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    loadBranding();
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading branding configuration...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tenant Branding</h1>
          <p className="text-muted-foreground">
            Customize your tenant's visual identity and branding
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowPreview(!showPreview)}
        >
          <Eye className="h-4 w-4 mr-2" />
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Basic Information
                  </CardTitle>
                  <CardDescription>
                    Configure your tenant's basic branding information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="app_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Application Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="logo_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Logo URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com/logo.png" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="support_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Support Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+55 11 99999-9999" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="og_image_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Social Media Image URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com/og-image.png" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Color Scheme</CardTitle>
                  <CardDescription>
                    Define your tenant's color palette
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="primary_color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary Color</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <Input {...field} placeholder="#3B82F6" />
                              <input
                                type="color"
                                value={field.value}
                                onChange={(e) => field.onChange(e.target.value)}
                                className="w-12 h-10 border rounded cursor-pointer"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="primary_foreground"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary Text Color</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <Input {...field} placeholder="#FFFFFF" />
                              <input
                                type="color"
                                value={field.value}
                                onChange={(e) => field.onChange(e.target.value)}
                                className="w-12 h-10 border rounded cursor-pointer"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="secondary_color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Secondary Color</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <Input {...field} placeholder="#F1F5F9" />
                              <input
                                type="color"
                                value={field.value}
                                onChange={(e) => field.onChange(e.target.value)}
                                className="w-12 h-10 border rounded cursor-pointer"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="secondary_foreground"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Secondary Text Color</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <Input {...field} placeholder="#0F172A" />
                              <input
                                type="color"
                                value={field.value}
                                onChange={(e) => field.onChange(e.target.value)}
                                className="w-12 h-10 border rounded cursor-pointer"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Custom HTML</CardTitle>
                  <CardDescription>
                    Add custom HTML content for your landing page
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="custom_home_html"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom Home HTML</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={8}
                            placeholder="<div>Custom HTML content...</div>"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button type="submit" disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Form>
        </div>

        {showPreview && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Live Preview</CardTitle>
                <CardDescription>
                  See how your branding will look
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div 
                  className="border rounded-lg p-6 space-y-4"
                  style={{
                    backgroundColor: watchedValues.secondary_color,
                    color: watchedValues.secondary_foreground
                  }}
                >
                  <div className="flex items-center gap-3">
                    {watchedValues.logo_url && (
                      <img 
                        src={watchedValues.logo_url} 
                        alt="Logo" 
                        className="h-8 w-8 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <h2 className="text-xl font-bold">{watchedValues.app_name}</h2>
                  </div>

                  <div 
                    className="p-4 rounded text-center"
                    style={{
                      backgroundColor: watchedValues.primary_color,
                      color: watchedValues.primary_foreground
                    }}
                  >
                    <p className="font-medium">Welcome to {watchedValues.app_name}</p>
                    <p className="text-sm opacity-90">Your WhatsApp Business Solution</p>
                  </div>

                  {watchedValues.support_phone && (
                    <div className="text-sm">
                      <strong>Support:</strong> {watchedValues.support_phone}
                    </div>
                  )}

                  {watchedValues.custom_home_html && (
                    <div 
                      className="border-t pt-4"
                      dangerouslySetInnerHTML={{ __html: watchedValues.custom_home_html }}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}