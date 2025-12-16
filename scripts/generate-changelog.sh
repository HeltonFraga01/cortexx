#!/bin/bash

# Script para gerar changelog automático baseado em conventional commits
# Pode ser usado independentemente ou como parte do processo de release

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
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

log_section() {
    echo -e "${PURPLE}📋 $1${NC}"
}

# Configurações
DEFAULT_OUTPUT="CHANGELOG.md"
TEMP_FILE="/tmp/changelog_temp.md"

# Função para mostrar ajuda
show_help() {
    echo "📝 Gerador de Changelog Automático"
    echo ""
    echo "Uso:"
    echo "  $0 [opções]"
    echo ""
    echo "Opções:"
    echo "  -h, --help              Mostra esta ajuda"
    echo "  -o, --output <file>     Arquivo de saída (padrão: CHANGELOG.md)"
    echo "  -r, --range <range>     Range de commits (padrão: desde última tag)"
    echo "  -v, --version <version> Versão para o changelog"
    echo "  -f, --format <format>   Formato de saída (markdown|json|html)"
    echo "  -p, --preview           Apenas visualizar, não salvar"
    echo "  --full                  Gerar changelog completo (todos os commits)"
    echo "  --since <tag>           Gerar desde uma tag específica"
    echo ""
    echo "Exemplos:"
    echo "  $0                      # Gerar changelog desde última tag"
    echo "  $0 -v 1.3.0             # Gerar para versão específica"
    echo "  $0 --since v1.2.0       # Gerar desde v1.2.0"
    echo "  $0 --full               # Gerar changelog completo"
    echo "  $0 -p                   # Apenas visualizar"
}

# Função para obter ícones por tipo de commit
get_commit_icon() {
    local type="$1"
    case "$type" in
        "feat") echo "✨" ;;
        "fix") echo "🐛" ;;
        "docs") echo "📚" ;;
        "style") echo "💄" ;;
        "refactor") echo "♻️" ;;
        "perf") echo "⚡" ;;
        "test") echo "✅" ;;
        "build") echo "🏗️" ;;
        "ci") echo "👷" ;;
        "chore") echo "🔧" ;;
        "revert") echo "⏪" ;;
        "breaking") echo "🚨" ;;
        *) echo "📝" ;;
    esac
}

# Função para obter título da seção por tipo
get_section_title() {
    local type="$1"
    case "$type" in
        "feat") echo "Features" ;;
        "fix") echo "Bug Fixes" ;;
        "docs") echo "Documentation" ;;
        "style") echo "Styles" ;;
        "refactor") echo "Code Refactoring" ;;
        "perf") echo "Performance Improvements" ;;
        "test") echo "Tests" ;;
        "build") echo "Build System" ;;
        "ci") echo "CI/CD" ;;
        "chore") echo "Maintenance" ;;
        "revert") echo "Reverts" ;;
        "breaking") echo "BREAKING CHANGES" ;;
        *) echo "Other Changes" ;;
    esac
}

# Função para extrair informações do commit
parse_commit() {
    local commit_line="$1"
    local hash=$(echo "$commit_line" | cut -d' ' -f1)
    local message=$(echo "$commit_line" | cut -d' ' -f2-)
    
    # Extrair tipo, escopo e descrição
    local type=""
    local scope=""
    local description=""
    local is_breaking=false
    
    # Verificar se é breaking change
    if [[ $message == *"!"* ]]; then
        is_breaking=true
    fi
    
    # Extrair tipo
    if [[ $message =~ ^([a-z]+) ]]; then
        type="${BASH_REMATCH[1]}"
    else
        type="other"
    fi
    
    # Extrair escopo (se existir) - método simples
    if [[ $message == *"("* ]] && [[ $message == *")"* ]]; then
        scope=$(echo "$message" | sed 's/.*(\([^)]*\)).*/\1/')
    fi
    
    # Extrair descrição - método simples
    if [[ $message == *": "* ]]; then
        description=$(echo "$message" | sed 's/[^:]*: *//')
    else
        description="$message"
    fi
    
    echo "$hash|$type|$scope|$description|$is_breaking"
}

# Função para gerar seção do changelog
generate_changelog_section() {
    local version="$1"
    local date="$2"
    local commits_range="$3"
    
    log_info "Analisando commits no range: $commits_range"
    
    # Arrays associativos para categorizar commits
    declare -A sections
    declare -A breaking_changes
    
    # Processar commits
    local total_commits=0
    while IFS= read -r commit_line; do
        if [ -z "$commit_line" ]; then
            continue
        fi
        
        total_commits=$((total_commits + 1))
        
        # Parse do commit
        local commit_info=$(parse_commit "$commit_line")
        IFS='|' read -r hash type scope description is_breaking <<< "$commit_info"
        
        # Formatar entrada do changelog
        local entry="- $description"
        if [ -n "$scope" ]; then
            entry="- **$scope**: $description"
        fi
        entry="$entry ([${hash}](https://github.com/your-repo/commit/${hash}))"
        
        # Categorizar commit
        if [ "$is_breaking" = "true" ]; then
            breaking_changes["$type"]+="$entry"$'\n'
        else
            sections["$type"]+="$entry"$'\n'
        fi
        
    done <<< "$(git log --oneline $commits_range 2>/dev/null || echo "")"
    
    log_info "Processados $total_commits commits"
    
    # Gerar seção do changelog
    local changelog_content=""
    
    # Cabeçalho da versão
    changelog_content+="## [$version] - $date"$'\n\n'
    
    # Breaking changes primeiro (se houver)
    if [ ${#breaking_changes[@]} -gt 0 ]; then
        changelog_content+="### $(get_commit_icon "breaking") $(get_section_title "breaking")"$'\n\n'
        for type in "${!breaking_changes[@]}"; do
            changelog_content+="${breaking_changes[$type]}"
        done
        changelog_content+=$'\n'
    fi
    
    # Ordem das seções
    local section_order=("feat" "fix" "perf" "revert" "docs" "style" "refactor" "test" "build" "ci" "chore")
    
    for type in "${section_order[@]}"; do
        if [ -n "${sections[$type]}" ]; then
            local icon=$(get_commit_icon "$type")
            local title=$(get_section_title "$type")
            changelog_content+="### $icon $title"$'\n\n'
            changelog_content+="${sections[$type]}"$'\n'
        fi
    done
    
    # Outros tipos não categorizados
    for type in "${!sections[@]}"; do
        if [[ ! " ${section_order[@]} " =~ " $type " ]]; then
            local icon=$(get_commit_icon "$type")
            local title=$(get_section_title "$type")
            changelog_content+="### $icon $title"$'\n\n'
            changelog_content+="${sections[$type]}"$'\n'
        fi
    done
    
    echo "$changelog_content"
}

# Função para gerar changelog completo
generate_full_changelog() {
    local output_file="$1"
    
    log_info "Gerando changelog completo..."
    
    # Cabeçalho
    local changelog_content="# Changelog"$'\n\n'
    changelog_content+="Todas as mudanças notáveis neste projeto serão documentadas neste arquivo."$'\n\n'
    changelog_content+="O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),"$'\n'
    changelog_content+="e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/)."$'\n\n'
    
    # Obter todas as tags em ordem cronológica reversa
    local tags=($(git tag -l --sort=-version:refname))
    
    if [ ${#tags[@]} -eq 0 ]; then
        log_warning "Nenhuma tag encontrada, gerando changelog desde o primeiro commit"
        local current_version=$(grep '"version"' package.json | cut -d'"' -f4 2>/dev/null || echo "Unreleased")
        local section=$(generate_changelog_section "$current_version" "$(date +%Y-%m-%d)" "HEAD")
        changelog_content+="$section"$'\n'"---"$'\n\n'
    else
        # Commits não taggeados (unreleased)
        local unreleased_commits=$(git log --oneline ${tags[0]}..HEAD 2>/dev/null | wc -l)
        if [ $unreleased_commits -gt 0 ]; then
            log_info "Encontrados $unreleased_commits commits não taggeados"
            local section=$(generate_changelog_section "Unreleased" "$(date +%Y-%m-%d)" "${tags[0]}..HEAD")
            changelog_content+="$section"$'\n'"---"$'\n\n'
        fi
        
        # Processar cada tag
        for i in "${!tags[@]}"; do
            local current_tag="${tags[$i]}"
            local version="${current_tag#v}" # Remove 'v' prefix se existir
            
            # Obter data da tag
            local tag_date=$(git log -1 --format=%ai "$current_tag" | cut -d' ' -f1)
            
            # Determinar range de commits
            local commits_range=""
            if [ $i -eq $((${#tags[@]} - 1)) ]; then
                # Primeira tag - todos os commits até ela
                commits_range="$current_tag"
            else
                # Tags subsequentes - commits entre tags
                local previous_tag="${tags[$((i + 1))]}"
                commits_range="$previous_tag..$current_tag"
            fi
            
            log_info "Processando tag $current_tag ($tag_date)"
            local section=$(generate_changelog_section "$version" "$tag_date" "$commits_range")
            changelog_content+="$section"$'\n'"---"$'\n\n'
        done
    fi
    
    echo "$changelog_content"
}

# Função para gerar changelog incremental
generate_incremental_changelog() {
    local version="$1"
    local since_tag="$2"
    
    local date=$(date +%Y-%m-%d)
    local commits_range=""
    
    if [ -n "$since_tag" ]; then
        commits_range="$since_tag..HEAD"
        log_info "Gerando changelog desde $since_tag"
    else
        # Encontrar última tag
        local last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
        if [ -n "$last_tag" ]; then
            commits_range="$last_tag..HEAD"
            log_info "Gerando changelog desde última tag: $last_tag"
        else
            commits_range="HEAD"
            log_info "Nenhuma tag encontrada, gerando changelog completo"
        fi
    fi
    
    generate_changelog_section "$version" "$date" "$commits_range"
}

# Função para inserir nova seção no changelog existente
update_existing_changelog() {
    local new_section="$1"
    local output_file="$2"
    
    if [ ! -f "$output_file" ]; then
        # Criar novo arquivo
        local header="# Changelog"$'\n\n'
        header+="Todas as mudanças notáveis neste projeto serão documentadas neste arquivo."$'\n\n'
        echo -e "$header$new_section" > "$output_file"
    else
        # Inserir no arquivo existente
        local temp_file="/tmp/changelog_update.md"
        
        # Ler cabeçalho (primeiras 3-5 linhas)
        local header_lines=$(head -n 5 "$output_file" | grep -n "^## \|^---" | head -n 1 | cut -d: -f1)
        if [ -z "$header_lines" ]; then
            header_lines=3
        else
            header_lines=$((header_lines - 1))
        fi
        
        # Montar novo arquivo
        head -n "$header_lines" "$output_file" > "$temp_file"
        echo "" >> "$temp_file"
        echo "$new_section" >> "$temp_file"
        echo "---" >> "$temp_file"
        echo "" >> "$temp_file"
        tail -n +$((header_lines + 1)) "$output_file" >> "$temp_file"
        
        mv "$temp_file" "$output_file"
    fi
}

# Função principal
main() {
    local output_file="$DEFAULT_OUTPUT"
    local version=""
    local commits_range=""
    local since_tag=""
    local preview_only=false
    local full_changelog=false
    
    # Parse de argumentos
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -o|--output)
                output_file="$2"
                shift 2
                ;;
            -v|--version)
                version="$2"
                shift 2
                ;;
            -r|--range)
                commits_range="$2"
                shift 2
                ;;
            --since)
                since_tag="$2"
                shift 2
                ;;
            -p|--preview)
                preview_only=true
                shift
                ;;
            --full)
                full_changelog=true
                shift
                ;;
            *)
                log_error "Opção desconhecida: $1"
                echo "Use --help para ver as opções disponíveis"
                exit 1
                ;;
        esac
    done
    
    echo "📝 Gerador de Changelog Automático"
    echo "=================================="
    echo ""
    
    # Determinar versão se não especificada
    if [ -z "$version" ] && [ "$full_changelog" = false ]; then
        version=$(grep '"version"' package.json | cut -d'"' -f4 2>/dev/null || echo "Unreleased")
        log_info "Versão detectada: $version"
    fi
    
    # Gerar changelog
    local changelog_content=""
    if [ "$full_changelog" = true ]; then
        changelog_content=$(generate_full_changelog "$output_file")
    else
        changelog_content=$(generate_incremental_changelog "$version" "$since_tag")
    fi
    
    # Mostrar preview ou salvar
    if [ "$preview_only" = true ]; then
        log_section "Preview do Changelog:"
        echo ""
        echo "$changelog_content"
    else
        if [ "$full_changelog" = true ]; then
            echo "$changelog_content" > "$output_file"
            log_success "Changelog completo salvo em: $output_file"
        else
            update_existing_changelog "$changelog_content" "$output_file"
            log_success "Changelog atualizado em: $output_file"
        fi
        
        # Mostrar estatísticas
        local lines=$(echo "$changelog_content" | wc -l)
        local sections=$(echo "$changelog_content" | grep -c "^### " || echo "0")
        echo ""
        log_info "Estatísticas:"
        echo "  📄 Linhas geradas: $lines"
        echo "  📋 Seções: $sections"
        echo "  📁 Arquivo: $output_file"
    fi
}

# Executar se chamado diretamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi