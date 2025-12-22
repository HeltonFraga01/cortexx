
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import InstancesList from "./InstancesList";
import { useQuery } from "@tanstack/react-query";
import { fetchInstances } from "@/lib/api";

const InstancesListWrapper = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const { data: instances = [], isLoading, error, refetch } = useQuery({
    queryKey: ['instances'],
    queryFn: fetchInstances
  });
  
  // Filter instances based on user role
  const filteredInstances = () => {
    // If admin, show all instances
    if (user?.role === 'admin') {
      return instances;
    }
    
    // If regular user, only show instances matching their phone number
    if (user?.role === 'user' && user.phoneNumber) {
      return instances.filter(instance => 
        instance.phoneNumber === user.phoneNumber
      );
    }
    
    return [];
  };
  
  // Logout automático quando não houver instâncias
  useEffect((): void => {
    if (!isLoading && filteredInstances().length === 0 && user?.role !== "admin") {
      logout();
      navigate("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, instances, user]);

  return (
    <InstancesList 
      instances={filteredInstances()} 
      isLoading={isLoading} 
      error={error} 
      refetch={refetch}
    />
  );
};

export default InstancesListWrapper;
