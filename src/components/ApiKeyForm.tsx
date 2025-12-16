import { useState, FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiKey, getApiUrl, setApiKey, setApiUrl } from "@/lib/api";
import Button from "./ui-custom/Button";
import Card from "./ui-custom/Card";
import { toast } from "sonner";
import { Eye, EyeOff, Key, Server } from "lucide-react";

const ApiKeyForm = () => {
  const [apiKey, setApiKeyState] = useState(getApiKey());
  const [apiUrl, setApiUrlState] = useState(getApiUrl());
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      setApiKey(apiKey);
      setApiUrl(apiUrl);

      toast.success("Settings saved", {
        description: "Your API credentials have been updated",
      });
    } catch (error) {
      toast.error("Error saving settings", {
        description: "There was a problem saving your settings",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card variant="default" padding="large" border hover>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="apiUrl" className="flex items-center gap-2">
            <Server className="h-4 w-4" /> API URL
          </Label>
          <Input
            id="apiUrl"
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrlState(e.target.value)}
            placeholder="https://your-evolution-api.com"
            required
            size="lg"
            leftIcon={<Server className="h-4 w-4" />}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiKey" className="flex items-center gap-2">
            <Key className="h-4 w-4" /> Token de Acesso
          </Label>
          <Input
            id="apiKey"
            type={showApiKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKeyState(e.target.value)}
            placeholder="Token de Acesso"
            required
            size="lg"
            leftIcon={<Key className="h-4 w-4" />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />
          <p className="text-xs text-muted-foreground">
            Sua chave de API é armazenada localmente e nunca é enviada para
            nossos servidores.
          </p>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full"
          color="primary"
          size="lg"
          gradient
          glow
          loading={isSubmitting}
        >
          Salvar Configurações
        </Button>
      </form>
    </Card>
  );
};

export default ApiKeyForm;
