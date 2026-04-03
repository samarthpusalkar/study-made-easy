#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_MODEL="mistral"
OLLAMA_TARGET="${OLLAMA_PROXY_TARGET:-http://localhost:11434}"

log() {
  printf '[setup:ollama] %s\n' "$1"
}

load_env_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$file"
    set +a
  fi
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

wait_for_ollama() {
  local attempts="${1:-20}"
  local i

  for ((i = 1; i <= attempts; i += 1)); do
    if curl -fsS "${OLLAMA_TARGET}/api/tags" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  return 1
}

start_ollama() {
  case "$(uname -s)" in
    Darwin)
      if [[ -d "/Applications/Ollama.app" ]] && command_exists open; then
        log "Starting Ollama.app..."
        open -a Ollama --args hidden >/dev/null 2>&1 || true
      else
        log "Starting ollama serve in the background..."
        nohup ollama serve >/tmp/esa-ollama.log 2>&1 &
      fi
      ;;
    Linux)
      log "Starting ollama serve in the background..."
      nohup ollama serve >/tmp/esa-ollama.log 2>&1 &
      ;;
    *)
      log "Unsupported OS for automatic start. Start Ollama manually, then rerun this script."
      exit 1
      ;;
  esac
}

install_ollama() {
  case "$(uname -s)" in
    Darwin|Linux)
      if ! command_exists curl; then
        log "curl is required to install Ollama automatically."
        exit 1
      fi

      log "Installing Ollama with the official installer..."
      curl -fsSL https://ollama.com/install.sh | sh
      ;;
    CYGWIN*|MINGW*|MSYS*)
      log "Please install Ollama for Windows from https://ollama.com/download/windows, then rerun this script in Git Bash."
      exit 1
      ;;
    *)
      log "Unsupported OS. Please install Ollama manually from https://ollama.com/download."
      exit 1
      ;;
  esac
}

load_env_file "${ROOT_DIR}/.env"
load_env_file "${ROOT_DIR}/.env.local"

MODEL_NAME="${VITE_OLLAMA_MODEL:-$DEFAULT_MODEL}"
OLLAMA_TARGET="${OLLAMA_PROXY_TARGET:-$OLLAMA_TARGET}"

log "Using model: ${MODEL_NAME}"

if ! command_exists ollama; then
  install_ollama
fi

if ! command_exists curl; then
  log "curl is required to verify the Ollama server."
  exit 1
fi

if wait_for_ollama 2; then
  log "Ollama is already running."
else
  start_ollama
  if ! wait_for_ollama 20; then
    log "Ollama did not become ready. Try running 'ollama serve' manually and rerun this script."
    exit 1
  fi
fi

log "Pulling ${MODEL_NAME}..."
ollama pull "${MODEL_NAME}"

log "Done. You can now run: npm run dev"
