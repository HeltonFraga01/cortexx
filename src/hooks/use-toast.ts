
// We're using sonner now, so this is just a compatibility layer
import { toast } from "sonner";

export { toast };

// For backwards compatibility only - this shouldn't actually be used
// with the new Sonner toast system
export const useToast = () => {
  return {
    toast,
  };
};
