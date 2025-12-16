import { useState, FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createInstance } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateInstanceFormProps {
  onSuccess: () => void;
}

const CreateInstanceForm = ({ onSuccess }: CreateInstanceFormProps) => {
  const [instanceName, setInstanceName] = useState("");
  const [token, setToken] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [channel, setChannel] = useState("Baileys");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await createInstance({
        instanceName,
        webhook_by_events: false,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        token: token,
        phoneNumber: phoneNumber,
      });

      if (result.error) {
        toast.error("Erro ao criar instância", {
          description: result.response?.message || result.error,
        });
      } else {
        toast.success("Instância criada", {
          description: `Instância "${instanceName}" foi criada com sucesso.`,
        });
        setInstanceName("");
        setToken("");
        setPhoneNumber("");
        onSuccess();
      }
    } catch (error) {
      toast.error("Erro ao criar instância", {
        description: "Ocorreu um erro ao criar sua instância",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="instanceName" className="flex items-center">
          Nome da Instância <span className="text-red-500 ml-1">*</span>
        </Label>
        <Input
          id="instanceName"
          value={instanceName}
          onChange={(e) => setInstanceName(e.target.value)}
          required
          className="border-green-500 focus:border-green-400"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="channel">Canal</Label>
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className="border-gray-700">
            <SelectValue placeholder="Selecione o canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Baileys">Baileys</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="token" className="flex items-center">
          Token de Acesso <span className="text-red-500 ml-1">*</span>
        </Label>
        <Input
          id="token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          required
          className="border-gray-700 focus:border-green-400"
          placeholder="F37BB4D08412-4FB0-971B-EE2AEEDF8005"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phoneNumber">Número de Telefone</Label>
        <Input
          id="phoneNumber"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className="border-gray-700 focus:border-green-400"
        />
      </div>

      <div className="flex justify-end pt-4">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-green-600 hover:bg-green-700 text-white border-none"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Criando...
            </>
          ) : (
            "Salvar"
          )}
        </Button>
      </div>
    </form>
  );
};

export default CreateInstanceForm;
