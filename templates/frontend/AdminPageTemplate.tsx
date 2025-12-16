import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  // Add your icons here
  Settings,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';

// TODO: Replace with your actual data types
interface YourDataType {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  createdAt: string;
  // Add your specific fields here
}

// TODO: Replace with your actual API service
interface YourApiService {
  getItems(): Promise<YourDataType[]>;
  createItem(data: Partial<YourDataType>): Promise<YourDataType>;
  updateItem(id: string, data: Partial<YourDataType>): Promise<YourDataType>;
  deleteItem(id: string): Promise<void>;
}

const AdminPageTemplate = () => {
  // State management
  const [items, setItems] = useState<YourDataType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingItem, setEditingItem] = useState<YourDataType | null>(null);

  // TODO: Initialize your API service
  // const apiService = new YourApiService();

  // Data fetching
  const fetchItems = async () => {
    try {
      setLoading(true);
      // TODO: Replace with your actual API call
      // const data = await apiService.getItems();
      // setItems(data);
      
      // Mock data for template - remove this
      setItems([
        {
          id: '1',
          name: 'Sample Item 1',
          status: 'active',
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          name: 'Sample Item 2',
          status: 'inactive',
          createdAt: new Date().toISOString()
        }
      ]);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // CRUD operations
  const handleCreate = async (formData: Partial<YourDataType>) => {
    try {
      // TODO: Replace with your actual API call
      // const newItem = await apiService.createItem(formData);
      // setItems(prev => [...prev, newItem]);
      
      toast.success('Item criado com sucesso!');
      setShowCreateForm(false);
      fetchItems();
    } catch (error) {
      console.error('Error creating item:', error);
      toast.error('Erro ao criar item');
    }
  };

  const handleUpdate = async (id: string, formData: Partial<YourDataType>) => {
    try {
      // TODO: Replace with your actual API call
      // const updatedItem = await apiService.updateItem(id, formData);
      // setItems(prev => prev.map(item => item.id === id ? updatedItem : item));
      
      toast.success('Item atualizado com sucesso!');
      setEditingItem(null);
      fetchItems();
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error('Erro ao atualizar item');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;
    
    try {
      // TODO: Replace with your actual API call
      // await apiService.deleteItem(id);
      // setItems(prev => prev.filter(item => item.id !== id));
      
      toast.success('Item excluído com sucesso!');
      fetchItems();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Erro ao excluir item');
    }
  };

  // Bulk operations
  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    if (!confirm(`Tem certeza que deseja excluir ${selectedItems.length} itens?`)) return;
    
    try {
      // TODO: Implement bulk delete
      for (const id of selectedItems) {
        // await apiService.deleteItem(id);
      }
      
      toast.success(`${selectedItems.length} itens excluídos com sucesso!`);
      setSelectedItems([]);
      fetchItems();
    } catch (error) {
      console.error('Error bulk deleting items:', error);
      toast.error('Erro ao excluir itens');
    }
  };

  // Filtering and search
  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Effects
  useEffect(() => {
    fetchItems();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">
            {/* TODO: Replace with your page title */}
            Gerenciar Items
          </h1>
          <p className="text-muted-foreground">
            {/* TODO: Replace with your page description */}
            Gerencie todos os items do sistema
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Item
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Items</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{items.length}</div>
            <p className="text-xs text-muted-foreground">
              {items.filter(item => item.status === 'active').length} ativos
            </p>
          </CardContent>
        </Card>

        {/* TODO: Add more stat cards as needed */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Items Ativos</CardTitle>
            <Badge variant="default">{items.filter(item => item.status === 'active').length}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {items.filter(item => item.status === 'active').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Items Inativos</CardTitle>
            <Badge variant="secondary">{items.filter(item => item.status === 'inactive').length}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {items.filter(item => item.status === 'inactive').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Selecionados</CardTitle>
            <Badge variant="outline">{selectedItems.length}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedItems.length}</div>
            {selectedItems.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                className="mt-2"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Excluir Selecionados
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="h-5 w-5" />
            <span>Filtros e Busca</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Buscar</Label>
              <Input
                id="search"
                placeholder="Digite para buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {/* TODO: Add more filters as needed */}
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={fetchItems}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Items</CardTitle>
          <CardDescription>
            {filteredItems.length} de {items.length} items
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(item.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedItems(prev => [...prev, item.id]);
                      } else {
                        setSelectedItems(prev => prev.filter(id => id !== item.id));
                      }
                    }}
                    className="rounded"
                  />
                  
                  <div>
                    <h3 className="font-medium">{item.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Criado em: {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                    {item.status === 'active' ? 'Ativo' : 'Inativo'}
                  </Badge>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingItem(item)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {filteredItems.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {searchTerm ? 'Nenhum item encontrado para a busca.' : 'Nenhum item cadastrado.'}
                </p>
                {!searchTerm && (
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateForm(true)}
                    className="mt-4"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeiro Item
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* TODO: Add Create/Edit Forms */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Criar Novo Item</CardTitle>
            <CardDescription>
              Preencha os dados para criar um novo item
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* TODO: Implement your create form */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input id="name" placeholder="Digite o nome do item" />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={() => handleCreate({ name: 'Novo Item' })}>
                  Criar Item
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {editingItem && (
        <Card>
          <CardHeader>
            <CardTitle>Editar Item</CardTitle>
            <CardDescription>
              Atualize os dados do item selecionado
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* TODO: Implement your edit form */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Nome</Label>
                <Input
                  id="edit-name"
                  defaultValue={editingItem.name}
                  placeholder="Digite o nome do item"
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setEditingItem(null)}
                >
                  Cancelar
                </Button>
                <Button onClick={() => handleUpdate(editingItem.id, { name: 'Item Atualizado' })}>
                  Salvar Alterações
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminPageTemplate;