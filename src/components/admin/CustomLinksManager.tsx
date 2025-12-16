import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  Plus, Edit, Trash2, ExternalLink, Database, MessageSquare, Users, Settings, X, Check, ChevronDown,
  Home, LayoutDashboard, Menu, Globe, Link, FileText, Folder, Archive, Server, HardDrive, Cloud,
  Clipboard, FileCheck, FileCode, BookOpen, Newspaper, Mail, Phone, Send, Bell, Headphones, Bot, Rss,
  UserCheck, UserPlus, UsersRound, Contact, Cpu, Terminal, Code, Braces, GitBranch,
  DollarSign, CreditCard, Wallet, ShoppingCart, Receipt, Banknote, PiggyBank, Coins,
  BarChart3, LineChart, PieChart, TrendingUp, TrendingDown, Activity, Gauge,
  Image, Video, Music, Camera, Mic, Play, Lock, Key, Shield, ShieldCheck, Eye, Fingerprint,
  Download, Upload, Share2, Copy, Search, Filter, RefreshCw, Calendar, Clock, Timer,
  MapPin, Map, Navigation, Compass, Star, Heart, Bookmark, Tag, Hash,
  Smartphone, Tablet, Laptop, Monitor, Tv, Wifi, QrCode,
  Building, Building2, Store, Warehouse, Factory, Landmark,
  Award, Trophy, Medal, Crown, Gem, Target, Flag, Rocket, Plane, Car, Truck, Ship,
  GraduationCap, Library, Stethoscope, Pill, Coffee, UtensilsCrossed, Wine, Cake,
  Leaf, Flower2, TreePine, Mountain, Waves, Sun, Moon, CloudSun, CloudRain, Snowflake, Umbrella,
  PawPrint, Cat, Dog, Bird, Fish, Gift, PartyPopper, Ticket,
  Instagram, Facebook, Twitter, Linkedin, Youtube, Twitch,
  Zap, Sparkles, Wand2, Lightbulb, Flame, Power,
  CircleCheck, CircleX, CircleAlert, Info, AlertTriangle, Ban,
  Circle, Square, Triangle, Hexagon, Diamond
} from 'lucide-react';
import { toast } from 'sonner';

interface CustomLink {
  id: number;
  label: string;
  url: string;
  icon: string;
  position: number;
  active: boolean;
}

// Ícones organizados por categoria
const iconOptions = [
  // Navegação
  { value: 'ExternalLink', label: 'Link Externo', Icon: ExternalLink, category: 'Navegação' },
  { value: 'Link', label: 'Link', Icon: Link, category: 'Navegação' },
  { value: 'Globe', label: 'Globo/Web', Icon: Globe, category: 'Navegação' },
  { value: 'Home', label: 'Home', Icon: Home, category: 'Navegação' },
  { value: 'LayoutDashboard', label: 'Dashboard', Icon: LayoutDashboard, category: 'Navegação' },
  { value: 'Menu', label: 'Menu', Icon: Menu, category: 'Navegação' },
  
  // Dados
  { value: 'Database', label: 'Banco de Dados', Icon: Database, category: 'Dados' },
  { value: 'Server', label: 'Servidor', Icon: Server, category: 'Dados' },
  { value: 'HardDrive', label: 'HD/Storage', Icon: HardDrive, category: 'Dados' },
  { value: 'Cloud', label: 'Nuvem', Icon: Cloud, category: 'Dados' },
  { value: 'Folder', label: 'Pasta', Icon: Folder, category: 'Dados' },
  { value: 'Archive', label: 'Arquivo', Icon: Archive, category: 'Dados' },
  
  // Comunicação
  { value: 'MessageSquare', label: 'Mensagens', Icon: MessageSquare, category: 'Comunicação' },
  { value: 'Mail', label: 'Email', Icon: Mail, category: 'Comunicação' },
  { value: 'Send', label: 'Enviar', Icon: Send, category: 'Comunicação' },
  { value: 'Phone', label: 'Telefone', Icon: Phone, category: 'Comunicação' },
  { value: 'Bell', label: 'Notificação', Icon: Bell, category: 'Comunicação' },
  { value: 'Headphones', label: 'Suporte', Icon: Headphones, category: 'Comunicação' },
  { value: 'Bot', label: 'Bot/Chatbot', Icon: Bot, category: 'Comunicação' },
  { value: 'Rss', label: 'RSS/Feed', Icon: Rss, category: 'Comunicação' },
  
  // Pessoas
  { value: 'Users', label: 'Usuários', Icon: Users, category: 'Pessoas' },
  { value: 'UsersRound', label: 'Grupo', Icon: UsersRound, category: 'Pessoas' },
  { value: 'UserCheck', label: 'Usuário OK', Icon: UserCheck, category: 'Pessoas' },
  { value: 'UserPlus', label: 'Add Usuário', Icon: UserPlus, category: 'Pessoas' },
  { value: 'Contact', label: 'Contato', Icon: Contact, category: 'Pessoas' },
  
  // Sistema
  { value: 'Settings', label: 'Configurações', Icon: Settings, category: 'Sistema' },
  { value: 'Cpu', label: 'Processador', Icon: Cpu, category: 'Sistema' },
  { value: 'Terminal', label: 'Terminal', Icon: Terminal, category: 'Sistema' },
  { value: 'Code', label: 'Código', Icon: Code, category: 'Sistema' },
  { value: 'Braces', label: 'API/JSON', Icon: Braces, category: 'Sistema' },
  { value: 'GitBranch', label: 'Git', Icon: GitBranch, category: 'Sistema' },
  
  // Finanças
  { value: 'DollarSign', label: 'Dinheiro', Icon: DollarSign, category: 'Finanças' },
  { value: 'CreditCard', label: 'Cartão', Icon: CreditCard, category: 'Finanças' },
  { value: 'Wallet', label: 'Carteira', Icon: Wallet, category: 'Finanças' },
  { value: 'ShoppingCart', label: 'Carrinho', Icon: ShoppingCart, category: 'Finanças' },
  { value: 'Receipt', label: 'Recibo', Icon: Receipt, category: 'Finanças' },
  { value: 'Banknote', label: 'Nota', Icon: Banknote, category: 'Finanças' },
  { value: 'PiggyBank', label: 'Cofrinho', Icon: PiggyBank, category: 'Finanças' },
  { value: 'Coins', label: 'Moedas', Icon: Coins, category: 'Finanças' },
  
  // Relatórios
  { value: 'BarChart3', label: 'Gráfico Barras', Icon: BarChart3, category: 'Relatórios' },
  { value: 'LineChart', label: 'Gráfico Linha', Icon: LineChart, category: 'Relatórios' },
  { value: 'PieChart', label: 'Gráfico Pizza', Icon: PieChart, category: 'Relatórios' },
  { value: 'TrendingUp', label: 'Alta', Icon: TrendingUp, category: 'Relatórios' },
  { value: 'TrendingDown', label: 'Baixa', Icon: TrendingDown, category: 'Relatórios' },
  { value: 'Activity', label: 'Atividade', Icon: Activity, category: 'Relatórios' },
  { value: 'Gauge', label: 'Medidor', Icon: Gauge, category: 'Relatórios' },
  
  // Documentos
  { value: 'FileText', label: 'Documento', Icon: FileText, category: 'Documentos' },
  { value: 'FileCode', label: 'Código', Icon: FileCode, category: 'Documentos' },
  { value: 'FileCheck', label: 'Arquivo OK', Icon: FileCheck, category: 'Documentos' },
  { value: 'Clipboard', label: 'Clipboard', Icon: Clipboard, category: 'Documentos' },
  { value: 'BookOpen', label: 'Livro', Icon: BookOpen, category: 'Documentos' },
  { value: 'Newspaper', label: 'Notícias', Icon: Newspaper, category: 'Documentos' },
  
  // Mídia
  { value: 'Image', label: 'Imagem', Icon: Image, category: 'Mídia' },
  { value: 'Video', label: 'Vídeo', Icon: Video, category: 'Mídia' },
  { value: 'Music', label: 'Música', Icon: Music, category: 'Mídia' },
  { value: 'Camera', label: 'Câmera', Icon: Camera, category: 'Mídia' },
  { value: 'Mic', label: 'Microfone', Icon: Mic, category: 'Mídia' },
  { value: 'Play', label: 'Play', Icon: Play, category: 'Mídia' },
  
  // Segurança
  { value: 'Lock', label: 'Cadeado', Icon: Lock, category: 'Segurança' },
  { value: 'Key', label: 'Chave', Icon: Key, category: 'Segurança' },
  { value: 'Shield', label: 'Escudo', Icon: Shield, category: 'Segurança' },
  { value: 'ShieldCheck', label: 'Escudo OK', Icon: ShieldCheck, category: 'Segurança' },
  { value: 'Eye', label: 'Visualizar', Icon: Eye, category: 'Segurança' },
  { value: 'Fingerprint', label: 'Digital', Icon: Fingerprint, category: 'Segurança' },
  
  // Ações
  { value: 'Download', label: 'Download', Icon: Download, category: 'Ações' },
  { value: 'Upload', label: 'Upload', Icon: Upload, category: 'Ações' },
  { value: 'Share2', label: 'Compartilhar', Icon: Share2, category: 'Ações' },
  { value: 'Copy', label: 'Copiar', Icon: Copy, category: 'Ações' },
  { value: 'Search', label: 'Buscar', Icon: Search, category: 'Ações' },
  { value: 'Filter', label: 'Filtrar', Icon: Filter, category: 'Ações' },
  { value: 'RefreshCw', label: 'Atualizar', Icon: RefreshCw, category: 'Ações' },
  
  // Tempo
  { value: 'Calendar', label: 'Calendário', Icon: Calendar, category: 'Tempo' },
  { value: 'Clock', label: 'Relógio', Icon: Clock, category: 'Tempo' },
  { value: 'Timer', label: 'Timer', Icon: Timer, category: 'Tempo' },
  
  // Localização
  { value: 'MapPin', label: 'Localização', Icon: MapPin, category: 'Localização' },
  { value: 'Map', label: 'Mapa', Icon: Map, category: 'Localização' },
  { value: 'Navigation', label: 'Navegação', Icon: Navigation, category: 'Localização' },
  { value: 'Compass', label: 'Bússola', Icon: Compass, category: 'Localização' },
  
  // Favoritos
  { value: 'Star', label: 'Estrela', Icon: Star, category: 'Favoritos' },
  { value: 'Heart', label: 'Coração', Icon: Heart, category: 'Favoritos' },
  { value: 'Bookmark', label: 'Favorito', Icon: Bookmark, category: 'Favoritos' },
  { value: 'Tag', label: 'Tag', Icon: Tag, category: 'Favoritos' },
  { value: 'Hash', label: 'Hashtag', Icon: Hash, category: 'Favoritos' },
  
  // Dispositivos
  { value: 'Smartphone', label: 'Celular', Icon: Smartphone, category: 'Dispositivos' },
  { value: 'Tablet', label: 'Tablet', Icon: Tablet, category: 'Dispositivos' },
  { value: 'Laptop', label: 'Notebook', Icon: Laptop, category: 'Dispositivos' },
  { value: 'Monitor', label: 'Monitor', Icon: Monitor, category: 'Dispositivos' },
  { value: 'Tv', label: 'TV', Icon: Tv, category: 'Dispositivos' },
  { value: 'Wifi', label: 'WiFi', Icon: Wifi, category: 'Dispositivos' },
  { value: 'QrCode', label: 'QR Code', Icon: QrCode, category: 'Dispositivos' },
  
  // Negócios
  { value: 'Building', label: 'Prédio', Icon: Building, category: 'Negócios' },
  { value: 'Building2', label: 'Empresa', Icon: Building2, category: 'Negócios' },
  { value: 'Store', label: 'Loja', Icon: Store, category: 'Negócios' },
  { value: 'Warehouse', label: 'Armazém', Icon: Warehouse, category: 'Negócios' },
  { value: 'Factory', label: 'Fábrica', Icon: Factory, category: 'Negócios' },
  { value: 'Landmark', label: 'Marco', Icon: Landmark, category: 'Negócios' },
  
  // Conquistas
  { value: 'Award', label: 'Prêmio', Icon: Award, category: 'Conquistas' },
  { value: 'Trophy', label: 'Troféu', Icon: Trophy, category: 'Conquistas' },
  { value: 'Medal', label: 'Medalha', Icon: Medal, category: 'Conquistas' },
  { value: 'Crown', label: 'Coroa', Icon: Crown, category: 'Conquistas' },
  { value: 'Gem', label: 'Gema', Icon: Gem, category: 'Conquistas' },
  { value: 'Target', label: 'Alvo', Icon: Target, category: 'Conquistas' },
  { value: 'Flag', label: 'Bandeira', Icon: Flag, category: 'Conquistas' },
  
  // Transporte
  { value: 'Rocket', label: 'Foguete', Icon: Rocket, category: 'Transporte' },
  { value: 'Plane', label: 'Avião', Icon: Plane, category: 'Transporte' },
  { value: 'Car', label: 'Carro', Icon: Car, category: 'Transporte' },
  { value: 'Truck', label: 'Caminhão', Icon: Truck, category: 'Transporte' },
  { value: 'Ship', label: 'Navio', Icon: Ship, category: 'Transporte' },
  
  // Educação
  { value: 'GraduationCap', label: 'Formatura', Icon: GraduationCap, category: 'Educação' },
  { value: 'Library', label: 'Biblioteca', Icon: Library, category: 'Educação' },
  
  // Saúde
  { value: 'Stethoscope', label: 'Estetoscópio', Icon: Stethoscope, category: 'Saúde' },
  { value: 'Pill', label: 'Remédio', Icon: Pill, category: 'Saúde' },
  
  // Alimentação
  { value: 'Coffee', label: 'Café', Icon: Coffee, category: 'Alimentação' },
  { value: 'UtensilsCrossed', label: 'Restaurante', Icon: UtensilsCrossed, category: 'Alimentação' },
  { value: 'Wine', label: 'Vinho', Icon: Wine, category: 'Alimentação' },
  { value: 'Cake', label: 'Bolo', Icon: Cake, category: 'Alimentação' },
  
  // Natureza
  { value: 'Leaf', label: 'Folha', Icon: Leaf, category: 'Natureza' },
  { value: 'Flower2', label: 'Flor', Icon: Flower2, category: 'Natureza' },
  { value: 'TreePine', label: 'Árvore', Icon: TreePine, category: 'Natureza' },
  { value: 'Mountain', label: 'Montanha', Icon: Mountain, category: 'Natureza' },
  { value: 'Waves', label: 'Ondas', Icon: Waves, category: 'Natureza' },
  { value: 'Sun', label: 'Sol', Icon: Sun, category: 'Natureza' },
  { value: 'Moon', label: 'Lua', Icon: Moon, category: 'Natureza' },
  
  // Clima
  { value: 'CloudSun', label: 'Nublado', Icon: CloudSun, category: 'Clima' },
  { value: 'CloudRain', label: 'Chuva', Icon: CloudRain, category: 'Clima' },
  { value: 'Snowflake', label: 'Neve', Icon: Snowflake, category: 'Clima' },
  { value: 'Umbrella', label: 'Guarda-chuva', Icon: Umbrella, category: 'Clima' },
  
  // Animais
  { value: 'PawPrint', label: 'Pata', Icon: PawPrint, category: 'Animais' },
  { value: 'Cat', label: 'Gato', Icon: Cat, category: 'Animais' },
  { value: 'Dog', label: 'Cachorro', Icon: Dog, category: 'Animais' },
  { value: 'Bird', label: 'Pássaro', Icon: Bird, category: 'Animais' },
  { value: 'Fish', label: 'Peixe', Icon: Fish, category: 'Animais' },
  
  // Eventos
  { value: 'Gift', label: 'Presente', Icon: Gift, category: 'Eventos' },
  { value: 'PartyPopper', label: 'Festa', Icon: PartyPopper, category: 'Eventos' },
  { value: 'Ticket', label: 'Ingresso', Icon: Ticket, category: 'Eventos' },
  
  // Redes Sociais
  { value: 'Instagram', label: 'Instagram', Icon: Instagram, category: 'Social' },
  { value: 'Facebook', label: 'Facebook', Icon: Facebook, category: 'Social' },
  { value: 'Twitter', label: 'Twitter/X', Icon: Twitter, category: 'Social' },
  { value: 'Linkedin', label: 'LinkedIn', Icon: Linkedin, category: 'Social' },
  { value: 'Youtube', label: 'YouTube', Icon: Youtube, category: 'Social' },
  { value: 'Twitch', label: 'Twitch', Icon: Twitch, category: 'Social' },
  
  // Especiais
  { value: 'Zap', label: 'Raio', Icon: Zap, category: 'Especiais' },
  { value: 'Sparkles', label: 'Brilhos', Icon: Sparkles, category: 'Especiais' },
  { value: 'Wand2', label: 'Varinha', Icon: Wand2, category: 'Especiais' },
  { value: 'Lightbulb', label: 'Lâmpada', Icon: Lightbulb, category: 'Especiais' },
  { value: 'Flame', label: 'Fogo', Icon: Flame, category: 'Especiais' },
  { value: 'Power', label: 'Power', Icon: Power, category: 'Especiais' },
  
  // Status
  { value: 'CircleCheck', label: 'Check', Icon: CircleCheck, category: 'Status' },
  { value: 'CircleX', label: 'X', Icon: CircleX, category: 'Status' },
  { value: 'CircleAlert', label: 'Alerta', Icon: CircleAlert, category: 'Status' },
  { value: 'Info', label: 'Info', Icon: Info, category: 'Status' },
  { value: 'AlertTriangle', label: 'Aviso', Icon: AlertTriangle, category: 'Status' },
  { value: 'Ban', label: 'Bloqueado', Icon: Ban, category: 'Status' },
  
  // Formas
  { value: 'Circle', label: 'Círculo', Icon: Circle, category: 'Formas' },
  { value: 'Square', label: 'Quadrado', Icon: Square, category: 'Formas' },
  { value: 'Triangle', label: 'Triângulo', Icon: Triangle, category: 'Formas' },
  { value: 'Hexagon', label: 'Hexágono', Icon: Hexagon, category: 'Formas' },
  { value: 'Diamond', label: 'Diamante', Icon: Diamond, category: 'Formas' },
];

// Agrupar ícones por categoria
const iconCategories = iconOptions.reduce((acc, icon) => {
  if (!acc[icon.category]) {
    acc[icon.category] = [];
  }
  acc[icon.category].push(icon);
  return acc;
}, {} as Record<string, typeof iconOptions>);


// Componente de seleção de ícone com busca e categorias
function IconPicker({ 
  value, 
  onChange 
}: { 
  value: string; 
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const selectedIcon = iconOptions.find(opt => opt.value === value);
  const SelectedIconComponent = selectedIcon?.Icon || ExternalLink;
  
  const filteredCategories = Object.entries(iconCategories).reduce((acc, [category, icons]) => {
    const filtered = icons.filter(icon => 
      icon.label.toLowerCase().includes(search.toLowerCase()) ||
      icon.value.toLowerCase().includes(search.toLowerCase()) ||
      category.toLowerCase().includes(search.toLowerCase())
    );
    if (filtered.length > 0) {
      acc[category] = filtered;
    }
    return acc;
  }, {} as Record<string, typeof iconOptions>);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <div className="flex items-center gap-2">
            <SelectedIconComponent className="h-4 w-4" />
            <span>{selectedIcon?.label || 'Selecionar ícone'}</span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="p-3 border-b">
          <Input
            placeholder="Buscar ícone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
        </div>
        <ScrollArea className="h-[400px]">
          <div className="p-2">
            {Object.entries(filteredCategories).map(([category, icons]) => (
              <div key={category} className="mb-4">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {category}
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {icons.map((icon) => (
                    <Button
                      key={icon.value}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-auto py-2 px-2 flex flex-col items-center gap-1 hover:bg-primary/10",
                        value === icon.value && "bg-primary/20 border border-primary"
                      )}
                      onClick={() => {
                        onChange(icon.value);
                        setOpen(false);
                        setSearch('');
                      }}
                    >
                      <icon.Icon className="h-5 w-5" />
                      <span className="text-[10px] text-center leading-tight truncate w-full">
                        {icon.label}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(filteredCategories).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum ícone encontrado
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export default function CustomLinksManager() {
  const [links, setLinks] = useState<CustomLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    label: '',
    url: '',
    icon: 'ExternalLink',
    position: 0,
  });

  const fetchLinks = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/custom-links/all', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setLinks(data.data || []);
      } else {
        toast.error('Erro ao carregar links');
      }
    } catch (error) {
      console.error('Erro ao buscar links:', error);
      toast.error('Erro ao carregar links');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const handleStartEdit = (link: CustomLink) => {
    setEditingId(link.id);
    setFormData({
      label: link.label,
      url: link.url,
      icon: link.icon,
      position: link.position,
    });
    setShowNewForm(false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setShowNewForm(false);
    setFormData({
      label: '',
      url: '',
      icon: 'ExternalLink',
      position: 0,
    });
  };

  const handleShowNewForm = () => {
    setShowNewForm(true);
    setEditingId(null);
    setFormData({
      label: '',
      url: '',
      icon: 'ExternalLink',
      position: links.length,
    });
  };

  const handleSave = async () => {
    if (!formData.label || !formData.url) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const url = editingId
        ? `/api/custom-links/${editingId}`
        : '/api/custom-links';
      
      const method = editingId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          active: true,
        }),
      });

      if (response.ok) {
        toast.success(editingId ? 'Link atualizado!' : 'Link criado!');
        handleCancelEdit();
        fetchLinks();
      } else {
        toast.error('Erro ao salvar link');
      }
    } catch (error) {
      console.error('Erro ao salvar link:', error);
      toast.error('Erro ao salvar link');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Deseja realmente excluir este link?')) {
      return;
    }

    try {
      const response = await fetch(`/api/custom-links/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('Link excluído!');
        fetchLinks();
      } else {
        toast.error('Erro ao excluir link');
      }
    } catch (error) {
      console.error('Erro ao excluir link:', error);
      toast.error('Erro ao excluir link');
    }
  };

  const getIconComponent = (iconName: string) => {
    const option = iconOptions.find(opt => opt.value === iconName);
    return option ? option.Icon : ExternalLink;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Links Customizados no Menu</CardTitle>
            <CardDescription>
              Adicione links personalizados que aparecerão no menu lateral dos usuários
            </CardDescription>
          </div>
          {!showNewForm && !editingId && (
            <Button onClick={handleShowNewForm}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Link
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {/* Formulário de novo link */}
            {showNewForm && (
              <Card className="border-2 border-primary">
                <CardHeader>
                  <CardTitle className="text-base">Novo Link</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-label">Label *</Label>
                      <Input
                        id="new-label"
                        placeholder="Ex: Clientes, MasterMegga"
                        value={formData.label}
                        onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-url">URL *</Label>
                      <Input
                        id="new-url"
                        placeholder="https://exemplo.com"
                        value={formData.url}
                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Ícone</Label>
                      <IconPicker
                        value={formData.icon}
                        onChange={(value) => setFormData({ ...formData, icon: value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-position">Posição</Label>
                      <Input
                        id="new-position"
                        type="number"
                        min="0"
                        value={formData.position}
                        onChange={(e) => setFormData({ ...formData, position: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    <Button variant="outline" onClick={handleCancelEdit}>
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                    <Button onClick={handleSave}>
                      <Check className="h-4 w-4 mr-2" />
                      Salvar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lista de links */}
            {links.length === 0 && !showNewForm ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum link customizado configurado
              </div>
            ) : (
              <div className="space-y-2">
                {links.map((link) => {
                  const IconComponent = getIconComponent(link.icon);
                  const isEditing = editingId === link.id;

                  if (isEditing) {
                    return (
                      <Card key={link.id} className="border-2 border-primary">
                        <CardContent className="pt-6 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor={`edit-label-${link.id}`}>Label *</Label>
                              <Input
                                id={`edit-label-${link.id}`}
                                placeholder="Ex: Clientes, MasterMegga"
                                value={formData.label}
                                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`edit-url-${link.id}`}>URL *</Label>
                              <Input
                                id={`edit-url-${link.id}`}
                                placeholder="https://exemplo.com"
                                value={formData.url}
                                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Ícone</Label>
                              <IconPicker
                                value={formData.icon}
                                onChange={(value) => setFormData({ ...formData, icon: value })}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`edit-position-${link.id}`}>Posição</Label>
                              <Input
                                id={`edit-position-${link.id}`}
                                type="number"
                                min="0"
                                value={formData.position}
                                onChange={(e) => setFormData({ ...formData, position: parseInt(e.target.value) || 0 })}
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2 justify-end">
                            <Button variant="outline" onClick={handleCancelEdit}>
                              <X className="h-4 w-4 mr-2" />
                              Cancelar
                            </Button>
                            <Button onClick={handleSave}>
                              <Check className="h-4 w-4 mr-2" />
                              Salvar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }

                  return (
                    <Card key={link.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <IconComponent className="h-5 w-5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">{link.label}</div>
                              <div className="text-sm text-muted-foreground truncate">
                                {link.url}
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Posição: {link.position}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleStartEdit(link)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(link.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
