import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Eye, RotateCcw, Info, AlertTriangle } from 'lucide-react';

interface CustomHomeHtmlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onPreview: () => void;
  onReset: () => void;
  disabled?: boolean;
  errors?: string[];
  warnings?: string[];
}

export const CustomHomeHtmlEditor: React.FC<CustomHomeHtmlEditorProps> = ({
  value,
  onChange,
  onPreview,
  onReset,
  disabled = false,
  errors = [],
  warnings = [],
}) => {
  const [charCount, setCharCount] = useState(0);
  const [sizeInKB, setSizeInKB] = useState(0);
  const maxSize = 1024 * 1024; // 1MB
  const maxSizeKB = Math.round(maxSize / 1024);

  useEffect(() => {
    setCharCount(value.length);
    setSizeInKB(Math.round(value.length / 1024));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const getProgressColor = () => {
    const percentage = (value.length / maxSize) * 100;
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  const isNearLimit = (value.length / maxSize) * 100 >= 75;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Label htmlFor="customHomeHtml" className="text-base font-semibold">
            HTML da Página Inicial
          </Label>
          <p className="text-sm text-muted-foreground">
            Cole o código HTML completo da sua página inicial (incluindo scripts, styles, etc.)
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onPreview}
            disabled={disabled || !value.trim()}
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={disabled}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {/* Alert informativo */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <p className="text-sm">
            Cole aqui o código HTML completo da sua página inicial. Você pode incluir tags <code>&lt;script&gt;</code>, 
            <code>&lt;style&gt;</code>, <code>&lt;html&gt;</code>, <code>&lt;head&gt;</code>, <code>&lt;body&gt;</code>, etc.
            O HTML será servido exatamente como você colar.
          </p>
        </AlertDescription>
      </Alert>

      {/* Textarea para HTML */}
      <div className="space-y-2">
        <Textarea
          id="customHomeHtml"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          placeholder="Cole o código HTML completo da sua página inicial aqui..."
          className="font-mono text-sm min-h-[300px] resize-y"
          spellCheck={false}
        />
        
        {/* Contador de caracteres */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className={getProgressColor()}>
              {charCount.toLocaleString()} / {maxSize.toLocaleString()} caracteres
            </span>
            <Badge variant={isNearLimit ? 'destructive' : 'secondary'}>
              {sizeInKB}KB / {maxSizeKB}KB
            </Badge>
          </div>
          
          {isNearLimit && (
            <span className="text-yellow-600 text-xs flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Próximo ao limite
            </span>
          )}
        </div>
      </div>

      {/* Erros de validação */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {warnings.map((warning, index) => (
                <li key={index} className="text-sm">{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default CustomHomeHtmlEditor;
