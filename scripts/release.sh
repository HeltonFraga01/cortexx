#!/bin/bash

# Script para automatizar o processo de release com versionamento semântico
# Utiliza conventional commits para determinar automaticamente a próxima versão

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

# Verificar se estamos na branch main
check_branch() {
    local current_branch=$(git branch --show-current)
    if [ "$current_branch" != "main" ]; then
        log_error "Você deve estar na branch 'main' para fazer release"
        log_info "Branch atual: $current_branch"
        exit 1
    fi
    log_success "Branch verificada: $current_branch"
}

# Verificar se há mudanças não commitadas
check_working_directory() {
    if ! git diff-index --quiet HEAD --; then
        log_error "Há mudanças não commitadas no working directory"
        log_info "Commit ou stash suas mudanças antes de fazer release"
        exit 1
    fi
    log_success "Working directory limpo"
}

# Verificar se há commits para release
check_commits() {
    local last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    if [ -z "$last_tag" ]; then
        log_info "Nenhuma tag encontrada, será o primeiro release"
        return 0
    fi
    
    local commits_since_tag=$(git rev-list ${last_tag}..HEAD --count)
    if [ "$commits_since_tag" -eq 0 ]; then
        log_warning "Nenhum commit novo desde a última tag ($last_tag)"
        log_info "Nada para fazer release"
        exit 0
    fi
    
    log_success "Encontrados $commits_since_tag commits desde $last_tag"
}

# Determinar próxima versão baseada em conventional commits
determine_next_version() {
    local current_version=$(grep '"version"' package.json | cut -d'"' -f4)
    local last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
    
    log_info "Versão atual: $current_version"
    log_info "Última tag: $last_tag"
    
    # Analisar commits desde a última tag
    local commits_since_tag=""
    if [ "$last_tag" != "v0.0.0" ]; then
        commits_since_tag=$(git log ${last_tag}..HEAD --oneline)
    else
        commits_since_tag=$(git log --oneline)
    fi
    
    # Determinar tipo de release baseado nos commits
    local has_breaking=false
    local has_feat=false
    local has_fix=false
    
    while IFS= read -r commit; do
        if [[ $commit =~ ^[a-f0-9]+[[:space:]]+(feat|fix|perf|revert|docs|style|refactor|test|build|ci|chore)(\(.+\))?!: ]]; then
            has_breaking=true
        elif [[ $commit =~ ^[a-f0-9]+[[:space:]]+feat(\(.+\))?: ]]; then
            has_feat=true
        elif [[ $commit =~ ^[a-f0-9]+[[:space:]]+(fix|perf)(\(.+\))?: ]]; then
            has_fix=true
        fi
    done <<< "$commits_since_tag"
    
    # Determinar incremento de versão
    local version_parts=(${current_version//./ })
    local major=${version_parts[0]}
    local minor=${version_parts[1]}
    local patch=${version_parts[2]}
    
    if [ "$has_breaking" = true ]; then
        major=$((major + 1))
        minor=0
        patch=0
        log_info "🚨 Breaking changes detectadas - incrementando MAJOR version"
    elif [ "$has_feat" = true ]; then
        minor=$((minor + 1))
        patch=0
        log_info "✨ Novas features detectadas - incrementando MINOR version"
    elif [ "$has_fix" = true ]; then
        patch=$((patch + 1))
        log_info "🐛 Bug fixes detectados - incrementando PATCH version"
    else
        log_warning "Nenhuma mudança significativa detectada"
        log_info "Incrementando PATCH version por padrão"
        patch=$((patch + 1))
    fi
    
    NEXT_VERSION="$major.$minor.$patch"
    log_success "Próxima versão determinada: $NEXT_VERSION"
}

# Gerar changelog automático
generate_changelog() {
    log_info "Gerando changelog automático..."
    
    local last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    local commits_range=""
    
    if [ -n "$last_tag" ]; then
        commits_range="${last_tag}..HEAD"
    else
        commits_range="HEAD"
    fi
    
    # Criar seção do changelog para a nova versão
    local changelog_section="## [${NEXT_VERSION}] - $(date +%Y-%m-%d)\n\n"
    
    # Categorizar commits
    local features=""
    local fixes=""
    local docs=""
    local refactor=""
    local perf=""
    local tests=""
    local build=""
    local ci=""
    local breaking=""
    
    while IFS= read -r commit; do
        local hash=$(echo "$commit" | cut -d' ' -f1)
        local message=$(echo "$commit" | cut -d' ' -f2-)
        
        if [[ $message =~ ^(feat|fix|perf|revert|docs|style|refactor|test|build|ci|chore)(\(.+\))?!: ]]; then
            breaking="${breaking}- ${message} (${hash})\n"
        elif [[ $message =~ ^feat(\(.+\))?: ]]; then
            features="${features}- ${message#feat*: } (${hash})\n"
        elif [[ $message =~ ^fix(\(.+\))?: ]]; then
            fixes="${fixes}- ${message#fix*: } (${hash})\n"
        elif [[ $message =~ ^docs(\(.+\))?: ]]; then
            docs="${docs}- ${message#docs*: } (${hash})\n"
        elif [[ $message =~ ^refactor(\(.+\))?: ]]; then
            refactor="${refactor}- ${message#refactor*: } (${hash})\n"
        elif [[ $message =~ ^perf(\(.+\))?: ]]; then
            perf="${perf}- ${message#perf*: } (${hash})\n"
        elif [[ $message =~ ^test(\(.+\))?: ]]; then
            tests="${tests}- ${message#test*: } (${hash})\n"
        elif [[ $message =~ ^build(\(.+\))?: ]]; then
            build="${build}- ${message#build*: } (${hash})\n"
        elif [[ $message =~ ^ci(\(.+\))?: ]]; then
            ci="${ci}- ${message#ci*: } (${hash})\n"
        fi
    done <<< "$(git log $commits_range --oneline)"
    
    # Montar seções do changelog
    if [ -n "$breaking" ]; then
        changelog_section="${changelog_section}### 🚨 BREAKING CHANGES\n${breaking}\n"
    fi
    if [ -n "$features" ]; then
        changelog_section="${changelog_section}### ✨ Features\n${features}\n"
    fi
    if [ -n "$fixes" ]; then
        changelog_section="${changelog_section}### 🐛 Bug Fixes\n${fixes}\n"
    fi
    if [ -n "$perf" ]; then
        changelog_section="${changelog_section}### ⚡ Performance Improvements\n${perf}\n"
    fi
    if [ -n "$docs" ]; then
        changelog_section="${changelog_section}### 📚 Documentation\n${docs}\n"
    fi
    if [ -n "$refactor" ]; then
        changelog_section="${changelog_section}### ♻️ Code Refactoring\n${refactor}\n"
    fi
    if [ -n "$tests" ]; then
        changelog_section="${changelog_section}### ✅ Tests\n${tests}\n"
    fi
    if [ -n "$build" ]; then
        changelog_section="${changelog_section}### 🏗️ Build System\n${build}\n"
    fi
    if [ -n "$ci" ]; then
        changelog_section="${changelog_section}### 👷 CI/CD\n${ci}\n"
    fi
    
    # Inserir nova seção no CHANGELOG.md
    if [ -f "CHANGELOG.md" ]; then
        # Criar backup
        cp CHANGELOG.md CHANGELOG.md.bak
        
        # Inserir nova seção após o cabeçalho
        local header=$(head -n 3 CHANGELOG.md)
        local rest=$(tail -n +4 CHANGELOG.md)
        
        echo -e "$header\n\n$changelog_section\n---\n\n$rest" > CHANGELOG.md
    else
        # Criar novo CHANGELOG.md
        echo -e "# Changelog\n\nTodas as mudanças notáveis neste projeto serão documentadas neste arquivo.\n\n$changelog_section" > CHANGELOG.md
    fi
    
    log_success "Changelog atualizado"
}

# Atualizar versão no package.json
update_package_version() {
    log_info "Atualizando versão no package.json para $NEXT_VERSION"
    
    # Usar sed para atualizar a versão
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/\"version\": \".*\"/\"version\": \"$NEXT_VERSION\"/" package.json
    else
        # Linux
        sed -i "s/\"version\": \".*\"/\"version\": \"$NEXT_VERSION\"/" package.json
    fi
    
    log_success "Versão atualizada no package.json"
}

# Criar commit e tag
create_release_commit() {
    log_info "Criando commit de release..."
    
    git add CHANGELOG.md package.json
    git commit -m "chore(release): v$NEXT_VERSION

Automated release commit with updated changelog and version bump."
    
    log_success "Commit de release criado"
    
    log_info "Criando tag v$NEXT_VERSION..."
    git tag -a "v$NEXT_VERSION" -m "Release v$NEXT_VERSION

$(grep -A 20 "## \[$NEXT_VERSION\]" CHANGELOG.md | tail -n +3 | head -n -1)"
    
    log_success "Tag v$NEXT_VERSION criada"
}

# Função principal
main() {
    echo "🚀 WUZAPI Manager - Automated Release Process"
    echo "============================================="
    echo ""
    
    # Verificações pré-release
    log_info "Executando verificações pré-release..."
    check_branch
    check_working_directory
    check_commits
    
    echo ""
    log_info "Determinando próxima versão..."
    determine_next_version
    
    echo ""
    log_info "Gerando changelog..."
    generate_changelog
    
    echo ""
    log_info "Atualizando versão..."
    update_package_version
    
    echo ""
    log_info "Criando release..."
    create_release_commit
    
    echo ""
    log_success "Release v$NEXT_VERSION criado com sucesso!"
    echo ""
    echo "📋 Próximos passos:"
    echo "   1. Revisar as mudanças:"
    echo "      git show HEAD"
    echo "      git show v$NEXT_VERSION"
    echo ""
    echo "   2. Fazer push (se estiver satisfeito):"
    echo "      git push origin main --tags"
    echo ""
    echo "   3. Build e deploy da imagem Docker:"
    echo "      ./build-multiarch.sh v$NEXT_VERSION"
    echo "      ./deploy-swarm.sh deploy"
    echo ""
    echo "   4. Ou desfazer (se necessário):"
    echo "      git reset --hard HEAD~1"
    echo "      git tag -d v$NEXT_VERSION"
}

# Executar se chamado diretamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi