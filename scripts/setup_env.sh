#!/usr/bin/env bash
set +e

# Environment bootstrapper for Ubuntu
# Checks for required tools, installs missing ones, and reports results.

REQUIRED_ITEMS=("git" "docker" "docker_compose" "nodejs_20" "python3.11")
INSTALLED_ITEMS=()
FAILED_ITEMS=()
ERROR_LOG=()

have_git() {
  command -v git >/dev/null 2>&1
}

have_docker() {
  command -v docker >/dev/null 2>&1
}

have_docker_compose() {
  docker compose version >/dev/null 2>&1 || command -v docker-compose >/dev/null 2>&1
}

have_node20() {
  if command -v node >/dev/null 2>&1; then
    NODE_MAJOR=$(node -v | sed 's/^v//' | cut -d. -f1)
    [ "$NODE_MAJOR" -ge 20 ]
  else
    return 1
  fi
}

have_python311() {
  if command -v python3.11 >/dev/null 2>&1; then
    return 0
  fi
  if command -v python3 >/dev/null 2>&1; then
    PY_VER=$(python3 --version 2>/dev/null | awk '{print $2}')
    PY_MAJOR=$(printf '%s' "$PY_VER" | cut -d. -f1)
    PY_MINOR=$(printf '%s' "$PY_VER" | cut -d. -f2)
    [ "$PY_MAJOR" -gt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -ge 11 ]; }
  else
    return 1
  fi
}

install_git() {
  echo "--- Installing git ---"
  sudo apt-get update
  sudo apt-get install -y git
}

install_docker() {
  echo "--- Installing docker ---"
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg lsb-release
  sudo install -m 0755 -d /etc/apt/keyrings

  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

install_node20() {
  echo "--- Installing Node.js 20 ---"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
}

install_python311() {
  echo "--- Installing Python 3.11 ---"
  sudo apt-get update
  sudo apt-get install -y software-properties-common
  sudo apt-get install -y python3.11 python3.11-venv python3.11-dev
}

check_and_install() {
  local name="$1"
  local check_fn="$2"
  local install_fn="$3"

  echo
  echo "=== Checking: $name ==="
  if $check_fn; then
    echo "OK: $name already installed"
    INSTALLED_ITEMS+=("$name (already present)")
  else
    echo "MISSING: $name"
    if $install_fn; then
      if $check_fn; then
        echo "OK: $name installed successfully"
        INSTALLED_ITEMS+=("$name")
      else
        echo "FAIL: $name install command finished, but check still failed"
        FAILED_ITEMS+=("$name")
        ERROR_LOG+=("$name: install completed but verification failed")
      fi
    else
      echo "FAIL: $name installation failed"
      FAILED_ITEMS+=("$name")
      ERROR_LOG+=("$name: installation command failed")
    fi
  fi
}

echo "=== Starting environment check/install ==="

check_and_install "git" have_git install_git
check_and_install "docker" have_docker install_docker
check_and_install "docker compose" have_docker_compose install_docker
check_and_install "Node.js 20+" have_node20 install_node20
check_and_install "Python 3.11+" have_python311 install_python311

echo
echo "==================== SUMMARY ===================="
echo "Required items:"
printf ' - %s\n' "${REQUIRED_ITEMS[@]}"

echo
echo "Installed / already present:"
if [ ${#INSTALLED_ITEMS[@]} -gt 0 ]; then
  printf ' - %s\n' "${INSTALLED_ITEMS[@]}"
else
  echo " - none"
fi

echo
echo "Failed:"
if [ ${#FAILED_ITEMS[@]} -gt 0 ]; then
  printf ' - %s\n' "${FAILED_ITEMS[@]}"
else
  echo " - none"
fi

echo
echo "Errors:"
if [ ${#ERROR_LOG[@]} -gt 0 ]; then
  printf ' - %s\n' "${ERROR_LOG[@]}"
else
  echo " - none"
fi

echo "=== Done ==="
