#!/bin/bash

# Script para validar mensagens de commit seguindo conventional commits
# Pode ser usado como git hook ou manualmente

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para logging
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Padrão para conventional commits
CONVENTIONAL_COMMIT_REGEX="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?(!)?: .{1,50}"

# Função para validar uma mensagem de commit
validate_commit_message() {
    local commit_msg="$1"
    local commit_hash="$2"
    
    # Pegar apenas a primeira linha (título)
    local title=$(echo "$commit_msg" | head -n 1)
    
    # Verificar se segue o padrão conventional commits
    if [[ ! $title =~ $CONVENTIONAL_COMMIT_REGEX ]]; then
        log_error "Commit inválido: $commit_hash"
        log_error "Mensagem: $title"
        echo ""
        log_info "Formato esperado: <type>[optional scope]: <description>"
        log_info "Tipos válidos: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert"
        echo ""
        log_info "Exemplos válidos:"
        echo "  feat: add user authentication"
        echo "  fix(api): resolve database connection issue"
        echo "  docs: update README with installation steps"
        echo "  feat!: remove deprecated API endpoints"
        echo ""
        return 1
    fi
    
    # Verificar comprimento do título
    if [ ${#title} -gt 100 ]; then
        log_error "Título muito longo (${#title} caracteres, máximo 100)"
        log_error "Mensagem: $title"
        return 1
    fi
    
    # Verificar se termina com ponto
    if [[ $title =~ \.$ ]]; then
        log_error "Título não deve terminar com ponto"
        log_error "Mensagem: $title"
        return 1
    fi
    
    # Verificar se começa com letra maiúscula (após o tipo)
    local description=$(echo "$title" | sed 's/^[^:]*: *//')
    if [[ $description =~ ^[A-Z] ]]; then
        log_warning "Descrição deve começar com letra minúscula"
        log_warning "Mensagem: $title"
        log_info "Sugestão: $(echo "$title" | sed 's/: [A-Z]/: \L&/')"
    fi
    
    return 0
}

# Função para validar commits em um range
validate_commit_range() {
    local range="$1"
    local invalid_count=0
    local total_count=0
    
    log_info "Validando commits no range: $range"
    echo ""
    
    while IFS= read -r line; do
        if [ -z "$line" ]; then
            continue
        fi
        
        local hash=$(echo "$line" | cut -d' ' -f1)
        local message=$(echo "$line" | cut -d' ' -f2-)
        
        total_count=$((total_count + 1))
        
        if validate_commit_message "$message" "$hash"; then
            log_success "$hash: $message"
        else
            invalid_count=$((invalid_count + 1))
            echo ""
        fi
    done <<< "$(git log --oneline $range)"
    
    echo ""
    echo "📊 Resumo da validação:"
    echo "   Total de commits: $total_count"
    echo "   Commits válidos: $((total_count - invalid_count))"
    echo "   Commits inválidos: $invalid_count"
    
    if [ $invalid_count -gt 0 ]; then
        echo ""
        log_error "$invalid_count commit(s) não seguem o padrão conventional commits"
        return 1
    else
        echo ""
        log_success "Todos os commits seguem o padrão conventional commits!"
        return 0
    fi
}

# Função para validar o último commit
validate_last_commit() {
    local last_commit_msg=$(git log -1 --pretty=format:"%s")
    local last_commit_hash=$(git log -1 --pretty=format:"%h")
    
    log_info "Validando último commit..."
    echo ""
    
    if validate_commit_message "$last_commit_msg" "$last_commit_hash"; then
        log_success "Último commit é válido!"
        return 0
    else
        log_error "Último commit não segue o padrão conventional commits"
        return 1
    fi
}

# Função para mostrar ajuda
show_help() {
    echo "🔍 Validador de Conventional Commits"
    echo ""
    echo "Uso:"
    echo "  $0 [opções]"
    echo ""
    echo "Opções:"
    echo "  -h, --help              Mostra esta ajuda"
    echo "  -l, --last              Valida apenas o último commit"
    echo "  -r, --range <range>     Valida commits em um range específico"
    echo "  -a, --all               Valida todos os commits"
    echo "  -s, --since <tag>       Valida commits desde uma tag específica"
    echo ""
    echo "Exemplos:"
    echo "  $0 -l                   # Valida último commit"
    echo "  $0 -r HEAD~5..HEAD     # Valida últimos 5 commits"
    echo "  $0 -s v1.2.0           # Valida commits desde v1.2.0"
    echo "  $0 -a                   # Valida todos os commits"
    echo ""
    echo "Formato Conventional Commits:"
    echo "  <type>[optional scope]: <description>"
    echo ""
    echo "Tipos válidos:"
    echo "  feat     - Nova funcionalidade"
    echo "  fix      - Correção de bug"
    echo "  docs     - Documentação"
    echo "  style    - Formatação, espaços em branco, etc"
    echo "  refactor - Refatoração de código"
    echo "  perf     - Melhoria de performance"
    echo "  test     - Adição ou correção de testes"
    echo "  build    - Sistema de build"
    echo "  ci       - Integração contínua"
    echo "  chore    - Manutenção"
    echo "  revert   - Reverter commit anterior"
    echo ""
    echo "Modificadores:"
    echo "  !        - Indica breaking change (ex: feat!: remove old API)"
    echo "  (scope)  - Escopo opcional (ex: fix(auth): resolve login issue)"
}

# Função principal
main() {
    case "${1:-}" in
        -h|--help)
            show_help
            exit 0
            ;;
        -l|--last)
            validate_last_commit
            exit $?
            ;;
        -r|--range)
            if [ -z "$2" ]; then
                log_error "Range não especificado"
                echo "Uso: $0 -r <range>"
                exit 1
            fi
            validate_commit_range "$2"
            exit $?
            ;;
        -a|--all)
            validate_commit_range "HEAD"
            exit $?
            ;;
        -s|--since)
            if [ -z "$2" ]; then
                log_error "Tag não especificada"
                echo "Uso: $0 -s <tag>"
                exit 1
            fi
            if ! git rev-parse "$2" >/dev/null 2>&1; then
                log_error "Tag '$2' não encontrada"
                exit 1
            fi
            validate_commit_range "$2..HEAD"
            exit $?
            ;;
        "")
            # Se nenhum argumento, validar último commit
            validate_last_commit
            exit $?
            ;;
        *)
            log_error "Opção inválida: $1"
            echo "Use $0 --help para ver as opções disponíveis"
            exit 1
            ;;
    esac
}

# Executar se chamado diretamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi