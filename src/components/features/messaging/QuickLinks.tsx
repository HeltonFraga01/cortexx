/**
 * QuickLinks Component
 * Quick navigation links between messaging modules
 * 
 * Requirements: 5.1
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Send,
  FileText,
  Inbox,
  BarChart3,
  ArrowRight,
} from 'lucide-react';

interface QuickLink {
  path: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const QUICK_LINKS: QuickLink[] = [
  {
    path: '/user/mensagens',
    label: 'Enviar Mensagens',
    description: 'Criar nova campanha de envio',
    icon: <Send className="h-5 w-5" />,
  },
  {
    path: '/user/mensagens/templates',
    label: 'Templates',
    description: 'Gerenciar modelos de mensagem',
    icon: <FileText className="h-5 w-5" />,
  },
  {
    path: '/user/mensagens/caixa',
    label: 'Caixa de Saída',
    description: 'Ver campanhas em andamento',
    icon: <Inbox className="h-5 w-5" />,
  },
  {
    path: '/user/mensagens/relatorios',
    label: 'Relatórios',
    description: 'Analisar resultados de campanhas',
    icon: <BarChart3 className="h-5 w-5" />,
  },
];

interface QuickLinksProps {
  exclude?: string[];
  compact?: boolean;
}

export function QuickLinks({ exclude = [], compact = false }: QuickLinksProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const links = QUICK_LINKS.filter(
    (link) => !exclude.includes(link.path) && link.path !== location.pathname
  );

  if (links.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Badge
            key={link.path}
            variant="outline"
            className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
            onClick={() => navigate(link.path)}
          >
            {link.icon}
            <span className="ml-1">{link.label}</span>
          </Badge>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {links.map((link) => (
        <Card
          key={link.path}
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => navigate(link.path)}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  {link.icon}
                </div>
                <div>
                  <h3 className="font-medium">{link.label}</h3>
                  <p className="text-xs text-muted-foreground">
                    {link.description}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default QuickLinks;
