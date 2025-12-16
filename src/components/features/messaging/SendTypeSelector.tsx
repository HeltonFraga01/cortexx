/**
 * SendTypeSelector Component
 * UI for selecting the type of message sending
 * 
 * Requirements: 4.1
 */

import { Card, CardContent } from '@/components/ui/card';
import {
  User,
  Users,
  Tag,
  FileSpreadsheet,
  Database,
} from 'lucide-react';

export type SendType = 'manual' | 'group' | 'tag' | 'csv' | 'database';

interface SendTypeSelectorProps {
  selectedType: SendType;
  onSelect: (type: SendType) => void;
}

const SEND_TYPES: {
  type: SendType;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    type: 'manual',
    label: 'Manual',
    description: 'Digite os números manualmente',
    icon: <User className="h-6 w-6" />,
  },
  {
    type: 'group',
    label: 'Grupo',
    description: 'Selecione um grupo de contatos',
    icon: <Users className="h-6 w-6" />,
  },
  {
    type: 'tag',
    label: 'Tag',
    description: 'Envie para contatos com uma tag',
    icon: <Tag className="h-6 w-6" />,
  },
  {
    type: 'csv',
    label: 'CSV',
    description: 'Importe contatos de um arquivo CSV',
    icon: <FileSpreadsheet className="h-6 w-6" />,
  },
  {
    type: 'database',
    label: 'Banco de Dados',
    description: 'Selecione de uma tabela externa',
    icon: <Database className="h-6 w-6" />,
  },
];

export function SendTypeSelector({ selectedType, onSelect }: SendTypeSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {SEND_TYPES.map((item) => (
        <Card
          key={item.type}
          className={`cursor-pointer transition-all hover:border-primary ${
            selectedType === item.type
              ? 'border-2 border-primary bg-primary/5'
              : 'border hover:bg-muted/50'
          }`}
          onClick={() => onSelect(item.type)}
        >
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <div
                className={`p-3 rounded-full ${
                  selectedType === item.type
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                {item.icon}
              </div>
              <div>
                <h3 className="font-medium">{item.label}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default SendTypeSelector;
