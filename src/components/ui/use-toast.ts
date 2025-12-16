
// This file is simply forwarding exports from sonner now
import { toast } from "sonner";

export { toast };

// For backwards compatibility
export const useToast = () => {
  return {
    toast,
  };
};
