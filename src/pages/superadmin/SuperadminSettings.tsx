import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';

/**
 * SuperadminSettings Component
 * Requirements: 1.2 - Settings page placeholder
 */
const SuperadminSettings = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Platform configuration and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Platform Settings</span>
          </CardTitle>
          <CardDescription>
            Configure global platform settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">Settings Coming Soon</h3>
            <p className="text-muted-foreground">
              Platform configuration options will be available here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperadminSettings;
