import { useWuzAPIAuth } from "@/contexts/WuzAPIAuthContext";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import UsersList from "../lists/UsersList";
import { useQuery } from "@tanstack/react-query";

const UsersListWrapper = () => {
  const { user, wuzapiClient, logout } = useWuzAPIAuth();
  const navigate = useNavigate();
  
  const { data: users = [], isLoading, error, refetch } = useQuery({
    queryKey: ['wuzapi-users'],
    queryFn: async () => {
      if (!wuzapiClient) {
        throw new Error('Cliente WuzAPI não disponível');
      }
      
      const response = await wuzapiClient.listUsers();
      if (!response.success) {
        throw new Error(response.error || 'Erro ao buscar usuários');
      }
      
      return response.data || [];
    },
    enabled: !!wuzapiClient,
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });
  
  // Filter users based on user role
  const filteredUsers = () => {
    // If admin, show all users
    if (user?.role === 'admin') {
      return users;
    }
    
    // If regular user, only show users matching their phone number
    if (user?.role === 'user' && user.phoneNumber) {
      return users.filter(wuzapiUser => 
        wuzapiUser.phone === user.phoneNumber
      );
    }
    
    return [];
  };
  
  // Logout automático quando não houver usuários
  useEffect((): void => {
    if (!isLoading && filteredUsers().length === 0 && user?.role !== "admin") {
      logout();
      navigate("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, users, user]);

  return (
    <UsersList 
      users={filteredUsers()} 
      isLoading={isLoading} 
      error={error} 
      refetch={refetch}
    />
  );
};

export default UsersListWrapper;