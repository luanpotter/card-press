#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}▶${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
error() {
    echo -e "${RED}✗${NC} $1"
    exit 1
}

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ -f /etc/arch-release ]]; then
    OS="arch"
else
    error "Unsupported OS. This script supports macOS and Arch Linux."
fi

info "Detected OS: $OS"

# Install Homebrew on macOS if not present
install_brew() {
    if ! command -v brew &>/dev/null; then
        info "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        success "Homebrew installed"
    else
        success "Homebrew already installed"
    fi
}

# Install a package
install_pkg() {
    local name="$1"
    local arch_pkg="${2:-$1}"
    local brew_pkg="${3:-$1}"

    if command -v "$name" &>/dev/null; then
        success "$name already installed"
        return
    fi

    info "Installing $name..."
    case "$OS" in
    macos)
        brew install "$brew_pkg"
        ;;
    arch)
        sudo pacman -S --noconfirm "$arch_pkg"
        ;;
    esac
    success "$name installed"
}

# Install Bun
install_bun() {
    if command -v bun &>/dev/null; then
        success "Bun already installed ($(bun --version))"
        return
    fi

    info "Installing Bun..."
    curl -fsSL https://bun.sh/install | bash

    # Add to current shell
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"

    success "Bun installed ($(bun --version))"
}

# Install actionlint
install_actionlint() {
    if command -v actionlint &>/dev/null; then
        success "actionlint already installed"
        return
    fi

    info "Installing actionlint..."
    case "$OS" in
    macos)
        brew install actionlint
        ;;
    arch)
        sudo snap install actionlint
        ;;
    esac
    success "actionlint installed"
}

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}                   Setting up card-press                     ${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# macOS needs Homebrew first
if [[ "$OS" == "macos" ]]; then
    install_brew
fi

# Install tools
install_bun
install_pkg "shellcheck" "shellcheck" "shellcheck"
install_pkg "shfmt" "shfmt" "shfmt"
install_actionlint

# Install project dependencies
echo ""
info "Installing project dependencies..."
cd "$(dirname "$0")/.."
bun install
success "Dependencies installed"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
echo -e "Run ${BLUE}bun dev${NC} to start the development server"
echo -e "Run ${BLUE}./scripts/lint.sh${NC} to run all checks"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
